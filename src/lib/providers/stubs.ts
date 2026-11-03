import type { Candidate, Sport } from "../domain/types";
import type {
  AIResearchProvider,
  OddsProvider,
  SportsDataProvider,
} from "./interfaces";

const unavailable = (name: string): never => {
  throw new Error(
    `${name} is not configured. No live request was made. Use the mock provider in demo mode.`,
  );
};
export class TheOddsApiAdapter implements OddsProvider {
  readonly name = "The Odds API (stub)";
  async getMarkets(sports: Sport[]): Promise<never> {
    void sports;
    return unavailable(this.name);
  }
}
export class NBAStatisticsAdapter implements SportsDataProvider {
  readonly name = "NBA statistics (stub)";
  async getStatistics(sports: Sport[]): Promise<never> {
    void sports;
    return unavailable(this.name);
  }
}
export class NBLStatisticsAdapter implements SportsDataProvider {
  readonly name = "NBL statistics (stub)";
  async getStatistics(sports: Sport[]): Promise<never> {
    void sports;
    return unavailable(this.name);
  }
}
export class ATPWTAStatisticsAdapter implements SportsDataProvider {
  readonly name = "ATP/WTA statistics (stub)";
  async getStatistics(sports: Sport[]): Promise<never> {
    void sports;
    return unavailable(this.name);
  }
}
export class OpenAIResearchAdapter implements AIResearchProvider {
  readonly name = "OpenAI research explanation (stub)";
  async explain(candidate: Candidate): Promise<never> {
    void candidate;
    return unavailable(this.name);
  }
}
