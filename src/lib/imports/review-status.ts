import type { HistoricalRecord, ImportPreviewRow } from './types';
/** Review provenance is immutable evidence, not a verified pre-event forecast. */
export function isHistoricalReviewRecord(record: Pick<HistoricalRecord,'snapshot'|'transformations'> | ImportPreviewRow): boolean {
  return record.snapshot.verification==='unverified'||record.transformations.some(change=>['recovery_mapping_v1','paper_supplement_mapping_v1'].includes(change.rule));
}
