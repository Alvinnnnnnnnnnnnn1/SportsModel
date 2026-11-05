import type { AppData, Bet } from '@/lib/domain/types';
import { betProfit, betReturn } from '@/lib/domain/calculations';
import type { HistoricalWorkspace, ImportPreview } from '@/lib/imports/types';
import { computeHypothetical, financialReview } from '@/lib/imports';
/** User-supplied checkpoint only. These are NOT source records, transactions, or a bookmaker balance. */
export const DAY_5_CHECKPOINT = Object.freeze({
  status: 'unverified_reference' as const, reportedCompletedDay: 5, actualSettledCount: 6, actualWon: 2, actualLost: 4,
  cashStakeCents: 3000, cashReturnCents: 2500, bonusCashReturnCents: 430,
  modelledRealisedProfitCents: -70, allocatedExperimentalBalanceCents: 49930,
  paperSettledCount: 11, paperWon: 8, paperLost: 3, paperPending: 4,
  noNewCashBetDays: [4, 5] as const,
  note: 'Unverified reconciliation checkpoint supplied by the user. Allocated balance is not a verified Sportsbet balance or proof of A$500 deposited. Recovered source describes five cash wagers and one bonus wager, not independently execution-verified; no seventh wager is inferred.',
});
export interface ReconciliationLine { key: string; label: string; expected: number; observed: number; matches: boolean; unit: 'count' | 'AUD_cents'; }
export interface CheckpointReconciliation { status: 'unverified_reference'; comparisonScope: 'all_current_records_not_day5_filtered'; lines: ReconciliationLine[]; warnings: string[]; observedLedgerProfitCents: number; unresolvedActualRecords: number; fundingInferred: false; }
function compare(key: string, label: string, expected: number, observed: number, unit: ReconciliationLine['unit'] = 'count'): ReconciliationLine { return { key, label, expected, observed, matches: expected === observed, unit }; }
export function reconcileDay5Checkpoint(appData: AppData, history: HistoricalWorkspace): CheckpointReconciliation {
  const bets = appData.bets;
  const decisive = bets.filter(bet => bet.outcome === 'won' || bet.outcome === 'lost');
  const settledCash = bets.filter(bet => bet.stakeType === 'cash' && bet.outcome !== 'pending' && bet.outcome !== 'void');
  const bonus = bets.filter(bet => bet.stakeType === 'bonus' && bet.outcome !== 'pending');
  const importedPapers = history.records.filter(record => record.snapshot.kind === 'paper' || record.snapshot.kind === null && history.paperResults.some(result => result.recordId === record.id));
  const paperOutcomes = [...appData.paperPredictions.map(paper => paper.outcome), ...importedPapers.map(record => history.paperResults.find(result => result.recordId === record.id)?.outcome ?? record.snapshot.outcome)];
  const realised = bets.filter(bet => bet.outcome !== 'pending').reduce((sum, bet) => sum + betProfit(bet), 0);
  const lines = [
    compare('actualSettledCount', 'Reported settled wagers including bonus', 6, decisive.length),
    compare('actualWon', 'Actual wins', 2, decisive.filter(bet => bet.outcome === 'won').length),
    compare('actualLost', 'Actual losses', 4, decisive.filter(bet => bet.outcome === 'lost').length),
    compare('cashStakeCents', 'Decisive cash stakes', 3000, settledCash.reduce((sum, bet) => sum + bet.stakeCents, 0), 'AUD_cents'),
    compare('cashReturnCents', 'Cash-bet returns', 2500, settledCash.reduce((sum, bet) => sum + betReturn(bet), 0), 'AUD_cents'),
    compare('bonusCashReturnCents', 'Bonus-bet cash returns', 430, bonus.reduce((sum, bet) => sum + betReturn(bet), 0), 'AUD_cents'),
    compare('modelledRealisedProfitCents', 'Modelled realised cash P/L', -70, realised, 'AUD_cents'),
    compare('paperSettledCount', 'Settled paper predictions', 11, paperOutcomes.filter(outcome => outcome === 'won' || outcome === 'lost').length),
    compare('paperWon', 'Paper wins', 8, paperOutcomes.filter(outcome => outcome === 'won').length),
    compare('paperLost', 'Paper losses', 3, paperOutcomes.filter(outcome => outcome === 'lost').length),
    compare('paperPending', 'Pending paper predictions', 4, paperOutcomes.filter(outcome => outcome === 'pending').length),
  ];
  const unresolvedActualRecords = history.records.filter(record => record.snapshot.kind === 'actual' && !appData.bets.some(bet => bet.id === record.id)).length;
  const warnings = [DAY_5_CHECKPOINT.note, 'Observed totals include all current ledger/paper records, not a Day 5-filtered source set. Later research days can legitimately differ; this comparison cannot certify the Day 5 history.', 'Matching aggregates cannot establish record accuracy. Original selections, prices, timestamps, outcomes and bonus classification still require source review. No funding or bookmaker balance is inferred.'];
  if (!bets.length && !history.records.length) warnings.push('No source history has been imported. Zero observed records must not be replaced with checkpoint totals.');
  if (unresolvedActualRecords) warnings.push(`${unresolvedActualRecords} actual-source archive records have not received separate financial confirmation and are excluded from the ledger comparison.`);
  if (lines.some(line => !line.matches)) warnings.push('Checkpoint differences are unresolved. Do not create balancing bets, deposits or returns to make the totals match.');
  return { status: 'unverified_reference', comparisonScope: 'all_current_records_not_day5_filtered', lines, warnings, observedLedgerProfitCents: realised, unresolvedActualRecords, fundingInferred: false };
}
/** Proposed import comparison; only complete actual rows are calculable, never funded or committed here. */
export function reconcileImportPreview(preview: ImportPreview) {
  const actual: Bet[] = []; const unresolved: { rowNumber: number; issues: string[] }[] = [];
  for (const row of preview.rows.filter(row => row.snapshot.kind === 'actual')) {
    const temporary = { id: crypto.randomUUID(), batchId: crypto.randomUUID(), rowNumber: row.rowNumber, importedAt: new Date().toISOString(), raw: row.raw, fingerprint: row.fingerprint, snapshot: row.snapshot, issues: row.issues, transformations: row.transformations, probableDuplicateConfirmed: false, incompleteConfirmed: false };
    const review = financialReview(temporary);
    if (review.bet) actual.push(review.bet); else unresolved.push({ rowNumber: row.rowNumber, issues: review.issues.map(issue => issue.message) });
  }
  const paper = preview.rows.filter(row => row.snapshot.kind === 'paper');
  const paperReturns = paper.map(row => computeHypothetical({ id: crypto.randomUUID(), batchId: crypto.randomUUID(), rowNumber: row.rowNumber, importedAt: new Date().toISOString(), raw: row.raw, fingerprint: row.fingerprint, snapshot: row.snapshot, issues: row.issues, transformations: row.transformations, probableDuplicateConfirmed: false, incompleteConfirmed: false }));
  return { checkpoint: DAY_5_CHECKPOINT, proposedActualCount: preview.rows.filter(row => row.snapshot.kind === 'actual').length, calculableActualCount: actual.length, cashStakeCents: actual.filter(bet => bet.stakeType === 'cash').reduce((sum, bet) => sum + bet.stakeCents, 0), cashReturnCents: actual.filter(bet => bet.stakeType === 'cash').reduce((sum, bet) => sum + betReturn(bet), 0), bonusCashReturnCents: actual.filter(bet => bet.stakeType === 'bonus').reduce((sum, bet) => sum + betReturn(bet), 0), modelledProfitCents: actual.reduce((sum, bet) => sum + betProfit(bet), 0), paperCount: paper.length, hypotheticalPaperProfitCents: paperReturns.every(result => result.profitCents !== null) ? paperReturns.reduce((sum, result) => sum + result.profitCents!, 0) : null, unresolved, fundingInferred: false as const, financialEffect: 'preview_only_no_ledger_or_funding_writes' as const };
}
