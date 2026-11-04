import type { HistoricalRepository, HistoricalWorkspace } from './types';
import { emptyHistoricalWorkspace } from './types';
import { historicalWorkspaceSchema } from './validation';
import { validateHistoricalTransition } from './commands';
import { getSupabaseClient } from '@/lib/persistence';

export const HISTORY_DEMO_STORAGE_KEY = 'edgelab:history:demo:v1';
export type HistoricalStorageErrorCode = 'NEW_MIGRATION_REQUIRED' | 'CONFLICT' | 'AUTH_REQUIRED' | 'INVALID_DATA' | 'STORAGE_UNAVAILABLE';
export class HistoricalStorageError extends Error {
  constructor(public readonly code: HistoricalStorageErrorCode, message: string) {
    super(message); this.name = 'HistoricalStorageError';
  }
}
function checked(value: unknown): HistoricalWorkspace {
  const parsed = historicalWorkspaceSchema.safeParse(value);
  if (!parsed.success) throw new HistoricalStorageError('INVALID_DATA', 'Historical data did not pass validation. Existing saved records were not changed.');
  return parsed.data as HistoricalWorkspace;
}
function assertClassification(value: HistoricalWorkspace, demo: boolean) {
  if (value.batches.some(batch => (batch.verification === 'synthetic') !== demo) || value.records.some(record => (record.snapshot.verification === 'synthetic') !== demo)) {
    throw new HistoricalStorageError('INVALID_DATA', demo ? 'Demo historical imports must be explicitly classified as synthetic.' : 'Synthetic historical fixtures stay in Demo mode and cannot be saved to a private account.');
  }
}
function validateSave(previous: HistoricalWorkspace, next: HistoricalWorkspace, expectedRevision: number) {
  if (!Number.isSafeInteger(expectedRevision) || previous.revision !== expectedRevision || next.revision !== expectedRevision + 1) {
    throw new HistoricalStorageError('CONFLICT', 'Historical records changed in another tab. Reload before trying to save again.');
  }
  validateHistoricalTransition(previous, next);
}

export function createDemoHistoricalRepository(): HistoricalRepository {
  let loaded: HistoricalWorkspace | null = null;
  const storage = () => {
    if (typeof window === 'undefined') throw new HistoricalStorageError('STORAGE_UNAVAILABLE', 'Demo historical storage is available in your browser.');
    return window.localStorage;
  };
  const read = (): HistoricalWorkspace => {
    try { const raw = storage().getItem(HISTORY_DEMO_STORAGE_KEY); return raw ? checked(JSON.parse(raw)) : emptyHistoricalWorkspace(); }
    catch (reason) { if (reason instanceof HistoricalStorageError) throw reason; throw new HistoricalStorageError('INVALID_DATA', 'Saved demo historical records could not be read. Export or review the browser storage; no history was replaced.'); }
  };
  return {
    async load() { loaded = read(); assertClassification(loaded, true); return structuredClone(loaded); },
    async save(data, expectedRevision) {
      if (!loaded) throw new HistoricalStorageError('CONFLICT', 'Load historical records before saving.');
      const next = checked(data); assertClassification(next, true);
      const current = read(); validateSave(current, next, expectedRevision);
      try { storage().setItem(HISTORY_DEMO_STORAGE_KEY, JSON.stringify(next)); loaded = structuredClone(next); }
      catch (reason) { if (reason instanceof HistoricalStorageError) throw reason; throw new HistoricalStorageError('STORAGE_UNAVAILABLE', 'Historical changes could not be saved. Browser storage may be full or unavailable.'); }
    },
  };
}

function rpcError(error: { code?: string; message?: string }): never {
  if (/Authentication required|Authenticated historical owner changed/i.test(error.message ?? '')) {
    throw new HistoricalStorageError('AUTH_REQUIRED', 'Your authenticated session changed. Reload and sign in to the intended account before accessing historical records.');
  }
  if (error.code === 'PGRST202' || error.code === '42883' || /could not find.*edgelab_(load|save)_history/i.test(error.message ?? '')) {
    throw new HistoricalStorageError('NEW_MIGRATION_REQUIRED', 'The required historical persistence RPCs are unavailable. Review the historical-import migration deployment and Supabase schema cache; request approval before applying a hosted migration. Demo import is available locally.');
  }
  if (/revision conflict/i.test(error.message ?? '')) throw new HistoricalStorageError('CONFLICT', 'Historical records changed in another tab. Reload before saving; your earlier view has been retained.');
  throw new HistoricalStorageError('STORAGE_UNAVAILABLE', 'Historical storage could not complete the request. No successful save is being claimed.');
}
export function createSupabaseHistoricalRepository(userId: string): HistoricalRepository {
  let loaded: HistoricalWorkspace | null = null;
  const requireUser = async () => {
    const client = getSupabaseClient();
    if (!client) throw new HistoricalStorageError('AUTH_REQUIRED', 'Configure the public Supabase URL/key and sign in to historical storage.');
    const { data, error } = await client.auth.getUser();
    if (error || !data.user || data.user.id !== userId) throw new HistoricalStorageError('AUTH_REQUIRED', 'Your authenticated session changed. Sign in again before saving historical records.');
    return client;
  };
  return {
    async load() {
      const client = await requireUser();
      const { data, error } = await client.rpc('edgelab_load_history', { expected_owner_id: userId });
      if (error) rpcError(error);
      const parsed = checked(data); assertClassification(parsed, false);
      loaded = parsed; return structuredClone(parsed);
    },
    async save(data, expectedRevision) {
      if (!loaded) throw new HistoricalStorageError('CONFLICT', 'Load historical records before saving.');
      const next = checked(data); assertClassification(next, false); validateSave(loaded, next, expectedRevision);
      const client = await requireUser();
      const { data: nextRevision, error } = await client.rpc('edgelab_save_history', { workspace: next, expected_revision: expectedRevision, expected_owner_id: userId });
      if (error) rpcError(error);
      if (!Number.isSafeInteger(Number(nextRevision)) || Number(nextRevision) !== expectedRevision + 1) throw new HistoricalStorageError('CONFLICT', 'Historical save response was unexpected. Reload before editing again.');
      loaded = structuredClone(next);
    },
  };
}
