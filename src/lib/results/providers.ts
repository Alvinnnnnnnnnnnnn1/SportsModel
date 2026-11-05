import type { Mode } from '@/lib/domain/types';
import type { SettlementObservation, SettlementTarget } from './contract';

export interface ResultProviderCheck {
  providerId: string; checkedAt: string; live: boolean; synthetic: boolean;
  observations: SettlementObservation[];
  unresolved: { key: string; reason: string }[];
}
export interface ResultProvider {
  id: string;
  /** Provider observations are proposals; they never write or independently settle positions. */
  check(targets: SettlementTarget[]): Promise<ResultProviderCheck>;
}

export const manualFallbackResultProvider: ResultProvider = {
  id: 'manual-source-review-v1',
  async check(targets) {
    return { providerId: this.id, checkedAt: new Date().toISOString(), live: false, synthetic: false, observations: [], unresolved: targets.map(target => ({ key: target.key, reason: 'No live results coverage is configured. Supply inspectable result evidence or an explicit owner attestation for reviewed manual settlement.' })) };
  },
};

/** Test/Demo injection only; never fallback synthetic observations into a private workspace. */
export function syntheticResultProvider(mode: Mode, observations: SettlementObservation[]): ResultProvider {
  if (mode !== 'demo') throw new Error('Synthetic result providers belong only in Demo.');
  return { id: 'synthetic-results-v1', async check(targets) {
    const keys = new Set(targets.map(target => target.key));
    return { providerId: this.id, checkedAt: new Date().toISOString(), live: false, synthetic: true, observations: structuredClone(observations.filter(row => keys.has(`${row.kind}:${row.recordId}`))), unresolved: targets.filter(target => !observations.some(row => `${row.kind}:${row.recordId}` === target.key)).map(target => ({ key: target.key, reason: 'No synthetic observation supplied.' })) };
  } };
}
