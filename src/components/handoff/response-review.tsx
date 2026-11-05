'use client';
import { useRef, useState } from 'react';
import { ArrowRight, CheckCheck, FileCheck2, FileJson, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useApp } from '../app-provider';
import { useHistory } from '../history-provider';
import { Button } from '../ui/button';
import { ApprovalStatusBadges } from '../approval-status';
import { parseResearchResponse, type ResearchPreview, type PriorResearchSelection } from '@/lib/handoff/response';
import { RESEARCH_RESPONSE_TEMPLATE, researchResponseJsonSchema } from '@/lib/handoff/contract';
import { acknowledgeSelectedResearch, canApproveResearchSelection, researchApprovalBlockers, researchApprovalErrorSummary, researchApprovalGroup, researchApprovalSummary, selectResearchGroup, type ResearchApprovalGroup } from '@/lib/handoff/approval-review';
import type { ImportDecision } from '@/lib/imports/types';
import { money, percent, dateTime } from '@/lib/utils';

type SavedResearch = { count: number; paper: number; archive: number; day: number; sourceReferences: (string | null)[] };
const groups: { key: ResearchApprovalGroup; title: string; description: string }[] = [
  { key: 'paper', title: 'Paper candidates', description: 'Selected eligible candidates become immutable paper positions with in-app research alerts.' },
  { key: 'watch', title: 'Watchlist candidates', description: 'Preserve source evidence only. Watchlist approval does not register a prediction.' },
  { key: 'pass', title: 'Passed / rejected candidates', description: 'Preserve source-backed passes and NO BET decisions without creating a wager or forecast.' },
];
export function ResponseReview({ previousProposals = [], contextLoading = false, templateContext, archiveOnly = false, onImported }: { previousProposals?: PriorResearchSelection[]; contextLoading?: boolean; templateContext?: { researchDate: string; researchDay: number; sessionId: string }; archiveOnly?: boolean; onImported?:()=>void }) {
  const { mode, notify } = useApp();
  const { history, loading, error: storageError, approveResearch, archiveResearch } = useHistory();
  const fileVersion = useRef(0), validationVersion = useRef(0);
  const [text, setText] = useState(''), [sourceName, setSourceName] = useState('research-response.json');
  const [preview, setPreview] = useState<ResearchPreview>(), [decisions, setDecisions] = useState<ImportDecision[]>([]);
  const [confirmed, setConfirmed] = useState(false), [completeDay, setCompleteDay] = useState(false);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [saved, setSaved] = useState<SavedResearch>();
  const classification = mode === 'demo' ? 'synthetic' : 'user_confirmed';
  const inspect = async (value = text, name = sourceName) => {
    const epoch = ++validationVersion.current;
    setBusy(true); setError(''); setPreview(undefined); setSaved(undefined); setConfirmed(false); setCompleteDay(false);
    try {
      if (contextLoading || loading) throw new Error('Wait for the current workspace and continuity evidence to finish loading before validating this response.');
      const result = await parseResearchResponse({ text: value, sourceName: name, verification: classification, existingRecords: history.records, previousProposals });
      if (epoch !== validationVersion.current) return;
      setPreview(result); setDecisions(result.importPreview.rows.map(row => ({ rowNumber: row.rowNumber, include: false, allowProbableDuplicate: false, acknowledgeIncomplete: false })));
    } catch (reason) { if (epoch === validationVersion.current) setError(reason instanceof Error ? reason.message : 'Research response could not be validated.'); }
    finally { if (epoch === validationVersion.current) setBusy(false); }
  };
  const update = (rowNumber: number, values: Partial<ImportDecision>) => { setConfirmed(false); setDecisions(old => old.map(row => row.rowNumber === rowNumber ? { ...row, ...values } : row)); };
  const select = (group: ResearchApprovalGroup | 'all' | 'none') => { if (!preview) return; setConfirmed(false); setDecisions(old => selectResearchGroup(preview, old, group)); };
  const summary = preview ? researchApprovalSummary(preview, decisions) : null;
  const canSave = !!preview && canApproveResearchSelection(preview, decisions);
  const acknowledge = (checked: boolean) => { setConfirmed(checked); if (preview) setDecisions(old => acknowledgeSelectedResearch(preview, old, checked)); };
  const save = async () => {
    if (!preview || !confirmed || !canSave || contextLoading || loading || storageError) return;
    setBusy(true); setError('');
    try {
      const selection = researchApprovalSummary(preview, decisions);
      const sourceReferences = preview.importPreview.rows.filter(row => decisions.some(decision => decision.rowNumber === row.rowNumber && decision.include)).map(row => row.snapshot.sourceReference);
      if(archiveOnly) await archiveResearch(preview, decisions, classification, previousProposals); else await approveResearch(preview, decisions, classification, completeDay, previousProposals);
      setSaved({ count: selection.selected, paper: archiveOnly ? 0 : selection.selectedPaper, archive: archiveOnly ? selection.selected : selection.selectedArchive, day: preview.response.researchDay, sourceReferences });
      setPreview(undefined); setText(''); setConfirmed(false);
      notify(archiveOnly?`Research imported · ${selection.selected} source selections ready for Placed / Paper / Watch / Pass. No positions or day completion were inferred.`:`Research approved · ${selection.selectedPaper} paper positions · ${selection.selectedArchive} watch/pass archives · no actual bets or funding.`);
      if(archiveOnly) onImported?.();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Research could not be saved.'); }
    finally { setBusy(false); }
  };
  const loadFile = async (file?: File) => {
    const version = ++fileVersion.current; ++validationVersion.current;
    setError(''); setText(''); setPreview(undefined); setSaved(undefined); setConfirmed(false); setBusy(false);
    if (!file) return;
    if (file.size > 1048576 || !file.name.toLowerCase().endsWith('.json')) { setError('Select a UTF-8 research JSON file up to 1 MiB.'); return; }
    try {
      const contents = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(await file.arrayBuffer());
      if (version !== fileVersion.current) return;
      setText(contents); setSourceName(file.name); await inspect(contents, file.name);
    } catch { if (version === fileVersion.current) setError('The research file must be valid UTF-8. No data was saved.'); }
  };
  const reset = () => { ++fileVersion.current; ++validationVersion.current; setPreview(undefined); setSaved(undefined); setConfirmed(false); setCompleteDay(false); setError(''); setBusy(false); };
  const savedRecords = saved ? history.records.filter(record => saved.sourceReferences.includes(record.snapshot.sourceReference)) : [];
  return <section className="space-y-5" aria-label="Research response review">
    <div><h3 className="text-sm font-medium">Review a research response</h3><p className="mt-2 text-xs leading-relaxed text-muted-foreground">{archiveOnly?'Import the exact response as immutable source selections. Choose Placed, Paper, Watch or Pass afterward in the daily workspace. Importing creates no actual or paper position and does not complete a research day.':'Upload or paste the exact research JSON, select paper or archive records, then approve once. Original source evidence stays immutable. No actual wager is registered here.'}</p></div>
    {saved ? <div className="space-y-4 rounded-xl border border-primary/25 bg-primary/5 p-5" role="status" aria-label="Research approval success">
      <div className="flex items-center gap-2 text-primary"><FileCheck2 className="size-5" /><h4 className="text-sm font-medium">Research approval saved</h4></div>
      <p className="text-sm">{saved.count} records saved for Research Day {saved.day}: {saved.paper} paper positions and {saved.archive} watch/pass archives.</p>
      <ApprovalStatusBadges facts={{ archived: true, mode, ownerAttested: mode !== 'demo', paperRegistered: saved.paper > 0 }} />
      <p className="text-xs text-muted-foreground">Selected paper positions and their notifications are available immediately. No actual bet, payout or funding was created; owner attestation is not independent verification.</p>
      <div className="flex flex-wrap gap-2"><Button size="sm" asChild><Link href="/paper">View paper tracking <ArrowRight /></Link></Button><Button size="sm" variant="outline" asChild><Link href="/imports">View saved archive</Link></Button><Button size="sm" variant="ghost" onClick={reset}>Review another response</Button></div>
      {savedRecords.length > 0 && <details className="rounded-lg border border-border p-3"><summary className="cursor-pointer text-xs">Saved records ({savedRecords.length})</summary><ul className="mt-3 space-y-2">{savedRecords.map(record => <li key={record.id}><Link className="text-xs text-primary underline" href={`/imports?record=${record.id}`}>{record.snapshot.participant ?? record.snapshot.event ?? record.snapshot.selection ?? 'Source-backed pass'} · {!archiveOnly && record.snapshot.kind === 'paper' ? 'Paper position' : 'Evidence archive'}</Link></li>)}</ul></details>}
    </div> : !preview ? <>
      <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => { reset(); setText(JSON.stringify({ ...RESEARCH_RESPONSE_TEMPLATE, ...(templateContext ? { id: templateContext.sessionId, researchDate: templateContext.researchDate, researchDay: templateContext.researchDay } : {}) }, null, 2)); setSourceName('research-response-template.json'); }}>Load response template</Button><Button size="sm" variant="ghost" onClick={() => { const url = URL.createObjectURL(new Blob([JSON.stringify(researchResponseJsonSchema, null, 2)], { type: 'application/schema+json' })); const a = document.createElement('a'); a.href = url; a.download = 'edgelab-research-response.schema.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }}>Download JSON Schema</Button><input aria-label="Upload research response JSON" type="file" accept=".json,application/json" disabled={busy || loading || contextLoading} className="max-w-full text-xs text-muted-foreground" onChange={event => void loadFile(event.target.files?.[0])} /></div>
      <label className="block"><span className="label">Research response JSON</span><textarea className="input min-h-80 font-mono text-xs" style={{ minHeight: '20rem' }} spellCheck={false} value={text} onChange={event => { ++fileVersion.current; ++validationVersion.current; setText(event.target.value); setSourceName('pasted-research-response.json'); setBusy(false); setConfirmed(false); setError(''); }} placeholder='{"format":"edgelab.research-response","version":1,…}' /></label>
      <p className="text-[11px] text-muted-foreground">Files validate automatically. Pasted JSON uses the button below. {mode === 'demo' ? 'Demo responses are synthetic and stay in this browser.' : 'Approval is your source attestation; EdgeLab has not independently verified odds, evidence links or model claims.'}</p>
      <Button disabled={!text || busy || loading || contextLoading} onClick={() => void inspect()}><FileJson />{busy ? 'Validating…' : 'Validate research response'}</Button>
    </> : <>
      <div className="sticky top-3 z-10 space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm" aria-label="Research validation summary">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm">Research Day {preview.response.researchDay} · {preview.response.researchDate} Melbourne</p><p className="mt-1 text-[11px] text-muted-foreground">Draft review · {summary!.total} uploaded · {summary!.eligible} eligible · {summary!.blocked} blocked · {summary!.duplicate} duplicate matches</p></div><ApprovalStatusBadges facts={{ mode }} compact /></div>
        <p className="text-xs">{summary!.selectedPaper} paper candidates and {summary!.selectedArchive} watch/pass records selected. Nothing is saved yet.</p>
        <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => select(archiveOnly?'all':'paper')}>{archiveOnly?'Select eligible research candidates':'Select eligible paper candidates'}</Button><Button size="sm" variant="outline" onClick={() => { setConfirmed(false); setDecisions(old => selectResearchGroup(preview, selectResearchGroup(preview, old, 'watch'), 'pass')); }}>Select eligible watch / passes</Button><Button size="sm" variant="ghost" onClick={() => select('none')}>Deselect all</Button></div>
      </div>
      {groups.map(group => {
        const rows = preview.importPreview.rows.filter(row => researchApprovalGroup(preview, row.rowNumber) === group.key);
        if (!rows.length) return null;
        return <section key={group.key} className="space-y-3" aria-label={group.title}><div><h4 className="text-sm font-medium">{group.title} · {rows.length}</h4><p className="mt-1 text-[11px] text-muted-foreground">{archiveOnly?'Source preference only. Importing retains the original decision without registering a position.':group.description}</p></div>{rows.map(row => {
          const decision = decisions.find(decision => decision.rowNumber === row.rowNumber)!;
          const review = preview.candidateReviews.find(review => review.rowNumber === row.rowNumber);
          const blockers = researchApprovalBlockers(row), warnings = row.issues.filter(issue => issue.severity === 'warning');
          const blocked = blockers.length > 0;
          return <article key={row.rowNumber} className="rounded-xl border border-border p-4"><div className="flex items-start gap-3"><input type="checkbox" aria-label={`Approve research row ${row.rowNumber}`} aria-describedby={`research-row-${row.rowNumber}-eligibility`} className="mt-1" checked={decision.include} disabled={blocked} onChange={event => update(row.rowNumber, { include: event.target.checked })} /><div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2"><div><h5 className="text-sm font-medium">{row.snapshot.participant ?? row.snapshot.event ?? `Research record ${row.rowNumber}`}</h5><p className="mt-1 text-[11px] text-muted-foreground">{row.snapshot.event ?? 'Unknown event'} · {row.snapshot.sport ?? 'Sport unknown'} · Track {row.snapshot.strategy ?? 'unknown'}</p></div><ApprovalStatusBadges facts={{ mode, evidenceProvided: !!review?.candidate.evidence.length }} compact /></div>
            <p className="mt-2 text-xs">{row.snapshot.market ?? 'Market unknown'} · {row.snapshot.selection ?? 'Selection unknown'} · Line {row.snapshot.line ?? 'Unknown'}</p>
            <div className="mt-3 grid gap-2 text-[11px] sm:grid-cols-3"><p>{row.snapshot.bookmaker ?? 'Bookmaker unknown'} · Original odds: {row.snapshot.odds ?? 'Unknown'}</p><p>Probability: {row.snapshot.probability === null ? 'Not supplied' : percent(row.snapshot.probability * 100)}</p><p>Arithmetic EV: {review?.calculatedEv == null ? 'Unavailable' : percent(review.calculatedEv * 100)}</p><p>Odds timestamp: {review?.candidate.oddsTimestamp ? dateTime(review.candidate.oddsTimestamp) : 'Unknown'} · {review?.freshness ?? 'N/A'}</p><p>Hypothetical stake: {row.snapshot.stakeCents === null ? 'Unknown' : money(row.snapshot.stakeCents)}</p><p>Evidence: {review?.candidate.evidence.length ?? 0} items · independently unverified</p></div>
            <p id={`research-row-${row.rowNumber}-eligibility`} className={`mt-3 text-[11px] ${blocked ? 'text-red-300' : 'text-muted-foreground'}`}>{blocked ? `Blocked: ${blockers[0]}` : !archiveOnly && group.key === 'paper' ? `Eligible for paper approval${warnings.length ? ` · ${warnings.length} review notices` : ''}` : `Eligible for evidence archive${warnings.length ? ` · ${warnings.length} review notices` : ''}`}</p>
            {(row.issues.length > 0 || row.duplicates.length > 0) && <details className="mt-3 rounded-lg border border-border p-3"><summary className="cursor-pointer text-[11px] text-primary">{blockers.length} blocking reasons · {warnings.length} review notices · {row.duplicates.length} duplicate matches</summary><div className="mt-3 space-y-2">{row.issues.map((issue, index) => <p key={index} className={`text-[11px] ${issue.severity === 'error' ? 'text-red-300' : 'text-amber-200/80'}`}>{issue.field}: {issue.message}</p>)}{row.duplicates.map((duplicate, index) => <p key={index} className="text-[11px] text-amber-200">{duplicate.level.toUpperCase()} duplicate: {duplicate.reason}</p>)}</div></details>}
            {row.duplicates.some(duplicate => duplicate.level === 'probable') && !blocked && <label className="mt-3 flex gap-2 text-[11px]"><input type="checkbox" checked={decision.allowProbableDuplicate} onChange={event => update(row.rowNumber, { allowProbableDuplicate: event.target.checked })} />Keep this probable duplicate separately after review; do not merge.</label>}
            <details className="mt-3 rounded-lg border border-border p-3"><summary className="cursor-pointer text-[11px] text-primary">Evidence, probability provenance and original source</summary><div className="mt-3 space-y-2 text-[11px] text-muted-foreground">{review && <><p>{review.candidate.rationale ?? 'Rationale not provided'} · Uncertainty: {review.candidate.uncertainty ?? 'Not documented'}</p><p>Probability origin: {review.candidate.probability.origin ?? 'Unknown'} · Source: {review.candidate.probability.source ?? 'Unknown'} · Method: {review.candidate.probability.method ?? 'Unknown'} · Model/version: {review.candidate.probability.modelVersion ?? 'Unknown'}</p><p>Odds source: {review.candidate.oddsSource ?? 'Unknown'} · {review.candidate.oddsSourceUrl ?? 'No price source URL supplied'}</p><p>Prediction: {row.snapshot.predictionAt ? dateTime(row.snapshot.predictionAt) : 'Unknown'} · Event start: {review.candidate.startsAt ? dateTime(review.candidate.startsAt) : 'Unknown'}</p></>}<pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-background/30 p-3 text-[10px]">{JSON.stringify({ original: row.raw, proposed: row.snapshot, transformations: row.transformations }, null, 2)}</pre></div></details>
          </div></div></article>;
        })}</section>;
      })}
      <div className="space-y-4 rounded-xl border border-primary/20 p-4" aria-label="Research approval confirmation">
        <h4 className="text-sm font-medium">Confirm selected research</h4><p className="text-xs leading-relaxed text-muted-foreground">{archiveOnly?`Archive ${summary!.selected} source selections for individual daily decisions. No actual or paper positions are created.`:`Save ${summary!.selectedPaper} immutable paper positions with research alerts and ${summary!.selectedArchive} evidence-only watch/pass records.`} {summary!.selectedWarnings} review notices apply to the selected rows. The complete response, including skipped rows, remains in the source audit. No actual bet or funding is created.</p>
        {!archiveOnly && preview.response.dayStatus === 'completed' && <label className="flex gap-3 text-xs"><input type="checkbox" checked={completeDay} onChange={event => { setCompleteDay(event.target.checked); setConfirmed(false); }} /><span>I explicitly confirm Research Day {preview.response.researchDay} is complete. This separate day attestation will be retained for the next handoff.</span></label>}
        <label className="flex gap-3 rounded-lg border border-border p-3 text-xs leading-relaxed"><input aria-label="Approve selected research and warnings" type="checkbox" className="mt-1" checked={confirmed} disabled={!summary!.selected} onChange={event => acknowledge(event.target.checked)} /><span>{archiveOnly?'I approve archiving only the selected source evidence; Placed and Paper require separate explicit actions.':'I reviewed the selected source records and approve immutable paper registration or pass/watch archiving.'} I acknowledge the selected records’ missing data, source claims, freshness, uncertainty and review notices. No actual wager, payout or funding is inferred. Source claims remain independently unverified by EdgeLab.</span></label>
        {!summary!.selected && <p className="text-[11px] text-muted-foreground">Select at least one eligible paper candidate or watch/pass record above.</p>}
        {confirmed && !canSave && <p className="text-[11px] text-amber-200">A selected probable duplicate still needs its individual keep-separate decision, or must be deselected.</p>}
        <div className="flex flex-wrap justify-between gap-3"><Button variant="outline" disabled={busy} onClick={() => { ++validationVersion.current; setPreview(undefined); setConfirmed(false); setCompleteDay(false); }}>Back to research JSON</Button><Button disabled={!confirmed || !canSave || busy || loading || contextLoading || !!storageError} onClick={() => void save()}><ShieldCheck />{busy ? 'Saving…' : archiveOnly ? 'Import research candidates' : 'Approve selected research'}</Button></div>
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">Blocked historical or post-event proposals belong in <Link className="text-primary underline" href="/imports">Historical Import</Link>, not new pre-event paper tracking. Actual bets use the <Link className="text-primary underline" href="/ledger">separate financial ledger</Link>.</p>
      <details className="rounded-lg border border-border p-3"><summary className="cursor-pointer text-xs">Complete original research response and validation context</summary><p className="mt-3 text-[11px] text-muted-foreground">Source: {preview.response.source ?? 'Unknown'} · Method: {preview.response.researchMethod ?? 'Unknown'} · Created: {preview.response.createdAt ? dateTime(preview.response.createdAt) : 'Unknown'} · SHA-256 {preview.importPreview.sourceHash}</p><pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-all text-[10px] text-muted-foreground">{preview.importPreview.rawSource}</pre></details>
    </>}
    {error && <div role="alert" className="rounded-lg border border-red-400/20 p-3 text-xs text-red-300"><p>{researchApprovalErrorSummary(error)}</p>{researchApprovalErrorSummary(error) !== error && <details className="mt-2"><summary className="cursor-pointer">Validation details</summary><p className="mt-2 whitespace-pre-wrap break-words">{error}</p></details>}</div>}
    {storageError && <p className="text-[11px] text-amber-200">Research can be validated locally, but approval cannot be saved until historical storage is available.</p>}
    <p className="flex items-center gap-2 text-[10px] text-muted-foreground"><CheckCheck className="size-3.5" />No OpenAI API, bookmaker account or automatic wagering is involved.</p>
  </section>;
}
