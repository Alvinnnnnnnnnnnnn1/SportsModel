import { describe, expect, it } from 'vitest';
import type { Bet } from '@/lib/domain/types';
import { commitHistoricalImport, emptyHistoricalWorkspace, prepareImportCommit, reviseImportRow } from '@/lib/imports';
import { financialReview } from '@/lib/imports/calculations';
import { prepareWagerClaimsReview, findHistoricalLedgerMatches, reviewArchivedWagerClaims } from '@/lib/imports/wager-claims';
import { wagerClaimProvenanceIssues, wagerClaimsEnvelopeSchema, type HistoricalWagerClaim, type WagerClaimsEnvelope } from '@/lib/imports/wager-claim-provenance';
import type { HistoricalRecord } from '@/lib/imports/types';

function claim(changes: Partial<HistoricalWagerClaim> = {}): HistoricalWagerClaim {
  return { reference: 'SYNTHETIC-1', sport: 'NBA', eventId: null, event: 'SYNTHETIC City vs SYNTHETIC Town', participant: 'SYNTHETIC Player', marketId: null, market: 'Player points', selection: 'Over 10.5 points', line: '10.5', bookmaker: 'SYNTHETIC Book', reportedStakeCents: 500, stakeType: 'cash', reportedOdds: 2, reportedOddsKind: 'owner_reported', acceptedOdds: null, acceptedOddsSource: null, placedAt: null, settledAt: null, ticketId: null, reportedOutcome: 'lost', reportedCashPayoutCents: 0, strategy: null, sourceReferences: ['SYNTHETIC original source'], evidenceNotes: ['SYNTHETIC evidence only; no real wager.'], legs: [{ sport: 'NBA', eventId: null, event: null, participant: 'SYNTHETIC Player', marketId: null, market: 'Player points', selection: 'Over 10.5 points', line: '10.5', odds: null, outcome: null, statistic: null }], ...changes };
}
function envelope(records = [claim()]): WagerClaimsEnvelope {
  return { format: 'edgelab.historical-wager-claims', version: 1, sourceClass: 'synthetic', sourceId: 'SYNTHETIC-stable-source', sourceReference: 'SYNTHETIC owner report', sourceText: 'SYNTHETIC owner report for local tests only.', checkpoint: null, records };
}
const prepare = (value = envelope(), extra: Partial<Parameters<typeof prepareWagerClaimsReview>[0]> = {}) => prepareWagerClaimsReview({ text: JSON.stringify(value), sourceName: 'SYNTHETIC-wager-claims.json', mode: 'demo', ...extra });
function archived(review: Awaited<ReturnType<typeof prepare>>, rowNumber = 1): HistoricalRecord {
  const row = review.preview.rows[rowNumber - 1];
  return { id: crypto.randomUUID(), batchId: crypto.randomUUID(), importedAt: '2026-01-03T00:00:00Z', rowNumber, raw: row.raw, snapshot: row.snapshot, fingerprint: row.fingerprint, issues: row.issues, transformations: row.transformations, incompleteConfirmed: true, probableDuplicateConfirmed: false };
}
function completeClaim(): HistoricalWagerClaim {
  const base = claim({ acceptedOdds: 2, acceptedOddsSource: 'SYNTHETIC original executed ticket', placedAt: '2026-01-01T00:00:00Z', settledAt: '2026-01-02T00:00:00Z', ticketId: 'SYNTHETIC-TICKET', strategy: 'C', reportedOutcome: 'won', reportedCashPayoutCents: 1000 });
  return { ...base, legs: base.legs.map(leg => ({ ...leg, event: base.event, odds: 2, outcome: 'won' })) };
}

describe('historical wager claims remain provisional until complete financial confirmation', () => {
  it('reconciles reported cash and promotional returns without bonus principal, paper activity or invented funding', async () => {
    const records = [
      claim({ reference: 'SYNTHETIC-cash-win', reportedStakeCents: 1000, reportedOdds: 2.5, reportedOutcome: 'won', reportedCashPayoutCents: 2500 }),
      ...['A', 'B', 'C', 'D'].map(reference => claim({ reference: `SYNTHETIC-cash-loss-${reference}` })),
      claim({ reference: 'SYNTHETIC-bonus-win', stakeType: 'bonus', reportedOdds: 1.86, reportedOutcome: 'won', reportedCashPayoutCents: 430 }),
      ...['E', 'F'].map(reference => claim({ reference: `SYNTHETIC-pending-${reference}`, reportedOddsKind: 'pre_placement_quote', reportedOdds: 2.04, reportedOutcome: 'pending', reportedCashPayoutCents: null })),
    ].map((record, index) => ({ ...record, event: `SYNTHETIC fixture ${index}`, participant: `SYNTHETIC participant ${index}`, legs: record.legs.map(leg => ({ ...leg, event: `SYNTHETIC fixture ${index}`, participant: `SYNTHETIC participant ${index}` })) }));
    const value = envelope(records); value.checkpoint = { reportedRealisedProfitCents: -70, modelledAllocationBeforeExposureCents: 49930, modelledAllocationAfterExposureCents: 48930 };
    const review = await prepare(value);
    expect(review.summary).toMatchObject({ claimCount: 8, settledCashCount: 5, settledBonusCount: 1, pendingCashCount: 2, settledCashStakeCents: 3000, settledCashReturnCents: 2500, bonusCashWinningsCents: 430, bonusFaceStakeCents: 500, reportedRealisedProfitCents: -70, pendingCashExposureCents: 1000, modelledAllocationBeforeExposureCents: 49930, modelledAllocationAfterExposureCents: 48930, fundingInferred: false });
    expect(review.financialReadiness.every(row => !row.eligible)).toBe(true);
    expect(review.preview.rows.every(row => row.snapshot.odds === null && row.snapshot.placedAt === null && row.snapshot.settledAt === null)).toBe(true);
  });

  it('preserves the reported price and raw evidence while accepted odds, exact timestamps and ticket IDs remain unknown', async () => {
    const value = envelope([claim({ reportedOdds: 1.72, reportedOddsKind: 'pre_placement_quote', reportedOutcome: 'pending', reportedCashPayoutCents: null })]);
    const review = await prepare(value);
    expect(review.preview.rows[0].snapshot).toMatchObject({ odds: null, placedAt: null, settledAt: null, probability: null, outcome: 'pending', payoutCents: null });
    expect((review.preview.rows[0].raw as { sourceDocument: { claim: HistoricalWagerClaim } }).sourceDocument.claim).toEqual(value.records[0]);
    expect(JSON.parse(review.mappedText).sourceEvidence.originalSource).toBe(JSON.stringify(value));
    expect(review.summary.reportedRealisedProfitCents).toBe(0);
    expect(review.summary.pendingCashExposureCents).toBe(500);
  });

  it('allows explicit archive confirmation without writing any actual financial or paper records', async () => {
    const review = await prepare(); const history = emptyHistoricalWorkspace();
    const next = commitHistoricalImport(history, prepareImportCommit(review.preview, [{ rowNumber: 1, include: true, acknowledgeIncomplete: true, allowProbableDuplicate: false }], 'synthetic', []));
    expect(history.records).toHaveLength(0); expect(next.records).toHaveLength(1);
    expect(next.paperResults).toEqual([]); expect(next.audit[0].after).toMatchObject({ financialEffect: 'archive_only_no_funding_or_ledger_writes' });
    expect(reviewArchivedWagerClaims(next.records, [], 'demo').summary.claimCount).toBe(1);
    expect(reviewArchivedWagerClaims(next.records, [], 'supabase').rows).toEqual([]);
  });

  it('keeps absent claim legs empty without deriving leg outcomes from a source-reported ticket result', async () => {
    const review = await prepare(envelope([claim({ legs: [], reportedOutcome: 'won', reportedCashPayoutCents: 1000 })]));
    expect(review.preview.rows[0].snapshot.legs).toEqual([]);
    expect(review.rows[0].archiveEligible).toBe(true);
    expect(review.rows[0].financial.bet).toBeNull();
    expect(review.rows[0].financial.issues.some(issue => issue.field === 'legs')).toBe(true);
  });

  it('rejects malformed money, unsupported financial claims and accepted prices without an execution source', async () => {
    await expect(prepare(envelope([claim({ reportedStakeCents: 500.1 })]))).rejects.toThrow();
    await expect(prepare(envelope([claim({ acceptedOdds: 2.04 })]))).rejects.toThrow('Accepted execution odds');
    await expect(prepare(envelope([claim({ reportedOdds: 0 })]))).rejects.toThrow();
    await expect(prepare(envelope([claim({ reportedCashPayoutCents: 500 })]))).rejects.toThrow('Lost/pending');
    await expect(prepare(envelope([claim({ reportedOutcome: 'pending', settledAt: '2026-01-01T00:00:00Z' })]))).rejects.toThrow('source-pending');
    expect(wagerClaimsEnvelopeSchema.safeParse(envelope([claim({ stakeType: 'paper' as never })])).success).toBe(false);
  });

  it('rejects synthetic/private relabelling and credential-bearing original evidence', async () => {
    await expect(prepare(envelope(), { mode: 'supabase' })).rejects.toThrow('Synthetic claims');
    const owner = envelope(); owner.sourceClass = 'owner_reported';
    await expect(prepare(owner)).rejects.toThrow('authenticated private workspace');
    const credential = envelope(); credential.sourceText = 'SYNTHETIC password: never-retain-this';
    await expect(prepare(credential)).rejects.toThrow('credentials');
  });

  it('keeps inconsistent promotional payouts blocked rather than adding the bonus face value to cash returns', async () => {
    const review = await prepare(envelope([claim({ stakeType: 'bonus', reportedOdds: 1.86, reportedOutcome: 'won', reportedCashPayoutCents: 930 })]));
    expect(review.rows[0].archiveEligible).toBe(false);
    expect(review.preview.rows[0].issues.some(issue => issue.code === 'reported_financial_mismatch')).toBe(true);
    expect(wagerClaimProvenanceIssues(archived(review)).some(issue => issue.field === 'payoutCents')).toBe(true);
  });

  it('does not use a pre-placement quote to infer execution payout or settle a pending claim', async () => {
    const review = await prepare(envelope([claim({ reportedOddsKind: 'pre_placement_quote', reportedOdds: 1.72, reportedOutcome: 'pending', reportedCashPayoutCents: null })]));
    expect(review.rows[0].archiveEligible).toBe(true);
    expect(review.preview.rows[0].snapshot.outcome).toBe('pending');
    expect(review.rows[0].financial.expectedPayoutCents).toBeNull();
  });

  it('requires evidence before a generic correction can promote reported odds or import timestamps into actual fields', async () => {
    const review = await prepare(); const original = archived(review);
    const changed = structuredClone(original); changed.snapshot.odds = 2; changed.snapshot.placedAt = original.importedAt;
    expect(wagerClaimProvenanceIssues(changed).map(issue => issue.field)).toEqual(expect.arrayContaining(['odds', 'placedAt']));
    const corrected = await reviseImportRow(review.preview, 1, { ...(review.preview.rows[0].raw as object), odds: 2, placedAt: original.importedAt });
    expect(corrected.rows[0].issues.some(issue => issue.severity === 'error' && issue.code === 'wager_claim_provenance_blocked')).toBe(true);
    expect(() => prepareImportCommit(corrected, [{ rowNumber: 1, include: true, acknowledgeIncomplete: true, allowProbableDuplicate: false }], 'synthetic')).toThrow('unresolved errors');
    const record = { ...original, snapshot: corrected.rows[0].snapshot, transformations: corrected.rows[0].transformations };
    expect(financialReview(record).bet).toBeNull();
    expect(financialReview(record).issues.some(issue => issue.code === 'wager_claim_provenance_blocked' && issue.field === 'odds')).toBe(true);
  });

  it('delegates genuine complete entry eligibility to the unchanged existing financial review', async () => {
    const review = await prepare(envelope([completeClaim()]));
    expect(review.rows[0].financial.bet).not.toBeNull();
    expect(review.financialReadiness[0].eligible).toBe(true);
    expect(review.rows[0].financial.expectedPayoutCents).toBe(1000);
  });

  it('detects exact repeats and cross-namespace actual claims without matching existing paper history', async () => {
    const first = await prepare(); const existing = archived(first);
    const exact = await prepare(envelope(), { existingRecords: [existing] });
    expect(exact.rows[0].duplicates.some(duplicate => duplicate.level === 'exact')).toBe(true);
    expect(exact.rows[0].archiveEligible).toBe(false);
    const legacy = structuredClone(existing); legacy.snapshot.externalId = 'SYNTHETIC-older-source-id'; legacy.snapshot.event = null; legacy.snapshot.sourceReference = 'SYNTHETIC original source'; legacy.fingerprint = '0'.repeat(64);
    const overlap = await prepare(envelope(), { existingRecords: [legacy] });
    expect(overlap.rows[0].duplicates.some(duplicate => duplicate.level === 'probable')).toBe(true);
    legacy.snapshot.kind = 'paper';
    expect((await prepare(envelope(), { existingRecords: [legacy] })).rows[0].duplicates).toEqual([]);
  });

  it('recognizes an existing actual entry by archive ID and conservatively flags semantic repeats under new IDs', async () => {
    const review = await prepare(envelope([completeClaim()])); const record = archived(review);
    const bet = { ...review.rows[0].financial.bet!, id: record.id } satisfies Bet;
    expect(findHistoricalLedgerMatches(record, [bet])[0].level).toBe('exact');
    expect(findHistoricalLedgerMatches(record, [{ ...bet, id: crypto.randomUUID() }])[0].level).toBe('probable');
    const repeated = await prepare(envelope([completeClaim()]), { bets: [{ ...bet, id: crypto.randomUUID() }] });
    expect(repeated.financialReadiness[0].eligible).toBe(false);
  });

  it('does not mistake opposite selections, signed thresholds or explicitly different fixtures for a duplicate ticket', async () => {
    const review = await prepare(envelope([completeClaim()])); const record = archived(review);
    const bet = { ...review.rows[0].financial.bet!, id: crypto.randomUUID(), notes: 'SYNTHETIC unrelated ticket source' } satisfies Bet;
    const opposite = { ...bet, legs: bet.legs.map(leg => ({ ...leg, selection: 'Under 10.5 points' })) };
    expect(findHistoricalLedgerMatches(record, [opposite])).toEqual([]);
    const fixture = { ...bet, legs: bet.legs.map(leg => ({ ...leg, event: 'SYNTHETIC different fixture' })) };
    expect(findHistoricalLedgerMatches(record, [fixture])).toEqual([]);
    record.snapshot.legs[0].line = '-3.5';
    expect(findHistoricalLedgerMatches(record, [{ ...bet, legs: bet.legs.map(leg => ({ ...leg, line: '+3.5' })) }])).toEqual([]);
  });

  it('rechecks original source aliases at final archive preparation even when a stale preview lacked that record', async () => {
    const first = await prepare(); const legacy = archived(first);
    legacy.snapshot.event = null; legacy.snapshot.externalId = 'SYNTHETIC-older-namespace';
    legacy.snapshot.sourceReference = 'SYNTHETIC original source'; legacy.fingerprint = '0'.repeat(64);
    const stale = await prepare(); expect(stale.rows[0].duplicates).toEqual([]);
    expect(() => prepareImportCommit(stale.preview, [{ rowNumber: 1, include: true, acknowledgeIncomplete: true, allowProbableDuplicate: false }], 'synthetic', [legacy])).toThrow('may duplicate');
    const allowed = prepareImportCommit(stale.preview, [{ rowNumber: 1, include: true, acknowledgeIncomplete: true, allowProbableDuplicate: true }], 'synthetic', [legacy]);
    expect(allowed.records).toHaveLength(1); expect(allowed.records[0].probableDuplicateConfirmed).toBe(true);
  });

  it('preserves overlapping archive claims while suppressing double-counted reported financial totals', async () => {
    const first = await prepare(); const secondInput = envelope([claim({ reference: 'SYNTHETIC-other-reference' })]); secondInput.sourceId = 'SYNTHETIC-other-source';
    const second = await prepare(secondInput); const a = archived(first), b = archived(second); b.probableDuplicateConfirmed = true;
    const before = structuredClone([a, b]);
    const summary = reviewArchivedWagerClaims([a, b], [], 'demo');
    expect(summary.rows).toHaveLength(2); expect(summary.summary.claimCount).toBe(2);
    expect(summary.summary).toMatchObject({ duplicateUncertainty: true, settledCashStakeCents: null, settledCashReturnCents: null, reportedRealisedProfitCents: null, pendingCashExposureCents: null });
    expect(summary.warnings).toHaveLength(1); expect([a, b]).toEqual(before);
    const internal = await prepare(envelope([claim(), claim({ reference: 'SYNTHETIC-other-reference' })]));
    expect(internal.summary.duplicateUncertainty).toBe(true); expect(internal.summary.reportedRealisedProfitCents).toBeNull();
  });

  it('keeps incomplete reported amounts unknown and warns about checkpoint disagreement without balancing records', async () => {
    const value = envelope([claim({ reportedCashPayoutCents: null })]);
    const incomplete = await prepare(value);
    expect(incomplete.summary.reportedRealisedProfitCents).toBeNull(); expect(incomplete.summary.unknownFinancialRows).toBe(1);
    const mismatch = envelope(); mismatch.checkpoint = { reportedRealisedProfitCents: 200, modelledAllocationBeforeExposureCents: null, modelledAllocationAfterExposureCents: null };
    const review = await prepare(mismatch);
    expect(review.warnings.some(warning => warning.startsWith('REQUIRES REVIEW:') && warning.includes('does not reconcile'))).toBe(true);
    expect(review.warnings.some(warning => warning.startsWith('BLOCKING:'))).toBe(false);
  });
});
