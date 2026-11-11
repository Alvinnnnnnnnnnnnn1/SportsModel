/** Invented upstream messages and local-only mapping registry. No hosted writes/network. */
import { describe, it, expect } from 'vitest';
import { matchV6SportsbetSource, type FeedMapping } from '@/lib/v6/source-matching';
import { sha256 } from '@/lib/imports/duplicates';
import { decisionKey, qualification } from '@/lib/v6/engine';
const mapping: FeedMapping = {
  version: 1, id: 'SYNTHETIC-LOCAL-TEST-mapping', approvedAt: '2026-11-10T00:00:00Z', evidenceUrl: 'https://example.invalid/local-only/terms',
  events: [{ sport: 'NBA', providerSportKey: 'basketball_nba', providerEventId: 'LOCAL-event', canonicalEventId: 'canonical-LOCAL-event',
    eventStartsAt: '2026-11-11T02:00:00Z', home: 'LOCAL Home', away: 'LOCAL Away', subjects: [
      { providerLabel: 'LOCAL Home', canonicalSubjectId: 'home-id' }, { providerLabel: 'LOCAL Away', canonicalSubjectId: 'away-id' },
      { providerLabel: 'LOCAL Player', canonicalSubjectId: 'player-id' },
    ], terms: [{ providerMarket: 'player_points', statistic: 'points', period: 'full_game', periodNumber: null, overtime: 'included', termsVersion: 'LOCAL-TEST-rules' },
      { providerMarket: 'h2h', statistic: 'moneyline', period: 'full_game', periodNumber: null, overtime: 'included', termsVersion: 'LOCAL-TEST-rules' }],
  }],
};
const source = () => ({ id: 'LOCAL-event', sport_key: 'basketball_nba', commence_time: '2026-11-11T02:00:00Z', home_team: 'LOCAL Home', away_team: 'LOCAL Away', bookmakers: [
  { key: 'sportsbet', last_update: '2026-11-11T00:00:00Z', markets: [{ key: 'player_points', last_update: '2026-11-11T00:00:00Z', outcomes: [{ name: 'Over', description: 'LOCAL Player', price: 1.91, point: 20.5 }] }] },
] });
const options = async () => ({ sport: 'NBA' as const, providerSportKey: 'basketball_nba', retrievedAt: '2026-11-11T00:00:10Z', sourceUrl: 'https://api.the-odds-api.com/v4/sports/basketball_nba/events/LOCAL-event/odds', expectedMappingHash: await sha256(JSON.stringify(mapping)) });
describe('V6 permitted feed exact identity and immutable source normalization', () => {
  it('retains exact original prices, line, raw bytes and market-level clocks without inferring canonical identities', async () => {
    const raw = JSON.stringify(source(), null, 2), result = await matchV6SportsbetSource(raw, await options(), mapping);
    expect(result.rawSource).toBe(raw); expect(result.rawHash).toBe(await sha256(raw));
    expect(result.observations[0]).toMatchObject({ odds: 1.91, sourceUpdatedAt: '2026-11-11T00:00:00Z', market: { subjectId: 'player-id', threshold: 20.5, operator: 'gt', termsVersion: 'LOCAL-TEST-rules' } });
    const missing = source(); missing.bookmakers[0].markets[0].outcomes[0].description = 'Same surname is not an exact identity';
    expect((await matchV6SportsbetSource(JSON.stringify(missing), await options(), mapping)).observations).toHaveLength(0);
    const fixture = source(); fixture.home_team = 'Different home';
    expect((await matchV6SportsbetSource(JSON.stringify(fixture), await options(), mapping)).rejected[0].reason).toContain('fixture');
  });
  it('leaves missing market timestamps null, rejects duplicate outcomes and distinguishes reprices from new thresholds', async () => {
    const raw = source(); delete (raw.bookmakers[0].markets[0] as { last_update?: string }).last_update;
    const first = (await matchV6SportsbetSource(JSON.stringify(raw), await options(), mapping)).observations[0];
    expect(first.sourceUpdatedAt).toBeNull(); expect(qualification(first, null, '2026-11-11T00:00:10Z', 'v6-prospective')).toContain('source_timestamp_unknown');
    raw.bookmakers[0].markets[0].outcomes[0].price = 2.05;
    const repriced = (await matchV6SportsbetSource(JSON.stringify(raw), await options(), mapping)).observations[0];
    expect(await decisionKey(first, 'pre_event_once')).toBe(await decisionKey(repriced, 'pre_event_once'));
    raw.bookmakers[0].markets[0].outcomes[0].point = 21.5;
    const changed = (await matchV6SportsbetSource(JSON.stringify(raw), await options(), mapping)).observations[0];
    expect(await decisionKey(first, 'pre_event_once')).not.toBe(await decisionKey(changed, 'pre_event_once'));
    raw.bookmakers[0].markets[0].outcomes.push(raw.bookmakers[0].markets[0].outcomes[0]);
    await expect(matchV6SportsbetSource(JSON.stringify(raw), await options(), mapping)).rejects.toThrow(/Duplicate/);
  });
  it('fails closed on mapping provenance, source sport/fixture mismatch, credentials and malformed prices', async () => {
    const o = await options();
    await expect(matchV6SportsbetSource(JSON.stringify(source()), { ...o, expectedMappingHash: '0'.repeat(64) }, mapping)).rejects.toThrow(/hash mismatch/);
    await expect(matchV6SportsbetSource(JSON.stringify(source()), { ...o, sourceUrl: o.sourceUrl + '?apiKey=not-a-key' }, mapping)).rejects.toThrow(/credential/);
    await expect(matchV6SportsbetSource(JSON.stringify(source()), { ...o, sourceUrl: o.sourceUrl.replace('LOCAL-event', 'other') }, mapping)).rejects.toThrow(/fixture/);
    await expect(matchV6SportsbetSource(JSON.stringify(source()), { ...o, sport: 'NBL' }, mapping)).rejects.toThrow(/sport/);
    const invalid = source(); invalid.bookmakers[0].markets[0].outcomes[0].price = 1;
    await expect(matchV6SportsbetSource(JSON.stringify(invalid), o, mapping)).rejects.toThrow();
  });
});
