"use client";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Banknote,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronRight,
  CircleDollarSign,
  CirclePlay,
  Plus,
  Target,
  Wallet,
} from "lucide-react";
import { useApp } from "./app-provider";
import { useHistory } from "./history-provider";
import { HistoricalWagerClaimsSummary } from "./imports/wager-claims-review";
import { Button } from "./ui/button";
import { BetForm } from "./bet-form";
import {
  calculateMetrics,
  groupPerformance,
  performanceSeries,
  betProfit,
} from "@/lib/domain/calculations";
import { cn, money, percent, shortDate, signedMoney } from "@/lib/utils";
import { PerformanceChart } from "./charts";
import {
  OutcomeBadge,
  SimulationNote,
  SportBadge,
  StatCard,
  StrategyBadge,
} from "./shared";
export function Overview() {
  const { data, mode, running, runResearch, notify } = useApp();
  const { history } = useHistory();
  const importedPaperCount = history.paperResults.length;
  const [now] = useState(() => Date.now());
  const [addOpen, setAddOpen] = useState(false);
  const [days, setDays] = useState("30");
  const [field, setField] = useState<"profit" | "bankroll">("profit");
  const metrics = calculateMetrics(data.bets, data.transactions);
  const allSeries = performanceSeries(data.bets, data.transactions);
  const cutoff = now - Number(days) * 86400000;
  const series =
    days === "all"
      ? allSeries
      : allSeries.filter(
          (point) => Date.parse(`${point.date}T23:59:59Z`) >= cutoff,
        );
  const bySport = groupPerformance(data.bets, "sport");
  const byStrategy = groupPerformance(data.bets, "strategy");
  const recent = [...data.bets]
    .sort((a, b) => b.placedAt.localeCompare(a.placedAt))
    .slice(0, 5);
  const alerts = data.notifications.filter((n) => !n.dismissedAt).slice(0, 3);
  const fundingPercent = Math.min(
    100,
    data.settings.fundingCapCents
      ? (metrics.totalDepositsCents / data.settings.fundingCapCents) * 100
      : 0,
  );
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="section-kicker mb-2 flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-primary" /> Your research,
            in perspective
          </div>
          <h1 className="page-heading">Performance overview</h1>
          <p className="mt-2 text-xs text-muted-foreground">
            A clear view of your bankroll, research and results.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={running || mode !== "demo"}
            onClick={() =>
              void runResearch().catch((reason) => notify(reason.message))
            }
          >
            <CirclePlay className={cn(running && "animate-spin")} />
            {running ? "Running simulation…" : "Run Simulated Research"}
          </Button>
          <Button variant="outline" asChild><Link href="/research">Daily Research Handoff</Link></Button>
          <Button onClick={() => setAddOpen(true)}>
            <Plus /> Record bet
          </Button>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Recorded cash position"
          value={money(metrics.bankrollCents)}
          detail={`${money(metrics.pendingStakeCents)} reserved in pending cash bets`}
          icon={<Wallet className="size-4" />}
        />
        <StatCard
          title="Realised profit / loss"
          value={signedMoney(metrics.profitCents)}
          detail={`${money(metrics.bonusProfitCents)} from bonus winnings`}
          positive={
            metrics.profitCents === 0 ? undefined : metrics.profitCents > 0
          }
          icon={<ChartNoAxesCombined className="size-4" />}
        />
        <StatCard
          title="Return on investment"
          value={percent(metrics.roi)}
          detail={`On ${money(metrics.stakedCents)} settled cash stakes`}
          positive={
            metrics.roi === null || metrics.roi === 0
              ? undefined
              : metrics.roi > 0
          }
          icon={<Target className="size-4" />}
        />
        <StatCard
          title="Total actual bets"
          value={String(metrics.totalBets)}
          detail={`${metrics.won} won · ${metrics.lost} lost · ${metrics.pending} pending · ${metrics.void} void`}
          icon={<Banknote className="size-4" />}
        />
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">These totals use registered actual wagers and recorded funding only. The funding cap is a reference limit; this cash position is not a verified bookmaker balance.</p>
      <HistoricalWagerClaimsSummary />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,2.35fr)_minmax(260px,1fr)]">
        <section className="panel overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
            <div>
              <h2 className="text-sm font-medium">Portfolio performance</h2>
              <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className="size-1.5 rounded-full bg-primary" />
                Actual ledger · AUD · cumulative
              </div>
            </div>
            <div className="flex rounded-md border border-border p-0.5">
              {[
                ["7", "7D"],
                ["30", "30D"],
                ["90", "90D"],
                ["all", "All"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setDays(value)}
                  aria-pressed={days === value}
                  className={cn(
                    "rounded px-2.5 py-1 text-[10px]",
                    days === value
                      ? "bg-[#2d3d32] text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between px-5 pt-5">
            <div className="tabular text-[26px] font-medium tracking-tight">
              {field === "profit"
                ? signedMoney(metrics.profitCents)
                : money(metrics.bankrollCents)}
              <span className="ml-2 text-[10px] font-normal tracking-normal text-muted-foreground">
                lifetime{" "}
                {field === "profit" ? "realised P/L" : "available cash"}
              </span>
            </div>
            <select
              aria-label="Chart metric"
              className="rounded border border-border bg-card px-2 py-1 text-[10px] text-muted-foreground"
              value={field}
              onChange={(e) =>
                setField(e.target.value as "profit" | "bankroll")
              }
            >
              <option value="profit">Profit / loss</option>
              <option value="bankroll">Bankroll</option>
            </select>
          </div>
          <div className="px-4 pb-5 pt-3">
            <PerformanceChart data={series} field={field} />
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border bg-[#141c17] px-5 py-3 text-[10px] text-muted-foreground">
            <span>
              <span className="mr-1.5 inline-block size-1.5 rounded-full bg-primary" />
              Settled results, pending cash reserved
            </span>
            <span className="ml-auto flex items-center gap-1">
              <CalendarDays className="size-3" /> Melbourne display time
            </span>
          </div>
        </section>
        <section className="panel flex flex-col p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">Your experiment</h2>
            <span className="rounded border border-primary/20 bg-primary/5 px-1.5 py-0.5 text-[8px] tracking-wide text-primary">
              PERSONAL
            </span>
          </div>
          <p className="mt-1.5 text-[10px] text-muted-foreground">
            Small stakes. Structured learning.
          </p>
          <div className="mt-6 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-[#213629] text-primary">
              <CircleDollarSign className="size-5" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">
                Total deposits recorded
              </p>
              <p className="tabular mt-1 text-2xl tracking-tight">
                {money(metrics.totalDepositsCents)}
              </p>
            </div>
          </div>
          <div className="mb-2 mt-6 flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground">Lifetime funding cap</span>
            <span>{money(data.settings.fundingCapCents)}</span>
          </div>
          <div
            role="progressbar"
            aria-label="Deposits as percentage of configured lifetime funding cap"
            aria-valuenow={fundingPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-1.5 overflow-hidden rounded-full bg-[#25332a]"
          >
            <div
              className="h-full rounded-full bg-primary/80"
              style={{ width: `${fundingPercent}%` }}
            />
          </div>
          <div className="mt-2 text-right text-[9px] text-muted-foreground">
            {Math.max(0, 100 - fundingPercent).toFixed(0)}% of configured cap
            remaining
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4">
            <div>
              <p className="text-[10px] text-muted-foreground">Default stake</p>
              <p className="tabular mt-1.5 text-sm">
                {money(data.settings.defaultStakeCents)}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">
                Paper predictions
              </p>
              <p className="tabular mt-1.5 text-sm">
                {data.paperPredictions.length + importedPaperCount}
                <span className="ml-1 text-[9px] text-muted-foreground">
                  tracked{importedPaperCount > 0 ? ` · ${importedPaperCount} imported` : ""}
                </span>
              </p>
            </div>
          </div>
          <Link
            href="/settings"
            className="mt-auto flex items-center justify-between pt-5 text-[10px] text-primary"
          >
            Manage experiment settings <ArrowUpRight className="size-3" />
          </Link>
        </section>
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,2.35fr)_minmax(260px,1fr)]">
        <section className="panel overflow-hidden">
          <div className="flex items-center justify-between p-5">
            <div>
              <h2 className="text-sm font-medium">Recent selections</h2>
              <p className="mt-1.5 text-[10px] text-muted-foreground">
                Your latest confirmed actual entries
                {mode === "demo" ? " · synthetic results" : ""}
              </p>
            </div>
            <Link
              href="/ledger"
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary"
            >
              View ledger <ArrowRight className="size-3" />
            </Link>
          </div>
          {recent.length ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Selection / event</th>
                    <th>Odds</th>
                    <th>Stake</th>
                    <th>Result</th>
                    <th className="text-right">P/L</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((bet) => (
                    <tr key={bet.id}>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <SportBadge sport={bet.legs[0].sport} />
                          <div>
                            <div className="max-w-64 truncate text-[11px]">
                              {bet.legs.length > 1
                                ? `${bet.legs.length}-leg parlay`
                                : `${bet.legs[0].participant} · ${bet.legs[0].selection}`}
                            </div>
                            <div className="mt-1 text-[9px] text-muted-foreground">
                              {shortDate(bet.placedAt)} · {bet.bookmaker}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="tabular">{bet.odds.toFixed(2)}</td>
                      <td className="tabular">
                        {money(bet.stakeCents)}
                        {bet.stakeType === "bonus" && (
                          <span className="ml-1 text-[8px] text-violet-300">
                            BONUS
                          </span>
                        )}
                      </td>
                      <td>
                        <OutcomeBadge outcome={bet.outcome} />
                      </td>
                      <td
                        className={cn(
                          "tabular text-right",
                          betProfit(bet) > 0
                            ? "text-primary"
                            : betProfit(bet) < 0
                              ? "text-red-300"
                              : "text-muted-foreground",
                        )}
                      >
                        {bet.outcome === "pending"
                          ? "—"
                          : signedMoney(betProfit(bet))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              Record a manually confirmed bet to begin your ledger.
              <Button size="sm" onClick={() => setAddOpen(true)}>
                Record first bet
              </Button>
            </div>
          )}
        </section>
        <section className="panel overflow-hidden">
          <div className="flex items-center justify-between p-5">
            <h2 className="text-sm font-medium">Research inbox</h2>
            <span className="rounded-md bg-[#24372b] px-1.5 py-0.5 text-[9px] text-primary">
              {
                data.notifications.filter((n) => !n.readAt && !n.dismissedAt)
                  .length
              }{" "}
              new
            </span>
          </div>
          <div>
            {alerts.length ? (
              alerts.map((n) => {
                const candidate = data.candidates.find(
                  (c) => c.id === n.candidateId,
                );
                return (
                  <Link
                    key={n.id}
                    href={`/notifications?detail=${n.candidateId}`}
                    className="block border-t border-border/60 px-5 py-4 transition hover:bg-white/2"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      {candidate ? (
                        <SportBadge sport={candidate.sport} />
                      ) : (
                        <span className="text-[9px] text-muted-foreground">
                          RESEARCH
                        </span>
                      )}
                      <span className="text-[8px] tracking-wide text-[#b9a77e]">
                        {n.simulated ? "SIMULATED" : "REGISTERED"}
                      </span>
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      {candidate
                        ? `${candidate.participant} · ${candidate.selection}`
                        : n.title}
                    </p>
                    <div className="mt-2 flex items-center justify-between">
                      {candidate && (
                        <StrategyBadge strategy={candidate.strategy} />
                      )}
                      <ChevronRight className="size-3 text-muted-foreground" />
                    </div>
                  </Link>
                );
              })
            ) : (
              <div className="empty-state">No research notifications yet.</div>
            )}
          </div>
          <Link
            href="/notifications"
            className="flex items-center justify-center gap-1 border-t border-border px-5 py-3 text-[10px] text-muted-foreground hover:text-primary"
          >
            Open notification centre <ArrowRight className="size-3" />
          </Link>
        </section>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="panel p-5">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-sm font-medium">Results by sport</h2>
            <span className="text-[9px] text-muted-foreground">
              LIFETIME REALISED P/L
            </span>
          </div>
          <div className="space-y-4">
            {bySport.length ? (
              bySport.map((item) => (
                <div key={item.name} className="flex items-center gap-3">
                  <SportBadge sport={item.name} />
                  <div className="flex-1">
                    <div className="mb-1.5 flex items-center justify-between text-[10px]">
                      <span className="text-muted-foreground">
                        {item.bets} bets
                      </span>
                      <span
                        className={cn(
                          "tabular",
                          item.profit >= 0 ? "text-primary" : "text-red-300",
                        )}
                      >
                        {signedMoney(Math.round(item.profit * 100))}
                      </span>
                    </div>
                    <div className="h-1 rounded bg-secondary">
                      <div
                        className={cn(
                          "h-1 rounded",
                          item.profit >= 0 ? "bg-primary/65" : "bg-red-300/65",
                        )}
                        style={{
                          width: `${Math.max(4, (Math.abs(item.profit) / Math.max(1, ...bySport.map((g) => Math.abs(g.profit)))) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">
                No sport results recorded.
              </p>
            )}
          </div>
        </section>
        <section className="panel p-5">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-sm font-medium">Strategy breakdown</h2>
            <Link
              href="/analytics"
              className="flex items-center gap-1 text-[10px] text-muted-foreground"
            >
              Explore analytics <ArrowUpRight className="size-3" />
            </Link>
          </div>
          <div className="space-y-4">
            {(["A", "B", "C"] as const).map((strategy, i) => {
              const item = byStrategy.find(
                (x) => x.name === `Track ${strategy}`,
              );
              return (
                <div key={strategy} className="flex items-center gap-3">
                  <span
                    className={cn(
                      "flex size-8 items-center justify-center rounded-lg border text-[10px]",
                      [
                        "border-primary/20 bg-primary/5 text-primary",
                        "border-blue-300/20 bg-blue-300/5 text-blue-200",
                        "border-violet-300/20 bg-violet-300/5 text-violet-200",
                      ][i],
                    )}
                  >
                    {strategy}
                  </span>
                  <div className="flex-1">
                    <p className="text-[11px]">
                      {
                        [
                          "High Probability",
                          "Potential Value",
                          "Alternative Markets",
                        ][i]
                      }
                    </p>
                    <p className="mt-1 text-[9px] text-muted-foreground">
                      {item?.bets ?? 0} actual bets
                    </p>
                  </div>
                  <span
                    className={cn(
                      "tabular text-xs",
                      !item
                        ? "text-muted-foreground"
                        : item.profit >= 0
                          ? "text-primary"
                          : "text-red-300",
                    )}
                  >
                    {item ? signedMoney(Math.round(item.profit * 100)) : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      </div>
      {mode === "demo" && <SimulationNote />}
      <BetForm open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
