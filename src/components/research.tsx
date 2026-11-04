"use client";
import { useState } from "react";
import {
  ArrowRight,
  Clock3,
  Database,
  FlaskConical,
  Info,
  Plus,
  Search,
  ShieldCheck,
  CirclePlay,
} from "lucide-react";
import { useApp } from "./app-provider";
import { BetForm } from "./bet-form";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Badge } from "./ui/badge";
import { SimulationNote, SportBadge, StrategyBadge } from "./shared";
import type { Candidate } from "@/lib/domain/types";
import { SPORTS, STRATEGIES } from "@/lib/domain/types";
import { expectedValue, impliedProbability } from "@/lib/domain/calculations";
import { cn, dateTime, freshness, percent } from "@/lib/utils";
import { ResearchHandoff } from './handoff/research-handoff';
export function ResearchDetail({
  candidate,
  onClose,
}: {
  candidate?: Candidate;
  onClose: () => void;
}) {
  const { addPaper, data, notify } = useApp();
  const [actual, setActual] = useState(false);
  const [saving, setSaving] = useState(false);
  if (!candidate) return null;
  const ev = expectedValue(candidate.probability, candidate.odds);
  const tracked = data.paperPredictions.some(
    (p) => p.candidate.id === candidate.id,
  );
  const track = async () => {
    setSaving(true);
    try {
      await addPaper(candidate);
      notify("Immutable prediction snapshot added to paper tracking");
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Could not register prediction",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <Dialog
        open={!actual}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <div className="mb-3 flex items-center gap-2">
              <SportBadge sport={candidate.sport} />
              <StrategyBadge strategy={candidate.strategy} />
              <Badge className="border-amber-200/20 text-amber-200/70">
                {candidate.oddsProvenance.simulated
                  ? "SYNTHETIC FIXTURE"
                  : "REGISTERED SOURCE"}
              </Badge>
            </div>
            <DialogTitle>{candidate.participant}</DialogTitle>
            <DialogDescription>
              {candidate.event} · {dateTime(candidate.startsAt)} Melbourne
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border border-border bg-background/50 p-4">
            <p className="section-kicker">{candidate.market}</p>
            <p className="mt-2 text-xl tracking-tight">
              {candidate.selection}{" "}
              <span className="text-primary">{candidate.line}</span>
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Exact registered selection · {candidate.bookmaker}
            </p>
          </div>
          <div className="my-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Decimal price", candidate.odds.toFixed(2)],
              [
                "Implied probability",
                percent((impliedProbability(candidate.odds) ?? 0) * 100),
              ],
              [
                "Registered probability",
                candidate.probability === undefined
                  ? "Unavailable"
                  : percent(candidate.probability * 100),
              ],
              [
                "Illustrative EV",
                ev === null
                  ? "Unavailable"
                  : `${ev > 0 ? "+" : ""}${(ev * 100).toFixed(1)}%`,
              ],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-secondary/60 p-3">
                <p className="text-[9px] text-muted-foreground">{label}</p>
                <p className="tabular mt-2 text-base">{value}</p>
              </div>
            ))}
          </div>
          <div className="space-y-5">
            <div>
              <h3 className="mb-2 text-xs font-medium">Research rationale</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {candidate.rationale}
              </p>
            </div>
            <div className="flex items-start gap-2 rounded-lg border border-[#64522d66] bg-amber-200/3 p-3 text-[11px] leading-relaxed text-[#c2b387]">
              <Info className="mt-0.5 size-4 shrink-0" />
              <span>
                Uncertainty: {candidate.uncertainty}.{" "}
                {candidate.oddsProvenance.simulated
                  ? "Available probability estimates use fictional win/trial counts and the deterministic formula (wins + 1) / (trials + 2). These estimates are unvalidated; no runtime AI is used. EV uses p × decimal odds − 1 for a cash stake and excludes bookmaker margin, limits and execution."
                  : "Interpret estimates according to their recorded method and validation history."}
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ["Odds source", candidate.oddsProvenance],
                ["Probability source", candidate.probabilityProvenance],
              ].map(([label, source]) => {
                const provenance =
                  typeof source === "object" ? source : undefined;
                return (
                  <div
                    key={String(label)}
                    className="rounded-lg border border-border p-3"
                  >
                    <div className="mb-2 flex items-center gap-1.5 text-[10px]">
                      <Database className="size-3 text-primary" />
                      {String(label)}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {provenance?.source ?? "No numerical estimate"}
                    </p>
                    {provenance && (
                      <>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {provenance.method} · {provenance.modelVersion}
                        </p>
                        <p className="mt-2 text-[10px]">
                          {dateTime(provenance.timestamp)}
                        </p>
                        <p className="mt-1 flex items-center gap-1 text-[9px] text-muted-foreground">
                          <Clock3 className="size-3" />
                          {freshness(provenance.timestamp)} · source age
                        </p>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <ShieldCheck className="size-3 text-primary" />
              Original forecast and provenance remain immutable after
              registration.
            </div>
          </div>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              disabled={tracked || saving}
              onClick={() => void track()}
            >
              <Plus />
              {tracked
                ? "In paper tracking"
                : saving
                  ? "Registering…"
                  : "Add to paper tracking"}
            </Button>
            <Button onClick={() => setActual(true)}>
              Record actual bet <ArrowRight />
            </Button>
          </div>
          <p className="mt-3 text-right text-[9px] text-muted-foreground">
            Actual bets require your explicit manual confirmation. No wager is
            submitted.
          </p>
        </DialogContent>
      </Dialog>
      <BetForm
        open={actual}
        candidate={candidate}
        onOpenChange={(open) => {
          setActual(open);
        }}
      />
    </>
  );
}
export function Research() {
  const { data, mode, running, runResearch, notify } = useApp();
  const [query, setQuery] = useState("");
  const [sport, setSport] = useState("all");
  const [strategy, setStrategy] = useState("all");
  const [selected, setSelected] = useState<Candidate>();
  const candidates = data.candidates.filter(
    (c) =>
      (sport === "all" || c.sport === sport) &&
      (strategy === "all" || c.strategy === strategy) &&
      `${c.event} ${c.participant} ${c.market} ${c.selection}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="section-kicker mb-2">
            A structured research pipeline
          </div>
          <h1 className="page-heading">Research opportunities</h1>
          <p className="mt-2 text-xs text-muted-foreground">
            Explore exact selections with transparent sources and registered
            estimates.
          </p>
        </div>
        <Button
          disabled={running || mode !== "demo"}
          onClick={() => void runResearch().catch((e) => notify(e.message))}
        >
          <CirclePlay className={cn(running && "animate-spin")} />
          {running ? "Running simulation…" : "Run Simulated Research"}
        </Button>
      </div>
      <ResearchHandoff />
      <div className="grid gap-3 md:grid-cols-3">
        {(["A", "B", "C"] as const).map((track, i) => (
          <button
            key={track}
            className={cn(
              "panel flex items-center gap-3 p-4 text-left transition hover:border-primary/30",
              strategy === track && "border-primary/50 bg-primary/3",
            )}
            onClick={() => setStrategy(strategy === track ? "all" : track)}
            aria-pressed={strategy === track}
          >
            <span
              className={cn(
                "flex size-10 items-center justify-center rounded-lg border text-xs",
                [
                  "border-primary/20 bg-primary/5 text-primary",
                  "border-blue-200/20 bg-blue-200/5 text-blue-200",
                  "border-violet-200/20 bg-violet-200/5 text-violet-200",
                ][i],
              )}
            >
              {track}
            </span>
            <div>
              <p className="text-xs">{STRATEGIES[track]}</p>
              <p className="mt-1.5 text-[10px] text-muted-foreground">
                {data.candidates.filter((c) => c.strategy === track).length}{" "}
                registered candidates
              </p>
            </div>
            <ArrowRight className="ml-auto size-3 text-muted-foreground" />
          </button>
        ))}
      </div>
      <div className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-3 size-3.5 text-muted-foreground" />
            <input
              aria-label="Search research candidates"
              className="input pl-9"
              placeholder="Search events, players or markets…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              aria-label="Filter sport"
              className="input w-auto text-xs"
              value={sport}
              onChange={(e) => setSport(e.target.value)}
            >
              <option value="all">All sports</option>
              {SPORTS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <select
              aria-label="Filter strategy"
              className="input w-auto text-xs"
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
            >
              <option value="all">All strategies</option>
              {(["A", "B", "C"] as const).map((s) => (
                <option key={s} value={s}>
                  Track {s}
                </option>
              ))}
            </select>
          </div>
        </div>
        {candidates.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Event / selection</th>
                  <th>Strategy</th>
                  <th>Price / implied</th>
                  <th>Model estimate</th>
                  <th>Est. EV</th>
                  <th>Data source</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {candidates.map((c) => {
                  const ev = expectedValue(c.probability, c.odds);
                  return (
                    <tr key={c.id}>
                      <td>
                        <div className="flex items-start gap-3">
                          <SportBadge sport={c.sport} />
                          <div>
                            <p className="text-[11px] font-medium">
                              {c.participant}
                            </p>
                            <p className="mt-1 text-[11px]">
                              {c.selection}{" "}
                              <span className="text-primary/80">{c.line}</span>
                            </p>
                            <p className="mt-1 text-[9px] text-muted-foreground">
                              {c.event} · {c.market}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <StrategyBadge strategy={c.strategy} />
                      </td>
                      <td>
                        <p className="tabular text-sm">{c.odds.toFixed(2)}</p>
                        <p className="mt-1 text-[9px] text-muted-foreground">
                          {percent((impliedProbability(c.odds) ?? 0) * 100)}{" "}
                          implied · {c.bookmaker}
                        </p>
                      </td>
                      <td>
                        <p className="tabular">
                          {c.probability === undefined
                            ? "—"
                            : percent(c.probability * 100)}
                        </p>
                        <p className="mt-1 text-[9px] text-[#c3b07d]">
                          {c.uncertainty} estimate
                        </p>
                      </td>
                      <td
                        className={cn(
                          "tabular",
                          ev !== null && ev > 0
                            ? "text-primary/90"
                            : "text-muted-foreground",
                        )}
                      >
                        {ev === null
                          ? "—"
                          : `${ev > 0 ? "+" : ""}${(ev * 100).toFixed(1)}%`}
                      </td>
                      <td>
                        <p className="text-[10px]">
                          {c.oddsProvenance.simulated
                            ? "Synthetic fixture"
                            : c.oddsProvenance.source}
                        </p>
                        <p className="mt-1 text-[9px] text-muted-foreground">
                          {freshness(c.oddsProvenance.timestamp)}
                        </p>
                      </td>
                      <td>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelected(c)}
                        >
                          Review <ArrowRight />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <FlaskConical className="mb-2 size-6 text-muted-foreground" />
            <span>
              {data.candidates.length
                ? "No candidates match these filters."
                : mode === "demo"
                  ? "Run a simulation to generate research candidates."
                  : "No research provider is connected. Your private candidate list is empty."}
            </span>
          </div>
        )}
        <div className="border-t border-border px-4 py-3 text-[10px] text-muted-foreground">
          {candidates.length} candidates · Every registered forecast retains its
          original price, probability and provenance.
        </div>
      </div>
      {mode === "demo" && <SimulationNote />}
      <section className="panel p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium">Research run history</h2>
          <span className="text-[9px] text-muted-foreground">
            LOCAL WORKFLOW
          </span>
        </div>
        {data.researchRuns.length ? (
          <div className="space-y-3">
            {data.researchRuns.slice(0, 8).map((run) => (
              <div
                key={run.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-3 last:border-0 last:pb-0"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      run.status === "completed"
                        ? "bg-primary"
                        : "bg-amber-300",
                    )}
                  />
                  <span className="text-xs">
                    {run.simulated ? "Simulated research" : "Research run"}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {dateTime(run.startedAt)}
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {run.status} · {run.candidateCount} candidates
                  {run.error ? ` · ${run.error}` : ""}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            No research runs recorded yet.
          </p>
        )}
      </section>
      <ResearchDetail
        candidate={selected}
        onClose={() => setSelected(undefined)}
      />
    </div>
  );
}
