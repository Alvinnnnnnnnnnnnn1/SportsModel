import type { DailyCycle } from '@/lib/daily-cycle/contract';
/** Invented local-only source; never sent to hosted storage. */
export function localCycle(): DailyCycle {
  return { format: 'edgelab.daily-cycle', version: 1, sourceClass: 'owner_research',
    metadata: { cycleId: 'LOCAL-TEST-cycle', researchSessionId: 'LOCAL-TEST-session', researchDate: '2026-11-11', generatedAt: '2026-11-11T00:00:00Z', sourceDataCutoff: '2026-11-10T23:59:00Z', previousCheckpoint: null, methodologyVersion: 'local-test', modelVersion: null, contextVersion: null },
    resultUpdates: [], betRecommendations: [], paperRecommendations: [{
      candidateId: 'LOCAL-TEST-paper', eventId: 'LOCAL-TEST-event', event: 'SYNTHETIC LOCAL A vs B', sport: 'NBA', participant: 'SYNTHETIC LOCAL player', market: 'Player points', selection: 'Over 20.5', line: '20.5',
      startsAt: '2026-11-12T00:00:00Z', originalOdds: 1.91, bookmaker: 'SYNTHETIC LOCAL book', quoteSource: 'LOCAL TEST source only', quoteTimestamp: '2026-11-10T23:58:00Z', probability: .63, probabilityMethod: null, modelVersion: null, uncertainty: 'LOCAL TEST ONLY', evidenceCutoff: '2026-11-10T23:59:00Z', riskFactors: [], reasoning: 'SYNTHETIC local test, no hosted use.', strategy: 'B', sources: [{ url: 'https://example.invalid/local-test', observedAt: '2026-11-10T23:58:00Z', note: 'SYNTHETIC local evidence fixture' }], proposedStakeCents: 500 }],
    modelFeedback: { resultsEvaluated: 0, calibration: null, forecastErrors: [], missingDataPatterns: [], marketObservations: [], proposedModelVersion: null, validationStatus: 'insufficient_evidence', evidenceLimitations: ['SYNTHETIC LOCAL TEST ONLY'] },
    processing: { outstandingActualReviewed: 0, resolved: 0, unresolved: 0, paperReviewed: 0, unresolvedReasons: [] } };
}
