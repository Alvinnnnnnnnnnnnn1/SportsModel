import type { Bet, Outcome, Sport, Strategy } from '@/lib/domain/types';
export type HistoricalKind = 'actual' | 'paper';
export type VerificationStatus = 'unverified' | 'user_confirmed' | 'synthetic';
export interface HistoricalLeg {
  id: string; sport: Sport | null; eventId: string | null; event: string | null;
  participant: string | null; marketId: string | null; market: string | null;
  selection: string | null; line: string | null; odds: number | null;
  outcome: Outcome | null; statistic: string | null;
}
export interface HistoricalSnapshot {
  externalId: string | null; eventId: string | null; marketId: string | null;
  kind: HistoricalKind | null; sport: Sport | null; event: string | null;
  participant: string | null; market: string | null; selection: string | null;
  line: string | null; bookmaker: string | null; odds: number | null;
  predictionAt: string | null; placedAt: string | null; settledAt: string | null;
  probability: number | null; probabilitySource: string | null;
  probabilityMethod: string | null; modelVersion: string | null;
  strategy: Strategy | null; sourceReference: string | null;
  stakeCents: number | null; stakeType: 'cash' | 'bonus' | null;
  payoutCents: number | null; outcome: Outcome | null;
  verification: VerificationStatus; notes: string | null; legs: HistoricalLeg[];
}
export interface ImportIssue { field: string; severity: 'error' | 'warning'; code: string; message: string; }
export interface ImportTransformation { field: string; original: unknown; normalized: unknown; rule: string; }
export interface ImportDuplicate { recordId: string; level: 'exact' | 'probable'; reason: string; }
export interface ImportPreviewRow {
  rowNumber: number; raw: unknown; snapshot: HistoricalSnapshot;
  fingerprint: string; issues: ImportIssue[]; transformations: ImportTransformation[];
  duplicates: ImportDuplicate[];
}
export interface ImportPreview {
  sourceName: string; format: 'csv' | 'json' | 'manual'; rawSource: string;
  sourceHash: string; rows: ImportPreviewRow[];
}
export interface ImportBatch {
  id: string; createdAt: string; sourceName: string; format: 'csv' | 'json' | 'manual';
  rawSource: string; sourceHash: string; verification: VerificationStatus;
  summary: { parsed: number; imported: number; skipped: number; warnings: number; actual: number; paper: number; };
}
export interface HistoricalRecord {
  id: string; batchId: string; rowNumber: number; importedAt: string;
  raw: unknown; fingerprint: string; snapshot: HistoricalSnapshot;
  issues: ImportIssue[]; transformations: ImportTransformation[];
  probableDuplicateConfirmed: boolean; incompleteConfirmed: boolean;
}
export interface PaperLegResult { legId: string; outcome: Outcome; statistic: string | null; }
export interface HistoricalPaperResult {
  recordId: string; outcome: Outcome; settledAt: string | null;
  statistic: string | null; legs: PaperLegResult[]; updatedAt: string;
}
export interface HistoricalNotification {
  id: string; recordId: string; dedupeKey: string; title: string; message: string;
  createdAt: string; readAt: string | null; dismissedAt: string | null;
}
export interface HistoricalAudit {
  id: string; recordId: string | null; batchId: string | null;
  action: 'import_confirmed' | 'paper_registered' | 'paper_result_recorded' | 'notification_created' | 'notification_read' | 'notification_dismissed';
  timestamp: string; before: unknown; after: unknown;
}
export interface HistoricalWorkspace {
  revision: number; batches: ImportBatch[]; records: HistoricalRecord[];
  paperResults: HistoricalPaperResult[]; notifications: HistoricalNotification[]; audit: HistoricalAudit[];
}
export interface ImportDecision { rowNumber: number; include: boolean; allowProbableDuplicate: boolean; acknowledgeIncomplete: boolean; }
export interface ImportCommit {
  batch: ImportBatch; records: HistoricalRecord[]; audit: HistoricalAudit[];
}
export interface HistoricalRepository {
  load(): Promise<HistoricalWorkspace>;
  save(data: HistoricalWorkspace, expectedRevision: number): Promise<void>;
}
export interface HistoricalFinancialReview { bet: Bet | null; issues: ImportIssue[]; expectedPayoutCents: number | null; }
export const emptyHistoricalWorkspace = (): HistoricalWorkspace => ({ revision: 0, batches: [], records: [], paperResults: [], notifications: [], audit: [] });
