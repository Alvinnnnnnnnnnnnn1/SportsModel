import type { DailyCycle } from "./contract";
import type { DailyFeedbackSummary } from "./feedback";

export interface DailyCycleCheckpoint {
  cycleKey: string;
  cycle: DailyCycle;
  appliedAt: string;
  settledKeys: string[];
  skippedKeys: string[];
  feedback: DailyFeedbackSummary;
}

export interface DailyFeedbackJournalEntry {
  version: 1;
  cycleKey: string;
  recordedAt: string;
  summary: DailyFeedbackSummary;
  modelFeedback: DailyCycle["modelFeedback"];
}

export const dailyCycleStorageKey = (scope: string) =>
  `edgelab:daily-cycle:checkpoints:v1:${scope}`;
const feedbackStorageKey = (scope: string) =>
  `edgelab:daily-cycle:feedback:v1:${scope}`;

export function readDailyCycleCheckpoints(scope: string): DailyCycleCheckpoint[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(dailyCycleStorageKey(scope));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as DailyCycleCheckpoint[];
  } catch {
    return [];
  }
}

export function writeDailyCycleCheckpoint(
  scope: string,
  checkpoint: DailyCycleCheckpoint,
): void {
  const existing = readDailyCycleCheckpoints(scope);
  if (existing.some((item) => item.cycleKey === checkpoint.cycleKey)) return;
  window.localStorage.setItem(
    dailyCycleStorageKey(scope),
    JSON.stringify([...existing, checkpoint]),
  );
}

export function latestDailyCycleFeedback(scope: string): DailyFeedbackSummary | null {
  const latest = readDailyCycleCheckpoints(scope).at(-1);
  return latest?.feedback ?? null;
}

export function writeDailyFeedback(
  scope: string,
  entry: DailyFeedbackJournalEntry,
): void {
  const existing = readDailyFeedback(scope);
  if (existing.some((item) => item.cycleKey === entry.cycleKey)) return;
  window.localStorage.setItem(feedbackStorageKey(scope), JSON.stringify([...existing, entry]));
}

export function readDailyFeedback(scope: string): DailyFeedbackJournalEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(feedbackStorageKey(scope));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed as DailyFeedbackJournalEntry[] : [];
  } catch {
    return [];
  }
}
