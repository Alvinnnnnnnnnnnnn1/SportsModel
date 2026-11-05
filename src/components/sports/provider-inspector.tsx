'use client';
import { useRef, useState } from 'react';
import { useHistory } from '../history-provider';
import { prepareSportsBindings } from '@/lib/sports/bindings';
import { useApp } from '../app-provider';
import { getSupabaseClient } from '@/lib/persistence';
import { Button } from '../ui/button';
import { providerBindingsSchema, proposeProviderSettlement } from '@/lib/sports/grading';
import type { QuotaStatus, SportsProviderId, SportsSnapshot } from '@/lib/sports/types';
import type { SettlementResponse, SettlementTarget } from '@/lib/results';
export function ProviderInspector({ targets, onProposal }: { targets: SettlementTarget[]; onProposal: (response: SettlementResponse) => void }) {
  const { mode, user } = useApp(); const archived = useHistory();
  const [provider, setProvider] = useState<SportsProviderId>('thesportsdb'); const [operation, setOperation] = useState('arsenal');
  const [parameters, setParameters] = useState('{}'); const [snapshot, setSnapshot] = useState<SportsSnapshot>(); const [quota, setQuota] = useState<QuotaStatus>();
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const controller = useRef<AbortController | null>(null);
  const [targetKey, setTargetKey] = useState(''); const [bindings, setBindings] = useState('[]'); const [identityConfirmed, setIdentityConfirmed] = useState(false);
  const inspect = async () => {
    if (mode !== 'supabase' || !user) return;
    setBusy(true); setError(''); controller.current = new AbortController();
    try {
      const p: unknown = JSON.parse(parameters); const client = getSupabaseClient();
      if (!client) throw new Error('Private workspace is unavailable.');
      const session = await client.auth.getSession(); if (session.error || !session.data.session) throw new Error('Sign into your existing private workspace.');
      const result = await fetch('/api/sports', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.data.session.access_token}` }, body: JSON.stringify({ provider, operation, parameters: p }), signal: controller.current.signal });
      const value = await result.json(); if (!result.ok) throw new Error(value.error ?? 'Provider inspection failed.');
      setSnapshot(value.snapshot); setQuota(value.quota); setIdentityConfirmed(false);
    } catch (reason) { setSnapshot(undefined); setError(reason instanceof Error ? reason.message : 'Provider inspection failed.'); }
    finally { setBusy(false); }
  };
  const propose = () => {
    setError('');
    try {
      const target = targets.find(t => t.key === targetKey); if (!target || !snapshot) throw new Error('Choose a pending position and inspect matching player statistics first.');
      const mapped = providerBindingsSchema.parse(JSON.parse(bindings));
      const result = proposeProviderSettlement(target, snapshot.observations, mapped, identityConfirmed);
      if (!result.observation) throw new Error(result.unresolved.join(' '));
      onProposal({ format: 'edgelab.settlement-response', version: 1, id: `provider-review-${crypto.randomUUID()}`, createdAt: new Date().toISOString(), observations: [result.observation] });
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Provider result could not be proposed.'); }
  };
  const saveMappings = async () => {
    setBusy(true); setError('');
    try {
      const target = targets.find(t => t.key === targetKey); if (!target || !snapshot || !identityConfirmed) throw new Error('Review the exact target and provider observations first.');
      const mapped = providerBindingsSchema.parse(JSON.parse(bindings));
      const checked = proposeProviderSettlement(target, snapshot.observations, mapped, true);
      if (!checked.observation) throw new Error(checked.unresolved.join(' '));
      const preview = await prepareSportsBindings(target, mapped, archived.history, mode);
      if (preview) await archived.commitPreview(preview, preview.rows.map(row => ({ rowNumber: row.rowNumber, include: true, acknowledgeIncomplete: true, allowProbableDuplicate: false })), mode === 'demo' ? 'synthetic' : 'user_confirmed');
      setError(preview ? 'Reviewed identity mapping saved with an audit record. Check Results can reuse it; no outcome was saved.' : 'The same reviewed identity mapping is already saved.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Identity mapping could not be saved.'); }
    finally { setBusy(false); }
  };
  return <details className="rounded-lg border border-border p-4"><summary className="cursor-pointer text-xs">Optional sports-data inspection · manual, read only</summary><div className="mt-4 space-y-3 text-xs">
    <p className="text-muted-foreground">Disabled until configured for a local single-process server. No polling. API-NBA and NBL coverage are unverified. ATP/WTA use manual source review. This tool never saves a result or financial record.</p>
    {mode === 'demo' ? <p>Demo uses synthetic/manual results only. Live provider requests require your private workspace.</p> : <>
      <label className="block">Sports provider<select aria-label="Sports provider" className="input mt-1" value={provider} onChange={e => { const next = e.target.value as SportsProviderId; setProvider(next); setOperation(next === 'thesportsdb' ? 'arsenal' : 'status'); setSnapshot(undefined); setQuota(undefined); }}><option value="thesportsdb">TheSportsDB free v1</option><option value="api-nba">API-NBA</option><option value="api-basketball">API-Basketball</option></select></label>
      <label className="block">Read operation<select aria-label="Sports read operation" className="input mt-1" value={operation} onChange={e => setOperation(e.target.value)}>{(provider === 'thesportsdb' ? ['arsenal', 'leagues', 'fixtures', 'past_fixtures', 'event', 'event_stats'] : ['status', 'leagues', 'seasons', 'games', 'teams', 'players', 'player_stats', 'team_stats', ...(provider === 'api-nba' ? ['season_team_stats'] : []), 'standings']).map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      <label className="block">Provider parameters JSON<textarea aria-label="Sports provider parameters" className="input mt-1 font-mono" value={parameters} onChange={e => setParameters(e.target.value)} /></label>
      <Button size="sm" disabled={busy || !user} onClick={() => void inspect()}>{busy ? 'Inspecting…' : 'Inspect provider · read only'}</Button>{busy && <Button size="sm" variant="outline" onClick={() => controller.current?.abort()}>Cancel provider request</Button>}
      {quota && <p>UTC day {quota.utcDay} · app requests {quota.used}/{quota.dayBudget ?? 'no daily app cap'} · minute {quota.minuteUsed}/{quota.minuteBudget} · provider remaining daily {quota.remainingDaily ?? 'unknown'}, minute {quota.remainingMinute ?? 'unknown'} · last success {quota.lastSuccess ?? 'none'} · {snapshot?.cached ? 'cached response' : 'fresh request'}</p>}
      {snapshot && <><p>{snapshot.warnings.join(' ')}</p><pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all text-[10px]">{JSON.stringify(snapshot, null, 2)}</pre>
        <label className="block">Propose results for<select aria-label="Provider result position" className="input" value={targetKey} onChange={e => setTargetKey(e.target.value)}><option value="">Choose pending position</option>{targets.filter(t => t.eligible && !t.settled).map(t => <option key={t.key} value={t.key}>{t.key} · {t.selection}</option>)}</select></label>
        <p>Exact leg IDs: {targets.find(t => t.key === targetKey)?.legs.map(l => l.legId).join(', ') ?? 'choose a position'}. Bind with {`[{"legId":"UUID","provider":"${provider}","eventId":"provider game ID","playerId":"provider player ID"}]`}. Inspect games before player_stats. Names and fixture start times must match exactly; unresolved mappings stay manual.</p>
        <textarea aria-label="Provider identity bindings" className="input font-mono" value={bindings} onChange={e => setBindings(e.target.value)} />
        <label className="flex gap-2"><input type="checkbox" checked={identityConfirmed} onChange={e => setIdentityConfirmed(e.target.checked)} />I checked exact fixture, player and date identities.</label>
        <p>Saving mappings explicitly archives these reviewed identities and an audit entry, without settling the position.</p><Button size="sm" variant="outline" disabled={!identityConfirmed || busy} onClick={() => void saveMappings()}>Save reviewed provider identities</Button><Button size="sm" variant="outline" disabled={!identityConfirmed || busy} onClick={propose}>Prepare result proposal · no save</Button><p>After proposal, supply actual payout when applicable and confirm settlement terms in the result editor. Only the final batch confirmation can persist it.</p>
      </>}
    </>}{error && <p role="alert" className="text-amber-200">{error}</p>}
  </div></details>;
}
