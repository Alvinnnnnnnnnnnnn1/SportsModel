import type { ResearchResponse } from './contract';
/** Entirely synthetic, fixed-time contract example. Never a live bookmaker price or actual forecast. */
export const SYNTHETIC_RESEARCH_RESPONSE: ResearchResponse = {
  format: 'edgelab.research-response', version: 1, id: 'SYNTHETIC-response-day-6', researchDate: '2026-11-04', researchDay: 6, dayStatus: 'completed',
  source: 'SYNTHETIC EdgeLab contract fixture only', researchMethod: 'SYNTHETIC documented test inputs; not live research', sourceUrls: ['https://example.invalid/synthetic-research'], rulesSourceReference: 'SYNTHETIC test rules, not original experiment history',
  candidates: [{
    id: 'SYNTHETIC-candidate-1', sport: 'NBA', eventId: 'SYNTHETIC-event-1', event: 'SYNTHETIC Harbour Hawks vs Example Comets', startsAt: '2026-11-05T00:00:00Z', participant: 'SYNTHETIC Example Player', marketId: 'SYNTHETIC-player-points', market: 'Player points', selection: 'Over 18.5 points', line: '18.5', bookmaker: 'SYNTHETIC DEMO BOOK', originalOdds: 1.9, oddsTimestamp: '2026-11-04T00:00:00Z', oddsSource: 'SYNTHETIC fixed fixture, not available odds', oddsSourceUrl: 'https://example.invalid/synthetic-odds', predictionTimestamp: '2026-11-04T00:01:00Z',
    probability: { value: 0.6, origin: 'deterministic_model', source: 'SYNTHETIC numerical test input only', method: 'Synthetic fixture frequency: 6 fictional successes / 10 fictional trials; no real observations', modelVersion: 'synthetic-contract-v1', timestamp: '2026-11-04T00:00:00Z' }, strategy: 'B',
    evidence: [{ claim: 'SYNTHETIC fixture evidence only; no real player observations', sourceUrl: 'https://example.invalid/synthetic-statistics', observedAt: '2026-11-04T00:00:00Z', verification: 'unverified' }], sourceUrls: ['https://example.invalid/synthetic-research'], confidence: 'unknown', uncertainty: 'SYNTHETIC fixture. No live source, price availability or statistical advantage has been established.', decision: 'paper', proposedStatus: 'paper_only', rationale: 'SYNTHETIC paper-lifecycle demonstration only.', passReasons: [], hypotheticalStakeCents: 500, hypotheticalStakeType: 'cash', estimatedEv: 0.14,
  }],
  passes: [{ id: 'SYNTHETIC-pass-1', sport: 'WTA', event: null, reason: 'SYNTHETIC example pass: no verified prices or source evidence available.', sourceUrls: [] }],
};
