import type { Mode } from '@/lib/domain/types';
import type { HistoricalWorkspace } from '@/lib/imports/types';
import { parseHistoricalSource } from '@/lib/imports/parser';
import { sha256 } from '@/lib/imports/duplicates';
import { commitHistoricalImport, prepareImportCommit } from '@/lib/imports/commands';
import { dailyCycleSchema, type DailyCycle } from './contract';

const JOURNAL_RULE = 'daily_cycle_source_journal_v1';
const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical((value as Record<string, unknown>)[key])])) : value;
const json = (value: unknown) => JSON.stringify(canonical(value));
export const dailyCycleKey = (cycle: DailyCycle) => `${cycle.metadata.cycleId}:${cycle.metadata.researchSessionId}`;
export interface DailyCycleReceipt { recordId: string; cycleKey: string; sourceHash: string; semanticHash: string; savedAt: string; cycle: DailyCycle; }

export function savedDailyCycles(history: HistoricalWorkspace): DailyCycleReceipt[] {
  return history.records.flatMap(record => {
    const journal = record.transformations.find(change => change.rule === JOURNAL_RULE)?.normalized;
    if (!journal || typeof journal !== 'object') return [];
    const fields = journal as Record<string, unknown>, cycle = dailyCycleSchema.safeParse(record.raw);
    if (!cycle.success || fields.cycleKey !== dailyCycleKey(cycle.data) || typeof fields.sourceHash !== 'string' || typeof fields.semanticHash !== 'string') return [];
    return [{ recordId: record.id, cycleKey: fields.cycleKey, sourceHash: fields.sourceHash, semanticHash: fields.semanticHash, savedAt: record.importedAt, cycle: cycle.data }];
  }).sort((a, b) => a.savedAt.localeCompare(b.savedAt));
}

async function semanticHash(cycle: DailyCycle) {
  const { cycleId, researchSessionId, generatedAt, ...metadata } = cycle.metadata;
  void cycleId; void researchSessionId; void generatedAt;
  const recommendations = (rows: DailyCycle['paperRecommendations']) => rows.map(row => {
    const { candidateId, ...facts } = row; void candidateId; return json(facts);
  }).sort();
  return sha256(json({ ...cycle, metadata, betRecommendations: recommendations(cycle.betRecommendations), paperRecommendations: recommendations(cycle.paperRecommendations), resultUpdates: [...cycle.resultUpdates].sort((a,b) => a.positionId.localeCompare(b.positionId)) }));
}

/** One existing history-RPC transaction: source intake only. No core, result or paper-state mutation. */
export async function archiveDailyCycle(history: HistoricalWorkspace, text: string, mode: Mode) {
  if (new TextEncoder().encode(text).byteLength > 1048576) throw new Error('Daily Cycle is limited to 1 MiB.');
  const cycle = dailyCycleSchema.parse(JSON.parse(text));
  if (mode === 'supabase' && cycle.sourceClass === 'synthetic') throw new Error('Synthetic Daily Cycles stay in Demo.');
  if (mode === 'demo' && cycle.sourceClass !== 'synthetic') throw new Error('Demo source intake requires an explicitly synthetic Daily Cycle.');
  const verification = mode === 'demo' ? 'synthetic' as const : 'unverified' as const;
  // Use existing bounded Unicode/credentials/depth guards on the entire original source.
  await parseHistoricalSource({ text: JSON.stringify([{ sourceDocument: cycle }]), sourceName: 'daily-cycle.json', format: 'json', verification });
  const sourceHash = await sha256(text), semantic = await semanticHash(cycle), key = dailyCycleKey(cycle);
  const receipts = savedDailyCycles(history), sameKey = receipts.find(receipt => receipt.cycleKey === key);
  if (sameKey) {
    if (sameKey.semanticHash !== semantic) throw new Error('This cycle ID already has different immutable source content. Use a deliberate new research session; never overwrite it.');
    return { history, receipt: sameKey, alreadySaved: true };
  }
  if (receipts.some(receipt => receipt.semanticHash === semantic)) throw new Error('This source cycle is already archived under another ID. Renaming IDs does not create new research.');
  const journal = { externalId: `cycle:${key}`, kind: null, event: 'Daily research cycle journal', sourceReference: 'edgelab:daily-cycle:journal', notes: 'Immutable research source and feedback only. Results and recommendations do not register or settle any position.', cycle };
  const recommendations = [...cycle.betRecommendations.map(row => ({ row, kind: null, label: 'BET proposal; not placed' })), ...cycle.paperRecommendations.map(row => ({ row, kind: 'paper', label: 'Unregistered PAPER proposal' }))];
  const mapped = recommendations.map(({ row, kind, label }) => {
    const p = row.probabilityProvenance;
    const supported = p && ['deterministic_model', 'external_forecast'].includes(p.origin) && p.source && p.method && p.modelVersion && p.timestamp && row.evidenceCutoff
      && Date.parse(p.timestamp) <= Date.parse(row.evidenceCutoff) && !/\b(?:llm|chatgpt|gpt|claude|gemini)\b/i.test(`${p.source} ${p.method} ${p.modelVersion}`);
    return { externalId: `${semantic}:${row.candidateId}`, kind, sport: row.sport, eventId: row.eventId, event: row.event, participant: row.participant, market: row.market, selection: row.selection, line: row.line,
      bookmaker: row.bookmaker ?? null, odds: row.originalOdds, predictionAt: row.evidenceCutoff,
      probability: supported ? row.probability : null, probabilitySource: supported ? p.source : null, probabilityMethod: supported ? p.method : null, modelVersion: supported ? p.modelVersion : null,
      strategy: row.strategy, sourceReference: `edgelab:daily-cycle:${key}#${row.candidateId}`, stakeCents: null, stakeType: null, payoutCents: null, outcome: null,
      notes: `${label}. Source claims remain unverified. Proposed stake is raw evidence, not a cash debit or registered paper stake.`, originalRecommendation: row };
  });
  const preview = await parseHistoricalSource({ text: JSON.stringify([journal, ...mapped]), sourceName: 'daily-cycle.json', format: 'json', verification, existingRecords: history.records });
  preview.rawSource = text; preview.sourceHash = sourceHash;
  preview.rows[0].raw = structuredClone(cycle);
  // A unique semantic fingerprint plus namespaced cycle external ID protects both
  // renamed replay and same-ID concurrent saves in the existing SQL constraints.
  preview.rows[0].fingerprint = semantic;
  preview.rows[0].transformations.push({ field: 'journal', original: null, normalized: { cycleKey: key, sourceHash, semanticHash: semantic, financialWrites: 0 }, rule: JOURNAL_RULE });
  for (const [index, item] of recommendations.entries()) {
    const row = preview.rows[index + 1];
    row.raw = structuredClone(item.row);
    row.transformations.push({ field: 'probability', original: item.row.probability, normalized: row.snapshot.probability, rule: 'daily_cycle_claim_provenance_review_v1' });
    if (item.row.probability !== null && row.snapshot.probability === null) row.issues.push({ field: 'probability', severity: 'warning', code: 'unsupported_probability_claim', message: 'Original numerical claim is retained in raw source. Independent probability provenance is missing or unsupported; it is not a qualifying forecast.' });
  }
  const commit = prepareImportCommit(preview, preview.rows.map(row => ({ rowNumber: row.rowNumber, include: true, acknowledgeIncomplete: true, allowProbableDuplicate: false })), verification, history.records);
  const next = commitHistoricalImport(history, commit);
  return { history: next, receipt: savedDailyCycles(next).find(receipt => receipt.cycleKey === key)!, alreadySaved: false };
}
