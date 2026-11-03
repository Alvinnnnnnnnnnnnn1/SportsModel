"use client";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowUpRight,
  BookmarkCheck,
  ChartNoAxesCombined,
  ClipboardList,
  Pencil,
  Search,
  Target,
} from "lucide-react";
import { useApp } from "./app-provider";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  calculateMetrics,
  paperAsBets,
  betProfit,
} from "@/lib/domain/calculations";
import type { Outcome, PaperPrediction } from "@/lib/domain/types";
import { cn, dateTime, money, percent, signedMoney } from "@/lib/utils";
import {
  OutcomeBadge,
  SimulationNote,
  SportBadge,
  StatCard,
  StrategyBadge,
} from "./shared";
import { ResearchDetail } from "./research";
function SettlePaper({
  prediction,
  onClose,
}: {
  prediction: PaperPrediction;
  onClose: () => void;
}) {
  const { settlePaper, notify } = useApp();
  const [outcome, setOutcome] = useState<Outcome>(prediction.outcome);
  const [statistic, setStatistic] = useState(prediction.statistic ?? "");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await settlePaper(prediction.id, outcome, statistic);
      notify("Paper outcome updated with an audit record");
      onClose();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not save outcome");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record paper outcome</DialogTitle>
          <DialogDescription>
            {prediction.candidate.participant} ·{" "}
            {prediction.candidate.selection}. The original forecast remains
            unchanged.
          </DialogDescription>
        </DialogHeader>
        <label className="label" htmlFor="paper-outcome">
          Outcome
        </label>
        <select
          id="paper-outcome"
          className="input"
          value={outcome}
          onChange={(e) => setOutcome(e.target.value as Outcome)}
        >
          {(["pending", "won", "lost", "void"] as const).map((o) => (
            <option key={o} value={o}>
              {o[0].toUpperCase() + o.slice(1)}
            </option>
          ))}
        </select>
        <label className="label mt-4" htmlFor="paper-statistic">
          Observed statistic / result notes
        </label>
        <input
          id="paper-statistic"
          className="input"
          maxLength={500}
          value={statistic}
          onChange={(e) => setStatistic(e.target.value)}
          placeholder="e.g. 24 points · manually entered"
        />
        <p className="mt-3 text-[11px] text-muted-foreground">
          Hypothetical results have no effect on actual bankroll.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy} onClick={() => void save()}>
            {busy ? "Saving…" : "Save paper outcome"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
export function PaperTracking() {
  const { data, mode } = useApp();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [settling, setSettling] = useState<PaperPrediction>();
  const [detail, setDetail] = useState<PaperPrediction>();
  const bets = paperAsBets(data.paperPredictions);
  const m = calculateMetrics(bets, []);
  const entries = data.paperPredictions.filter(
    (p) =>
      (status === "all" || p.outcome === status) &&
      `${p.candidate.event} ${p.candidate.participant} ${p.candidate.selection}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="section-kicker mb-2">Observe before you commit</div>
          <h1 className="page-heading">Paper tracking</h1>
          <p className="mt-2 text-xs text-muted-foreground">
            Evaluate registered forecasts with hypothetical stakes. Separate
            from your bankroll.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/research">
            Explore research <ArrowUpRight />
          </Link>
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Paper predictions"
          value={String(data.paperPredictions.length)}
          detail={`${m.pending} pending · ${m.settledCount} decisive results`}
          icon={<ClipboardList className="size-4" />}
        />
        <StatCard
          title="Hypothetical P/L"
          value={signedMoney(m.profitCents)}
          detail="Never included in actual bankroll"
          icon={<ChartNoAxesCombined className="size-4" />}
        />
        <StatCard
          title="Paper ROI"
          value={percent(m.roi)}
          detail={`On ${money(m.stakedCents)} hypothetical settled stakes`}
          icon={<Target className="size-4" />}
        />
        <StatCard
          title="Paper hit rate"
          value={percent(m.hitRate)}
          detail={`${m.won} won · ${m.lost} lost · ${m.void} void`}
          icon={<BookmarkCheck className="size-4" />}
        />
      </div>
      <div className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-3 size-3.5 text-muted-foreground" />
            <input
              className="input pl-9"
              aria-label="Search paper predictions"
              placeholder="Search registered predictions…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            className="input w-auto"
            aria-label="Filter paper outcome"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {["all", "pending", "won", "lost", "void"].map((o) => (
              <option key={o} value={o}>
                {o === "all" ? "All outcomes" : o[0].toUpperCase() + o.slice(1)}
              </option>
            ))}
          </select>
        </div>
        {entries.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Registered prediction</th>
                  <th>Strategy</th>
                  <th>Price / probability</th>
                  <th>Hyp. stake</th>
                  <th>Outcome</th>
                  <th>Hyp. P/L</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {entries.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="flex items-start gap-3">
                        <SportBadge sport={p.candidate.sport} />
                        <div>
                          <button
                            onClick={() => setDetail(p)}
                            className="text-left text-[11px] hover:text-primary"
                          >
                            {p.candidate.participant} · {p.candidate.selection}{" "}
                            {p.candidate.line}
                          </button>
                          <p className="mt-1 text-[9px] text-muted-foreground">
                            {p.candidate.event}
                          </p>
                          <p className="mt-1 text-[9px] text-muted-foreground">
                            Registered {dateTime(p.registeredAt)}
                          </p>
                          {p.statistic && (
                            <p className="mt-1 max-w-xs truncate text-[9px] text-primary/70">
                              Result: {p.statistic}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <StrategyBadge strategy={p.candidate.strategy} />
                    </td>
                    <td>
                      <p className="tabular">{p.candidate.odds.toFixed(2)}</p>
                      <p className="mt-1 text-[9px] text-muted-foreground">
                        {p.candidate.probability === undefined
                          ? "No estimate"
                          : percent(p.candidate.probability * 100)}
                      </p>
                    </td>
                    <td className="tabular">
                      {money(p.hypotheticalStakeCents)}
                    </td>
                    <td>
                      <OutcomeBadge outcome={p.outcome} />
                    </td>
                    <td
                      className={cn(
                        "tabular",
                        betProfit(bets.find((b) => b.id === p.id)!) >= 0
                          ? "text-primary"
                          : "text-red-300",
                      )}
                    >
                      {p.outcome === "pending"
                        ? "—"
                        : signedMoney(
                            betProfit(bets.find((b) => b.id === p.id)!),
                          )}
                    </td>
                    <td>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSettling(p)}
                      >
                        <Pencil />
                        Outcome
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state min-h-64">
            <ClipboardList className="mb-2 size-7" />
            <p>
              {data.paperPredictions.length
                ? "No paper predictions match these filters."
                : "Build a record of decisions before risking capital."}
            </p>
            <Button size="sm" variant="outline" asChild>
              <Link href="/research">Browse research</Link>
            </Button>
          </div>
        )}
        <div className="border-t border-border px-4 py-3 text-[10px] text-muted-foreground">
          Original probabilities, odds, timestamps and source snapshots are
          immutable. Outcome corrections are audited.
        </div>
      </div>
      {mode === "demo" && <SimulationNote />}
      {settling && (
        <SettlePaper
          key={settling.id}
          prediction={settling}
          onClose={() => setSettling(undefined)}
        />
      )}
      <ResearchDetail
        candidate={detail?.candidate}
        onClose={() => setDetail(undefined)}
      />
    </div>
  );
}
