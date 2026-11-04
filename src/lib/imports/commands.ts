import type { HistoricalAudit, HistoricalPaperResult, HistoricalRecord, HistoricalWorkspace, ImportCommit, ImportDecision, ImportPreview, VerificationStatus } from './types';
import { historicalWorkspaceSchema, importBatchSchema, historicalRecordSchema } from './validation';
import { detectHistoricalDuplicates } from './duplicates';
const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical((value as Record<string, unknown>)[key])])) : value;
const json = (value: unknown) => JSON.stringify(canonical(value));
const stamp = () => new Date().toISOString();
function checked(value: HistoricalWorkspace): HistoricalWorkspace { return historicalWorkspaceSchema.parse(value) as HistoricalWorkspace; }
export function prepareImportCommit(preview: ImportPreview, decisions: ImportDecision[], verification: VerificationStatus, existingRecords: HistoricalRecord[] = []): ImportCommit {
    if (new Set(decisions.map(d => d.rowNumber)).size !== decisions.length)
        throw new Error('Each source row can have only one review decision.');
    if (decisions.some(d => !preview.rows.some(row => row.rowNumber === d.rowNumber)))
        throw new Error('A review decision references an unknown row.');
    const included = preview.rows.filter(row => decisions.some(d => d.rowNumber === row.rowNumber && d.include));
    if (!included.length)
        throw new Error('Select at least one approved record.');
    const now = stamp(), batchId = crypto.randomUUID();
    const records: HistoricalRecord[] = [];
    for (const row of included) {
        const decision = decisions.find(d => d.rowNumber === row.rowNumber)!;
        if (row.snapshot.verification !== verification)
            throw new Error('Source verification cannot be changed after preview. Re-parse the source with the intended classification.');
        if (row.issues.some(v => v.severity === 'error'))
            throw new Error(`Row ${row.rowNumber} has unresolved errors.`);
        if (row.issues.some(v => v.severity === 'warning') && !decision.acknowledgeIncomplete)
            throw new Error(`Row ${row.rowNumber} needs explicit acknowledgement of missing or unverified information.`);
        const duplicates = detectHistoricalDuplicates(row.snapshot, row.fingerprint, [...existingRecords, ...records]);
        if (duplicates.some(d => d.level === 'exact'))
            throw new Error(`Row ${row.rowNumber} is an exact duplicate; it was not merged or imported.`);
        if (duplicates.some(d => d.level === 'probable') && !decision.allowProbableDuplicate)
            throw new Error(`Row ${row.rowNumber} may duplicate another record. Confirm it explicitly or skip it.`);
        records.push(historicalRecordSchema.parse({ id: crypto.randomUUID(), batchId, rowNumber: row.rowNumber, importedAt: now, raw: structuredClone(row.raw), fingerprint: row.fingerprint, snapshot: structuredClone(row.snapshot), issues: structuredClone(row.issues), transformations: structuredClone(row.transformations), probableDuplicateConfirmed: decision.allowProbableDuplicate, incompleteConfirmed: decision.acknowledgeIncomplete }) as HistoricalRecord);
    }
    const batch = importBatchSchema.parse({ id: batchId, createdAt: now, sourceName: preview.sourceName, format: preview.format, rawSource: preview.rawSource, sourceHash: preview.sourceHash, verification, summary: { parsed: preview.rows.length, imported: records.length, skipped: preview.rows.length - records.length, warnings: records.reduce((n, r) => n + r.issues.filter(i => i.severity === 'warning').length, 0), actual: records.filter(r => r.snapshot.kind === 'actual').length, paper: records.filter(r => r.snapshot.kind === 'paper').length } });
    const audit: HistoricalAudit[] = [{ id: crypto.randomUUID(), recordId: null, batchId, action: 'import_confirmed', timestamp: now, before: null, after: { summary: batch.summary, sourceHash: batch.sourceHash, recordIds: records.map(r => r.id), financialEffect: 'archive_only_no_funding_or_ledger_writes', decisions: structuredClone(decisions) } }];
    return { batch, records, audit };
}
export function commitHistoricalImport(workspace: HistoricalWorkspace, commit: ImportCommit): HistoricalWorkspace {
    if (workspace.batches.some(batch => batch.id === commit.batch.id))
        throw new Error('This import batch is already registered.');
    const seen = [...workspace.records];
    for (const record of commit.records) {
        const duplicates = detectHistoricalDuplicates(record.snapshot, record.fingerprint, seen);
        if (duplicates.some(d => d.level === 'exact'))
            throw new Error('An exact duplicate appeared after preview; refresh and review again.');
        if (duplicates.some(d => d.level === 'probable') && !record.probableDuplicateConfirmed)
            throw new Error('A probable duplicate appeared after preview; review again.');
        seen.push(record);
    }
    const next = checked({ ...workspace, revision: workspace.revision + 1, batches: [...workspace.batches, structuredClone(commit.batch)], records: [...workspace.records, ...structuredClone(commit.records)], audit: [...workspace.audit, ...structuredClone(commit.audit)] });
    validateHistoricalTransition(workspace, next);
    return next;
}
export function registerHistoricalPaper(workspace: HistoricalWorkspace, recordId: string): HistoricalWorkspace {
    const record = workspace.records.find(r => r.id === recordId);
    if (!record)
        throw new Error('Historical record not found.');
    if (record.snapshot.kind === 'actual')
        throw new Error('An actual bet cannot be converted into a paper prediction.');
    if (workspace.paperResults.some(r => r.recordId === recordId))
        return workspace;
    const now = stamp();
    const s = record.snapshot;
    const completeLegs = s.legs.length > 0 && s.legs.every(l => l.outcome !== null);
    const sourceOutcome = completeLegs ? s.outcome : null;
    const result: HistoricalPaperResult = { recordId, outcome: sourceOutcome ?? 'pending', settledAt: sourceOutcome && sourceOutcome !== 'pending' ? s.settledAt : null, statistic: null, legs: s.legs.map(l => ({ legId: l.id, outcome: l.outcome ?? 'pending', statistic: l.statistic })), updatedAt: now };
    // The pending defaults are explicitly selected tracking statuses, never edits to original unknown source facts.
    const next = checked({ ...workspace, revision: workspace.revision + 1, paperResults: [...workspace.paperResults, result], audit: [...workspace.audit, { id: crypto.randomUUID(), recordId, batchId: record.batchId, action: 'paper_registered', timestamp: now, before: null, after: result }] });
    validateHistoricalTransition(workspace, next);
    return next;
}
export function settleHistoricalPaper(workspace: HistoricalWorkspace, recordId: string, result: HistoricalPaperResult): HistoricalWorkspace {
    const record = workspace.records.find(r => r.id === recordId);
    if (!record)
        throw new Error('Historical record not found.');
    if (record.snapshot.kind === 'actual')
        throw new Error('Actual entries must be settled in the actual ledger.');
    if (record.snapshot.kind === null && !workspace.paperResults.some(r => r.recordId === recordId))
        throw new Error('Explicitly add this unclassified source record to paper tracking first.');
    if (result.recordId !== recordId)
        throw new Error('Paper result references a different source record.');
    const before = workspace.paperResults.find(r => r.recordId === recordId) ?? null;
    const after = { ...structuredClone(result), updatedAt: stamp() };
    const next = checked({ ...workspace, revision: workspace.revision + 1, paperResults: [...workspace.paperResults.filter(r => r.recordId !== recordId), after], audit: [...workspace.audit, { id: crypto.randomUUID(), recordId, batchId: record.batchId, action: 'paper_result_recorded', timestamp: after.updatedAt, before, after }] });
    validateHistoricalTransition(workspace, next);
    return next;
}
export function createHistoricalNotification(workspace: HistoricalWorkspace, recordId: string): HistoricalWorkspace {
    const record = workspace.records.find(r => r.id === recordId);
    if (!record)
        throw new Error('Historical record not found.');
    const dedupeKey = `historical-research:${recordId}`;
    if (workspace.notifications.some(n => n.dedupeKey === dedupeKey))
        return workspace;
    const now = stamp();
    const s = record.snapshot;
    const after = { id: crypto.randomUUID(), recordId, dedupeKey, title: `${s.verification === 'synthetic' ? 'Synthetic' : 'Historical'} research · ${s.sport ?? 'sport unknown'}`, message: `${s.event ?? 'Event unknown'} · ${s.participant ?? 'Participant unknown'} · ${s.selection ?? 'Selection unknown'} ${s.line ?? ''}. Original price ${s.odds === null ? 'unknown' : s.odds.toFixed(4)}. Source ${s.sourceReference ?? 'unverified / missing'}. Review the immutable source before tracking.`, createdAt: now, readAt: null, dismissedAt: null };
    const next = checked({ ...workspace, revision: workspace.revision + 1, notifications: [after, ...workspace.notifications], audit: [...workspace.audit, { id: crypto.randomUUID(), recordId, batchId: record.batchId, action: 'notification_created', timestamp: now, before: null, after }] });
    validateHistoricalTransition(workspace, next);
    return next;
}
function updateNotification(workspace: HistoricalWorkspace, id: string, dismiss: boolean): HistoricalWorkspace {
    const before = workspace.notifications.find(n => n.id === id);
    if (!before)
        throw new Error('Notification not found.');
    if (dismiss ? before.dismissedAt !== null : before.readAt !== null)
        return workspace;
    const now = stamp();
    const after = { ...before, readAt: before.readAt ?? now, ...(dismiss ? { dismissedAt: now } : {}) };
    const record = workspace.records.find(r => r.id === before.recordId)!;
    const next = checked({ ...workspace, revision: workspace.revision + 1, notifications: workspace.notifications.map(n => n.id === id ? after : n), audit: [...workspace.audit, { id: crypto.randomUUID(), recordId: record.id, batchId: record.batchId, action: dismiss ? 'notification_dismissed' : 'notification_read', timestamp: now, before, after }] });
    validateHistoricalTransition(workspace, next);
    return next;
}
export function markHistoricalNotificationRead(workspace: HistoricalWorkspace, id: string): HistoricalWorkspace { return updateNotification(workspace, id, false); }
export function dismissHistoricalNotification(workspace: HistoricalWorkspace, id: string): HistoricalWorkspace { return updateNotification(workspace, id, true); }
/** Shared repository guard: append history and settlement; never rewrite a registered forecast. */
export function validateHistoricalTransition(before: HistoricalWorkspace, after: HistoricalWorkspace): void {
    checked(after);
    if (json(before) === json(after))
        return;
    if (after.revision !== before.revision + 1)
        throw new Error('Historical workspace revision must advance exactly once.');
    const unchanged = (oldValues: {
        id: string;
    }[], newValues: {
        id: string;
    }[], label: string) => { for (const old of oldValues) {
        const current = newValues.find(v => v.id === old.id);
        if (!current || json(current) !== json(old))
            throw new Error(`${label} is immutable and cannot be removed.`);
    } };
    unchanged(before.batches, after.batches, 'Original import batch');
    unchanged(before.records, after.records, 'Registered historical snapshot');
    unchanged(before.audit, after.audit, 'Import audit history');
    const newAudit = after.audit.filter(entry => !before.audit.some(old => old.id === entry.id));
    for (const batch of after.batches.filter(batch => !before.batches.some(old => old.id === batch.id)))
        if (!newAudit.some(a => a.action === 'import_confirmed' && a.batchId === batch.id))
            throw new Error('New import batches need a confirmation audit.');
    for (const record of after.records.filter(record => !before.records.some(old => old.id === record.id)))
        if (before.batches.some(batch => batch.id === record.batchId))
            throw new Error('New records cannot be appended to an immutable source batch.');
    for (const old of before.paperResults)
        if (!after.paperResults.some(r => r.recordId === old.recordId))
            throw new Error('Paper results cannot be deleted.');
    for (const old of before.notifications) {
        const current = after.notifications.find(n => n.id === old.id);
        if (!current)
            throw new Error('Notification history cannot be deleted.');
        const omit = (n: typeof old) => { const rest = { ...n }; delete (rest as Partial<typeof old>).readAt; delete (rest as Partial<typeof old>).dismissedAt; return rest; };
        if (json(omit(current)) !== json(omit(old)))
            throw new Error('Notification details are immutable.');
        if ((old.readAt && current.readAt !== old.readAt) || (old.dismissedAt && current.dismissedAt !== old.dismissedAt))
            throw new Error('Notification read/dismiss history cannot be reset.');
        if (json(old) !== json(current) && !newAudit.some(a => a.recordId === old.recordId && (a.action === 'notification_read' || a.action === 'notification_dismissed') && json(a.before) === json(old) && json(a.after) === json(current)))
            throw new Error('Notification state changes need an accurate before/after audit entry.');
    }
    for (const notification of after.notifications.filter(n => !before.notifications.some(old => old.id === n.id)))
        if (notification.readAt !== null || notification.dismissedAt !== null || !newAudit.some(a => a.action === 'notification_created' && a.recordId === notification.recordId && a.before === null && json(a.after) === json(notification)))
            throw new Error('New notifications must start unread and have an accurate generation audit.');
    for (const result of after.paperResults) {
        const old = before.paperResults.find(r => r.recordId === result.recordId) ?? null;
        if (json(old) !== json(result) && !newAudit.some(a => a.recordId === result.recordId && (a.action === 'paper_result_recorded' || (a.action === 'paper_registered' && old === null)) && json(a.before) === json(old) && json(a.after) === json(result)))
            throw new Error('Paper result changes need an accurate before/after audit entry.');
    }
}
