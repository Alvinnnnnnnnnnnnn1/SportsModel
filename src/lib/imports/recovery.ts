import { parseHistoricalSource } from './parser';
import { sha256 } from './duplicates';
import { multiplyMoney } from '@/lib/domain/calculations';
import type { HistoricalRecord, ImportIssue, ImportPreview, ImportPreviewRow, ImportTransformation } from './types';

type SourceObject = Record<string, unknown>;
export type RecoveryCategory = 'actual_cash' | 'actual_bonus' | 'actual_unclassified' | 'paper_settled' | 'paper_unresolved' | 'day6_cash_proposal' | 'day6_paper_proposal';
export interface RecoveryRowInfo {
  rowNumber: number;
  category: RecoveryCategory;
  sourcePointer: string;
  reference: string | null;
  sourceLine: number | null;
  previewOnly: true;
  requiresExplicitApproval: true;
}
export interface RecoveryComparison {
  key: string; label: string; reported: number | null; computed: number | null;
  unit: 'AUD_cents' | 'count' | 'percent'; status: 'matches' | 'mismatch' | 'insufficient_data';
}
export interface RecoveryReconciliation {
  financialEffect: 'preview_only_no_ledger_or_funding_writes';
  cashStakeCents: number | null; knownCashStakeCents: number; cashStakeUnknownRows: number;
  cashGrossReturnCents: number | null; knownCashGrossReturnCents: number; cashReturnUnknownRows: number;
  bonusFaceStakeCents: number | null; bonusCashReturnCents: number | null;
  cashOnlyPnlCents: number | null; modelledPnlCents: number | null; cashOnlyRoiPercent: number | null;
  identifiedPaperStakeCents: number | null; identifiedPaperReportedHypotheticalProfitCents: number | null;
  identifiedPaperArithmeticGrossCents: number | null; identifiedPaperArithmeticProfitCents: number | null;
  unresolvedPaperHypotheticalStakeCents: number | null;
  proposedCashStakeCents: number | null; proposedPaperHypotheticalStakeCents: number | null;
  reportedAllocationCents: number | null; actualBankrollCents: null; fundingInferred: false;
  actualCounts: { cash: number; bonus: number; unknownStakeType: number; won: number; lost: number; pending: number; unknownOutcome: number };
  comparisons: RecoveryComparison[];
  notes: string[];
}
export interface RecoveryPreview {
  preview: ImportPreview;
  categories: RecoveryRowInfo[];
  summary: { total: number; actualCash: number; actualBonus: number; actualUnclassified: number; paperSettled: number; paperUnresolved: number; day6CashProposals: number; day6PaperProposals: number; unidentifiedNotCreated: number | null };
  reconciliation: RecoveryReconciliation;
  globalIssues: ImportIssue[];
  sourceMetadata: SourceObject;
  missingRecovery: string[];
  unidentifiedAggregate: SourceObject | null;
  existingRecordsCompared: boolean;
}
const object = (value: unknown): value is SourceObject => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value : null;
const known = (value: unknown) => value !== null && value !== undefined;
const issue = (field: string, code: string, message: string, severity: 'warning' | 'error' = 'warning'): ImportIssue => ({ field, code, message, severity });
const count = (value: unknown): number | null => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
const numeric = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;
function cents(value: unknown, signed = false): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const source = String(value);
  if (!(signed ? /^-?(?:0|[1-9]\d*)(?:\.\d{1,2})?$/ : /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/).test(source)) return null;
  const negative = source.startsWith('-');
  const [whole, fraction = ''] = source.replace(/^-/, '').split('.');
  const result = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (result > 100000000n) return null;
  return Number(result) * (negative ? -1 : 1);
}
function amounts(rows: SourceObject[], field: string, signed = false) {
  const values = rows.map(row => cents(row[field], signed));
  const knownTotal = values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  const unknownRows = values.filter(value => value === null).length;
  return { knownTotal, unknownRows, total: unknownRows ? null : knownTotal };
}
function records(value: unknown, pointer: string): SourceObject[] {
  if (!Array.isArray(value)) throw new Error(`Recovery section ${pointer} must be an explicit array. No records were saved.`);
  return value.map((row, index) => {
    if (!object(row)) throw new Error(`Recovery section ${pointer}/${index} must be a record object. No records were saved.`);
    return row;
  });
}
/** Recognizes the supplied staging format, not arbitrary conversations or general research JSON. */
export function isRecoverySource(value: unknown): boolean {
  return object(value) && typeof value.file_purpose === 'string' && (
    Object.hasOwn(value, 'reported_actual_wagers_pending_ticket_verification') ||
    Object.hasOwn(value, 'historical_paper_predictions_identified_settled') ||
    Object.hasOwn(value, 'historical_paper_predictions_unidentified')
  );
}
export function recoveryRowInfo(row: ImportPreviewRow): RecoveryRowInfo | null {
  const metadata = row.transformations.find(change => change.rule === 'recovery_mapping_v1')?.normalized;
  if (!object(metadata) || metadata.previewOnly !== true || metadata.requiresExplicitApproval !== true || metadata.rowNumber !== row.rowNumber) return null;
  const categories: RecoveryCategory[] = ['actual_cash', 'actual_bonus', 'actual_unclassified', 'paper_settled', 'paper_unresolved', 'day6_cash_proposal', 'day6_paper_proposal'];
  if (!categories.includes(metadata.category as RecoveryCategory) || typeof metadata.sourcePointer !== 'string') return null;
  return metadata as unknown as RecoveryRowInfo;
}
/** Guard after manual review corrections: a proposal cannot become an actual/paper registration. */
export function guardRecoveryPreviewMapping(preview: ImportPreview): void {
  for (const row of preview.rows) {
    if (!row.transformations.some(change => change.rule === 'recovery_mapping_v1')) continue;
    const metadata = recoveryRowInfo(row);
    if (!metadata) throw new Error('Recovery review metadata is invalid. Reopen the original recovery source.');
    const source = object(row.raw) ? row.raw : {};
    const snapshot = row.snapshot;
    if (metadata.category.startsWith('day6_')) {
      if (snapshot.kind !== null || snapshot.stakeCents !== null || snapshot.stakeType !== null || snapshot.payoutCents !== null || snapshot.outcome !== null || snapshot.placedAt !== null || snapshot.settledAt !== null) {
        throw new Error('Day 6 proposals must remain unregistered proposals with no actual/paper status, stake, payout or outcome. Proposed amounts stay in the original source.');
      }
    } else if (metadata.category.startsWith('actual_')) {
      if (snapshot.kind !== 'actual' || (metadata.category === 'actual_cash' && snapshot.stakeType !== 'cash') || (metadata.category === 'actual_bonus' && snapshot.stakeType !== 'bonus')) {
        throw new Error('Recovered actual cash and bonus classifications cannot be silently converted during review.');
      }
    } else if (snapshot.kind !== 'paper') {
      throw new Error('Historical paper predictions cannot be converted into actual wagers during recovery review.');
    }
    if (snapshot.verification === 'user_confirmed') throw new Error('Recovery extraction remains unverified. Its internal approval flags do not authorize an import or independent verification claim.');
    if (snapshot.externalId !== (text(source.reference) ?? text(source.id) ?? text(source.external_review_id))) throw new Error('Original recovered reference IDs must be retained; metadata identifiers are not original source facts.');
  }
}
function reconcile(source: SourceObject, actual: SourceObject[], settledPapers: SourceObject[], unresolvedPapers: SourceObject[], cashProposals: SourceObject[], paperProposals: SourceObject[], globalIssues: ImportIssue[]): RecoveryReconciliation {
  const checkpoint = object(source.checkpoint) ? source.checkpoint : {};
  const cash = actual.filter(row => row.stake_type === 'cash');
  const bonus = actual.filter(row => row.stake_type === 'bonus');
  const cashStake = amounts(cash, 'stake_aud'); const cashReturns = amounts(cash, 'reported_cash_return_aud');
  const bonusStake = amounts(bonus, 'stake_aud'); const bonusReturns = amounts(bonus, 'reported_cash_return_aud');
  const cashRealised = cash.filter(row => ['won', 'lost', 'void'].includes(String(row.reported_outcome)));
  const cashRealisedStake = amounts(cashRealised, 'stake_aud'); const cashRealisedReturns = amounts(cashRealised, 'reported_cash_return_aud');
  const outcomeComplete = actual.every(row => ['won', 'lost', 'void'].includes(String(row.reported_outcome)));
  const classificationComplete = cash.length + bonus.length === actual.length;
  const cashOnlyPnlCents = cashRealised.length === cash.length && cashRealisedStake.total !== null && cashRealisedReturns.total !== null ? cashRealisedReturns.total - cashRealisedStake.total : null;
  const modelledPnlCents = outcomeComplete && classificationComplete && cashOnlyPnlCents !== null && bonusReturns.total !== null ? cashOnlyPnlCents + bonusReturns.total : null;
  const decisiveCash = cash.filter(row => row.reported_outcome === 'won' || row.reported_outcome === 'lost');
  const decisiveStake = amounts(decisiveCash, 'stake_aud'); const decisiveReturn = amounts(decisiveCash, 'reported_cash_return_aud');
  const cashOnlyRoiPercent = decisiveStake.total !== null && decisiveStake.total > 0 && decisiveReturn.total !== null ? (decisiveReturn.total - decisiveStake.total) / decisiveStake.total * 100 : null;
  const paperStake = amounts(settledPapers, 'hypothetical_stake_aud');
  const sourcePaperProfit = settledPapers.map(row => row.reported_outcome === 'won' ? cents(row.hypothetical_pnl_aud_if_won, true) : null);
  const sourcePaperProfitTotal = sourcePaperProfit.every(value => value !== null) ? sourcePaperProfit.reduce<number>((sum, value) => sum + value!, 0) : null;
  const arithmeticPaper = settledPapers.map(row => {
    const stake = cents(row.hypothetical_stake_aud); const odds = numeric(row.decimal_odds);
    return row.reported_outcome === 'won' && stake !== null && odds !== null && odds > 1 && odds <= 10000 && Math.abs(odds * 10000 - Math.round(odds * 10000)) < 0.00001 ? { gross: multiplyMoney(stake, odds), profit: multiplyMoney(stake, odds - 1) } : null;
  });
  const arithmeticPaperGross = arithmeticPaper.every(value => value !== null) ? arithmeticPaper.reduce((sum, value) => sum + value!.gross, 0) : null;
  const arithmeticPaperProfit = arithmeticPaper.every(value => value !== null) ? arithmeticPaper.reduce((sum, value) => sum + value!.profit, 0) : null;
  settledPapers.forEach((row, index) => {
    const reported = row.reported_outcome === 'won' ? cents(row.hypothetical_pnl_aud_if_won, true) : null;
    const computed = arithmeticPaper[index]?.profit ?? null;
    if (reported !== null && computed !== null && reported !== computed) globalIssues.push(issue(`/historical_paper_predictions_identified_settled/${index}/hypothetical_pnl_aud_if_won`, 'paper_profit_mismatch', 'Reported hypothetical paper profit disagrees with the source stake/odds arithmetic. It is not silently corrected.', 'error'));
  });
  const comparisons: RecoveryComparison[] = [];
  const compare = (key: string, label: string, reported: number | null, computed: number | null, unit: RecoveryComparison['unit'] = 'count') => {
    const status = reported === null || computed === null ? 'insufficient_data' : (unit === 'percent' ? Math.abs(reported - computed) <= 0.000001 : reported === computed) ? 'matches' : 'mismatch';
    comparisons.push({ key, label, reported, computed, unit, status });
    if (status === 'mismatch') globalIssues.push(issue(`checkpoint.${key}`, 'checkpoint_mismatch', `${label} does not reconcile to the identified source rows. No balancing records or amounts are invented.`, 'error'));
  };
  const actualRecord = object(checkpoint.actual_record) ? checkpoint.actual_record : {};
  compare('total_wagers_including_bonus', 'Actual wagers including bonus', count(checkpoint.total_wagers_including_bonus), actual.length);
  compare('cash_wagers', 'Cash wagers', count(checkpoint.cash_wagers), cash.length);
  compare('bonus_wagers', 'Bonus wagers', count(checkpoint.bonus_wagers), bonus.length);
  compare('actual_wins', 'Actual wins including bonus', count(actualRecord.won), actual.filter(row => row.reported_outcome === 'won').length);
  compare('actual_losses', 'Actual losses', count(actualRecord.lost), actual.filter(row => row.reported_outcome === 'lost').length);
  compare('actual_pending', 'Reported pending actual wagers', count(actualRecord.pending), actual.filter(row => row.reported_outcome === 'pending').length);
  compare('cash_stakes_aud', 'Reported cash stakes', cents(checkpoint.cash_stakes_aud), cashStake.total, 'AUD_cents');
  compare('cash_bet_gross_returns_aud', 'Reported cash-bet gross returns', cents(checkpoint.cash_bet_gross_returns_aud), cashReturns.total, 'AUD_cents');
  compare('bonus_winnings_cash_return_aud', 'Bonus cash winnings excluding principal', cents(checkpoint.bonus_winnings_cash_return_aud), bonusReturns.total, 'AUD_cents');
  compare('cash_pnl_excluding_promotions_aud', 'Cash-only realised P/L', cents(checkpoint.cash_pnl_excluding_promotions_aud, true), cashOnlyPnlCents, 'AUD_cents');
  compare('modelled_cash_pnl_including_bonus_returns_aud', 'Modelled realised P/L including bonus cash returns', cents(checkpoint.modelled_cash_pnl_including_bonus_returns_aud, true), modelledPnlCents, 'AUD_cents');
  compare('cash_bet_only_roi_pct', 'Cash-only ROI', numeric(checkpoint.cash_bet_only_roi_pct), cashOnlyRoiPercent, 'percent');
  if (object(source.reconciliation_calculations)) {
    const supplied = source.reconciliation_calculations;
    compare('cash_stakes_calc_aud', 'Supplied cash-stake calculation', cents(supplied.cash_stakes_calc_aud), cashStake.total, 'AUD_cents');
    compare('cash_returns_calc_aud', 'Supplied cash-return calculation', cents(supplied.cash_returns_calc_aud), cashReturns.total, 'AUD_cents');
    compare('bonus_cash_returns_calc_aud', 'Supplied bonus cash-return calculation', cents(supplied.bonus_cash_returns_calc_aud), bonusReturns.total, 'AUD_cents');
    compare('modelled_net_calc_aud', 'Supplied modelled net calculation', cents(supplied.modelled_net_calc_aud, true), modelledPnlCents, 'AUD_cents');
  }
  const unidentified = object(source.historical_paper_predictions_unidentified) ? source.historical_paper_predictions_unidentified : {};
  const unidentifiedOutcomes = object(unidentified.known_aggregate_outcomes) ? unidentified.known_aggregate_outcomes : {};
  const paperSummary = object(checkpoint.paper_summary) ? checkpoint.paper_summary : {};
  const missingCount = count(unidentified.count), missingWon = count(unidentifiedOutcomes.won), missingLost = count(unidentifiedOutcomes.lost);
  compare('paper_identified_settled_wins', 'Identified settled paper winners', count(paperSummary.individual_settled_wins_identified_in_excerpt), settledPapers.filter(row => row.reported_outcome === 'won').length);
  compare('paper_unidentified_records', 'Unidentified settled papers retained as aggregate only', count(paperSummary.individual_other_settled_records_missing), missingCount);
  compare('paper_unresolved_identified', 'Identified paper predictions unresolved at source time', count(paperSummary.individual_unresolved_records_identified), unresolvedPapers.length);
  compare('paper_unresolved_aggregate', 'Reported unresolved paper count at source time', count(paperSummary.unresolved), unresolvedPapers.length);
  compare('paper_unidentified_outcome_count', 'Unidentified aggregate count versus reported win/loss counts', missingCount, missingWon === null || missingLost === null ? null : missingWon + missingLost);
  compare('paper_settled_wins_aggregate', 'Reported settled paper wins including unidentified aggregate', count(paperSummary.settled_wins), missingWon === null ? null : settledPapers.filter(row => row.reported_outcome === 'won').length + missingWon);
  compare('paper_settled_losses_aggregate', 'Reported settled paper losses including unidentified aggregate', count(paperSummary.settled_losses), missingLost === null ? null : settledPapers.filter(row => row.reported_outcome === 'lost').length + missingLost);
  compare('paper_total_aggregate', 'Reported historical paper count including unidentified aggregate', count(paperSummary.total_historical_predictions), missingCount === null ? null : settledPapers.length + unresolvedPapers.length + missingCount);
  for (const [index, row] of actual.entries()) {
    const stake = cents(row.stake_aud), payout = cents(row.reported_cash_return_aud), reportedEffect = cents(row.reported_cash_pnl_effect_aud, true);
    const outcome = row.reported_outcome;
    if (stake !== null && payout !== null && reportedEffect !== null && ['cash', 'bonus'].includes(String(row.stake_type)) && ['won', 'lost', 'void'].includes(String(outcome))) {
      const computed = row.stake_type === 'cash' ? payout - stake : payout;
      if (computed !== reportedEffect) globalIssues.push(issue(`/reported_actual_wagers_pending_ticket_verification/${index}/reported_cash_pnl_effect_aud`, 'reported_effect_mismatch', 'Reported cash P/L effect does not equal the source cash/bonus stake and reported return. No value is overwritten.', 'error'));
    }
  }
  return {
    financialEffect: 'preview_only_no_ledger_or_funding_writes', cashStakeCents: cashStake.total, knownCashStakeCents: cashStake.knownTotal, cashStakeUnknownRows: cashStake.unknownRows,
    cashGrossReturnCents: cashReturns.total, knownCashGrossReturnCents: cashReturns.knownTotal, cashReturnUnknownRows: cashReturns.unknownRows,
    bonusFaceStakeCents: bonusStake.total, bonusCashReturnCents: bonusReturns.total, cashOnlyPnlCents, modelledPnlCents, cashOnlyRoiPercent,
    identifiedPaperStakeCents: paperStake.total, identifiedPaperReportedHypotheticalProfitCents: sourcePaperProfitTotal,
    identifiedPaperArithmeticGrossCents: arithmeticPaperGross, identifiedPaperArithmeticProfitCents: arithmeticPaperProfit,
    unresolvedPaperHypotheticalStakeCents: amounts(unresolvedPapers, 'hypothetical_stake_aud').total,
    proposedCashStakeCents: amounts(cashProposals, 'stake_proposal_aud').total,
    proposedPaperHypotheticalStakeCents: amounts(paperProposals, 'hypothetical_stake_aud').total,
    reportedAllocationCents: cents(checkpoint.modelled_allocation_aud), actualBankrollCents: null, fundingInferred: false,
    actualCounts: { cash: cash.length, bonus: bonus.length, unknownStakeType: actual.length - cash.length - bonus.length, won: actual.filter(row => row.reported_outcome === 'won').length, lost: actual.filter(row => row.reported_outcome === 'lost').length, pending: actual.filter(row => row.reported_outcome === 'pending').length, unknownOutcome: actual.filter(row => !['won', 'lost', 'void', 'pending'].includes(String(row.reported_outcome))).length }, comparisons,
    notes: [
      'Known source amounts are reconciled independently of ledger registration eligibility. Missing exact dates, events, legs and verification can block every actual ledger entry even when reported arithmetic matches.',
      'Cash/bonus actual return arithmetic uses reported source amounts; original tickets and bookmaker settlement have not been verified.',
      'Bonus principal is not cash exposure or returned cash. A promotional bonus credit is not a deposit and is not added again as winnings.',
      'Paper arithmetic and source-reported hypothetical profits never affect actual bankroll. Hypothetical stake type remains unknown in the mapped records unless explicitly supplied.',
      'Day 6 proposed stakes remain source proposals, not placed bets, current exposure or registered paper predictions.',
      'The allocation is a reported modelled reference. No bookmaker balance or funding transaction is inferred.',
    ],
  };
}

/** Preview-only adapter for the supplied extraction-review staging format. No repository/network calls. */
export async function mapRecoverySource(input: { text: string; sourceName: string; existingRecords?: HistoricalRecord[]; verification?: 'unverified' | 'synthetic' }): Promise<RecoveryPreview> {
  if (new TextEncoder().encode(input.text).byteLength > 1048576) throw new Error('Recovery files are limited to 1 MiB. Split the source into smaller reviewed files without discarding provenance.');
  let decoded: unknown;
  try { decoded = JSON.parse(input.text.replace(/^\uFEFF/, '')); } catch { throw new Error('Malformed recovery JSON. No source records were saved.'); }
  if (!isRecoverySource(decoded) || !object(decoded)) throw new Error('This is not the supported source-extraction review staging format. Map the source manually; no records were saved.');
  const source = object(decoded.source) ? decoded.source : {};
  const verification = input.verification ?? 'unverified';
  if (source.type === 'synthetic_fixture' && verification !== 'synthetic') throw new Error('Synthetic fixture sources must retain synthetic classification; they cannot become private recovery records.');
  if (verification === 'synthetic' && source.type !== 'synthetic_fixture') throw new Error('Synthetic preview classification requires an explicitly synthetic fixture source; real recovery data must remain unverified.');
  // Apply the existing parser's credential/control/Unicode/depth guards to ALL source metadata, not just mapped rows.
  await parseHistoricalSource({ text: JSON.stringify([{ sourceReference: 'recovery-source-safety-check', recoveredSource: decoded }]), sourceName: input.sourceName, format: 'json', verification });
  const hash = await sha256(input.text);
  const globalIssues: ImportIssue[] = [
    issue('import_approved', 'explicit_approval_required', 'This extraction is staging material only. No source approval flag authorizes a database write; every mapped row remains preview-only.'),
    issue('source', 'incomplete_unverified_source', 'The recovery is not a full transcript or a bookmaker-verified ledger. Original source references are retained as claims, not independently authenticated evidence.'),
    issue('source.sha256', 'claimed_source_hash_unverified', 'The excerpt hash is supplied by the recovery file. The original excerpt has not been provided or independently hashed here.'),
    issue('checkpoint', 'no_inferred_funding_or_balance', 'The reported allocation and lifetime cap are not deposits or a verified bookmaker account balance. No financial transaction is mapped.'),
    issue('duplicate_detection', 'duplicate_scope', input.existingRecords ? 'Duplicate comparison includes the supplied existing records and all identified recovery rows; no uncertain records are merged.' : 'Duplicate checks cover identified rows within this source only. Existing authenticated records were not supplied, so cross-database duplicates remain unverified.'),
  ];
  const supportedSections = new Set(['file_purpose','import_approved','source','separation_rules','experiment_rules','checkpoint','reported_actual_wagers_pending_ticket_verification','historical_paper_predictions_identified_settled','historical_paper_predictions_identified_unresolved_at_source_time','historical_paper_predictions_unidentified','upcoming_research_proposals_not_registered','data_gaps','reconciliation_calculations']);
  for (const key of Object.keys(decoded)) if (!supportedSections.has(key)) globalIssues.push(issue(key,'unmapped_recovery_section','This source section is retained in the complete original file but is not automatically converted to import records. Review it manually.'));
  const actual = records(decoded.reported_actual_wagers_pending_ticket_verification, '/reported_actual_wagers_pending_ticket_verification');
  const settledPapers = records(decoded.historical_paper_predictions_identified_settled, '/historical_paper_predictions_identified_settled');
  const unresolvedPapers = records(decoded.historical_paper_predictions_identified_unresolved_at_source_time, '/historical_paper_predictions_identified_unresolved_at_source_time');
  if (!object(decoded.upcoming_research_proposals_not_registered)) throw new Error('Recovery proposals must be a separate source object. No records were saved.');
  const upcoming = decoded.upcoming_research_proposals_not_registered;
  const cashProposals = records(upcoming.cash_proposals, '/upcoming_research_proposals_not_registered/cash_proposals');
  const paperProposals = records(upcoming.paper_proposals, '/upcoming_research_proposals_not_registered/paper_proposals');
  const unidentified = object(decoded.historical_paper_predictions_unidentified) ? decoded.historical_paper_predictions_unidentified : null;
  const unidentifiedCount = unidentified ? count(unidentified.count) : null;
  globalIssues.push(issue('historical_paper_predictions_unidentified', 'unidentified_papers_not_created', `${unidentifiedCount ?? 'An unknown number of'} reported historical paper predictions are unidentified aggregate metadata only. No placeholder prediction rows are generated.`));
  globalIssues.push(issue('historical_paper_predictions_identified_unresolved_at_source_time', 'source_time_pending_only', `Unresolved paper outcomes are reported only as of ${text(source.source_report_as_of) ?? 'an unknown source time'}. They have not been rechecked as current results.`));
  globalIssues.push(issue('upcoming_research_proposals_not_registered', 'proposals_not_registered', `Day 6 source proposals for local research date ${text(upcoming.research_date_local) ?? 'unknown'} are unregistered. A local date is not an event start or exact forecast/placement timestamp.`));
  if (decoded.import_approved === true) globalIssues.push(issue('import_approved', 'source_approval_is_not_consent', 'The file claims prior approval, but source booleans cannot substitute for explicit approval in the application. Preview-only protection remains in force.'));
  const claimedHash = typeof source.sha256 === 'string' && /^[a-f0-9]{64}$/i.test(source.sha256) ? source.sha256.toLowerCase() : null;
  if (!claimedHash) globalIssues.push(issue('source.sha256', 'missing_source_hash', 'The original excerpt SHA-256 is missing or invalid. References use the recovery-file hash instead; the original excerpt remains unverified.'));
  const categories: RecoveryRowInfo[] = []; const mapped: SourceObject[] = []; const originals: SourceObject[] = []; const extraIssues: ImportIssue[][] = []; const extraTransforms: ImportTransformation[][] = [];
  const append = (row: SourceObject, category: RecoveryCategory, pointer: string) => {
    const proposal = category.startsWith('day6_'); const actualRow = category.startsWith('actual_'); const paper = category.startsWith('paper_');
    const location = object(row.source_location) ? row.source_location : {};
    const sourceLine = count(location.line);
    const reference = text(row.reference) ?? text(row.id);
    const sourceReference = `chatgpt-excerpt-sha256:${claimedHash ?? hash}#${pointer}${sourceLine === null ? '' : `:line-${sourceLine}`}`;
    const rowNumber = mapped.length + 1;
    const info: RecoveryRowInfo = { rowNumber, category, sourcePointer: pointer, reference, sourceLine, previewOnly: true, requiresExplicitApproval: true };
    const warnings: ImportIssue[] = [issue('sourceReference', 'unverified_recovered_record', 'This record is recovered chat-review evidence, not an original verified ticket or registered forecast. Source locations are preserved exactly.'), issue('approval', 'recovery_preview_only', 'Recovery preview only: no archive, paper registration, actual ledger entry or hosted write is authorized.')];
    const transforms: ImportTransformation[] = [];
    if (actualRow && Object.hasOwn(row, 'record_type') && row.record_type !== 'actual_wager') warnings.push(issue('record_type', 'contradictory_record_type', 'The actual-wager section contains a different record type. Its source classification must be resolved; no conversion is performed.', 'error'));
    if (paper && Object.hasOwn(row, 'record_type') && row.record_type !== 'historical_paper_prediction') warnings.push(issue('record_type', 'contradictory_record_type', 'The historical-paper section contains a different record type. No actual/paper conversion is inferred.', 'error'));
    if (actualRow && row.reported_status === 'settled' && !['won','lost','void'].includes(String(row.reported_outcome))) warnings.push(issue('outcome', 'contradictory_settlement_status', 'The source calls this actual wager settled but supplies no compatible settled outcome. Preserve and resolve the contradiction.', 'error'));
    if (category === 'paper_settled' && !['won','lost','void'].includes(String(row.reported_outcome))) warnings.push(issue('outcome', 'contradictory_paper_section', 'A source row in the settled-paper section has no compatible settled outcome. No result is invented.', 'error'));
    if (category === 'paper_unresolved' && ['won','lost','void'].includes(String(row.reported_outcome))) warnings.push(issue('outcome', 'contradictory_paper_section', 'A source row is listed as unresolved but reports a decisive outcome. Resolve the original source contradiction manually.', 'error'));
    const experiment = object(decoded.experiment_rules) ? decoded.experiment_rules : {};
    const typicalStake = cents(experiment.typical_stake_aud);
    const actualStake = actualRow ? cents(row.stake_aud) : null;
    if (actualStake !== null && typicalStake !== null && actualStake !== typicalStake) warnings.push(issue('stakeCents', 'reported_stake_differs_from_typical', 'The explicitly reported stake differs from the experiment typical stake. The original stake is preserved; the typical value is not a restriction or substitute.'));
    let strategy: unknown = known(row.strategy) ? row.strategy : null;
    if (typeof strategy === 'string' && /[\/,]/.test(strategy)) { warnings.push(issue('strategy', 'ambiguous_strategy', `Source strategy ${strategy} spans multiple tracks. It remains null until a source-supported single classification is resolved.`)); transforms.push({ field: 'strategy', original: strategy, normalized: null, rule: 'ambiguous_strategy_kept_unknown' }); strategy = null; }
    let legs: SourceObject[] = [];
    if (actualRow && Array.isArray(row.legs)) {
      legs = row.legs.map((sourceLeg, index) => {
        if (!object(sourceLeg)) throw new Error(`Recovery source ${pointer}/legs/${index} must be an object.`);
        const inheritedSport = !Object.hasOwn(sourceLeg, 'sport') && known(row.sport);
        if (inheritedSport) transforms.push({ field: `legs.${index}.sport`, original: null, normalized: row.sport, rule: 'inherit_explicit_record_sport_scope' });
        return { sport: inheritedSport ? row.sport : sourceLeg.sport ?? null, eventId: sourceLeg.eventId ?? null, event: sourceLeg.event ?? null, participant: sourceLeg.participant ?? null, marketId: sourceLeg.marketId ?? null, market: sourceLeg.market ?? null, selection: sourceLeg.selection ?? null, line: sourceLeg.line ?? null, odds: sourceLeg.odds ?? sourceLeg.decimal_odds ?? null, outcome: sourceLeg.outcome ?? null, statistic: sourceLeg.statistic ?? null };
      });
      if (legs.some(leg => leg.odds === null)) warnings.push(issue('legs.odds', 'original_leg_prices_missing', 'Combined wager odds are retained only at wager level. Missing individual leg prices are not copied or inferred.'));
    } else if (paper || proposal) {
      legs = [{ sport: row.sport ?? null, eventId: null, event: row.event ?? null, participant: row.participant ?? null, marketId: row.market_id ?? null, market: row.market ?? null, selection: row.selection_text ?? null, line: row.line ?? null, odds: paper ? row.decimal_odds ?? null : row.odds_snapshot ?? null, outcome: paper ? row.reported_outcome ?? null : null, statistic: paper ? row.reported_score ?? null : null }];
      transforms.push({ field: 'legs', original: row.selection_text ?? null, normalized: legs, rule: 'single_explicit_selection_copied_without_parsing_missing_facts' });
    }
    if (paper) warnings.push(issue('stakeType', 'hypothetical_stake_type_unknown', 'A hypothetical AUD stake was reported, but its cash/bonus classification was not. The mapped stake type remains null; reported paper arithmetic is shown separately from actual finances.'));
    if (category === 'paper_unresolved') warnings.push(issue('outcome', 'pending_at_original_source_time', `Pending is the reported source-time status (${text(source.source_report_as_of) ?? 'time unknown'}), not a verified current result.`));
    if (proposal) warnings.push(issue('kind', 'unregistered_day6_proposal', 'This is a research proposal, not a placed actual wager or registered paper prediction. Its proposed stake remains in raw source only; kind, stake and outcome stay null.'));
    if (Array.isArray(row.issues)) for (const [index, message] of row.issues.entries()) if (typeof message === 'string') warnings.push(issue(`source.issues.${index}`, 'original_source_issue', message));
    const canonical: SourceObject = {
      externalId: reference, kind: actualRow ? 'actual' : paper ? 'paper' : null, sport: row.sport ?? null, eventId: row.event_id ?? null, event: row.event ?? null,
      participant: row.participant ?? null, marketId: row.market_id ?? null, market: row.market ?? null, selection: row.selection_text ?? null, line: row.line ?? null,
      bookmaker: row.bookmaker ?? null, odds: actualRow ? row.combined_decimal_odds ?? null : paper ? row.decimal_odds ?? null : row.odds_snapshot ?? null,
      predictionAt: paper ? row.original_prediction_at ?? null : null, placedAt: actualRow ? row.bet_placed_at ?? null : null, settledAt: actualRow ? row.settled_at ?? null : null,
      probability: paper ? row.independent_probability ?? null : null, probabilitySource: null, probabilityMethod: null, modelVersion: null, strategy,
      sourceReference, stake: proposal ? null : actualRow ? row.stake_aud ?? null : row.hypothetical_stake_aud ?? null,
      stakeType: actualRow ? row.stake_type ?? null : null, payout: actualRow ? row.reported_cash_return_aud ?? null : null,
      outcome: proposal ? null : row.reported_outcome ?? null, verification,
      notes: `Recovered ${category} source; original row, excerpt location and approval/verification claims retained unchanged. This recovery remains preview-only.`, legs,
    };
    // Source dates without an exact offset are preserved in raw evidence, never turned into guessed instants.
    for (const field of ['predictionAt', 'placedAt', 'settledAt']) {
      const value = canonical[field];
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) { canonical[field] = null; warnings.push(issue(field, 'date_without_exact_instant', 'The source supplies a calendar date without an exact time/offset. It is retained in raw source; the normalized timestamp remains null.')); transforms.push({ field, original: value, normalized: null, rule: 'source_date_not_an_exact_timestamp' }); }
    }
    if (actualRow && row.verified_original_ticket !== true) warnings.push(issue('verification', 'original_ticket_unverified', 'Original ticket, event, placement/settlement time and exact leg settlement still need source verification before any financial confirmation.'));
    if (actualRow && (category === 'actual_unclassified')) warnings.push(issue('stakeType', 'actual_stake_type_unknown', 'Source cash/bonus stake type is unknown. No classification is inferred.', 'error'));
    categories.push(info); mapped.push(canonical); originals.push(row); extraIssues.push(warnings); extraTransforms.push(transforms);
  };
  actual.forEach((row, index) => append(row, row.stake_type === 'cash' ? 'actual_cash' : row.stake_type === 'bonus' ? 'actual_bonus' : 'actual_unclassified', `/reported_actual_wagers_pending_ticket_verification/${index}`));
  settledPapers.forEach((row, index) => append(row, 'paper_settled', `/historical_paper_predictions_identified_settled/${index}`));
  unresolvedPapers.forEach((row, index) => append(row, 'paper_unresolved', `/historical_paper_predictions_identified_unresolved_at_source_time/${index}`));
  cashProposals.forEach((row, index) => append(row, 'day6_cash_proposal', `/upcoming_research_proposals_not_registered/cash_proposals/${index}`));
  paperProposals.forEach((row, index) => append(row, 'day6_paper_proposal', `/upcoming_research_proposals_not_registered/paper_proposals/${index}`));
  if (mapped.length > 500) throw new Error('Recovery files may contain at most 500 identified rows. No unidentified placeholders are generated.');
  const preview: ImportPreview = mapped.length ? await parseHistoricalSource({ text: JSON.stringify(mapped), sourceName: input.sourceName, format: 'json', verification, existingRecords: input.existingRecords }) : { sourceName: input.sourceName, format: 'json', rawSource: input.text, sourceHash: hash, rows: [] };
  preview.rawSource = input.text; preview.sourceHash = hash;
  for (const row of preview.rows) {
    const index = row.rowNumber - 1;
    row.raw = structuredClone(originals[index]);
    row.transformations.unshift({ field: 'record', original: structuredClone(row.raw), normalized: structuredClone(row.snapshot), rule: 'source_extraction_review_v1_to_nullable_historical_snapshot' });
    row.transformations.push(...extraTransforms[index], { field: 'recoveryMetadata', original: null, normalized: categories[index], rule: 'recovery_mapping_v1' });
    row.issues.push(...extraIssues[index]);
    if (!row.snapshot.eventId || !row.snapshot.predictionAt) row.issues.push(issue('identity', 'weak_source_identity', 'An event identifier or original prediction time is missing. Exact source references do not establish event uniqueness; probable duplicate checks remain incomplete.'));
  }
  // Weak identities need a conservative repeated-selection warning even when the
  // existing strict matcher lacks an original market/event to compare.
  const normalize = (value: string | null) => value?.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase() ?? null;
  const weakSelectionOverlap = (row: ImportPreviewRow, other: { snapshot: ImportPreviewRow['snapshot'] }) => Boolean(
    row.snapshot.sport !== null && row.snapshot.sport === other.snapshot.sport && row.snapshot.selection &&
    normalize(row.snapshot.selection) === normalize(other.snapshot.selection) &&
    (row.snapshot.line === null || other.snapshot.line === null || normalize(row.snapshot.line) === normalize(other.snapshot.line)) &&
    (!row.snapshot.eventId || !other.snapshot.eventId || !row.snapshot.predictionAt || !other.snapshot.predictionAt)
  );
  for (let index = 0; index < preview.rows.length; index++) {
    const row = preview.rows[index];
    for (let previous = 0; previous < index; previous++) {
      const other = preview.rows[previous];
      if (weakSelectionOverlap(row, other) && !row.duplicates.some(match => match.recordId === `row:${other.rowNumber}`)) row.duplicates.push({ recordId: `row:${other.rowNumber}`, level: 'probable', reason: 'The same explicit selection recurs while original event/date identity is incomplete. Review source identity and category/status; records are not merged and proposals remain unregistered.' });
    }
    for (const other of input.existingRecords ?? []) if (weakSelectionOverlap(row, other) && !row.duplicates.some(match => match.recordId === other.id)) row.duplicates.push({ recordId: other.id, level: 'probable', reason: 'The explicit selection overlaps an existing record, but original event/date identity is incomplete. Review it manually; no merge or category conversion is performed.' });
  }
  guardRecoveryPreviewMapping(preview);
  const reconciliation = reconcile(decoded, actual, settledPapers, unresolvedPapers, cashProposals, paperProposals, globalIssues);
  const missingRecovery = [
    'Provide the original Pasted text(1).txt excerpt/full relevant conversation to verify the supplied source hash, line references and registration context.',
    'Recover original B1–B6 tickets: exact event IDs/dates, placement/settlement timestamps, individual leg prices, outcomes/statistics and source-supported strategy classifications.',
    'Resolve the B5 participant/event mismatch and abbreviated identities from its original same-game multi ticket; do not assign a specific event or full identity from assumptions.',
    'Recover the seven unidentified settled paper predictions (reported aggregate four wins/three losses): identities, exact selections, original prices/stakes, source references and outcomes. No rows have been invented.',
    'Recover original registration timestamps, exact participant/event/market/line/bookmaker evidence and any genuine probability-method provenance for identified paper records.',
    'Recheck all four source-time unresolved paper predictions against reliable final result evidence; no current outcomes are inferred from the historical pending label.',
    'Recover Day 6 quote timestamps, original source URLs/evidence, event identity/start times and a single supported strategy for ambiguous A/B proposals. Published probability ranges in excerpts are not converted into a point estimate.',
    'Verify deposits, bookmaker account balance and the B5 promotional bonus-credit/B6 bonus-use linkage independently. A bonus credit is not cash funding; the modelled allocation is not a verified balance.',
    'Recover closing-price/CLV quotes and independent numerical probabilities only if actually recorded; missing values remain null.',
  ];
  const summary = { total: preview.rows.length, actualCash: categories.filter(row => row.category === 'actual_cash').length, actualBonus: categories.filter(row => row.category === 'actual_bonus').length, actualUnclassified: categories.filter(row => row.category === 'actual_unclassified').length, paperSettled: settledPapers.length, paperUnresolved: unresolvedPapers.length, day6CashProposals: cashProposals.length, day6PaperProposals: paperProposals.length, unidentifiedNotCreated: unidentifiedCount };
  return { preview, categories, summary, reconciliation, globalIssues, sourceMetadata: { ...structuredClone(source), recoveryFileSha256: hash, sourceHashIndependentlyVerified: false, importApproved: false, previewOnly: true, researchDateLocal: upcoming.research_date_local ?? null }, missingRecovery, unidentifiedAggregate: unidentified ? structuredClone(unidentified) : null, existingRecordsCompared: input.existingRecords !== undefined };
}

