export interface ProbeResponse<T = unknown> { data: T; error: { code?: string; message?: string } | null; }
export interface ProbeWorkspace { revision: number; batches: unknown[]; records: unknown[]; paperResults: unknown[]; notifications: unknown[]; audit: unknown[]; }
export interface ProbeClient {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<ProbeResponse>;
  from(table: string): { select(columns: string): { eq(column: string, value: string): { limit(count: number): PromiseLike<ProbeResponse> }; limit(count: number): PromiseLike<ProbeResponse> } };
}
export interface ProbeResult { name: string; passed: boolean | null; skipped?: boolean; detail?: string; }
export function emptyHistoricalProbeWorkspace(): ProbeWorkspace;
export function isEmptyHistoricalProbeWorkspace(workspace: unknown): boolean;
export function syntheticHistoricalRejectionProbe(): ProbeWorkspace;
export function runHostedHistoryAccessChecks(options: { clients: [ProbeClient, ProbeClient]; identities: [string, string]; negativeWrites?: boolean; onCheck?: (name: string, detail?: string) => void }): Promise<{ results: ProbeResult[]; bothHistoryContextsEmpty: boolean; negativeWriteStatus: string }>;
export function runAnonymousHistoryChecks(anonymous: ProbeClient, sampleUserId: string, onCheck?: (name: string) => void): Promise<ProbeResult[]>;
