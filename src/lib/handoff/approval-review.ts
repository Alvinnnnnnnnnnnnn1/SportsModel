import type { ImportDecision, ImportPreviewRow, HistoricalPaperResult, HistoricalWorkspace } from '@/lib/imports/types';
import { historicalWorkspaceSchema } from '@/lib/imports/validation';
import type { ResearchPreview } from './response';

export type ResearchApprovalGroup = 'paper' | 'watch' | 'pass';
export function researchApprovalErrorSummary(message: string): string {
  const schemaPrefix = 'Research response schema validation failed: ';
  if (message.startsWith(schemaPrefix)) {
    const fields = message.slice(schemaPrefix.length).split('; ');
    const first = fields[0].length > 180 ? fields[0].slice(0, 177) + '…' : fields[0];
    return `Check research JSON — ${first}${fields.length > 1 ? ` (${fields.length - 1} more field${fields.length > 2 ? 's' : ''}; expand details).` : ''}`;
  }
  return message.length > 240 ? `${message.slice(0, 237)}…` : message;
}
export function researchApprovalGroup(preview: ResearchPreview, rowNumber: number): ResearchApprovalGroup {
  return preview.candidateReviews.find(review => review.rowNumber === rowNumber)?.candidate.decision ?? 'pass';
}
export function researchApprovalBlockers(row: ImportPreviewRow): string[] {
  return [...(row.snapshot.kind === 'actual' ? ['Actual wagers cannot be registered through research approval.'] : []),
    ...row.issues.filter(issue => issue.severity === 'error').map(issue => issue.message),
    ...row.duplicates.filter(duplicate => duplicate.level === 'exact').map(duplicate => `Already saved or exact duplicate: ${duplicate.reason}`)];
}
export function selectResearchGroup(preview: ResearchPreview, decisions: ImportDecision[], group: ResearchApprovalGroup | 'all' | 'none'): ImportDecision[] {
  return decisions.map(decision => {
    const row = preview.importPreview.rows.find(row => row.rowNumber === decision.rowNumber);
    if (!row) return { ...decision, include: false };
    const eligible = researchApprovalBlockers(row).length === 0;
    return { ...decision, include: group === 'none' ? false : eligible && (group === 'all' || researchApprovalGroup(preview, decision.rowNumber) === group || decision.include) };
  });
}
/** The single final owner acknowledgement covers warnings only on explicitly selected rows. */
export function acknowledgeSelectedResearch(preview: ResearchPreview, decisions: ImportDecision[], approved: boolean): ImportDecision[] {
  return decisions.map(decision => ({ ...decision, acknowledgeIncomplete: approved && decision.include && !!preview.importPreview.rows.find(row => row.rowNumber === decision.rowNumber && researchApprovalBlockers(row).length === 0) }));
}
export function researchApprovalSummary(preview: ResearchPreview, decisions: ImportDecision[]) {
  const rows = preview.importPreview.rows;
  const selected = rows.filter(row => decisions.some(decision => decision.rowNumber === row.rowNumber && decision.include));
  return {
    total: rows.length, eligible: rows.filter(row => researchApprovalBlockers(row).length === 0).length,
    blocked: rows.filter(row => researchApprovalBlockers(row).length > 0).length,
    duplicate: rows.filter(row => row.duplicates.length > 0).length,
    selected: selected.length, selectedPaper: selected.filter(row => researchApprovalGroup(preview, row.rowNumber) === 'paper').length,
    selectedArchive: selected.filter(row => researchApprovalGroup(preview, row.rowNumber) !== 'paper').length,
    selectedWarnings: selected.reduce((sum, row) => sum + row.issues.filter(issue => issue.severity === 'warning').length, 0),
  };
}
export function canApproveResearchSelection(preview: ResearchPreview, decisions: ImportDecision[]): boolean {
  const selected = decisions.filter(decision => decision.include);
  return selected.length > 0 && selected.every(decision => {
    const row = preview.importPreview.rows.find(row => row.rowNumber === decision.rowNumber);
    return !!row && researchApprovalBlockers(row).length === 0 &&
      (!row.issues.some(issue => issue.severity === 'warning') || decision.acknowledgeIncomplete) &&
      (!row.duplicates.some(duplicate => duplicate.level === 'probable') || decision.allowProbableDuplicate);
  });
}

/** Reuse the authoritative workspace validation for the editable result checklist; no persistence occurs. */
export function paperResultRequirements(workspace: HistoricalWorkspace, result: HistoricalPaperResult): string[] {
  const checked = historicalWorkspaceSchema.safeParse({ ...workspace, paperResults: [...workspace.paperResults.filter(value => value.recordId !== result.recordId), result] });
  return checked.success ? [] : [...new Set(checked.error.issues.map(issue => issue.path.length ? `${issue.path.join('.')}: ${issue.message}` : issue.message))];
}
