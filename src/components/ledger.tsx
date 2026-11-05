"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Filter,
  Pencil,
  Plus,
  Search,
} from "lucide-react";
import { useApp } from "@/components/app-provider";
import { BetForm } from "@/components/bet-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HistoricalWagerClaimsSummary } from "@/components/imports/wager-claims-review";
import { ApprovalStatusBadges } from "@/components/approval-status";
import { readLedgerEvidence } from "@/lib/domain/ledger-review";
import { betProfit, betReturn } from "@/lib/domain/calculations";
import {
  SPORTS,
  STRATEGIES,
  type Bet,
  type Outcome,
  type Sport,
} from "@/lib/domain/types";
import { cn, dateTime, money } from "@/lib/utils";

type LedgerTab = "all" | "pending" | "settled";
const statusStyles: Record<Outcome, string> = {
  won: "border-emerald-400/15 bg-emerald-400/10 text-emerald-300",
  lost: "border-rose-400/15 bg-rose-400/10 text-rose-300",
  pending: "border-amber-400/15 bg-amber-400/10 text-amber-300",
  void: "border-slate-400/15 bg-slate-400/10 text-slate-300",
};

function OutcomeBadge({ outcome }: { outcome: Outcome }) {
  return (
    <Badge className={cn("gap-1.5 capitalize", statusStyles[outcome])}>
      <span className="size-1.5 rounded-full bg-current" />
      {outcome}
    </Badge>
  );
}

export function Ledger() {
  const { data, mode } = useApp();
  const [tab, setTab] = useState<LedgerTab>("all");
  const [search, setSearch] = useState("");
  const [sport, setSport] = useState<Sport | "all">("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Bet | undefined>();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const pendingCount = data.bets.filter(
    (bet) => bet.outcome === "pending",
  ).length;
  const settledCount = data.bets.length - pendingCount;
  const totalProfit = data.bets.reduce((sum, bet) => sum + betProfit(bet), 0);
  const pendingStake = data.bets
    .filter((bet) => bet.outcome === "pending" && bet.stakeType === "cash")
    .reduce((sum, bet) => sum + bet.stakeCents, 0);
  const bets = useMemo(
    () =>
      data.bets
        .filter((bet) => {
          if (tab === "pending" && bet.outcome !== "pending") return false;
          if (tab === "settled" && bet.outcome === "pending") return false;
          if (sport !== "all" && !bet.legs.some((leg) => leg.sport === sport))
            return false;
          const query = search.trim().toLowerCase();
          return (
            !query ||
            [
              bet.bookmaker,
              bet.notes,
              ...bet.legs.flatMap((leg) => [
                leg.event,
                leg.participant,
                leg.market,
                leg.selection,
              ]),
            ]
              .join(" ")
              .toLowerCase()
              .includes(query)
          );
        })
        .sort((a, b) => b.placedAt.localeCompare(a.placedAt)),
    [data.bets, tab, sport, search],
  );

  function edit(bet: Bet) {
    setEditing(bet);
    setFormOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-[0.18em] text-emerald-400">
            Your experiment, recorded
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Betting ledger
          </h1>
          <p className="muted mt-2 text-sm">
            Every stake, selection and outcome. A complete record of your
            experiment.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(undefined);
            setFormOpen(true);
          }}
        >
          <Plus className="mr-2 size-4" />
          Record bet
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <LedgerStat
          label="Confirmed entries"
          value={String(data.bets.length)}
          note={
            mode === "demo"
              ? "Synthetic actual-ledger bets"
              : "Manually confirmed bets"
          }
        />
        <LedgerStat
          label="Pending cash stake"
          value={money(pendingStake)}
          note={`${pendingCount} pending entries`}
        />
        <LedgerStat
          label="Realised P/L"
          value={money(totalProfit)}
          note="Cash and bonus returns"
          positive={totalProfit >= 0}
        />
        <LedgerStat
          label="Settled entries"
          value={String(settledCount)}
          note="Won, lost and void"
        />
      </div>

      <HistoricalWagerClaimsSummary />

      <section className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] p-4 sm:px-5">
          <div
            className="flex flex-wrap gap-1 rounded-lg bg-black/20 p-1"
            role="tablist"
            aria-label="Ledger views"
          >
            {(
              [
                { key: "all", label: "Actual bets", count: data.bets.length },
                { key: "pending", label: "Pending", count: pendingCount },
                { key: "settled", label: "Settled", count: settledCount },
              ] as const
            ).map((item) => (
              <button
                key={item.key}
                role="tab"
                aria-selected={tab === item.key}
                onClick={() => setTab(item.key)}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors",
                  tab === item.key
                    ? "bg-white/[0.08] text-white shadow-sm"
                    : "text-slate-400 hover:text-white",
                )}
              >
                {item.label}
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[10px] tabular-nums",
                    tab === item.key
                      ? "bg-emerald-400/10 text-emerald-300"
                      : "bg-white/5 text-slate-500",
                  )}
                >
                  {item.count}
                </span>
              </button>
            ))}
            <Link
              href="/paper"
              className="flex items-center gap-1 rounded-md px-3 py-2 text-xs font-medium text-slate-400 hover:text-white"
            >
              Paper predictions
              <ArrowUpRight className="size-3" />
            </Link>
          </div>
          <div className="flex flex-1 items-center justify-end gap-2 sm:flex-none">
            <div className="relative min-w-0 flex-1 sm:w-56">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-500" />
              <Input
                aria-label="Search ledger"
                placeholder="Search selections…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-9"
              />
            </div>
            <div className="relative">
              <Filter className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-500" />
              <select
                aria-label="Filter ledger by sport"
                className="input max-w-36 pl-9 text-xs"
                value={sport}
                onChange={(event) =>
                  setSport(event.target.value as Sport | "all")
                }
              >
                <option value="all">All sports</option>
                {SPORTS.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        {bets.length === 0 ? (
          <div className="empty-state flex min-h-64 flex-col items-center justify-center px-6 py-14 text-center">
            <ClipboardList className="mb-4 size-9 text-slate-600" />
            <h3 className="font-medium">
              {data.bets.length
                ? "No matching entries"
                : "Start your betting ledger"}
            </h3>
            <p className="muted mt-2 max-w-md text-sm">
              {data.bets.length
                ? "Try another search or sport filter."
                : "Record a bet you manually confirmed. Paper predictions have their own separate tracking area."}
            </p>
            {!data.bets.length && (
              <Button
                className="mt-5"
                variant="outline"
                onClick={() => {
                  setEditing(undefined);
                  setFormOpen(true);
                }}
              >
                <Plus className="mr-2 size-4" />
                Record first entry
              </Button>
            )}
          </div>
        ) : (
          <div className="table-wrap overflow-x-auto">
            <table className="data-table w-full min-w-[850px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.015] text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3 font-medium">Selection / event</th>
                  <th className="px-4 py-3 font-medium">Strategy</th>
                  <th className="px-4 py-3 font-medium">Stake</th>
                  <th className="px-4 py-3 font-medium">Odds</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">P/L</th>
                  <th className="px-4 py-3" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {bets.map((bet) => (
                  <LedgerRows
                    key={bet.id}
                    bet={bet}
                    expanded={expandedId === bet.id}
                    onToggle={() =>
                      setExpandedId(expandedId === bet.id ? null : bet.id)
                    }
                    onEdit={() => edit(bet)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.07] px-5 py-3 text-[11px] text-slate-500">
          <span>
            {bets.length} of {data.bets.length} entries · AUD ·
            Australia/Melbourne
          </span>
          <span>Paper results never affect your cash bankroll</span>
        </div>
      </section>
      <div className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.015] px-4 py-3 text-xs leading-relaxed text-slate-400">
        <ArrowDownLeft className="mt-0.5 size-4 shrink-0 text-emerald-400" />
        <p>
          Cash stake is reserved while a bet is pending. Settlement updates
          available bankroll deterministically. Edits preserve an audit record;
          research forecasts remain immutable.
        </p>
      </div>
      <BetForm open={formOpen} onOpenChange={setFormOpen} initial={editing} />
    </div>
  );
}

function LedgerStat({
  label,
  value,
  note,
  positive,
}: {
  label: string;
  value: string;
  note: string;
  positive?: boolean;
}) {
  return (
    <div className="panel p-4 sm:p-5">
      <p className="text-xs text-slate-400">{label}</p>
      <p
        className={cn(
          "mt-3 text-2xl font-semibold tabular-nums tracking-tight",
          positive === true && "text-emerald-400",
          positive === false && "text-rose-400",
        )}
      >
        {value}
      </p>
      <p className="mt-2 text-[11px] text-slate-500">{note}</p>
    </div>
  );
}

function LedgerRows({
  bet,
  expanded,
  onToggle,
  onEdit,
}: {
  bet: Bet;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
}) {
  const { data, mode } = useApp();
  const first = bet.legs[0];
  const linkedResearch = data.candidates.find(item => item.id === bet.candidateId) ?? data.paperPredictions.find(item => item.candidate.id === bet.candidateId)?.candidate;
  const profit = betProfit(bet);
  const audits = data.audit
    .filter((entry) => entry.entityType === "bet" && entry.entityId === bet.id)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return (
    <>
      <tr className="border-b border-white/[0.045] transition-colors hover:bg-white/[0.02]">
        <td className="px-5 py-4">
          <button
            onClick={onToggle}
            className="group flex max-w-[340px] items-start gap-3 text-left"
            aria-expanded={expanded}
            aria-label={`View details: ${first?.selection ?? "Bet"}`}
          >
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.025] text-[10px] font-semibold text-slate-400">
              {bet.legs.length > 1 ? `${bet.legs.length}×` : first?.sport}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-medium text-slate-200 group-hover:text-emerald-300">
                {bet.legs.length > 1
                  ? `${bet.legs.length}-leg parlay · ${first?.selection}`
                  : `${first?.participant} · ${first?.selection}`}
              </span>
              <span className="mt-1 block truncate text-[11px] text-slate-500">
                {first?.event}
              </span>
              <span className="mt-1 block text-[10px] text-slate-600">
                {bet.bookmaker} · {dateTime(bet.placedAt)}
              </span>
            </span>
          </button>
        </td>
        <td className="px-4 py-4">
          <span className="rounded-md border border-white/[0.07] bg-white/[0.025] px-2 py-1 text-[10px] text-slate-400">
            Track {bet.strategy}
          </span>
        </td>
        <td className="px-4 py-4">
          <span className="font-medium tabular-nums text-slate-300">
            {money(bet.stakeCents)}
          </span>
          {bet.stakeType === "bonus" && (
            <span className="mt-1 block text-[10px] text-amber-300">Bonus</span>
          )}
        </td>
        <td className="px-4 py-4 text-[13px] tabular-nums text-slate-300">
          {bet.odds.toFixed(2)}
        </td>
        <td className="px-4 py-4">
          <OutcomeBadge outcome={bet.outcome} />
        </td>
        <td
          className={cn(
            "px-4 py-4 text-right text-[13px] font-medium tabular-nums",
            bet.outcome === "pending"
              ? "text-slate-500"
              : profit > 0
                ? "text-emerald-400"
                : profit < 0
                  ? "text-rose-400"
                  : "text-slate-400",
          )}
        >
          {bet.outcome === "pending"
            ? "—"
            : `${profit > 0 ? "+" : ""}${money(profit)}`}
        </td>
        <td className="px-4 py-4">
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={onEdit}
              aria-label={`Edit ${first?.selection ?? "entry"}`}
              className="text-[10px]"
            >
              <Pencil className="size-3.5" />
              {bet.outcome === "pending" ? "Settle wager" : "Review / edit"}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggle}
              aria-label={expanded ? "Collapse entry" : "Expand entry"}
              aria-expanded={expanded}
              className="size-8 text-slate-500 hover:text-white"
            >
              {expanded ? (
                <ChevronUp className="size-3.5" />
              ) : (
                <ChevronDown className="size-3.5" />
              )}
            </Button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-white/[0.07] bg-black/10">
          <td colSpan={7} className="p-5">
            <div className="space-y-4">
              <ApprovalStatusBadges facts={{ mode, financialRegistered: true, ownerAttested: true, outcome: bet.outcome }} />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-slate-400">
                  Track {bet.strategy} · {STRATEGIES[bet.strategy]}{" "}
                  <span className="ml-3 text-slate-600">
                    Entry {bet.id.slice(0, 8)}
                  </span>
                </p>
                <Button variant="outline" size="sm" onClick={onEdit}>
                  <Pencil className="mr-1.5 size-3" />
                  {bet.outcome === "pending"
                    ? "Settle registered wager"
                    : "Edit with audit"}
                </Button>
              </div>
              <dl className="grid grid-cols-2 gap-4 rounded-lg border border-border p-3 text-xs sm:grid-cols-3">
                <div><dt className="text-muted-foreground">Original research odds</dt><dd className="mt-1">{linkedResearch?.odds ?? "Unknown / not linked"}</dd></div>
                <div><dt className="text-muted-foreground">Accepted / final settlement odds</dt><dd className="mt-1">{bet.odds}</dd></div>
                <div><dt className="text-muted-foreground">Ticket reference</dt><dd className="mt-1">{readLedgerEvidence(bet.notes).ticketReference || "Not supplied"}</dd></div>
                <div><dt className="text-muted-foreground">Cash returned</dt><dd className="mt-1">{bet.outcome === "pending" ? "Not settled" : money(betReturn(bet))}</dd><p className="mt-1 text-[10px] text-muted-foreground">{readLedgerEvidence(bet.notes).payoutCents === null ? "Calculated from registered settlement; external payout evidence not supplied" : "Owner-recorded payout reconciled at confirmation"}</p></div>
              </dl>
              <div className="grid gap-2">
                {bet.legs.map((leg, index) => (
                  <div
                    key={leg.id}
                    className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-white/[0.06] bg-white/[0.015] px-4 py-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500">
                          LEG {index + 1} · {leg.sport}
                        </span>
                        <span className="text-xs font-medium text-slate-300">
                          {leg.participant}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">
                        {leg.market} · {leg.selection} · Line {leg.line}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {leg.event}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs tabular-nums text-slate-400">
                        {leg.odds.toFixed(2)}
                      </span>
                      <OutcomeBadge outcome={leg.outcome} />
                      <span className="max-w-40 text-xs text-slate-400">
                        {leg.statistic || "No statistic recorded"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {bet.notes && (
                <p className="text-xs leading-relaxed text-slate-400">
                  <span className="font-medium text-slate-300">Notes:</span>{" "}
                  {bet.notes}
                </p>
              )}
              {bet.probability !== undefined && (
                <p className="text-[11px] text-slate-500">
                  Original registered probability:{" "}
                  {(bet.probability * 100).toFixed(1)}%
                  {bet.candidateId
                    ? ` · Research ${bet.candidateId.slice(0, 8)}`
                    : ""}
                </p>
              )}
              <div className="border-t border-white/[0.06] pt-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Audit history
                </p>
                <p className="mt-2 text-[11px] text-slate-500">
                  Manually confirmed {dateTime(bet.confirmedAt)}
                  {bet.settledAt ? ` · Settled ${dateTime(bet.settledAt)}` : ""}
                </p>
                {audits.length ? (
                  <ul className="mt-2 space-y-1.5">
                    {audits.map((audit) => (
                      <li key={audit.id} className="text-[11px] text-slate-400">
                        <details>
                          <summary className="cursor-pointer">
                            <span className="text-slate-500">
                              {dateTime(audit.timestamp)}
                            </span>{" "}
                            · {audit.action.replaceAll("_", " ")}
                          </summary>
                          <div className="mt-2 grid gap-3 md:grid-cols-2">
                            <div>
                              <p className="mb-1 text-slate-500">
                                Previous record
                              </p>
                              <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-black/20 p-3 text-[10px] leading-relaxed">
                                {JSON.stringify(audit.before, null, 2)}
                              </pre>
                            </div>
                            <div>
                              <p className="mb-1 text-slate-500">
                                Saved record
                              </p>
                              <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-black/20 p-3 text-[10px] leading-relaxed">
                                {JSON.stringify(audit.after, null, 2)}
                              </pre>
                            </div>
                          </div>
                        </details>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-[11px] text-slate-600">
                    No edits recorded.
                  </p>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
