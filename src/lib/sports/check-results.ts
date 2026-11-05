import type { HistoricalWorkspace } from '../imports/types';
import type { SettlementTarget } from '../results';
import type { ResultProviderCheck } from '../results/providers';
import type { SportsObservation, SportsRequest, SportsSnapshot } from './types';
import { currentSportsBindings } from './bindings';
import { proposeProviderSettlement } from './grading';
/** User-triggered lookup only. Reuses one game and one box score per provider
 * fixture across all positions, capped at three fixtures per click. No writes. */
export async function checkBoundSportsResults(targets: SettlementTarget[], history: HistoricalWorkspace, inspect: (request: SportsRequest) => Promise<SportsSnapshot>): Promise<ResultProviderCheck> {
  const result: ResultProviderCheck = { providerId: 'reviewed-hybrid-read-v1', checkedAt: new Date().toISOString(), live: false, synthetic: false, observations: [], unresolved: [] };
  const shared = new Map<string, Promise<SportsObservation[]>>();
  for (const target of targets.filter(t => t.eligible && !t.settled)) {
    const journal = currentSportsBindings(history, target);
    if (!journal) { result.unresolved.push({ key: target.key, reason: 'No current owner-reviewed provider identity mapping. Use optional inspection or manual source review.' }); continue; }
    try {
      const observations: SportsObservation[] = []; const collectedGames = new Set<string>();
      for (const binding of journal.bindings) {
        if (binding.provider === 'thesportsdb') throw new Error('TheSportsDB player-stat coverage is unsupported; retain manual evidence.');
        const key = `${binding.provider}:${binding.eventId}`;
        let loaded = shared.get(key);
        if (!loaded) {
          if (shared.size >= 3) throw new Error('Per-check limit of three provider fixtures reached. Check remaining positions separately.');
          loaded = (async () => {
            result.live = true;
            await inspect({ provider: binding.provider, operation: 'games', parameters: { id: binding.eventId } });
            const data = await inspect({ provider: binding.provider, operation: 'player_stats', parameters: { [binding.provider === 'api-nba' ? 'game' : 'id']: binding.eventId } });
            return data.observations;
          })();
          shared.set(key, loaded);
        }
        const rows = await loaded;
        // Share whole-game reads across legs, but retain duplicate/conflicting
        // rows within a box score so strict identity review rejects them.
        if (!collectedGames.has(key)) { collectedGames.add(key); observations.push(...rows); }
      }
      const proposal = proposeProviderSettlement(target, observations, journal.bindings, true);
      if (proposal.observation) result.observations.push(proposal.observation);
      else result.unresolved.push({ key: target.key, reason: proposal.unresolved.join(' ') });
    } catch (reason) { result.unresolved.push({ key: target.key, reason: reason instanceof Error ? reason.message : 'Provider result unavailable.' }); }
  }
  return result;
}
