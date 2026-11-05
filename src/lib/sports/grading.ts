import { z } from 'zod';
import type { SettlementObservation, SettlementTarget, SettlementTargetLeg } from '../results/contract';
import type { SportsObservation, StatName } from './types';
export const providerBindingsSchema = z.array(z.object({ legId: z.string().uuid(), provider: z.enum(['thesportsdb', 'api-nba', 'api-basketball']), eventId: z.string().regex(/^\d+$/), playerId: z.string().regex(/^\d+$/) }).strict()).min(1).max(20);
export type ProviderBinding = z.infer<typeof providerBindingsSchema>[number];
const markets: Record<string, StatName[]> = {
  'player points': ['points'], 'player rebounds': ['rebounds'], 'player assists': ['assists'],
  'player threes': ['threes'], 'made three-pointers': ['threes'], 'player made threes': ['threes'],
  'points + rebounds': ['points', 'rebounds'], 'points + assists': ['points', 'assists'],
  'rebounds + assists': ['rebounds', 'assists'], 'pra': ['points', 'rebounds', 'assists'],
  'points + rebounds + assists': ['points', 'rebounds', 'assists'],
};
/** Exact supported market names only. Ambiguous settlement terms and missing
 * observations never become zeros or inferred bookmaker outcomes. */
export function gradePlayerLeg(leg: SettlementTargetLeg, observation: SportsObservation) {
  const reject = (reason: string) => ({ outcome: null, value: null, margin: null, reason } as const);
  const names = markets[leg.market?.trim().toLowerCase() ?? ''];
  if (!names) return reject('Unsupported or ambiguous market identity; use manual terms review.');
  if (!observation.final) return reject('The provider has not reported a final game.');
  if (observation.statistics.minutes === null || observation.statistics.minutes <= 0) return reject('Participation/DNP cannot be reconciled; review bookmaker rules.');
  if (names.some(name => observation.statistics[name] === null)) return reject('Required final statistics are missing.');
  const line = leg.line?.match(/^(\d+(?:\.\d+)?)\+?$/)?.[1]; if (!line) return reject('Exact numeric threshold is missing.');
  const threshold = Number(line), selection = leg.selection?.trim().toLowerCase() ?? '';
  const under = /^under\b/.test(selection), over = /^over\b/.test(selection), atLeast = /^(?:at least )?\d+(?:\.\d+)?\+/.test(selection) || /^at least \d/.test(selection);
  if (Number(under) + Number(over) + Number(atLeast) !== 1) return reject('Only explicit over, under and at-least selections are supported.');
  const selectedLine = selection.match(/\d+(?:\.\d+)?/)?.[0]; if (!selectedLine || Number(selectedLine) !== threshold) return reject('Selection and original threshold disagree.');
  const value = names.reduce((sum, name) => sum + observation.statistics[name]!, 0), margin = under ? threshold - value : value - threshold;
  if (margin === 0 && !atLeast) return reject('Exact boundary: push/void terms require owner reconciliation.');
  return { outcome: (atLeast ? margin >= 0 : margin > 0) ? 'won' as const : 'lost' as const, value, margin, reason: null };
}
export function proposeProviderSettlement(target: SettlementTarget, observations: SportsObservation[], bindings: ProviderBinding[], ownerConfirmedIdentities: boolean, now = new Date()): { observation: SettlementObservation | null; unresolved: string[] } {
  const unresolved: string[] = [];
  if (!target.eligible || target.settled) unresolved.push('Only eligible pending registered positions can receive a result proposal.');
  if (!ownerConfirmedIdentities) unresolved.push('Confirm exact provider fixture/player identities, date and settlement terms before proposing.');
  if (!target.startsAt || !target.eventDate) unresolved.push('Original fixture time is missing; use manual evidence review.');
  if (bindings.length !== target.legs.length || new Set(bindings.map(b => b.legId)).size !== bindings.length) unresolved.push('Bind each registered leg exactly once.');
  const matched: SportsObservation[] = [];
  const legs = target.legs.flatMap(leg => {
    const binding = bindings.find(b => b.legId === leg.legId);
    if (!binding) { unresolved.push(`No identity binding for leg ${leg.legId}.`); return []; }
    const rows = observations.filter(o => o.provider === binding.provider && o.eventId === binding.eventId && o.playerId === binding.playerId);
    if (rows.length !== 1) { unresolved.push(`Missing, conflicting or duplicated provider observation for leg ${leg.legId}.`); return []; }
    const row = rows[0];
    if (!row.startsAt || !target.startsAt || Date.parse(row.startsAt) !== Date.parse(target.startsAt) || row.sport !== leg.sport || row.playerName !== leg.participant || row.eventName !== leg.event) { unresolved.push(`Provider fixture, participant, sport or start time does not exactly match leg ${leg.legId}. Names are not fuzzy-matched; resolve identities manually.`); return []; }
    if (Date.parse(row.retrievedAt) > now.getTime() + 300000 || Date.parse(row.retrievedAt) < Date.parse(row.startsAt)) { unresolved.push('Provider observation timing cannot support a final result.'); return []; }
    const grade = gradePlayerLeg(leg, row); if (grade.outcome === null) { unresolved.push(`${leg.legId}: ${grade.reason}`); return []; }
    matched.push(row);
    return [{ legId: leg.legId, sport: leg.sport, event: leg.event, participant: leg.participant, market: leg.market, selection: leg.selection, line: leg.line, outcome: grade.outcome, statistic: `${grade.value} ${leg.market} · provider-supplied observation`, observedValue: grade.value, clearanceMargin: grade.margin }];
  });
  if (unresolved.length || legs.length !== target.legs.length) return { observation: null, unresolved };
  return { observation: { kind: target.kind, recordId: target.recordId, identityHash: target.identityHash, sport: target.sport, event: target.event, eventDate: target.eventDate, outcome: legs.some(l => l.outcome === 'lost') ? 'lost' : 'won', settledAt: null, eventCompleted: true, termsConfirmed: false, termsReference: null, verification: 'source_supplied', ownerAttested: false, sources: [...new Map(matched.map(row => [row.source, { url: row.source, observedAt: row.retrievedAt, note: 'Retrieved final provider observation. Provider source-observation timestamp is unknown; retrieval is not the actual game completion time.' }])).values()], notes: 'Review exact full-game/overtime terms. Proposed grading only; original settlement/completion time is unknown and stays null. Enter the supported timestamp explicitly. Actual payout requires separate ticket evidence or owner attestation.', actualPayoutCents: null, legs, specialCases: [], specialCaseResolution: null }, unresolved: [] };
}
export function combinedResearchAssessment(quotedOdds: number | null) {
  return { quotedOdds, theoreticalIndependentPrice: null, probability: null, expectedValue: null, reason: 'Combined probability unavailable — correlation not validated.' };
}
