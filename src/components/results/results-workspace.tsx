'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { CheckCheck, Clipboard, Download, RefreshCw, ShieldCheck } from 'lucide-react';
import { ZodError } from 'zod';
import { useApp } from '../app-provider';
import { useHistory } from '../history-provider';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { money, dateTime, signedMoney } from '@/lib/utils';
import { buildSettlementTargets, historicalSettlementExclusions, generateResultsCheckPrompt, parseSettlementResponse, reviewSettlementResponse, settlementObservationSchema, settlementResponseJsonSchema, type SettlementResponse, type SettlementReview, type SettlementTarget } from '@/lib/results';
import { getSupabaseClient } from '@/lib/persistence';
import { checkBoundSportsResults } from '@/lib/sports/check-results';
import { manualFallbackResultProvider } from '@/lib/results/providers';
import { ProviderInspector } from '../sports/provider-inspector';
import { draftFromObservation, emptyResultDraft, observationFromDraft, ResultEntry, type ResultEntryDraft } from './result-entry';

const GROUPS = ['Ready for review', 'Awaiting external result', 'Missing or ambiguous evidence', 'Ready for owner correction', 'Already settled'] as const;
type Group = typeof GROUPS[number];
type FrozenReview = { review: SettlementReview; keys: string[] };
function message(reason: unknown): string {
  if (reason instanceof ZodError) return `${reason.issues[0]?.path.join('.') || 'Result'}: ${reason.issues[0]?.message ?? 'Invalid response'}${reason.issues.length > 1 ? ` (${reason.issues.length} fields require review)` : ''}`;
  return reason instanceof Error ? reason.message : 'The results could not be reviewed.';
}
function download(name: string, value: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Key all transient source/result drafts by identity. No private draft crosses an account or Demo switch. */
export function ResultsWorkspace() {
  const { mode, user } = useApp();
  return <ResultsWorkspaceBody key={mode === 'demo' ? 'demo' : user?.id ?? 'signed-out'} />;
}

function ResultsWorkspaceBody() {
  const app = useApp(); const archived = useHistory();
  const { data, mode } = app; const { history } = archived;
  const unavailable = app.loading || archived.loading || !!app.error || !!archived.error || (mode === 'supabase' && !app.user);
  const [targetState, setTargetState] = useState<{ data: typeof data; history: typeof history; targets: SettlementTarget[] }>();
  const targets = useMemo(() => targetState?.data === data && targetState.history === history ? targetState.targets : [], [targetState, data, history]);
  const loadingTargets = !unavailable && !targetState || (!unavailable && (targetState?.data !== data || targetState?.history !== history));
  const [drafts, setDrafts] = useState<Record<string, ResultEntryDraft>>({});
  const [manualId, setManualId] = useState(() => crypto.randomUUID());
  const [importText, setImportText] = useState(''); const [importResponse, setImportResponse] = useState<SettlementResponse>();
  const [importMode, setImportMode] = useState(false); const [retry, setRetry] = useState<{ response: SettlementResponse; keys: string[] }>();
  const [reviewState, setReviewState] = useState<{ response: SettlementResponse; data: typeof data; history: typeof history; review: SettlementReview }>();
  const [selected, setSelected] = useState<string[]>([]); const [frozen, setFrozen] = useState<FrozenReview>();
  const [confirmed, setConfirmed] = useState(false); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(''); const [technicalError, setTechnicalError] = useState('');
  const [providerNotice, setProviderNotice] = useState(''); const [prompt, setPrompt] = useState('');
  const [success, setSuccess] = useState(''); const [checking, setChecking] = useState(false);
  const fileVersion = useRef(0); const reviewVersion = useRef(0);
  const exclusions = useMemo(() => historicalSettlementExclusions(data, history), [data, history]);

  useEffect(() => {
    let active = true;
    if (!unavailable) void buildSettlementTargets(data, history).then(value => { if (active) setTargetState({ data, history, targets: value }); }).catch(reason => { if (active) setError(message(reason)); });
    return () => { active = false; };
  }, [data, history, unavailable]);

  const manual = useMemo(() => {
    const observations: SettlementResponse['observations'] = [], issues: Record<string, string[]> = {};
    if (!importMode && !retry) for (const target of targets) {
      const draft = drafts[target.key];
      if (!draft?.started || draft.identityHash !== target.identityHash || target.settled || !target.eligible) continue;
      try {
        const parsed = settlementObservationSchema.safeParse(observationFromDraft(target, draft));
        if (parsed.success) observations.push(parsed.data); else issues[target.key] = parsed.error.issues.map(issue => `${issue.path.join('.') || 'Result'}: ${issue.message}`);
      } catch (reason) { issues[target.key] = [message(reason)]; }
    }
    return { response: observations.length ? { format: 'edgelab.settlement-response' as const, version: 1 as const, id: manualId, createdAt: new Date().toISOString(), observations } : undefined, issues };
  }, [targets, drafts, manualId, importMode, retry]);
  const response = retry?.response ?? (importMode ? importResponse : manual.response);
  const review = reviewState && reviewState.response === response && reviewState.data === data && reviewState.history === history ? reviewState.review : undefined;

  useEffect(() => {
    const epoch = ++reviewVersion.current;
    let active = true;
    if (!response || unavailable) return;
    const timeout = setTimeout(() => {
      void reviewSettlementResponse({ response, appData: data, history, mode }).then(result => {
        if (active && epoch === reviewVersion.current) setReviewState({ response, data, history, review: result });
      }).catch(reason => { if (active && epoch === reviewVersion.current) { setError(message(reason)); setTechnicalError(reason instanceof Error ? reason.message : ''); } });
    }, 180);
    return () => { active = false; clearTimeout(timeout); };
  }, [response, data, history, mode, unavailable]);

  const rowsByKey = new Map(review?.rows.map(row => [row.key, row]) ?? []);
  const readyRows = review?.rows.filter(row => row.eligible && !row.alreadyApplied) ?? [];
  const selectedRows = readyRows.filter(row => selected.includes(row.key));
  const readyKeys = readyRows.map(row => row.key);
  const importedRows = new Map((retry?.response ?? importResponse)?.observations.map(row => [`${row.kind}:${row.recordId}`, row]) ?? []);
  const queue = targets.filter(target => target.kind !== 'historical_paper' || target.eligible).map(target => {
    const row = rowsByKey.get(target.key), localIssues = manual.issues[target.key] ?? [];
    let group: Group = 'Awaiting external result';
    if (target.settled || row?.alreadyApplied) group = 'Already settled';
    else if (!target.eligible) group = 'Missing or ambiguous evidence';
    else if (row?.eligible) group = 'Ready for review';
    else if (localIssues.length || row?.issues.length) group = importedRows.has(target.key) ? 'Ready for owner correction' : 'Missing or ambiguous evidence';
    return { target, row, localIssues, group };
  });

  function problem(reason: unknown) { setError(message(reason)); setTechnicalError(reason instanceof Error ? reason.message : ''); }
  function clearProposals() {
    ++fileVersion.current; ++reviewVersion.current;
    setImportMode(false); setImportResponse(undefined); setRetry(undefined); setReviewState(undefined); setDrafts({}); setSelected([]); setFrozen(undefined); setConfirmed(false); setImportText(''); setManualId(crypto.randomUUID()); setError(''); setTechnicalError('');
  }
  async function importResults(text = importText) {
    setImportMode(true); setImportResponse(undefined); setSelected([]); setSuccess(''); setError(''); setTechnicalError('');
    try { const value = parseSettlementResponse(text); setImportResponse(value); }
    catch (reason) { problem(reason); }
  }
  async function fileResults(file?: File) {
    const epoch = ++fileVersion.current; if (!file) return;
    setError(''); setTechnicalError('');
    try {
      if (file.size > 1048576 || !file.name.toLowerCase().endsWith('.json')) throw new Error('Choose a results JSON file up to 1 MiB.');
      const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(await file.arrayBuffer());
      if (epoch !== fileVersion.current) return;
      setImportText(text); await importResults(text);
    } catch (reason) { if (epoch === fileVersion.current) { setImportMode(true); setImportResponse(undefined); problem(reason); } }
  }
  async function checkResults() {
    setChecking(true); setError('');
    try {
      await Promise.all([app.refresh(), archived.refresh()]);
      const currentHistory = archived.readCurrentHistory();
      const currentTargets = await buildSettlementTargets(app.readCurrentData(), currentHistory);
      const client = mode === 'supabase' ? getSupabaseClient() : null;
      const checked = client ? await checkBoundSportsResults(currentTargets, currentHistory, async request => {
        const session = await client.auth.getSession(); if (session.error || !session.data.session) throw new Error('The private session changed.');
        const response = await fetch('/api/sports', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.data.session.access_token}` }, body: JSON.stringify(request) });
        const read = await response.json(); if (!response.ok) throw new Error(read.error ?? 'Provider lookup failed.'); return read.snapshot;
      }) : await manualFallbackResultProvider.check(currentTargets.filter(t => t.eligible && !t.settled));
      if (checked.observations.length && !importMode && !retry) {
        setSelected([]); setFrozen(undefined); setManualId(crypto.randomUUID());
        setDrafts(old => ({ ...old, ...Object.fromEntries(checked.observations.flatMap(observation => { const target = currentTargets.find(t => t.key === `${observation.kind}:${observation.recordId}`); return target && !old[target.key]?.started ? [[target.key, draftFromObservation(target, observation)]] : []; })) }));
      }
      setProviderNotice(`Outstanding records refreshed · ${dateTime(checked.checkedAt)}. ${checked.observations.length} provider proposals available; existing drafts/imports retained, no outcomes saved. ${checked.unresolved.map(item => item.reason).join(' ')} Review terms and actual payouts before final batch confirmation.`);
    } catch (reason) { problem(reason); }
    finally { setChecking(false); }
  }
  function openReview() {
    if (!review || !selectedRows.length || selectedRows.length !== selected.length || unavailable) return;
    setFrozen({ review, keys: [...selected] }); setConfirmed(false); setError('');
  }
  async function saveBatch() {
    if (!frozen || !confirmed || busy || unavailable) return;
    const pendingRows = frozen.review.rows.filter(row => frozen.keys.includes(row.key));
    if (!pendingRows.length || pendingRows.some(row => !row.eligible || row.alreadyApplied)) return;
    const appKeys = pendingRows.filter(row => row.kind !== 'historical_paper').map(row => row.key);
    const historyKeys = pendingRows.filter(row => row.kind === 'historical_paper').map(row => row.key);
    const applied: string[] = [], remaining: string[] = [...frozen.keys];
    setBusy(true); setError(''); setSuccess('');
    try {
      if (appKeys.length) {
        const saved = await app.applyResultBatch(frozen.review.response, appKeys, history);
        applied.push(...saved.applied, ...saved.alreadyApplied);
        for (const key of appKeys) remaining.splice(remaining.indexOf(key), 1);
      }
      if (historyKeys.length) {
        const saved = await archived.applyResultBatch(frozen.review.response, historyKeys);
        applied.push(...saved.applied, ...saved.alreadyApplied);
        for (const key of historyKeys) remaining.splice(remaining.indexOf(key), 1);
      }
      setSuccess(`${applied.length} reviewed result${applied.length === 1 ? '' : 's'} persisted. Ledger, paper analytics and the next research handoff now use the updated records.`);
      clearProposals(); app.notify('Reviewed settlement batch saved · authoritative analytics updated');
    } catch (reason) {
      if (applied.length) {
        setRetry({ response: frozen.review.response, keys: remaining }); setSelected(remaining); setFrozen(undefined); setConfirmed(false);
        setSuccess(`${applied.length} result${applied.length === 1 ? '' : 's'} persisted; ${remaining.length} remain unsaved. Saved results were not rolled back or duplicated. Review and retry only the remaining records.`);
      }
      problem(reason);
    } finally { setBusy(false); }
  }

  const pendingEligible = targets.filter(target => target.eligible && !target.settled);
  return <section className="space-y-5" aria-label="Results workspace">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-medium">Results review</h3><p className="mt-2 max-w-3xl text-xs leading-relaxed text-muted-foreground">Registered actual and eligible paper positions, prefilled in one queue. Review source evidence or explicitly attest a result, then confirm the eligible selections once. Historical claims remain separate.</p></div><Button disabled={unavailable || checking || busy} onClick={() => void checkResults()}><RefreshCw className={checking ? 'animate-spin' : ''} />{checking ? 'Refreshing…' : 'Check Results'}</Button></div>
    <p className="rounded-lg border border-border p-3 text-[11px] leading-relaxed text-muted-foreground">Check Results refreshes registered positions and may inspect explicitly saved provider identities when locally enabled. Unsupported or missing coverage remains manual; no result is automatically saved. Manual evidence and ChatGPT responses remain owner-attested or source-supplied, never independently verified by EdgeLab.</p>
    <ProviderInspector targets={targets} onProposal={value => {
      clearProposals();
      setDrafts(Object.fromEntries(value.observations.flatMap(observation => { const target = targets.find(t => t.key === `${observation.kind}:${observation.recordId}`); return target ? [[target.key, draftFromObservation(target, observation)]] : []; })));
      setProviderNotice('Provider proposal loaded in the result editor. Review evidence, confirm exact settlement terms and enter actual ticket payout if applicable before batch confirmation.');
    }} />
    {providerNotice && <p role="status" className="text-xs text-primary">{providerNotice}</p>}
    {unavailable && <p role="alert" className="text-xs text-amber-200">{app.error ?? archived.error ?? 'Wait for the authenticated workspace to load before reviewing results.'}</p>}
    {success && <div role="status" className="rounded-lg border border-primary/20 p-4 text-xs text-primary">{success}<div className="mt-3 flex flex-wrap gap-3"><Link href="/ledger" className="underline">Betting Ledger</Link><Link href="/paper" className="underline">Paper Tracking</Link><Link href="/analytics" className="underline">Analytics</Link></div></div>}
    {retry && <p className="rounded-lg border border-amber-200/20 p-3 text-xs text-amber-200">Partial save retained. The existing repositories are individually transactional; actual/core-paper and historical-paper writes use separate transactions. Retry the remaining reviewed records or clear only the unsaved proposals.</p>}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{GROUPS.map(group => <div key={group} className="rounded-lg border border-border p-3"><p className="text-[10px] text-muted-foreground">{group}</p><p className="mt-2 text-lg">{queue.filter(row => row.group === group).length}</p></div>)}</div>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3"><div className="flex flex-wrap items-center gap-2"><Button size="sm" variant="outline" disabled={!readyRows.length || busy || unavailable} onClick={() => setSelected(readyKeys)}>Select all ready outcomes</Button><Button size="sm" variant="ghost" disabled={busy} onClick={() => setSelected([])}>Deselect all</Button><span className="text-xs text-muted-foreground">{selectedRows.length} eligible results selected</span></div><Button disabled={!selectedRows.length || selectedRows.length !== selected.length || busy || unavailable} onClick={openReview}><ShieldCheck />Review selected settlements</Button></div>
    {loadingTargets ? <p className="text-xs text-muted-foreground">Loading registered positions…</p> : !queue.length && !unavailable ? <div className="rounded-lg border border-dashed border-border p-5 text-xs text-muted-foreground">No registered actual or eligible paper positions are available for daily result review. Approve a new paper selection or confirm a manually placed wager first. Archived historical claims and papers without pre-event registration remain separate.</div> : null}
    {GROUPS.map(group => {
      const entries = queue.filter(row => row.group === group); if (!entries.length) return null;
      return <details key={group} className="rounded-xl border border-border p-4" open={group !== 'Already settled'}><summary className="cursor-pointer text-sm font-medium">{group} ({entries.length})</summary><div className="mt-4 space-y-4">{entries.map(({ target, row, localIssues }) => {
        const draft = drafts[target.key]?.identityHash === target.identityHash ? drafts[target.key] : emptyResultDraft(target);
        const issues = [...localIssues, ...(row?.issues ?? []), ...(!target.eligible && target.exclusionReason ? [target.exclusionReason] : [])];
        return <article key={target.key} className="rounded-lg border border-border p-4" aria-label={`Result position ${target.recordId}`}>
          <div className="mb-4 flex items-start gap-3"><input className="mt-1" type="checkbox" aria-label={`Select result ${target.recordId}`} checked={selected.includes(target.key)} disabled={!row?.eligible || row.alreadyApplied || busy || unavailable} onChange={event => { setConfirmed(false); setSelected(old => event.target.checked ? [...new Set([...old, target.key])] : old.filter(key => key !== target.key)); }} /><div className="min-w-0 flex-1"><h4 className="text-sm">{target.sport ?? 'Sport unknown'} · {target.event ?? 'Exact event in individual legs'}</h4><p className="mt-1 text-xs text-muted-foreground">{target.selection ?? 'Selection unknown'} · line {target.line ?? 'See exact legs'}</p><p className="mt-2 break-all text-[10px] text-muted-foreground">{target.kind} · {target.recordId} · last recorded {target.currentOutcome}</p></div></div>
          {issues.length > 0 && <div className="mb-4 space-y-1 text-[11px] text-amber-200">{issues.slice(0, 4).map((issue, index) => <p key={index}>{issue}</p>)}{issues.length > 4 && <details><summary className="cursor-pointer">All requirements ({issues.length})</summary>{issues.slice(4).map((issue, index) => <p className="mt-1" key={index}>{issue}</p>)}</details>}</div>}
          {target.settled ? <p className="text-xs text-muted-foreground">A result is already registered. Daily batching cannot overwrite it. Use the existing audited record review for a correction.</p> : <ResultEntry target={target} draft={draft} imported={importedRows.get(target.key)} disabled={busy || unavailable || !target.eligible || !!retry || importMode} onChange={value => { setDrafts(old => ({ ...old, [target.key]: value })); setSelected(old => old.filter(key => key !== target.key)); setFrozen(undefined); setConfirmed(false); setError(''); setSuccess(''); }} />}
          {row && <div className="mt-4 grid gap-2 rounded border border-border p-3 text-[11px] sm:grid-cols-2"><p>Expected calculated payout: {row.expectedPayoutCents === null ? 'Unavailable / not applicable' : money(row.expectedPayoutCents)}. This is not automatically a sportsbook-confirmed payout.</p><p>Hypothetical paper P/L: {row.hypotheticalProfitCents === null ? 'Unavailable / actual wager' : signedMoney(row.hypotheticalProfitCents)}</p></div>}
          {row?.warnings.length ? <details className="mt-3"><summary className="cursor-pointer text-[11px] text-amber-200">Source and rule warnings ({row.warnings.length})</summary>{row.warnings.map((warning, index) => <p key={index} className="mt-1 text-[10px] text-muted-foreground">{warning}</p>)}</details> : null}
          {target.previousEvidence.length > 0 && <details className="mt-3"><summary className="cursor-pointer text-[11px]">Previously recorded result evidence</summary><pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-all text-[10px] text-muted-foreground">{JSON.stringify(target.previousEvidence, null, 2)}</pre></details>}
        </article>;
      })}</div></details>;
    })}
    {review?.rows.some(row => !row.target) && <section className="rounded-lg border border-red-300/20 p-4"><h4 className="text-sm">Unmatched imported records</h4>{review.rows.filter(row => !row.target).map(row => <p key={row.key} className="mt-2 break-all text-xs text-red-300">{row.recordId}: {row.issues.join(' ')}</p>)}</section>}
    {(exclusions.length > 0 || targets.some(target => !target.eligible)) && <details className="rounded-lg border border-border p-4"><summary className="cursor-pointer text-xs">Historical evidence excluded from daily settlement ({exclusions.length + targets.filter(target => !target.eligible).length})</summary><p className="mt-3 text-xs text-muted-foreground">Unregistered actual claims and historical papers without established pre-event registration remain in their original archive. Their source-time status is not a current verified outcome. This workflow does not backfill or settle them.</p><Button size="sm" variant="outline" className="mt-3" asChild><Link href="/imports">Review historical sources</Link></Button></details>}
    <section className="space-y-4 rounded-xl border border-border p-4" aria-label="Results prompt and JSON import"><div><h4 className="text-sm font-medium">Results evidence fallback</h4><p className="mt-2 text-xs text-muted-foreground">Use a separate ChatGPT conversation to locate inspectable sources, or enter the results above. Its response uses the separate settlement-response v1 contract and cannot independently verify itself.</p></div>
      <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={!pendingEligible.length || unavailable} onClick={() => setPrompt(generateResultsCheckPrompt(pendingEligible))}>Generate Results Check Prompt</Button><Button size="sm" variant="ghost" onClick={() => download('edgelab-settlement-response-v1.schema.json', settlementResponseJsonSchema)}><Download />Download results JSON Schema</Button></div>
      {prompt && <><label className="block"><span className="label">Results check prompt</span><textarea className="input min-h-64 font-mono text-[11px]" aria-label="Results check prompt" readOnly value={prompt} /></label><Button size="sm" variant="outline" onClick={() => void navigator.clipboard.writeText(prompt).then(() => app.notify('Results check prompt copied.')).catch(() => setError('Clipboard unavailable. Select and copy the prompt text manually.'))}><Clipboard />Copy Results Check Prompt</Button></>}
      <input type="file" aria-label="Import results JSON file" accept=".json,application/json" disabled={busy || !!retry || unavailable} className="max-w-full text-xs" onChange={event => void fileResults(event.target.files?.[0])} />
      <label className="block"><span className="label">Settlement response JSON</span><textarea className="input min-h-48 font-mono text-[11px]" aria-label="Settlement response JSON" value={importText} disabled={busy || !!retry} onChange={event => { ++fileVersion.current; setImportText(event.target.value); }} placeholder='{"format":"edgelab.settlement-response","version":1,…}' /></label>
      <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={!importText.trim() || busy || !!retry || unavailable} onClick={() => void importResults()}>Validate imported results</Button>{(importMode || retry || Object.values(drafts).some(draft => draft.started)) && <Button size="sm" variant="ghost" disabled={busy} onClick={clearProposals}>Clear unsaved proposals / return to manual</Button>}</div>
      {importMode && <p className="text-[11px] text-muted-foreground">Imported proposals are reviewed exactly as supplied. Correct the JSON and validate again, or return to manual entry. Nothing is saved by importing or validating.</p>}
    </section>
    {error && <div role="alert" className="rounded-lg border border-red-300/20 p-3 text-xs text-red-300"><p>{error}</p>{technicalError && technicalError !== error && <details className="mt-2"><summary className="cursor-pointer">Technical details</summary><pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all text-[10px]">{technicalError}</pre></details>}</div>}
    <Dialog open={!!frozen} onOpenChange={open => { if (!open && !busy) { setFrozen(undefined); setConfirmed(false); } }}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Confirm reviewed settlement batch</DialogTitle><DialogDescription>Save only these reviewed outcomes using the existing audited repositories. Actual and hypothetical returns remain separate.</DialogDescription></DialogHeader>{frozen && <>
      <div className="space-y-3">{frozen.review.rows.filter(row => frozen.keys.includes(row.key)).map(row => <div key={row.key} className="rounded-lg border border-border p-3 text-xs"><p>{row.kind} · {row.target?.selection ?? row.recordId} · proposed {row.observation.outcome}</p><p className="mt-1 text-muted-foreground">{row.observation.verification.replaceAll('_', ' ')} · calculated payout {row.expectedPayoutCents === null ? 'not applicable / unknown' : money(row.expectedPayoutCents)} · sportsbook payout {row.observation.actualPayoutCents === null ? 'not supplied / paper' : money(row.observation.actualPayoutCents)}</p></div>)}</div>
      <p className="mt-4 text-[11px] text-muted-foreground">Each workspace save is transactional. Actual/core-paper and imported-paper saves use separate existing transactions; any partial success is reported and retries are idempotent. Original forecasts, funding and historical claims are not changed.</p>
      <label className="mt-4 flex gap-3 rounded-lg border border-primary/20 p-3 text-xs leading-relaxed"><input type="checkbox" aria-label="Authorize reviewed settlement batch" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} /><span>I reviewed the exact results, evidence classification, event completion, market terms and cash/bonus payout information. I explicitly authorize only these actual/paper settlement updates and their resulting analytics. Source-supplied or owner-attested evidence is not independently verified by EdgeLab.</span></label>
      {error && <p role="alert" className="mt-3 text-xs text-red-300">{error}</p>}
      <DialogFooter><Button variant="outline" disabled={busy} onClick={() => { setFrozen(undefined); setConfirmed(false); }}>Cancel batch review</Button><Button disabled={!confirmed || busy || unavailable} onClick={() => void saveBatch()}><CheckCheck />{busy ? 'Saving reviewed results…' : 'Confirm selected settlements'}</Button></DialogFooter>
    </>}</DialogContent></Dialog>
  </section>;
}
