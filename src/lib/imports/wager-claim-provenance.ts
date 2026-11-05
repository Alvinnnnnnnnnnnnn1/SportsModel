import { z } from 'zod';
import { multiplyMoney } from '@/lib/domain/calculations';
import type { HistoricalRecord, HistoricalSnapshot, ImportIssue } from './types';

export const WAGER_CLAIMS_FORMAT = 'edgelab.historical-wager-claims' as const;
const text = (max = 500) => z.string().min(1).max(max).refine(value => value.trim().length > 0, 'Text cannot be only whitespace.');
const nullableText = (max = 500) => text(max).nullable();
const money = z.number().int().min(0).max(100_000_000).nullable();
const signedMoney = z.number().int().min(-100_000_000).max(100_000_000).nullable();
const odds = z.number().finite().min(1.0001).max(10_000).refine(value => Math.abs(value * 10_000 - Math.round(value * 10_000)) < .00001, 'Use at most four decimal places.').nullable();
const sport = z.enum(['NBA', 'NBL', 'ATP', 'WTA']).nullable();
const outcome = z.enum(['pending', 'won', 'lost', 'void']).nullable();
const timestamp = z.string().datetime({ offset: true }).nullable();

export const historicalWagerClaimLegSchema = z.object({
  sport, eventId: nullableText(), event: nullableText(), participant: nullableText(),
  marketId: nullableText(), market: nullableText(), selection: nullableText(), line: nullableText(100),
  odds, outcome, statistic: nullableText(),
}).strict();

/** An owner report is a source claim, not evidence that a quote was accepted. */
export const historicalWagerClaimSchema = z.object({
  reference: text(200), sport, eventId: nullableText(), event: nullableText(),
  participant: nullableText(), marketId: nullableText(), market: nullableText(), selection: nullableText(), line: nullableText(100),
  bookmaker: nullableText(), reportedStakeCents: money, stakeType: z.enum(['cash', 'bonus']).nullable(),
  reportedOdds: odds, reportedOddsKind: z.enum(['owner_reported', 'pre_placement_quote']),
  acceptedOdds: odds, acceptedOddsSource: nullableText(2000),
  placedAt: timestamp, settledAt: timestamp, ticketId: nullableText(),
  reportedOutcome: outcome, reportedCashPayoutCents: money,
  strategy: z.enum(['A', 'B', 'C']).nullable(),
  sourceReferences: z.array(text(2000)).min(1).max(50), evidenceNotes: z.array(text(2000)).max(100),
  legs: z.array(historicalWagerClaimLegSchema).max(20),
}).strict().superRefine((claim, ctx) => {
  const reject = (field: string, message: string) => ctx.addIssue({ code: 'custom', path: [field], message });
  if (claim.acceptedOdds !== null && claim.acceptedOddsSource === null)
    reject('acceptedOddsSource', 'Accepted execution odds need their explicit source. A reported quote is not accepted execution evidence.');
  if (claim.acceptedOdds === null && claim.acceptedOddsSource !== null)
    reject('acceptedOdds', 'An execution-price source must identify accepted odds; do not infer them from a quote.');
  if (claim.reportedStakeCents === 0)
    reject('reportedStakeCents', 'A reported actual wager stake must be positive or explicitly unknown.');
  if ((claim.reportedOutcome === 'lost' || claim.reportedOutcome === 'pending') && claim.reportedCashPayoutCents !== null && claim.reportedCashPayoutCents !== 0)
    reject('reportedCashPayoutCents', 'Lost/pending claims cannot report a realised cash payout. Preserve disputed evidence separately until resolved.');
  if (claim.reportedOutcome === 'pending' && claim.settledAt !== null)
    reject('settledAt', 'A source-pending claim cannot have a settlement timestamp.');
  if (claim.placedAt && claim.settledAt && Date.parse(claim.settledAt) < Date.parse(claim.placedAt))
    reject('settledAt', 'A reported settlement cannot precede placement.');
});
export type HistoricalWagerClaim = z.infer<typeof historicalWagerClaimSchema>;

export const wagerClaimsCheckpointSchema = z.object({
  reportedRealisedProfitCents: signedMoney,
  modelledAllocationBeforeExposureCents: money, modelledAllocationAfterExposureCents: money,
}).strict();
export type WagerClaimsCheckpoint = z.infer<typeof wagerClaimsCheckpointSchema>;

export const wagerClaimsEnvelopeSchema = z.object({
  format: z.literal(WAGER_CLAIMS_FORMAT), version: z.literal(1),
  sourceClass: z.enum(['owner_reported', 'synthetic']),
  sourceId: text(200), sourceReference: text(2000), sourceText: text(500_000),
  checkpoint: wagerClaimsCheckpointSchema.nullable(), records: z.array(historicalWagerClaimSchema).min(1).max(100),
}).strict().superRefine((value, ctx) => {
  if (new Set(value.records.map(record => record.reference)).size !== value.records.length)
    ctx.addIssue({ code: 'custom', path: ['records'], message: 'Each source reference must be unique within this claim file.' });
});
export type WagerClaimsEnvelope = z.infer<typeof wagerClaimsEnvelopeSchema>;

export const wagerClaimSourceSchema = z.object({
  format: z.literal(WAGER_CLAIMS_FORMAT), version: z.literal(1), sourceClass: z.enum(['owner_reported', 'synthetic']),
  sourceId: text(200), sourceReference: text(2000), sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
  claim: historicalWagerClaimSchema,
}).strict();
export type ArchivedWagerClaim = z.infer<typeof wagerClaimSourceSchema>;

export function readArchivedWagerClaim(record: HistoricalRecord): ArchivedWagerClaim | null {
  if (!record.raw || typeof record.raw !== 'object' || Array.isArray(record.raw)) return null;
  const parsed = wagerClaimSourceSchema.safeParse((record.raw as Record<string, unknown>).sourceDocument);
  return parsed.success ? parsed.data : null;
}

/** A generic import correction must not silently turn raw quote claims into execution facts. */
export function wagerClaimSnapshotIssues(rawValue: unknown, snapshot: HistoricalSnapshot): ImportIssue[] {
  const raw = rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue) ? rawValue as Record<string, unknown> : {};
  const document = raw.sourceDocument;
  if (!document || typeof document !== 'object' || Array.isArray(document) || (document as Record<string, unknown>).format !== WAGER_CLAIMS_FORMAT) return [];
  const parsed = wagerClaimSourceSchema.safeParse(document);
  const issue = (field: string, message: string): ImportIssue => ({ field, severity: 'error', code: 'wager_claim_provenance_blocked', message });
  if (!parsed.success) return [issue('sourceDocument', 'Historical wager claim provenance is invalid. Reopen and resolve the source document; ledger registration is blocked.')];
  const claim = parsed.data.claim, s = snapshot;
  const issues: ImportIssue[] = [];
  const compare = (field: string, value: unknown, expected: unknown) => {
    if (JSON.stringify(value) !== JSON.stringify(expected))
      issues.push(issue(field, 'The proposed financial field differs from the preserved wager claim. Supply and review a new execution/settlement source; do not promote a reported quote or overwrite archived evidence.'));
  };
  compare('kind', s.kind, 'actual'); compare('odds', s.odds, claim.acceptedOdds);
  const instant = (value: string | null) => value === null ? null : new Date(value).toISOString();
  compare('placedAt', s.placedAt, instant(claim.placedAt)); compare('settledAt', s.settledAt, instant(claim.settledAt));
  compare('stakeCents', s.stakeCents, claim.reportedStakeCents); compare('stakeType', s.stakeType, claim.stakeType);
  compare('payoutCents', s.payoutCents, claim.reportedCashPayoutCents); compare('outcome', s.outcome, claim.reportedOutcome);
  compare('bookmaker', s.bookmaker, claim.bookmaker?.trim() ?? null); compare('strategy', s.strategy, claim.strategy);
  for (const field of ['sport', 'eventId', 'event', 'participant', 'marketId', 'market', 'selection', 'line'] as const)
    compare(field, s[field], typeof claim[field] === 'string' ? claim[field]!.trim() : claim[field]);
  for (const field of ['predictionAt', 'probability', 'probabilitySource', 'probabilityMethod', 'modelVersion'] as const)
    compare(field, s[field], null);
  if (claim.reportedOutcome !== null && claim.reportedOutcome !== 'pending' && claim.reportedStakeCents !== null && claim.stakeType !== null && claim.reportedCashPayoutCents !== null && !(claim.reportedOutcome === 'won' && claim.legs.some(leg => leg.outcome === 'void'))) {
    const price = claim.acceptedOdds ?? (claim.reportedOddsKind === 'owner_reported' ? claim.reportedOdds : null);
    const expected = claim.reportedOutcome === 'lost' ? 0 : claim.reportedOutcome === 'void' ? claim.stakeType === 'cash' ? claim.reportedStakeCents : 0 : price === null ? null : multiplyMoney(claim.reportedStakeCents, claim.stakeType === 'cash' ? price : price - 1);
    if (expected !== null && expected !== claim.reportedCashPayoutCents)
      issues.push(issue('payoutCents', 'Reported cash payout disagrees with the stated cash/bonus price arithmetic. Resolve the evidence explicitly; no balancing transaction is inferred.'));
  }
  compare('legs.length', s.legs.length, claim.legs.length);
  for (const [index, leg] of s.legs.entries()) {
    const original = claim.legs[index];
    if (!original) continue;
    for (const field of ['sport', 'eventId', 'event', 'participant', 'marketId', 'market', 'selection', 'line', 'odds', 'outcome', 'statistic'] as const)
      compare(`legs.${index}.${field}`, leg[field], typeof original[field] === 'string' ? original[field]!.trim() : original[field]);
  }
  return issues;
}

export function wagerClaimProvenanceIssues(record: HistoricalRecord): ImportIssue[] {
  return wagerClaimSnapshotIssues(record.raw, record.snapshot);
}

export function wagerClaimSourceReferences(rawValue: unknown): string[] {
  const raw = rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue) ? rawValue as Record<string, unknown> : {};
  const parsed = wagerClaimSourceSchema.safeParse(raw.sourceDocument);
  return parsed.success ? parsed.data.claim.sourceReferences : [];
}
