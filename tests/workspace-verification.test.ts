import { describe, expect, it, vi } from 'vitest';
import { createEmptyData } from '@/lib/domain/fixtures';
import { emptyHistoricalWorkspace } from '@/lib/imports/types';
import { verifyPersonalWorkspace, assertSettingsReadback } from '@/lib/workspace-verification';

const owner = 'SYNTHETIC-owner-only-local';
const secret = 'SYNTHETIC-SECRET-MUST-NOT-APPEAR';
function setup() {
  const actual = createEmptyData();
  const history = emptyHistoricalWorkspace();
  const getUser = vi.fn().mockResolvedValue({ data: { user: { id: owner, email: secret } }, error: null });
  const loadActual = vi.fn().mockResolvedValue(actual);
  const loadHistory = vi.fn().mockResolvedValue(history);
  return { actual, history, getUser, loadActual, loadHistory, input: { mode: 'supabase' as const, expectedUserId: owner, getUser, loadActual, loadHistory, now: new Date('2026-11-04T00:00:00Z') } };
}

describe('read-only personal workspace verification', () => {
  it('reads both normal-user workspaces and exports only sanitized settings/counts', async () => {
    const t = setup(); const before = structuredClone(t.actual);
    const report = await verifyPersonalWorkspace(t.input);
    expect(report.status).toBe('passed'); expect(report.code).toBe('read_access_verified');
    expect(report.normalUserIdentityVerified).toBe(true); expect(report.writesPerformed).toBe(0);
    expect(report.settings).toEqual(t.actual.settings); expect(report.settingsStored).toBe(true);
    expect(report.recordedDepositsCents).toBe(0); expect(report.counts?.historyRevision).toBe(0);
    expect(t.getUser).toHaveBeenCalledTimes(2); expect(t.loadActual).toHaveBeenCalledTimes(1); expect(t.loadHistory).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(report)).not.toContain(owner); expect(JSON.stringify(report)).not.toContain(secret);
    expect(t.actual).toEqual(before); expect(report.unverified.length).toBe(3);
  });
  it('does not turn a missing settings record into a persisted A$500 bankroll', async () => {
    const t = setup(); t.loadActual.mockResolvedValue(null);
    const report = await verifyPersonalWorkspace(t.input);
    expect(report.status).toBe('passed'); expect(report.settingsStored).toBe(false);
    expect(report.settings).toBeNull(); expect(report.recordedDepositsCents).toBe(0);
  });
  it('reports only explicit deposit records without inferring funding from the cap or withdrawals', async () => {
    const t = setup();
    t.actual.transactions.push({ id: 'SYNTHETIC deposit', kind: 'deposit', amountCents: 123, createdAt: t.input.now.toISOString(), note: secret }, { id: 'SYNTHETIC withdrawal', kind: 'withdrawal', amountCents: 50, createdAt: t.input.now.toISOString(), note: secret });
    const report = await verifyPersonalWorkspace(t.input);
    expect(report.recordedDepositsCents).toBe(123); expect(report.counts?.fundingTransactions).toBe(2);
    expect(report.settings?.fundingCapCents).toBe(50000); expect(JSON.stringify(report)).not.toContain(secret);
  });
  it.each(['demo', 'supabase'] as const)('rejects %s without a private expected identity before contacting repositories', async mode => {
    const t = setup(); const report = await verifyPersonalWorkspace({ ...t.input, mode, expectedUserId: mode === 'demo' ? owner : null });
    expect(report.code).toBe('private_workspace_required'); expect(report.status).toBe('failed');
    expect(t.getUser).not.toHaveBeenCalled(); expect(t.loadActual).not.toHaveBeenCalled(); expect(t.loadHistory).not.toHaveBeenCalled();
  });
  it.each([
    { data: { user: null }, error: null },
    { data: { user: { id: 'SYNTHETIC-other-account' } }, error: null },
    { data: { user: { id: owner } }, error: { message: secret } },
  ])('rejects invalid/revoked or changed normal identities without loading private data', async auth => {
    const t = setup(); t.getUser.mockResolvedValue(auth);
    const report = await verifyPersonalWorkspace(t.input);
    expect(report.code).toBe('session_unavailable_or_changed'); expect(report.counts).toBeNull();
    expect(t.loadActual).not.toHaveBeenCalled(); expect(t.loadHistory).not.toHaveBeenCalled();
    expect(JSON.stringify(report)).not.toContain(secret);
  });
  it('discards both read results when the identity changes during the requests', async () => {
    const t = setup(); t.getUser.mockResolvedValueOnce({ data: { user: { id: owner } }, error: null }).mockResolvedValueOnce({ data: { user: { id: 'SYNTHETIC-other' } }, error: null });
    const report = await verifyPersonalWorkspace(t.input);
    expect(report.code).toBe('session_unavailable_or_changed'); expect(report.settings).toBeNull(); expect(report.counts).toBeNull();
    expect(t.loadActual).toHaveBeenCalledTimes(1); expect(t.loadHistory).toHaveBeenCalledTimes(1);
  });
  it.each(['actual', 'history'])('sanitizes failed %s reads without claiming a save or partial success', async failed => {
    const t = setup(); (failed === 'actual' ? t.loadActual : t.loadHistory).mockRejectedValue(new Error(secret));
    const report = await verifyPersonalWorkspace(t.input);
    expect(report.code).toBe('workspace_read_failed'); expect(report.status).toBe('failed'); expect(report.counts).toBeNull();
    expect(report.writesPerformed).toBe(0); expect(JSON.stringify(report)).not.toContain(secret);
  });
  it('sanitizes a rejected identity request', async () => {
    const t = setup(); t.getUser.mockRejectedValue(new Error(secret));
    const report = await verifyPersonalWorkspace(t.input);
    expect(report.code).toBe('session_unavailable_or_changed'); expect(JSON.stringify(report)).not.toContain(secret);
    expect(t.loadActual).not.toHaveBeenCalled();
  });
});


describe('settings save read-back confirmation',()=>{
 it('accepts exact stored values without interpreting a cap as a deposit',()=>{const data=createEmptyData();expect(()=>assertSettingsReadback(data.settings,data)).not.toThrow();expect(data.transactions).toEqual([]);});
 it('rejects an acknowledged write that is absent on reload',()=>{expect(()=>assertSettingsReadback(createEmptyData().settings,null)).toThrow('could not be confirmed');});
 it('requires the appended settings audit when checking an unchanged save',()=>{const data=createEmptyData();expect(()=>assertSettingsReadback(data.settings,data,1)).toThrow('could not be confirmed');data.audit.push({id:crypto.randomUUID(),entityType:'settings',entityId:'experiment',action:'updated',timestamp:new Date().toISOString(),before:data.settings,after:data.settings});expect(()=>assertSettingsReadback(data.settings,data,1)).not.toThrow();});
 it.each(['fundingCapCents','defaultStakeCents','currency','timezone'] as const)('rejects a mismatching saved %s',key=>{const data=createEmptyData();const wrong=structuredClone(data);Object.assign(wrong.settings,{[key]:typeof data.settings[key]==='number'?123:'incorrect'});expect(()=>assertSettingsReadback(data.settings,wrong)).toThrow('could not be confirmed');});
});
