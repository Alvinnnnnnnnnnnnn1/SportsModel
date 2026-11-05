import { z } from 'zod';
import type { Sport } from '../domain/types';
export const providers = ['thesportsdb', 'api-nba', 'api-basketball'] as const;
export type SportsProviderId = typeof providers[number];
export type StatName = 'points' | 'rebounds' | 'assists' | 'threes' | 'minutes';
export interface SportsObservation {
  provider: SportsProviderId; eventId: string; playerId: string | null;
  internalEventId: string | null; internalPlayerId: string | null;
  sport: Sport | null; league: string | null; season: string | null;
  eventName: string | null; playerName: string | null; startsAt: string | null;
  eventDate: string | null; final: boolean; retrievedAt: string; observedAt: string | null;
  units: Record<StatName, 'count' | 'minutes'>;
  statistics: Record<StatName, number | null>; homeScore: number | null; awayScore: number | null;
  completeness: 'partial' | 'complete'; verification: 'provider_observation'; source: string;
}
export const sportsRequestSchema = z.object({
  provider: z.enum(providers),
  operation: z.enum(['status', 'arsenal', 'leagues', 'seasons', 'games', 'teams', 'players', 'player_stats', 'team_stats', 'season_team_stats', 'standings', 'event', 'event_stats', 'fixtures', 'past_fixtures']),
  parameters: z.record(z.string(), z.string().trim().min(1).max(100)).default({}),
}).strict();
export type SportsRequest = z.infer<typeof sportsRequestSchema>;
export interface SportsSnapshot {
  provider: SportsProviderId; source: string; retrievedAt: string; cached: boolean;
  observations: SportsObservation[];
  /** Sanitised provider response for explicit identity discovery. Never contains headers or keys. */
  discovery: unknown; warnings: string[];
}
export interface QuotaStatus {
  utcDay: string; used: number; dayBudget: number | null; minuteUsed: number;
  minuteBudget: number; remainingDaily: number | null; remainingMinute: number | null;
  blockedUntil: number; lastSuccess: string | null;
}
