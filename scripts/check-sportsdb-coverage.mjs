#!/usr/bin/env node
// Explicit, read-only free v1 coverage audit. Maximum six requests, serial and
// >=3 seconds apart. No odds, personal workspace, API-Sports key or writes.
import { writeFile } from 'node:fs/promises';
const report = process.argv[process.argv.indexOf('--report') + 1];
if (!process.argv.includes('--confirm-free-read-only') || !report || !process.argv.includes('--report')) throw new Error('Pass --confirm-free-read-only --report PATH. Maximum six public requests.');
let calls = 0, last = 0;
const results = [];
async function read(endpoint, parameters) {
  if (++calls > 6) throw new Error('Read-only audit budget reached.');
  await new Promise(resolve => setTimeout(resolve, Math.max(0, last + 3100 - Date.now()))); last = Date.now();
  const url = new URL(`https://www.thesportsdb.com/api/v1/json/123/${endpoint}`);
  for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);
  const response = await fetch(url, { signal: AbortSignal.timeout(15000), redirect: 'error' });
  const entry = { url: String(url), httpStatus: response.status, retrievedAt: new Date().toISOString() }; results.push(entry);
  if (!response.ok) return null;
  try { const body = await response.json(); entry.arrayCounts = Object.fromEntries(Object.entries(body).map(([key, value]) => [key, Array.isArray(value) ? value.length : value === null ? null : typeof value])); return body; }
  catch { entry.error = 'Non-JSON response'; return null; }
}
try {
  for (const [country, predicate] of [['United States', league => /^NBA$/i.test(league.strLeague ?? '')], ['Australia', league => /^(?:Australian )?NBL$/i.test(league.strLeague ?? '')]]) {
    const body = await read('search_all_leagues.php', { c: country, s: 'Basketball' });
    const leagues = body?.countries ?? body?.leagues ?? [];
    results.at(-1).discoveredLeagues = leagues.map(league => ({ id: league.idLeague ?? null, name: league.strLeague ?? null }));
    const league = leagues.filter(predicate);
    if (league.length !== 1) { results.at(-1).limitation = 'No unambiguous NBA/NBL league in this limited free response.'; continue; }
    const games = await read('eventspastleague.php', { id: String(league[0].idLeague) });
    const event = (games?.events ?? [])[0];
    if (!event?.idEvent) continue;
    results.at(-1).event = { id: event.idEvent, league: event.strLeague, date: event.dateEvent, status: event.strStatus ?? null, hasHomeScore: event.intHomeScore != null, hasAwayScore: event.intAwayScore != null };
    const stats = await read('lookupeventstats.php', { id: String(event.idEvent) });
    results.at(-1).statisticKeys = [...new Set((stats?.eventstats ?? []).flatMap(row => Object.keys(row)))];
    results.at(-1).limitation = 'One sampled event, truncated free response. No player-prop coverage established.';
  }
} catch (error) { results.push({ error: error.name === 'TimeoutError' ? 'Timed out' : 'Read-only transport failed' }); process.exitCode = 1; }
await writeFile(report, JSON.stringify({ format: 'edgelab.sportsdb-coverage-audit', createdAt: new Date().toISOString(), requests: calls, simulated: false, apiSportsRequests: 0, results }, null, 2));
process.stdout.write(`Read-only audit finished: ${calls} public requests; report ${report}\n`);
