import { createMockCandidates } from "../domain/fixtures";
import type { AppNotification, Candidate, Sport } from "../domain/types";
import type {
  AIResearchProvider,
  NotificationProvider,
  OddsProvider,
  ResearchEngine,
  SportsDataProvider,
} from "./interfaces";

export const mockOddsProvider: OddsProvider = {
  name: "Synthetic fixture odds",
  async getMarkets(sports) {
    return createMockCandidates()
      .filter((c) => sports.includes(c.sport))
      .map((c) => ({
        sport: c.sport,
        event: c.event,
        participant: c.participant,
        market: c.market,
        selection: c.selection,
        line: c.line,
        bookmaker: c.bookmaker,
        odds: c.odds,
        timestamp: c.oddsProvenance.timestamp,
        simulated: true,
      }));
  },
};
export const mockSportsDataProvider: SportsDataProvider = {
  name: "Synthetic fixture statistics",
  async getStatistics(sports) {
    return sports.map((sport: Sport, i) => ({
      sport,
      participant: `Fictional ${sport} participant`,
      metric: "Illustrative sample size",
      value: 15 + i * 3,
      source: "EdgeLab synthetic statistics",
      timestamp: new Date().toISOString(),
      simulated: true,
    }));
  },
};
// A process-local delivery sink for adapter tests; UI persistence is handled by Repository.
const deliveredNotifications = new Map<string, AppNotification>();
export function getMockNotificationHistory(): AppNotification[] {
  return structuredClone([...deliveredNotifications.values()]);
}
export const inAppNotificationProvider: NotificationProvider = {
  name: "In-app notification generator",
  create(candidate): AppNotification {
    return {
      id: crypto.randomUUID(),
      candidateId: candidate.id,
      title: `Simulated ${candidate.sport} research opportunity`,
      message: `${candidate.participant} · ${candidate.selection} at ${candidate.odds.toFixed(2)}. Synthetic research only.`,
      createdAt: new Date().toISOString(),
      simulated: candidate.oddsProvenance.simulated,
    };
  },
  async deliver(notification) {
    deliveredNotifications.set(notification.id, structuredClone(notification));
    return { delivered: true, channel: "in-app" };
  },
};
export const mockAIResearchProvider: AIResearchProvider = {
  name: "Static narrative fixture (no AI calls)",
  async explain(candidate) {
    return {
      narrative: candidate.rationale,
      source: "Static synthetic research explanation",
      simulated: true,
    };
  },
};
export const mockResearchEngine: ResearchEngine = {
  name: "Local simulated research workflow",
  async run() {
    const startedAt = new Date().toISOString();
    const sports: Sport[] = ["NBA", "NBL", "ATP", "WTA"];
    const [markets, stats] = await Promise.all([
      mockOddsProvider.getMarkets(sports),
      mockSportsDataProvider.getStatistics(sports),
    ]);
    const candidates = createMockCandidates();
    // Match synthetic markets; estimates are calculated from fictional observation counts.
    const found = candidates.filter(
      (c) =>
        markets.some(
          (m) => m.event === c.event && m.selection === c.selection,
        ) && stats.some((s) => s.sport === c.sport),
    );
    const notifications = found.map((c) => inAppNotificationProvider.create(c));
    return {
      candidates: found,
      notifications,
      run: {
        id: crypto.randomUUID(),
        startedAt,
        completedAt: new Date().toISOString(),
        status: "completed",
        candidateCount: found.length,
        simulated: true,
      },
    };
  },
};
export function createTestNotification(): {
  candidate: Candidate;
  notification: AppNotification;
} {
  const candidate = createMockCandidates()[0];
  const notification = inAppNotificationProvider.create(candidate);
  return {
    candidate,
    notification: {
      ...notification,
      title: "Test · simulated research notification",
    },
  };
}
