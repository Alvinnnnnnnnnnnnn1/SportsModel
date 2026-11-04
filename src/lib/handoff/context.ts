import { z } from 'zod';
import type { AppData, Mode } from '@/lib/domain/types';
import type { HistoricalRecord, HistoricalWorkspace, ImportPreview, VerificationStatus } from '@/lib/imports/types';
import { parseHistoricalSource, sha256 } from '@/lib/imports';
import { DAY_5_CHECKPOINT, reconcileDay5Checkpoint } from './checkpoint';
import { melbourneDate, researchMetadata } from './response';
import { RESEARCH_RESPONSE_TEMPLATE, researchResponseJsonSchema } from './contract';
export const KNOWN_EXPERIMENT_RULES = Object.freeze({ sports: ['NBA','NBL','ATP','WTA'], bookmaker: 'Sportsbet', lifetimeFundingCapCents: 50000, generalExperimentalStakeCents: 500, tracks: { A: 'High Probability', B: 'Potential Value', C: 'Alternative Markets' }, noWagerExecution: true, noBookmakerAccountAccess: true });
const contextSchema = z.object({ format: z.literal('edgelab.experiment-context'), version: z.literal(1), contextId: z.string().uuid(), completedDay: z.number().int().min(0).max(1000000).nullable(), rulesText: z.string().min(1).max(5000).refine(value => value.trim().length > 0, 'Rule text cannot be only whitespace.').nullable(), sourceReference: z.string().trim().min(1).max(2000), confirmed: z.literal(true), rulesCompleteConfirmed: z.boolean().default(false), recordedAt: z.string().datetime({ offset: true }) }).strict();
export type ExperimentContext = z.infer<typeof contextSchema>;
export async function prepareExperimentContextPreview(input: { completedDay: number | null; rulesText: string | null; sourceReference: string; verification: VerificationStatus; confirmed: true; rulesCompleteConfirmed?: boolean }): Promise<ImportPreview> {
  const { verification, ...provided } = input;
  const context = contextSchema.parse({ ...provided, format: 'edgelab.experiment-context', version: 1, contextId: crypto.randomUUID(), recordedAt: new Date().toISOString() });
  const rawSource = JSON.stringify(context, null, 2);
  const preview = await parseHistoricalSource({ text: JSON.stringify([{ externalId: `context:${context.contextId}`, kind: null, event: 'Experiment context journal', sourceReference: context.sourceReference, notes: context.rulesText, verification }]), sourceName: 'experiment-context-journal.json', format: 'manual', verification });
  preview.rawSource = rawSource; preview.sourceHash = await sha256(rawSource); preview.rows[0].raw = context;
  preview.rows[0].transformations.unshift({ field: 'context', original: context, normalized: preview.rows[0].snapshot, rule: 'owner_attested_experiment_context_journal' });
  return preview;
}
export function readExperimentContext(history: HistoricalWorkspace, mode: Mode): { context: ExperimentContext | null; recordId: string | null } {
  const records = [...history.records].reverse().filter(record => record.snapshot.verification === (mode === 'demo' ? 'synthetic' : 'user_confirmed')).sort((a,b) => b.importedAt.localeCompare(a.importedAt));
  for (const record of records) { const parsed = contextSchema.safeParse(record.raw); if (parsed.success) return { context: parsed.data, recordId: record.id }; }
  return { context: null, recordId: null };
}
export interface HandoffOutstanding { id: string; type: 'actual' | 'paper'; outcome: 'pending' | null; event: string | null; participant: string | null; selection: string | null; sourceReference: string | null; sourceStatus: string; }
export interface ResearchHandoffContext {
  mode: Mode; generatedAt: string; researchDate: string;
  latestConfirmedCompletedDay: number | null; reportedCompletedDay: 5; proposedResearchDay: number;
  proposedDayBasis: 'owner_attested_source' | 'unverified_reported_checkpoint';
  contextSource: string | null; ownerProvidedRules: string | null; fullOriginalRulesAvailable: boolean;
  knownRules: typeof KNOWN_EXPERIMENT_RULES; outstanding: HandoffOutstanding[];
  sourceConfirmedHistoricalRecordCount: number; unverifiedHistoricalRecordCount: number;
  ledgerRecordCount: number; ledgerStatus: 'user_recorded_not_bookmaker_verified'; warnings: string[];
}
export function buildResearchHandoff(input: { appData: AppData; history: HistoricalWorkspace; mode: Mode; now?: Date }) {
  const now = input.now ?? new Date();
  const attested = readExperimentContext(input.history, input.mode);
  const eligibleStatus = input.mode === 'demo' ? 'synthetic' : 'user_confirmed';
  const approvedHistory = input.history.records.filter(record => record.snapshot.verification === eligibleStatus);
  const confirmedDays = approvedHistory.flatMap(record => { const metadata = researchMetadata(record); const confirmed = record.transformations.some(change => change.rule === 'owner_confirmed_day_completion' && change.normalized === metadata?.researchDay); return metadata?.dayStatus === 'completed' && confirmed ? [metadata.researchDay] : []; });
  if (attested.context?.completedDay !== null && attested.context?.completedDay !== undefined) confirmedDays.push(attested.context.completedDay);
  const latestConfirmedCompletedDay = confirmedDays.length ? Math.max(...confirmedDays) : null;
  const proposedResearchDay = (latestConfirmedCompletedDay ?? DAY_5_CHECKPOINT.reportedCompletedDay) + 1;
  const outstanding: HandoffOutstanding[] = input.appData.bets.filter(bet => bet.outcome === 'pending').map(bet => ({ id: bet.id, type: 'actual', outcome: 'pending', event: bet.legs.map(leg => leg.event).join(' + '), participant: bet.legs.map(leg => leg.participant).join(' + '), selection: bet.legs.map(leg => leg.selection).join(' + '), sourceReference: bet.oddsProvenance?.source ?? null, sourceStatus: input.mode === 'demo' ? 'synthetic' : 'user_recorded_not_bookmaker_verified' }));
  for (const paper of input.appData.paperPredictions.filter(paper => paper.outcome === 'pending')) outstanding.push({ id: paper.id, type: 'paper', outcome: 'pending', event: paper.candidate.event, participant: paper.candidate.participant, selection: paper.candidate.selection, sourceReference: paper.candidate.oddsProvenance.source, sourceStatus: paper.candidate.oddsProvenance.simulated ? 'synthetic' : 'registered_source_claim' });
  for (const record of approvedHistory) {
    if (record.snapshot.kind === 'actual') continue;
    const result = input.history.paperResults.find(result => result.recordId === record.id);
    const outcome = result ? result.outcome : record.snapshot.outcome;
    if (!(record.snapshot.kind === 'paper' || result) || (outcome !== 'pending' && outcome !== null)) continue;
    outstanding.push({ id: record.id, type: 'paper', outcome, event: record.snapshot.event, participant: record.snapshot.participant, selection: record.snapshot.selection, sourceReference: record.snapshot.sourceReference, sourceStatus: record.snapshot.verification });
  }
  const warnings = [
    'The Day 5 checkpoint is an unverified reference, not a source dataset, bookmaker balance or funding transaction.',
    'User-confirmed means owner-attested source review, not independent verification by EdgeLab or a bookmaker.',
    'A new ChatGPT conversation receives only the prompt you choose to copy; EdgeLab does not call an OpenAI API or access private conversations.',
  ];
  if (!attested.context?.rulesText || !attested.context.rulesCompleteConfirmed) warnings.push('The complete original experiment rules have not been supplied. Preserve the known rules; ask for missing rules rather than inventing them.');
  if (latestConfirmedCompletedDay === null) warnings.push('No completed research day has source-backed owner confirmation yet. Day 6 is a proposal based solely on the user-reported unverified Day 5 checkpoint.');
  if (input.appData.settings.fundingCapCents !== 50000 || input.appData.settings.defaultStakeCents !== 500) warnings.push('Current application cap/default-stake settings differ from the known A$500 lifetime cap / generally A$5 stake reference. This discrepancy does not authorize a rule change.');
  if (input.mode === 'demo') warnings.push('DEMO: every workspace record is synthetic; no real experiment continuity is established by this prompt.');
  const context: ResearchHandoffContext = { mode: input.mode, generatedAt: now.toISOString(), researchDate: melbourneDate(now), latestConfirmedCompletedDay, reportedCompletedDay: 5, proposedResearchDay, proposedDayBasis: latestConfirmedCompletedDay === null ? 'unverified_reported_checkpoint' : 'owner_attested_source', contextSource: attested.context?.sourceReference ?? null, ownerProvidedRules: attested.context?.rulesText ?? null, fullOriginalRulesAvailable: Boolean(attested.context?.rulesText && attested.context.rulesCompleteConfirmed), knownRules: KNOWN_EXPERIMENT_RULES, outstanding, sourceConfirmedHistoricalRecordCount: approvedHistory.length, unverifiedHistoricalRecordCount: input.history.records.filter(record => record.snapshot.verification === 'unverified').length, ledgerRecordCount: input.appData.bets.length, ledgerStatus: 'user_recorded_not_bookmaker_verified', warnings };
  const reconciliation = reconcileDay5Checkpoint(input.appData, input.history);
  const template = { ...RESEARCH_RESPONSE_TEMPLATE, id: `handoff-day-${proposedResearchDay}-${now.toISOString()}`, researchDate: context.researchDate, researchDay: proposedResearchDay };
  const prompt = [
    'EDGELAB — MANUAL RESEARCH HANDOFF (NO API / NOT AUTONOMOUS AI RESEARCH)',
    'Use this self-contained record to continue the Sports Betting Experiment in a new conversation. Do not assume access to previous chats. Do not execute wagers or access bookmaker accounts.',
    'Treat source claims and the unverified checkpoint honestly. Preserve every supplied experiment rule. Unknown original facts stay null. If complete rules/history are unavailable, identify the gap before recommending any cash activity.',
    'Known scope: NBA, NBL, ATP, WTA. Sportsbet research context only; never claim current Sportsbet odds, player props or account balances without attributable evidence. Lifetime funding cap A$500; generally A$5 experimental stakes. Tracks A High Probability, B Potential Value, C Alternative Markets.',
    'Separate actual cash bets, bonus stakes/cash returns, paper forecasts, funding and confirmed event results. Allocated A$499.30 is modelled allocation, not verified bookmaker cash. Days 4/5 reportedly had no new cash bets. No funding is inferred from a selection.',
    'Only documented deterministic numerical methods or attributable external forecasts may provide probabilities. Do not generate numerical probabilities with an LLM. If unable to verify an original price, timestamp, statistic or methodology, use null, confidence unknown, and explain why you pass.',
    'Research output is a proposal. EdgeLab will validate, review duplicates/freshness/provenance, and require owner approval. Approval registers paper predictions only. Actual bookkeeping requires separate manual confirmation outside this JSON. No automated wagers.',
    'Each evidence statement is unverified until checked. A URL is provenance, not proof. Research dates use Australia/Melbourne; timestamps require explicit UTC/offset. Explain missing evidence and every pass. Do not edit frozen original forecasts to fit later outcomes.',
    'CURRENT CONTEXT (owner-attested entries are not externally verified):', JSON.stringify(context, null, 2),
    'UNVERIFIED DAY 5 RECONCILIATION REFERENCE:', JSON.stringify({ checkpoint: DAY_5_CHECKPOINT, observedComparison: reconciliation }, null, 2),
    'Return one JSON object matching the following contract. Use only supported fields, explicit nulls and source-supported values. Include passes when there is no defensible opportunity. No prose outside JSON.',
    JSON.stringify(template, null, 2), 'JSON SCHEMA:', JSON.stringify(researchResponseJsonSchema),
  ].join('\n\n');
  return { prompt, context, reconciliation };
}
export function getResearchRecordMetadata(record: HistoricalRecord) {
  const metadata = researchMetadata(record);
  if (!metadata) return null;
  const stored = record.transformations.find(change => change.rule === 'research_response_context_metadata')?.normalized as Record<string, unknown>;
  return { ...metadata, responseId: String(stored.responseId ?? ''), sourceRecordId: String(stored.sourceRecordId ?? ''), type: record.snapshot.kind === 'paper' ? 'candidate' as const : 'pass_or_watch' as const, ownerConfirmedDayCompletion: record.transformations.some(change => change.rule === 'owner_confirmed_day_completion' && change.normalized === metadata.researchDay) };
}
