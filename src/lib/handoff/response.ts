import { researchResponseSchema, type ResearchCandidate, type ResearchResponse } from './contract';
import type { HistoricalRecord, ImportCommit, ImportDecision, ImportIssue, ImportPreview, VerificationStatus, HistoricalWorkspace } from '@/lib/imports/types';
import { parseHistoricalSource, prepareImportCommit, sha256, commitHistoricalImport, createHistoricalNotification, registerHistoricalPaper, validateHistoricalTransition } from '@/lib/imports';
export interface ResearchCandidateReview { id: string; rowNumber: number; candidate: ResearchCandidate; issues: ImportIssue[]; impliedProbability: number | null; calculatedEv: number | null; freshness: 'unknown' | 'fresh' | 'stale' | 'future'; }
export interface ResearchPreview { response: ResearchResponse; importPreview: ImportPreview; candidateReviews: ResearchCandidateReview[]; passReviews: { id: string; rowNumber: number; reason: string }[]; }
export const melbourneDate = (date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Melbourne', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
const warning = (field: string, code: string, message: string): ImportIssue => ({ field, code, message, severity: 'warning' });
const error = (field: string, code: string, message: string): ImportIssue => ({ field, code, message, severity: 'error' });
export function reviewResearchCandidate(candidate: ResearchCandidate, now = new Date()): Omit<ResearchCandidateReview, 'rowNumber'> {
  const issues: ImportIssue[] = [];
  for (const field of ['sport', 'event', 'startsAt', 'participant', 'market', 'selection', 'line', 'bookmaker', 'originalOdds', 'oddsTimestamp', 'oddsSource', 'predictionTimestamp', 'strategy'] as const) if (candidate[field] === null) issues.push(warning(field, 'missing_research_fact', 'Missing source information remains null; no available bookmaker price or prediction fact is inferred.'));
  if (candidate.oddsTimestamp && candidate.predictionTimestamp && Date.parse(candidate.oddsTimestamp) > Date.parse(candidate.predictionTimestamp)) issues.push(error('oddsTimestamp', 'odds_postdate_prediction', 'Source odds cannot postdate the original prediction. Record a new source-supported decision timestamp instead of attaching a later price retrospectively.'));
  for (const [index, item] of candidate.evidence.entries()) {
    if (item.observedAt === null) issues.push(warning(`evidence.${index}.observedAt`, 'unknown_evidence_time', 'Evidence timing is unknown; it cannot be assumed to predate the forecast.'));
    if (item.observedAt && Date.parse(item.observedAt) > now.getTime() + 300000) issues.push(error(`evidence.${index}.observedAt`, 'future_evidence', 'Evidence cannot be dated in the future.'));
    if (item.observedAt && candidate.predictionTimestamp && Date.parse(item.observedAt) > Date.parse(candidate.predictionTimestamp)) issues.push(error(`evidence.${index}.observedAt`, 'evidence_postdates_prediction', 'Evidence observed after the original forecast cannot support that registered prediction.'));
  }
  if (!candidate.evidence.length) issues.push(warning('evidence', 'missing_evidence', 'No supporting evidence was supplied; this is an unverifiable research claim.'));
  if (!candidate.sourceUrls.length && !candidate.oddsSourceUrl && !candidate.evidence.some(item => item.sourceUrl)) issues.push(warning('sourceUrls', 'unverifiable_sources', 'No source URLs were provided. A source label does not establish independent verification.'));
  if (candidate.evidence.some(item => item.verification === 'unverified' || !item.sourceUrl)) issues.push(warning('evidence', 'unverified_evidence', 'Some supporting evidence is explicitly unverified or has no source link.'));
  if (!candidate.uncertainty) issues.push(warning('uncertainty', 'missing_uncertainty', 'Limitations/uncertainty were not documented.'));
  const estimate = candidate.probability;
  if (estimate.value !== null) {
    if (estimate.origin === 'llm') issues.push(error('probability', 'llm_probability_forbidden', 'LLM-generated numerical betting probabilities cannot be registered. Supply a documented deterministic model or an attributable external forecast.'));
    if (!estimate.origin || estimate.origin === 'unknown' || !estimate.source || !estimate.method || !estimate.modelVersion || !estimate.timestamp || !candidate.predictionTimestamp) issues.push(error('probability', 'incomplete_probability_provenance', 'A numerical probability requires original source, numerical methodology, model version, forecast timestamp and a non-LLM origin.'));
    if (estimate.method && /\b(?:chatgpt|llm|large language model|language model generated|gut feel|intuition)\b/i.test(estimate.method)) issues.push(error('probability.method', 'unsupported_probability_method', 'The stated method does not establish a reproducible numerical probability.'));
    if (candidate.predictionTimestamp && estimate.timestamp && Date.parse(estimate.timestamp) > Date.parse(candidate.predictionTimestamp)) issues.push(error('probability.timestamp', 'future_model_information', 'Model information cannot postdate the original forecast.'));
    if (!candidate.evidence.length) issues.push(warning('probability', 'unverified_model_claim', 'Methodology text is retained as a source claim; no numerical model or source has been independently verified.'));
  }
  const impliedProbability = candidate.originalOdds === null ? null : 1 / candidate.originalOdds;
  const defensible = estimate.value !== null && estimate.origin !== 'llm' && !issues.some(issue => issue.severity === 'error' && issue.field.startsWith('probability'));
  const calculatedEv = defensible && candidate.originalOdds !== null ? estimate.value! * candidate.originalOdds - 1 : null;
  if (candidate.estimatedEv !== null && (calculatedEv === null || Math.abs(candidate.estimatedEv - calculatedEv) > 0.000001)) issues.push(error('estimatedEv', 'inconsistent_ev', 'Reported EV cannot be reconciled with source odds and a supported numerical probability. EV must be null when those inputs are unavailable.'));
  let freshness: ResearchCandidateReview['freshness'] = 'unknown';
  if (candidate.oddsTimestamp) {
    const age = now.getTime() - Date.parse(candidate.oddsTimestamp);
    freshness = age < -300000 ? 'future' : age > 86400000 ? 'stale' : 'fresh';
    if (freshness === 'future') issues.push(error('oddsTimestamp', 'future_odds', 'Odds are dated in the future relative to review time.'));
    if (freshness === 'stale') issues.push(warning('oddsTimestamp', 'stale_odds', 'Source odds are older than 24 hours. This is a review threshold, not proof that a price remains available.'));
  }
  if (candidate.predictionTimestamp && Date.parse(candidate.predictionTimestamp) > now.getTime() + 300000) issues.push(error('predictionTimestamp', 'future_prediction', 'The original prediction timestamp cannot be in the future.'));
  if (candidate.startsAt && candidate.predictionTimestamp && Date.parse(candidate.predictionTimestamp) >= Date.parse(candidate.startsAt)) issues.push(error('predictionTimestamp', 'retrospective_prediction', 'The forecast is dated at or after event start. Use historical review rather than registering it as a new prediction.'));
  if (candidate.startsAt && Date.parse(candidate.startsAt) <= now.getTime()) issues.push(error('startsAt', 'event_already_started', 'The event has already started. The daily workflow cannot register this as a new pre-event forecast.'));
  if (candidate.decision === 'pass' && !candidate.passReasons.length) issues.push(error('passReasons', 'missing_pass_reason', 'Explain why this opportunity was passed.'));
  if (candidate.decision !== 'pass' && candidate.passReasons.length) issues.push(warning('decision', 'mixed_decision', 'A proposed paper/watch entry also contains reasons for passing. Review the decision explicitly.'));
  if (candidate.proposedStatus === 'actual_requires_manual_confirmation') issues.push(warning('proposedStatus', 'actual_confirmation_required', 'Research approval creates paper tracking only. An actual bet must be recorded separately after manual confirmation; no wager is submitted.'));
  return { id: candidate.id, candidate, issues, impliedProbability, calculatedEv, freshness };
}
/** Bounded parsing. Raw candidate objects and the exact full response remain immutable source evidence. */
export async function parseResearchResponse(input: { text: string; sourceName: string; verification: VerificationStatus; existingRecords?: HistoricalRecord[]; now?: Date }): Promise<ResearchPreview> {
  if (new TextEncoder().encode(input.text).byteLength > 1048576) throw new Error('Research responses are limited to 1 MiB.');
  let decoded: unknown;
  try { decoded = JSON.parse(input.text.replace(/^\uFEFF/, '')); } catch { throw new Error('Malformed research JSON. Use the versioned EdgeLab research response template.'); }
  const parsed = researchResponseSchema.safeParse(decoded);
  if (!parsed.success) throw new Error('Research response schema validation failed: ' + parsed.error.issues.slice(0, 12).map(issue => `${issue.path.join('.') || 'response'}: ${issue.message}`).join('; '));
  const response = parsed.data;
  const now = input.now ?? new Date();
  const candidateReviews = response.candidates.map((candidate, index) => ({ ...reviewResearchCandidate(candidate, now), rowNumber: index + 1 }));
  const rows = response.candidates.map(candidate => ({
    externalId: `${response.id}:${candidate.id}`, eventId: candidate.eventId, marketId: candidate.marketId,
    kind: candidate.decision === 'pass' || candidate.decision === 'watch' ? null : 'paper', sport: candidate.sport,
    event: candidate.event, participant: candidate.participant, market: candidate.market, selection: candidate.selection, line: candidate.line,
    bookmaker: candidate.bookmaker, odds: candidate.originalOdds, predictionAt: candidate.predictionTimestamp,
    probability: candidate.probability.value, probabilitySource: candidate.probability.source, probabilityMethod: candidate.probability.method, modelVersion: candidate.probability.modelVersion,
    strategy: candidate.strategy, sourceReference: `edgelab:research-response:${response.id}:${candidate.id}`,
    stakeCents: candidate.hypotheticalStakeCents, stakeType: candidate.hypotheticalStakeType,
    outcome: candidate.decision === 'paper' ? 'pending' : null, verification: input.verification,
    notes: `Research Day ${response.researchDay} · ${response.researchDate}. ${candidate.rationale ?? 'Rationale not provided.'} Full evidence, original odds timestamp, confidence and source claims remain in the immutable original research response.`,
  }));
  const passReviews = response.passes.map((pass, index) => ({ id: pass.id, rowNumber: response.candidates.length + index + 1, reason: pass.reason }));
  const mapped = [...rows, ...response.passes.map(pass => ({ externalId: `${response.id}:${pass.id}`, kind: null, sport: pass.sport, event: pass.event, selection: 'Pass — no prediction registered', sourceReference: `edgelab:research-response:${response.id}:${pass.id}`, notes: pass.reason, verification: input.verification }))];
  // Existing parser applies UTF-8/control/credential guards to the complete decoded response too.
  await parseHistoricalSource({ text: JSON.stringify([{ sourceReference: 'research-response-safety-scan', notes: response }]), sourceName: input.sourceName, format: 'json', verification: input.verification });
  const preview = await parseHistoricalSource({ text: JSON.stringify(mapped), sourceName: input.sourceName, format: 'json', verification: input.verification, existingRecords: input.existingRecords });
  preview.rawSource = input.text; preview.sourceHash = await sha256(input.text);
  const original = decoded as { candidates: unknown[]; passes: unknown[] };
  const allRaw = [...original.candidates, ...original.passes];
  for (const row of preview.rows) {
    row.raw = structuredClone(allRaw[row.rowNumber - 1]);
    row.transformations.unshift({ field: 'record', original: structuredClone(row.raw), normalized: structuredClone(row.snapshot), rule: 'research_response_v1_to_nullable_historical_snapshot' });
    const candidateReview = candidateReviews.find(review => review.rowNumber === row.rowNumber);
    if (candidateReview) row.issues.push(...candidateReview.issues);
    if (!response.source || !response.researchMethod) row.issues.push(warning('researchMethod', 'missing_research_provenance', 'Source or research method was not supplied; claims remain unverified.'));
    if (response.researchDate !== melbourneDate(now)) row.issues.push(warning('researchDate', 'different_research_date', 'The declared Melbourne research date differs from today; confirm the intended day before registration.'));
    if (input.verification !== 'synthetic') row.issues.push(warning('verification', 'manual_source_verification', 'Approval is a user attestation. EdgeLab has not visited links, checked bookmaker prices or verified model claims.'));
    const metadata = { format: response.format, version: response.version, responseId: response.id, researchDay: response.researchDay, researchDate: response.researchDate, dayStatus: response.dayStatus, sourceRecordId: [...response.candidates, ...response.passes][row.rowNumber - 1].id };
    row.transformations.push({ field: 'researchMetadata', original: null, normalized: metadata, rule: 'research_response_context_metadata' });
  }
  return { response, importPreview: preview, candidateReviews, passReviews };
}
export function prepareResearchCommit(preview: ResearchPreview, decisions: ImportDecision[], verification: VerificationStatus, existingRecords: HistoricalRecord[] = [], options: { confirmDayCompletion?: boolean; now?: Date } = {}): ImportCommit {
  const confirmationTime = options.now ?? new Date();
  for (const decision of decisions.filter(decision => decision.include)) {
    const original = preview.candidateReviews.find(review => review.rowNumber === decision.rowNumber);
    if (!original) continue;
    const current = reviewResearchCandidate(original.candidate, confirmationTime);
    if (current.issues.some(issue => issue.severity === 'error') || current.issues.some(issue => !original.issues.some(old => old.code === issue.code && old.field === issue.field))) throw new Error('Research data changed or became stale after preview. Re-parse and review the current source before confirmation.');
  }
  const reviewed = structuredClone(preview.importPreview);
  if (options.confirmDayCompletion) {
    if (preview.response.dayStatus !== 'completed') throw new Error('Only a source explicitly marked completed can be confirmed as a completed research day.');
    for (const row of reviewed.rows) row.transformations.push({ field: 'researchDay', original: null, normalized: preview.response.researchDay, rule: 'owner_confirmed_day_completion' });
  }
  return prepareImportCommit(reviewed, decisions, verification, existingRecords);
}
export function researchMetadata(record: HistoricalRecord): { researchDay: number; researchDate: string; dayStatus: string } | null {
  const value = record.transformations.find(change => change.rule === 'research_response_context_metadata')?.normalized;
  if (!value || typeof value !== 'object') return null;
  const meta = value as Record<string, unknown>;
  return Number.isSafeInteger(meta.researchDay) && typeof meta.researchDate === 'string' && typeof meta.dayStatus === 'string' ? { researchDay: Number(meta.researchDay), researchDate: meta.researchDate, dayStatus: meta.dayStatus } : null;
}

/** One atomic historical save: reviewed records, initial paper state and in-app alerts. */
export function commitApprovedResearch(workspace: HistoricalWorkspace, preview: ResearchPreview, decisions: ImportDecision[], verification: VerificationStatus, options: { confirmDayCompletion?: boolean; now?: Date } = {}): HistoricalWorkspace {
  const commit = prepareResearchCommit(preview, decisions, verification, workspace.records, options);
  let next = commitHistoricalImport(workspace, commit);
  for (const record of commit.records.filter(record => record.snapshot.kind === 'paper')) {
    next = registerHistoricalPaper(next, record.id);
    next = createHistoricalNotification(next, record.id);
  }
  next = { ...next, revision: workspace.revision + 1 };
  validateHistoricalTransition(workspace, next);
  return next;
}
