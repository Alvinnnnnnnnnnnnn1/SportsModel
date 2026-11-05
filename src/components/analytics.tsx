"use client";
import { useState } from "react";
import {
  ChartNoAxesCombined,
  CircleHelp,
  Crosshair,
  Percent,
  Target,
} from "lucide-react";
import { useApp } from "./app-provider";
import {
  calculateMetrics,
  calibration,
  groupPerformance,
  paperAsBets,
  performanceSeries,
} from "@/lib/domain/calculations";
import { cn, money, percent, signedMoney } from "@/lib/utils";
import { CalibrationChart, GroupChart, PerformanceChart } from "./charts";
import { SimulationNote, StatCard } from "./shared";
import { PaperLearning } from "./paper-learning";
import { ImportedPaperSummary } from "./imports/imported-paper";
export function Analytics() {
  const { data, mode } = useApp();
  const [tab, setTab] = useState<"actual" | "paper">("actual");
  const paperBets = paperAsBets(data.paperPredictions);
  const bets = tab === "actual" ? data.bets : paperBets;
  const m = calculateMetrics(bets, tab === "actual" ? data.transactions : []);
  const actual = calculateMetrics(data.bets, data.transactions);
  const paper = calculateMetrics(paperBets, []);
  const buckets = calibration(bets);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="section-kicker mb-2">Measure the process</div>
          <h1 className="page-heading">Performance analytics</h1>
          <p className="mt-2 text-xs text-muted-foreground">
            Understand results, probability estimates and the limits of your
            sample.
          </p>
        </div>
        <div className="flex rounded-lg border border-border p-1">
          {(["actual", "paper"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              aria-pressed={tab === t}
              className={cn(
                "rounded-md px-4 py-2 text-xs",
                tab === t
                  ? "bg-[#24382b] text-primary"
                  : "text-muted-foreground",
              )}
            >
              {t === "actual" ? "Actual bets" : "Paper predictions"}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title={tab === "actual" ? "Cash ROI" : "Hypothetical ROI"}
          value={percent(m.roi)}
          detail={`${money(m.stakedCents)} settled ${tab === "actual" ? "cash" : "hypothetical"} stakes`}
          icon={<Percent className="size-4" />}
        />
        <StatCard
          title={tab === "actual" ? "Realised P/L" : "Hypothetical P/L"}
          value={signedMoney(m.profitCents)}
          detail={
            tab === "actual"
              ? "Includes bonus winnings"
              : "Excluded from actual cash bankroll"
          }
          icon={<ChartNoAxesCombined className="size-4" />}
        />
        <StatCard
          title="Hit rate"
          value={percent(m.hitRate)}
          detail={`${m.won} wins from ${m.settledCount} decisive results`}
          icon={<Target className="size-4" />}
        />
        <StatCard
          title="Average decimal odds"
          value={m.averageOdds?.toFixed(2) ?? "—"}
          detail={`${m.totalBets} total ${tab === "actual" ? "confirmed bets" : "registered predictions"}`}
          icon={<Crosshair className="size-4" />}
        />
      </div>
      <div className="panel overflow-hidden">
        <div className="flex items-center justify-between p-5">
          <div>
            <h2 className="text-sm font-medium">
              {tab === "actual" ? "Actual" : "Paper"} performance over time
            </h2>
            <p className="mt-1.5 text-[10px] text-muted-foreground">
              Cumulative {tab === "actual" ? "realised" : "hypothetical"} profit
              / loss · AUD
            </p>
          </div>
          <span className="rounded border border-border px-2 py-1 text-[9px] text-muted-foreground">
            LIFETIME
          </span>
        </div>
        <div className="px-4 pb-5">
          <PerformanceChart
            data={performanceSeries(
              bets,
              tab === "actual" ? data.transactions : [],
            )}
          />
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="panel p-5">
          <h2 className="text-sm font-medium">Profit / loss by sport</h2>
          <p className="mt-1.5 text-[10px] text-muted-foreground">
            Mixed-sport parlays are counted once under Mixed.
          </p>
          <GroupChart data={groupPerformance(bets, "sport")} />
        </section>
        <section className="panel p-5">
          <h2 className="text-sm font-medium">Profit / loss by strategy</h2>
          <p className="mt-1.5 text-[10px] text-muted-foreground">
            A · High Probability &nbsp; B · Potential Value &nbsp; C ·
            Alternative Markets
          </p>
          <GroupChart data={groupPerformance(bets, "strategy")} />
        </section>
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(260px,1fr)]">
        <section className="panel p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-medium">Probability calibration</h2>
              <p className="mt-1.5 text-[10px] text-muted-foreground">
                Registered estimates vs. observed outcomes · probability deciles
              </p>
            </div>
            <div className="flex gap-3 text-[9px] text-muted-foreground">
              <span>
                <span className="mr-1 inline-block h-0.5 w-3 bg-[#8196b5]" />
                Predicted
              </span>
              <span>
                <span className="mr-1 inline-block h-0.5 w-3 bg-primary" />
                Observed
              </span>
            </div>
          </div>
          <CalibrationChart data={buckets} />
          <div className="mt-3 flex flex-wrap gap-2">
            {buckets.map((b) => (
              <span
                key={b.bucket}
                className="rounded border border-border px-2 py-1 text-[9px] text-muted-foreground"
              >
                {b.bucket} · n={b.count}
              </span>
            ))}
          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
            {m.forecastCount < 30
              ? "Insufficient sample for reliable calibration conclusions. "
              : "Sample size alone does not establish predictive advantage. "}
            Small buckets are unstable; no statistical advantage is inferred.
          </p>
        </section>
        <section className="panel p-5">
          <h2 className="text-sm font-medium">Forecast quality</h2>
          <div className="mb-5 mt-7">
            <p className="text-[10px] text-muted-foreground">
              Basic Brier score
            </p>
            <p className="tabular mt-2 text-4xl tracking-tight">
              {m.brierScore === null ? "—" : m.brierScore.toFixed(3)}
            </p>
            <p className="mt-2 text-[10px] text-muted-foreground">
              {m.forecastCount} settled forecasts · lower is better
            </p>
          </div>
          <div className="space-y-3 border-t border-border pt-4 text-[11px] text-muted-foreground">
            <p>
              Mean squared error between the registered probability and the
              binary outcome (win = 1, loss = 0).
            </p>
            <p>
              Pending and void outcomes are excluded. Bets without registered
              probabilities are excluded.
            </p>
            <div className="flex items-start gap-2 rounded-lg bg-secondary/70 p-3">
              <CircleHelp className="mt-0.5 size-3.5 shrink-0 text-[#c3b17b]" />
              <span>
                {mode === "demo"
                  ? "These synthetic forecasts demonstrate the calculation only. They are not evidence of model skill."
                  : "Interpret alongside sample size, base rates and out-of-sample validation."}
              </span>
            </div>
          </div>
        </section>
      </div>
      <section className="panel overflow-hidden">
        <div className="p-5">
          <h2 className="text-sm font-medium">Actual versus paper</h2>
          <p className="mt-1.5 text-[10px] text-muted-foreground">
            Independent records. Paper profit never contributes to actual funds.
          </p>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tracking type</th>
                <th>Entries</th>
                <th>Decisive results</th>
                <th>Profit / loss</th>
                <th>ROI</th>
                <th>Hit rate</th>
                <th>Avg. odds</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Actual bets", actual],
                ["Paper predictions", paper],
              ].map(([label, metrics]) => {
                const value = metrics as typeof actual;
                return (
                  <tr key={String(label)}>
                    <td>{String(label)}</td>
                    <td>{value.totalBets}</td>
                    <td>{value.settledCount}</td>
                    <td className="tabular">
                      {signedMoney(value.profitCents)}
                    </td>
                    <td>{percent(value.roi)}</td>
                    <td>{percent(value.hitRate)}</td>
                    <td>{value.averageOdds?.toFixed(2) ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="border-t border-border px-5 py-3 text-[10px] text-muted-foreground">
          ROI uses settled, non-void cash stakes and cash P/L. Bonus winnings
          appear in total P/L and are excluded from cash ROI.
        </div>
      </section>
      <ImportedPaperSummary />
      <PaperLearning />
      {mode === "demo" && <SimulationNote />}
    </div>
  );
}
