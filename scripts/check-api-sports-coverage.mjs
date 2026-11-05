#!/usr/bin/env node
/** Explicit normal free-key audit. Public sports observations only, no Supabase.
 * Uses the same persisted quota store and exclusive process lock as the app.
 * No key/header/account details are printed or saved. */
import { createServer } from 'vite';
import { writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
const option = name => { const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1]; };
if (!process.argv.includes('--confirm-free-read-only') || !option('--report')) throw new Error('Pass --confirm-free-read-only --report PATH. Up to 10 NBA and 6 Basketball requests.');
process.loadEnvFile('.env.local');
if (!process.env.API_SPORTS_KEY || Object.keys(process.env).some(name => /^NEXT_PUBLIC_.*(?:API_SPORTS|APISPORTS).*KEY$/.test(name))) throw new Error('Configure API_SPORTS_KEY server-side only. No key is accepted as an argument.');
const loader = await createServer({ configFile: false, resolve: { alias: { '@': `${process.cwd()}/src` } }, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
const previousFile = option('--continue-from');
const previous = previousFile ? JSON.parse(await readFile(previousFile, 'utf8')) : null;
if (previous && previous.format !== 'edgelab.api-sports-coverage-audit') throw new Error('Use an existing coverage report.');
const results = previous?.results ?? [], quotas = { ...(previous?.quotas ?? {}) };
const recentOnly = process.argv.includes('--recent-date-only');
const historical = process.argv.includes('--historical-sample');
try {
  const { SportsTransport } = await loader.ssrLoadModule('/src/lib/sports/transport.ts');
  const { HybridSportsAdapter } = await loader.ssrLoadModule('/src/lib/sports/adapters.ts');
  const { store, takeProcessLock } = await loader.ssrLoadModule('/src/lib/sports/local-runtime.ts');
  takeProcessLock();
  for (const provider of ['api-nba', 'api-basketball'].filter(id => !option('--provider') || option('--provider') === id)) {
    const transport = new SportsTransport(provider, { store }); const adapter = new HybridSportsAdapter(provider, transport, process.env.API_SPORTS_KEY);
    let requests = 0;
    const inspect = async (operation, parameters = {}) => {
      if (++requests > (provider === 'api-nba' ? 10 : 6)) throw new Error('Audit app budget reached.');
      const row = { provider, operation, parameters }; results.push(row);
      try {
        const value = await adapter.inspect({ provider, operation, parameters }); const raw = value.discovery;
        row.succeeded = true; row.cached = value.cached; row.retrievedAt = value.retrievedAt;
        row.responseCount = Array.isArray(raw?.response) ? raw.response.length : null;
        if (operation === 'seasons') row.discoveredSeasons = raw?.response ?? [];
        if (operation === 'leagues' && provider === 'api-nba') row.discoveredLeagues = raw?.response ?? [];
        row.observationCount = value.observations.length;
        row.sampleEvents = [...new Map(value.observations.map(o => [o.eventId, { eventId: o.eventId, startsAt: o.startsAt, league: o.league, season: o.season, sport: o.sport, final: o.final }])).values()].slice(0, 3);
        row.statisticsCompleteness = value.observations.filter(o => o.playerId).map(o => ({ eventId: o.eventId, playerId: o.playerId, points: o.statistics.points !== null, rebounds: o.statistics.rebounds !== null, assists: o.statistics.assists !== null, madeThrees: o.statistics.threes !== null, minutes: o.statistics.minutes !== null }));
        if (operation === 'status') row.subscription = { active: raw?.response?.subscription?.active ?? null, plan: raw?.response?.subscription?.plan ?? null, dailyLimit: raw?.response?.requests?.limit_day ?? null, dailyUsed: raw?.response?.requests?.current ?? null };
        process.stdout.write(`${provider} ${operation}: response ${row.responseCount ?? 'object'}, normalised ${row.observationCount}\n`);
        return raw;
      } catch (error) { row.succeeded = false; row.code = error.code ?? 'UNAVAILABLE'; row.error = error.code ? error.message : 'Provider audit failed.'; if (error.providerMessage) row.providerMessage = error.providerMessage; process.stdout.write(`${provider} ${operation}: ${row.code}\n`); return null; }
    };
    try {
      const priorStatus = previous?.results.find(row => row.provider === provider && row.operation === 'status' && row.succeeded);
      if (process.argv.includes('--game-identity-only')) {
        const sample = previous?.results.findLast(row => row.provider === provider && row.operation === 'player_stats' && row.succeeded && row.observationCount > 0);
        if (sample) await inspect('games', { id: String(sample.parameters.game ?? sample.parameters.id) });
        continue;
      }
      const status = priorStatus ? { previouslyVerified: true } : await inspect('status'); if (!status) continue;
      if (provider === 'api-nba') {
        const savedLeagues = previous?.results.findLast(row => row.provider === provider && row.operation === 'leagues' && row.discoveredLeagues);
        const savedSeasons = previous?.results.findLast(row => row.provider === provider && row.operation === 'seasons' && row.discoveredSeasons);
        const leagues = savedLeagues ? { response: savedLeagues.discoveredLeagues } : await inspect('leagues');
        const seasons = savedSeasons ? { response: savedSeasons.discoveredSeasons } : await inspect('seasons');
        const league = (leagues?.response ?? []).find(value => value === 'standard');
        const season = (seasons?.response ?? []).filter(value => Number.isSafeInteger(value) && value <= (historical ? 2023 : new Date().getUTCFullYear())).sort((a, b) => b - a)[0];
        if (!league || !season) continue;
        const day = historical ? `${season + 1}-03-01` : new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        const savedGame = process.argv.includes('--recheck-stats') ? previous?.results.findLast(row => row.provider === provider && row.operation === 'player_stats' && row.parameters.game) : null;
        if (savedGame) { await inspect('player_stats', savedGame.parameters); continue; }
        const games = await inspect('games', recentOnly ? { date: day } : { league, season: String(season), ...(historical ? {} : { date: day }) });
        const final = (games?.response ?? []).filter(g => Number(g.status?.short) === 3 && g.league === 'standard' && g.id != null)[0];
        if (!final) { results.at(-1).limitation = 'No completed game or access in this sampled day; no IDs or statistics inferred.'; continue; }
        await inspect('player_stats', { game: String(final.id) });
        if (recentOnly) continue;
        await inspect('teams', { league });
        if (final.teams?.home?.id != null) {
          await inspect('season_team_stats', { id: String(final.teams.home.id), season: String(season) });
          await inspect('players', { team: String(final.teams.home.id), season: String(season) });
        }
        await inspect('team_stats', { id: String(final.id) });
        await inspect('standings', { league, season: String(season) });
      } else {
        const leagues = await inspect('leagues', { country: 'Australia' });
        const eligible = (leagues?.response ?? []).filter(l => ['NBL', 'National Basketball League'].includes(l.name) && l.country?.name === 'Australia');
        if (eligible.length !== 1) { results.at(-1).limitation = 'No unambiguous Australian NBL discovery response.'; continue; }
        const league = eligible[0], seasons = [...(league.seasons ?? [])].sort((a, b) => String(b.season).localeCompare(String(a.season)));
        const season = historical ? seasons.find(s => String(s.season).startsWith('2023')) : seasons.find(s => s.current) ?? seasons[0];
        results.at(-1).nblDiscovery = { leagueId: league.id, name: league.name, season: season?.season ?? null, coverage: season?.coverage ?? null };
        if (!season) continue;
        const games = await inspect('games', recentOnly ? { date: new Date(Date.now() - 86400000).toISOString().slice(0, 10) } : { league: String(league.id), season: String(season.season) });
        const final = (games?.response ?? []).filter(g => ['FT', 'AOT'].includes(g.status?.short) && g.league?.id === league.id && g.id != null).sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
        if (!final) { results.at(-1).limitation = 'No completed game or access in this sampled season; no statistics inferred.'; continue; }
        await inspect('player_stats', { id: String(final.id) });
        if (recentOnly) continue;
        await inspect('team_stats', { id: String(final.id) });
        if (final.teams?.home?.id != null) await inspect('players', { team: String(final.teams.home.id), season: String(season.season) });
      }
    } finally { quotas[provider] = transport.status(); }
  }
} catch (error) { results.push({ error: error.code ? error.message : 'Coverage audit could not start. No application data was changed.' }); process.exitCode = 1; }
finally {
  const report = { format: 'edgelab.api-sports-coverage-audit', createdAt: new Date().toISOString(), simulated: false, applicationWrites: 0, results, quotas };
  const secret = process.env.API_SPORTS_KEY;
  await writeFile(path.resolve(option('--report')), JSON.stringify(report, null, 2).split(secret).join('[REDACTED]'));
  await loader.close();
}
