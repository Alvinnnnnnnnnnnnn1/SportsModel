import type { Bet, PaperPrediction, Transaction } from "./types";

/** Illustrative estimate from fictional observation counts, never a live model. */
export function estimateSyntheticProbability(
  wins: number,
  trials: number,
): number {
  if (
    !Number.isSafeInteger(wins) ||
    !Number.isSafeInteger(trials) ||
    trials < 0 ||
    wins < 0 ||
    wins > trials ||
    trials > Number.MAX_SAFE_INTEGER - 2
  ) {
    throw new Error(
      "Synthetic observations require integer counts with 0 ≤ wins ≤ trials",
    );
  }
  return (wins + 1) / (trials + 2);
}

/** Round to the nearest cent, half up. Odds have at most four decimal places. */
export function multiplyMoney(cents: number, decimal: number): number {
  if (
    !Number.isSafeInteger(cents) ||
    cents < 0 ||
    !Number.isFinite(decimal) ||
    decimal < 0
  )
    throw new Error("Invalid money or multiplier");
  const scaled = BigInt(Math.round(decimal * 10_000));
  const result = (BigInt(cents) * scaled + 5_000n) / 10_000n;
  const value = Number(result);
  if (!Number.isSafeInteger(value))
    throw new Error("Money exceeds supported precision");
  return value;
}

/** Cash returned at settlement. A bonus stake is never returned as cash. */
export function betReturn(bet: Bet): number {
  if (bet.outcome === "pending" || bet.outcome === "lost") return 0;
  if (bet.outcome === "void")
    return bet.stakeType === "cash" ? bet.stakeCents : 0;
  return bet.stakeType === "cash"
    ? multiplyMoney(bet.stakeCents, bet.odds)
    : multiplyMoney(bet.stakeCents, Math.max(0, bet.odds - 1));
}

/** Realised P/L only; pending stakes are a reserve, not a realised loss. */
export function betProfit(bet: Bet): number {
  if (bet.outcome === "pending" || bet.outcome === "void") return 0;
  return betReturn(bet) - (bet.stakeType === "cash" ? bet.stakeCents : 0);
}

export function impliedProbability(odds: number): number | null {
  return Number.isFinite(odds) && odds > 1 ? 1 / odds : null;
}

/** Expected net return per unit stake, not evidence of an actual edge. */
export function expectedValue(
  probability: number | undefined,
  odds: number,
): number | null {
  return probability !== undefined &&
    Number.isFinite(probability) &&
    probability >= 0 &&
    probability <= 1 &&
    Number.isFinite(odds) &&
    odds > 1
    ? probability * odds - 1
    : null;
}

export function calculateMetrics(bets: Bet[], transactions: Transaction[]) {
  const decisive = bets.filter(
    (b) => b.outcome === "won" || b.outcome === "lost",
  );
  const cashSettled = decisive.filter((b) => b.stakeType === "cash");
  const stakedCents = cashSettled.reduce((n, b) => n + b.stakeCents, 0);
  const profitCents = bets.reduce((n, b) => n + betProfit(b), 0);
  const cashProfitCents = cashSettled.reduce((n, b) => n + betProfit(b), 0);
  const bonusProfitCents = bets
    .filter((b) => b.stakeType === "bonus")
    .reduce((n, b) => n + betProfit(b), 0);
  const totalDepositsCents = transactions
    .filter((t) => t.kind === "deposit")
    .reduce((n, t) => n + t.amountCents, 0);
  const withdrawalsCents = transactions
    .filter((t) => t.kind === "withdrawal")
    .reduce((n, t) => n + t.amountCents, 0);
  const pendingStakeCents = bets
    .filter((b) => b.outcome === "pending" && b.stakeType === "cash")
    .reduce((n, b) => n + b.stakeCents, 0);
  const forecasts = decisive.filter(
    (b): b is Bet & { probability: number } =>
      b.probability !== undefined && b.probability >= 0 && b.probability <= 1,
  );
  return {
    bankrollCents:
      totalDepositsCents - withdrawalsCents + profitCents - pendingStakeCents,
    equityCents: totalDepositsCents - withdrawalsCents + profitCents,
    totalDepositsCents,
    withdrawalsCents,
    profitCents,
    cashProfitCents,
    bonusProfitCents,
    pendingStakeCents,
    stakedCents,
    roi: stakedCents > 0 ? (cashProfitCents / stakedCents) * 100 : null,
    totalBets: bets.length,
    won: bets.filter((b) => b.outcome === "won").length,
    lost: bets.filter((b) => b.outcome === "lost").length,
    pending: bets.filter((b) => b.outcome === "pending").length,
    void: bets.filter((b) => b.outcome === "void").length,
    hitRate: decisive.length
      ? (decisive.filter((b) => b.outcome === "won").length / decisive.length) *
        100
      : null,
    averageOdds: bets.length
      ? bets.reduce((n, b) => n + b.odds, 0) / bets.length
      : null,
    brierScore: forecasts.length
      ? forecasts.reduce(
          (n, b) => n + (b.probability - (b.outcome === "won" ? 1 : 0)) ** 2,
          0,
        ) / forecasts.length
      : null,
    forecastCount: forecasts.length,
    settledCount: decisive.length,
  };
}

const melbourneCalendarFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Australia/Melbourne",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
function melbourneCalendarDate(timestamp: string): string {
  const parts = melbourneCalendarFormatter.formatToParts(new Date(timestamp));
  const part = (name: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === name)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function performanceSeries(
  bets: Bet[],
  transactions: Transaction[],
): { date: string; profit: number; bankroll: number }[] {
  const changes: { at: string; profit: number; cash: number }[] =
    transactions.map((t) => ({
      at: t.createdAt,
      profit: 0,
      cash: (t.kind === "deposit" ? 1 : -1) * t.amountCents,
    }));
  for (const bet of bets) {
    changes.push({
      at: bet.placedAt,
      profit: 0,
      cash: bet.stakeType === "cash" ? -bet.stakeCents : 0,
    });
    if (bet.outcome !== "pending")
      changes.push({
        at: bet.settledAt ?? bet.placedAt,
        profit: betProfit(bet),
        cash: betReturn(bet),
      });
  }
  changes.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const result: { date: string; profit: number; bankroll: number }[] = [];
  let profit = 0,
    cash = 0;
  for (const change of changes) {
    profit += change.profit;
    cash += change.cash;
    const date = melbourneCalendarDate(change.at);
    const point = { date, profit: profit / 100, bankroll: cash / 100 };
    if (result.at(-1)?.date === date) result[result.length - 1] = point;
    else result.push(point);
  }
  return result;
}

export function groupPerformance(
  bets: Bet[],
  group: "sport" | "strategy",
): { name: string; profit: number; bets: number }[] {
  const grouped = new Map<
    string,
    { name: string; profit: number; bets: number }
  >();
  for (const bet of bets) {
    const sports = [...new Set(bet.legs.map((l) => l.sport))];
    const name =
      group === "sport"
        ? sports.length === 1
          ? sports[0]
          : "Mixed"
        : `Track ${bet.strategy}`;
    const item = grouped.get(name) ?? { name, profit: 0, bets: 0 };
    item.profit += betProfit(bet);
    item.bets++;
    grouped.set(name, item);
  }
  return [...grouped.values()].map((item) => ({
    ...item,
    profit: item.profit / 100,
  }));
}

/** Deciles retain their true sample sizes; sparse buckets are not an edge claim. */
export function calibration(
  bets: Bet[],
): { bucket: string; predicted: number; actual: number; count: number }[] {
  const buckets = new Map<
    number,
    { sum: number; wins: number; count: number }
  >();
  for (const b of bets) {
    if (
      b.probability === undefined ||
      b.probability < 0 ||
      b.probability > 1 ||
      !["won", "lost"].includes(b.outcome)
    )
      continue;
    const bucket = Math.min(9, Math.floor(b.probability * 10));
    const item = buckets.get(bucket) ?? { sum: 0, wins: 0, count: 0 };
    item.sum += b.probability;
    item.wins += Number(b.outcome === "won");
    item.count++;
    buckets.set(bucket, item);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([key, b]) => ({
      bucket: `${key * 10}–${(key + 1) * 10}%`,
      predicted: (b.sum / b.count) * 100,
      actual: (b.wins / b.count) * 100,
      count: b.count,
    }));
}

/** Explicit conversion for hypothetical analytics only. Never feed into actual cash metrics. */
export function paperAsBets(predictions: PaperPrediction[]): Bet[] {
  return predictions.map((p) => ({
    id: p.id,
    placedAt: p.registeredAt,
    settledAt: p.settledAt,
    confirmedAt: p.registeredAt,
    bookmaker: p.candidate.bookmaker,
    stakeCents: p.hypotheticalStakeCents,
    stakeType: "cash",
    odds: p.candidate.odds,
    outcome: p.outcome,
    strategy: p.candidate.strategy,
    notes: "Hypothetical paper prediction",
    probability: p.candidate.probability,
    candidateId: p.candidate.id,
    oddsProvenance: p.candidate.oddsProvenance,
    probabilityProvenance: p.candidate.probabilityProvenance,
    legs: [
      {
        id: p.id,
        sport: p.candidate.sport,
        event: p.candidate.event,
        participant: p.candidate.participant,
        market: p.candidate.market,
        selection: p.candidate.selection,
        line: p.candidate.line,
        odds: p.candidate.odds,
        outcome: p.outcome,
        statistic: p.statistic,
      },
    ],
  }));
}
