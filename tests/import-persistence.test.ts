import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyHistoricalWorkspace, type VerificationStatus } from '@/lib/imports/types';
import { parseHistoricalSource } from '@/lib/imports/parser';
import { commitHistoricalImport, prepareImportCommit, createHistoricalNotification, markHistoricalNotificationRead, dismissHistoricalNotification, registerHistoricalPaper } from '@/lib/imports/commands';

const mock = vi.hoisted(() => ({ rpc: vi.fn(), getUser: vi.fn(), getClient: vi.fn() }));
vi.mock('@/lib/persistence', () => ({ getSupabaseClient: mock.getClient }));
const userId = '00000000-0000-4000-8000-000000000001';
beforeEach(() => {
  vi.clearAllMocks();
  mock.getClient.mockReturnValue({ auth: { getUser: mock.getUser }, rpc: mock.rpc });
  mock.getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
});
afterEach(() => vi.unstubAllGlobals());
function browserStorage() {
  const values = new Map<string, string>();
  const localStorage = { getItem: vi.fn((key: string) => values.get(key) ?? null), setItem: vi.fn((key: string, value: string) => values.set(key, value)) };
  vi.stubGlobal('window', { localStorage }); return { values, localStorage };
}
async function imported(verification: VerificationStatus) {
  // Isolated local fixture; never sent to a live database by these mocked tests.
  const preview = await parseHistoricalSource({ text: JSON.stringify([{ kind: 'paper', sport: 'NBA', event: 'Local test fixture', participant: 'Test player', market: 'Points', selection: 'Over', line: '18.5', odds: 1.95, predictionAt: '2026-11-04T08:00:00Z', sourceReference: 'Local unit test only', stakeCents: 500, stakeType: 'cash', outcome: 'pending', verification, notes: 'Synthetic unit test; not real research' }]), format: 'json', sourceName: 'local-test.json', verification });
  const commit = prepareImportCommit(preview, preview.rows.map(row => ({ rowNumber: row.rowNumber, include: true, allowProbableDuplicate: false, acknowledgeIncomplete: true })), verification);
  return commitHistoricalImport(emptyHistoricalWorkspace(), commit);
}

describe('historical demo persistence', () => {
  it('round-trips only through its isolated archive key without changing existing demo financial storage', async () => {
    const { values } = browserStorage(); values.set('edgelab:demo:v1', 'existing ledger fixture');
    const { createDemoHistoricalRepository, HISTORY_DEMO_STORAGE_KEY } = await import('@/lib/imports/repository');
    const repository = createDemoHistoricalRepository(); expect(await repository.load()).toEqual(emptyHistoricalWorkspace());
    const next = await imported('synthetic'); await repository.save(next, 0);
    expect(await repository.load()).toEqual(next); expect(values.get('edgelab:demo:v1')).toBe('existing ledger fixture');
    expect([...values.keys()]).toEqual(['edgelab:demo:v1', HISTORY_DEMO_STORAGE_KEY]); expect(mock.getClient).not.toHaveBeenCalled(); expect(mock.rpc).not.toHaveBeenCalled();
  });
  it('requires a fresh revision across independent tabs without replacing earlier saved history', async () => {
    const { values } = browserStorage(); const { createDemoHistoricalRepository, HISTORY_DEMO_STORAGE_KEY } = await import('@/lib/imports/repository');
    const first = createDemoHistoricalRepository(), second = createDemoHistoricalRepository(); await first.load(); await second.load();
    const next = await imported('synthetic'); await first.save(next, 0);
    await expect(second.save(await imported('synthetic'), 0)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(JSON.parse(values.get(HISTORY_DEMO_STORAGE_KEY)!)).toEqual(next);
  });
  it('freezes source snapshots and audits while preserving notification lifecycle after refresh', async () => {
    browserStorage(); const { createDemoHistoricalRepository } = await import('@/lib/imports/repository'); const repository = createDemoHistoricalRepository(); await repository.load();
    let workspace = await imported('synthetic'); await repository.save(workspace, 0);
    const recordId = workspace.records[0].id;
    for (const command of [(value: typeof workspace) => registerHistoricalPaper(value, recordId), (value: typeof workspace) => createHistoricalNotification(value, recordId), (value: typeof workspace) => markHistoricalNotificationRead(value, value.notifications[0].id), (value: typeof workspace) => dismissHistoricalNotification(value, value.notifications[0].id)]) {
      const previousRevision = workspace.revision; workspace = command(workspace); await repository.save(workspace, previousRevision);
    }
    expect(await createDemoHistoricalRepository().load()).toEqual(workspace);
    const revised = structuredClone(workspace); revised.revision++; revised.records[0].snapshot.odds = 2;
    await expect(repository.save(revised, workspace.revision)).rejects.toThrow('immutable');
    const removedAudit = structuredClone(workspace); removedAudit.revision++; removedAudit.audit.shift();
    await expect(repository.save(removedAudit, workspace.revision)).rejects.toThrow('immutable');
    expect(await repository.load()).toEqual(workspace);
  });
  it('reports corrupt stored sources and write errors without silently discarding history', async () => {
    const { values, localStorage } = browserStorage(); const { createDemoHistoricalRepository, HISTORY_DEMO_STORAGE_KEY } = await import('@/lib/imports/repository');
    values.set(HISTORY_DEMO_STORAGE_KEY, '{bad'); await expect(createDemoHistoricalRepository().load()).rejects.toMatchObject({ code: 'INVALID_DATA' }); expect(localStorage.setItem).not.toHaveBeenCalled();
    values.delete(HISTORY_DEMO_STORAGE_KEY); const repository = createDemoHistoricalRepository(); await repository.load(); localStorage.setItem.mockImplementation(() => { throw new Error('quota'); });
    await expect(repository.save(await imported('synthetic'), 0)).rejects.toMatchObject({ code: 'STORAGE_UNAVAILABLE' }); expect(values.has(HISTORY_DEMO_STORAGE_KEY)).toBe(false);
  });
  it('does not import private records into demo or allow save before load', async () => {
    browserStorage(); const { createDemoHistoricalRepository } = await import('@/lib/imports/repository'); const repository = createDemoHistoricalRepository();
    await expect(repository.save(await imported('synthetic'), 0)).rejects.toMatchObject({ code: 'CONFLICT' }); await repository.load();
    await expect(repository.save(await imported('unverified'), 0)).rejects.toMatchObject({ code: 'INVALID_DATA' });
  });
});

describe('historical private persistence', () => {
  it('validates current ownership on reads and writes and propagates explicit revisions atomically', async () => {
    const { createSupabaseHistoricalRepository } = await import('@/lib/imports/repository'); const repository = createSupabaseHistoricalRepository(userId); const next = await imported('unverified');
    await expect(repository.save(next, 0)).rejects.toMatchObject({ code: 'CONFLICT' }); expect(mock.getUser).not.toHaveBeenCalled();
    mock.rpc.mockResolvedValueOnce({ data: emptyHistoricalWorkspace(), error: null }); expect(await repository.load()).toEqual(emptyHistoricalWorkspace());
    expect(mock.rpc).toHaveBeenLastCalledWith('edgelab_load_history', { expected_owner_id: userId });
    mock.rpc.mockResolvedValueOnce({ data: 1, error: null }); await repository.save(next, 0);
    expect(mock.rpc).toHaveBeenLastCalledWith('edgelab_save_history', { workspace: next, expected_revision: 0, expected_owner_id: userId }); expect(mock.getUser).toHaveBeenCalledTimes(2);
    const alert = createHistoricalNotification(next, next.records[0].id); mock.rpc.mockResolvedValueOnce({ data: 2, error: null }); await repository.save(alert, 1);
    expect(mock.rpc).toHaveBeenLastCalledWith('edgelab_save_history', { workspace: alert, expected_revision: 1, expected_owner_id: userId });
  });
  it('rejects synthetic demo imports before performing any hosted save and never touches browser storage', async () => {
    const { localStorage } = browserStorage(); const { createSupabaseHistoricalRepository } = await import('@/lib/imports/repository'); const repository = createSupabaseHistoricalRepository(userId);
    mock.rpc.mockResolvedValueOnce({ data: emptyHistoricalWorkspace(), error: null }); await repository.load(); mock.rpc.mockClear();
    await expect(repository.save(await imported('synthetic'), 0)).rejects.toMatchObject({ code: 'INVALID_DATA' }); expect(mock.rpc).not.toHaveBeenCalled(); expect(localStorage.setItem).not.toHaveBeenCalled();
  });
  it('rejects an expired or switched session and does not call a persistence RPC', async () => {
    const { createSupabaseHistoricalRepository } = await import('@/lib/imports/repository');
    mock.getUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'expired' } });
    await expect(createSupabaseHistoricalRepository(userId).load()).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
    mock.getUser.mockResolvedValueOnce({ data: { user: { id: '00000000-0000-4000-8000-000000000002' } }, error: null });
    await expect(createSupabaseHistoricalRepository(userId).load()).rejects.toMatchObject({ code: 'AUTH_REQUIRED' }); expect(mock.rpc).not.toHaveBeenCalled();
  });
  it('rechecks identity after load before submitting an authenticated import', async () => {
    const { createSupabaseHistoricalRepository } = await import('@/lib/imports/repository'); const repository = createSupabaseHistoricalRepository(userId);
    mock.rpc.mockResolvedValueOnce({ data: emptyHistoricalWorkspace(), error: null }); await repository.load(); mock.rpc.mockClear(); mock.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    await expect(repository.save(await imported('unverified'), 0)).rejects.toMatchObject({ code: 'AUTH_REQUIRED' }); expect(mock.rpc).not.toHaveBeenCalled();
  });
  it('binds RPCs to the captured account when the SDK session switches after getUser', async () => {
    const { createSupabaseHistoricalRepository } = await import('@/lib/imports/repository'); const repository = createSupabaseHistoricalRepository(userId);
    // The SQL guard verifies expected_owner_id against the token actually used by
    // the RPC, closing the interval after the earlier SDK identity check.
    mock.rpc.mockResolvedValueOnce({ data: null, error: { message: 'Authenticated historical owner changed; reload before accessing history' } });
    await expect(repository.load()).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
    expect(mock.rpc).toHaveBeenLastCalledWith('edgelab_load_history', { expected_owner_id: userId });
    mock.rpc.mockResolvedValueOnce({ data: emptyHistoricalWorkspace(), error: null }); await repository.load();
    const next = await imported('unverified');
    mock.rpc.mockResolvedValueOnce({ data: null, error: { message: 'Authenticated historical owner changed; reload before accessing history' } });
    await expect(repository.save(next, 0)).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
    expect(mock.rpc).toHaveBeenLastCalledWith('edgelab_save_history', { workspace: next, expected_revision: 0, expected_owner_id: userId });
  });
  it('reports the pending migration without falling back to demo or changing local history', async () => {
    const { localStorage } = browserStorage(); const { createSupabaseHistoricalRepository } = await import('@/lib/imports/repository');
    mock.rpc.mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.edgelab_load_history' } });
    await expect(createSupabaseHistoricalRepository(userId).load()).rejects.toMatchObject({ code: 'NEW_MIGRATION_REQUIRED' }); expect(localStorage.setItem).not.toHaveBeenCalled(); expect(localStorage.getItem).not.toHaveBeenCalled();
  });
  it('preserves its earlier revision after a conflict and rejects malformed remote payloads', async () => {
    const { createSupabaseHistoricalRepository } = await import('@/lib/imports/repository'); const repository = createSupabaseHistoricalRepository(userId);
    mock.rpc.mockResolvedValueOnce({ data: emptyHistoricalWorkspace(), error: null }); await repository.load(); const next = await imported('unverified');
    mock.rpc.mockResolvedValueOnce({ data: null, error: { message: 'Historical workspace revision conflict; reload before saving' } }); await expect(repository.save(next, 0)).rejects.toMatchObject({ code: 'CONFLICT' });
    mock.rpc.mockResolvedValueOnce({ data: 1, error: null }); await repository.save(next, 0); expect(mock.rpc).toHaveBeenLastCalledWith('edgelab_save_history', { workspace: next, expected_revision: 0, expected_owner_id: userId });
    mock.rpc.mockResolvedValueOnce({ data: { ...emptyHistoricalWorkspace(), records: [null] }, error: null }); await expect(repository.load()).rejects.toMatchObject({ code: 'INVALID_DATA' });
  });
  it('does not claim success for an invalid revision response or opaque storage error', async () => {
    const { createSupabaseHistoricalRepository } = await import('@/lib/imports/repository'); const repository = createSupabaseHistoricalRepository(userId);
    mock.rpc.mockResolvedValueOnce({ data: emptyHistoricalWorkspace(), error: null }); await repository.load(); const next = await imported('unverified');
    mock.rpc.mockResolvedValueOnce({ data: null, error: { code: '23505', message: 'sensitive source content must not leak through generic storage errors' } });
    await expect(repository.save(next, 0)).rejects.toMatchObject({ code: 'STORAGE_UNAVAILABLE', message: expect.not.stringContaining('sensitive source') });
    mock.rpc.mockResolvedValueOnce({ data: 8, error: null }); await expect(repository.save(next, 0)).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});
