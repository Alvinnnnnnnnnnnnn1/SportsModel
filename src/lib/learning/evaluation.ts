import type { AppData } from '../domain/types';
import type { HistoricalWorkspace } from '../imports/types';
import { sha256 } from '../imports/duplicates';
import { buildSettlementTargets } from '../results/targets';
import { researchCandidateSchema } from '../handoff/contract';
import { multiplyMoney } from '../domain/calculations';
export interface LearningRow {
  sourceClass: 'synthetic' | 'source_claim_not_independently_verified';
  id: string; identityHash: string; event: string | null; startsAt: string | null;
  sport: string | null; market: string | null; strategy: string | null;
  registeredAt: string; predictionAt: string | null; oddsAt: string | null; originalOdds: number | null;
  probability: number | null; modelVersion: string | null; methodology: string | null;
  inputCutoff: string | null; inputSources: string[]; features: unknown; evidence: unknown;
  outcome: 'pending' | 'won' | 'lost' | 'void'; settledAt: string | null;
  hypotheticalStakeType: 'cash' | 'bonus' | null; hypotheticalStakeCents: number | null; hypotheticalProfitCents: number | null;
  eligible: boolean; exclusions: string[]; probabilisticScoringEligible: boolean;
  finalObservations: unknown[]; clv: null;
}
export interface PaperDataset { format: 'edgelab.paper-evaluation'; version: 1; datasetHash: string; containsSynthetic: boolean; rows: LearningRow[]; }
const str = (v: unknown) => typeof v === 'string' && v.trim() ? v : null;
/** Immutable point-in-time export. No feedback changes a prediction or trains a
 * live model. Existing source payloads and result receipts remain auditable. */
export async function buildPaperDataset(data: AppData, history: HistoricalWorkspace): Promise<PaperDataset> {
  const targets = (await buildSettlementTargets(data, history)).filter(t => t.kind !== 'actual');
  const rows: LearningRow[] = targets.map(t => {
    const core = data.paperPredictions.find(p => p.id === t.recordId);
    const archived = history.records.find(r => r.id === t.recordId);
    const research = archived ? researchCandidateSchema.safeParse(archived.raw) : null;
    const probabilitySource = t.probabilityProvenance && typeof t.probabilityProvenance === 'object' ? t.probabilityProvenance as Record<string, unknown> : {};
    const predictionAt = core?.candidate.registeredAt ?? archived?.snapshot.predictionAt ?? null;
    const oddsAt = core?.candidate.oddsProvenance.timestamp ?? (research?.success ? research.data.oddsTimestamp : null);
    const priceSource = core?.candidate.oddsProvenance.source ?? (research?.success ? research.data.oddsSource : null);
    const exclusions: string[] = [];
    if (!t.eligible) exclusions.push(t.exclusionReason ?? 'No qualifying registration proof.');
    if (!t.startsAt || !predictionAt || Date.parse(predictionAt) >= Date.parse(t.startsAt)) exclusions.push('Original pre-event prediction timing unavailable.');
    if (!oddsAt || !predictionAt || Date.parse(oddsAt) > Date.parse(predictionAt) || !priceSource || t.originalOdds === null) exclusions.push('Attributable original pre-forecast odds are incomplete.');
    if (core && Date.parse(core.registeredAt) < Date.parse(core.candidate.registeredAt)) exclusions.push('Registration predates its claimed forecast.');
    if (t.settled && !t.previousEvidence.length) exclusions.push('No audited result receipt from the reviewed settlement workflow.');
    const method = str(probabilitySource.method), modelVersion = str(probabilitySource.modelVersion), source = str(probabilitySource.source), probabilityAt = str(probabilitySource.timestamp);
    const independent = research?.success ? ['deterministic_model', 'external_forecast'].includes(research.data.probability.origin ?? '') : !!method && !/\b(?:llm|chatgpt|gpt|language model)\b/i.test(`${method} ${source}`);
    const probabilistic = t.probability !== null && independent && !!method && !!modelVersion && !!source && !!probabilityAt && !!predictionAt && Date.parse(probabilityAt) <= Date.parse(predictionAt) && !!t.startsAt && Date.parse(probabilityAt) < Date.parse(t.startsAt);
    const final = t.previousEvidence.flatMap(v => v && typeof v === 'object' && 'observation' in v ? [v.observation] : []);
    const settledAt = core?.settledAt ?? history.paperResults.find(p => p.recordId === t.recordId)?.settledAt ?? null;
    const stake = t.stakeCents, odds = t.originalOdds;
    const profit = !t.settled || stake === null || odds === null ? null : t.currentOutcome === 'void' ? 0 : t.currentOutcome === 'lost' ? -stake : multiplyMoney(stake, t.stakeType === 'bonus' ? odds - 1 : odds) - (t.stakeType === 'bonus' ? 0 : stake);
    return { sourceClass: core?.candidate.oddsProvenance.simulated || archived?.snapshot.verification === 'synthetic' ? 'synthetic' as const : 'source_claim_not_independently_verified' as const, id: t.key, identityHash: t.identityHash, event: t.event, startsAt: t.startsAt, sport: t.sport,
      market: t.legs.length > 1 ? 'Parlay / SGM' : t.market, strategy: core?.candidate.strategy ?? archived?.snapshot.strategy ?? null,
      registeredAt: t.registeredAt, predictionAt, oddsAt, originalOdds: odds, probability: t.probability,
      modelVersion, methodology: method, inputCutoff: null, inputSources: source ? [source] : [],
      features: null, evidence: research?.success ? research.data.evidence : core?.candidate.oddsProvenance ?? null,
      outcome: t.currentOutcome, settledAt, hypotheticalStakeType: t.stakeType, hypotheticalStakeCents: stake, hypotheticalProfitCents: profit,
      eligible: exclusions.length === 0, exclusions, probabilisticScoringEligible: exclusions.length === 0 && probabilistic,
      finalObservations: final, clv: null };
  });
  rows.sort((a, b) => a.id.localeCompare(b.id));
  return { format: 'edgelab.paper-evaluation', version: 1, datasetHash: await sha256(JSON.stringify(rows)), containsSynthetic: rows.some(row => row.sourceClass === 'synthetic'), rows };
}
export function paperEvaluation(rows: LearningRow[]) {
  const eligible = rows.filter(r => r.eligible && (r.outcome === 'won' || r.outcome === 'lost'));
  const wins = eligible.filter(r => r.outcome === 'won').length, n = eligible.length;
  const hitRate = n ? wins / n : null;
  // Wilson 95% interval describes this observed sample; correlated bets reduce
  // effective sample size, so this interval is not evidence of a betting edge.
  const z = 1.96, denominator = 1 + z * z / (n || 1), centre = n ? (wins / n + z * z / (2 * n)) / denominator : null;
  const half = n ? z * Math.sqrt(hitRate! * (1 - hitRate!) / n + z * z / (4 * n * n)) / denominator : null;
  const scored = eligible.filter(r => r.probabilisticScoringEligible && r.probability !== null);
  const mean = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  const loss = (p: number, won: boolean) => -(won ? Math.log(p) : Math.log1p(-p));
  const losses = scored.map(r => loss(r.probability!, r.outcome === 'won'));
  const baseline = scored.filter(r => r.originalOdds !== null && r.originalOdds > 1);
  const buckets = Array.from({ length: 5 }, (_, index) => { const matches = scored.filter(r => Math.min(4, Math.floor(r.probability! * 5)) === index); return { lower: index / 5, upper: (index + 1) / 5, count: matches.length, meanForecast: mean(matches.map(r => r.probability!)), hitRate: mean(matches.map(r => Number(r.outcome === 'won'))) }; });
  const financial = eligible.filter(r => r.hypotheticalProfitCents !== null && r.hypotheticalStakeCents !== null);
  const profit = financial.reduce((n, r) => n + r.hypotheticalProfitCents!, 0), cash = financial.filter(r => r.hypotheticalStakeType === 'cash'), stake = cash.reduce((n, r) => n + r.hypotheticalStakeCents!, 0), cashProfit = cash.reduce((n, r) => n + r.hypotheticalProfitCents!, 0);
  const group = (field: 'sport' | 'market' | 'strategy' | 'modelVersion') => Object.fromEntries([...new Set(eligible.map(r => r[field] ?? 'Unknown'))].map(key => {
    const matches = eligible.filter(r => (r[field] ?? 'Unknown') === key);
    const forecasts = matches.filter(r => r.probabilisticScoringEligible && r.probability !== null);
    const losses = forecasts.map(r => loss(r.probability!, r.outcome === 'won'));
    return [key, { count: matches.length, wins: matches.filter(r => r.outcome === 'won').length,
      hypotheticalProfitCents: matches.reduce((n, r) => n + (r.hypotheticalProfitCents ?? 0), 0),
      scoredCount: forecasts.length, brier: mean(forecasts.map(r => (r.probability! - Number(r.outcome === 'won')) ** 2)),
      logLoss: losses.some(v => !Number.isFinite(v)) ? null : mean(losses), infiniteLogLossCount: losses.filter(v => !Number.isFinite(v)).length,
      bookmakerBrier: mean(forecasts.filter(r => r.originalOdds !== null).map(r => (1 / r.originalOdds! - Number(r.outcome === 'won')) ** 2)) }];
  }));
  return { settledCount: n, wins, losses: n - wins, hitRate, hitRateInterval: centre === null ? null : [Math.max(0, centre - half!), Math.min(1, centre + half!)], scoredCount: scored.length,
    brier: mean(scored.map(r => (r.probability! - Number(r.outcome === 'won')) ** 2)),
    logLoss: losses.some(v => !Number.isFinite(v)) ? null : mean(losses), infiniteLogLossCount: losses.filter(v => !Number.isFinite(v)).length,
    bookmakerBrier: mean(baseline.map(r => (1 / r.originalOdds! - Number(r.outcome === 'won')) ** 2)),
    bookmakerLogLoss: mean(baseline.map(r => loss(1 / r.originalOdds!, r.outcome === 'won'))),
    baselineCount: baseline.length, baselineType: 'Original implied break-even probability; not de-vigged',
    hypotheticalProfitCents: profit, hypotheticalCashProfitCents: cashProfit, hypotheticalBonusProfitCents: profit - cashProfit, hypotheticalRoi: stake ? cashProfit / stake : null,
    forecastErrors: scored.map(r => ({ id: r.id, modelVersion: r.modelVersion, probability: r.probability, outcome: r.outcome, residual: r.probability! - Number(r.outcome === 'won'), brier: (r.probability! - Number(r.outcome === 'won')) ** 2, logLoss: Number.isFinite(loss(r.probability!, r.outcome === 'won')) ? loss(r.probability!, r.outcome === 'won') : null, infiniteLogLoss: !Number.isFinite(loss(r.probability!, r.outcome === 'won')) })),
    calibration: buckets, bySport: group('sport'), byMarket: group('market'), byStrategy: group('strategy'), byModelVersion: group('modelVersion'),
    warning: n < 100 ? 'Insufficient sample for model improvement or an advantage claim. Correlated selections are not independent trials.' : 'Observed performance does not establish profitability or independent trials. Model validation remains separate.' };
}
