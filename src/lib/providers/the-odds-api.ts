import { z } from "zod";
import type { Sport } from "../domain/types";
import type { OddsMarket, OddsProvider } from "./interfaces";
import { mockOddsProvider } from "./mock";

export const THE_ODDS_API_ORIGIN = "https://api.the-odds-api.com";
export const THE_ODDS_API_DOCUMENTATION = "https://the-odds-api.com/liveapi/guides/v4/";
export type FeaturedMarket = "h2h" | "spreads" | "totals";
export type OddsFetch = (input: string, init?: RequestInit) => Promise<Response>;
export type OddsWorkspace = "demo" | "private";
export interface TheOddsApiConfiguration {
  /** Server-side only; never pass this configuration to a Client Component. */
  apiKey?: string;
  enableManualRequests?: boolean;
  freePlanConfirmed?: boolean;
  creditReserve?: number;
  maxAgeSeconds?: number;
}
export interface OddsQuota {
  remaining: number | null;
  used: number | null;
  lastCost: number | null;
  observedAt: string | null;
}
export interface ManualOddsRequest {
  sport: Sport;
  /** Tennis uses the provider's actual tournament key, not an invented generic ATP/WTA key. */
  providerSportKey: string;
  markets: FeaturedMarket[];
  eventIds?: string[];
}
export interface ProviderQuote {
  identity: string;
  provider: "the-odds-api.com";
  providerSportKey: string;
  eventId: string;
  sport: Sport;
  event: string;
  startsAt: string;
  participant: string;
  bookmakerKey: "sportsbet";
  bookmaker: string;
  marketKey: FeaturedMarket;
  selection: string;
  line: string;
  point: number | null;
  odds: number;
  /** Missing provider source times stay null. Retrieval time is never substituted. */
  oddsTimestamp: string | null;
  marketTimestamp: string | null;
  legacyBookmakerTimestamp: string | null;
  timestampSource: "market" | "bookmaker_legacy" | "missing";
  retrievedAt: string;
  ageSeconds: number | null;
  freshness: "fresh" | "stale" | "future" | "unknown";
  usableWithoutFreshnessReview: boolean;
  simulated: false;
}
export interface OddsReadinessSnapshot {
  provider: "the-odds-api.com";
  mode: "manual-provider-read";
  sourceUrl: string;
  retrievedAt: string;
  quotes: ProviderQuote[];
  quota: OddsQuota;
  warnings: string[];
}
export type OddsReadinessErrorCode =
  | "DISABLED" | "MANUAL_CONFIRMATION_REQUIRED" | "SERVER_ONLY"
  | "INVALID_REQUEST" | "QUOTA_UNKNOWN" | "QUOTA_RESERVED" | "COOLDOWN"
  | "NETWORK_FAILURE" | "RATE_LIMITED" | "PROVIDER_REJECTED" | "INVALID_RESPONSE";
export class OddsReadinessError extends Error {
  constructor(public readonly code: OddsReadinessErrorCode, message: string) {
    super(message); this.name = "OddsReadinessError";
  }
}
const fail = (code: OddsReadinessErrorCode, message: string): never => { throw new OddsReadinessError(code, message); };
const id = z.string().min(1).max(150).regex(/^[a-zA-Z0-9_-]+$/);
const stamp = z.string().datetime({ offset: true });
const text = z.string().trim().min(1).max(500);
const decimalOdds = z.number().finite().gt(1).max(10000).refine(value => Math.abs(value * 10000 - Math.round(value * 10000)) < 0.00001);
const outcomeSchema = z.object({ name: text, description: text.optional(), price: decimalOdds, point: z.number().finite().min(-100000).max(100000).optional() });
const marketSchema = z.object({ key: z.enum(["h2h", "spreads", "totals"]), last_update: stamp.nullish(), outcomes: z.array(outcomeSchema).min(1).max(100) });
const eventSchema = z.object({ id, sport_key: id, commence_time: stamp, home_team: text, away_team: text, bookmakers: z.array(z.object({ key: id, title: text, last_update: stamp.nullish(), markets: z.array(marketSchema).max(3) })).max(20) });
const eventsSchema = z.array(eventSchema).max(1000);
const requestSchema = z.object({ sport: z.enum(["NBA", "NBL", "ATP", "WTA"]), providerSportKey: id, markets: z.array(z.enum(["h2h", "spreads", "totals"])).min(1).max(3), eventIds: z.array(id).min(1).max(10).optional() }).strict();
function validRequest(input: ManualOddsRequest): ManualOddsRequest {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return fail("INVALID_REQUEST", "Choose one supported sport and one to three featured markets with valid provider IDs.");
  const value = parsed.data;
  const sportMatches = value.sport === "NBA" ? value.providerSportKey === "basketball_nba"
    : value.sport === "NBL" ? value.providerSportKey === "basketball_nbl"
      : value.sport === "ATP" ? /^tennis_atp_[a-z0-9_]+$/.test(value.providerSportKey)
        : /^tennis_wta_[a-z0-9_]+$/.test(value.providerSportKey);
  if (!sportMatches || new Set(value.markets).size !== value.markets.length || value.eventIds && new Set(value.eventIds).size !== value.eventIds.length)
    return fail("INVALID_REQUEST", "Sport/provider identity or market/event uniqueness is invalid. Obtain the actual tennis tournament key from the provider catalogue.");
  return value;
}
const headerCount = (headers: Headers, key: string): number | null => {
  const value = headers.get(key);
  if (value === null || !/^\d+$/.test(value)) return null;
  const number = Number(value); return Number.isSafeInteger(number) ? number : null;
};
export function readOddsQuota(headers: Headers, observedAt: string): OddsQuota {
  return { remaining: headerCount(headers, "x-requests-remaining"), used: headerCount(headers, "x-requests-used"), lastCost: headerCount(headers, "x-requests-last"), observedAt };
}
export function quoteIdentity(input: { providerSportKey: string; eventId: string; bookmakerKey: string; marketKey: FeaturedMarket; selection: string; point: number | null }): string {
  // A structured identity includes the exact line; a price change never silently changes the selection identity.
  return JSON.stringify(["the-odds-api.com", input.providerSportKey, input.eventId, input.bookmakerKey, input.marketKey, input.selection, input.point]);
}
export function normalizeTheOddsApiResponse(raw: unknown, requestInput: ManualOddsRequest, options: { now: string; maxAgeSeconds?: number }): { quotes: ProviderQuote[]; warnings: string[] } {
  const request = validRequest(requestInput);
  if (!stamp.safeParse(options.now).success || !Number.isInteger(options.maxAgeSeconds ?? 300) || (options.maxAgeSeconds ?? 300) < 1)
    return fail("INVALID_REQUEST", "A valid retrieval time and freshness threshold are required.");
  const parsed = eventsSchema.safeParse(raw);
  if (!parsed.success) return fail("INVALID_RESPONSE", "Provider response failed market, numerical or timestamp validation. No odds were registered.");
  const now = Date.parse(options.now); const quotes: ProviderQuote[] = []; const warnings = new Set<string>(); const seen = new Set<string>(); const events = new Set<string>();
  for (const event of parsed.data) {
    if (event.sport_key !== request.providerSportKey || event.home_team === event.away_team || events.has(event.id) || request.eventIds && !request.eventIds.includes(event.id))
      return fail("INVALID_RESPONSE", "Provider event identity does not match the requested sport/event.");
    events.add(event.id);
    const books = new Set<string>();
    for (const book of event.bookmakers) {
      if (book.key !== "sportsbet" || books.has(book.key)) return fail("INVALID_RESPONSE", "Provider bookmaker identity does not match the bounded Sportsbet feed request.");
      books.add(book.key); const markets = new Set<string>();
      for (const market of book.markets) {
        if (!request.markets.includes(market.key) || markets.has(market.key)) return fail("INVALID_RESPONSE", "Provider returned an unrequested or duplicate market identity.");
        markets.add(market.key);
        for (const outcome of market.outcomes) {
          const teamOutcome = outcome.name === event.home_team || outcome.name === event.away_team;
          if (outcome.description !== undefined || market.key === "totals" && (!["Over", "Under"].includes(outcome.name) || outcome.point === undefined || outcome.point < 0)
            || market.key !== "totals" && !teamOutcome || market.key === "h2h" && outcome.point !== undefined || market.key === "spreads" && outcome.point === undefined)
            return fail("INVALID_RESPONSE", "Selection, participant or exact line is incompatible with the featured market identity.");
          const point = outcome.point ?? null;
          const identity = quoteIdentity({ providerSportKey: event.sport_key, eventId: event.id, bookmakerKey: book.key, marketKey: market.key, selection: outcome.name, point });
          if (seen.has(identity)) return fail("INVALID_RESPONSE", "Provider returned duplicate exact selection identities; no uncertain record was merged.");
          seen.add(identity);
          const marketTimestamp = market.last_update ? new Date(market.last_update).toISOString() : null;
          const legacyBookmakerTimestamp = book.last_update ? new Date(book.last_update).toISOString() : null;
          const oddsTimestamp = marketTimestamp ?? legacyBookmakerTimestamp;
          const timestampSource = marketTimestamp ? "market" : legacyBookmakerTimestamp ? "bookmaker_legacy" : "missing";
          const ageSeconds = oddsTimestamp === null ? null : Math.floor((now - Date.parse(oddsTimestamp)) / 1000);
          const freshness = ageSeconds === null ? "unknown" : ageSeconds < 0 ? "future" : ageSeconds > (options.maxAgeSeconds ?? 300) ? "stale" : "fresh";
          if (timestampSource !== "market") warnings.add(timestampSource === "missing" ? "Some original odds timestamps are missing; retrieval time was not substituted." : "Deprecated bookmaker-level timestamps were retained separately; market freshness needs manual review.");
          if (freshness !== "fresh") warnings.add("Some odds are stale, future-dated or have unknown freshness; these are not verified available prices.");
          quotes.push({ identity, provider: "the-odds-api.com", providerSportKey: event.sport_key, eventId: event.id, sport: request.sport, event: `${event.home_team} vs ${event.away_team}`, startsAt: new Date(event.commence_time).toISOString(), participant: market.key === "totals" ? `${event.home_team} vs ${event.away_team}` : outcome.name, bookmakerKey: "sportsbet", bookmaker: book.title, marketKey: market.key, selection: outcome.name, line: market.key === "h2h" ? "Moneyline" : String(point), point, odds: outcome.price, oddsTimestamp, marketTimestamp, legacyBookmakerTimestamp, timestampSource, retrievedAt: new Date(options.now).toISOString(), ageSeconds, freshness, usableWithoutFreshnessReview: freshness === "fresh" && timestampSource === "market", simulated: false });
        }
      }
    }
  }
  if (!quotes.length) warnings.add("No matching featured prices were returned. No bookmaker or player-prop coverage is inferred.");
  return { quotes, warnings: [...warnings] };
}
async function boundedJson(response: Response): Promise<unknown> {
  const maximum = 2 * 1024 * 1024;
  const length = response.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > maximum)) return fail("INVALID_RESPONSE", "Provider response exceeds the bounded preview size.");
  if (!response.body) return fail("INVALID_RESPONSE", "Provider response did not contain JSON data.");
  const reader = response.body.getReader(); const decoder = new TextDecoder("utf-8", { fatal: true }); let result = ""; let bytes = 0;
  try {
    while (true) { const next = await reader.read(); if (next.done) break; bytes += next.value.byteLength; if (bytes > maximum) { await reader.cancel(); return fail("INVALID_RESPONSE", "Provider response exceeds the bounded preview size."); } result += decoder.decode(next.value, { stream: true }); }
    result += decoder.decode(); return JSON.parse(result);
  } catch (reason) { if (reason instanceof OddsReadinessError) throw reason; return fail("INVALID_RESPONSE", "Provider response is not valid UTF-8 JSON."); }
  finally { reader.releaseLock(); }
}
/** Readiness adapter only. No UI, timer, constructor or getMarkets call can initiate a live read. */
export class TheOddsApiReadinessAdapter implements OddsProvider {
  readonly name = "The Odds API readiness (manual, disabled by default)";
  private readonly config: Required<TheOddsApiConfiguration>;
  private quota: OddsQuota = { remaining: null, used: null, lastCost: null, observedAt: null };
  private attempted = false; private nextAllowedAt = 0; private inFlight = false;
  constructor(private readonly workspace: OddsWorkspace, configuration: TheOddsApiConfiguration = {}, private readonly transport: OddsFetch = fetch, private readonly clock: () => number = Date.now) {
    this.config = { apiKey: configuration.apiKey?.trim() ?? "", enableManualRequests: configuration.enableManualRequests ?? false, freePlanConfirmed: configuration.freePlanConfirmed ?? false, creditReserve: configuration.creditReserve ?? 10, maxAgeSeconds: configuration.maxAgeSeconds ?? 300 };
    if (!Number.isSafeInteger(this.config.creditReserve) || this.config.creditReserve < 0 || this.config.creditReserve > 500 || !Number.isSafeInteger(this.config.maxAgeSeconds) || this.config.maxAgeSeconds < 1 || this.config.maxAgeSeconds > 86400)
      fail("INVALID_REQUEST", "Invalid quota reserve or freshness configuration.");
  }
  readiness() {
    return { provider: "the-odds-api.com" as const, configured: Boolean(this.config.apiKey), manualRequestsEnabled: this.workspace === "private" && this.config.enableManualRequests && this.config.freePlanConfirmed && Boolean(this.config.apiKey), workspace: this.workspace, quota: structuredClone(this.quota), nextAllowedAt: this.nextAllowedAt ? new Date(this.nextAllowedAt).toISOString() : null, syntheticFallback: this.workspace === "demo", reason: "No automatic requests or polling. The existing research handoff does not require an API key." };
  }
  async getMarkets(sports: Sport[]): Promise<OddsMarket[]> {
    // Never let the generic ResearchEngine boundary unexpectedly consume quota.
    return this.workspace === "demo" ? mockOddsProvider.getMarkets(sports) : [];
  }
  async requestOnce(requestInput: ManualOddsRequest, confirmation: { confirmExternalRead: boolean }): Promise<OddsReadinessSnapshot> {
    const request = validRequest(requestInput);
    if (typeof window !== "undefined") return fail("SERVER_ONLY", "Optional provider requests must run on the server; never expose its API key in browser code.");
    if (this.workspace !== "private" || !this.config.apiKey || !this.config.enableManualRequests || !this.config.freePlanConfirmed)
      return fail("DISABLED", "Optional provider reads are disabled. The free manual research handoff remains available; no request was made.");
    if (!confirmation.confirmExternalRead) return fail("MANUAL_CONFIRMATION_REQUIRED", "An explicit one-shot external-read confirmation is required; no request was made.");
    const now = this.clock(); const estimatedCost = request.markets.length;
    if (this.inFlight || now < this.nextAllowedAt) return fail("COOLDOWN", "An odds read is already running or the one-minute manual cooldown has not elapsed. No retry was sent.");
    if (this.quota.remaining === null && this.attempted) return fail("QUOTA_UNKNOWN", "Provider quota is unknown after the previous attempt. Review account usage before another request; no automatic retry was sent.");
    if (this.quota.remaining !== null && this.quota.remaining - estimatedCost < this.config.creditReserve) return fail("QUOTA_RESERVED", "This read would cross the configured free-credit reserve. No request was made.");
    const url = new URL(`/v4/sports/${request.providerSportKey}/odds`, THE_ODDS_API_ORIGIN);
    url.searchParams.set("regions", "au"); url.searchParams.set("bookmakers", "sportsbet"); url.searchParams.set("markets", request.markets.join(",")); url.searchParams.set("oddsFormat", "decimal"); url.searchParams.set("dateFormat", "iso");
    if (request.eventIds) url.searchParams.set("eventIds", request.eventIds.join(","));
    const sourceUrl = url.toString(); url.searchParams.set("apiKey", this.config.apiKey);
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 5000);
    this.inFlight = true; this.attempted = true; this.nextAllowedAt = now + 60000;
    // Reserve the bounded worst-case cost before sending, so a failed response cannot reuse a stale quota balance.
    if (this.quota.remaining !== null) this.quota = { ...this.quota, remaining: Math.max(0, this.quota.remaining - estimatedCost) };
    try {
      let response: Response;
      try { response = await this.transport(url.toString(), { method: "GET", headers: { Accept: "application/json" }, cache: "no-store", redirect: "error", signal: controller.signal }); }
      catch { return fail("NETWORK_FAILURE", "The optional provider read failed or timed out. No automatic retry occurred; API keys and request URLs are not included in errors."); }
      const observedAt = new Date(this.clock()).toISOString(); this.quota = readOddsQuota(response.headers, observedAt);
      if (response.status === 429) {
        const retryAfter = response.headers.get("retry-after");
        if (retryAfter && /^\d+$/.test(retryAfter)) this.nextAllowedAt = Math.max(this.nextAllowedAt, this.clock() + Math.min(Number(retryAfter), 86400) * 1000);
        return fail("RATE_LIMITED", "The provider rate limit was reached. Wait and review quota; no automatic retry occurred.");
      }
      if (!response.ok) return fail("PROVIDER_REJECTED", "The provider rejected the request. Check the free account configuration and coverage privately; no raw provider error or API key is displayed.");
      const raw = await boundedJson(response); const normalized = normalizeTheOddsApiResponse(raw, request, { now: observedAt, maxAgeSeconds: this.config.maxAgeSeconds });
      return { provider: "the-odds-api.com", mode: "manual-provider-read", sourceUrl, retrievedAt: observedAt, ...normalized, quota: structuredClone(this.quota) };
    } finally { clearTimeout(timeout); this.inFlight = false; }
  }
}
