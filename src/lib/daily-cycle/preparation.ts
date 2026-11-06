import type { SportsSnapshot } from "@/lib/sports/types";

export interface DailyResearchPreparation {
  retrievedAt: string;
  observations: SportsSnapshot[];
  warnings: string[];
  coverage: string;
}

function melbourneDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export async function prepareDailyResearch(input: {
  mode: "demo" | "supabase";
  now?: Date;
  accessToken?: string;
  read?: (provider: "api-nba" | "api-basketball", date: string) => Promise<SportsSnapshot>;
}): Promise<DailyResearchPreparation> {
  const retrievedAt = (input.now ?? new Date()).toISOString();
  const date = melbourneDate(input.now ?? new Date());
  if (input.mode === "demo") {
    return {
      retrievedAt,
      observations: [],
      coverage: "No live provider request was made in Demo mode.",
      warnings: [
        "API-NBA and API-Basketball observations are unavailable in Demo mode; no player statistics were simulated.",
        `Provider coverage requested for ${date}: NBA and Australian NBL.`,
      ],
    };
  }
  if (!input.read || !input.accessToken) {
    return {
      retrievedAt,
      observations: [],
      coverage: "Provider access is not configured.",
      warnings: ["No sports API request was made. Missing authenticated provider access is preserved explicitly."],
    };
  }
  const results = await Promise.allSettled([
    input.read("api-nba", date),
    input.read("api-basketball", date),
  ]);
  const observations = results.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );
  const warnings = results.flatMap((result, index) =>
    result.status === "rejected"
      ? [`${index === 0 ? "API-NBA" : "API-Basketball"} unavailable: ${result.reason instanceof Error ? result.reason.message : "request failed"}`]
      : result.value.warnings,
  );
  return {
    retrievedAt,
    observations,
    coverage: observations.length
      ? `${observations.reduce((count, item) => count + item.observations.length, 0)} provider observations retrieved for ${date}.`
      : `No provider observations retrieved for ${date}.`,
    warnings,
  };
}

export function formatPreparationForPrompt(preparation: DailyResearchPreparation): string {
  const lines = [
    `Provider preparation retrievedAt=${preparation.retrievedAt}`,
    `Provider coverage: ${preparation.coverage}`,
  ];
  for (const snapshot of preparation.observations) {
    lines.push(
      `${snapshot.provider} · ${snapshot.cached ? "cached" : "fresh"} · retrieved ${snapshot.retrievedAt} · observations=${snapshot.observations.length}`,
    );
    for (const observation of snapshot.observations.slice(0, 100)) {
      lines.push(JSON.stringify({
        provider: observation.provider,
        eventId: observation.eventId,
        event: observation.eventName,
        sport: observation.sport,
        league: observation.league,
        startsAt: observation.startsAt,
        final: observation.final,
        player: observation.playerName,
        statistics: observation.statistics,
        scores: [observation.homeScore, observation.awayScore],
        source: observation.source,
        retrievedAt: observation.retrievedAt,
      }));
    }
  }
  for (const warning of preparation.warnings) lines.push(`WARNING: ${warning}`);
  return lines.join("\n");
}
