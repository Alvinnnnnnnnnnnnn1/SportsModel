import { describe, expect, it } from 'vitest';
import { emptyHistoricalWorkspace, commitHistoricalImport, prepareImportCommit } from '@/lib/imports';
import { currentSportsBindings, prepareSportsBindings } from '@/lib/sports/bindings';
import { checkBoundSportsResults } from '@/lib/sports/check-results';
import type { SportsRequest, SportsSnapshot } from '@/lib/sports/types';
import type { SettlementTarget } from '@/lib/results';
import { buildResearchHandoff } from '@/lib/handoff';
import { createEmptyData } from '@/lib/domain/fixtures';
function target(): SettlementTarget { const id = crypto.randomUUID(); return { key: `paper:${id}`, kind: 'paper', recordId: id, identityHash: 'a'.repeat(64), eligible: true, exclusionReason: null, settled: false, currentOutcome: 'pending', sport: 'NBA', event: 'SYNTHETIC Home vs SYNTHETIC Away', eventDate: '2026-11-01', startsAt: '2026-11-01T00:00:00Z', participant: 'SYNTHETIC Player', market: 'Player points', selection: 'Over 20.5 points', line: '20.5', legs: [{ legId: crypto.randomUUID(), sport: 'NBA', event: 'SYNTHETIC Home vs SYNTHETIC Away', participant: 'SYNTHETIC Player', market: 'Player points', selection: 'Over 20.5 points', line: '20.5', odds: 1.9 }], odds: 1.9, originalOdds: 1.9, acceptedOdds: null, stakeCents: 500, stakeType: 'cash', probability: null, probabilityProvenance: null, sourceReference: null, researchDay: 6, sessionId: null, registeredAt: '2026-10-31T00:00:00Z', previousEvidence: [] }; }
const mappings = (t: SettlementTarget) => t.legs.map(l => ({ legId: l.legId, provider: 'api-nba' as const, eventId: '100', playerId: '200' }));
async function save(t: SettlementTarget, history = emptyHistoricalWorkspace()) { const preview = await prepareSportsBindings(t, mappings(t), history, 'demo'); return preview ? commitHistoricalImport(history, prepareImportCommit(preview, preview.rows.map(row => ({ rowNumber: row.rowNumber, include: true, acknowledgeIncomplete: true, allowProbableDuplicate: false })), 'synthetic', history.records)) : history; }
const snapshot = (request: SportsRequest): SportsSnapshot => ({ provider: request.provider, source: 'https://v2.nba.api-sports.io/players/statistics?game=100', retrievedAt: '2026-11-01T04:00:00Z', cached: false, discovery: null, warnings: [], observations: [{ provider: 'api-nba', eventId: '100', playerId: '200', internalEventId: null, internalPlayerId: null, sport: 'NBA', league: 'standard', season: '2026', eventName: 'SYNTHETIC Home vs SYNTHETIC Away', playerName: 'SYNTHETIC Player', startsAt: '2026-11-01T00:00:00Z', eventDate: '2026-11-01', final: true, retrievedAt: '2026-11-01T04:00:00Z', observedAt: null, units: { points: 'count', rebounds: 'count', assists: 'count', threes: 'count', minutes: 'minutes' }, statistics: { points: 25, rebounds: 8, assists: 5, threes: 2, minutes: 30 }, homeScore: 100, awayScore: 90, completeness: 'complete', verification: 'provider_observation', source: 'https://v2.nba.api-sports.io/players/statistics?game=100' }] });
describe('explicit audited provider identities and user-triggered results lookup', () => {
  it('keeps mapping journals separate from predictions, bankroll and handoff proposals', async () => {
    const t = target(), history = await save(t), before = structuredClone(history);
    expect(currentSportsBindings(history, t)?.bindings).toEqual(mappings(t)); expect(history.paperResults).toEqual([]); expect(history.audit).not.toEqual([]);
    expect(await prepareSportsBindings(t, mappings(t), history, 'demo')).toBeNull();
    expect(currentSportsBindings(history, { ...t, identityHash: 'b'.repeat(64) })).toBeNull();
    expect(buildResearchHandoff({ appData: createEmptyData(), history, mode: 'demo' }).context.groups.unregisteredProposals).toEqual([]); expect(history).toEqual(before);
  });
  it('retrieves one game and box score for multiple linked positions and never saves a settlement', async () => {
    const a = target(), b = target(); const history = await save(b, await save(a)); const before = structuredClone(history), calls: SportsRequest[] = [];
    const result = await checkBoundSportsResults([a, b], history, async request => { calls.push(request); return snapshot(request); });
    expect(calls.map(r => r.operation)).toEqual(['games', 'player_stats']); expect(result.observations).toHaveLength(2); expect(result.observations.every(r => !r.termsConfirmed && r.actualPayoutCents === null)).toBe(true); expect(history).toEqual(before);
  });
  it('does not call providers for unbound or another account’s positions, and preserves missing data', async () => {
    const t = target(), history = await save(t); let calls = 0;
    const read = async (request: SportsRequest) => { calls++; return snapshot(request); };
    expect((await checkBoundSportsResults([target()], history, read)).observations).toEqual([]); expect(calls).toBe(0);
    expect((await checkBoundSportsResults([t], emptyHistoricalWorkspace(), read)).observations).toEqual([]); expect(calls).toBe(0);
    const result = await checkBoundSportsResults([t], history, async request => { const value = snapshot(request); value.observations[0].statistics.points = null; return value; });
    expect(result.observations).toEqual([]); expect(result.unresolved[0].reason).toContain('missing');
  });
  it('preserves conflicting duplicate player rows as unresolved instead of choosing a convenient score', async () => {
    const t = target(), history = await save(t);
    const result = await checkBoundSportsResults([t], history, async request => {
      const read = snapshot(request); read.observations.push({ ...structuredClone(read.observations[0]), statistics: { ...read.observations[0].statistics, points: 10 } }); return read;
    });
    expect(result.observations).toEqual([]); expect(result.unresolved[0].reason).toContain('conflicting');
  });
  it('reports provider failures as unresolved without synthetic fallback', async () => {
    const t = target(), history = await save(t);
    const result = await checkBoundSportsResults([t], history, async () => { throw new Error('Free-plan scope unavailable.'); });
    expect(result.observations).toEqual([]); expect(result.synthetic).toBe(false); expect(result.unresolved[0].reason).toContain('Free-plan');
  });
});
