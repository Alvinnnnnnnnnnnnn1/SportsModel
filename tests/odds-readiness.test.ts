import { afterEach, describe, expect, it, vi } from "vitest";
import {
  normalizeTheOddsApiResponse, quoteIdentity, readOddsQuota,
  TheOddsApiReadinessAdapter, THE_ODDS_API_ORIGIN,
  type ManualOddsRequest,
} from "@/lib/providers/the-odds-api";

const now = "2026-11-04T00:00:00.000Z";
const request: ManualOddsRequest = { sport: "NBA", providerSportKey: "basketball_nba", markets: ["h2h"] };
function fixture() {
  return [{ id: "synthetic_event_001", sport_key: "basketball_nba", commence_time: "2026-11-05T01:00:00Z", home_team: "SYNTHETIC Home", away_team: "SYNTHETIC Away", bookmakers: [{ key: "sportsbet", title: "SYNTHETIC bookmaker title", last_update: "2026-11-03T23:59:00Z", markets: [{ key: "h2h", last_update: "2026-11-03T23:59:30Z", outcomes: [{ name: "SYNTHETIC Home", price: 1.95 }, { name: "SYNTHETIC Away", price: 2.05 }] }] }] }];
}
function response(value: unknown = fixture(), remaining = "499") {
  return new Response(JSON.stringify(value), { status: 200, headers: { "content-type": "application/json", "x-requests-remaining": remaining, "x-requests-used": "1", "x-requests-last": "1" } });
}
function setup(fetcher = vi.fn(async () => response())) {
  let time = Date.parse(now);
  const adapter = new TheOddsApiReadinessAdapter("private", { apiKey: "synthetic-test-key-never-real", enableManualRequests: true, freePlanConfirmed: true }, fetcher, () => time);
  return { adapter, fetcher, advance: (milliseconds = 60001) => { time += milliseconds; } };
}
afterEach(() => vi.unstubAllGlobals());

describe("The Odds API zero-cost readiness boundaries", () => {
  it("does not make network requests when unconfigured and keeps demo fallback synthetic", async () => {
    const fetcher = vi.fn(); const demo = new TheOddsApiReadinessAdapter("demo", {}, fetcher);
    const markets = await demo.getMarkets(["NBA", "NBL", "ATP", "WTA"]);
    expect(markets.length).toBeGreaterThan(0); expect(markets.every(market => market.simulated)).toBe(true);
    expect(demo.readiness()).toMatchObject({ configured: false, manualRequestsEnabled: false, syntheticFallback: true });
    await expect(demo.requestOnce(request, { confirmExternalRead: true })).rejects.toMatchObject({ code: "DISABLED" }); expect(fetcher).not.toHaveBeenCalled();
  });
  it("never falls back to synthetic odds in the private workspace or generically calls live odds", async () => {
    const { adapter, fetcher } = setup(); expect(await adapter.getMarkets(["NBA"])).toEqual([]); expect(fetcher).not.toHaveBeenCalled();
    expect(adapter.readiness().syntheticFallback).toBe(false);
  });
  it.each([
    { apiKey: "synthetic" },
    { apiKey: "synthetic", enableManualRequests: true },
    { apiKey: "synthetic", freePlanConfirmed: true },
    { enableManualRequests: true, freePlanConfirmed: true },
  ])("requires a key, enablement and free-plan confirmation independently", async configuration => {
    const fetcher = vi.fn(); const adapter = new TheOddsApiReadinessAdapter("private", configuration, fetcher);
    await expect(adapter.requestOnce(request, { confirmExternalRead: true })).rejects.toMatchObject({ code: "DISABLED" }); expect(fetcher).not.toHaveBeenCalled();
  });
  it("requires explicit per-call confirmation and rejects browser execution", async () => {
    const { adapter, fetcher } = setup();
    await expect(adapter.requestOnce(request, { confirmExternalRead: false })).rejects.toMatchObject({ code: "MANUAL_CONFIRMATION_REQUIRED" });
    vi.stubGlobal("window", {});
    await expect(adapter.requestOnce(request, { confirmExternalRead: true })).rejects.toMatchObject({ code: "SERVER_ONLY" }); expect(fetcher).not.toHaveBeenCalled();
  });
  it("uses only the correct fixed host, bounded featured endpoint and secret-free provenance", async () => {
    const { adapter, fetcher } = setup();
    const result = await adapter.requestOnce({ ...request, eventIds: ["synthetic_event_001"] }, { confirmExternalRead: true });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [rawUrl, options] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    const url = new URL(rawUrl); expect(url.origin).toBe(THE_ODDS_API_ORIGIN); expect(url.pathname).toBe("/v4/sports/basketball_nba/odds");
    expect(url.searchParams.get("regions")).toBe("au"); expect(url.searchParams.get("bookmakers")).toBe("sportsbet"); expect(url.searchParams.get("markets")).toBe("h2h");
    expect(url.searchParams.get("oddsFormat")).toBe("decimal"); expect(url.searchParams.get("dateFormat")).toBe("iso"); expect(url.searchParams.get("eventIds")).toBe("synthetic_event_001");
    expect(options).toMatchObject({ method: "GET", cache: "no-store", redirect: "error" }); expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(result.sourceUrl).not.toContain("apiKey"); expect(JSON.stringify(result)).not.toContain("synthetic-test-key"); expect(JSON.stringify(adapter.readiness())).not.toContain("synthetic-test-key");
    expect(result.quotes[0]).toMatchObject({ simulated: false, timestampSource: "market", oddsTimestamp: "2026-11-03T23:59:30.000Z", freshness: "fresh", ageSeconds: 30 });
  });
  it("has a process-local one-minute cooldown and no automatic retries", async () => {
    const { adapter, fetcher, advance } = setup(); await adapter.requestOnce(request, { confirmExternalRead: true });
    await expect(adapter.requestOnce(request, { confirmExternalRead: true })).rejects.toMatchObject({ code: "COOLDOWN" }); expect(fetcher).toHaveBeenCalledTimes(1);
    advance(); await adapter.requestOnce(request, { confirmExternalRead: true }); expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("blocks concurrent calls before either can consume additional quota", async () => {
    let release!: (response: Response) => void;
    const fetcher = vi.fn(() => new Promise<Response>(resolve => { release = resolve; })); const { adapter } = setup(fetcher);
    const first = adapter.requestOnce(request, { confirmExternalRead: true });
    await expect(adapter.requestOnce(request, { confirmExternalRead: true })).rejects.toMatchObject({ code: "COOLDOWN" }); release(response()); await first;
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("stops before crossing the configurable free-credit reserve", async () => {
    const { adapter, fetcher, advance } = setup(vi.fn(async () => response(fixture(), "10")));
    await adapter.requestOnce(request, { confirmExternalRead: true }); advance();
    await expect(adapter.requestOnce(request, { confirmExternalRead: true })).rejects.toMatchObject({ code: "QUOTA_RESERVED" }); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("does not infer a fresh quota if headers are missing or malformed", async () => {
    const { adapter, fetcher, advance } = setup(vi.fn(async () => new Response(JSON.stringify(fixture()))));
    const first = await adapter.requestOnce(request, { confirmExternalRead: true }); expect(first.quota.remaining).toBeNull(); advance();
    await expect(adapter.requestOnce(request, { confirmExternalRead: true })).rejects.toMatchObject({ code: "QUOTA_UNKNOWN" }); expect(fetcher).toHaveBeenCalledTimes(1);
    expect(readOddsQuota(new Headers({ "x-requests-remaining": "-1", "x-requests-used": "1.5", "x-requests-last": "9007199254740999" }), now)).toEqual({ remaining: null, used: null, lastCost: null, observedAt: now });
  });
  it("retains valid quota header counts including zero", () => {
    expect(readOddsQuota(new Headers({ "x-requests-remaining": "0", "x-requests-used": "500", "x-requests-last": "3" }), now)).toEqual({ remaining: 0, used: 500, lastCost: 3, observedAt: now });
  });
  it("handles rate limiting once without a retry or echoed provider secrets", async () => {
    const fetcher = vi.fn(async () => new Response("provider error might echo sensitive request data", { status: 429, headers: { "retry-after": "120", "x-requests-remaining": "400" } }));
    const { adapter, advance } = setup(fetcher);
    await expect(adapter.requestOnce(request, { confirmExternalRead: true })).rejects.toMatchObject({ code: "RATE_LIMITED" }); advance();
    await expect(adapter.requestOnce(request, { confirmExternalRead: true })).rejects.toMatchObject({ code: "COOLDOWN" }); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("redacts rejected/network responses and blocks blind retry after unknown usage", async () => {
    const { adapter, fetcher, advance } = setup(vi.fn(async () => { throw new Error("synthetic-test-key-never-real in a mocked URL"); }));
    await expect(adapter.requestOnce(request, { confirmExternalRead: true })).rejects.toMatchObject({ code: "NETWORK_FAILURE" }); advance();
    await expect(adapter.requestOnce(request, { confirmExternalRead: true })).rejects.toMatchObject({ code: "QUOTA_UNKNOWN" }); expect(fetcher).toHaveBeenCalledTimes(1);
    const rejected = setup(vi.fn(async () => new Response("synthetic-test-key-never-real", { status: 401 })));
    await expect(rejected.adapter.requestOnce(request, { confirmExternalRead: true })).rejects.toThrow("provider rejected");
  });
  it("rejects malformed/oversized responses without returning partial quotes", async () => {
    for (const value of [new Response("not JSON"), new Response("[]", { headers: { "content-length": String(2 * 1024 * 1024 + 1) } }), new Response(" ".repeat(2 * 1024 * 1024 + 1))]) {
      const { adapter } = setup(vi.fn(async () => value)); await expect(adapter.requestOnce(request, { confirmExternalRead: true })).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    }
  });
  it.each([{ creditReserve: -1 }, { creditReserve: Number.NaN }, { creditReserve: 501 }, { maxAgeSeconds: 0 }, { maxAgeSeconds: Number.NaN }])("rejects invalid numeric configuration", configuration => {
    expect(() => new TheOddsApiReadinessAdapter("private", configuration)).toThrow("configuration");
  });
});

describe("market identity and timestamp provenance", () => {
  it("requires actual tournament keys for ATP/WTA and supports documented NBA/NBL keys", () => {
    const nbl = fixture(); nbl[0].sport_key = "basketball_nbl";
    expect(normalizeTheOddsApiResponse(nbl, { ...request, sport: "NBL", providerSportKey: "basketball_nbl" }, { now }).quotes[0].sport).toBe("NBL");
    for (const [sport, key] of [["ATP", "tennis_atp_example_singles"], ["WTA", "tennis_wta_example_singles"]] as const) {
      const tennis = fixture(); tennis[0].sport_key = key;
      expect(normalizeTheOddsApiResponse(tennis, { ...request, sport, providerSportKey: key }, { now }).quotes[0].sport).toBe(sport);
    }
    expect(() => normalizeTheOddsApiResponse([], { ...request, sport: "ATP", providerSportKey: "atp" }, { now })).toThrow("identity");
  });
  it.each([
    { ...request, sport: "NBA", providerSportKey: "basketball_nbl" },
    { ...request, providerSportKey: "https://theoddsapi.com/" },
    { ...request, markets: ["player_points"] },
    { ...request, markets: ["h2h", "h2h"] },
    { ...request, eventIds: ["same", "same"] },
  ])("rejects mismatched and unsupported request identities", invalid => {
    expect(() => normalizeTheOddsApiResponse([], invalid as ManualOddsRequest, { now })).toThrow();
  });
  it("uses exact event/sport/bookmaker identities rather than fuzzy selection names", () => {
    const cases = [() => { const value = fixture(); value[0].sport_key = "basketball_nbl"; return value; }, () => { const value = fixture(); value[0].bookmakers[0].key = "unknown_bookmaker"; return value; }, () => { const value = fixture(); value[0].bookmakers[0].markets[0].outcomes[0].name = "Invented participant"; return value; }];
    for (const build of cases) expect(() => normalizeTheOddsApiResponse(build(), request, { now })).toThrow();
    expect(() => normalizeTheOddsApiResponse(fixture(), { ...request, eventIds: ["different_event"] }, { now })).toThrow("identity");
  });
  it("rejects duplicate event, market and exact selection identities", () => {
    const event = fixture(); event.push(structuredClone(event[0])); expect(() => normalizeTheOddsApiResponse(event, request, { now })).toThrow("identity");
    const market = fixture(); market[0].bookmakers[0].markets.push(structuredClone(market[0].bookmakers[0].markets[0])); expect(() => normalizeTheOddsApiResponse(market, request, { now })).toThrow("identity");
    const selection = fixture(); selection[0].bookmakers[0].markets[0].outcomes.push(structuredClone(selection[0].bookmakers[0].markets[0].outcomes[0])); expect(() => normalizeTheOddsApiResponse(selection, request, { now })).toThrow("identities");
  });
  it("validates decimal odds and exact thresholds without inventing missing lines", () => {
    for (const odds of [1, -2, Number.NaN, Number.POSITIVE_INFINITY, 1.23456]) { const value = fixture(); value[0].bookmakers[0].markets[0].outcomes[0].price = odds; expect(() => normalizeTheOddsApiResponse(value, request, { now })).toThrow(); }
    const totals = fixture(); const market = totals[0].bookmakers[0].markets[0] as { key: string; last_update: string; outcomes: { name: string; price: number; point?: number }[] };
    market.key = "totals"; market.outcomes = [{ name: "Over", price: 1.9, point: 181.5 }, { name: "Under", price: 1.9, point: 181.5 }];
    const result = normalizeTheOddsApiResponse(totals, { ...request, markets: ["totals"] }, { now }); expect(result.quotes[0]).toMatchObject({ line: "181.5", point: 181.5, selection: "Over" });
    delete market.outcomes[0].point; expect(() => normalizeTheOddsApiResponse(totals, { ...request, markets: ["totals"] }, { now })).toThrow("line");
  });
  it("selection identity includes the point but preserves identity when only price changes", () => {
    const source = { providerSportKey: "basketball_nba", eventId: "event", bookmakerKey: "sportsbet", marketKey: "totals" as const, selection: "Over", point: 181.5 };
    expect(quoteIdentity(source)).not.toBe(quoteIdentity({ ...source, point: 182.5 }));
    const first = normalizeTheOddsApiResponse(fixture(), request, { now }).quotes[0]; const second = fixture(); second[0].bookmakers[0].markets[0].outcomes[0].price = 2;
    expect(first.identity).toBe(normalizeTheOddsApiResponse(second, request, { now }).quotes[0].identity);
  });
  it("keeps missing times null and marks legacy bookmaker timestamps separately", () => {
    const legacy = fixture() as unknown as Record<string, unknown>[];
    const book = (legacy[0].bookmakers as Record<string, unknown>[])[0]; const market = (book.markets as Record<string, unknown>[])[0]; delete market.last_update;
    let quote = normalizeTheOddsApiResponse(legacy, request, { now }).quotes[0]; expect(quote).toMatchObject({ timestampSource: "bookmaker_legacy", marketTimestamp: null, oddsTimestamp: "2026-11-03T23:59:00.000Z", usableWithoutFreshnessReview: false });
    delete book.last_update; quote = normalizeTheOddsApiResponse(legacy, request, { now }).quotes[0]; expect(quote).toMatchObject({ oddsTimestamp: null, ageSeconds: null, freshness: "unknown", timestampSource: "missing" }); expect(quote.oddsTimestamp).not.toBe(quote.retrievedAt);
  });
  it("preserves explicit provider null timestamps as unknown", () => {
    const value = fixture() as unknown as Record<string, unknown>[];
    const book = (value[0].bookmakers as Record<string, unknown>[])[0]; book.last_update = null;
    (book.markets as Record<string, unknown>[])[0].last_update = null;
    expect(normalizeTheOddsApiResponse(value, request, { now }).quotes[0]).toMatchObject({ oddsTimestamp: null, marketTimestamp: null, legacyBookmakerTimestamp: null, timestampSource: "missing", freshness: "unknown" });
  });
  it("flags stale and future provider timestamps and rejects timestamps without UTC offsets", () => {
    const value = fixture(); value[0].bookmakers[0].markets[0].last_update = "2026-11-03T22:00:00Z";
    expect(normalizeTheOddsApiResponse(value, request, { now }).quotes[0]).toMatchObject({ freshness: "stale", usableWithoutFreshnessReview: false });
    value[0].bookmakers[0].markets[0].last_update = "2026-11-04T01:00:00Z";
    expect(normalizeTheOddsApiResponse(value, request, { now }).quotes[0].freshness).toBe("future");
    value[0].bookmakers[0].markets[0].last_update = "2026-11-04T01:00:00";
    expect(() => normalizeTheOddsApiResponse(value, request, { now })).toThrow("timestamp");
  });
  it("does not invent absent events or claim Sportsbet player-prop availability", () => {
    const result = normalizeTheOddsApiResponse([], request, { now }); expect(result.quotes).toEqual([]); expect(result.warnings.join(" ")).toContain("No bookmaker or player-prop coverage is inferred");
  });
});
