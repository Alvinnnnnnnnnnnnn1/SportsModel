'use client';
import { useRef, useState } from 'react';
import { AlertTriangle, CheckCheck, FileJson, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useApp } from '../app-provider';
import { useHistory } from '../history-provider';
import { Button } from '../ui/button';
import { parseResearchResponse, type ResearchPreview } from '@/lib/handoff/response';
import { RESEARCH_RESPONSE_TEMPLATE, researchResponseJsonSchema } from '@/lib/handoff/contract';
import type { ImportDecision } from '@/lib/imports/types';
import { money, percent } from '@/lib/utils';

export function ResponseReview() {
  const { mode, notify } = useApp();
  const { history, loading, error: storageError, approveResearch } = useHistory();
  const fileVersion=useRef(0);
  const [text, setText] = useState(''); const [sourceName, setSourceName] = useState('research-response.json');
  const [preview, setPreview] = useState<ResearchPreview>(); const [decisions, setDecisions] = useState<ImportDecision[]>([]);
  const [confirmed, setConfirmed] = useState(false); const [completeDay, setCompleteDay] = useState(false);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const classification = mode === 'demo' ? 'synthetic' : 'user_confirmed';
  const inspect = async () => {
    setBusy(true); setError(''); setPreview(undefined); setConfirmed(false); setCompleteDay(false);
    try {
      const result = await parseResearchResponse({ text, sourceName, verification: classification, existingRecords: history.records });
      setPreview(result); setDecisions(result.importPreview.rows.map(row => ({ rowNumber: row.rowNumber, include: false, allowProbableDuplicate: false, acknowledgeIncomplete: false })));
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Research response could not be validated.'); }
    finally { setBusy(false); }
  };
  const update = (rowNumber: number, values: Partial<ImportDecision>) => setDecisions(old => old.map(row => row.rowNumber === rowNumber ? { ...row, ...values } : row));
  const selected = decisions.filter(d => d.include);
  const canSave = !!preview && selected.length > 0 && selected.every(decision => {
    const row = preview.importPreview.rows.find(r => r.rowNumber === decision.rowNumber)!;
    return !row.issues.some(i => i.severity === 'error') && !row.duplicates.some(d => d.level === 'exact') && (!row.issues.some(i => i.severity === 'warning') || decision.acknowledgeIncomplete) && (!row.duplicates.some(d => d.level === 'probable') || decision.allowProbableDuplicate);
  });
  const save = async () => {
    if (!preview || !confirmed || !canSave) return;
    setBusy(true); setError('');
    try { await approveResearch(preview, decisions, classification, completeDay); setPreview(undefined); setText(''); setConfirmed(false); notify('Approved research archived. Selected paper forecasts and their in-app alerts are registered; no actual bet or funding was created.'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Research could not be saved.'); }
    finally { setBusy(false); }
  };
  const loadFile = async (file?: File) => {
    const version=++fileVersion.current; setError(''); setText(''); setPreview(undefined);
    if (!file) return;
    if (file.size > 1048576 || !file.name.toLowerCase().endsWith('.json')) { setError('Select a UTF-8 research JSON file up to 1 MiB.'); return; }
    try { const contents = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(await file.arrayBuffer()); if(version!==fileVersion.current)return;setText(contents); setSourceName(file.name); }
    catch { setError('The research file must be valid UTF-8. No data was saved.'); }
  };
  return <section className="space-y-5" aria-label="Research response review">
    <div><h3 className="text-sm font-medium">Import a structured research response</h3><p className="mt-2 text-xs leading-relaxed text-muted-foreground">Use a separate ChatGPT conversation or your own documented research. EdgeLab makes no AI call. Missing facts must be null; numerical betting probabilities must come from a documented non-LLM model or attributable forecast.</p></div>
    {!preview ? <>
      <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => { setText(JSON.stringify(RESEARCH_RESPONSE_TEMPLATE,null,2)); setSourceName('research-response-template.json'); }}>Load response template</Button><Button size="sm" variant="ghost" onClick={() => { const url=URL.createObjectURL(new Blob([JSON.stringify(researchResponseJsonSchema,null,2)],{type:'application/schema+json'})); const a=document.createElement('a'); a.href=url; a.download='edgelab-research-response.schema.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); }}>Download JSON Schema</Button><input aria-label="Upload research response JSON" type="file" accept=".json,application/json" className="max-w-full text-xs text-muted-foreground" onChange={event=>void loadFile(event.target.files?.[0])} /></div>
      <label className="block"><span className="label">Research response JSON</span><textarea className="input min-h-80 font-mono text-xs" style={{minHeight:'20rem'}} spellCheck={false} value={text} onChange={event=>{++fileVersion.current;setText(event.target.value);setSourceName('pasted-research-response.json');}} placeholder='{"format":"edgelab.research-response","version":1,…}' /></label>
      <p className="text-[11px] text-amber-200/80">{mode==='demo'?'Demo responses are synthetic and stay in this browser.':'Your approval records a manual source review, not independent verification of odds, source links or numerical models.'}</p>
      <Button disabled={!text||busy||loading} onClick={()=>void inspect()}><FileJson />{busy?'Validating…':'Validate research response'}</Button>
    </> : <>
      <div className="rounded-xl border border-border p-4"><p className="text-sm">Research Day {preview.response.researchDay} · {preview.response.researchDate} Melbourne · {preview.response.dayStatus}</p><p className="mt-2 text-[11px] text-muted-foreground">{preview.response.source??'Source not provided'} · {preview.response.researchMethod??'Method not provided'}</p><p className="mt-2 text-[11px] text-muted-foreground">{preview.importPreview.rows.length} source rows · {selected.length} selected · original source SHA-256 {preview.importPreview.sourceHash.slice(0,16)}…</p></div>
      <div className="space-y-4">{preview.importPreview.rows.map(row=>{
        const decision=decisions.find(d=>d.rowNumber===row.rowNumber)!;
        const review=preview.candidateReviews.find(r=>r.rowNumber===row.rowNumber);
        const blocked=row.issues.some(i=>i.severity==='error')||row.duplicates.some(d=>d.level==='exact');
        return <article key={row.rowNumber} className="rounded-xl border border-border p-4"><div className="flex items-start gap-3"><input type="checkbox" aria-label={`Approve research row ${row.rowNumber}`} className="mt-1" checked={decision.include} disabled={blocked} onChange={e=>update(row.rowNumber,{include:e.target.checked})} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm">{row.snapshot.participant??row.snapshot.event??`Research record ${row.rowNumber}`}</h4><span className="rounded border border-primary/20 px-2 py-1 text-[9px] uppercase text-primary">{review?.candidate.decision??'pass'} · {row.snapshot.sport??'Unknown sport'} · Track {row.snapshot.strategy??'unknown'}</span></div><p className="mt-2 text-xs text-muted-foreground">{row.snapshot.event??'Unknown event'} · {row.snapshot.market??'Unknown market'} · {row.snapshot.selection??'Unknown selection'} · Line {row.snapshot.line??'Unknown'}</p><div className="mt-3 grid gap-2 text-[11px] sm:grid-cols-3"><p>{row.snapshot.bookmaker??'Bookmaker unknown'} · {row.snapshot.odds??'Price unavailable'}</p><p>Probability: {row.snapshot.probability===null?'Not supplied':percent(row.snapshot.probability*100)}</p><p>Arithmetic EV: {review?.calculatedEv===null||review?.calculatedEv===undefined?'Unavailable':percent(review.calculatedEv*100)}</p><p>Odds timestamp: {review?.candidate.oddsTimestamp??'Unknown'} · {review?.freshness??'N/A'}</p><p>Confidence: {review?.candidate.confidence??'Not applicable'}</p><p>Hypothetical stake: {row.snapshot.stakeCents===null?'Unknown':money(row.snapshot.stakeCents)}</p></div>{review&&<p className="mt-3 text-[11px] text-muted-foreground">{review.candidate.rationale??'No rationale supplied'} · Uncertainty: {review.candidate.uncertainty??'Not documented'}</p>}
          <div className="mt-3 space-y-1">{row.issues.map((issue,i)=><p key={i} className={issue.severity==='error'?'text-[11px] text-red-300':'text-[11px] text-amber-200/80'}>{issue.field}: {issue.message}</p>)}{row.duplicates.map((d,i)=><p key={i} className="text-[11px] text-amber-200">{d.level.toUpperCase()} duplicate: {d.reason}</p>)}</div>
          {row.issues.some(i=>i.severity==='warning')&&<label className="mt-3 flex gap-2 text-[11px]"><input type="checkbox" checked={decision.acknowledgeIncomplete} onChange={e=>update(row.rowNumber,{acknowledgeIncomplete:e.target.checked})} />I reviewed missing data, source claims, freshness and uncertainty for this row.</label>}
          {row.duplicates.some(d=>d.level==='probable')&&<label className="mt-2 flex gap-2 text-[11px]"><input type="checkbox" checked={decision.allowProbableDuplicate} onChange={e=>update(row.rowNumber,{allowProbableDuplicate:e.target.checked})} />Keep this probable duplicate separately after review; do not merge.</label>}
          <details className="mt-3 rounded-lg border border-border p-3"><summary className="cursor-pointer text-[11px] text-primary">Original source, evidence and mapping</summary><pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-all text-[10px] text-muted-foreground">{JSON.stringify({original:row.raw,proposed:row.snapshot,transformations:row.transformations},null,2)}</pre></details>
        </div></div></article>;
      })}</div>
      {preview.response.dayStatus==='completed'&&<label className="flex gap-3 rounded-lg border border-border p-4 text-xs"><input type="checkbox" checked={completeDay} onChange={e=>setCompleteDay(e.target.checked)} /><span>I explicitly confirm Research Day {preview.response.researchDay} is complete. This attestation will be retained as the next research handoff day checkpoint.</span></label>}
      <label className="flex gap-3 rounded-xl border border-primary/20 bg-primary/3 p-4 text-xs leading-relaxed"><input type="checkbox" className="mt-1" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} /><span>I reviewed the selected source records and approve immutable paper registration or pass/watch archiving. The complete original response, including skipped rows, is retained for audit. No actual wager, payout or funding is inferred. Source claims remain unverified by EdgeLab.</span></label>
      <div className="flex flex-wrap justify-between gap-3"><Button variant="outline" onClick={()=>{setPreview(undefined);setConfirmed(false);setCompleteDay(false);}}>Back to research JSON</Button><Button disabled={!confirmed||!canSave||busy||loading||!!storageError} onClick={()=>void save()}><ShieldCheck />{busy?'Saving…':'Approve selected research'}</Button></div>
      <p className="flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><span>Errors and exact duplicates are blocked. Missing prices stay unknown. Research approval cannot convert a paper forecast into an actual bet. After placing a bet yourself, use the <Link className="text-primary underline" href="/ledger">separate confirmed ledger form</Link>.</span></p>
      <details className="rounded-lg border border-border p-3"><summary className="cursor-pointer text-xs">Complete original research response</summary><pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-all text-[10px] text-muted-foreground">{preview.importPreview.rawSource}</pre></details>
    </>}
    {error&&<p role="alert" className="rounded-lg border border-red-400/20 p-3 text-xs text-red-300">{error}</p>}
    {storageError&&<p className="text-[11px] text-amber-200">Research can be validated locally, but approval cannot be saved until historical storage is available.</p>}
    <p className="flex items-center gap-2 text-[10px] text-muted-foreground"><CheckCheck className="size-3.5" />No OpenAI API, bookmaker account or automatic wagering is involved.</p>
  </section>;
}
