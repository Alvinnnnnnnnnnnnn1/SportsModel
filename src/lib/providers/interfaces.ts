import type {
  AppNotification,
  Candidate,
  ResearchRun,
  Sport,
} from "../domain/types";

export interface OddsMarket {
  sport: Sport;
  event: string;
  participant: string;
  market: string;
  selection: string;
  line: string;
  bookmaker: string;
  odds: number;
  timestamp: string;
  simulated: boolean;
}
export interface SportsStatistic {
  sport: Sport;
  participant: string;
  metric: string;
  value: number;
  source: string;
  timestamp: string;
  simulated: boolean;
}
export interface OddsProvider {
  readonly name: string;
  getMarkets(sports: Sport[]): Promise<OddsMarket[]>;
}
export interface SportsDataProvider {
  readonly name: string;
  getStatistics(sports: Sport[]): Promise<SportsStatistic[]>;
}
export interface ResearchResult {
  candidates: Candidate[];
  notifications: AppNotification[];
  run: ResearchRun;
}
export interface ResearchEngine {
  readonly name: string;
  run(): Promise<ResearchResult>;
}
export interface NotificationProvider {
  readonly name: string;
  create(candidate: Candidate): AppNotification;
  deliver(
    notification: AppNotification,
  ): Promise<{
    delivered: boolean;
    channel: "in-app" | "browser";
    reason?: string;
  }>;
}
/** Narrative context only. This interface deliberately cannot return a probability. */
export interface AIResearchProvider {
  readonly name: string;
  explain(
    candidate: Candidate,
  ): Promise<{ narrative: string; source: string; simulated: boolean }>;
}
