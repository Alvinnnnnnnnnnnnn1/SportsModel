import type { Bet, Mode } from '@/lib/domain/types';
import { multiplyMoney } from '@/lib/domain/calculations';
import { financialReview } from './calculations';
import { detectHistoricalDuplicates, sha256 } from './duplicates';
import { IMPORT_MAX_BYTES, parseHistoricalSource } from './parser';
import type { HistoricalFinancialReview, HistoricalRecord, ImportDuplicate, ImportPreview, ImportPreviewRow } from './types';
import {
  WAGER_CLAIMS_FORMAT, readArchivedWagerClaim, wagerClaimsEnvelopeSchema,
  type HistoricalWagerClaim, type WagerClaimsCheckpoint, type WagerClaimsEnvelope,
} from './wager-claim-provenance';
export { historicalWagerClaimSchema, readArchivedWagerClaim, wagerClaimsEnvelopeSchema, wagerClaimProvenanceIssues } from './wager-claim-provenance';
export type { HistoricalWagerClaim, WagerClaimsEnvelope } from './wager-claim-provenance';

export interface WagerClaimLedgerMatch { betId: string; level: 'exact' | 'probable'; reason: string; }
export interface WagerClaimsSummary {
  claimCount: number; settledCashCount: number; settledBonusCount: number; pendingCashCount: number;
  settledCashStakeCents: number | null; settledCashReturnCents: number | null;
  bonusCashWinningsCents: number | null; bonusFaceStakeCents: number | null;
  reportedRealisedProfitCents: number | null; pendingCashExposureCents: number | null;
  unknownFinancialRows: number; fundingInferred: false;
  duplicateUncertainty: boolean;
  modelledAllocationBeforeExposureCents: number | null; modelledAllocationAfterExposureCents: number | null;
}
export interface WagerClaimReviewRow {
  rowNumber: number; claim: HistoricalWagerClaim; financial: HistoricalFinancialReview;
  duplicates: ImportDuplicate[]; ledgerMatches: WagerClaimLedgerMatch[]; archiveEligible: boolean;
}
export interface WagerClaimsReview {
  sourceName: string; rawSource: string; envelope: WagerClaimsEnvelope; sourceHash: string;
  preview: ImportPreview; mappedText: string; rows: WagerClaimReviewRow[]; summary: WagerClaimsSummary;
  warnings: string[];
  financialReadiness: { rowNumber: number; reference: string; eligible: boolean; issues: string[] }[];
}

export function isWagerClaimsSource(value: unknown): boolean {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && (value as Record<string, unknown>).format === WAGER_CLAIMS_FORMAT;
}

const normalized = (value: string | null | undefined) => value?.normalize('NFKC').toLowerCase().replace(/[’']/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim() ?? '';
function market(value: string | null) {
  const key = normalized(value);
  if (['threes', 'three pointers', 'three pointers made', '3pm'].includes(key)) return 'three pointers';
  if (['match winner', 'moneyline', 'money line', 'ml'].includes(key)) return 'match winner';
  return key;
}
function threshold(value: string) {
  const trimmed = value.trim();
  return /^[+-]?\d+(?:\.\d+)?$/.test(trimmed) ? String(Number(trimmed)) : trimmed.toLowerCase();
}
function direction(value: string | null) {
  if (!value) return null;
  if (/\bunder\b|\bless than\b/i.test(value)) return 'under';
  if (/\bover\b|\bmore than\b/i.test(value)) return 'over';
  if (/\bat[_ ]least\b|\bor more\b|\d\s*\+/i.test(value)) return 'at_least';
  return null;
}
function sameLeg(a: { sport: string | null; eventId?: string | null; event?: string | null; participant: string | null; market: string | null; selection: string | null; line: string | null }, b: { sport: string | null; eventId?: string | null; event?: string | null; participant: string | null; market: string | null; selection: string | null; line: string | null }) {
  if (!a.sport || a.sport !== b.sport || !normalized(a.participant) || normalized(a.participant) !== normalized(b.participant)) return false;
  if (a.eventId && b.eventId && a.eventId !== b.eventId) return false;
  if (a.event && b.event && normalized(a.event) !== normalized(b.event)) return false;
  if (!market(a.market) || market(a.market) !== market(b.market)) return false;
  const left = direction(a.selection), right = direction(b.selection);
  if (left && right && left !== right) return false;
  if (a.line !== null && b.line !== null) return threshold(a.line) === threshold(b.line);
  return Boolean(normalized(a.selection) && normalized(a.selection) === normalized(b.selection));
}

function addSourceAwareDuplicates(row: ImportPreviewRow, claim: HistoricalWagerClaim, records: HistoricalRecord[]) {
  for (const record of records) {
    if (record.snapshot.kind !== 'actual' || row.duplicates.some(duplicate => duplicate.recordId === record.id)) continue;
    const original = readArchivedWagerClaim(record)?.claim;
    const references = [record.snapshot.sourceReference, ...(original?.sourceReferences ?? [])].filter((value): value is string => value !== null);
    const sourceOverlap = claim.sourceReferences.some(reference => references.includes(reference));
    const sameSelections = row.snapshot.legs.length > 0 && row.snapshot.legs.length === record.snapshot.legs.length && row.snapshot.legs.every(leg => record.snapshot.legs.some(other => sameLeg(leg, other)));
    if (sourceOverlap || sameSelections) row.duplicates.push({ recordId: record.id, level: 'probable', reason: sourceOverlap ? 'Original source evidence overlaps an existing actual claim under a different source namespace. Review rather than importing or merging it again.' : 'Actual claim selections overlap despite incomplete fixture or namespace identity. Review original evidence; no automatic merge.' });
  }
}

/** Conservative overlap checks are warnings, never an automatic merge or proof of fixture identity. */
export function findHistoricalLedgerMatches(record: HistoricalRecord, bets: Bet[]): WagerClaimLedgerMatch[] {
  const s = record.snapshot;
  if (s.kind !== 'actual') return [];
  return bets.flatMap<WagerClaimLedgerMatch>(bet => {
    if (bet.id === record.id) return [{ betId: bet.id, level: 'exact' as const, reason: 'This immutable archive record is already registered in the actual ledger.' }];
    if (s.sourceReference && bet.notes.includes(s.sourceReference)) return [{ betId: bet.id, level: 'probable' as const, reason: 'The ledger already refers to this original source. Review the existing wager instead of registering it again.' }];
    const legs = s.legs.length ? s.legs : [{ sport: s.sport, eventId: s.eventId, event: s.event, participant: s.participant, market: s.market, selection: s.selection, line: s.line }];
    const covered = legs.length === bet.legs.length && legs.length > 0 && legs.every(leg => bet.legs.some(other => sameLeg(leg, other)));
    const sameDescription = s.legs.length === 0 && Boolean(s.event && normalized(s.event) === normalized(bet.legs[0]?.event) && s.selection && normalized(s.selection) === normalized(bet.legs.map(leg => leg.selection).join(' + ')));
    return covered || sameDescription ? [{ betId: bet.id, level: 'probable' as const, reason: 'Participants and market selections overlap an actual ledger entry; fixture time, execution price or source identity may be missing. No automatic merge or repeat registration.' }] : [];
  });
}

function sumKnown(rows: HistoricalWagerClaim[], value: (claim: HistoricalWagerClaim) => number | null): number | null {
  const values = rows.map(value);
  return values.some(amount => amount === null) ? null : values.reduce<number>((sum, amount) => sum + amount!, 0);
}
/** Arithmetic of explicitly reported amounts only. Funding/cap, paper results and bonus face stakes are excluded. */
export function summarizeWagerClaims(claims: HistoricalWagerClaim[], checkpoint: WagerClaimsCheckpoint | null = null): WagerClaimsSummary {
  const settled = (claim: HistoricalWagerClaim) => claim.reportedOutcome !== null && claim.reportedOutcome !== 'pending';
  const cash = claims.filter(claim => claim.stakeType === 'cash' && settled(claim));
  const bonus = claims.filter(claim => claim.stakeType === 'bonus' && settled(claim));
  const pending = claims.filter(claim => claim.stakeType === 'cash' && claim.reportedOutcome === 'pending');
  const cashStake = sumKnown(cash, claim => claim.reportedStakeCents);
  const cashReturn = sumKnown(cash, claim => claim.reportedCashPayoutCents);
  const bonusReturn = sumKnown(bonus, claim => claim.reportedCashPayoutCents);
  const unknownFinancialRows = claims.filter(claim => claim.stakeType === null || claim.reportedStakeCents === null || claim.reportedOutcome === null || (settled(claim) && claim.reportedCashPayoutCents === null)).length;
  return {
    claimCount: claims.length, settledCashCount: cash.length, settledBonusCount: bonus.length, pendingCashCount: pending.length,
    settledCashStakeCents: cashStake, settledCashReturnCents: cashReturn, bonusCashWinningsCents: bonusReturn,
    bonusFaceStakeCents: sumKnown(claims.filter(claim => claim.stakeType === 'bonus'), claim => claim.reportedStakeCents),
    reportedRealisedProfitCents: unknownFinancialRows || cashStake === null || cashReturn === null || bonusReturn === null ? null : cashReturn - cashStake + bonusReturn,
    pendingCashExposureCents: sumKnown(pending, claim => claim.reportedStakeCents), unknownFinancialRows, fundingInferred: false, duplicateUncertainty: false,
    modelledAllocationBeforeExposureCents: checkpoint?.modelledAllocationBeforeExposureCents ?? null,
    modelledAllocationAfterExposureCents: checkpoint?.modelledAllocationAfterExposureCents ?? null,
  };
}

function withoutUncertainRollups(summary: WagerClaimsSummary): WagerClaimsSummary {
  return { ...summary, duplicateUncertainty: true, settledCashStakeCents: null, settledCashReturnCents: null, bonusCashWinningsCents: null, bonusFaceStakeCents: null, reportedRealisedProfitCents: null, pendingCashExposureCents: null };
}

function recordFromRow(row: ImportPreviewRow): HistoricalRecord {
  return { id: '00000000-0000-4000-8000-000000000001', batchId: '00000000-0000-4000-8000-000000000002', rowNumber: row.rowNumber, importedAt: new Date().toISOString(), raw: row.raw, fingerprint: row.fingerprint, snapshot: row.snapshot, issues: row.issues, transformations: row.transformations, probableDuplicateConfirmed: false, incompleteConfirmed: false };
}
function quoteFinancialMismatch(claim: HistoricalWagerClaim): string | null {
  if (claim.reportedOutcome === null || claim.reportedOutcome === 'pending' || claim.reportedStakeCents === null || claim.stakeType === null || claim.reportedCashPayoutCents === null) return null;
  // A pre-placement quote cannot establish a later executed payout.
  const price = claim.acceptedOdds ?? (claim.reportedOddsKind === 'owner_reported' ? claim.reportedOdds : null);
  const expected = claim.reportedOutcome === 'lost' ? 0 : claim.reportedOutcome === 'void' ? claim.stakeType === 'cash' ? claim.reportedStakeCents : 0 : price === null ? null : multiplyMoney(claim.reportedStakeCents, claim.stakeType === 'cash' ? price : price - 1);
  if (claim.reportedOutcome === 'won' && claim.legs.some(leg => leg.outcome === 'void')) return null;
  return expected !== null && expected !== claim.reportedCashPayoutCents ? 'Reported cash payout disagrees with the stated cash/bonus price arithmetic. Resolve the evidence explicitly; no balancing transaction is inferred.' : null;
}

/** Produce an existing-importer-compatible archive preview; never save or construct financial transactions. */
export async function prepareWagerClaimsReview(input: { text: string; sourceName: string; existingRecords?: HistoricalRecord[]; bets?: Bet[]; mode: Mode }): Promise<WagerClaimsReview> {
  if (new TextEncoder().encode(input.text).byteLength > IMPORT_MAX_BYTES) throw new Error('Wager claim review is limited to 1 MiB.');
  let decoded: unknown;
  try { decoded = JSON.parse(input.text.replace(/^\uFEFF/, '')); } catch { throw new Error('Historical wager claims must be valid JSON.'); }
  const envelope = wagerClaimsEnvelopeSchema.parse(decoded);
  if ((input.mode === 'demo') !== (envelope.sourceClass === 'synthetic')) throw new Error('Synthetic claims belong only in Demo; owner-reported wager evidence belongs only in the authenticated private workspace.');
  const verification = envelope.sourceClass === 'synthetic' ? 'synthetic' : 'unverified';
  // Apply the existing recursive credentials/Unicode/depth guards to all original evidence, not just mapped fields.
  await parseHistoricalSource({ text: JSON.stringify([{ sourceDocument: envelope }]), sourceName: input.sourceName, format: 'json', verification });
  const sourceHash = await sha256(input.text);
  const mappedRows = envelope.records.map(claim => ({
    externalId: claim.reference, eventId: claim.eventId, marketId: claim.marketId, kind: 'actual',
    sport: claim.sport, event: claim.event, participant: claim.participant, market: claim.market, selection: claim.selection, line: claim.line,
    bookmaker: claim.bookmaker, odds: claim.acceptedOdds, predictionAt: null, placedAt: claim.placedAt, settledAt: claim.settledAt,
    probability: null, probabilitySource: null, probabilityMethod: null, modelVersion: null, strategy: claim.strategy,
    sourceReference: `edgelab:wager-claim:${encodeURIComponent(envelope.sourceId)}#${encodeURIComponent(claim.reference)}`,
    stakeCents: claim.reportedStakeCents, stakeType: claim.stakeType, payoutCents: claim.reportedCashPayoutCents, outcome: claim.reportedOutcome, verification,
    notes: 'Owner-reported historical wager claim. Reported prices/quotes and cash payouts are not independently verified execution evidence. Source-time pending status is not a current outcome. Archive approval has no financial effect.',
    legs: claim.legs,
    sourceDocument: { format: WAGER_CLAIMS_FORMAT, version: 1, sourceClass: envelope.sourceClass, sourceId: envelope.sourceId, sourceReference: envelope.sourceReference, sourceHash, claim },
  }));
  const mappedText = JSON.stringify({ records: mappedRows, sourceEvidence: { format: WAGER_CLAIMS_FORMAT, version: 1, sourceHash, originalSource: input.text, financialEffect: 'archive_only_no_ledger_or_funding_writes' } }, null, 2);
  const preview = await parseHistoricalSource({ text: mappedText, sourceName: input.sourceName, format: 'json', verification, existingRecords: input.existingRecords });
  const rows = preview.rows.map(row => {
    const claim = envelope.records[row.rowNumber - 1];
    addSourceAwareDuplicates(row, claim, input.existingRecords ?? []);
    row.issues = row.issues.filter(issue => !(issue.field === 'sourceDocument' && issue.code === 'unmapped_field'));
    row.issues.push({ field: 'execution', severity: 'warning', code: 'owner_reported_financial_claim', message: 'Owner-reported evidence only. Archive approval does not confirm accepted execution odds, ticket details, placement time or current outcome, and has no ledger/funding effect.' });
    if (claim.acceptedOdds === null) row.issues.push({ field: 'odds', severity: 'warning', code: 'accepted_execution_odds_unknown', message: 'Accepted execution odds remain null. Original reported prices/pre-placement quotes are preserved separately and must not be substituted.' });
    const mismatch = quoteFinancialMismatch(claim);
    if (mismatch) row.issues.push({ field: 'payoutCents', severity: 'error', code: 'reported_financial_mismatch', message: mismatch });
    row.transformations.push({ field: 'sourceDocument', original: claim, normalized: { acceptedOdds: claim.acceptedOdds, reportedOdds: claim.reportedOdds, reportedOddsKind: claim.reportedOddsKind }, rule: 'owner_wager_claim_archive_mapping_v1' });
    const record = recordFromRow(row), ledgerMatches = findHistoricalLedgerMatches(record, input.bets ?? []);
    for (const match of ledgerMatches) row.issues.push({ field: 'ledger', severity: match.level === 'exact' ? 'error' : 'warning', code: 'existing_ledger_claim_match', message: match.reason });
    const financial = financialReview(record);
    return { rowNumber: row.rowNumber, claim, financial, duplicates: row.duplicates, ledgerMatches, archiveEligible: !row.issues.some(issue => issue.severity === 'error') && !row.duplicates.some(duplicate => duplicate.level === 'exact') };
  });
  const internalOverlap = rows.some(row => row.duplicates.some(duplicate => duplicate.recordId.startsWith('row:')));
  const summary = internalOverlap ? withoutUncertainRollups(summarizeWagerClaims(envelope.records, envelope.checkpoint)) : summarizeWagerClaims(envelope.records, envelope.checkpoint);
  const warnings = ['Preview of owner reports only; no historical record, actual wager, deposit or funding transaction has been saved.', 'Historical claims and modelled allocations must remain separate from registered actual-ledger totals and verified sportsbook balances.', 'Pending is the last reported source status; current results require separate sourced reconciliation. Do not infer a result from elapsed time.', 'Do not add local-preview totals to archive totals: they can describe the same wagers. Exact duplicates are excluded; probable overlaps require review rather than automatic merging.'];
  if (internalOverlap) warnings.push('REQUIRES REVIEW: this file contains overlapping wager claims. All source rows are preserved, but financial rollups remain unknown until distinct wager identities are resolved. No automatic merge.');
  if (envelope.checkpoint?.reportedRealisedProfitCents !== null && envelope.checkpoint?.reportedRealisedProfitCents !== undefined && summary.reportedRealisedProfitCents !== null && envelope.checkpoint.reportedRealisedProfitCents !== summary.reportedRealisedProfitCents) warnings.push('REQUIRES REVIEW: owner-reported realised P/L checkpoint does not reconcile to the individual reported cash/bonus amounts. The aggregate report does not authorize a balancing record or change actual ledger totals.');
  const before = envelope.checkpoint?.modelledAllocationBeforeExposureCents, after = envelope.checkpoint?.modelledAllocationAfterExposureCents;
  if (before !== null && before !== undefined && after !== null && after !== undefined && summary.pendingCashExposureCents !== null && before - summary.pendingCashExposureCents !== after) warnings.push('REQUIRES REVIEW: reported modelled allocations do not reconcile to reported pending exposure; no balancing deposit is inferred.');
  return { sourceName: input.sourceName, rawSource: input.text, envelope, sourceHash, preview, mappedText, rows, summary, warnings,
    financialReadiness: rows.map(row => ({ rowNumber: row.rowNumber, reference: row.claim.reference, eligible: row.financial.bet !== null && row.ledgerMatches.length === 0 && !row.duplicates.some(duplicate => duplicate.level === 'exact'), issues: [...row.financial.issues.map(issue => `${issue.field}: ${issue.message}`), ...row.ledgerMatches.map(match => match.reason)] })),
  };
}

/** Read saved raw provenance only; private/demo classification is never inferred from local browser contents. */
export function reviewArchivedWagerClaims(records: HistoricalRecord[], bets: Bet[], mode: Mode) {
  const included: HistoricalRecord[] = [];
  let duplicateUncertainty = false;
  const rows = records.flatMap(record => {
    const source = readArchivedWagerClaim(record);
    if (!source || ((mode === 'demo') !== (source.sourceClass === 'synthetic')) || ((mode === 'demo') !== (record.snapshot.verification === 'synthetic'))) return [];
    if (record.probableDuplicateConfirmed || detectHistoricalDuplicates(record.snapshot, record.fingerprint, included, [], record.raw).length > 0) duplicateUncertainty = true;
    included.push(record);
    return [{ recordId: record.id, claim: source.claim, financial: financialReview(record), ledgerMatches: findHistoricalLedgerMatches(record, bets) }];
  });
  const summary = summarizeWagerClaims(rows.map(row => row.claim));
  return { rows, summary: duplicateUncertainty ? withoutUncertainRollups(summary) : summary, warnings: duplicateUncertainty ? ['Archived wager claims overlap or retain a probable-duplicate acknowledgement. Financial rollups are unknown until their distinct identities are resolved; no records were merged or deleted.'] : [] };
}

/** Reconcile saved previews against current archive records on every render/reload; never trust stale duplicate badges. */
export function wagerClaimArchiveDuplicates(row: ImportPreviewRow, records: HistoricalRecord[]): ImportDuplicate[] {
  return detectHistoricalDuplicates(row.snapshot, row.fingerprint, records, [], row.raw);
}
