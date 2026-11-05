import { describe, expect, it } from 'vitest';
import { HybridSportsAdapter, normaliseGames, normalisePlayerStatistics, numberOrNull, preferredSportsProvider, sportsRequestUrl } from '@/lib/sports/adapters';
import { SportsTransport, type BudgetState } from '@/lib/sports/transport';
import { gradePlayerLeg, proposeProviderSettlement, combinedResearchAssessment } from '@/lib/sports/grading';
import type { SportsProviderId, SportsRequest } from '@/lib/sports/types';
import { settlementObservationSchema, type SettlementTarget } from '@/lib/results';
const time = '2026-11-05T12:00:00Z';
const games = { response: [{ id: 100, league: 'standard', season: 2026, date: { start: '2026-11-05T01:00:00Z' }, status: { short: 3 }, teams: { home: { id: 1, name: 'SYNTHETIC Home' }, visitors: { id: 2, name: 'SYNTHETIC Away' } }, scores: { home: { points: 105 }, visitors: { points: 95 } } }] };
const stats = { response: [{ game: { id: 100 }, player: { id: 20, firstname: 'SYNTHETIC', lastname: 'Player' }, points: 25, totReb: 8, assists: 6, tpm: 3, min: '32:30' }] };
const fixture = () => {
  const game = normaliseGames('api-nba', games, time, 'https://v2.nba.api-sports.io/games?id=100');
  return normalisePlayerStatistics('api-nba', stats, game, time, 'https://v2.nba.api-sports.io/players/statistics?game=100')[0];
};
function leg(id = crypto.randomUUID()) { return { legId: id, sport: 'NBA' as const, event: 'SYNTHETIC Home vs SYNTHETIC Away', participant: 'SYNTHETIC Player', market: 'Player points', selection: 'Over 20.5 points', line: '20.5', odds: 1.9 }; }
function target(): SettlementTarget { return { key: 'paper:test', kind: 'paper', recordId: crypto.randomUUID(), identityHash: 'a'.repeat(64), eligible: true, exclusionReason: null, settled: false, currentOutcome: 'pending', sport: 'NBA', event: 'SYNTHETIC Home vs SYNTHETIC Away', eventDate: '2026-11-05', startsAt: '2026-11-05T01:00:00Z', participant: null, market: null, selection: null, line: null, legs: [leg()], odds: 1.9, originalOdds: 1.9, acceptedOdds: null, stakeCents: 500, stakeType: 'cash', probability: null, probabilityProvenance: null, sourceReference: null, researchDay: 6, sessionId: null, registeredAt: '2026-11-04T12:00:00Z', previousEvidence: [] }; }
function transport(provider: SportsProviderId, responses: Response[] = [Response.json({ response: [] })], options: { dayBudget?: number } = {}) {
  let clock = Date.parse(time); const calls: { at: number; url: string; init?: RequestInit }[] = [], stored = new Map<SportsProviderId, BudgetState>();
  const service = new SportsTransport(provider, { ...options, now: () => clock, sleep: async ms => { clock += ms; }, fetcher: (async (url, init) => { calls.push({ at: clock, url: String(url), init }); return responses.shift() ?? Response.json({ response: [] }); }) as typeof fetch, store: { read: id => stored.get(id) ?? null, write: (id, state) => stored.set(id, structuredClone(state)) } });
  return { service, calls, stored, advance: (ms: number) => { clock += ms; } };
}
describe('bounded read-only sports transport', () => {
  it('deduplicates in-flight requests, clones observations and caches without spending another credit', async () => {
    const { service, calls } = transport('api-nba');
    const [a, b] = await Promise.all([service.request('https://test.invalid/games', {}, 10000), service.request('https://test.invalid/games', {}, 10000)]);
    expect(calls).toHaveLength(1); expect(a.value).toEqual(b.value); expect(a.value).not.toBe(b.value);
    expect((await service.request('https://test.invalid/games', {}, 10000)).cached).toBe(true); expect(service.status().used).toBe(1);
  });
  it('serializes calls with three-second spacing and a rolling twenty per minute cap', async () => {
    const { service, calls } = transport('thesportsdb');
    await Promise.all(Array.from({ length: 22 }, (_, n) => service.request(`https://test.invalid/${n}`, {}, 0)));
    expect(calls).toHaveLength(22); for (let n = 1; n < calls.length; n++) expect(calls[n].at - calls[n - 1].at).toBeGreaterThanOrEqual(3000);
    for (const call of calls) expect(calls.filter(c => c.at <= call.at && c.at > call.at - 60000).length).toBeLessThanOrEqual(20);
  });
  it('persists daily reservations before fetch, honours quota headers and resets at UTC midnight', async () => {
    const { service, stored, advance, calls } = transport('api-nba', [Response.json({ response: [] }, { headers: { 'x-ratelimit-requests-remaining': '0', 'x-ratelimit-remaining': '4' } })]);
    await service.request('https://test.invalid/one', {}, 0); expect(stored.get('api-nba')).toMatchObject({ used: 1, remainingDaily: 0 });
    await expect(service.request('https://test.invalid/two', {}, 0)).rejects.toThrow('budget exhausted'); expect(calls).toHaveLength(1);
    advance(86400000); await service.request('https://test.invalid/next', {}, 0); expect(service.status().used).toBe(1);
  });
  it('keeps per-API budgets separate and refuses configurable budgets above the free reserve', async () => {
    const nba = transport('api-nba', [], { dayBudget: 1 }), basketball = transport('api-basketball');
    await nba.service.request('https://test.invalid/a', {}, 0); await expect(nba.service.request('https://test.invalid/b', {}, 0)).rejects.toThrow('budget exhausted');
    await basketball.service.request('https://test.invalid/b', {}, 0); expect(basketball.service.status().used).toBe(1);
    expect(new SportsTransport('api-nba', { dayBudget: 1000, minuteBudget: 100 }).status()).toMatchObject({ dayBudget: 70, minuteBudget: 6 });
  });
  it('respects Retry-After, retries once, and never retries subscription or server errors', async () => {
    const limited = transport('thesportsdb', [new Response('', { status: 429, headers: { 'retry-after': '5' } }), Response.json({ teams: [] })]);
    await limited.service.request('https://test.invalid/a', {}, 0); expect(limited.calls[1].at - limited.calls[0].at).toBeGreaterThanOrEqual(5000); expect(limited.service.status().used).toBe(2);
    const denied = transport('api-nba', [Response.json({ errors: { plan: 'not included' } })]);
    await expect(denied.service.request('https://test.invalid/a', {}, 0)).rejects.toThrow('subscription'); expect(denied.calls).toHaveLength(1);
    await expect(denied.service.request('https://test.invalid/a', {}, 0)).rejects.toThrow('cooldown');
  });
  it('supports cancellation, short negative caching and finite outbound timeout signals', async () => {
    const { service, calls } = transport('api-nba'); const controller = new AbortController(); controller.abort();
    await expect(service.request('https://test.invalid/a', {}, 0, controller.signal)).rejects.toThrow('cancelled'); expect(calls).toHaveLength(0);
    await service.request('https://test.invalid/b', {}, 0); expect(calls[0].init?.signal).toBeInstanceOf(AbortSignal); expect(calls[0].init?.redirect).toBe('error');
  });
});
describe('provider identities and nullable observations', () => {
  it('uses only exact allowlisted endpoints and no URLs, API keys or premium v2 calls', () => {
    expect(sportsRequestUrl({ provider: 'thesportsdb', operation: 'arsenal', parameters: {} })).toContain('/123/searchteams.php?t=Arsenal');
    for (const parameters of ([{ api_key: 'secret' }, { id: 'https://evil.invalid' }, { token: 'private' }] as Record<string, string>[])) expect(() => sportsRequestUrl({ provider: 'api-nba', operation: 'games', parameters } as SportsRequest)).toThrow();
    expect(() => sportsRequestUrl({ provider: 'thesportsdb', operation: 'player_stats', parameters: {} })).toThrow('Unsupported');
    expect(() => sportsRequestUrl({ provider: 'api-basketball', operation: 'player_stats', parameters: {} })).toThrow('game ID');
  });
  it('preserves zero as zero, missing values as null, and refuses fuzzy cross-provider joins', () => {
    expect([numberOrNull(null), numberOrNull(''), numberOrNull(false), numberOrNull('NaN')]).toEqual([null, null, null, null]); expect(numberOrNull(0)).toBe(0);
    const row = fixture(); expect(row.statistics).toEqual({ points: 25, rebounds: 8, assists: 6, threes: 3, minutes: 32.5 }); expect(row.observedAt).toBeNull(); expect(row.internalEventId).toBeNull();
    expect(normalisePlayerStatistics('api-basketball', stats, normaliseGames('api-nba', games, time, 'https://example.invalid'), time, 'https://example.invalid')).toEqual([]);
  });
  it('never infers final status from a score and keeps missing NBL statistics partial', () => {
    const copy = structuredClone(games); copy.response[0].status.short = 2; expect(normaliseGames('api-nba', copy, time, 'https://example.invalid')[0].final).toBe(false);
    const nblGames = normaliseGames('api-basketball', { response: [{ id: 8, date: '2026-11-05T01:00:00Z', status: { short: 'FT' }, league: { name: 'NBL', season: '2026-2027' }, country: { name: 'Australia' }, teams: { home: { name: 'SYNTHETIC Home' }, away: { name: 'SYNTHETIC Away' } } }] }, time, 'https://example.invalid');
    const rows = normalisePlayerStatistics('api-basketball', { response: [{ game: { id: 8 }, player: { id: 10, name: 'SYNTHETIC Player' }, points: 20, rebounds: { total: 5 }, assists: null, threepoint_goals: { total: null }, minutes: '30:01' }] }, nblGames, time, 'https://example.invalid');
    expect(rows[0].sport).toBe('NBL'); expect(rows[0].statistics.assists).toBeNull(); expect(rows[0].statistics.threes).toBeNull(); expect(rows[0].completeness).toBe('partial');
  });
  it('requires verified selection policy and server credentials for API-Sports', async () => {
    expect(preferredSportsProvider('NBA', {})).toBeNull(); expect(preferredSportsProvider('NBA', { 'api-nba': true })).toBe('api-nba'); expect(preferredSportsProvider('ATP', { thesportsdb: true })).toBeNull();
    const { service, calls } = transport('api-nba'); await expect(new HybridSportsAdapter('api-nba', service).inspect({ provider: 'api-nba', operation: 'status', parameters: {} })).rejects.toThrow('not configured'); expect(calls).toEqual([]);
  });
  it('fetches game-level stats once for multiple players, with key in headers only', async () => {
    const { service, calls } = transport('api-nba', [Response.json(games), Response.json(stats)]); const adapter = new HybridSportsAdapter('api-nba', service, 'SYNTHETIC-private-test-key');
    await adapter.inspect({ provider: 'api-nba', operation: 'games', parameters: { id: '100' } });
    const request: SportsRequest = { provider: 'api-nba', operation: 'player_stats', parameters: { game: '100' } };
    const [a, b] = await Promise.all([adapter.inspect(request), adapter.inspect(request)]); expect(a.observations).toHaveLength(1); expect(b.observations).toHaveLength(1); expect(calls).toHaveLength(2);
    expect(calls[1].url).not.toContain('SYNTHETIC-private-test-key'); expect(calls[1].init?.headers).toEqual({ 'x-apisports-key': 'SYNTHETIC-private-test-key' });
  });
});
describe('conservative supported player-stat grading', () => {
  it.each([['Player points', 'Over 20.5 points', '20.5', 25], ['Player rebounds', '8+ rebounds', '8', 8], ['Player assists', 'Under 6.5 assists', '6.5', 6], ['Player threes', '3+ threes', '3', 3], ['PRA', 'Over 38.5 PRA', '38.5', 39], ['Points + assists', 'Over 30.5', '30.5', 31], ['Points + rebounds', 'Over 32.5', '32.5', 33], ['Rebounds + assists', 'Over 13.5', '13.5', 14]])('grades %s only from complete final observations', (market, selection, line, value) => {
    expect(gradePlayerLeg({ ...leg(), market: String(market), selection: String(selection), line: String(line) }, fixture())).toMatchObject({ outcome: 'won', value });
  });
  it('leaves unsupported, missing, DNP, live and push cases unresolved', () => {
    const row = fixture();
    expect(gradePlayerLeg({ ...leg(), market: 'First quarter points' }, row).outcome).toBeNull();
    expect(gradePlayerLeg(leg(), { ...row, statistics: { ...row.statistics, points: null } }).outcome).toBeNull();
    expect(gradePlayerLeg(leg(), { ...row, final: false }).outcome).toBeNull();
    expect(gradePlayerLeg(leg(), { ...row, statistics: { ...row.statistics, minutes: 0 } }).outcome).toBeNull();
    expect(gradePlayerLeg({ ...leg(), selection: 'Over 25 points', line: '25' }, row).outcome).toBeNull();
    expect(gradePlayerLeg({ ...leg(), selection: 'Over 20.5', line: '19.5' }, row).outcome).toBeNull();
  });
  it('prepares a two-leg SGM observation without inventing payout, joint probability or settlement terms', () => {
    const t = target(); t.kind = 'actual'; t.legs.push({ ...leg(), market: 'Player rebounds', selection: '8+ rebounds', line: '8' });
    const bindings = t.legs.map(l => ({ legId: l.legId, provider: 'api-nba' as const, eventId: '100', playerId: '20' }));
    const result = proposeProviderSettlement(t, [fixture()], bindings, true, new Date(time));
    expect(result.unresolved).toEqual([]); expect(settlementObservationSchema.safeParse(result.observation).success).toBe(true); expect(result.observation).toMatchObject({ outcome: 'won', settledAt: null, actualPayoutCents: null, termsConfirmed: false, ownerAttested: false }); expect(result.observation?.legs).toHaveLength(2);
    expect(combinedResearchAssessment(3.1)).toMatchObject({ probability: null, expectedValue: null, theoreticalIndependentPrice: null, quotedOdds: 3.1 });
  });
  it('rejects ambiguous identity, mismatched dates and provider disagreement rather than selecting a convenient result', () => {
    const t = target(), bindings = t.legs.map(l => ({ legId: l.legId, provider: 'api-nba' as const, eventId: '100', playerId: '20' }));
    expect(proposeProviderSettlement(t, [fixture()], bindings, false).observation).toBeNull();
    expect(proposeProviderSettlement(t, [fixture(), fixture()], bindings, true).observation).toBeNull();
    expect(proposeProviderSettlement(t, [{ ...fixture(), startsAt: '2026-11-04T01:00:00Z' }], bindings, true).observation).toBeNull();
    expect(proposeProviderSettlement(t, [{ ...fixture(), playerName: 'Similar player' }], bindings, true).observation).toBeNull();
  });
});

describe('quota restoration, provider-minute headers and subscriber cancellation', () => {
  it('restores daily use and rolling-minute reservations across server restarts', async () => {
    let now = Date.parse(time), calls = 0;
    const service = new SportsTransport('api-nba', { now: () => now, sleep: async ms => { now += ms; }, fetcher: (async () => { calls++; return Response.json({}); }) as typeof fetch, store: { read: () => ({ utcDay: time.slice(0, 10), used: 69, remainingDaily: 10, requestTimes: [now - 1000], blockedUntil: now + 5000 }), write: () => undefined } });
    await service.request('https://test.invalid/one', {}, 0); expect(calls).toBe(1); expect(now).toBeGreaterThanOrEqual(Date.parse(time) + 9000);
    await expect(service.request('https://test.invalid/two', {}, 0)).rejects.toThrow('budget exhausted'); expect(calls).toBe(1);
  });
  it('honours a provider minute-quota zero without exceeding the local limit', async () => {
    const { service, calls, advance } = transport('api-nba', [Response.json({}, { headers: { 'x-ratelimit-remaining': '0' } }), Response.json({})]);
    await service.request('https://test.invalid/a', {}, 0); await expect(service.request('https://test.invalid/b', {}, 0)).rejects.toThrow('cooldown'); expect(calls).toHaveLength(1); advance(60001); await service.request('https://test.invalid/b', {}, 0); expect(calls[1].at - calls[0].at).toBeGreaterThanOrEqual(60000);
  });
  it('does not cancel another subscriber sharing the same fetch', async () => {
    let complete!: (value: Response) => void; let requestSignal: AbortSignal | null | undefined; let calls = 0;
    const service = new SportsTransport('api-nba', { fetcher: (async (_url, init) => { calls++; requestSignal = init?.signal; return new Promise<Response>(resolve => { complete = resolve; }); }) as typeof fetch });
    const a = new AbortController(), b = new AbortController();
    const first = service.request('https://test.invalid/shared', {}, 0, a.signal), second = service.request('https://test.invalid/shared', {}, 0, b.signal);
    const rejected = expect(first).rejects.toThrow('cancelled'); await new Promise(resolve => setTimeout(resolve, 0)); a.abort(); await rejected;
    expect(requestSignal?.aborted).toBe(false); complete(Response.json({ good: true })); expect((await second).value).toEqual({ good: true }); expect(calls).toBe(1);
  });
});

describe('exact-game recovery after a broad discovery cache is incomplete', () => {
  it('loads the exact provider fixture before normalising player statistics', async () => {
    const { service, calls } = transport('api-nba', [Response.json(games), Response.json(stats)]);
    const adapter = new HybridSportsAdapter('api-nba', service, 'SYNTHETIC-private-test-key');
    const data = await adapter.inspect({ provider: 'api-nba', operation: 'player_stats', parameters: { game: '100' } });
    expect(calls.map(c => new URL(c.url).pathname)).toEqual(['/games', '/players/statistics']);
    expect(data.observations).toHaveLength(1); expect(data.observations[0].startsAt).toBe('2026-11-05T01:00:00.000Z');
  });
});
