import { z } from 'zod';
import type { AppData, Sport } from '@/lib/domain/types';
import type { HistoricalWorkspace, ImportPreview, ImportDecision } from '@/lib/imports/types';
import { sha256 } from '@/lib/imports/duplicates';
import { parseHistoricalSource, IMPORT_MAX_BYTES } from '@/lib/imports/parser';
import { historicalWagerClaimSchema, WAGER_CLAIMS_FORMAT } from '@/lib/imports/wager-claim-provenance';

export const RECONCILIATION_SOURCE_FORMAT = 'edgelab.reconciliation-source';
export const reconciliationSourceSchema = z.object({
  format: z.literal(RECONCILIATION_SOURCE_FORMAT), version: z.literal(1),
  sourceName: z.string().min(1).max(200), sourceText: z.string().min(1).max(500_000),
  sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();
export type ReconciliationSource = z.infer<typeof reconciliationSourceSchema>;
export interface SourceItem {
  id: string; section: string; category: 'actual' | 'historical_paper' | 'proposal';
  sport: Sport; event: string | null; selection: string; quote: number | null;
  originalReference: string | null; rawCells: string[]; rawRow: string;
  outcome: 'won' | 'lost' | null; startsAt: string | null;
}
export interface SourceMatch { id: string; storage: 'ledger' | 'paper' | 'archive'; }
const sportSchema = z.enum(['NBA', 'NBL', 'ATP', 'WTA']);
const amount = (value: string) => {
  if (value === 'Unknown') return null;
  if (!/^\d+(?:\.\d{1,4})?$/.test(value)) throw new Error('An original quote is malformed; manual mapping is required.');
  return z.number().gt(1).max(10_000).parse(Number(value));
};

/** Deliberately narrow adapter for the owner-selected reconciliation table format. */
export function parseReconciliationMarkdown(source: string): SourceItem[] {
  const groups: Record<string, string[][]> = { A: [], B: [], C: [], D: [], E: [] };
  let section = '';
  for (const line of source.split(/\r?\n/)) {
    const heading = /^## ([A-G])\./.exec(line);
    if (heading) section = heading[1];
    if (!groups[section] || !line.startsWith('| ')) continue;
    const cells = line.split('|').slice(1, -1).map(cell => cell.trim());
    if (cells.every(cell => /^[- :]+$/.test(cell))) continue;
    groups[section].push(cells);
  }
  const expected = { A: [12, 7], B: [15, 6], C: [4, 5], D: [3, 5], E: [12, 6] };
  const headers: Record<string, string> = {
    A: 'ID / day|Sport and fixture|Exact selection(s)/legs|Funding / nominal stake|Odds quoted|Last-known result / settlement|Existing EdgeLab source ref',
    B: 'Historical ref|Sport|Exact selection / legs|Original paper odds|Last-known paper outcome|Source/ref',
    C: 'Research ID|Sport|Paper selection|Original research odds|Registration status',
    D: 'Existing Day 7 candidate ID|Sport|Paper selection and fixture|Original odds|Paper status',
    E: 'Existing Day 8 candidate ID|Sport|Paper selection and fixture|Original odds|Event start as supplied (AEDT)|Status',
  };
  const result: SourceItem[] = [];
  for (const [section, [count, columns]] of Object.entries(expected)) {
    const rows = groups[section].slice(1);
    if (groups[section][0]?.join('|') !== headers[section] || rows.length !== count || rows.some(row => row.length !== columns))
      throw new Error(`Section ${section} must have ${count} records and ${columns} columns. Source format changed; review mapping before import.`);
    for (const cells of rows) {
      const actual = section === 'A', historical = section === 'B';
      const id = actual ? cells[0].split(' ')[0] : cells[0];
      if (!(actual ? /^A(?:0[1-9]|1[0-2])$/ : historical ? /^H(?:0[1-9]|1[0-5])$/ : section === 'C' ? /^P(?:17|18|19|20)$/ : section === 'D' ? /^d7-/ : /^d8-/).test(id))
        throw new Error(`Unexpected source ID in section ${section}. Review the source rather than assigning new identities.`);
      const fixture = actual ? cells[1].split(' — ') : [];
      const sport = sportSchema.parse(actual ? fixture[0].split(' / ')[0] : cells[1]);
      const selection = cells[2];
      const outcomeText = actual ? cells[5] : historical ? cells[4] : '';
      const correctedQuote = actual ? new RegExp(`- \\*\\*${id}\\*\\* — Original research quote (\\d+(?:\\.\\d{1,4})?);`).exec(source)?.[1] : null;
      const quote = amount(correctedQuote ?? cells[actual ? 4 : 3]);
      const startsAt = section === 'E' ? z.string().datetime({ offset: true }).parse(cells[4]) : null;
      const originalReference = actual ? cells[6] : historical && cells[5] !== 'source archive' ? cells[5] : section === 'D' || section === 'E' ? id : null;
      result.push({ id, section, category: actual ? 'actual' : historical ? 'historical_paper' : 'proposal', sport,
        event: actual ? fixture[0].includes('/ multi') ? null : fixture.slice(1).join(' — ') || null : selection.includes(' — ') ? selection.split(' — ').slice(1).join(' — ') : null,
        selection, quote, originalReference, rawCells: cells, rawRow: `| ${cells.join(' | ')} |`,
        // A sporting win is deliberately not a bookmaker settlement.
        outcome: /^Won(?:\b|$)/.test(outcomeText) ? 'won' : /^Lost(?:\b|$)/.test(outcomeText) ? 'lost' : null,
        startsAt: startsAt ? new Date(startsAt).toISOString() : null });
    }
  }
  if (new Set(result.map(item => item.id)).size !== 46) throw new Error('Source IDs must be distinct.');
  return result;
}

function rawObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
/** Exact keys only: never substring-match free text or merge similar player props. */
export function sourceItemMatches(item: Pick<SourceItem, 'id' | 'category' | 'originalReference'>, data: AppData, history: HistoricalWorkspace): SourceMatch[] {
  const keys = new Set([item.id, item.originalReference].filter((key): key is string => !!key));
  const matches: SourceMatch[] = [];
  if (item.category === 'actual') {
    for (const bet of data.bets) if (keys.has(bet.id) || !!bet.candidateId && keys.has(bet.candidateId)) matches.push({ id: bet.id, storage: 'ledger' });
  } else {
    for (const paper of data.paperPredictions) if (keys.has(paper.id) || keys.has(paper.candidate.id)) matches.push({ id: paper.id, storage: 'paper' });
  }
  for (const record of history.records) {
    if ((record.snapshot.kind === 'actual') !== (item.category === 'actual')) continue;
    const raw = rawObject(record.raw), metadata = rawObject(raw.reconciliation);
    const externalId = record.snapshot.externalId;
    const sourceRef = record.snapshot.sourceReference;
    // Research-response namespaces explicitly terminate in the immutable candidate ID.
    const candidate = sourceRef?.startsWith('edgelab:research-response:') ? sourceRef.split(':').at(-1) : null;
    if (keys.has(record.id) || externalId && keys.has(externalId) || candidate && keys.has(candidate)
      || metadata.sourceId === item.id && metadata.format === RECONCILIATION_SOURCE_FORMAT)
      matches.push({ id: record.id, storage: history.paperResults.some(p => p.recordId === record.id) ? 'paper' : 'archive' });
  }
  return matches;
}

function selectionLegs(item: SourceItem) {
  return item.selection.split(';').map(selection => ({
    sport: item.sport, eventId: null, event: item.event, participant: null, marketId: null,
    market: null, selection: selection.trim(), line: null, odds: null, outcome: null, statistic: null,
  }));
}

export function isReconciliationSource(value: unknown): boolean {
  return rawObject(value).format === RECONCILIATION_SOURCE_FORMAT;
}

export function reconciliationRecordInfo(raw: unknown) {
  const info = rawObject(rawObject(raw).reconciliation);
  const parsed = z.object({ format: z.literal(RECONCILIATION_SOURCE_FORMAT),
    sourceId: z.string().min(1), category: z.enum(['actual', 'historical_paper', 'proposal']),
    originalReference: z.string().nullable(), startsAt: z.string().datetime({ offset: true }).nullable(),
  }).safeParse(info);
  return parsed.success ? parsed.data : null;
}

/** Recheck current destinations at the final boundary, never only a stale preview. */
export function assertReconciliationSelection(preview: ImportPreview, decisions: ImportDecision[], data: AppData, history: HistoricalWorkspace) {
  for (const row of preview.rows) {
    if (!decisions.some(decision => decision.rowNumber === row.rowNumber && decision.include)) continue;
    const info = reconciliationRecordInfo(row.raw);
    if (info && sourceItemMatches({ id: info.sourceId, category: info.category, originalReference: info.originalReference }, data, history).length)
      throw new Error(`Source ${info.sourceId} is already present. Refresh and link the existing record; no second position was saved.`);
  }
}

/** No writes, forecasting registration, settlement or funding occurs in this adapter. */
export async function prepareReconciliationImport(input: { text: string; sourceName: string; data: AppData; history: HistoricalWorkspace; mode: 'demo' | 'supabase' }) {
  if (input.mode !== 'supabase') throw new Error('Owner reconciliation belongs only in your authenticated private workspace.');
  if (new TextEncoder().encode(input.text).byteLength > IMPORT_MAX_BYTES) throw new Error('Reconciliation source exceeds 1 MiB.');
  const source = reconciliationSourceSchema.parse(JSON.parse(input.text));
  if (await sha256(source.sourceText) !== source.sourceHash) throw new Error('Source hash mismatch. Keep the original source unchanged.');
  // Run existing recursive credential, control-character and Unicode guards.
  await parseHistoricalSource({ text: JSON.stringify([{ sourceEvidence: source }]), sourceName: input.sourceName, format: 'json', verification: 'unverified' });
  const items = parseReconciliationMarkdown(source.sourceText);
  const links = items.map(item => ({ sourceId: item.id, matches: sourceItemMatches(item, input.data, input.history) }));
  const records = items.map(item => {
    const actual = item.category === 'actual';
    const sourceReference = `edgelab:reconciliation:${source.sourceHash}#${item.id}`;
    const reconciliation = { format: RECONCILIATION_SOURCE_FORMAT, version: 1, sourceHash: source.sourceHash,
      sourceId: item.id, category: item.category, originalReference: item.originalReference, rawRow: item.rawRow,
      rawCells: item.rawCells, startsAt: item.startsAt, registrationProof: null,
      financialEffect: 'archive_only_no_ledger_or_funding_writes' };
    let sourceDocument: unknown;
    // Only exact financial amounts explicitly present in this source's accounting text are mapped.
    const originalSix = actual && /^A0[1-6]$/.test(item.id);
    const reportedStake = originalSix ? /^A\$(\d+)\.00 (Cash|Bonus)$/.exec(item.rawCells[3]) : null;
    const stakeCents = reportedStake ? Number(reportedStake[1]) * 100 : null;
    const payoutCents = item.id === 'A01' && /A01 A\$25/.test(source.sourceText) ? 2500
      : item.id === 'A06' && /payout A\$4\.30/.test(source.sourceText) ? 430
      : originalSix && item.outcome === 'lost' ? 0 : null;
    const stakeType = actual ? /Bonus/.test(item.rawCells[3]) ? 'bonus' as const : 'cash' as const : null;
    const legs = selectionLegs(item);
    if (actual) {
      const claim = historicalWagerClaimSchema.parse({ reference: item.id, sport: item.sport,
        eventId: null, event: item.event, participant: null, marketId: null, market: null,
        selection: item.selection, line: null, bookmaker: 'Sportsbet', reportedStakeCents: stakeCents, stakeType,
        reportedOdds: item.quote, reportedOddsKind: originalSix ? 'owner_reported' : 'pre_placement_quote',
        acceptedOdds: null, acceptedOddsSource: null, placedAt: null, settledAt: null, ticketId: null,
        reportedOutcome: item.outcome, reportedCashPayoutCents: payoutCents, strategy: null,
        sourceReferences: [sourceReference, ...(item.originalReference ? [item.originalReference] : [])],
        evidenceNotes: ['Owner-conversation evidence; no independently verified execution or settlement.',
          'Planned nominal stakes are retained in raw source only. Sporting wins do not establish cash returns.', item.rawRow], legs });
      sourceDocument = { format: WAGER_CLAIMS_FORMAT, version: 1, sourceClass: 'owner_reported',
        sourceId: source.sourceHash, sourceReference: source.sourceName, sourceHash: source.sourceHash, claim };
    }
    return { externalId: item.id, kind: actual ? 'actual' : 'paper', sport: item.sport,
      eventId: null, event: item.event, participant: null, marketId: null, market: null, selection: item.selection,
      line: null, bookmaker: 'Sportsbet', odds: actual ? null : item.quote,
      predictionAt: null, placedAt: null, settledAt: null, probability: null, probabilitySource: null,
      probabilityMethod: null, modelVersion: null, strategy: null, sourceReference,
      stakeCents, stakeType, payoutCents, outcome: item.outcome, verification: 'unverified', legs,
      notes: 'Owner-reported historical review archive. No execution odds or pre-event registration established. Unknown facts remain null; proposals are not qualifying forecasts.',
      reconciliation, ...(sourceDocument ? { sourceDocument } : {}) };
  });
  const mappedText = JSON.stringify({ records, sourceEvidence: { ...source, links, financialEffect: 'archive_only_no_ledger_or_funding_writes' } }, null, 2);
  const preview: ImportPreview = await parseHistoricalSource({ text: mappedText, sourceName: input.sourceName, format: 'json', verification: 'unverified', existingRecords: input.history.records });
  preview.rows.forEach((row, index) => {
    row.issues = row.issues.filter(issue => !['sourceDocument', 'reconciliation'].includes(issue.field));
    for (const match of links[index].matches) if (!row.duplicates.some(duplicate => duplicate.recordId === match.id))
      row.duplicates.push({ recordId: match.id, level: 'exact', reason: `Original ID is already in ${match.storage}. Preserve and link it; do not import a second position.` });
    row.issues.push({ field: 'provenance', severity: 'warning', code: 'historical_reconciliation_review', message: 'Historical source evidence only. No financial registration, retrospective forecast, settlement or funding is approved by this archive action.' });
    row.transformations.push({ field: 'reconciliation', original: items[index].rawRow,
      normalized: { sourceHash: source.sourceHash, sourceId: items[index].id, category: items[index].category }, rule: 'canonical_reconciliation_mapping_v1' });
  });
  return { source, items, links, preview, mappedText };
}
