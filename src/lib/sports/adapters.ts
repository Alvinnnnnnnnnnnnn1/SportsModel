import { SportsAccessError, SportsTransport } from './transport';
import { sportsRequestSchema, type SportsObservation, type SportsProviderId, type SportsRequest, type SportsSnapshot } from './types';
type Row = Record<string, unknown>;
const object = (v: unknown): Row => v && typeof v === 'object' && !Array.isArray(v) ? v as Row : {};
const array = (v: unknown): unknown[] => Array.isArray(v) ? v : [];
const text = (v: unknown): string | null => typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' && Number.isFinite(v) ? String(v) : null;
export const numberOrNull = (v: unknown): number | null => (typeof v === 'number' || typeof v === 'string' && /^\d+(\.\d+)?$/.test(v)) && Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : null;
const integer = (v: unknown) => { const n = numberOrNull(v); return n !== null && Number.isSafeInteger(n) ? n : null; };
const iso = (v: unknown): string | null => typeof v === 'string' && /^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(v) && Number.isFinite(Date.parse(v)) ? new Date(v).toISOString() : null;
const minutes = (v: unknown) => {
  if (typeof v === 'string' && /^\d{1,3}:\d\d$/.test(v)) { const [m, s] = v.split(':').map(Number); return s < 60 ? m + s / 60 : null; }
  return numberOrNull(v);
};
export const SPORTS_ORIGINS = { thesportsdb: 'https://www.thesportsdb.com/api/v1/json/123', 'api-nba': 'https://v2.nba.api-sports.io', 'api-basketball': 'https://v1.basketball.api-sports.io' } as const;
const nba = { status: ['/status', []], leagues: ['/leagues', []], seasons: ['/seasons', []], games: ['/games', ['id', 'date', 'league', 'season', 'team']], teams: ['/teams', ['id', 'league', 'search']], players: ['/players', ['id', 'team', 'season', 'search']], player_stats: ['/players/statistics', ['game', 'id', 'season']], team_stats: ['/games/statistics', ['id']], season_team_stats: ['/teams/statistics', ['id', 'season']], standings: ['/standings', ['league', 'season', 'team']] } as const;
const basketball = { status: ['/status', []], leagues: ['/leagues', ['id', 'country', 'name', 'season']], seasons: ['/seasons', []], games: ['/games', ['id', 'date', 'league', 'season', 'team']], teams: ['/teams', ['id', 'league', 'season', 'search']], players: ['/players', ['id', 'team', 'season', 'search']], player_stats: ['/games/statistics/players', ['id', 'player', 'season']], team_stats: ['/games/statistics/teams', ['id']], standings: ['/standings', ['league', 'season']] } as const;
const sportsdb = { arsenal: ['/searchteams.php', []], leagues: ['/search_all_leagues.php', ['c', 's']], past_fixtures: ['/eventspastleague.php', ['id']], event: ['/lookupevent.php', ['id']], event_stats: ['/lookupeventstats.php', ['id']], fixtures: ['/eventsday.php', ['d', 'l', 's']] } as const;
export function sportsRequestUrl(input: SportsRequest): string {
  const request = sportsRequestSchema.parse(input);
  const mapping = request.provider === 'thesportsdb' ? sportsdb : request.provider === 'api-nba' ? nba : basketball;
  const entry = (mapping as Record<string, readonly [string, readonly string[]]>)[request.operation];
  if (!entry) throw new SportsAccessError('INVALID_REQUEST', 'Unsupported free API operation.');
  for (const [key, value] of Object.entries(request.parameters)) {
    if (!entry[1].includes(key) || !/^[\p{L}\p{N} ._:+-]+$/u.test(value)) throw new SportsAccessError('INVALID_REQUEST', 'Unsupported provider parameter. URLs and credentials are not accepted.');
    if (['id', 'team', 'player', 'game', 'l'].includes(key) && !/^\d+$/.test(value)) throw new SportsAccessError('INVALID_REQUEST', 'Use an exact numeric ID returned by this provider.');
    if (['d', 'date'].includes(key) && (!/^\d{4}-\d\d-\d\d$/.test(value) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value)) throw new SportsAccessError('INVALID_REQUEST', 'Use an exact calendar date.');
  }
  const p = request.parameters;
  if (['event', 'event_stats', 'team_stats', 'past_fixtures'].includes(request.operation) && !p.id) throw new SportsAccessError('INVALID_REQUEST', 'Discover and supply an exact provider event ID.');
  if (request.operation === 'season_team_stats' && (!p.id || !p.season)) throw new SportsAccessError('INVALID_REQUEST', 'Supply exact provider team ID and season.');
  if (request.operation === 'player_stats' && !(request.provider === 'api-nba' ? p.game || p.id && p.season : p.id || p.player && p.season)) throw new SportsAccessError('INVALID_REQUEST', 'Supply a provider game ID or player and season.');
  if (request.operation === 'fixtures' && !p.d) throw new SportsAccessError('INVALID_REQUEST', 'Supply the fixture date.');
  if (request.operation === 'games' && !p.id && !p.date && !(p.league && p.season)) throw new SportsAccessError('INVALID_REQUEST', 'Supply an event ID, date, or discovered league and season.');
  const url = new URL(`${SPORTS_ORIGINS[request.provider]}${entry[0]}`);
  for (const [key, value] of Object.entries(p).sort(([a], [b]) => a.localeCompare(b))) url.searchParams.set(key, value);
  if (request.operation === 'arsenal') url.searchParams.set('t', 'Arsenal');
  return url.toString();
}
export function normaliseGames(provider: SportsProviderId, payload: unknown, retrievedAt: string, source: string): SportsObservation[] {
  const root = object(payload), rows = array(provider === 'thesportsdb' ? root.events : root.response);
  return rows.flatMap(value => {
    const row = object(value), date = object(row.date), teams = object(row.teams), status = object(row.status), scores = object(row.scores), league = object(row.league);
    const id = text(provider === 'thesportsdb' ? row.idEvent : row.id); if (!id) return [];
    const home = object(teams.home), away = object(teams.visitors ?? teams.away);
    const start = iso(provider === 'thesportsdb' ? row.strTimestamp : provider === 'api-nba' ? date.start : row.date);
    const name = provider === 'thesportsdb' ? text(row.strEvent) : text(home.name) && text(away.name) ? `${text(home.name)} vs ${text(away.name)}` : null;
    const leagueName = provider === 'thesportsdb' ? text(row.strLeague) : provider === 'api-nba' ? text(row.league) : text(league.name);
    const sport = provider === 'api-nba' && leagueName === 'standard' ? 'NBA' as const : provider === 'api-basketball' && text(object(row.country).name) === 'Australia' && leagueName === 'NBL' ? 'NBL' as const : provider === 'thesportsdb' && leagueName === 'NBA' ? 'NBA' as const : provider === 'thesportsdb' && leagueName === 'Australian NBL' ? 'NBL' as const : null;
    const final = provider === 'api-nba' ? Number(status.short) === 3 : provider === 'api-basketball' ? ['FT', 'AOT'].includes(String(status.short)) : ['Match Finished', 'FT', 'AOT'].includes(String(row.strStatus));
    return [{ provider, eventId: id, playerId: null, internalEventId: null, internalPlayerId: null, sport, league: leagueName, season: text(provider === 'thesportsdb' ? row.strSeason : provider === 'api-nba' ? row.season : league.season), eventName: name, playerName: null, startsAt: start, eventDate: start?.slice(0, 10) ?? text(row.dateEvent), final, retrievedAt, observedAt: null, units: { points: 'count' as const, rebounds: 'count' as const, assists: 'count' as const, threes: 'count' as const, minutes: 'minutes' as const }, statistics: { points: null, rebounds: null, assists: null, threes: null, minutes: null }, homeScore: integer(provider === 'thesportsdb' ? row.intHomeScore : object(scores.home).points ?? object(scores.home).total), awayScore: integer(provider === 'thesportsdb' ? row.intAwayScore : object(scores.visitors ?? scores.away).points ?? object(scores.away).total), completeness: 'partial' as const, verification: 'provider_observation' as const, source }];
  });
}
/** Requires the game response from this same provider. A statistics row never
 * supplies missing fixture time, final status or cross-provider identities. */
export function normalisePlayerStatistics(provider: SportsProviderId, payload: unknown, games: SportsObservation[], retrievedAt: string, source: string): SportsObservation[] {
  if (provider === 'thesportsdb') return [];
  return array(object(payload).response).flatMap(value => {
    const row = object(value), gameId = text(object(row.game).id), player = object(row.player), playerId = text(player.id);
    const matching = games.filter(g => g.provider === provider && g.eventId === gameId && g.playerId === null);
    if (!gameId || !playerId || matching.length !== 1) return [];
    const game = matching[0], nba = provider === 'api-nba', rebounds = object(row.rebounds), threes = object(row.threepoint_goals);
    const stats = { points: integer(row.points), rebounds: integer(nba ? row.totReb : rebounds.total), assists: integer(row.assists), threes: integer(nba ? row.tpm : threes.total), minutes: minutes(nba ? row.min : row.minutes) };
    return [{ ...game, playerId, playerName: text(player.name) ?? ([text(player.firstname), text(player.lastname)].filter(Boolean).join(' ') || null), retrievedAt, observedAt: null, statistics: stats, completeness: Object.values(stats).every(v => v !== null) ? 'complete' as const : 'partial' as const, source }];
  });
}
export interface SportsDataAdapter { readonly id: SportsProviderId; inspect(request: SportsRequest, signal?: AbortSignal): Promise<SportsSnapshot>; }
export class HybridSportsAdapter implements SportsDataAdapter {
  private games = new Map<string, SportsObservation>();
  constructor(readonly id: SportsProviderId, readonly transport: SportsTransport, private key?: string) {}
  async inspect(request: SportsRequest, signal?: AbortSignal): Promise<SportsSnapshot> {
    if (request.provider !== this.id) throw new SportsAccessError('INVALID_REQUEST', 'Provider identity mismatch.');
    if (this.id !== 'thesportsdb' && !this.key) throw new SportsAccessError('DISABLED', 'API-Sports key is not configured on the server.');
    const source = sportsRequestUrl(request);
    if (request.operation === 'player_stats') {
      const gameId = request.parameters[this.id === 'api-nba' ? 'game' : 'id'];
      if (gameId && !this.games.has(gameId)) await this.inspect({ provider: this.id, operation: 'games', parameters: { id: gameId } }, signal);
    }
    const ttl = ['leagues', 'seasons', 'teams', 'players', 'arsenal'].includes(request.operation) ? 86400000 : ['games', 'fixtures'].includes(request.operation) ? 900000 : request.operation === 'status' ? 60000 : 7200000;
    const read = await this.transport.request(source, this.id === 'thesportsdb' ? {} : { 'x-apisports-key': this.key! }, ttl, signal);
    let observations: SportsObservation[] = [];
    if (['games', 'fixtures', 'past_fixtures', 'event'].includes(request.operation)) {
      observations = normaliseGames(this.id, read.value, read.retrievedAt, source);
      const identityCounts = new Map<string, number>();
      for (const row of observations) identityCounts.set(row.eventId, (identityCounts.get(row.eventId) ?? 0) + 1);
      for (const row of observations) { if (identityCounts.get(row.eventId) !== 1) { this.games.delete(row.eventId); continue; } if (this.games.size >= 1000) this.games.delete(this.games.keys().next().value!); this.games.set(row.eventId, row); }
    } else if (request.operation === 'player_stats') observations = normalisePlayerStatistics(this.id, read.value, [...this.games.values()], read.retrievedAt, source);
    return { provider: this.id, source, retrievedAt: read.retrievedAt, cached: read.cached, observations, discovery: read.value, warnings: ['Provider observation, not a forecast, available bookmaker price, ticket payout or approved settlement.', ...(request.operation === 'player_stats' && !observations.length ? ['No unambiguous matching game loaded. Inspect games first; missing fields remain null.'] : []), ...(this.id === 'thesportsdb' ? ['Free endpoint limits can truncate results. NBA/NBL prop coverage is not established; no tennis grading.'] : ['Live subscription and season coverage require separate verification.'])] };
  }
}
export function preferredSportsProvider(sport: string, verified: Partial<Record<SportsProviderId, boolean>>): SportsProviderId | null {
  const id = sport === 'NBA' ? 'api-nba' : sport === 'NBL' ? 'api-basketball' : null;
  return id && verified[id] ? id : null;
}
