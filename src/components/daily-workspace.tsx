'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ClipboardCheck, FileJson, ListChecks } from 'lucide-react';
import { useApp } from './app-provider';
import { useHistory } from './history-provider';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { BetForm } from './bet-form';
import { ResponseReview } from './handoff/response-review';
import { ResultsWorkspace } from './results/results-workspace';
import { ApprovalStatusBadges } from './approval-status';
import { sourceResearchCandidate, researchActualLink, researchPaperBlockers, researchPlacement, latestDailyDecision, originalResearchLabels } from '@/lib/daily/research';
import { researchSessionMetadata, type PriorResearchSelection } from '@/lib/handoff/response';
import { prepareExperimentContextV2Preview } from '@/lib/handoff/methodology';
import type { HistoricalRecord } from '@/lib/imports/types';
import { dateTime, money, percent } from '@/lib/utils';

export function DailyWorkspace({ previousProposals = [], contextLoading = false, templateContext }: { previousProposals?: PriorResearchSelection[]; contextLoading?: boolean; templateContext: { researchDate: string; researchDay: number; sessionId: string } }) {
  const app = useApp(); const store = useHistory();
  const { data, mode, notify } = app; const { history, loading, error, registerResearchPaper, decideResearch, commitPreview } = store;
  const [section, setSection] = useState<'selections' | 'results'>('selections');
  const [importOpen, setImportOpen] = useState(false), [session, setSession] = useState('all');
  const [placing, setPlacing] = useState<HistoricalRecord>(), [paper, setPaper] = useState<HistoricalRecord>();
  const [decision, setDecision] = useState<{ record: HistoricalRecord; value: 'watch' | 'pass' }>();
  const [reason, setReason] = useState(''), [busy, setBusy] = useState(false), [problem, setProblem] = useState('');
  const [complete, setComplete] = useState(false), [day, setDay] = useState(String(templateContext.researchDay));
  const records = useMemo(() => history.records.filter(record => sourceResearchCandidate(record)), [history.records]);
  const sessionRecords = history.records.filter(record=>researchSessionMetadata(record));
  const passes = sessionRecords.filter(record=>!sourceResearchCandidate(record));
  const sessions = [...new Map(sessionRecords.map(record => { const meta = researchSessionMetadata(record)!; return [meta.responseId, meta]; })).values()].reverse();
  const visible = records.filter(record => session === 'all' || researchSessionMetadata(record)?.responseId === session);
  const unavailable = loading || app.loading || contextLoading || !!error || !!app.error || (mode === 'supabase' && !app.user);

  async function track() {
    if (!paper) return;
    setBusy(true); setProblem('');
    try { await registerResearchPaper(paper.id); notify('Paper tracking saved from the original research source. No actual wager was created.'); setPaper(undefined); }
    catch (cause) { setProblem(cause instanceof Error ? cause.message : 'Paper tracking could not be saved.'); }
    finally { setBusy(false); }
  }
  async function saveDecision() {
    if (!decision) return;
    setBusy(true); setProblem('');
    try { await decideResearch(decision.record.id, decision.value, reason); notify(`${decision.value === 'watch' ? 'Watch' : 'Pass'} decision saved; original research preserved.`); setDecision(undefined); setReason(''); }
    catch (cause) { setProblem(cause instanceof Error ? cause.message : 'Decision could not be saved.'); }
    finally { setBusy(false); }
  }
  async function completeDay() {
    setBusy(true); setProblem('');
    try {
      if (!complete || !/^\d+$/.test(day) || Number(day) < 1 || !sessions.some(item=>item.researchDay===Number(day))) throw new Error('Review the research day and explicitly confirm its completion.');
      const source = `Owner daily review Day ${day}; saved sessions: ${sessions.filter(item=>item.researchDay===Number(day)).map(item => item.responseId).slice(0, 8).join(', ') || 'no session supplied'}. Unsettled registered positions carry forward; no outcome is inferred.`;
      const preview = await prepareExperimentContextV2Preview({ ownerReportedDay: Number(day), sourceConfirmedCompletedDay: Number(day), sourceConfirmedDayReference: source, researchCreationDate: templateContext.researchDate, eventDate: null, methodology: null, methodologyApprovalConfirmed: false, sourceReference: source, verification: mode === 'demo' ? 'synthetic' : 'user_confirmed', confirmed: true });
      await commitPreview(preview, [{ rowNumber: 1, include: true, acknowledgeIncomplete: true, allowProbableDuplicate: false }], mode === 'demo' ? 'synthetic' : 'user_confirmed');
      setComplete(false); notify(`Research Day ${day} completion saved as an owner attestation. Unresolved positions remain unresolved.`);
    } catch (cause) { setProblem(cause instanceof Error ? cause.message : 'The day checkpoint could not be saved.'); }
    finally { setBusy(false); }
  }

  return <section className="space-y-5" aria-label="Daily research workspace">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-base font-medium">Daily workspace</h3><p className="mt-2 max-w-3xl text-xs leading-relaxed text-muted-foreground">Import source research once, confirm only what was placed, approve paper positions separately, then review results together. Historical actual claims and legacy paper evidence stay in their existing archive.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={unavailable} onClick={() => setImportOpen(true)}><FileJson />Import research JSON</Button><Button variant={section === 'results' ? 'secondary' : 'outline'} disabled={unavailable} onClick={() => setSection('results')}><ListChecks />Check Results</Button></div></div>
    <div className="flex flex-wrap gap-2"><Button size="sm" variant={section === 'selections' ? 'secondary' : 'ghost'} onClick={() => setSection('selections')}>Research selections ({records.length})</Button><Button size="sm" variant={section === 'results' ? 'secondary' : 'ghost'} onClick={() => setSection('results')}>Results and settlements</Button></div>
    {section === 'selections' ? <>
      <label className="block max-w-md"><span className="label">Research session</span><select className="input" value={session} onChange={event => setSession(event.target.value)}><option value="all">All imported sessions</option>{sessions.map(meta => <option key={meta.responseId} value={meta.responseId}>Day {meta.researchDay} · {meta.researchDate} · {meta.responseId}</option>)}</select></label>
      {visible.length ? <div className="space-y-4">{visible.map(record => {
        const candidate = sourceResearchCandidate(record)!; const meta = researchSessionMetadata(record)!;
        const actual = researchActualLink(data, record.id), paperResult = history.paperResults.find(result => result.recordId === record.id);
        const latest = latestDailyDecision(history, record.id), labels = originalResearchLabels(candidate);
        const blockers = researchPaperBlockers(record, history, data), hasPosition = !!actual || !!paperResult;
        return <article key={record.id} className="space-y-3 rounded-xl border border-border p-4" aria-label={`Daily selection ${candidate.id}`}>
          <div className="flex flex-wrap justify-between gap-3"><div><h4 className="text-sm font-medium">{candidate.event ?? 'Event unknown'} · {candidate.participant ?? 'Participant unknown'}</h4><p className="mt-1 text-[11px] text-muted-foreground">Day {meta.researchDay} · {meta.responseId} · {candidate.sport ?? 'Sport unknown'} · {candidate.startsAt ? dateTime(candidate.startsAt) : 'Event start unknown'}</p></div><ApprovalStatusBadges facts={{ mode, archived: true, ownerAttested: record.snapshot.verification === 'user_confirmed', paperRegistered: !!paperResult, financialRegistered: !!actual, outcome: actual?.outcome }} compact /></div>
          <p className="text-xs">{candidate.market ?? 'Market unknown'} · {candidate.selection ?? 'Selection unknown'} · line {candidate.line ?? 'unknown'}</p>
          <dl className="grid gap-3 text-[11px] sm:grid-cols-3"><div><dt className="text-muted-foreground">Original research quote</dt><dd className="mt-1">{candidate.originalOdds ?? 'Unknown'} · {candidate.bookmaker ?? 'Unknown bookmaker'}</dd></div><div><dt className="text-muted-foreground">Original track / decision</dt><dd className="mt-1">Track {candidate.strategy ?? 'unknown'} · {labels.decision}</dd>{labels.classification && <p className="mt-1 text-amber-200">{labels.classification}</p>}</div><div><dt className="text-muted-foreground">Probability / confidence</dt><dd className="mt-1">{candidate.probability.value === null ? 'Not supplied' : percent(candidate.probability.value * 100)} · {candidate.confidence}</dd></div></dl>
          <p className="text-[11px] text-muted-foreground">Current owner decision: {actual ? 'Placed · financially registered' : paperResult ? 'Paper tracked' : latest?.decision ?? 'No position approved'}. {latest?.reason}</p>
          <details className="rounded-lg border border-border p-3"><summary className="cursor-pointer text-[11px]">Sources, risks, probability methodology and available legs</summary><div className="mt-3 space-y-2 text-[11px] text-muted-foreground"><p>Odds source: {candidate.oddsSource ?? 'Unknown'} · {candidate.oddsTimestamp ? dateTime(candidate.oddsTimestamp) : 'Quote timestamp unknown'}</p><p>Probability: {candidate.probability.origin ?? 'unknown'} · {candidate.probability.source ?? 'unknown'} · {candidate.probability.method ?? 'unknown'} · {candidate.probability.modelVersion ?? 'unknown'}</p><p>{candidate.rationale ?? 'Rationale not provided'} · {candidate.uncertainty ?? 'Uncertainty not supplied'}</p>{candidate.evidence.map((item, index) => <p key={index}>{item.claim} · {item.verification} · {item.sourceUrl ?? 'No source URL'}</p>)}{record.snapshot.legs.map((leg, index) => <p key={leg.id}>Leg {index + 1}: {leg.participant ?? 'unknown participant'} · {leg.selection ?? 'unknown selection'} · {leg.line ?? 'unknown line'} · source odds {leg.odds ?? 'unknown'}</p>)}<p>Supporting source claims are inspectable provenance, not independent verification. Add missing actual ticket legs in placement confirmation; no legs or SGM correlations are inferred.</p></div></details>
          {(record.snapshot.legs.length > 1 || /\b(?:sgm|parlay|same.game multi)\b/i.test(candidate.market ?? '')) && <p className="text-[11px] text-amber-200">Combined probability unavailable — correlation not validated. Original combined quote: {candidate.originalOdds ?? 'unknown'}; no theoretical combined price is inferred.</p>}
          <div className="flex flex-wrap gap-2"><Button size="sm" disabled={unavailable || !!actual} onClick={() => { setProblem(''); setPlacing(record); }}>Confirm Placed</Button><Button size="sm" variant="outline" disabled={unavailable || blockers.length > 0} onClick={() => { setProblem(''); setPaper(record); }}>Track as Paper</Button><Button size="sm" variant="ghost" disabled={unavailable || hasPosition || latest?.decision === 'watch'} onClick={() => { setReason(''); setProblem(''); setDecision({ record, value: 'watch' }); }}>Watch</Button><Button size="sm" variant="ghost" disabled={unavailable || hasPosition || latest?.decision === 'pass'} onClick={() => { setReason(''); setProblem(''); setDecision({ record, value: 'pass' }); }}>Pass</Button><Button size="sm" variant="ghost" asChild><Link href={`/imports?record=${record.id}`}>Source</Link></Button>{actual && <Button size="sm" variant="outline" asChild><Link href="/ledger">Linked actual wager</Link></Button>}{paperResult && <Button size="sm" variant="outline" asChild><Link href="/paper">Linked paper position</Link></Button>}</div>
          {blockers.length > 0 && <p className="text-[10px] text-muted-foreground">Paper action unavailable: {blockers[0]}</p>}
        </article>;
      })}</div> : <div className="empty-state min-h-36"><p>{unavailable ? 'Loading the current private workspace…' : 'No imported research selections in this session. Import a current response to start.'}</p><p className="mt-2 text-xs">Existing historical wager claims are evidence archives, not newly imported research or financial positions.</p></div>}
      {passes.filter(record=>session==='all'||researchSessionMetadata(record)?.responseId===session).length>0&&<section className="space-y-2 rounded-xl border border-border p-4" aria-label="Daily source-backed passes"><h4 className="text-sm font-medium">Passed opportunities / NO BET evidence</h4>{passes.filter(record=>session==='all'||researchSessionMetadata(record)?.responseId===session).map(record=><p key={record.id} className="text-xs text-muted-foreground">Day {researchSessionMetadata(record)?.researchDay} · {record.snapshot.event??'No fixture selected'} · {typeof (record.raw as {reason?:unknown}).reason==='string'?(record.raw as {reason:string}).reason:record.snapshot.notes} <Link className="text-primary underline" href={`/imports?record=${record.id}`}>Source</Link></p>)}</section>}
    </> : <ResultsWorkspace />}
    <details className="rounded-xl border border-border p-4"><summary className="cursor-pointer text-xs">Complete a research-day review · owner approval only</summary><div className="mt-3 space-y-3"><label><span className="label">Research day to complete</span><input className="input max-w-32" aria-label="Daily review day" value={day} inputMode="numeric" onChange={event => { setDay(event.target.value); setComplete(false); }} /></label><label className="flex gap-2 text-xs"><input type="checkbox" checked={complete} onChange={event => setComplete(event.target.checked)} /><span>I confirm this research-day review is complete. Unresolved positions carry forward. This does not verify or settle results and does not replace methodology.</span></label><Button size="sm" disabled={unavailable || busy || !complete || !sessions.length} onClick={() => void completeDay()}><ClipboardCheck />Confirm day completion</Button></div></details>
    {problem && <p role="alert" className="text-xs text-red-300">{problem}</p>}
    <Dialog open={importOpen} onOpenChange={setImportOpen}><DialogContent className="max-h-[90dvh] max-w-4xl overflow-y-auto"><DialogHeader><DialogTitle>Import daily research</DialogTitle><DialogDescription>Source import only. Placed, Paper, Watch and Pass are explicit decisions afterward.</DialogDescription></DialogHeader><ResponseReview archiveOnly onImported={() => setImportOpen(false)} previousProposals={previousProposals} contextLoading={contextLoading} templateContext={templateContext} /></DialogContent></Dialog>
    <BetForm open={!!placing} onOpenChange={open => { if (!open) setPlacing(undefined); }} research={placing ? researchPlacement(placing) : undefined} />
    <Dialog open={!!paper} onOpenChange={open => { if (!open && !busy) setPaper(undefined); }}><DialogContent><DialogHeader><DialogTitle>Approve pre-event paper tracking</DialogTitle><DialogDescription>The original forecast stays frozen; this creates no actual wager.</DialogDescription></DialogHeader>{paper && <div className="space-y-3 text-xs"><p>{paper.snapshot.event} · {paper.snapshot.selection} · {paper.snapshot.line}</p><p>Original odds: {paper.snapshot.odds ?? 'unknown'} · hypothetical stake: {paper.snapshot.stakeCents === null ? 'unknown; no default inferred' : money(paper.snapshot.stakeCents)}</p></div>}{problem && <p role="alert" className="text-xs text-red-300">{problem}</p>}<DialogFooter><Button variant="outline" disabled={busy} onClick={() => setPaper(undefined)}>Cancel</Button><Button disabled={busy || !paper || researchPaperBlockers(paper, history, data).length > 0} onClick={() => void track()}>Track as Paper</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={!!decision} onOpenChange={open => { if (!open && !busy) setDecision(undefined); }}><DialogContent><DialogHeader><DialogTitle>Record {decision?.value ?? 'research'} decision</DialogTitle><DialogDescription>This appends an owner decision without changing the original research.</DialogDescription></DialogHeader><label><span className="label">Reason / condition</span><textarea className="input min-h-24" value={reason} maxLength={1500} onChange={event => setReason(event.target.value)} /></label>{problem && <p role="alert" className="text-xs text-red-300">{problem}</p>}<DialogFooter><Button variant="outline" disabled={busy} onClick={() => setDecision(undefined)}>Cancel</Button><Button disabled={busy || !reason.trim()} onClick={() => void saveDecision()}>Save decision</Button></DialogFooter></DialogContent></Dialog>
  </section>;
}
