import { z } from 'zod';
const iso = z.string().datetime({ offset: true });
export const modelManifestSchema = z.object({
  format: z.literal('edgelab.offline-model-review'), version: z.literal(1), modelId: z.string().min(1).max(100),
  modelVersion: z.string().min(1).max(100), previousVersion: z.string().min(1).max(100).nullable(),
  datasetHash: z.string().regex(/^[a-f0-9]{64}$/), methodology: z.string().min(20).max(4000), inputSources: z.array(z.string().min(1)).min(1),
  trainingCutoff: iso, validationEnd: iso, frozenAt: iso, testEnd: iso,
  minimumTrain: z.number().int().min(100), minimumValidation: z.number().int().min(30), minimumTest: z.number().int().min(30),
  ownerApproved: z.boolean(), rollbackVersion: z.string().min(1).nullable(),
}).strict();
export const offlineObservationSchema = z.object({ id: z.string().min(1).max(200), eventId: z.string().min(1).max(200), startsAt: iso, outcomeAvailableAt: iso, inputCutoff: iso, probability: z.number().min(0).max(1), outcome: z.union([z.literal(0), z.literal(1)]) }).strict();
export type OfflineObservation = z.infer<typeof offlineObservationSchema>;
/** Validates an externally prepared experimental manifest against chronological
 * partitions. It never modifies the active methodology or model. */
export function reviewOfflineModel(manifestInput: unknown, observations: OfflineObservation[], datasetHash: string) {
  const manifest = modelManifestSchema.parse(manifestInput);
  const trainEnd = Date.parse(manifest.trainingCutoff), validationEnd = Date.parse(manifest.validationEnd), freeze = Date.parse(manifest.frozenAt), testEnd = Date.parse(manifest.testEnd);
  if (!(trainEnd < validationEnd && validationEnd <= freeze && freeze < testEnd)) throw new Error('Use ordered training, validation, frozen-model and unseen-test boundaries.');
  if (manifest.datasetHash !== datasetHash) throw new Error('Dataset hash does not match the reviewed frozen data.');
  if (manifest.modelVersion === manifest.previousVersion) throw new Error('Experimental model versions must be distinct.');
  const partitions = { train: [] as OfflineObservation[], validation: [] as OfflineObservation[], test: [] as OfflineObservation[] };
  const ids = new Set<string>(), events = new Map<string, string>();
  for (const raw of observations) {
    const row = offlineObservationSchema.parse(raw);
    const start = Date.parse(row.startsAt), available = Date.parse(row.outcomeAvailableAt), cutoff = Date.parse(row.inputCutoff);
    if (!row.id || !row.eventId || ids.has(row.id) || !Number.isFinite(start) || !Number.isFinite(available) || !Number.isFinite(cutoff) || cutoff >= start || available <= start || !Number.isFinite(row.probability) || row.probability < 0 || row.probability > 1 || ![0, 1].includes(row.outcome)) throw new Error('Invalid, duplicate or leakage-contaminated observation.');
    ids.add(row.id);
    const partition = start <= trainEnd ? 'train' : start <= validationEnd ? 'validation' : start > freeze && start <= testEnd ? 'test' : null;
    if (!partition) continue;
    if (partition === 'train' && available > trainEnd || partition === 'validation' && available > freeze) throw new Error('Outcome was unavailable at training or model-freeze time.');
    if (partition !== 'train' && cutoff > freeze) throw new Error('Experimental inputs were not frozen before the unseen test.');
    const previous = events.get(row.eventId); if (previous && previous !== partition) throw new Error('The same fixture cannot cross training, validation and test partitions.');
    events.set(row.eventId, partition); partitions[partition].push(row);
  }
  // Adequacy counts fixtures, not correlated selections from the same event.
  const counts = Object.fromEntries(Object.entries(partitions).map(([key, rows]) => [key, new Set(rows.map(r => r.eventId)).size])) as Record<keyof typeof partitions, number>;
  const adequate = counts.train >= manifest.minimumTrain && counts.validation >= manifest.minimumValidation && counts.test >= manifest.minimumTest;
  return { manifest, counts, adequate, promotionReady: false, reason: adequate ? 'Chronology checks passed. Independent performance comparison and explicit owner review are still required; no model has been activated.' : 'Insufficient independent fixtures. No model improvement or promotion is established.', ownerApprovalRecorded: manifest.ownerApproved, rollbackVersion: manifest.rollbackVersion, partitions };
}
/** Descriptive baseline only, never a calibrated betting probability. */
export function describePlayerHistory(rows: { eventId: string; endedAt: string; observedAt: string; value: number | null; source: string }[], cutoff: string) {
  const time = Date.parse(cutoff); if (!Number.isFinite(time)) throw new Error('Use an exact input cutoff.');
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row.eventId || seen.has(row.eventId) || !row.source || !Number.isFinite(Date.parse(row.endedAt)) || !Number.isFinite(Date.parse(row.observedAt)) || Date.parse(row.endedAt) >= time || Date.parse(row.observedAt) >= time || row.value !== null && (!Number.isFinite(row.value) || row.value < 0)) throw new Error('Invalid, duplicate or future-data-contaminated baseline input.');
    seen.add(row.eventId);
  }
  const values = rows.flatMap(r => r.value === null ? [] : [r.value]), n = values.length;
  const mean = n ? values.reduce((a, b) => a + b, 0) / n : null;
  return { count: n, missingCount: rows.length - n, mean, sampleDeviation: n > 1 ? Math.sqrt(values.reduce((sum, value) => sum + (value - mean!) ** 2, 0) / (n - 1)) : null, inputCutoff: cutoff, probability: null, expectedValue: null, validationStatus: n < 30 ? 'insufficient_sample' : 'descriptive_only', modelVersion: 'player-descriptive-v1' };
}
