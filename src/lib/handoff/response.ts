import { researchResponseSchema, type ResearchCandidate, type ResearchResponse } from './contract';
import type { HistoricalRecord, ImportCommit, ImportDecision, ImportIssue, ImportPreview, VerificationStatus, HistoricalWorkspace, HistoricalSnapshot, ImportPreviewRow, ImportDuplicate } from '@/lib/imports/types';
import { parseHistoricalSource, prepareImportCommit, sha256, commitHistoricalImport, createHistoricalNotification, registerHistoricalPaper, validateHistoricalTransition } from '@/lib/imports';
export interface ResearchCandidateReview { id: string; rowNumber: number; candidate: ResearchCandidate; issues: ImportIssue[]; impliedProbability: number | null; calculatedEv: number | null; freshness: 'unknown' | 'fresh' | 'stale' | 'future'; }
export interface ResearchPreview { response: ResearchResponse; importPreview: ImportPreview; candidateReviews: ResearchCandidateReview[]; passReviews: { id: string; rowNumber: number; reason: string }[]; sessionFingerprint: string; }
export const melbourneDate = (date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Melbourne', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
const warning = (field: string, code: string, message: string): ImportIssue => ({ field, code, message, severity: 'warning' });
const error = (field: string, code: string, message: string): ImportIssue => ({ field, code, message, severity: 'error' });
/** Stage-only selections are review evidence, never registered predictions or financial records. */
export type PriorResearchSelection = Pick<HistoricalSnapshot, 'sport' | 'eventId' | 'event' | 'participant' | 'marketId' | 'market' | 'selection' | 'line' | 'bookmaker' | 'odds' | 'predictionAt' | 'sourceReference'> & { id?: string; ownerConfirmedPlaced?: boolean };
export interface ResearchSessionMetadata { responseId: string; createdAt: string | null; researchDay: number; researchDate: string; dayStatus: string; sessionFingerprint: string | null; }
export function researchSessionMetadata(record: HistoricalRecord): ResearchSessionMetadata | null {
  const value = record.transformations.find(change => change.rule === 'research_response_context_metadata')?.normalized;
  if (!value || typeof value !== 'object') return null;
  const meta = value as Record<string, unknown>;
  if (!Number.isSafeInteger(meta.researchDay) || Number(meta.researchDay) < 1 || typeof meta.researchDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(meta.researchDate) || !['draft','completed'].includes(String(meta.dayStatus)) || typeof meta.responseId !== 'string') return null;
  return { responseId: meta.responseId, createdAt: typeof meta.createdAt === 'string' ? meta.createdAt : null, researchDay: Number(meta.researchDay), researchDate: meta.researchDate, dayStatus: String(meta.dayStatus), sessionFingerprint: typeof meta.sessionFingerprint === 'string' ? meta.sessionFingerprint : null };
}
const canonicalValue = (value: unknown): unknown => Array.isArray(value) ? value.map(canonicalValue) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalValue((value as Record<string, unknown>)[key])])) : typeof value === 'string' ? value.normalize('NFKC').trim() : value;
const identityText = (value: string | null | undefined) => value?.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase() || null;
/** Reordering records or renaming response/row IDs is not a new research session. */
export function semanticResearchSession(response: ResearchResponse): string {
  const withoutId = (entry: { id: string }) => {
    const { id, ...content } = entry; void id;
    const facts: Record<string, unknown> = { ...content };
    if (Array.isArray(facts.legs)) facts.legs = facts.legs.map(leg => {
      const { id: legId, ...original } = leg; void legId; return original;
    }).sort((a, b) => JSON.stringify(canonicalValue(a)).localeCompare(JSON.stringify(canonicalValue(b))));
    return JSON.stringify(canonicalValue(facts));
  };
  return JSON.stringify(canonicalValue({ researchDate: response.researchDate, researchDay: response.researchDay, source: response.source, researchMethod: response.researchMethod, sourceUrls: [...response.sourceUrls].sort(), rulesSourceReference: response.rulesSourceReference, candidates: response.candidates.map(withoutId).sort(), passes: response.passes.map(withoutId).sort() }));
}
function findSessionMatch(responseId: string, fingerprint: string, existingRecords: HistoricalRecord[]): HistoricalRecord | undefined {
  return existingRecords.find(record => { const metadata = researchSessionMetadata(record); return metadata && (metadata.responseId === responseId || Boolean(fingerprint && metadata.sessionFingerprint === fingerprint)); });
}
function sameKnown(a: string | null, b: string | null): boolean { const left = identityText(a), right = identityText(b); return left !== null && right !== null && left === right; }
function knownIdentity(aId: string | null, bId: string | null, aText: string | null, bText: string | null): boolean { return aId && bId ? aId === bId : sameKnown(aText, bText); }
function rawOddsTime(record: HistoricalRecord | ImportPreviewRow): string | null { const raw = record.raw; return raw && typeof raw === 'object' && 'oddsTimestamp' in raw && typeof raw.oddsTimestamp === 'string' ? raw.oddsTimestamp : null; }
/** Strong duplicate identity needs explicit fixture/market/selection/line and quote times. Weak evidence stays probable. */
function selectionMatch(a: PriorResearchSelection, b: PriorResearchSelection, context: { unregistered: boolean; aOddsTime: string | null; bOddsTime: string | null }): ImportDuplicate['level'] | null {
  if (a.sport && b.sport && a.sport !== b.sport) return null;
  if (a.eventId && b.eventId && a.eventId !== b.eventId) return null;
  if (a.marketId && b.marketId && a.marketId !== b.marketId) return null;
  if (a.line != null && b.line != null && !sameKnown(a.line, b.line)) return null;
  const event = knownIdentity(a.eventId, b.eventId, a.event, b.event);
  const market = knownIdentity(a.marketId, b.marketId, a.market, b.market);
  const selection = sameKnown(a.selection, b.selection);
  if (event && market && selection) {
    const sameQuote = a.sport !== null && a.sport === b.sport && sameKnown(a.line, b.line) && sameKnown(a.bookmaker, b.bookmaker) && a.odds !== null && a.odds === b.odds && a.predictionAt !== null && a.predictionAt === b.predictionAt && context.aOddsTime !== null && context.aOddsTime === context.bOddsTime;
    return sameQuote && !context.unregistered ? 'exact' : 'probable';
  }
  if (!context.unregistered) return null;
  // A proposal with missing fixture identity cannot prove a duplicate, but must not disappear from review.
  const participant = identityText(a.participant), previousParticipant = identityText(b.participant), previousSelection = identityText(b.selection), currentSelection = identityText(a.selection);
  const namedOverlap = participant && (participant === previousParticipant || previousSelection?.includes(participant));
  const textualOverlap = currentSelection && previousSelection && (currentSelection === previousSelection || currentSelection.length >= 8 && previousSelection.includes(currentSelection));
  const conflictingKnownEvent = a.event && b.event && !event;
  const conflictingKnownMarket = a.market && b.market && !market && !identityText(a.market)?.includes(identityText(b.market)!) && !identityText(b.market)?.includes(identityText(a.market)!);
  return !conflictingKnownEvent && !conflictingKnownMarket && (namedOverlap || textualOverlap) ? 'probable' : null;
}
function applyResearchIdentityReview(rows: ImportPreviewRow[], responseId: string, fingerprint: string, existingRecords: HistoricalRecord[], previousProposals: PriorResearchSelection[], now: Date): void {
  const session = findSessionMatch(responseId, fingerprint, existingRecords);
  for (const row of rows) {
    const add = (recordId: string, level: ImportDuplicate['level'], reason: string) => {
      const previous = row.duplicates.find(item => item.recordId === recordId);
      if (previous?.level === 'exact' || previous?.level === level && previous.reason === reason) return;
      row.duplicates = row.duplicates.filter(item => item.recordId !== recordId);
      row.duplicates.push({ recordId, level, reason });
    };
    if (session) {
      add(session.id, 'exact', 'This research session is already registered: the response ID or source content matches. Renaming IDs is not a new session.');
      if (!row.issues.some(issue => issue.code === 'duplicate_research_session')) row.issues.push(error('id', 'duplicate_research_session', 'This research session already has registered source rows. Review the saved session instead of importing it again.'));
    }
    if (!row.snapshot.selection || row.snapshot.selection === 'Pass — no prediction registered') continue;
    const requireCurrentEvidence = () => {
      if (row.snapshot.kind !== 'paper') return;
      const raw = row.raw && typeof row.raw === 'object' ? row.raw as Partial<ResearchCandidate> : {};
      const quoteAge = raw.oddsTimestamp ? now.getTime() - Date.parse(raw.oddsTimestamp) : null;
      const complete = row.snapshot.sport && row.snapshot.event && row.snapshot.market && row.snapshot.selection && row.snapshot.line && row.snapshot.bookmaker && row.snapshot.odds !== null && row.snapshot.predictionAt && raw.startsAt && raw.oddsSource && quoteAge !== null && quoteAge >= -300000 && quoteAge <= 86400000 && raw.evidence?.length;
      if (!complete && !row.issues.some(issue => issue.code === 'proposal_requires_current_evidence')) row.issues.push(error('provenance', 'proposal_requires_current_evidence', 'An old proposal cannot supply missing current fixture, market, quote timestamp, attributable odds or supporting evidence. Obtain a fresh source-supported pre-event decision before paper registration, or retain this response as watch/pass.'));
    };
    for (const record of existingRecords) {
      const proposal = record.snapshot.kind !== 'paper';
      const level = selectionMatch(row.snapshot, record.snapshot, { unregistered: proposal, aOddsTime: rawOddsTime(row), bOddsTime: rawOddsTime(record) });
      if (level && record.snapshot.kind === null) requireCurrentEvidence();
      if (level) add(record.id, level, proposal ? 'Selection overlaps an unregistered prior proposal or actual-source archive. Review fixture, line and original quote before a separate paper decision; this research approval does not register an additional actual wager.' : level === 'exact' ? 'The exact selection, line, original odds and quote/prediction times are already registered, even though IDs differ.' : 'Selection overlaps an existing forecast; missing or changed prices/times require an explicit keep-separate decision, never an automatic merge.');
    }
    for (const earlier of rows.filter(other => other.rowNumber < row.rowNumber)) {
      const level = selectionMatch(row.snapshot, earlier.snapshot, { unregistered: earlier.snapshot.kind !== 'paper', aOddsTime: rawOddsTime(row), bOddsTime: rawOddsTime(earlier) });
      if (level) add(`row:${earlier.rowNumber}`, level, level === 'exact' ? 'This response repeats the same selection, price and quote/prediction times under a different row ID.' : 'This response repeats an overlapping selection/proposal; explicitly review it before retaining another row.');
    }
    for (const [index, proposal] of previousProposals.entries()) {
      const level = selectionMatch(row.snapshot, proposal, { unregistered: true, aOddsTime: rawOddsTime(row), bOddsTime: null });
      if (level) requireCurrentEvidence();
      if(level&&proposal.ownerConfirmedPlaced&&row.snapshot.kind==='paper'&&!row.issues.some(i=>i.code==='owner_placed_requires_distinct_paper_registration'))row.issues.push(error('decision','owner_placed_requires_distinct_paper_registration','This selection is linked to an owner-confirmed actual placement. A distinct original paper registration is not established; retain watch/pass or separately review source proof rather than double-counting it as an independent paper position.'));
      if (level) add(`proposal:${proposal.id ?? proposal.sourceReference ?? index}`, 'probable', proposal.ownerConfirmedPlaced?'Local continuity evidence links this selection to an owner-confirmed actual placement, not verified execution. Do not count the old proposal as an independent paper registration.':'Unverified local continuity evidence contains an overlapping unregistered proposal. It is not a prediction or placed wager; require fresh source-supported event/odds evidence and explicit review before paper registration.');
    }
  }
}

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
  const namedMulti = /\b(?:sgm|parlay|same.game multi)\b/i.test(candidate.market ?? '');
  if (namedMulti && !candidate.legs?.length) issues.push(error('legs', 'missing_multi_legs', 'A multi needs the exact individual source legs before paper registration; no legs are inferred from its description.'));
  if (namedMulti && (candidate.probability.value !== null || candidate.estimatedEv !== null)) issues.push(error('probability', 'unsupported_joint_probability', 'Combined probability unavailable — correlation not validated.'));
  if (candidate.legs) {
    if (new Set(candidate.legs.map(leg => leg.id)).size !== candidate.legs.length) issues.push(error('legs', 'duplicate_leg_ids', 'Each individual research leg needs a unique identity.'));
    for (const [index, leg] of candidate.legs.entries()) for (const field of ['sport', 'event', 'participant', 'market', 'selection', 'line'] as const) if (leg[field] === null) issues.push(error(`legs.${index}.${field}`, 'missing_leg_identity', 'Missing individual market identity prevents pre-event paper registration. Keep this proposal under review.'));
    if (candidate.legs.length > 1 && (candidate.probability.value !== null || candidate.estimatedEv !== null)) issues.push(error('probability', 'unsupported_joint_probability', 'Combined probability unavailable — correlation not validated. Preserve leg forecasts as source evidence; combined probability and EV must remain null.'));
  }
  const estimate = candidate.probability;
  if (estimate.value !== null) {
    if (estimate.origin === 'llm') issues.push(error('probability', 'llm_probability_forbidden', 'LLM-generated numerical betting probabilities cannot be registered. Supply a documented deterministic model or an attributable external forecast.'));
    if (!estimate.origin || estimate.origin === 'unknown' || !estimate.source || !estimate.method || !estimate.modelVersion || !estimate.timestamp || !candidate.predictionTimestamp) issues.push(error('probability', 'incomplete_probability_provenance', 'A numerical probability requires original source, numerical methodology, model version, forecast timestamp and a non-LLM origin.'));
    if ([estimate.source, estimate.method, estimate.modelVersion].some(value => value && /\b(?:chatgpt|llm|gpt(?:-?\d[a-z\d.-]*)?|claude|gemini|large language model|language model generated|gut feel|intuition)\b/i.test(value))) issues.push(error('probability.method', 'unsupported_probability_method', 'The stated method does not establish a reproducible numerical probability.'));
    if (estimate.timestamp && Date.parse(estimate.timestamp) > now.getTime() + 300000) issues.push(error('probability.timestamp', 'future_probability_timestamp', 'The probability source timestamp cannot be in the future relative to review time.'));
    if (candidate.predictionTimestamp && estimate.timestamp && Date.parse(estimate.timestamp) > Date.parse(candidate.predictionTimestamp)) issues.push(error('probability.timestamp', 'future_model_information', 'Model information cannot postdate the original forecast.'));
    if (!candidate.evidence.length || candidate.evidence.some(item => item.verification === 'unverified')) issues.push(warning('probability', 'unverified_model_claim', 'Methodology and origin labels are source claims, not independent verification. Review the numerical inputs and forecast independence before interpreting this probability.'));
  }
  const completeOddsProvenance = Boolean(candidate.bookmaker && candidate.oddsSource && candidate.oddsTimestamp);
  if (candidate.originalOdds !== null && !completeOddsProvenance) issues.push(warning('originalOdds', 'incomplete_odds_provenance', 'A supplied price needs its original bookmaker, attributable source and timestamp. Preserve the supplied value as an unverified claim; EV is unavailable until its provenance is complete.'));
  const impliedProbability = candidate.originalOdds === null ? null : 1 / candidate.originalOdds;
  const defensible = estimate.value !== null && estimate.origin !== 'llm' && !issues.some(issue => issue.severity === 'error' && issue.field.startsWith('probability'));
  const calculatedEv = defensible && completeOddsProvenance && candidate.originalOdds !== null ? estimate.value! * candidate.originalOdds - 1 : null;
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
export async function parseResearchResponse(input: { text: string; sourceName: string; verification: VerificationStatus; existingRecords?: HistoricalRecord[]; previousProposals?: PriorResearchSelection[]; now?: Date }): Promise<ResearchPreview> {
  if (new TextEncoder().encode(input.text).byteLength > 1048576) throw new Error('Research responses are limited to 1 MiB.');
  let decoded: unknown;
  try { decoded = JSON.parse(input.text.replace(/^\uFEFF/, '')); } catch { throw new Error('Malformed research JSON. Use the versioned EdgeLab research response template.'); }
  const parsed = researchResponseSchema.safeParse(decoded);
  if (!parsed.success) throw new Error('Research response schema validation failed: ' + parsed.error.issues.slice(0, 12).map(issue => `${issue.path.join('.') || 'response'}: ${issue.message}`).join('; '));
  const response = parsed.data;
  const now = input.now ?? new Date();
  const sessionFingerprint = await sha256(semanticResearchSession(response));
  const candidateReviews = response.candidates.map((candidate, index) => ({ ...reviewResearchCandidate(candidate, now), rowNumber: index + 1 }));
  const rows = response.candidates.map(candidate => ({
    externalId: `${response.id}:${candidate.id}`, eventId: candidate.eventId, marketId: candidate.marketId,
    kind: candidate.decision === 'pass' || candidate.decision === 'watch' ? null : 'paper', sport: candidate.sport,
    event: candidate.event, participant: candidate.participant, market: candidate.market, selection: candidate.selection, line: candidate.line,
    ...(candidate.legs ? { legs: candidate.legs.map(leg => ({ ...leg, outcome: 'pending', statistic: null })) } : {}),
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
    if (!response.createdAt) row.issues.push(warning('createdAt', 'missing_research_creation_time', 'Research creation time was not supplied. It remains unknown and is not substituted from the research date, event date or import time.'));
    else if (Date.parse(response.createdAt) > now.getTime() + 300000) row.issues.push(error('createdAt', 'future_research_creation_time', 'Research creation time cannot be in the future.'));
    if (!response.source || !response.researchMethod) row.issues.push(warning('researchMethod', 'missing_research_provenance', 'Source or research method was not supplied; claims remain unverified.'));
    if (response.researchDate !== melbourneDate(now)) row.issues.push(warning('researchDate', 'different_research_date', 'The declared Melbourne research date differs from today; confirm the intended day before registration.'));
    if (input.verification !== 'synthetic') row.issues.push(warning('verification', 'manual_source_verification', 'Approval is a user attestation. EdgeLab has not visited links, checked bookmaker prices or verified model claims.'));
    const metadata = { format: response.format, version: response.version, responseId: response.id, researchDay: response.researchDay, researchDate: response.researchDate, dayStatus: response.dayStatus, sourceRecordId: [...response.candidates, ...response.passes][row.rowNumber - 1].id, createdAt: response.createdAt ?? null, sessionFingerprint };
    row.transformations.push({ field: 'researchMetadata', original: null, normalized: metadata, rule: 'research_response_context_metadata' });
  }
  applyResearchIdentityReview(preview.rows, response.id, sessionFingerprint, input.existingRecords ?? [], input.previousProposals ?? [], now);
  return { response, importPreview: preview, candidateReviews, passReviews, sessionFingerprint };
}
export function prepareResearchCommit(preview: ResearchPreview, decisions: ImportDecision[], verification: VerificationStatus, existingRecords: HistoricalRecord[] = [], options: { confirmDayCompletion?: boolean; previousProposals?: PriorResearchSelection[]; now?: Date } = {}): ImportCommit {
  const confirmationTime = options.now ?? new Date();
  if (findSessionMatch(preview.response.id, preview.sessionFingerprint, existingRecords)) throw new Error('This research session is a duplicate of an already registered session. Do not change its IDs to register it again.');
  if (preview.response.createdAt && Date.parse(preview.response.createdAt) > confirmationTime.getTime() + 300000) throw new Error('Research creation time is in the future. Re-parse and review the source.');
  for (const decision of decisions.filter(decision => decision.include)) {
    const original = preview.candidateReviews.find(review => review.rowNumber === decision.rowNumber);
    if (!original) continue;
    const current = reviewResearchCandidate(original.candidate, confirmationTime);
    if (current.issues.some(issue => issue.severity === 'error') || current.issues.some(issue => !original.issues.some(old => old.code === issue.code && old.field === issue.field))) throw new Error('Research data changed or became stale after preview. Re-parse and review the current source before confirmation.');
  }
  const reviewed = structuredClone(preview.importPreview);
  applyResearchIdentityReview(reviewed.rows, preview.response.id, preview.sessionFingerprint, existingRecords, options.previousProposals ?? [], confirmationTime);
  for (const decision of decisions.filter(item => item.include)) {
    const row = reviewed.rows.find(item => item.rowNumber === decision.rowNumber);
    if (row?.duplicates.some(item => item.level === 'exact')) throw new Error('This research selection is an exact duplicate of an existing forecast.');
    if (row?.duplicates.some(item => item.level === 'probable') && !decision.allowProbableDuplicate) throw new Error('This selection overlaps an earlier forecast or unregistered proposal. Review the probable duplicate explicitly before registration.');
  }
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
export function commitApprovedResearch(workspace: HistoricalWorkspace, preview: ResearchPreview, decisions: ImportDecision[], verification: VerificationStatus, options: { confirmDayCompletion?: boolean; previousProposals?: PriorResearchSelection[]; now?: Date } = {}): HistoricalWorkspace {
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
