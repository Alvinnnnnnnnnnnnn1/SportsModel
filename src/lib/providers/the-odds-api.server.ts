// Next's server-only boundary prevents accidental API-key configuration imports in browser components.
import "server-only";
import { TheOddsApiReadinessAdapter, type OddsFetch, type OddsWorkspace } from "./the-odds-api";

/** No key or request is needed to construct this adapter. There is no automatic endpoint or polling job. */
export function createConfiguredTheOddsApiProvider(workspace: OddsWorkspace, options: { transport?: OddsFetch; clock?: () => number } = {}) {
  return new TheOddsApiReadinessAdapter(workspace, {
    apiKey: process.env.THE_ODDS_API_KEY,
    enableManualRequests: process.env.THE_ODDS_API_ENABLE_MANUAL_REQUESTS === "true",
    freePlanConfirmed: process.env.THE_ODDS_API_FREE_PLAN_CONFIRMED === "true",
    creditReserve: process.env.THE_ODDS_API_CREDIT_RESERVE === undefined ? 10 : Number(process.env.THE_ODDS_API_CREDIT_RESERVE),
    maxAgeSeconds: process.env.THE_ODDS_API_MAX_AGE_SECONDS === undefined ? 300 : Number(process.env.THE_ODDS_API_MAX_AGE_SECONDS),
  }, options.transport, options.clock);
}
