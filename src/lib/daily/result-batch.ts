import type { AppData, AuditEntry, Mode } from '@/lib/domain/types';
import { appDataSchema, betSchema, paperSchema } from '@/lib/domain/validation';
import type { HistoricalWorkspace } from '@/lib/imports/types';
import { commitHistoricalImport, parseHistoricalSource, prepareImportCommit, settleHistoricalPaper, validateHistoricalTransition } from '@/lib/imports';
import { makeSettlementEvidence, reviewSettlementResponse, type SettlementResponse, type SettlementReviewRow } from '@/lib/results';

export interface ResultBatchSummary { applied: string[]; alreadyApplied: string[]; }
const classification = (mode: Mode) => mode === 'demo' ? 'synthetic' as const : 'user_confirmed' as const;
async function checkSource(response: SettlementResponse, mode: Mode): Promise<void> {
  // Reuse the bounded parser's recursive credential/Unicode/depth checks before
  // any source observation is retained in notes or an append-only audit.
  await parseHistoricalSource({ text: JSON.stringify([{ event: 'Settlement source guard', sourceDocument: response }]), sourceName: 'settlement-response.json', format: 'json', verification: classification(mode) });
}

function selectedRows(rows: SettlementReviewRow[], keys: string[], scope: 'actual' | 'historical'): SettlementReviewRow[] {
  if (!keys.length || new Set(keys).size !== keys.length) throw new Error('Select each reviewed settlement once.');
  return keys.map(key => {
    const row = rows.find(item => item.key === key);
    if (!row || (scope === 'historical') !== (row.kind === 'historical_paper')) throw new Error('This settlement selection belongs to a different workspace or is no longer available.');
    if (!row.alreadyApplied && !row.eligible) throw new Error(row.issues.join(' ') || 'This outcome is not eligible for settlement.');
    return row;
  });
}

/** Pure, revalidated batch transform. The existing repository performs one atomic workspace save. */
export async function applyAppResultBatch(before: AppData, history: HistoricalWorkspace, response: SettlementResponse, keys: string[], mode: Mode): Promise<{ data: AppData; summary: ResultBatchSummary }> {
  await checkSource(response, mode);
  const review = await reviewSettlementResponse({ response, appData: before, history, mode });
  const rows = selectedRows(review.rows, keys, 'actual');
  const applying = rows.filter(row => !row.alreadyApplied);
  const summary = { applied: applying.map(row => row.key), alreadyApplied: rows.filter(row => row.alreadyApplied).map(row => row.key) };
  if (!applying.length) return { data: before, summary };
  const next = structuredClone(before);
  const timestamp = new Date().toISOString();
  for (const [index, row] of applying.entries()) {
    const old = row.kind === 'actual' ? before.bets.find(item => item.id === row.recordId) : before.paperPredictions.find(item => item.id === row.recordId);
    if (!old) throw new Error('The selected settlement record no longer exists.');
    const record = row.kind === 'actual' ? betSchema.parse(row.actualBet) : paperSchema.parse(row.corePaper);
    if (row.kind === 'actual') next.bets = next.bets.map(item => item.id === row.recordId ? record as AppData['bets'][number] : item);
    else next.paperPredictions = next.paperPredictions.map(item => item.id === row.recordId ? record as AppData['paperPredictions'][number] : item);
    const audit: AuditEntry = { id: crypto.randomUUID(), entityType: row.kind === 'actual' ? 'bet' : 'paper', entityId: row.recordId, action: 'settled_batch_owner_confirmation', timestamp, before: old, after: { record, settlementEvidence: makeSettlementEvidence(review.response, review.responseHash, row.observation), ...(index === 0 ? { sourceResponse: review.response } : {}) } };
    next.audit.push(audit);
  }
  return { data: appDataSchema.parse(next) as AppData, summary };
}

/** New source rows retain result evidence; registered forecasts and earlier audits are never edited. */
export async function applyHistoricalResultBatch(before: HistoricalWorkspace, appData: AppData, response: SettlementResponse, keys: string[], mode: Mode): Promise<{ data: HistoricalWorkspace; summary: ResultBatchSummary }> {
  await checkSource(response, mode);
  const review = await reviewSettlementResponse({ response, appData, history: before, mode });
  const rows = selectedRows(review.rows, keys, 'historical');
  const applying = rows.filter(row => !row.alreadyApplied);
  const summary = { applied: applying.map(row => row.key), alreadyApplied: rows.filter(row => row.alreadyApplied).map(row => row.key) };
  if (!applying.length) return { data: before, summary };
  const verification = classification(mode);
  const mapped = applying.map(row => ({
    externalId: `${review.response.id}:${row.key}`, kind: null, event: 'Settlement response evidence',
    sourceReference: `edgelab:settlement:${review.responseHash}:${row.key}`, verification,
    notes: 'Owner-approved result evidence only. No original forecast, actual wager or funding record is created by this source archive.',
    settlementEvidence: makeSettlementEvidence(review.response, review.responseHash, row.observation),
  }));
  const preview = await parseHistoricalSource({ text: JSON.stringify({ records: mapped, sourceEvidence: { response: review.response } }), sourceName: 'approved-settlement-evidence.json', format: 'json', verification, existingRecords: before.records });
  const decisions = preview.rows.map(row => ({ rowNumber: row.rowNumber, include: true, acknowledgeIncomplete: true, allowProbableDuplicate: false }));
  let next = commitHistoricalImport(before, prepareImportCommit(preview, decisions, verification, before.records));
  for (const row of applying) {
    if (!row.historicalPaper) throw new Error('The selected historical paper result is incomplete.');
    next = settleHistoricalPaper(next, row.recordId, row.historicalPaper);
  }
  // Domain commands each validate an individual transition. This composition is
  // persisted in one revision and one transaction with all accurate audit entries.
  next = { ...next, revision: before.revision + 1 };
  validateHistoricalTransition(before, next);
  return { data: next, summary };
}
