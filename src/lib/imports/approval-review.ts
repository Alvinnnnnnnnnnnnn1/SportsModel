import type { ImportDecision, ImportPreview, ImportPreviewRow } from './types';

/** Display and selection helpers only. Persistence still revalidates every decision. */
export function archiveRowEligibility(row: ImportPreviewRow, previewOnly = false) {
  const errors = row.issues.filter(issue => issue.severity === 'error');
  const exact = row.duplicates.filter(duplicate => duplicate.level === 'exact');
  const alreadySaved = exact.some(duplicate => !duplicate.recordId.startsWith('row:'));
  const sourceLocked = previewOnly || row.transformations.some(change => ['recovery_mapping_v1', 'owner_checkpoint_preview_only_v1'].includes(change.rule));
  const reasons = [
    ...(sourceLocked ? ['This source is preview-only; a separate approved mapping is required before saving.'] : []),
    ...errors.map(issue => `${issue.field}: ${issue.message}`),
    ...exact.map(duplicate => duplicate.recordId.startsWith('row:') ? 'An identical record is already included in this file.' : 'This record is already archived. Open the saved record instead of importing it again.'),
  ];
  return { eligible: !sourceLocked && errors.length === 0 && exact.length === 0, alreadySaved, reasons };
}

export function summarizeArchiveReview(preview: ImportPreview, decisions: ImportDecision[], previewOnly = false) {
  const selected = decisions.filter(decision => decision.include);
  const rows = preview.rows;
  return {
    total: rows.length,
    eligible: rows.filter(row => archiveRowEligibility(row, previewOnly).eligible).length,
    duplicates: rows.filter(row => row.duplicates.length > 0).length,
    requiresReview: rows.filter(row => row.issues.some(issue => issue.severity === 'warning') || row.duplicates.some(duplicate => duplicate.level === 'probable')).length,
    blocked: rows.filter(row => !archiveRowEligibility(row, previewOnly).eligible).length,
    alreadySaved: rows.filter(row => archiveRowEligibility(row, previewOnly).alreadySaved).length,
    selected: selected.length,
    acknowledgementNeeded: selected.filter(decision => rows.some(row => row.rowNumber === decision.rowNumber && row.issues.some(issue => issue.severity === 'warning')) && !decision.acknowledgeIncomplete).length,
    duplicateDecisionNeeded: selected.filter(decision => rows.some(row => row.rowNumber === decision.rowNumber && row.duplicates.some(duplicate => duplicate.level === 'probable')) && !decision.allowProbableDuplicate).length,
  };
}

export function selectArchiveRows(preview: ImportPreview, decisions: ImportDecision[], include: boolean, previewOnly = false): ImportDecision[] {
  return decisions.map(decision => ({ ...decision, include: include && preview.rows.some(row => row.rowNumber === decision.rowNumber && archiveRowEligibility(row, previewOnly).eligible) }));
}

/** Reviewing selected incomplete evidence never gives blanket permission for probable duplicates. */
export function acknowledgeSelectedArchiveRows(preview: ImportPreview, decisions: ImportDecision[], acknowledge: boolean): ImportDecision[] {
  return decisions.map(decision => decision.include && preview.rows.some(row => row.rowNumber === decision.rowNumber && row.issues.some(issue => issue.severity === 'warning')) ? { ...decision, acknowledgeIncomplete: acknowledge } : { ...decision });
}

export function archiveSelectionBlockers(preview: ImportPreview, decisions: ImportDecision[], previewOnly = false): string[] {
  const selected = decisions.filter(decision => decision.include);
  if (!selected.length) return ['Select at least one new archive record.'];
  const summary = summarizeArchiveReview(preview, decisions, previewOnly);
  const blocked = selected.some(decision => {
    const row = preview.rows.find(row => row.rowNumber === decision.rowNumber);
    return !row || !archiveRowEligibility(row, previewOnly).eligible;
  });
  return [
    ...(blocked ? ['Remove blocked or already-saved rows from your selection.'] : []),
    ...(summary.acknowledgementNeeded ? ['Acknowledge the missing or unverified information for your selected records.'] : []),
    ...(summary.duplicateDecisionNeeded ? ['Review each probable duplicate and explicitly choose whether it represents separate evidence.'] : []),
  ];
}
