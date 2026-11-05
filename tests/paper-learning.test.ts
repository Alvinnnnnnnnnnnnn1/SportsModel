import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEmptyData } from '@/lib/domain/fixtures';
import { emptyHistoricalWorkspace, commitHistoricalImport, registerHistoricalPaper } from '@/lib/imports';
import { parseResearchResponse, prepareResearchCommit, semanticResearchSession } from '@/lib/handoff/response';
import { SYNTHETIC_RESEARCH_RESPONSE } from '@/lib/handoff/fixtures';
import { buildSettlementTargets, type SettlementResponse } from '@/lib/results';
import { applyHistoricalResultBatch } from '@/lib/daily/result-batch';
import { buildPaperDataset, paperEvaluation, type LearningRow } from '@/lib/learning/evaluation';
import { describePlayerHistory, reviewOfflineModel, type OfflineObservation } from '@/lib/learning/models';
import { researchCandidateSchema } from '@/lib/handoff/contract';
import { researchPaperBlockers } from '@/lib/daily/research';
import { isLocalSportsRequest } from '@/lib/sports/access';
afterEach(() => vi.useRealTimers());
async function registeredPaper() {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-03T01:00:00Z'));
  const response = structuredClone(SYNTHETIC_RESEARCH_RESPONSE); response.createdAt = '2026-11-03T00:30:00Z'; response.researchDate = '2026-11-03'; response.dayStatus = 'draft'; response.candidates = response.candidates.slice(0, 1); response.passes = [];
  const candidate = response.candidates[0];
  Object.assign(candidate, { startsAt: '2026-11-04T01:00:00Z', predictionTimestamp: '2026-11-03T00:00:00Z', oddsTimestamp: '2026-11-02T23:50:00Z', originalOdds: 1.9, estimatedEv: null, decision: 'paper', hypotheticalStakeCents: 500, hypotheticalStakeType: 'cash', probability: { value: 0.6, origin: 'deterministic_model', source: 'SYNTHETIC numerical fixture', method: 'SYNTHETIC beta-binomial numerical fixture: (5+1)/(8+2)', modelVersion: 'synthetic-v1', timestamp: '2026-11-03T00:00:00Z' } });
  candidate.evidence = candidate.evidence.map(e => ({ ...e, observedAt: '2026-11-02T23:45:00Z' }));
  const preview = await parseResearchResponse({ text: JSON.stringify(response), sourceName: 'SYNTHETIC-learning.json', verification: 'synthetic' });
  expect(preview.importPreview.rows[0].issues.filter(i => i.severity === 'error')).toEqual([]);
  let history = commitHistoricalImport(emptyHistoricalWorkspace(), prepareResearchCommit(preview, [{ rowNumber: 1, include: true, acknowledgeIncomplete: true, allowProbableDuplicate: false }], 'synthetic'));
  history = registerHistoricalPaper(history, history.records[0].id);
  vi.setSystemTime(new Date('2026-11-04T13:00:00Z'));
  const data = createEmptyData(), target = (await buildSettlementTargets(data, history))[0];
  const result: SettlementResponse = { format: 'edgelab.settlement-response', version: 1, id: 'SYNTHETIC-learning-result', createdAt: new Date().toISOString(), observations: [{ kind: target.kind, recordId: target.recordId, identityHash: target.identityHash, sport: target.sport, event: target.event, eventDate: target.eventDate, outcome: 'won', settledAt: new Date().toISOString(), eventCompleted: true, termsConfirmed: true, termsReference: 'SYNTHETIC explicit full-game outcome terms', verification: 'owner_attested', ownerAttested: true, sources: [], notes: 'SYNTHETIC final result', actualPayoutCents: null, legs: target.legs.map(l => ({ legId: l.legId, sport: l.sport, event: l.event, participant: l.participant, market: l.market, selection: l.selection, line: l.line, outcome: 'won', statistic: 'SYNTHETIC selection won', observedValue: null, clearanceMargin: null })), specialCases: [], specialCaseResolution: null }] };
  const settled = await applyHistoricalResultBatch(history, data, result, [target.key], 'demo');
  return { response, data, history: settled.data };
}
describe('research legs and conservative combined forecasts', () => {
  it('preserves every source leg, null leg price and immutable original ticket quote', async () => {
    const { response } = await registeredPaper(); const candidate = response.candidates[0];
    candidate.legs = [1, 2].map((_, i) => ({ id: crypto.randomUUID(), sport: 'NBA', eventId: candidate.eventId, event: candidate.event, participant: `SYNTHETIC Player ${i}`, marketId: null, market: 'Player points', selection: 'Over 20.5 points', line: '20.5', odds: null }));
    candidate.probability = { value: null, origin: null, source: null, method: null, modelVersion: null, timestamp: null };
    vi.setSystemTime(new Date('2026-11-03T01:00:00Z'));
    const preview = await parseResearchResponse({ text: JSON.stringify(response), sourceName: 'SYNTHETIC-SGM.json', verification: 'synthetic' });
    expect(preview.importPreview.rows[0].snapshot.legs).toHaveLength(2); expect(preview.importPreview.rows[0].snapshot.legs[0].odds).toBeNull(); expect(preview.importPreview.rows[0].snapshot.odds).toBe(1.9);
    const renamed = structuredClone(response); renamed.id += '-renamed'; renamed.candidates[0].id += '-renamed'; renamed.candidates[0].legs!.forEach(l => { l.id = crypto.randomUUID(); });
    expect(semanticResearchSession(renamed)).toBe(semanticResearchSession(response));
    candidate.probability.value = .7; candidate.estimatedEv = .33;
    const unsupported = await parseResearchResponse({ text: JSON.stringify(response), sourceName: 'SYNTHETIC-SGM.json', verification: 'synthetic' });
    expect(unsupported.importPreview.rows[0].issues.some(i => i.code === 'unsupported_joint_probability')).toBe(true);
  });
  it('blocks prospective paper registration when original timing or price is unknown', async () => {
    const { data, history } = await registeredPaper(); history.paperResults = [];
    const record = history.records[0]; (record.raw as { startsAt: string | null }).startsAt = null;
    expect(researchPaperBlockers(record, history, data, new Date('2026-11-03T02:00:00Z')).join(' ')).toContain('startsAt: original source fact is required');
    (record.raw as { startsAt: string | null }).startsAt = '2026-11-04T01:00:00Z';
    (record.raw as { originalOdds: number | null }).originalOdds = null;
    expect(researchPaperBlockers(record, history, data, new Date('2026-11-03T02:00:00Z')).join(' ')).toContain('originalOdds: original source fact is required');
  });
  it('keeps the original v1 single-selection response contract valid', async () => { const { response } = await registeredPaper(); expect(researchCandidateSchema.safeParse(response.candidates[0]).success).toBe(true); });
});
describe('auditable pre-event paper evaluation dataset', () => {
  it('exports original evidence and final receipts deterministically without any cash or funding mutation', async () => {
    const { data, history } = await registeredPaper(), before = structuredClone({ data, history });
    const dataset = await buildPaperDataset(data, history), repeat = await buildPaperDataset(data, history);
    expect(dataset.datasetHash).toBe(repeat.datasetHash); expect(dataset.rows).toHaveLength(1); expect(dataset.rows[0]).toMatchObject({ eligible: true, probabilisticScoringEligible: true, probability: .6, modelVersion: 'synthetic-v1', hypotheticalProfitCents: 450, inputCutoff: null, features: null, clv: null }); expect(dataset.rows[0].finalObservations).toHaveLength(1);
    expect({ data, history }).toEqual(before); expect(data.transactions).toEqual([]); expect(data.bets).toEqual([]);
    const metrics = paperEvaluation(dataset.rows); expect(metrics.brier).toBeCloseTo(.16); expect(metrics.logLoss).toBeCloseTo(-Math.log(.6)); expect(metrics.bookmakerBrier).toBeCloseTo((1 / 1.9 - 1) ** 2); expect(metrics.hypotheticalRoi).toBe(.9); expect(metrics.scoredCount).toBe(1); expect(metrics.byModelVersion['synthetic-v1'].brier).toBeCloseTo(.16); expect(metrics.forecastErrors[0].residual).toBeCloseTo(-.4);
  });
  it('excludes retrospective records, missing odds evidence, unsupported probability sources and absent result receipts', async () => {
    const { data, history } = await registeredPaper();
    history.audit = history.audit.filter(a => a.action !== 'paper_registered');
    const dataset = await buildPaperDataset(data, history); expect(dataset.rows[0].eligible).toBe(false); expect(paperEvaluation(dataset.rows).settledCount).toBe(0);
  });
  it('reports infinite log loss honestly and separates hypothetical bonus returns from cash ROI', async () => {
    const { data, history } = await registeredPaper(); const original = (await buildPaperDataset(data, history)).rows[0];
    const metrics = paperEvaluation([{ ...original, probability: 0 }, { ...original, id: 'bonus', hypotheticalStakeType: 'bonus', hypotheticalProfitCents: 430 }]);
    expect(metrics.infiniteLogLossCount).toBe(1); expect(metrics.logLoss).toBeNull(); expect(metrics.hypotheticalProfitCents).toBe(880); expect(metrics.hypotheticalCashProfitCents).toBe(450); expect(metrics.hypotheticalRoi).toBe(.9);
    expect(paperEvaluation([] as LearningRow[])).toMatchObject({ brier: null, logLoss: null, hitRate: null });
  });
});
const manifest = { format: 'edgelab.offline-model-review', version: 1, modelId: 'synthetic-baseline', modelVersion: 'v2', previousVersion: 'v1', datasetHash: 'a'.repeat(64), methodology: 'SYNTHETIC explicitly frozen offline numerical comparison only.', inputSources: ['SYNTHETIC test fixtures'], trainingCutoff: '2026-10-01T00:00:00Z', validationEnd: '2026-10-15T00:00:00Z', frozenAt: '2026-10-16T00:00:00Z', testEnd: '2026-11-01T00:00:00Z', minimumTrain: 100, minimumValidation: 30, minimumTest: 30, ownerApproved: false, rollbackVersion: 'v1' };
const observation: OfflineObservation = { id: 'SYNTHETIC-row', eventId: 'SYNTHETIC-game', startsAt: '2026-09-01T01:00:00Z', outcomeAvailableAt: '2026-09-01T04:00:00Z', inputCutoff: '2026-08-31T12:00:00Z', probability: .6, outcome: 1 };
describe('offline chronological model validation, never automatic promotion', () => {
  it('requires adequate independent fixtures and exact frozen dataset identity', () => { const result = reviewOfflineModel(manifest, [observation], manifest.datasetHash); expect(result).toMatchObject({ adequate: false, promotionReady: false, counts: { train: 1, validation: 0, test: 0 } }); expect(() => reviewOfflineModel(manifest, [observation], 'b'.repeat(64))).toThrow('hash'); });
  it('rejects future input, late training outcomes, duplicate observations and overlapping fixtures', () => {
    expect(() => reviewOfflineModel(manifest, [{ ...observation, inputCutoff: observation.startsAt }], manifest.datasetHash)).toThrow('leakage');
    expect(() => reviewOfflineModel(manifest, [{ ...observation, outcomeAvailableAt: '2026-10-02T00:00:00Z' }], manifest.datasetHash)).toThrow('unavailable');
    expect(() => reviewOfflineModel(manifest, [observation, observation], manifest.datasetHash)).toThrow('duplicate');
    expect(() => reviewOfflineModel(manifest, [observation, { ...observation, id: 'second', startsAt: '2026-10-03T00:00:00Z', outcomeAvailableAt: '2026-10-03T04:00:00Z' }], manifest.datasetHash)).toThrow('same fixture');
  });
  it('does not promote a model merely because ownerApproved is asserted', () => { expect(reviewOfflineModel({ ...manifest, ownerApproved: true }, [], manifest.datasetHash).promotionReady).toBe(false); });
  it('describes pre-event observations without converting recent hit rates to a betting forecast', () => {
    const sample = [{ eventId: 'SYNTHETIC-1', endedAt: '2026-09-01T01:00:00Z', observedAt: '2026-09-01T02:00:00Z', value: 20, source: 'SYNTHETIC' }, { eventId: 'SYNTHETIC-2', endedAt: '2026-09-02T01:00:00Z', observedAt: '2026-09-02T02:00:00Z', value: null, source: 'SYNTHETIC' }];
    expect(describePlayerHistory(sample, manifest.trainingCutoff)).toMatchObject({ count: 1, missingCount: 1, mean: 20, probability: null, expectedValue: null, validationStatus: 'insufficient_sample' });
    expect(() => describePlayerHistory(sample, '2026-09-01T01:30:00Z')).toThrow('future');
  });
});
describe('local authenticated provider boundary', () => {
  it('rejects remote hosts and cross-origin provider proxy use', () => { expect(isLocalSportsRequest(new Request('http://localhost:3000/api/sports'))).toBe(true); expect(isLocalSportsRequest(new Request('https://public.invalid/api/sports'))).toBe(false); expect(isLocalSportsRequest(new Request('http://localhost:3000/api/sports', { headers: { Origin: 'https://evil.invalid' } }))).toBe(false); });
});
