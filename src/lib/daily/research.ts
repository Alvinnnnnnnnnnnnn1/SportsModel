import { z } from 'zod';
import type { AppData } from '@/lib/domain/types';
import type { HistoricalRecord, HistoricalWorkspace, ImportPreview } from '@/lib/imports/types';
import { parseHistoricalSource } from '@/lib/imports';
import { researchCandidateSchema, type ResearchCandidate } from '@/lib/handoff/contract';
import { researchSessionMetadata, reviewResearchCandidate } from '@/lib/handoff/response';
import { readResearchRecordLink, type ResearchPlacement } from './placement';

export function sourceResearchCandidate(record: HistoricalRecord): ResearchCandidate | null {
  if (!researchSessionMetadata(record)) return null;
  const parsed = researchCandidateSchema.safeParse(record.raw);
  return parsed.success ? parsed.data : null;
}

export const dailyDecisionSchema = z.object({
  format: z.literal('edgelab.daily-decision'), version: z.literal(1),
  recordId: z.string().uuid(), decision: z.enum(['watch', 'pass']),
  reason: z.string().trim().min(1).max(1500), recordedAt: z.string().datetime({ offset: true }),
}).strict();

/** Decisions are new owner journals, never rewrites of the imported classification. */
export async function prepareDailyDecisionPreview(record: HistoricalRecord, decision: 'watch' | 'pass', reason: string): Promise<ImportPreview> {
  if (!sourceResearchCandidate(record)) throw new Error('Open an imported research candidate before recording a daily decision.');
  const journal = dailyDecisionSchema.parse({ format: 'edgelab.daily-decision', version: 1, recordId: record.id, decision, reason, recordedAt: new Date().toISOString() });
  return parseHistoricalSource({ text: JSON.stringify([{ externalId: `daily-decision:${crypto.randomUUID()}`, kind: null, event: record.snapshot.event, participant: record.snapshot.participant, sourceReference: `edgelab:daily-decision:${record.id}`, notes: `${decision.toUpperCase()}: ${journal.reason}. Original research and any positions are unchanged.`, verification: record.snapshot.verification, sourceDocument: journal }]), sourceName: 'daily-research-decision.json', format: 'manual', verification: record.snapshot.verification });
}

export function latestDailyDecision(history: HistoricalWorkspace, recordId: string) {
  for (const record of [...history.records].reverse()) {
    const raw = record.raw && typeof record.raw === 'object' ? record.raw as { sourceDocument?: unknown } : {};
    const parsed = dailyDecisionSchema.safeParse(raw.sourceDocument);
    if (parsed.success && parsed.data.recordId === recordId) return parsed.data;
  }
  return null;
}

export function researchActualLink(data: AppData, recordId: string) {
  return data.bets.find(bet => readResearchRecordLink(bet.notes) === recordId);
}

export function researchPaperBlockers(record: HistoricalRecord, history: HistoricalWorkspace, data: AppData, now = new Date()): string[] {
  const candidate = sourceResearchCandidate(record);
  if (!candidate) return ['This source is not a supported imported research selection.'];
  if (history.paperResults.some(result => result.recordId === record.id)) return ['This source already has a paper tracking position.'];
  if (researchActualLink(data, record.id)) return ['An actual placement is already linked. A later paper approval cannot become a second independent forecast.'];
  if (record.snapshot.kind === 'actual') return ['Actual claims cannot be converted into paper positions.'];
  const review = reviewResearchCandidate({ ...candidate, decision: 'paper' }, now);
  const required = ['sport', 'event', 'startsAt', 'participant', 'market', 'selection', 'line', 'bookmaker', 'originalOdds', 'oddsTimestamp', 'oddsSource', 'predictionTimestamp', 'strategy', 'hypotheticalStakeCents', 'hypotheticalStakeType'] as const;
  return [...required.filter(field => candidate[field] === null).map(field => `${field}: original source fact is required for prospective paper registration; keep the incomplete proposal in review.`), ...review.issues.filter(issue => issue.severity === 'error').map(issue => `${issue.field}: ${issue.message}`)];
}

/** Existing original fields prefill the existing form; accepted price/time remain separate. */
export function researchPlacement(record: HistoricalRecord): ResearchPlacement {
  const candidate = sourceResearchCandidate(record);
  if (!candidate) throw new Error('This research source cannot prefill a placed wager.');
  return {
    recordId: record.id, sourceReference: record.snapshot.sourceReference ?? `edgelab:research-record:${record.id}`,
    quoteOdds: candidate.originalOdds, quoteTimestamp: candidate.oddsTimestamp,
    bookmaker: candidate.bookmaker, strategy: candidate.strategy, legs: structuredClone(record.snapshot.legs),
    ...(candidate.probability.value === null || !candidate.probability.source || !candidate.probability.method || !candidate.probability.modelVersion || !candidate.probability.timestamp || candidate.probability.origin === 'llm' || candidate.probability.origin === 'unknown' || candidate.probability.origin === null ? {} : { probability: candidate.probability.value, probabilityProvenance: { source: candidate.probability.source, method: candidate.probability.method, modelVersion: candidate.probability.modelVersion, timestamp: candidate.probability.timestamp, simulated: record.snapshot.verification === 'synthetic' } }),
  };
}

export function originalResearchLabels(candidate: ResearchCandidate) {
  const classification = candidate.evidence.map(item => item.claim).find(text => /^original (?:strategy|classification|track)\s*:/i.test(text)) ?? null;
  const decision = candidate.evidence.map(item => item.claim).find(text => /^original decision\s*:/i.test(text)) ?? (candidate.decision === 'pass' ? 'PASS' : candidate.decision === 'watch' ? 'CONDITIONAL / watch' : candidate.proposedStatus === 'actual_requires_manual_confirmation' ? 'BET proposal — not a placement' : 'PAPER-TRACK proposal');
  return { classification, decision };
}
