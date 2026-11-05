import { describe, expect, it } from 'vitest';
import { parseHistoricalSource } from '@/lib/imports/parser';
import { prepareImportCommit, commitHistoricalImport } from '@/lib/imports/commands';
import { emptyHistoricalWorkspace, type ImportDecision } from '@/lib/imports/types';
import { acknowledgeSelectedArchiveRows, archiveRowEligibility, archiveSelectionBlockers, selectArchiveRows, summarizeArchiveReview } from '@/lib/imports/approval-review';

const source = (selection: string, odds: number | null = null) => ({ externalId: selection, kind: 'actual', sport: 'NBA', event: 'SYNTHETIC fixture', participant: 'SYNTHETIC player', market: 'Points', selection, line: '12.5', bookmaker: 'SYNTHETIC bookmaker', odds, stakeCents: 500, stakeType: 'cash', outcome: 'pending', sourceReference: `edgelab:synthetic-approval-${selection}` });
const preview = (rows = [source('SYNTHETIC A'), source('SYNTHETIC B')]) => parseHistoricalSource({ text: JSON.stringify(rows), sourceName: 'SYNTHETIC approval.json', format: 'json', verification: 'synthetic' });
const decisions = (count: number): ImportDecision[] => Array.from({ length: count }, (_, index) => ({ rowNumber: index + 1, include: false, acknowledgeIncomplete: false, allowProbableDuplicate: false }));

describe('archive approval review and bulk selection preserve persistence boundaries', () => {
  it('distinguishes valid incomplete archives from financial eligibility and does not approve them on selection', async () => {
    const p = await preview(); const selected = selectArchiveRows(p, decisions(2), true);
    expect(summarizeArchiveReview(p, selected)).toMatchObject({ total: 2, eligible: 2, requiresReview: 2, selected: 2, acknowledgementNeeded: 2, blocked: 0 });
    expect(selected.every(row => !row.acknowledgeIncomplete && !row.allowProbableDuplicate)).toBe(true);
    expect(archiveSelectionBlockers(p, selected)).toEqual(['Acknowledge the missing or unverified information for your selected records.']);
    expect(() => prepareImportCommit(p, selected, 'synthetic')).toThrow('acknowledgement');
  });

  it('selects eligible rows only and reports already-saved versus internal duplicate rows', async () => {
    const p = await preview([source('SYNTHETIC A'), source('SYNTHETIC B'), source('SYNTHETIC C'), source('SYNTHETIC D')]);
    p.rows[1].duplicates = [{ level: 'exact', recordId: 'saved-record', reason: 'SYNTHETIC already archived' }];
    p.rows[2].duplicates = [{ level: 'exact', recordId: 'row:1', reason: 'SYNTHETIC repeated inside file' }];
    p.rows[3].issues.push({ field: 'odds', code: 'invalid_price', severity: 'error', message: 'Original odds are invalid.' });
    const selected = selectArchiveRows(p, decisions(4), true);
    expect(selected.map(row => row.include)).toEqual([true, false, false, false]);
    expect(summarizeArchiveReview(p, selected)).toMatchObject({ total: 4, eligible: 1, duplicates: 2, blocked: 3, alreadySaved: 1 });
    expect(archiveRowEligibility(p.rows[1]).reasons[0]).toContain('already archived');
    expect(archiveRowEligibility(p.rows[2]).reasons[0]).toContain('included in this file');
  });

  it('acknowledges only selected warnings without allowing probable duplicate registration', async () => {
    const p = await preview(); p.rows[0].duplicates = [{ level: 'probable', recordId: 'existing', reason: 'SYNTHETIC overlapping source' }];
    const selected = selectArchiveRows(p, decisions(2), true); selected[1].include = false;
    const acknowledged = acknowledgeSelectedArchiveRows(p, selected, true);
    expect(acknowledged[0]).toMatchObject({ include: true, acknowledgeIncomplete: true, allowProbableDuplicate: false });
    expect(acknowledged[1].acknowledgeIncomplete).toBe(false);
    expect(archiveSelectionBlockers(p, acknowledged)).toEqual(['Review each probable duplicate and explicitly choose whether it represents separate evidence.']);
  });

  it('deselects all without persistence and permits returning to the same review decisions', async () => {
    const p = await preview(); const selected = acknowledgeSelectedArchiveRows(p, selectArchiveRows(p, decisions(2), true), true);
    const cleared = selectArchiveRows(p, selected, false);
    expect(cleared.every(row => !row.include)).toBe(true);
    expect(selected.every(row => row.include)).toBe(true);
    expect(archiveSelectionBlockers(p, cleared)).toEqual(['Select at least one new archive record.']);
    expect(() => prepareImportCommit(p, cleared, 'synthetic')).toThrow('Select at least');
  });

  it('keeps recovery/checkpoint preview-only locks outside bulk approval', async () => {
    const p = await preview(); p.rows[0].transformations.push({ field: 'source', original: null, normalized: null, rule: 'owner_checkpoint_preview_only_v1' });
    expect(selectArchiveRows(p, decisions(2), true).map(row => row.include)).toEqual([false, true]);
    expect(selectArchiveRows(p, decisions(2), true, true).every(row => !row.include)).toBe(true);
    expect(archiveRowEligibility(p.rows[0]).reasons[0]).toContain('preview-only');
  });

  it('still saves archive evidence only after explicit decisions and rejects repeating the import', async () => {
    const p = await preview(); const reviewed = acknowledgeSelectedArchiveRows(p, selectArchiveRows(p, decisions(2), true), true);
    const before = emptyHistoricalWorkspace(); const saved = commitHistoricalImport(before, prepareImportCommit(p, reviewed, 'synthetic'));
    expect(before.records).toHaveLength(0); expect(saved.records).toHaveLength(2);
    expect(saved.paperResults).toEqual([]); expect(saved.notifications).toEqual([]);
    expect(saved.audit[0].after).toMatchObject({ financialEffect: 'archive_only_no_funding_or_ledger_writes' });
    expect(() => prepareImportCommit(p, reviewed, 'synthetic', saved.records)).toThrow('exact duplicate');
  });
});
