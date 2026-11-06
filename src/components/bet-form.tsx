"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  SPORTS,
  STRATEGIES,
  type Bet,
  type BetLeg,
  type Candidate,
  type Outcome,
  type Sport,
  type Strategy,
} from "@/lib/domain/types";
import { ApprovalStatusBadges } from "@/components/approval-status";
import { money, dateTime } from "@/lib/utils";
import { betReturn } from "@/lib/domain/calculations";
import { readResearchRecordLink, withResearchRecordLink, type ResearchPlacement } from "@/lib/daily/placement";
import { enteredMoneyCents, melbourneInput, originalOrEnteredTimestamp, readLedgerEvidence, reviewLedgerEntry, writeLedgerEvidence } from "@/lib/domain/ledger-review";

const outcomeLabels: Record<Outcome, string> = {
  pending: "Pending",
  won: "Won",
  lost: "Lost",
  void: "Void",
};

type LegDraft = Omit<BetLeg, "odds" | "sport"> & { odds: string; sport: Sport | "" };
function newLeg(candidate?: Candidate): LegDraft {
  return {
    id: crypto.randomUUID(), sport: candidate?.sport ?? "NBA",
    event: candidate?.event ?? "", participant: candidate?.participant ?? "",
    market: candidate?.market ?? "", selection: candidate?.selection ?? "", line: candidate?.line ?? "",
    odds: "", outcome: "pending", statistic: "",
  };
}

interface BetFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Bet;
  candidate?: Candidate;
  research?: ResearchPlacement;
}

export function BetForm({
  open,
  onOpenChange,
  initial,
  candidate,
  research,
}: BetFormProps) {
  const [saving, setSaving] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!saving) onOpenChange(value);
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        {open && (
          <BetFormDraft
            key={initial?.id ?? candidate?.id ?? research?.recordId ?? "new"}
            onOpenChange={onOpenChange}
            initial={initial}
            candidate={candidate}
            research={research}
            saving={saving}
            setSaving={setSaving}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function BetFormDraft({
  onOpenChange,
  initial,
  candidate,
  research,
  saving,
  setSaving,
}: Omit<BetFormProps, "open"> & {
  saving: boolean;
  setSaving: (saving: boolean) => void;
}) {
  const { data, mode, user, addBet, updateBet, notify } = useApp();
  const linkedResearch = candidate ?? data.candidates.find(item => item.id === initial?.candidateId) ?? data.paperPredictions.find(item => item.candidate.id === initial?.candidateId)?.candidate;
  const identity = mode === "demo" ? "demo" : user?.id ?? "signed-out";
  const [openedIdentity] = useState(identity);
  const [bookmaker, setBookmaker] = useState(
    initial?.bookmaker ?? candidate?.bookmaker ?? research?.bookmaker ?? "",
  );
  const [stake, setStake] = useState(
    ((initial?.stakeCents ?? data.settings.defaultStakeCents) / 100).toFixed(2),
  );
  const [stakeType, setStakeType] = useState<Bet["stakeType"]>(
    initial?.stakeType ?? "cash",
  );
  const [odds, setOdds] = useState(
    initial ? String(initial.odds) : "",
  );
  const [placedAt, setPlacedAt] = useState(
    initial?.placedAt ? melbourneInput(initial.placedAt) : "",
  );
  const [placementMode, setPlacementMode] = useState<"now" | "earlier">(
    initial ? "earlier" : "now",
  );
  const [strategy, setStrategy] = useState<Strategy | "">(
    initial?.strategy ?? candidate?.strategy ?? research?.strategy ?? (research ? "" : "A"),
  );
  const [outcome, setOutcome] = useState<Outcome>(
    initial?.outcome ?? "pending",
  );
  const [legs, setLegs] = useState<LegDraft[]>(() =>
    initial ? initial.legs.map((leg) => ({ ...leg, odds: String(leg.odds) })) : research ? (research.legs.length ? research.legs.map(leg => ({ id: crypto.randomUUID(), sport: leg.sport ?? "" as const, event: leg.event ?? "", participant: leg.participant ?? "", market: leg.market ?? "", selection: leg.selection ?? "", line: leg.line ?? "", odds: "", outcome: "pending" as const, statistic: "" })) : [{ ...newLeg(), sport: "" as const }]) : [newLeg(candidate)],
  );
  const [notes, setNotes] = useState(initial ? readLedgerEvidence(initial.notes).notes : "");
  const [ticketReference, setTicketReference] = useState(initial ? readLedgerEvidence(initial.notes).ticketReference : "");
  const [settledAt, setSettledAt] = useState(initial?.settledAt ? melbourneInput(initial.settledAt) : "");
  const [payout, setPayout] = useState(() => { const recorded = initial ? readLedgerEvidence(initial.notes).payoutCents : null; return recorded === null ? "" : (recorded / 100).toFixed(2); });
  const [confirmed, setConfirmed] = useState(false);
  const [reviewBet, setReviewBet] = useState<Bet | null>(null);
  const [reviewIssues, setReviewIssues] = useState<string[]>([]);
  const [draftId] = useState(() => initial?.id ?? crypto.randomUUID());
  const [error, setError] = useState("");
  const predictionLinked = Boolean(initial?.candidateId || candidate);

  function changeLeg(id: string, update: Partial<LegDraft>) {
    setLegs((current) =>
      current.map((leg) => (leg.id === id ? { ...leg, ...update } : leg)),
    );
  }

  function changeOutcome(value: Outcome) {
    setOutcome(value);
    if (legs.length === 1)
      setLegs((current) => current.map((leg) => ({ ...leg, outcome: value })));
  }

  const requirements = [
    ...(!bookmaker.trim() ? ["Enter the bookmaker."] : []),
    ...(!strategy ? ["Choose the actual wager research track; unknown source classifications are not inferred."] : []),
    ...(!odds || !Number.isFinite(Number(odds)) || Number(odds) <= 1 ? ["Enter the accepted execution odds; a research quote is not an accepted price."] : []),
    ...(outcome !== "pending" && !settledAt ? ["Enter the original settlement date and time."] : []),
    ...legs.flatMap((leg, index) => {
      const missing = [!leg.sport && "sport", !leg.participant.trim() && "participant", !leg.event.trim() && "fixture", !leg.market.trim() && "market", !leg.selection.trim() && "selection", !leg.line.trim() && "threshold", legs.length > 1 && (!leg.odds || Number(leg.odds) <= 1) && "leg odds"].filter(Boolean);
      return missing.length ? [`Leg ${index + 1}: enter ${missing.join(", ")}.`] : [];
    }),
  ];

  function inspect(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setReviewIssues([]); setConfirmed(false);
    if (identity !== openedIdentity) { setError("This workspace changed. Close and reopen the entry before reviewing it."); return; }
    if (mode === "supabase" && candidate?.oddsProvenance.simulated) { setError("Synthetic research stays in Demo; it cannot enter the private ledger."); return; }
    try {
      const cents = enteredMoneyCents(stake, "a stake");
      const placement = placementMode === "now" && !initial
        ? new Date().toISOString()
        : placedAt ? originalOrEnteredTimestamp(placedAt, initial?.placedAt ?? undefined) : null;
      const unchangedSettlement = !!initial && initial.outcome === outcome && initial.odds === Number(odds) && initial.stakeCents === cents && initial.stakeType === stakeType;
      const recordedPayout = outcome === "pending" || !payout.trim() ? null : enteredMoneyCents(payout, "the cash payout", true);
      const value = {
        id: draftId, placedAt: placement,
        ...(outcome === "pending" ? {} : { settledAt: originalOrEnteredTimestamp(settledAt, initial?.settledAt) }),
        bookmaker: bookmaker.trim(), stakeCents: cents, stakeType, odds: Number(odds), outcome, strategy,
        legs: legs.map(leg => ({ ...leg, odds: Number(legs.length === 1 ? odds : leg.odds), event: leg.event.trim(), participant: leg.participant.trim(), market: leg.market.trim(), selection: leg.selection.trim(), line: leg.line.trim(), statistic: leg.statistic?.trim() || undefined })),
        notes: research ? withResearchRecordLink(writeLedgerEvidence(notes, ticketReference, recordedPayout), research.recordId) : initial && readResearchRecordLink(initial.notes) ? withResearchRecordLink(writeLedgerEvidence(notes, ticketReference, recordedPayout), readResearchRecordLink(initial.notes)!) : writeLedgerEvidence(notes, ticketReference, recordedPayout),
        confirmedAt: initial?.confirmedAt ?? new Date().toISOString(),
        ...(initial?.probability !== undefined ? { probability: initial.probability } : candidate?.probability !== undefined ? { probability: candidate.probability } : {}),
        ...(initial?.candidateId ? { candidateId: initial.candidateId } : candidate ? { candidateId: candidate.id } : {}),
        recordedAt: new Date().toISOString(),
        placementStatus: placement ? "known_owner_attested" : "unknown_owner_reported",
        lifecycle: placement ? "valid" : "provisional",
        oddsProvenance: initial?.oddsProvenance ?? { source: mode === "demo" ? "Synthetic manual bookmaker record" : "Manual bookmaker record", timestamp: new Date().toISOString(), method: "Owner-entered accepted price; no live verification", modelVersion: "manual-entry-v1", simulated: mode === "demo" },
        ...(initial?.probabilityProvenance ? { probabilityProvenance: initial.probabilityProvenance } : candidate?.probabilityProvenance ? { probabilityProvenance: candidate.probabilityProvenance } : {}),
      };
      // A non-financial edit preserves an existing settled return without pretending
      // its calculated value is newly supplied external payout evidence.
      const reviewed = reviewLedgerEntry(value, recordedPayout ?? (initial && unchangedSettlement && initial.outcome !== "pending" ? betReturn(initial) : null));
      if (!reviewed.bet) { setReviewIssues(reviewed.issues); setError("Resolve the outstanding requirements before financial review."); return; }
      setReviewBet(reviewed.bet);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "This entry could not be reviewed."); }
  }

  async function saveReviewed() {
    if (!reviewBet || !confirmed || saving) return;
    if (identity !== openedIdentity) { setError("This workspace changed. Close and reopen the entry before saving."); return; }
    setSaving(true); setError("");
    try {
      if (initial) await updateBet(reviewBet); else await addBet(reviewBet);
      notify(initial ? "Ledger update saved · audit history preserved" : "Financial registration saved · no funding created");
      onOpenChange(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Your changes were not saved."); }
    finally { setSaving(false); }
  }

  if (identity !== openedIdentity) return <><DialogHeader><DialogTitle>Workspace changed</DialogTitle><DialogDescription>This unsaved entry belongs to the previous workspace. Close it and reopen the intended workspace before recording a wager.</DialogDescription></DialogHeader><DialogFooter><Button onClick={() => onOpenChange(false)}>Close unsaved entry</Button></DialogFooter></>;

  if (reviewBet) return <>
    <DialogHeader><DialogTitle>{initial ? reviewBet.outcome !== "pending" ? "Review wager settlement / update" : "Review audited ledger update" : "Review financial registration"}</DialogTitle><DialogDescription>Review once, then explicitly authorize the financial save. This records a manually placed wager; no bet is submitted and no deposit is created.</DialogDescription></DialogHeader>
    <ApprovalStatusBadges facts={{ mode, financialRegistered: !!initial, ownerAttested: !!initial, outcome: initial?.outcome }} />
    <dl className="grid grid-cols-2 gap-4 rounded-xl border border-border p-4 text-xs">
      <div><dt className="text-muted-foreground">Accepted / final settlement odds</dt><dd className="mt-1">{reviewBet.odds}</dd></div><div><dt className="text-muted-foreground">Stake</dt><dd className="mt-1">{money(reviewBet.stakeCents)} · {reviewBet.stakeType}</dd></div>
      <div><dt className="text-muted-foreground">Placed at · Melbourne</dt><dd className="mt-1">{reviewBet.placedAt ? dateTime(reviewBet.placedAt) : "Unknown historical placement time"}</dd></div><div><dt className="text-muted-foreground">Outcome</dt><dd className="mt-1 capitalize">{reviewBet.outcome}</dd></div>
      {reviewBet.settledAt && <div><dt className="text-muted-foreground">Settled at · Melbourne</dt><dd className="mt-1">{dateTime(reviewBet.settledAt)}</dd></div>}
      {reviewBet.outcome !== "pending" && <div><dt className="text-muted-foreground">Calculated cash return</dt><dd className="mt-1">{money(betReturn(reviewBet))}</dd><p className="mt-1 text-[10px] text-muted-foreground">{payout.trim() ? "Matches the entered payout." : "Existing registered return retained; no new external payout evidence supplied."}</p></div>}
      <div><dt className="text-muted-foreground">Bookmaker / ticket</dt><dd className="mt-1">{reviewBet.bookmaker} · {ticketReference || "Ticket reference not supplied"}</dd></div><div><dt className="text-muted-foreground">Research strategy</dt><dd className="mt-1">Track {reviewBet.strategy}</dd></div>
    </dl>
    <section className="space-y-2" aria-label="Reviewed wager selections">{reviewBet.legs.map((leg,index)=><div key={leg.id} className="rounded-lg border border-border p-3 text-xs"><p>{index+1}. {leg.sport} · {leg.event} · {leg.participant}</p><p className="mt-1 text-muted-foreground">{leg.market} · {leg.selection} · line {leg.line} · price {leg.odds} · {leg.outcome}</p></div>)}</section>
    <label className="flex items-start gap-3 rounded-lg border border-border p-3 text-xs leading-relaxed"><input type="checkbox" checked={confirmed} onChange={event=>setConfirmed(event.target.checked)} /><span>{mode === "demo" ? "I confirm this is a synthetic ledger test." : "I confirm these details match my manually placed wager."} I authorize {initial ? "this audited ledger update" : "financial registration"} and its effect on actual-ledger totals.</span></label>
    {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
    <DialogFooter><Button variant="ghost" disabled={saving} onClick={()=>onOpenChange(false)}>Cancel</Button><Button variant="outline" disabled={saving} onClick={()=>{setReviewBet(null);setConfirmed(false);setError("");}}>Back to entry</Button><Button disabled={!confirmed||saving} onClick={()=>void saveReviewed()}>{saving ? "Saving…" : initial ? reviewBet.outcome !== "pending" ? "Confirm settlement / audited update" : "Confirm audited changes" : "Confirm financial registration"}</Button></DialogFooter>
  </>;

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {initial ? "Edit ledger entry" : "Record a manual bet"}
        </DialogTitle>
        <DialogDescription>
          {mode === "demo"
            ? "DEMO · This records synthetic activity in your local demo ledger."
            : "Record a bet you placed manually. EdgeLab never submits wagers."}{" "}
          {initial
            ? "All changes are recorded in the audit history."
            : "Paper predictions are tracked separately."}
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={inspect} className="space-y-6">
        <ApprovalStatusBadges facts={{ mode, financialRegistered: !!initial, ownerAttested: !!initial, outcome: initial?.outcome }} />
        {linkedResearch && <p className="rounded-lg border border-border p-3 text-xs text-muted-foreground">Linked original research: {linkedResearch.selection} · research quote {linkedResearch.odds}. The accepted execution price must be entered separately; the original forecast stays unchanged.</p>}
        {research && <div className="rounded-lg border border-primary/20 p-3 text-xs"><p>Imported research is prefilled below. Original quote: {research.quoteOdds ?? "unknown"} · quoted {research.quoteTimestamp ? dateTime(research.quoteTimestamp) : "time unknown"}. Enter accepted execution details once; the original source remains unchanged.</p><p className="mt-2 break-words text-[10px] text-muted-foreground">Source: {research.sourceReference} · Record {research.recordId}</p>{research.legs.some(leg=>leg.odds!==null)&&<p className="mt-2 text-[10px] text-muted-foreground">Research leg prices: {research.legs.map((leg,index)=>`${index+1}: ${leg.odds??"unknown"}`).join(" · ")}. These are source quotes, not accepted leg execution prices.</p>}</div>}
        <section className="rounded-lg border border-border p-3" aria-label="Ledger entry requirements"><p className="text-xs font-medium">{requirements.length ? `${requirements.length} outstanding requirements` : "Entry fields ready for validation"}</p>{requirements.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] text-muted-foreground">{requirements.map(item=><li key={item}>{item}</li>)}</ul>}<p className="mt-2 text-[10px] text-muted-foreground">This form is an unsaved draft until the final financial confirmation. Unknown facts must not be guessed.</p></section>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span className="label">Bookmaker</span>
            <Input
              value={bookmaker}
              onChange={(event) => setBookmaker(event.target.value)}
              placeholder={
                mode === "demo" ? "e.g. Demo Sports" : "Bookmaker name"
              }
              maxLength={120}
              required
            />
          </label>
          <div className="space-y-2 text-sm">
            <span className="label">When did you place it?</span>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant={placementMode === "now" ? "secondary" : "outline"} onClick={() => { setPlacementMode("now"); setPlacedAt(""); }}>Placed just now</Button>
              <Button type="button" size="sm" variant={placementMode === "earlier" ? "secondary" : "outline"} onClick={() => setPlacementMode("earlier")}>Placed earlier</Button>
            </div>
            {placementMode === "now" ? <p className="text-[10px] text-muted-foreground">The final confirmation time will be recorded as owner-attested placement time and displayed in Melbourne.</p> : <Input type="datetime-local" aria-label="Placed at · Melbourne" value={placedAt} onChange={(event) => setPlacedAt(event.target.value)} placeholder="Leave blank if unknown" />}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-2 text-sm">
              <span className="label">Stake · AUD</span>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={stake}
                onChange={(event) => setStake(event.target.value)}
                required
              />
            </label>
            <label className="space-y-2 text-sm">
              <span className="label">Stake type</span>
              <select
                aria-label="Stake type"
                className="input w-full"
                value={stakeType}
                onChange={(event) =>
                  setStakeType(event.target.value as Bet["stakeType"])
                }
              >
                <option value="cash">Cash</option>
                <option value="bonus">Bonus</option>
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-2 text-sm">
              <span className="label">Accepted decimal odds</span>
              <Input
                type="number"
                min="1.0001"
                step="0.0001"
                max="10000"
                value={odds}
                onChange={(event) => setOdds(event.target.value)}
                required
              />
            </label>
            <label className="space-y-2 text-sm">
              <span className="label">Bet outcome</span>
              <select
                aria-label="Bet outcome"
                className="input w-full"
                value={outcome}
                onChange={(event) =>
                  changeOutcome(event.target.value as Outcome)
                }
              >
                {Object.entries(outcomeLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="space-y-2 text-sm sm:col-span-2"><span className="label">Sportsbook ticket reference · optional</span><Input value={ticketReference} onChange={event=>setTicketReference(event.target.value)} maxLength={200} placeholder="Leave blank when unavailable" /></label>
          {outcome !== "pending" && <><label className="space-y-2 text-sm"><span className="label">Settled at · Melbourne</span><Input type="datetime-local" value={settledAt} onChange={event=>setSettledAt(event.target.value)} required /></label><label className="space-y-2 text-sm"><span className="label">Actual cash payout · AUD</span><Input aria-label="Actual cash payout · AUD" type="number" min="0" step="0.01" value={payout} onChange={event=>setPayout(event.target.value)} placeholder="Enter zero for a loss" /><p className="text-[10px] text-muted-foreground">Required for a new settlement or changed financial amounts; bonus face value is not cash returned.</p></label></>}
          <label className="space-y-2 text-sm sm:col-span-2">
            <span className="label">Research strategy</span>
            <select
              aria-label="Research strategy"
              className="input w-full"
              value={strategy}
              onChange={(event) => setStrategy(event.target.value as Strategy)}
              disabled={predictionLinked}
            >
              <option value="" disabled>Select research track</option>
              {Object.entries(STRATEGIES).map(([key, label]) => (
                <option key={key} value={key}>
                  Track {key} · {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {stakeType === "bonus" && (
          <p className="rounded-lg border border-amber-400/20 bg-amber-400/5 p-3 text-xs leading-relaxed text-amber-200">
            Bonus stake is separate from cash. A win adds only stake × (odds −
            1); a loss or void adds no cash. Check the original bookmaker terms
            manually.
          </p>
        )}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">
              Selections{" "}
              <span className="muted font-normal">
                · {legs.length === 1 ? "Single" : `${legs.length}-leg parlay`}
              </span>
            </h3>
            {!predictionLinked && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setLegs((current) => [...current, newLeg()])}
                disabled={legs.length >= 12}
              >
                <Plus className="mr-1.5 size-3.5" />
                Add leg
              </Button>
            )}
          </div>
          {predictionLinked && (
            <p className="muted text-xs">
              The registered research selection and forecast are preserved.
              Settlement statistics and the manually available bet price can be
              recorded below.
            </p>
          )}
          {legs.map((leg, index) => (
            <fieldset
              key={leg.id}
              className="space-y-3 rounded-xl border border-white/10 bg-white/[0.015] p-4"
            >
              <legend className="px-2 text-xs font-medium text-slate-400">
                Leg {index + 1}
              </legend>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1.5 text-xs">
                  <span className="label">Sport</span>
                  <select
                    aria-label="Sport"
                    className="input w-full"
                    value={leg.sport}
                    onChange={(event) =>
                      changeLeg(leg.id, { sport: event.target.value as Sport })
                    }
                    disabled={predictionLinked}
                  >
                    <option value="" disabled>Select sport</option>
                    {SPORTS.map((sport) => (
                      <option key={sport}>{sport}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1.5 text-xs">
                  <span className="label">Participant / team</span>
                  <Input
                    value={leg.participant}
                    onChange={(event) =>
                      changeLeg(leg.id, { participant: event.target.value })
                    }
                    placeholder="Player or team"
                    required
                    maxLength={200}
                    disabled={predictionLinked}
                  />
                </label>
                <label className="col-span-2 space-y-1.5 text-xs">
                  <span className="label">Event</span>
                  <Input
                    value={leg.event}
                    onChange={(event) =>
                      changeLeg(leg.id, { event: event.target.value })
                    }
                    placeholder="Away team vs home team / tennis match"
                    required
                    maxLength={240}
                    disabled={predictionLinked}
                  />
                </label>
                <label className="space-y-1.5 text-xs">
                  <span className="label">Exact market</span>
                  <Input
                    value={leg.market}
                    onChange={(event) =>
                      changeLeg(leg.id, { market: event.target.value })
                    }
                    placeholder="e.g. Player points"
                    required
                    maxLength={160}
                    disabled={predictionLinked}
                  />
                </label>
                <label className="space-y-1.5 text-xs">
                  <span className="label">Exact selection</span>
                  <Input
                    value={leg.selection}
                    onChange={(event) =>
                      changeLeg(leg.id, { selection: event.target.value })
                    }
                    placeholder="e.g. Over 22.5 points"
                    required
                    maxLength={240}
                    disabled={predictionLinked}
                  />
                </label>
                <label className="space-y-1.5 text-xs">
                  <span className="label">Line / threshold</span>
                  <Input
                    value={leg.line}
                    onChange={(event) =>
                      changeLeg(leg.id, { line: event.target.value })
                    }
                    placeholder="e.g. 22.5 or N/A"
                    required
                    maxLength={80}
                    disabled={predictionLinked}
                  />
                </label>
                <label className="space-y-1.5 text-xs">
                  <span className="label">Leg decimal odds{legs.length === 1 ? " · uses accepted single price" : ""}</span>
                  <Input
                    type="number"
                    min="1.0001"
                    step="0.0001"
                    max="10000"
                    value={legs.length === 1 ? odds : leg.odds}
                    readOnly={legs.length === 1}
                    onChange={(event) => changeLeg(leg.id, { odds: event.target.value })}
                    required
                  />
                </label>
                <label className="space-y-1.5 text-xs">
                  <span className="label">Leg outcome</span>
                  <select
                    aria-label="Leg outcome"
                    className="input w-full"
                    value={leg.outcome}
                    onChange={(event) =>
                      changeLeg(leg.id, {
                        outcome: event.target.value as Outcome,
                      })
                    }
                  >
                    {Object.entries(outcomeLabels).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1.5 text-xs">
                  <span className="label">Recorded statistic</span>
                  <Input
                    value={leg.statistic ?? ""}
                    onChange={(event) =>
                      changeLeg(leg.id, { statistic: event.target.value })
                    }
                    placeholder="e.g. 26 points"
                    maxLength={240}
                  />
                </label>
              </div>
              {legs.length > 1 && !predictionLinked && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-rose-400"
                  onClick={() =>
                    setLegs((current) =>
                      current.filter((item) => item.id !== leg.id),
                    )
                  }
                >
                  <Trash2 className="mr-1.5 size-3.5" />
                  Remove leg
                </Button>
              )}
            </fieldset>
          ))}
          {legs.length > 1 && (
            <p className="muted text-xs">
              Enter the bookmaker&apos;s final combined odds above. For a win
              with void legs, record the final adjusted price before saving.
            </p>
          )}
        </div>
        <label className="block space-y-2 text-sm">
          <span className="label">{research ? 'Optional evidence / screenshot reference' : 'Research notes'}</span>
          <textarea
            className="input min-h-20 w-full resize-y"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Reasoning, settlement source, or correction details"
            maxLength={4000}
          />
        </label>
        <p className="text-[11px] leading-relaxed text-muted-foreground">Missing source details? Keep this unsaved form open or preserve the evidence through Historical Import. Closing Cancel discards only this draft; registered records stay unchanged.</p>
        {error && (
          <p
            role="alert"
            className="rounded-lg border border-rose-400/20 bg-rose-400/5 p-3 text-sm text-rose-300"
          >
            {error}
          </p>
        )}
        {reviewIssues.length > 0 && <ul className="list-disc space-y-1 pl-4 text-xs text-amber-200">{[...new Set(reviewIssues)].map(issue=><li key={issue}>{issue}</li>)}</ul>}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {initial ? "Review ledger update" : "Review financial registration"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
