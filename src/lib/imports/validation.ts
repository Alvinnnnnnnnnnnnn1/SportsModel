import { z } from 'zod';
import type { HistoricalWorkspace } from './types';
import { multiplyMoney } from '@/lib/domain/calculations';
const id = z.string().uuid();
const timestamp = z.string().datetime({ offset: true });
const nullableText = z.string().trim().min(1).max(500).nullable();
const money = z.number().int().min(0).max(100000000).nullable();
const outcome = z.enum(['pending', 'won', 'lost', 'void']);
const sport = z.enum(['NBA', 'NBL', 'ATP', 'WTA']);
const verification = z.enum(['unverified', 'user_confirmed', 'synthetic']);
const odds = z.number().min(1.0001).max(10000).refine(v => Math.abs(v * 10000 - Math.round(v * 10000)) < 0.00001, 'Use at most four decimal places').nullable();
const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const historicalLegSchema = z.object({ id, sport: sport.nullable(), eventId: nullableText, event: nullableText, participant: nullableText, marketId: nullableText, market: nullableText, selection: nullableText, line: z.string().trim().min(1).max(100).nullable(), odds, outcome: outcome.nullable(), statistic: z.string().max(500).nullable() }).strict();
export const historicalSnapshotSchema = z.object({
    externalId: nullableText, eventId: nullableText, marketId: nullableText,
    kind: z.enum(['actual', 'paper']).nullable(), sport: sport.nullable(), event: nullableText,
    participant: nullableText, market: nullableText, selection: nullableText,
    line: z.string().trim().min(1).max(100).nullable(), bookmaker: nullableText, odds,
    predictionAt: timestamp.nullable(), placedAt: timestamp.nullable(), settledAt: timestamp.nullable(),
    probability: z.number().min(0).max(1).nullable(), probabilitySource: nullableText,
    probabilityMethod: nullableText, modelVersion: nullableText,
    strategy: z.enum(['A', 'B', 'C']).nullable(), sourceReference: z.string().trim().min(1).max(2000).nullable(),
    stakeCents: money, stakeType: z.enum(['cash', 'bonus']).nullable(), payoutCents: money,
    outcome: outcome.nullable(), verification, notes: z.string().max(5000).nullable(),
    legs: z.array(historicalLegSchema).max(20),
}).strict().superRefine((snapshot, context) => {
    const reject = (field: string, message: string) => context.addIssue({ code: 'custom', path: [field], message });
    if (snapshot.kind === 'actual' && snapshot.stakeCents === 0)
        reject('stakeCents', 'An actual stake must be greater than zero.');
    if (snapshot.outcome === 'pending' && snapshot.settledAt !== null)
        reject('settledAt', 'A pending record cannot have a settlement timestamp.');
    for (const field of ['predictionAt', 'placedAt'] as const)
        if (snapshot.settledAt && snapshot[field] && Date.parse(snapshot.settledAt) < Date.parse(snapshot[field]!))
            reject('settledAt', 'Settlement cannot precede a known source timestamp.');
    const outcomes = snapshot.legs.map(leg => leg.outcome);
    if (snapshot.outcome === 'won' && (outcomes.some(value => value === 'lost' || value === 'pending') || (outcomes.length > 0 && outcomes.every(value => value === 'void'))))
        reject('outcome', 'A won record cannot contain lost/pending legs or only void legs.');
    if (snapshot.outcome === 'lost' && outcomes.length && outcomes.every(value => value === 'won' || value === 'void'))
        reject('outcome', 'A lost record needs a lost or unknown leg.');
    if (snapshot.outcome === 'void' && outcomes.some(value => value !== null && value !== 'void'))
        reject('outcome', 'A void record cannot contain a non-void leg.');
    if (snapshot.payoutCents !== null) {
        if ((snapshot.outcome === 'pending' || snapshot.outcome === 'lost') && snapshot.payoutCents !== 0)
            reject('payoutCents', 'Pending or lost records cannot have a realised payout.');
        if (!(snapshot.outcome === 'won' && outcomes.includes('void')) && snapshot.stakeCents !== null && snapshot.odds !== null && snapshot.stakeType && snapshot.outcome && snapshot.outcome !== 'pending') {
            const expected = snapshot.outcome === 'lost' ? 0 : snapshot.outcome === 'void' ? snapshot.stakeType === 'cash' ? snapshot.stakeCents : 0 : multiplyMoney(snapshot.stakeCents, snapshot.stakeType === 'cash' ? snapshot.odds : snapshot.odds - 1);
            if (snapshot.payoutCents !== expected)
                reject('payoutCents', 'Reported payout disagrees with deterministic cash/bonus settlement.');
        }
    }
});
export const historySnapshotSchema = historicalSnapshotSchema;
export const importIssueSchema = z.object({ field: z.string().max(500), severity: z.enum(['error', 'warning']), code: z.string().max(100), message: z.string().max(1000) }).strict();
export const importTransformationSchema = z.object({ field: z.string().max(500), original: z.unknown(), normalized: z.unknown(), rule: z.string().max(500) }).strict();
export const importBatchSchema = z.object({ id, createdAt: timestamp, sourceName: z.string().min(1).max(255), format: z.enum(['csv', 'json', 'manual']), rawSource: z.string().max(1048576), sourceHash: hash, verification, summary: z.object({ parsed: z.number().int().min(1).max(500), imported: z.number().int().min(1).max(500), skipped: z.number().int().min(0).max(500), warnings: z.number().int().min(0), actual: z.number().int().min(0).max(500), paper: z.number().int().min(0).max(500) }).strict() }).strict();
export const historicalRecordSchema = z.object({ id, batchId: id, rowNumber: z.number().int().min(1).max(500), importedAt: timestamp, raw: z.record(z.string(), z.unknown()), fingerprint: hash, snapshot: historicalSnapshotSchema, issues: z.array(importIssueSchema).max(500), transformations: z.array(importTransformationSchema).max(2000), probableDuplicateConfirmed: z.boolean(), incompleteConfirmed: z.boolean() }).strict();
export const historicalPaperResultSchema = z.object({ recordId: id, outcome, settledAt: timestamp.nullable(), statistic: z.string().max(500).nullable(), legs: z.array(z.object({ legId: id, outcome, statistic: z.string().max(500).nullable() }).strict()).max(20), updatedAt: timestamp }).strict();
export const historicalNotificationSchema = z.object({ id, recordId: id, dedupeKey: z.string().min(1).max(200), title: z.string().min(1).max(500), message: z.string().max(5000), createdAt: timestamp, readAt: timestamp.nullable(), dismissedAt: timestamp.nullable() }).strict();
export const historicalAuditSchema = z.object({ id, recordId: id.nullable(), batchId: id.nullable(), action: z.enum(['import_confirmed', 'paper_registered', 'paper_result_recorded', 'notification_created', 'notification_read', 'notification_dismissed']), timestamp, before: z.unknown(), after: z.unknown() }).strict();
export const historicalWorkspaceSchema = z.object({ revision: z.number().int().min(0), batches: z.array(importBatchSchema), records: z.array(historicalRecordSchema), paperResults: z.array(historicalPaperResultSchema), notifications: z.array(historicalNotificationSchema), audit: z.array(historicalAuditSchema) }).strict().superRefine((workspace, context) => {
    const reject = (message: string) => context.addIssue({ code: 'custom', message });
    const unique = (values: string[], name: string) => { if (new Set(values).size !== values.length)
        reject(`Duplicate ${name} identifiers`); };
    unique(workspace.batches.map(v => v.id), 'batch');
    unique(workspace.records.map(v => v.id), 'record');
    unique(workspace.paperResults.map(v => v.recordId), 'paper result');
    unique(workspace.notifications.map(v => v.id), 'notification');
    unique(workspace.notifications.map(v => v.recordId), 'notification source');
    unique(workspace.notifications.map(v => v.dedupeKey), 'notification deduplication');
    unique(workspace.audit.map(v => v.id), 'audit');
    const batches = new Map(workspace.batches.map(v => [v.id, v]));
    const records = new Map(workspace.records.map(v => [v.id, v]));
    unique(workspace.records.map(v => v.fingerprint), 'record fingerprint');
    unique(workspace.records.filter(v => v.snapshot.externalId !== null && v.snapshot.sourceReference !== null).map(v => JSON.stringify([v.snapshot.externalId, v.snapshot.sourceReference])), 'external source reference');
    for (const record of workspace.records) {
        const batch = batches.get(record.batchId);
        if (!batch)
            reject('Imported record has no source batch');
        else if (record.snapshot.verification !== batch.verification)
            reject('Record verification must match the source batch');
        if (batch && record.rowNumber > batch.summary.parsed)
            reject('Record number is outside the original source');
        if (record.issues.some(v => v.severity === 'error'))
            reject('An imported record cannot contain unresolved errors');
        if (record.issues.some(v => v.severity === 'warning') && !record.incompleteConfirmed)
            reject('Import warnings require explicit acknowledgement');
        if (new Set(record.snapshot.legs.map(l => l.id)).size !== record.snapshot.legs.length)
            reject('Duplicate parlay leg identifiers');
    }
    for (const result of workspace.paperResults) {
        const record = records.get(result.recordId);
        if (!record || record.snapshot.kind === 'actual')
            reject('A paper result must reference a paper prediction');
        else {
            const ids = record.snapshot.legs.map(l => l.id);
            if (result.legs.length !== ids.length || result.legs.some(l => !ids.includes(l.legId)) || new Set(result.legs.map(l => l.legId)).size !== result.legs.length)
                reject('Paper results must cover exactly the registered legs');
            if (result.settledAt && record.snapshot.predictionAt && Date.parse(result.settledAt) < Date.parse(record.snapshot.predictionAt))
                reject('Paper settlement cannot precede the original prediction');
            if (result.outcome === 'pending' && result.settledAt)
                reject('Pending paper predictions cannot have a settlement timestamp');
            if (result.outcome !== 'pending' && !result.legs.length)
                reject('A settled paper prediction needs at least one registered leg');
            if (result.outcome === 'won' && (!result.legs.some(l => l.outcome === 'won') || result.legs.some(l => l.outcome === 'pending' || l.outcome === 'lost')))
                reject('A won paper prediction requires won or void legs and at least one win');
            if (result.outcome === 'lost' && !result.legs.some(l => l.outcome === 'lost'))
                reject('A lost paper prediction requires a lost leg');
            if (result.outcome === 'void' && !result.legs.every(l => l.outcome === 'void'))
                reject('A void paper prediction requires all legs void');
        }
    }
    for (const batch of workspace.batches) {
        const recordsForBatch = workspace.records.filter(record => record.batchId === batch.id);
        if (new TextEncoder().encode(batch.rawSource).byteLength > 1048576)
            reject('Import source exceeds 1 MiB');
        if (recordsForBatch.length !== batch.summary.imported || batch.summary.parsed !== batch.summary.imported + batch.summary.skipped || batch.summary.warnings !== recordsForBatch.reduce((count, record) => count + record.issues.filter(issue => issue.severity === 'warning').length, 0) || batch.summary.actual !== recordsForBatch.filter(r => r.snapshot.kind === 'actual').length || batch.summary.paper !== recordsForBatch.filter(r => r.snapshot.kind === 'paper').length)
            reject('Import summary must match its immutable records');
    }
    for (const notification of workspace.notifications) {
        if (!records.has(notification.recordId))
            reject('Notification record does not exist');
        if (notification.dedupeKey !== `historical-research:${notification.recordId}`)
            reject('Notification deduplication key must identify its original record');
        if (notification.dismissedAt && !notification.readAt)
            reject('Dismissed notifications must retain their read timestamp');
        for (const field of ['readAt', 'dismissedAt'] as const)
            if (notification[field] && Date.parse(notification[field]!) < Date.parse(notification.createdAt))
                reject('Notification state cannot precede generation');
    }
    for (const entry of workspace.audit) {
        if (entry.recordId && !records.has(entry.recordId))
            reject('Audit record does not exist');
        if (entry.batchId && !batches.has(entry.batchId))
            reject('Audit source batch does not exist');
        if (entry.recordId && records.get(entry.recordId)?.batchId !== entry.batchId)
            reject('Audit source batch must match its record');
    }
});
export function validateHistoricalWorkspace(value: unknown): HistoricalWorkspace { return historicalWorkspaceSchema.parse(value) as HistoricalWorkspace; }
