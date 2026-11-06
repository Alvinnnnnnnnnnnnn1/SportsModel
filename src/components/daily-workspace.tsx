'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ClipboardCheck, Download, FileJson, ListChecks, RotateCcw, ShieldAlert } from 'lucide-react';
import { useApp } from './app-provider';
import { useHistory } from './history-provider';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { BetForm } from './bet-form';
import { ResponseReview } from './handoff/response-review';
import { ResultsWorkspace } from './results/results-workspace';
import { ApprovalStatusBadges } from './approval-status';
import { sourceResearchCandidate, researchActualLink, researchPaperBlockers, researchPlacement, latestDailyDecision, originalResearchLabels } from '@/lib/daily/research';
import { readResearchRecordLink } from '@/lib/daily/placement';
import { researchSessionMetadata, type PriorResearchSelection } from '@/lib/handoff/response';
import { prepareExperimentContextV2Preview } from '@/lib/handoff/methodology';
import type { HistoricalRecord } from '@/lib/imports/types';
import type { Bet, PaperPrediction } from '@/lib/domain/types';
import { dateTime, money, percent } from '@/lib/utils';

export function DailyWorkspace({ previousProposals = [], contextLoading = false, storageScope = 'local', templateContext }: { previousProposals?: PriorResearchSelection[]; contextLoading?: boolean; storageScope?: string; templateContext: { researchDate: string; researchDay: number; sessionId: string } }) {
  const app = useApp(); const store = useHistory();
  const { data, mode, notify, markBetEnteredInError, replaceBet, markPaperEnteredInError, replacePaper } = app; const { history, loading, error, registerResearchPaper, decideResearch, commitPreview } = store;
  const [section, setSection] = useState<'selections' | 'results'>('selections');
  const [importOpen, setImportOpen] = useState(false), [session, setSession] = useState('all');
  const [hiddenSessions, setHiddenSessions] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = window.localStorage.getItem(`edgelab:research-inbox:hidden:${mode}:${storageScope}`);
      return saved ? JSON.parse(saved) as string[] : [];
    } catch {
      return [];
    }
  });
  const [freshOpen, setFreshOpen] = useState(false), [incorrectOpen, setIncorrectOpen] = useState(false), [reviewOpen, setReviewOpen] = useState(false), [resetOpen, setResetOpen] = useState(false), [resetPhrase, setResetPhrase] = useState('');
  const [reviewedRecords, setReviewedRecords] = useState<Record<string, 'keep' | 'correct' | 'entered_in_error'>>({});
  const [reviewSelected, setReviewSelected] = useState<string[]>([]);
  const [placing, setPlacing] = useState<HistoricalRecord>(), [manualOpen, setManualOpen] = useState(false), [paper, setPaper] = useState<HistoricalRecord>();
  const [correctionRecord, setCorrectionRecord] = useState<{ id: string; type: 'Actual' | 'Paper'; source: Bet | PaperPrediction }>();
  const [correctionOdds, setCorrectionOdds] = useState(''), [correctionReason, setCorrectionReason] = useState(''), [correctionEvidence, setCorrectionEvidence] = useState(''), [correctionError, setCorrectionError] = useState('');
  const [errorRecord, setErrorRecord] = useState<typeof reviewRecords[number]>();
  const [errorReason, setErrorReason] = useState(''), [errorEvidence, setErrorEvidence] = useState(''), [acknowledgeExclusion, setAcknowledgeExclusion] = useState(false), [errorMutation, setErrorMutation] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [decision, setDecision] = useState<{ records: HistoricalRecord[]; value: 'watch' | 'pass' }>();
  const [batchPaper, setBatchPaper] = useState<HistoricalRecord[]>();
  const [reason, setReason] = useState(''), [busy, setBusy] = useState(false), [problem, setProblem] = useState('');
  const [complete, setComplete] = useState(false), [day, setDay] = useState(String(templateContext.researchDay));
  const records = useMemo(() => history.records.filter(record => sourceResearchCandidate(record)), [history.records]);
  const sessionRecords = history.records.filter(record=>researchSessionMetadata(record));
  const passes = sessionRecords.filter(record=>!sourceResearchCandidate(record));
  const sessions = [...new Map(sessionRecords.map(record => { const meta = researchSessionMetadata(record)!; return [meta.responseId, meta]; })).values()].reverse();
  const activeSession = sessions.find(meta => !hiddenSessions.includes(meta.responseId))?.responseId;
  const visible = records.filter(record => {
    const responseId = researchSessionMetadata(record)?.responseId;
    const selectedSession = session === 'all' ? activeSession : session;
    return responseId === selectedSession || (session !== 'all' && responseId === session);
  });
  const selectedRecords = visible.filter(record => selected.includes(record.id));
  const selectedEligiblePaper = selectedRecords.filter(record => researchPaperBlockers(record, history, data).length === 0);
  const selectedWithoutPosition = selectedRecords.filter(record => !researchActualLink(data, record.id) && !history.paperResults.some(result => result.recordId === record.id));
  const selectedPlaced = selectedRecords.filter(record => !researchActualLink(data, record.id));
  const unavailable = loading || app.loading || contextLoading || !!error || !!app.error || (mode === 'supabase' && !app.user);
  const reviewRecords = [
    ...data.bets.map(bet => ({ id: `actual:${bet.id}`, type: 'Actual' as const, source: bet, label: bet.legs.map(leg => `${leg.participant} · ${leg.selection} vs ${leg.event}`).join(' · '), date: bet.placedAt ?? bet.recordedAt ?? new Date().toISOString(), stake: money(bet.stakeCents), odds: bet.odds.toFixed(2), status: bet.outcome, lifecycle: bet.lifecycle ?? 'valid', link: readResearchRecordLink(bet.notes) })),
    ...data.paperPredictions.map(paper => ({ id: `paper:${paper.id}`, type: 'Paper' as const, source: paper, label: `${paper.candidate.participant} · ${paper.candidate.selection} vs ${paper.candidate.event}`, date: paper.registeredAt, stake: money(paper.hypotheticalStakeCents), odds: paper.candidate.odds.toFixed(2), status: paper.outcome, lifecycle: paper.lifecycle ?? 'valid', link: null })),
  ];
  function openCorrection(record: typeof reviewRecords[number]) {
    setCorrectionRecord(record);
    setCorrectionOdds(record.type === 'Actual' ? String(record.source.odds) : String(record.source.candidate.odds));
    setCorrectionReason('');
    setCorrectionEvidence('');
    setCorrectionError('');
  }
  async function saveCorrection() {
    if (!correctionRecord) return;
    try {
      const source = correctionRecord.source;
      if (correctionRecord.type === 'Actual') {
        const bet = source as Bet;
        await replaceBet(bet.id, { ...bet, id: crypto.randomUUID(), odds: Number(correctionOdds), legs: bet.legs.map(leg => ({ ...leg, odds: Number(correctionOdds) })) }, correctionReason, correctionEvidence);
      } else {
        const paper = source as PaperPrediction;
        await replacePaper(paper.id, { ...paper, id: crypto.randomUUID() }, correctionReason, correctionEvidence);
      }
      notify('Audited replacement saved. The original record remains preserved and excluded from active totals.');
      setCorrectionRecord(undefined);
    } catch (cause) {
      setCorrectionError(cause instanceof Error ? cause.message : 'The correction was not saved.');
    }
  }
  async function saveEnteredInError() {
    if (!errorRecord) return;
    try {
      if (errorRecord.type === 'Actual') await markBetEnteredInError(errorRecord.source.id, errorReason, errorEvidence, errorRecord.source.outcome === 'pending' || acknowledgeExclusion);
      else await markPaperEnteredInError(errorRecord.source.id, errorReason, errorEvidence);
      setReviewedRecords(current => ({ ...current, [errorRecord.id]: 'entered_in_error' }));
      notify('Original preserved and excluded from active totals.');
      setErrorRecord(undefined);
    } catch (cause) {
      setErrorMutation(cause instanceof Error ? cause.message : 'The record was not changed.');
    }
  }
  function startFresh() {
    const current = session === 'all' ? activeSession : session;
    if (!current) return;
    const next = [...new Set([...hiddenSessions, current])];
    setHiddenSessions(next);
    setSession('all');
    setSelected([]);
    window.localStorage.setItem(`edgelab:research-inbox:hidden:${mode}:${storageScope}`, JSON.stringify(next));
    setFreshOpen(false);
    notify('Research Inbox reset. Recorded bets, paper predictions and history were kept.');
  }
  function downloadInboxBackup() {
    const exportedAt = new Date().toISOString();
    const payload = { format: 'edgelab.research-inbox-backup', version: 1, exportedAt, records: visible, hiddenSessions };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `edgelab-research-inbox-${exportedAt.slice(0, 10)}.json`; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('A local backup of the visible research records was downloaded.');
  }
  function downloadBoardBackup() {
    const exportedAt = new Date().toISOString();
    const payload = { format: 'edgelab.working-board-backup', version: 1, exportedAt, workspaceMode: mode, appData: data, historicalWorkspace: history };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `edgelab-working-board-${exportedAt.slice(0, 10)}.json`; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('Complete working-board backup downloaded locally. No records were changed.');
  }
  function resetWorkingBoard() {
    if (resetPhrase !== 'RESET WORKING BOARD') return;
    startFresh();
    setResetPhrase('');
    setResetOpen(false);
    notify('Working Board reset for new research. Protected actual and paper records remain authoritative.');
  }

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
    try {     for (const record of decision.records) await decideResearch(record.id, decision.value, reason);
    notify(`${decision.records.length} ${decision.value === 'watch' ? 'watch' : 'pass'} decision${decision.records.length === 1 ? '' : 's'} saved; original research preserved.`); setDecision(undefined); setReason(''); setSelected([]); }
    catch (cause) { setProblem(cause instanceof Error ? cause.message : 'Decision could not be saved.'); }
    finally { setBusy(false); }
  }
  async function saveBatchPaper() {
    if (!batchPaper?.length) return;
    setBusy(true); setProblem('');
    const saved: string[] = [], blocked: string[] = [];
    try {
      for (const record of batchPaper) {
        const issues = researchPaperBlockers(record, history, data);
        if (issues.length) { blocked.push(record.snapshot.event ?? record.id); continue; }
        try { await registerResearchPaper(record.id); saved.push(record.id); } catch (cause) {
          blocked.push(`${record.snapshot.event ?? record.id}: ${cause instanceof Error ? cause.message : 'existing validation blocked this record'}`);
        }
      }
      notify(`${saved.length} paper prediction${saved.length === 1 ? '' : 's'} saved${blocked.length ? `; ${blocked.length} blocked and left unchanged` : ''}.`);
      if (blocked.length) setProblem(`Blocked rows were not changed: ${blocked.join(' ')}`);
      setBatchPaper(undefined); setSelected([]);
    } finally { setBusy(false); }
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
    <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="section-kicker mb-2">Today&apos;s decisions</div><h3 className="text-2xl font-semibold tracking-tight">Today&apos;s Research</h3><p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted-foreground">Import today&apos;s recommendations, choose what to keep, then review results when events finish.</p></div><div className="flex flex-wrap gap-2"><Button disabled={unavailable} onClick={() => setImportOpen(true)}><FileJson />Import JSON</Button><Button variant="outline" disabled={unavailable} onClick={() => setManualOpen(true)}>Add Bet</Button><Button variant="outline" disabled={unavailable} onClick={() => setReviewOpen(true)}>Review Existing Records</Button><Button variant="outline" disabled={unavailable || !activeSession} onClick={() => setResetOpen(true)}><RotateCcw />Reset Working Board</Button></div></div>
    <div className="flex flex-wrap items-center gap-3 text-xs"><button className="text-muted-foreground underline underline-offset-4" onClick={() => setIncorrectOpen(true)}><ShieldAlert className="mr-1 inline size-3" />Manage Incorrect Records</button><Button size="sm" variant={section === 'results' ? 'secondary' : 'ghost'} onClick={() => setSection('results')}><ListChecks />Check results</Button></div>
    {section === 'selections' ? <>
      <label className="block max-w-md"><span className="label">Research session</span><select className="input" value={session} onChange={event => setSession(event.target.value)}><option value="all">Latest session</option>{sessions.map(meta => <option key={meta.responseId} value={meta.responseId}>{hiddenSessions.includes(meta.responseId) ? 'History · ' : ''}Day {meta.researchDay} · {meta.researchDate}</option>)}</select></label>
      <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-background/95 p-3 shadow-lg backdrop-blur" aria-label="Research selection actions">
        <span className="mr-auto text-xs"><strong>{selectedRecords.length}</strong> selected · {selectedEligiblePaper.length} paper eligible · {selectedRecords.filter(record => researchActualLink(data, record.id) || history.paperResults.some(result => result.recordId === record.id)).length} already saved</span>
        <Button size="sm" variant="ghost" onClick={() => setSelected([])} disabled={!selected.length}>Clear</Button>
        <Button size="sm" variant="outline" onClick={() => setSelected(visible.filter(record => !researchActualLink(data, record.id) && !history.paperResults.some(result => result.recordId === record.id)).map(record => record.id))}>Select all eligible</Button>
        <Button size="sm" variant="outline" onClick={() => setSelected(visible.map(record => record.id))}>Select all</Button>
        <Button size="sm" variant="outline" disabled={!selectedEligiblePaper.length || busy} onClick={() => setBatchPaper(selectedEligiblePaper)}>Approve selected paper</Button>
        <Button size="sm" variant="ghost" disabled={!selectedWithoutPosition.length || busy} onClick={() => { setReason(''); setDecision({ records: selectedWithoutPosition, value: 'watch' }); }}>Watch selected</Button>
        <Button size="sm" variant="ghost" disabled={!selectedWithoutPosition.length || busy} onClick={() => { setReason(''); setDecision({ records: selectedWithoutPosition, value: 'pass' }); }}>Pass selected</Button>
        <Button size="sm" disabled={!selectedPlaced.length || busy} onClick={() => setPlacing(selectedPlaced[0])}>Review placed ({selectedPlaced.length})</Button>
      </div>
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
          <div className="flex flex-wrap items-center gap-2"><label className="flex items-center gap-2 text-[11px]"><input type="checkbox" checked={selected.includes(record.id)} onChange={event => setSelected(current => event.target.checked ? [...new Set([...current, record.id])] : current.filter(id => id !== record.id))} aria-label={`Select ${candidate.id}`} />Select</label>{hasPosition && <p className="text-[11px] font-medium text-primary">Already recorded</p>}<Button size="sm" disabled={unavailable || !!actual} onClick={() => { setProblem(''); setPlacing(record); }}>{actual ? 'Recorded as Actual' : 'Confirm Placed'}</Button><Button size="sm" variant="outline" disabled={unavailable || blockers.length > 0 || !!paperResult} onClick={() => { setProblem(''); setPaper(record); }}>{paperResult ? 'Recorded as Paper' : 'Track as Paper'}</Button><Button size="sm" variant="ghost" disabled={unavailable || hasPosition || latest?.decision === 'watch'} onClick={() => { setReason(''); setProblem(''); setDecision({ records: [record], value: 'watch' }); }}>Watch</Button><Button size="sm" variant="ghost" disabled={unavailable || hasPosition || latest?.decision === 'pass'} onClick={() => { setReason(''); setProblem(''); setDecision({ records: [record], value: 'pass' }); }}>Pass</Button><Button size="sm" variant="ghost" asChild><Link href={`/imports?record=${record.id}`}>Source</Link></Button>{actual && <Button size="sm" variant="outline" asChild><Link href="/ledger">Linked actual wager</Link></Button>}{paperResult && <Button size="sm" variant="outline" asChild><Link href="/paper">Linked paper position</Link></Button>}</div>
          {blockers.length > 0 && <p className="text-[10px] text-muted-foreground">Paper action unavailable: {blockers[0]}</p>}
        </article>;
      })}</div> : <div className="empty-state min-h-36"><p>{unavailable ? 'Loading the current private workspace…' : 'No imported research selections in this session. Import a current response to start.'}</p><p className="mt-2 text-xs">Existing historical wager claims are evidence archives, not newly imported research or financial positions.</p></div>}
      {passes.filter(record=>session==='all'||researchSessionMetadata(record)?.responseId===session).length>0&&<section className="space-y-2 rounded-xl border border-border p-4" aria-label="Daily source-backed passes"><h4 className="text-sm font-medium">Passed opportunities / NO BET evidence</h4>{passes.filter(record=>session==='all'||researchSessionMetadata(record)?.responseId===session).map(record=><p key={record.id} className="text-xs text-muted-foreground">Day {researchSessionMetadata(record)?.researchDay} · {record.snapshot.event??'No fixture selected'} · {typeof (record.raw as {reason?:unknown}).reason==='string'?(record.raw as {reason:string}).reason:record.snapshot.notes} <Link className="text-primary underline" href={`/imports?record=${record.id}`}>Source</Link></p>)}</section>}
    </> : <ResultsWorkspace />}
    <details className="rounded-xl border border-border p-4"><summary className="cursor-pointer text-xs">Complete a research-day review · owner approval only</summary><div className="mt-3 space-y-3"><label><span className="label">Research day to complete</span><input className="input max-w-32" aria-label="Daily review day" value={day} inputMode="numeric" onChange={event => { setDay(event.target.value); setComplete(false); }} /></label><label className="flex gap-2 text-xs"><input type="checkbox" checked={complete} onChange={event => setComplete(event.target.checked)} /><span>I confirm this research-day review is complete. Unresolved positions carry forward. This does not verify or settle results and does not replace methodology.</span></label><Button size="sm" disabled={unavailable || busy || !complete || !sessions.length} onClick={() => void completeDay()}><ClipboardCheck />Confirm day completion</Button></div></details>
    {problem && <p role="alert" className="text-xs text-red-300">{problem}</p>}
    <Dialog open={resetOpen} onOpenChange={setResetOpen}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Reset Working Board</DialogTitle><DialogDescription>Prepare a clean active board without deleting authoritative records.</DialogDescription></DialogHeader><div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-5"><div><p className="text-muted-foreground">Research</p><p className="mt-1 text-lg">{records.length}</p></div><div><p className="text-muted-foreground">Actual</p><p className="mt-1 text-lg">{data.bets.length}</p></div><div><p className="text-muted-foreground">Paper</p><p className="mt-1 text-lg">{data.paperPredictions.length + history.paperResults.length}</p></div><div><p className="text-muted-foreground">Pending results</p><p className="mt-1 text-lg">{data.bets.filter(bet => bet.outcome === 'pending').length}</p></div><div><p className="text-muted-foreground">Historical</p><p className="mt-1 text-lg">{history.records.length}</p></div></div><p className="text-xs leading-relaxed text-muted-foreground">The reset hides the current research session from the active view and clears unsaved selections. Imported source records, actual wagers, paper registrations, settlements, payouts, funding totals and audit history remain unchanged. Existing registered records are not silently superseded.</p><p className="rounded-lg border border-amber-200/20 p-3 text-xs text-amber-200">Any incorrect actual or paper record still needs individual reconciliation through the audited ledger, paper or historical workflows.</p><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={downloadBoardBackup}><Download />Create backup</Button><Button variant="outline" onClick={() => setFreshOpen(true)}>Review session reset</Button></div><label className="block text-xs"><span className="label">Type RESET WORKING BOARD to continue</span><input className="input mt-2" value={resetPhrase} onChange={event => setResetPhrase(event.target.value)} placeholder="RESET WORKING BOARD" /></label><DialogFooter><Button variant="outline" onClick={() => setResetOpen(false)}>Cancel</Button><Button disabled={resetPhrase !== 'RESET WORKING BOARD'} onClick={resetWorkingBoard}>Confirm Reset</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={freshOpen} onOpenChange={setFreshOpen}><DialogContent><DialogHeader><DialogTitle>Start Fresh</DialogTitle><DialogDescription>Start with a clean Research Inbox? Your recorded bets, paper predictions and history will be kept.</DialogDescription></DialogHeader><p className="text-xs leading-relaxed text-muted-foreground">This hides the current research session from the default inbox and clears only unsaved selections. It does not delete source records, financial wagers, paper predictions or audit history. You can reopen it from the History session list.</p><DialogFooter><Button variant="outline" onClick={() => setFreshOpen(false)}>Cancel</Button><Button onClick={startFresh}>Start Fresh</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={incorrectOpen} onOpenChange={setIncorrectOpen}><DialogContent><DialogHeader><DialogTitle>Manage Incorrect Records</DialogTitle><DialogDescription>Corrections are separate from Start Fresh and never silently delete financial history.</DialogDescription></DialogHeader><p className="text-xs leading-relaxed text-muted-foreground">Review individual actual, paper and historical records through their existing audited workflows. Original research, odds and registration timestamps remain immutable.</p><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={downloadInboxBackup}><Download />Download backup</Button><Button asChild><Link href="/ledger">Review actual records</Link></Button><Button asChild variant="outline"><Link href="/paper">Review paper records</Link></Button><Button asChild variant="outline"><Link href="/imports">Review historical records</Link></Button></div></DialogContent></Dialog>
    <Dialog open={reviewOpen} onOpenChange={setReviewOpen}><DialogContent className="max-w-5xl"><DialogHeader><DialogTitle>Review Existing Records</DialogTitle><DialogDescription>Keep, correct or explicitly mark an administrative mistake. Original evidence is never deleted.</DialogDescription></DialogHeader><div className="flex flex-wrap gap-2 text-xs"><Button size="sm" variant="outline" onClick={() => setReviewSelected(reviewRecords.map(record => record.id))}>Select all</Button><Button size="sm" variant="ghost" onClick={() => setReviewSelected([])}>Clear</Button><span className="self-center text-muted-foreground">{reviewSelected.length} selected · hosted corrections disabled</span></div><div className="max-h-[55vh] overflow-auto rounded-lg border border-border"><table className="data-table"><thead><tr><th>Select</th><th>Selection / opponent</th><th>Type</th><th>Date</th><th>Stake</th><th>Odds</th><th>Result</th><th>Lifecycle</th><th>Review</th></tr></thead><tbody>{reviewRecords.map(record => <tr key={record.id}><td><input type="checkbox" aria-label={`Select ${record.label}`} checked={reviewSelected.includes(record.id)} onChange={event => setReviewSelected(current => event.target.checked ? [...current, record.id] : current.filter(id => id !== record.id))} /></td><td>{record.label}</td><td>{record.type}</td><td>{dateTime(record.date)}</td><td>{record.stake}</td><td>{record.odds}</td><td className="capitalize">{record.status}</td><td className="capitalize">{record.lifecycle.replaceAll('_', ' ')}</td><td><div className="flex gap-1"><Button size="sm" variant={reviewedRecords[record.id] === 'keep' ? 'secondary' : 'ghost'} onClick={() => setReviewedRecords(current => ({ ...current, [record.id]: 'keep' }))}>Keep</Button><Button size="sm" disabled={mode !== 'demo'} variant={reviewedRecords[record.id] === 'correct' ? 'secondary' : 'outline'} onClick={() => { setReviewedRecords(current => ({ ...current, [record.id]: 'correct' })); openCorrection(record); }}>Correct</Button>    <Button size="sm" disabled={mode !== 'demo'} variant={reviewedRecords[record.id] === 'entered_in_error' ? 'secondary' : 'outline'} onClick={() => { setErrorRecord(record); setErrorReason(''); setErrorEvidence(''); setAcknowledgeExclusion(false); setErrorMutation(''); }}>Entered in Error</Button></div></td></tr>)}</tbody></table></div><p className="text-[11px] leading-relaxed text-muted-foreground">{mode === 'demo' ? 'Demo-only correction commands are enabled. Settled actual records require evidence and explicit accounting acknowledgement.' : 'Hosted correction and replacement actions are disabled until separately approved and deployed.'}</p><DialogFooter><Button variant="outline" onClick={() => setReviewOpen(false)}>Close review</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={!!correctionRecord} onOpenChange={open => { if (!open) setCorrectionRecord(undefined); }}><DialogContent><DialogHeader><DialogTitle>Correct with linked replacement</DialogTitle><DialogDescription>The original remains in history. This creates one replacement and excludes the superseded record from active totals.</DialogDescription></DialogHeader><div className="space-y-3"><label className="block text-xs"><span className="label">Corrected accepted odds</span><input className="input mt-1" value={correctionOdds} onChange={event => setCorrectionOdds(event.target.value)} disabled={correctionRecord?.type === 'Paper'} /></label><label className="block text-xs"><span className="label">Correction reason</span><textarea className="input mt-1 min-h-20" value={correctionReason} onChange={event => setCorrectionReason(event.target.value)} /></label><label className="block text-xs"><span className="label">Evidence/reference</span><input className="input mt-1" value={correctionEvidence} onChange={event => setCorrectionEvidence(event.target.value)} placeholder="Owner note, ticket or local evidence ID" /></label>{correctionError && <p role="alert" className="text-xs text-red-300">{correctionError}</p>}</div><DialogFooter><Button variant="outline" onClick={() => setCorrectionRecord(undefined)}>Cancel</Button><Button onClick={saveCorrection} disabled={mode !== 'demo' || correctionReason.trim().length < 10 || !correctionEvidence.trim()}>Create linked replacement</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={!!errorRecord} onOpenChange={open => { if (!open) setErrorRecord(undefined); }}><DialogContent><DialogHeader><DialogTitle>Enter record in error</DialogTitle><DialogDescription>This preserves the original and records an audited exclusion. A genuine settled loss cannot be removed.</DialogDescription></DialogHeader><div className="space-y-3"><p className="rounded-lg border border-amber-200/20 p-3 text-xs text-amber-200">Result: {errorRecord?.status}. Active accounting impact: {errorRecord?.source.outcome === 'pending' ? 'pending exposure removed' : 'settled record excluded only with evidence and explicit confirmation'}.</p><label className="block text-xs"><span className="label">Administrative mistake</span><textarea className="input mt-1 min-h-20" value={errorReason} onChange={event => setErrorReason(event.target.value)} placeholder="Explain the duplicate or data-entry mistake" /></label><label className="block text-xs"><span className="label">Evidence/reference</span><input className="input mt-1" value={errorEvidence} onChange={event => setErrorEvidence(event.target.value)} placeholder="Local evidence or owner confirmation reference" /></label>{errorRecord?.source.outcome !== 'pending' && <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={acknowledgeExclusion} onChange={event => setAcknowledgeExclusion(event.target.checked)} /> I confirm this settled record is an administrative error, not a genuine wager result.</label>}{errorMutation && <p role="alert" className="text-xs text-red-300">{errorMutation}</p>}</div><DialogFooter><Button variant="outline" onClick={() => setErrorRecord(undefined)}>Cancel</Button><Button onClick={saveEnteredInError} disabled={mode !== 'demo' || errorReason.trim().length < 10 || !errorEvidence.trim() || (errorRecord?.source.outcome !== 'pending' && !acknowledgeExclusion)}>Confirm audited exclusion</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={importOpen} onOpenChange={setImportOpen}><DialogContent className="max-h-[90dvh] max-w-4xl overflow-y-auto"><DialogHeader><DialogTitle>Import daily research</DialogTitle><DialogDescription>Source import only. Placed, Paper, Watch and Pass are explicit decisions afterward.</DialogDescription></DialogHeader><ResponseReview archiveOnly onImported={() => { setImportOpen(false); setSession('all'); setSelected([]); }} previousProposals={previousProposals} contextLoading={contextLoading} templateContext={templateContext} /></DialogContent></Dialog>
    <BetForm open={manualOpen || !!placing} onOpenChange={open => { if (!open) { setPlacing(undefined); setManualOpen(false); } }} research={placing ? researchPlacement(placing) : undefined} />
    <Dialog open={!!paper} onOpenChange={open => { if (!open && !busy) setPaper(undefined); }}><DialogContent><DialogHeader><DialogTitle>Approve pre-event paper tracking</DialogTitle><DialogDescription>The original forecast stays frozen; this creates no actual wager.</DialogDescription></DialogHeader>{paper && <div className="space-y-3 text-xs"><p>{paper.snapshot.event} · {paper.snapshot.selection} · {paper.snapshot.line}</p><p>Original odds: {paper.snapshot.odds ?? 'unknown'} · hypothetical stake: {paper.snapshot.stakeCents === null ? 'unknown; no default inferred' : money(paper.snapshot.stakeCents)}</p></div>}{problem && <p role="alert" className="text-xs text-red-300">{problem}</p>}<DialogFooter><Button variant="outline" disabled={busy} onClick={() => setPaper(undefined)}>Cancel</Button><Button disabled={busy || !paper || researchPaperBlockers(paper, history, data).length > 0} onClick={() => void track()}>Track as Paper</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={!!decision} onOpenChange={open => { if (!open && !busy) setDecision(undefined); }}><DialogContent><DialogHeader><DialogTitle>Record {decision?.value ?? 'research'} decision</DialogTitle><DialogDescription>Save this owner decision for {decision?.records.length ?? 0} selected candidate{decision?.records.length === 1 ? '' : 's'}. Original research remains unchanged.</DialogDescription></DialogHeader><label><span className="label">Reason / condition</span><textarea className="input min-h-24" value={reason} maxLength={1500} onChange={event => setReason(event.target.value)} /></label>{problem && <p role="alert" className="text-xs text-red-300">{problem}</p>}<DialogFooter><Button variant="outline" disabled={busy} onClick={() => setDecision(undefined)}>Cancel</Button><Button disabled={busy || !reason.trim()} onClick={() => void saveDecision()}>Save decision</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={!!batchPaper} onOpenChange={open => { if (!open && !busy) setBatchPaper(undefined); }}><DialogContent><DialogHeader><DialogTitle>Approve selected paper predictions</DialogTitle><DialogDescription>Only rows that passed the existing pre-event eligibility and duplicate checks are staged. No actual wager or bankroll entry is created.</DialogDescription></DialogHeader><p className="text-xs">{batchPaper?.length ?? 0} eligible candidate{batchPaper?.length === 1 ? '' : 's'} will be registered.</p>{problem && <p role="alert" className="text-xs text-red-300">{problem}</p>}<DialogFooter><Button variant="outline" disabled={busy} onClick={() => setBatchPaper(undefined)}>Cancel</Button><Button disabled={busy} onClick={() => void saveBatchPaper()}>Confirm paper approval</Button></DialogFooter></DialogContent></Dialog>
  </section>;
}
