import type { AppData } from "@/lib/domain/types";

export interface DailyFeedbackSummary {
  version: 1;
  sampleSize: number;
  brierScore: number | null;
  logLoss: number | null;
  impliedBaselineBrier: number | null;
  calibration: "insufficient_sample" | "descriptive_only";
}

export function calculateDailyFeedback(data: AppData): DailyFeedbackSummary {
  const rows = [
    ...data.bets.filter((bet) => bet.outcome === "won" || bet.outcome === "lost").map((bet) => ({
      probability: bet.probability,
      odds: bet.odds,
      outcome: bet.outcome === "won" ? 1 : 0,
    })),
    ...data.paperPredictions.filter((paper) => paper.outcome === "won" || paper.outcome === "lost").map((paper) => ({
      probability: paper.candidate.probability,
      odds: paper.candidate.odds,
      outcome: paper.outcome === "won" ? 1 : 0,
    })),
  ].filter((row): row is { probability: number; odds: number; outcome: number } =>
    row.probability !== undefined && Number.isFinite(row.probability) && row.probability >= 0 && row.probability <= 1,
  );
  if (!rows.length) {
    return { version: 1, sampleSize: 0, brierScore: null, logLoss: null, impliedBaselineBrier: null, calibration: "insufficient_sample" };
  }
  const clamp = (value: number) => Math.min(1 - 1e-12, Math.max(1e-12, value));
  const brierScore = rows.reduce((sum, row) => sum + (row.probability - row.outcome) ** 2, 0) / rows.length;
  const logLoss = rows.reduce((sum, row) => sum - (row.outcome ? Math.log(clamp(row.probability)) : Math.log(clamp(1 - row.probability))), 0) / rows.length;
  const baselines = rows.filter((row) => row.odds > 1).map((row) => 1 / row.odds);
  const impliedBaselineBrier = baselines.length
    ? rows.filter((row) => row.odds > 1).reduce((sum, row) => sum + (1 / row.odds - row.outcome) ** 2, 0) / baselines.length
    : null;
  return {
    version: 1,
    sampleSize: rows.length,
    brierScore,
    logLoss,
    impliedBaselineBrier,
    calibration: "descriptive_only",
  };
}
