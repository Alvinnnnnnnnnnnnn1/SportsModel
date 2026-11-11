"use client";

import { useState } from "react";
import Link from "next/link";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { savedDailyCycles } from "@/lib/daily-cycle/archive";
import { FileCheck2, ShieldAlert } from "lucide-react";
import { useApp } from "../app-provider";
import { useHistory } from "../history-provider";
import { Button } from "../ui/button";
import { BetForm } from "../bet-form";
import {
  prepareDailyCycleSettlements,
  calculateDailyFeedback,
  recommendationToCandidate,
  reviewDailyCycle,
  type DailyCycleImportReview,
} from "@/lib/daily-cycle";
import {
  readDailyCycleCheckpoints,
  writeDailyFeedback,
  writeDailyCycleCheckpoint,
} from "@/lib/daily-cycle/storage";

export function DailyCycleReview() {
  const { data, mode, user, addPaper, applyResultBatch, notify } = useApp();
  const { history, saveDailyCycle, loading: historyLoading, error: historyError } = useHistory();
  const [confirmPrivate, setConfirmPrivate] = useState(false);
  const [privateReceipt, setPrivateReceipt] = useState<string>();
  const [text, setText] = useState("");
  const [review, setReview] = useState<DailyCycleImportReview>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState<string[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [placing, setPlacing] = useState<ReturnType<typeof recommendationToCandidate>>();
  const [paperSaved, setPaperSaved] = useState<string[]>([]);
  const scope = user?.id ?? "demo";
  const inspect = () => {
    setError("");
    setReview(undefined);
    setApplied([]);
    setSkipped([]);
    setPaperSaved([]);
    setPrivateReceipt(undefined); setConfirmPrivate(false);
    try {
      const previous = mode === "supabase" ? savedDailyCycles(history).map(item => item.cycleKey) : readDailyCycleCheckpoints(scope).map((item) => item.cycleKey);
      const next = reviewDailyCycle({ raw: JSON.parse(text), data, history, previousCycleKeys: previous });
      setReview(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Daily-cycle JSON could not be validated.");
    }
  };
  const apply = async () => {
    if (!review || review.duplicateCycle) return;
    if (mode !== "demo") {
      setConfirmPrivate(true);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const prepared = await prepareDailyCycleSettlements(review, data, history);
      if (prepared.response) {
        const result = await applyResultBatch(prepared.response, prepared.keys, history);
        setApplied(result.applied);
      }
      setSkipped(prepared.skipped);
      writeDailyCycleCheckpoint(scope, {
        cycleKey: review.cycleKey,
        cycle: review.cycle,
        appliedAt: new Date().toISOString(),
        settledKeys: prepared.keys,
        skippedKeys: prepared.skipped,
        feedback: calculateDailyFeedback(data),
      });
      writeDailyFeedback(scope, {
        version: 1,
        cycleKey: review.cycleKey,
        recordedAt: new Date().toISOString(),
        summary: calculateDailyFeedback(data),
        modelFeedback: review.cycle.modelFeedback,
      });
      notify(
        prepared.keys.length
          ? `Daily cycle applied locally: ${prepared.keys.length} result update(s) saved.`
          : "Daily cycle checkpoint saved locally. No deterministic result update was eligible.",
      );
      setReview({ ...review, duplicateCycle: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The daily cycle could not be applied.");
    } finally {
      setBusy(false);
    }
  };
  const savePrivate = async () => {
    if (!review || !confirmPrivate || !user || historyLoading || historyError) return;
    setBusy(true); setError("");
    try {
      const receipt = await saveDailyCycle(text);
      setPrivateReceipt(receipt.recordId); setConfirmPrivate(false);
      setReview({ ...review, duplicateCycle: true });
      notify("Private Daily Cycle saved and read back. No financial entry or paper position was registered.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The private cycle could not be confirmed. Reload before retrying."); }
    finally { setBusy(false); }
  };
  const recommendations = review && mode === "demo"
    ? [...review.cycle.betRecommendations.map((item) => ({ kind: "BET" as const, item })),
      ...review.cycle.paperRecommendations.map((item) => ({ kind: "PAPER" as const, item }))]
    : [];
  const approvePaper = async (candidateId: string) => {
    const recommendation = review?.cycle.paperRecommendations.find((item) => item.candidateId === candidateId);
    const candidate = recommendation ? recommendationToCandidate(recommendation) : null;
    if (!candidate) { setError("This PAPER proposal is missing a complete pre-event identity and cannot be registered."); return; }
    try { await addPaper(candidate); setPaperSaved((current) => [...current, candidateId]); notify("Paper prediction approved from the original daily-cycle proposal."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Paper approval failed."); }
  };
  return <section className="space-y-4" aria-label="Daily cycle import">
    {privateReceipt && <p role="status" className="text-xs text-primary">Private cycle saved and read back. <Link className="underline" href={`/imports?record=${privateReceipt}`}>Review immutable cycle and source records</Link>. Results and positions require their separate workflows.</p>}
    <Dialog open={confirmPrivate} onOpenChange={open=>{if(!busy)setConfirmPrivate(open);}}><DialogContent><DialogHeader><DialogTitle>Save private Daily Cycle</DialogTitle><DialogDescription>Preserve this source cycle, proposals and model feedback in your authenticated research archive.</DialogDescription></DialogHeader><p className="text-xs leading-relaxed">Original prices, timestamps, numerical claims and the complete JSON are retained. Unsupported probabilities remain source claims. This save does not register actual wagers, paper positions, funding or settlements. Review results separately in Results Review.</p>{error&&<p role="alert" className="text-xs text-red-300">{error}</p>}<DialogFooter><Button variant="outline" disabled={busy} onClick={()=>setConfirmPrivate(false)}>Cancel</Button><Button disabled={busy||historyLoading||!!historyError||!user} onClick={()=>void savePrivate()}>{busy?"Saving and verifying…":"Confirm research-only save"}</Button></DialogFooter></DialogContent></Dialog>
    <div><h3 className="text-sm font-medium">Import GPT Results</h3><p className="mt-2 text-xs leading-relaxed text-muted-foreground">Paste one standalone EDGELAB DAILY CYCLE JSON v1 block. It is untrusted evidence until reviewed; unresolved results remain pending.</p></div>
    <textarea aria-label="Daily-cycle JSON" className="input min-h-64 w-full font-mono text-[11px]" value={text} onChange={(event) => setText(event.target.value)} placeholder='{"format":"edgelab.daily-cycle","version":1,...}' />
    <div className="flex flex-wrap gap-2"><Button onClick={inspect} disabled={!text.trim() || busy || historyLoading || !!historyError || (mode === "supabase" && !user)}>Validate Daily Cycle</Button>{review && <Button variant="outline" onClick={() => void apply()} disabled={review.duplicateCycle || busy}>{busy ? "Applying…" : "Review &amp; Apply Daily Update"}</Button>}</div>
    {error && <p role="alert" className="rounded-lg border border-rose-400/20 bg-rose-400/5 p-3 text-xs text-rose-300">{error}</p>}
    {review && <div className="space-y-3 rounded-xl border border-border p-4" role="status"><div className="flex items-center gap-2 text-primary"><FileCheck2 className="size-4" /><p className="text-sm font-medium">Daily-cycle validated</p></div><div className="grid gap-2 text-xs sm:grid-cols-4"><div>Matched results <strong>{review.matchedResults}</strong></div><div>Unresolved <strong>{review.unresolvedResults}</strong></div><div>BET ideas <strong>{review.newBetRecommendations}</strong></div><div>PAPER ideas <strong>{review.newPaperRecommendations}</strong></div></div>{review.duplicateCycle && <p className="flex items-center gap-2 text-xs text-amber-200"><ShieldAlert className="size-4" />This cycle was already reviewed and cannot be applied again.</p>}{applied.length > 0 && <p className="text-xs text-emerald-300">{applied.length} deterministic result update(s) were saved through the audited settlement batch.</p>}{skipped.length > 0 && <p className="text-xs text-amber-200">{skipped.length} result update(s) remain pending because identity, evidence or settlement eligibility was incomplete.</p>}{review.warnings.map((warning) => <p key={warning} className="text-xs text-amber-200">{warning}</p>)}{recommendations.length > 0 && <div className="space-y-2 border-t border-border pt-3"><p className="text-xs font-medium">New proposals</p>{recommendations.map(({ kind, item }) => { const candidate = recommendationToCandidate(item); const saved = paperSaved.includes(item.candidateId); return <div key={item.candidateId} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"><div><p className="text-xs font-medium">{kind} · {item.selection ?? "Selection unavailable"}</p><p className="text-[11px] text-muted-foreground">{item.event ?? "Event unavailable"} · {item.market ?? "Market unavailable"} · quote {item.originalOdds ?? "unknown"}</p></div>{kind === "BET" ? <Button size="sm" disabled={!candidate} onClick={() => setPlacing(candidate)}>Record Placed Bet</Button> : <Button size="sm" variant="outline" disabled={!candidate || saved || review.duplicateCycle} onClick={() => void approvePaper(item.candidateId)}>{saved ? "Paper approved" : "Approve Paper Tracking"}</Button>}</div>; })}</div>}<p className="text-[11px] text-muted-foreground">BET proposals require accepted execution odds and stake before registration. PAPER proposals preserve the original forecast and never backdate late candidates.</p></div>}
    <BetForm open={!!placing} onOpenChange={(open) => { if (!open) setPlacing(undefined); }} candidate={placing ?? undefined} />
  </section>;
}
