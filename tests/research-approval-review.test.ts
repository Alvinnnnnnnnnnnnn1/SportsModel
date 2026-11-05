import { describe, expect, it } from 'vitest';
import { SYNTHETIC_RESEARCH_RESPONSE } from '@/lib/handoff/fixtures';
import { commitApprovedResearch, parseResearchResponse, type ResearchPreview } from '@/lib/handoff/response';
import { acknowledgeSelectedResearch, canApproveResearchSelection, paperResultRequirements, researchApprovalBlockers, researchApprovalErrorSummary, researchApprovalGroup, researchApprovalSummary, selectResearchGroup } from '@/lib/handoff/approval-review';
import { emptyHistoricalWorkspace } from '@/lib/imports';
import type { HistoricalPaperResult, ImportDecision } from '@/lib/imports/types';
const now = new Date('2026-11-04T00:10:00Z');
async function preview() {
  const source = structuredClone(SYNTHETIC_RESEARCH_RESPONSE);
  source.candidates.push({ ...structuredClone(source.candidates[0]), id: 'SYNTHETIC-watch', eventId: 'SYNTHETIC-watch-fixture', event: 'SYNTHETIC other fixture', decision: 'watch' });
  return parseResearchResponse({ text: JSON.stringify(source), sourceName: 'SYNTHETIC-approval.json', verification: 'synthetic', now });
}
const emptyDecisions = (preview: ResearchPreview): ImportDecision[] => preview.importPreview.rows.map(row => ({ rowNumber: row.rowNumber, include: false, acknowledgeIncomplete: false, allowProbableDuplicate: false }));

describe('research approval review preserves paper and financial boundaries', () => {
  it('shows the first invalid schema field with the remaining count while preserving ordinary error messages', () => {
    expect(researchApprovalErrorSummary('Research response schema validation failed: candidates.0.originalOdds: Invalid number; researchDate: Invalid date')).toContain('candidates.0.originalOdds: Invalid number (1 more field; expand details)');
    expect(researchApprovalErrorSummary('Malformed research JSON. Nothing was saved.')).toBe('Malformed research JSON. Nothing was saved.');
  });
  it('groups submitted paper, watch and source-backed passes without altering their source decisions', async () => {
    const p = await preview(), before = structuredClone(p);
    expect(p.importPreview.rows.map(row => researchApprovalGroup(p, row.rowNumber))).toEqual(['paper', 'watch', 'pass']);
    const selected = selectResearchGroup(p, emptyDecisions(p), 'paper');
    expect(researchApprovalSummary(p, selected)).toMatchObject({ total: 3, selectedPaper: 1, selectedArchive: 0 });
    expect(p).toEqual(before);
  });
  it('uses one explicit final acknowledgement for selected notices without approving skipped rows or probable duplicates', async () => {
    const p = await preview();
    const choices = selectResearchGroup(p, emptyDecisions(p), 'paper');
    expect(canApproveResearchSelection(p, choices)).toBe(false);
    const approved = acknowledgeSelectedResearch(p, choices, true);
    expect(canApproveResearchSelection(p, approved)).toBe(true);
    expect(approved[0].acknowledgeIncomplete).toBe(true);
    expect(approved.slice(1).every(decision => !decision.include && !decision.acknowledgeIncomplete && !decision.allowProbableDuplicate)).toBe(true);
  });
  it('saves selected paper records only while retaining the exact submitted response and never producing actual records', async () => {
    const p = await preview();
    const choices = acknowledgeSelectedResearch(p, selectResearchGroup(p, emptyDecisions(p), 'paper'), true);
    const history = commitApprovedResearch(emptyHistoricalWorkspace(), p, choices, 'synthetic', { now });
    expect(history.records).toHaveLength(1); expect(history.paperResults).toHaveLength(1); expect(history.notifications).toHaveLength(1);
    expect(history.records[0].snapshot.kind).toBe('paper'); expect(history.records.some(record => record.snapshot.kind === 'actual')).toBe(false);
    expect(history.batches[0].rawSource).toBe(p.importPreview.rawSource);
  });
  it('archives watch and passes only after selecting them, without registering paper positions', async () => {
    const p = await preview();
    const choices = acknowledgeSelectedResearch(p, selectResearchGroup(p, selectResearchGroup(p, emptyDecisions(p), 'watch'), 'pass'), true);
    const history = commitApprovedResearch(emptyHistoricalWorkspace(), p, choices, 'synthetic', { now });
    expect(history.records).toHaveLength(2); expect(history.records.every(record => record.snapshot.kind === null)).toBe(true);
    expect(history.paperResults).toEqual([]); expect(history.notifications).toEqual([]);
  });
  it('cancels selection without mutating the preview or allowing an empty approval', async () => {
    const p = await preview(), before = structuredClone(p), history = emptyHistoricalWorkspace();
    const approved = acknowledgeSelectedResearch(p, selectResearchGroup(p, emptyDecisions(p), 'all'), true);
    const cancelled = selectResearchGroup(p, approved, 'none');
    expect(canApproveResearchSelection(p, cancelled)).toBe(false);
    expect(() => commitApprovedResearch(history, p, cancelled, 'synthetic', { now })).toThrow('Select at least one');
    expect(p).toEqual(before); expect(history).toEqual(emptyHistoricalWorkspace());
  });
  it('never bulk-selects errors, exact repeats or actual-wager rows', async () => {
    const p = await preview();
    p.importPreview.rows[0].issues.push({ field: 'probability', severity: 'error', code: 'llm_probability_forbidden', message: 'Unsupported LLM probability cannot be approved.' });
    p.importPreview.rows[1].duplicates.push({ recordId: 'SYNTHETIC-existing', level: 'exact', reason: 'Same registered source.' });
    p.importPreview.rows[2].snapshot.kind = 'actual';
    expect(selectResearchGroup(p, emptyDecisions(p), 'all').every(decision => !decision.include)).toBe(true);
    expect(researchApprovalBlockers(p.importPreview.rows[0])[0]).toContain('LLM');
    expect(researchApprovalBlockers(p.importPreview.rows[1])[0]).toContain('Already saved');
    expect(researchApprovalBlockers(p.importPreview.rows[2])[0]).toContain('Actual wagers');
  });
  it('requires a separate individual decision for probable duplicates even after final warning acknowledgement', async () => {
    const p = await preview();
    p.importPreview.rows[0].duplicates.push({ recordId: 'SYNTHETIC-proposal', level: 'probable', reason: 'May overlap an unregistered proposal.' });
    const choices = acknowledgeSelectedResearch(p, selectResearchGroup(p, emptyDecisions(p), 'paper'), true);
    expect(choices[0].allowProbableDuplicate).toBe(false); expect(canApproveResearchSelection(p, choices)).toBe(false);
    expect(canApproveResearchSelection(p, choices.map(decision => decision.rowNumber === 1 ? { ...decision, allowProbableDuplicate: true } : decision))).toBe(true);
  });
  it('uses existing result validation to explain incompatible overall and leg outcomes before saving', async () => {
    const p = await preview();
    const history = commitApprovedResearch(emptyHistoricalWorkspace(), p, acknowledgeSelectedResearch(p, selectResearchGroup(p, emptyDecisions(p), 'paper'), true), 'synthetic', { now });
    const before = structuredClone(history), record = history.records[0];
    const result: HistoricalPaperResult = { recordId: record.id, outcome: 'lost', settledAt: '2026-11-05T03:00:00Z', statistic: 'SYNTHETIC observed result', legs: record.snapshot.legs.map(leg => ({ legId: leg.id, outcome: 'won', statistic: null })), updatedAt: '2026-11-05T03:00:00Z' };
    expect(paperResultRequirements(history, result)).toContain('A lost paper prediction requires a lost leg');
    expect(paperResultRequirements(history, { ...result, legs: result.legs.map(leg => ({ ...leg, outcome: 'lost' })) })).toEqual([]);
    expect(history).toEqual(before);
  });
});
