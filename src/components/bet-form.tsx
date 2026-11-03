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
import { betSchema } from "@/lib/domain/validation";

const outcomeLabels: Record<Outcome, string> = {
  pending: "Pending",
  won: "Won",
  lost: "Lost",
  void: "Void",
};

function melbourneInput(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const value = (name: string) =>
    parts.find((p) => p.type === name)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}T${value("hour")}:${value("minute")}`;
}

function utcFromMelbourne(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
    throw new Error("Enter a valid placement date and time.");
  const wall = Date.parse(`${value}:00Z`);
  let utc = wall;
  for (let i = 0; i < 3; i++) {
    const rendered = Date.parse(
      `${melbourneInput(new Date(utc).toISOString())}:00Z`,
    );
    utc += wall - rendered;
  }
  const iso = new Date(utc).toISOString();
  if (melbourneInput(iso) !== value)
    throw new Error(
      "That Melbourne time does not exist because of daylight saving. Choose another time.",
    );
  return iso;
}

function newLeg(candidate?: Candidate): BetLeg {
  return {
    id: crypto.randomUUID(),
    sport: candidate?.sport ?? "NBA",
    event: candidate?.event ?? "",
    participant: candidate?.participant ?? "",
    market: candidate?.market ?? "",
    selection: candidate?.selection ?? "",
    line: candidate?.line ?? "",
    odds: candidate?.odds ?? 1.9,
    outcome: "pending",
    statistic: "",
  };
}

interface BetFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Bet;
  candidate?: Candidate;
}

export function BetForm({
  open,
  onOpenChange,
  initial,
  candidate,
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
            key={initial?.id ?? candidate?.id ?? "new"}
            onOpenChange={onOpenChange}
            initial={initial}
            candidate={candidate}
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
  saving,
  setSaving,
}: Omit<BetFormProps, "open"> & {
  saving: boolean;
  setSaving: (saving: boolean) => void;
}) {
  const { data, mode, addBet, updateBet, notify } = useApp();
  const [bookmaker, setBookmaker] = useState(
    initial?.bookmaker ?? candidate?.bookmaker ?? "",
  );
  const [stake, setStake] = useState(
    ((initial?.stakeCents ?? data.settings.defaultStakeCents) / 100).toFixed(2),
  );
  const [stakeType, setStakeType] = useState<Bet["stakeType"]>(
    initial?.stakeType ?? "cash",
  );
  const [odds, setOdds] = useState(
    String(initial?.odds ?? candidate?.odds ?? 1.9),
  );
  const [placedAt, setPlacedAt] = useState(
    melbourneInput(initial?.placedAt ?? new Date().toISOString()),
  );
  const [strategy, setStrategy] = useState<Strategy>(
    initial?.strategy ?? candidate?.strategy ?? "A",
  );
  const [outcome, setOutcome] = useState<Outcome>(
    initial?.outcome ?? "pending",
  );
  const [legs, setLegs] = useState<BetLeg[]>(() =>
    initial ? initial.legs.map((leg) => ({ ...leg })) : [newLeg(candidate)],
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [confirmed, setConfirmed] = useState(Boolean(initial));
  const [error, setError] = useState("");
  const predictionLinked = Boolean(initial?.candidateId || candidate);

  function changeLeg(id: string, update: Partial<BetLeg>) {
    setLegs((current) =>
      current.map((leg) => (leg.id === id ? { ...leg, ...update } : leg)),
    );
  }

  function changeOutcome(value: Outcome) {
    setOutcome(value);
    if (legs.length === 1)
      setLegs((current) => current.map((leg) => ({ ...leg, outcome: value })));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!confirmed) {
      setError("Confirm the manual ledger entry before saving.");
      return;
    }
    if (mode === "supabase" && candidate?.oddsProvenance.simulated) {
      setError(
        "Simulated research cannot be saved in the private workspace. Use demo mode.",
      );
      return;
    }
    try {
      const cents = Math.round(Number(stake) * 100);
      if (!/^\d+(\.\d{1,2})?$/.test(stake) || cents <= 0)
        throw new Error(
          "Enter a stake greater than zero with at most two decimal places.",
        );
      if (
        outcome === "won" &&
        (legs.some(
          (leg) => leg.outcome === "lost" || leg.outcome === "pending",
        ) ||
          !legs.some((leg) => leg.outcome === "won"))
      )
        throw new Error(
          "A won bet needs won or void legs, including at least one won leg. Update each leg outcome below.",
        );
      if (outcome === "lost" && !legs.some((leg) => leg.outcome === "lost"))
        throw new Error(
          "Record at least one lost leg before marking the bet lost.",
        );
      if (outcome === "void" && !legs.every((leg) => leg.outcome === "void"))
        throw new Error("Mark every leg void before marking the bet void.");
      const placedAtUtc = utcFromMelbourne(placedAt);
      const parsed = betSchema.safeParse({
        id: initial?.id ?? crypto.randomUUID(),
        placedAt: placedAtUtc,
        ...(outcome === "pending"
          ? {}
          : {
              settledAt:
                initial?.outcome === outcome && initial.settledAt
                  ? initial.settledAt
                  : new Date().toISOString(),
            }),
        bookmaker: bookmaker.trim(),
        stakeCents: cents,
        stakeType,
        odds: Number(odds),
        outcome,
        strategy,
        legs: legs.map((leg) => ({
          ...leg,
          event: leg.event.trim(),
          participant: leg.participant.trim(),
          market: leg.market.trim(),
          selection: leg.selection.trim(),
          line: leg.line.trim(),
          statistic: leg.statistic?.trim() || undefined,
        })),
        notes: notes.trim(),
        confirmedAt: initial?.confirmedAt ?? new Date().toISOString(),
        ...(initial?.probability !== undefined
          ? { probability: initial.probability }
          : candidate?.probability !== undefined
            ? { probability: candidate.probability }
            : {}),
        ...(initial?.candidateId
          ? { candidateId: initial.candidateId }
          : candidate
            ? { candidateId: candidate.id }
            : {}),
        oddsProvenance: initial?.oddsProvenance ?? {
          source:
            mode === "demo"
              ? "Synthetic manual bookmaker record"
              : "Manual bookmaker record",
          timestamp: placedAtUtc,
          method: "User-entered decimal price; no live verification",
          modelVersion: "manual-entry-v1",
          simulated: mode === "demo",
        },
        ...(initial?.probabilityProvenance
          ? { probabilityProvenance: initial.probabilityProvenance }
          : candidate?.probabilityProvenance
            ? { probabilityProvenance: candidate.probabilityProvenance }
            : {}),
      });
      if (!parsed.success) {
        setError(
          parsed.error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join(" · "),
        );
        return;
      }
      setSaving(true);
      if (initial) await updateBet(parsed.data);
      else await addBet(parsed.data);
      notify(
        initial
          ? "Ledger entry updated · audit record preserved"
          : "Manual bet recorded in your ledger",
      );
      onOpenChange(false);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to save this entry. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

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
      <form onSubmit={submit} className="space-y-6">
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
          <label className="space-y-2 text-sm">
            <span className="label">Placed at · Melbourne</span>
            <Input
              type="datetime-local"
              value={placedAt}
              onChange={(event) => setPlacedAt(event.target.value)}
              required
            />
          </label>
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
              <span className="label">Decimal odds</span>
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
          <label className="space-y-2 text-sm sm:col-span-2">
            <span className="label">Research strategy</span>
            <select
              aria-label="Research strategy"
              className="input w-full"
              value={strategy}
              onChange={(event) => setStrategy(event.target.value as Strategy)}
              disabled={predictionLinked}
            >
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
                  <span className="label">Leg decimal odds</span>
                  <Input
                    type="number"
                    min="1.0001"
                    step="0.0001"
                    max="10000"
                    value={leg.odds}
                    onChange={(event) =>
                      changeLeg(leg.id, { odds: Number(event.target.value) })
                    }
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
          <span className="label">Research notes</span>
          <textarea
            className="input min-h-20 w-full resize-y"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Reasoning, settlement source, or correction details"
            maxLength={4000}
          />
        </label>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 p-3 text-xs leading-relaxed text-slate-300">
          <input
            type="checkbox"
            className="mt-0.5 accent-emerald-400"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            required
          />
          <span>
            {mode === "demo"
              ? "I confirm this is a synthetic demo ledger entry. It does not represent a real wager."
              : "I confirm that I placed this bet manually outside EdgeLab and that these details match my own record."}
          </span>
        </label>
        {error && (
          <p
            role="alert"
            className="rounded-lg border border-rose-400/20 bg-rose-400/5 p-3 text-sm text-rose-300"
          >
            {error}
          </p>
        )}
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
            {saving
              ? "Saving…"
              : initial
                ? "Save audited changes"
                : "Confirm & record bet"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
