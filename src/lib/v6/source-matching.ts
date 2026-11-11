import { z } from 'zod';
import { sha256 } from '@/lib/imports/duplicates';
import { marketSchema, observationSchema, type Observation } from './types';

const text = z.string().trim().min(1).max(500);
const stamp = z.string().datetime({ offset: true });
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const price = z.number().min(1.0001).max(10000).refine(n => Math.abs(n * 10000 - Math.round(n * 10000)) < .00001);
const terms = z.object({
  providerMarket: z.enum(['h2h', 'player_points', 'player_rebounds', 'player_assists', 'player_threes']),
  statistic: marketSchema.shape.statistic,
  period: marketSchema.shape.period,
  periodNumber: marketSchema.shape.periodNumber,
  overtime: marketSchema.shape.overtime,
  termsVersion: text,
}).strict();

/** Trusted mapping registry input; neither bookmaker names nor LLM output approve a mapping. */
export const feedMappingSchema = z.object({
  version: z.literal(1), id: text, approvedAt: stamp, evidenceUrl: observationSchema.shape.permissionReference,
  events: z.array(z.object({
    sport: marketSchema.shape.sport, providerSportKey: text, providerEventId: text,
    canonicalEventId: text, eventStartsAt: stamp, home: text, away: text,
    subjects: z.array(z.object({ providerLabel: text, canonicalSubjectId: text }).strict()).min(2),
    terms: z.array(terms).min(1),
  }).strict()),
}).strict().superRefine((m, c) => {
  const unique = (values: string[]) => new Set(values).size === values.length;
  if (!unique(m.events.map(e => `${e.providerSportKey}:${e.providerEventId}`))) c.addIssue({ code: 'custom', message: 'Ambiguous fixture mapping' });
  for (const e of m.events) {
    if (!unique(e.subjects.map(s => s.providerLabel)) || !unique(e.subjects.map(s => s.canonicalSubjectId)) || !unique(e.terms.map(t => t.providerMarket)))
      c.addIssue({ code: 'custom', message: 'Ambiguous subject or settlement terms mapping' });
  }
});
export type FeedMapping = z.infer<typeof feedMappingSchema>;
const event = z.object({
  id: text, sport_key: text, commence_time: stamp, home_team: text, away_team: text,
  bookmakers: z.array(z.object({ key: text, markets: z.array(z.object({
    key: text, last_update: stamp.nullish(),
    outcomes: z.array(z.object({ name: text, description: text.optional(), price, point: z.number().finite().optional() })),
  })) })),
});

/** Pure normalization of an already retrieved, retained response. Makes zero network calls.
 * Missing identity or market-level timestamps never become inferred IDs/source times.
 * A caller must obtain expectedMappingHash from its independently approved registry.
 */
export async function matchV6SportsbetSource(raw: string, input: {
  sport: Observation['market']['sport']; providerSportKey: string;
  retrievedAt: string; sourceUrl: string; expectedMappingHash: string;
}, mappingInput: FeedMapping) {
  if (new TextEncoder().encode(raw).byteLength > 2097152) throw new Error('V6 source exceeds 2 MiB');
  const mapping = feedMappingSchema.parse(mappingInput);
  stamp.parse(input.retrievedAt); hash.parse(input.expectedMappingHash);
  if (await sha256(JSON.stringify(mapping)) !== input.expectedMappingHash) throw new Error('V6 mapping registry hash mismatch');
  if (Date.parse(mapping.approvedAt) > Date.parse(input.retrievedAt)) throw new Error('Mapping was not approved at retrieval');
  const source = new URL(input.sourceUrl);
  if (source.origin !== 'https://api.the-odds-api.com' || source.username || source.password || source.hash
    || [...source.searchParams.keys()].some(k => /key|token|secret|password/i.test(k))) throw new Error('V6 source address must be the credential-free permitted provider');
  const expectedPath = `/v4/sports/${input.providerSportKey}`;
  if (!(source.pathname === `${expectedPath}/odds` || source.pathname.startsWith(`${expectedPath}/events/`) && source.pathname.endsWith('/odds')))
    throw new Error('V6 source endpoint/sport identity mismatch');
  const sportMatches = input.sport === 'NBA' ? input.providerSportKey === 'basketball_nba'
    : input.sport === 'NBL' ? input.providerSportKey === 'basketball_nbl'
      : new RegExp(`^tennis_${input.sport.toLowerCase()}_[a-z0-9_]+$`).test(input.providerSportKey);
  if (!sportMatches) throw new Error('V6 source sport identity mismatch');
  const parsed: unknown = JSON.parse(raw);
  const events = z.array(event).max(1000).parse(Array.isArray(parsed) ? parsed : [parsed]);
  const rawHash = await sha256(raw), observations: Observation[] = [], rejected: { identity: string; reason: string }[] = [];
  const seen = new Set<string>();
  const eventIds = new Set<string>();
  for (const e of events) {
    if (e.sport_key !== input.providerSportKey) throw new Error('Unexpected fixture sport in source');
    if (eventIds.has(e.id) || source.pathname.includes('/events/') && source.pathname !== `${expectedPath}/events/${e.id}/odds`)
      throw new Error('Duplicate or mismatched exact source fixture');
    eventIds.add(e.id);
    const mapped = mapping.events.find(m => m.sport === input.sport && m.providerSportKey === e.sport_key && m.providerEventId === e.id);
    if (!mapped || mapped.home !== e.home_team || mapped.away !== e.away_team || Date.parse(mapped.eventStartsAt) !== Date.parse(e.commence_time)) {
      rejected.push({ identity: e.id, reason: 'exact_fixture_mapping_missing_or_conflicting' }); continue;
    }
    for (const book of e.bookmakers) {
      if (book.key !== 'sportsbet') continue;
      for (const market of book.markets) {
        const t = mapped.terms.find(t => t.providerMarket === market.key);
        if (!t) { rejected.push({ identity: `${e.id}:${market.key}`, reason: 'reviewed_market_terms_missing' }); continue; }
        const expectedStatistic = { h2h: 'moneyline', player_points: 'points', player_rebounds: 'rebounds', player_assists: 'assists', player_threes: 'threes' }[t.providerMarket];
        if (t.statistic !== expectedStatistic) throw new Error('Mapped market statistic contradicts provider identity');
        for (const outcome of market.outcomes) {
          const moneyline = market.key === 'h2h';
          const label = moneyline ? outcome.name : outcome.description;
          const subject = mapped.subjects.find(s => s.providerLabel === label);
          const identity = JSON.stringify([e.id, market.key, label ?? null, outcome.name, outcome.point ?? null]);
          if (seen.has(identity)) throw new Error('Duplicate exact provider outcome'); seen.add(identity);
          if (!subject || moneyline && (outcome.point !== undefined || outcome.description !== undefined || ![e.home_team, e.away_team].includes(outcome.name))
            || !moneyline && (!['Over', 'Under'].includes(outcome.name) || outcome.point === undefined || outcome.point < 0)) {
            rejected.push({ identity, reason: 'exact_subject_or_selection_mapping_missing' }); continue;
          }
          observations.push(observationSchema.parse({
            id: crypto.randomUUID(), sourceClass: 'prospective', provider: 'the-odds-api.com',
            permissionReference: 'https://the-odds-api.com/terms-and-conditions.html', bookmaker: 'sportsbet',
            market: { sport: mapped.sport, eventId: mapped.canonicalEventId, subjectId: subject.canonicalSubjectId,
              statistic: t.statistic, operator: moneyline ? 'win' : outcome.name === 'Over' ? 'gt' : 'lt', threshold: outcome.point ?? null,
              period: t.period, periodNumber: t.periodNumber, overtime: t.overtime, termsVersion: t.termsVersion },
            eventStartsAt: e.commence_time, odds: outcome.price, observedAt: input.retrievedAt, retrievedAt: input.retrievedAt,
            sourceUpdatedAt: market.last_update ?? null, sourceUrl: input.sourceUrl, rawHash,
            // The provider odds endpoint is pre-match. Clock eligibility is still
            // rechecked at commit; unknown/future/stale source times fail there.
            status: Date.parse(e.commence_time) > Date.parse(input.retrievedAt) ? 'prematch_open' : 'unknown',
          }));
        }
      }
    }
  }
  return { mappingId: mapping.id, mappingHash: input.expectedMappingHash, rawHash, rawSource: raw, observations, rejected };
}
