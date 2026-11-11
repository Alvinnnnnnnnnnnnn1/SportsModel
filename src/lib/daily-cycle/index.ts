import type { AppData, Candidate } from "@/lib/domain/types";
import type { HistoricalWorkspace } from "@/lib/imports/types";
import { dailyCycleSchema, type DailyCycle } from "./contract";
import { buildSettlementTargets, type SettlementResponse } from "@/lib/results";
import { reconciliationRecordInfo } from '@/lib/reconciliation/source';
import { readArchivedWagerClaim } from '@/lib/imports/wager-claim-provenance';
import type { ResearchHandoffContext } from '@/lib/handoff/context';

export * from "./contract";
export * from "./preparation";
export * from "./feedback";

export interface DailyCyclePosition {
  positionId: string;
  kind: "actual" | "paper";
  candidateId: string | null;
  sport: string | null;
  event: string | null;
  participant: string | null;
  market: string | null;
  selection: string | null;
  line: string | null;
  outcome: string;
  odds: number | null;
  stakeCents: number | null;
  registeredAt: string;
  sourceReference: string | null;
  storage?: 'core' | 'historical';
}

export interface DailyCycleImportReview {
  cycle: DailyCycle;
  cycleKey: string;
  positions: DailyCyclePosition[];
  matchedResults: number;
  unresolvedResults: number;
  newBetRecommendations: number;
  newPaperRecommendations: number;
  duplicateCycle: boolean;
  warnings: string[];
}

export interface DailyCycleSettlementPreparation {
  response: SettlementResponse | null;
  keys: string[];
  skipped: string[];
}

export function recommendationToCandidate(
  recommendation: DailyCycle["betRecommendations"][number],
): Candidate | null {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(recommendation.candidateId) ||
    !recommendation.sport ||
    !recommendation.event ||
    !recommendation.participant ||
    !recommendation.market ||
    !recommendation.selection ||
    !recommendation.startsAt ||
    recommendation.originalOdds === null
  ) return null;
  const timestamp = recommendation.quoteTimestamp ?? new Date().toISOString();
  return {
    id: recommendation.candidateId,
    sport: recommendation.sport,
    event: recommendation.event,
    participant: recommendation.participant,
    market: recommendation.market,
    selection: recommendation.selection,
    line: recommendation.line ?? "",
    bookmaker: recommendation.quoteSource ?? "Unspecified source",
    odds: recommendation.originalOdds,
    probability: recommendation.probability ?? undefined,
    strategy: recommendation.strategy ?? "A",
    rationale: recommendation.reasoning ?? "",
    uncertainty: recommendation.uncertainty ? "high" : "medium",
    startsAt: recommendation.startsAt,
    registeredAt: timestamp,
    oddsProvenance: {
      source: recommendation.quoteSource ?? "daily-cycle",
      timestamp,
      method: "manual daily-cycle evidence",
      modelVersion: recommendation.modelVersion ?? "unversioned",
      simulated: false,
    },
    probabilityProvenance: recommendation.probability === null ? undefined : {
      source: recommendation.probabilityMethod ?? "daily-cycle",
      timestamp,
      method: recommendation.probabilityMethod ?? "manual daily-cycle evidence",
      modelVersion: recommendation.modelVersion ?? "unversioned",
      simulated: false,
    },
  };
}

function linkedCandidateId(notes: string): string | null {
  const match = notes.match(/research-record:([A-Za-z0-9._:-]+)/);
  return match?.[1] ?? null;
}

function sameIdentity(
  position: DailyCyclePosition,
  identity: DailyCycle["resultUpdates"][number]["identity"],
): boolean {
  return [position.sport, position.event, position.participant, position.market, position.selection, position.line]
    .every((value, index) => value === [identity.sport, identity.event, identity.participant, identity.market, identity.selection, identity.line][index]);
}

export function collectDailyCyclePositions(data: AppData, history?: HistoricalWorkspace): DailyCyclePosition[] {
  const actual = data.bets
    .filter((bet) => bet.lifecycle !== "entered_in_error" && bet.lifecycle !== "superseded")
    .map((bet): DailyCyclePosition => ({
      positionId: bet.id,
      kind: "actual",
      candidateId: bet.candidateId ?? linkedCandidateId(bet.notes),
      sport: bet.legs[0]?.sport ?? null,
      event: bet.legs[0]?.event ?? null,
      participant: bet.legs[0]?.participant ?? null,
      market: bet.legs[0]?.market ?? null,
      selection: bet.legs.map((leg) => leg.selection).join(" + ") || null,
      line: bet.legs.map((leg) => leg.line).join(" + ") || null,
      outcome: bet.outcome,
      odds: bet.odds,
      stakeCents: bet.stakeCents,
      registeredAt: bet.recordedAt ?? bet.confirmedAt,
      sourceReference: linkedCandidateId(bet.notes),
    }));
  const paper = data.paperPredictions
    .filter((record) => record.lifecycle !== "entered_in_error" && record.lifecycle !== "superseded")
    .map((record): DailyCyclePosition => ({
      positionId: record.id,
      kind: "paper",
      candidateId: record.candidate.id,
      sport: record.candidate.sport,
      event: record.candidate.event,
      participant: record.candidate.participant,
      market: record.candidate.market,
      selection: record.candidate.selection,
      line: record.candidate.line,
      outcome: record.outcome,
      odds: record.candidate.odds,
      stakeCents: record.hypotheticalStakeCents,
      registeredAt: record.registeredAt,
      sourceReference: record.candidate.id,
    }));
  const historical = (history?.paperResults ?? []).flatMap<DailyCyclePosition>(result => {
    const record = history?.records.find(item => item.id === result.recordId);
    if (!record || record.snapshot.kind === 'actual' || paper.some(item => item.positionId === record.id)) return [];
    const s = record.snapshot;
    return [{ positionId: record.id, kind: 'paper', storage: 'historical', candidateId: null,
      sport: s.sport, event: s.event, participant: s.participant, market: s.market, selection: s.selection,
      line: s.line, outcome: result.outcome, odds: s.odds, stakeCents: s.stakeCents,
      registeredAt: history!.audit.find(a => a.recordId === record.id && a.action === 'paper_registered')?.timestamp ?? record.importedAt,
      sourceReference: s.sourceReference }];
  });
  return [...actual, ...paper, ...historical];
}

export function dailyCycleHistoricalMemory(data: AppData, history: HistoricalWorkspace) {
  return history.records.filter(record => record.snapshot.kind !== null).map(record => {
    const s = record.snapshot, metadata = reconciliationRecordInfo(record.raw);
    const claim = readArchivedWagerClaim(record)?.claim;
    const actual = data.bets.find(bet => bet.id === record.id);
    const paper = history.paperResults.find(result => result.recordId === record.id);
    return { archiveId: record.id, originalSourceId: metadata?.sourceId ?? s.externalId,
      classification: actual ? 'linked_actual_ledger' : s.kind === 'actual' ? 'historical_actual_claim_not_financially_registered'
        : paper ? 'archived_paper_tracking_preregistration_requires_separate_evidence'
        : metadata?.category === 'proposal' ? 'unregistered_paper_proposal' : 'historical_paper_claim_not_registered',
      verification: s.verification, sport: s.sport, event: s.event, selection: s.selection, line: s.line,
      originalPaperPrice: s.kind === 'paper' ? s.odds : null, acceptedExecutionPrice: claim?.acceptedOdds ?? null,
      reportedPrice: claim?.reportedOdds ?? null, originalPredictionAt: s.predictionAt,
      sourceOutcome: s.outcome, currentRecordedOutcome: actual?.outcome ?? paper?.outcome ?? null,
      reportedStakeCents: s.stakeCents, reportedPayoutCents: s.payoutCents, stakeType: s.stakeType,
      sourceReference: s.sourceReference, legs: s.legs };
  });
}

export function buildDailyCyclePrompt(input: {
  data: AppData;
  history: HistoricalWorkspace;
  researchDate: string;
  researchSessionId: string;
  previousCheckpoint: string | null;
  providerPreparation?: string;
  feedbackSummary?: string;
  previousCycleSummary?: string;
  researchContext?: ResearchHandoffContext;
}): string {
  const positions = collectDailyCyclePositions(input.data, input.history);
  const positionLines = positions.length
    ? positions.map((position) => JSON.stringify(position)).join("\n")
    : "[]";
  return [
    "You are preparing an EdgeLab daily research cycle. Use attributable evidence only; missing facts stay null.",
    "Before researching new events, resolve every outstanding EdgeLab position using final, attributable sporting evidence. For each position, either return its correctly graded outcome or explicitly state why it remains unresolved. Do not omit any pending record.",
    "Resolve previous actual wagers first, then paper predictions, then missing/conflicting results, and only then research new events.",
    "Distinguish sporting results from sportsbook settlement. Never invent accepted odds, payouts, deposits, timestamps, statistics or probabilities.",
    "Preserve exact positionId and candidateId values. Do not create a new historical wager ID.",
    "After the readable analysis, output exactly one complete EDGELAB DAILY CYCLE JSON v1 block. This block must include prior result updates, new BET/PAPER recommendations and model-feedback data. Do not omit unresolved positions.",
    "",
    `Research date (Australia/Melbourne): ${input.researchDate}`,
    `Research session ID: ${input.researchSessionId}`,
    `Previous checkpoint: ${input.previousCheckpoint ?? "null"}`,
    `Outstanding positions (${positions.length}):`,
    positionLines,
    "",
    "Return human-readable sections for Previous results summary, BET recommendations, PAPER recommendations, model feedback and uncertainty, followed by one standalone JSON code block.",
    "The JSON must use format edgelab.daily-cycle and version 1. Use null for unknown values. Do not include Markdown inside the JSON body.",
    `Historical workspace records available for context: ${input.history.records.length}`,
    'SAVED HISTORICAL MEMORY — claims/proposals are not financial ledger entries or qualifying forecasts. Never turn source-reported wins into cash payouts or backdate proposal registration. Research unknowns but leave unsupported results unresolved.',
    JSON.stringify(dailyCycleHistoricalMemory(input.data, input.history)),
    'Tracked historical paper positions retain historical eligibility restrictions; archive-only proposals are context, not result-update targets. Funding cap is not a deposit. Cash, bonus and paper accounting remain separate.',
    'APPROVED METHODOLOGY / OWNER PROGRESS — read-only context; source completion and owner-reported progress differ:',
    input.researchContext ? JSON.stringify({ methodology: input.researchContext.methodology,
      knownRules: input.researchContext.knownRules, latestSourceConfirmedCompletedDay: input.researchContext.latestSourceConfirmedCompletedDay,
      latestOwnerReportedDay: input.researchContext.latestOwnerReportedDay, proposedResearchDay: input.researchContext.proposedResearchDay }) : 'Not supplied; do not assume or change experiment policy.',
    "",
    "Provider observations and availability:",
    input.providerPreparation ?? "No provider preparation was supplied; preserve missing statistics explicitly.",
    "",
    "Latest model feedback summary:",
    input.feedbackSummary ?? "No feedback journal is available; sample size may be insufficient.",
    "",
    "Latest saved daily-cycle checkpoint:",
    input.previousCycleSummary ?? "No prior daily-cycle checkpoint is available.",
  ].join("\n");
}

export function reviewDailyCycle(input: {
  raw: unknown;
  data: AppData;
  history: HistoricalWorkspace;
  previousCycleKeys: string[];
}): DailyCycleImportReview {
  const cycle = dailyCycleSchema.parse(input.raw);
  const positions = collectDailyCyclePositions(input.data, input.history);
  const known = new Map(positions.map((position) => [position.positionId, position]));
  const warnings: string[] = [];
  let matchedResults = 0;
  let unresolvedResults = 0;
  for (const result of cycle.resultUpdates) {
    if (!known.has(result.positionId)) {
      warnings.push(`Unknown position ID: ${result.positionId}`);
      continue;
    }

    matchedResults += 1;
    const position = known.get(result.positionId)!;
    if (!sameIdentity(position, result.identity)) {
      warnings.push(`Identity mismatch for position ID: ${result.positionId}`);
      unresolvedResults += 1;
    } else if (result.sportingOutcome === "UNRESOLVED" || !result.deterministicSettlementEligible) unresolvedResults += 1;
  }
  const cycleKey = `${cycle.metadata.cycleId}:${cycle.metadata.researchSessionId}`;
  return {
    cycle,
    cycleKey,
    positions,
    matchedResults,
    unresolvedResults,
    newBetRecommendations: cycle.betRecommendations.length,
    newPaperRecommendations: cycle.paperRecommendations.length,
    duplicateCycle: input.previousCycleKeys.includes(cycleKey),
    warnings,
  };
}

export async function prepareDailyCycleSettlements(
  review: DailyCycleImportReview,
  data: AppData,
  history: HistoricalWorkspace,
): Promise<DailyCycleSettlementPreparation> {
  const targets = await buildSettlementTargets(data, history);
  const byKey = new Map(targets.map((target) => [target.key, target]));
  const observations: SettlementResponse["observations"] = [];
  const skipped: string[] = [];
  for (const result of review.cycle.resultUpdates) {
    const kind = data.bets.some((bet) => bet.id === result.positionId) ? 'actual'
      : data.paperPredictions.some(paper => paper.id === result.positionId) ? 'paper' : 'historical_paper';
    // The cycle application service currently saves the core workspace only.
    // Historical results must use the existing separately approved Results Review
    // transaction rather than mixing repository scopes in one implicit save.
    if (kind === 'historical_paper') {
      skipped.push(`${kind}:${result.positionId}`);
      continue;
    }
    const target = byKey.get(`${kind}:${result.positionId}`);
    const position = review.positions.find((item) => item.positionId === result.positionId);
    const source = result.sources.find((item) => item.url && item.observedAt && item.note);
    const settledAt = result.sourcePublicationAt ?? result.retrievedAt;
    const outcome = result.sportingOutcome === "WIN"
      ? "won"
      : result.sportingOutcome === "LOSS"
        ? "lost"
        : result.sportingOutcome === "VOID"
          ? "void"
          : null;
    if (
      !target ||
      !position ||
      !sameIdentity(position, result.identity) ||
      !result.deterministicSettlementEligible ||
      !target.eligible ||
      !source?.url ||
      !source.observedAt ||
      !settledAt ||
      !outcome ||
      !target.eventDate ||
      result.legs.length !== target.legs.length
    ) {
      skipped.push(`${kind}:${result.positionId}`);
      continue;
    }
    observations.push({
      kind,
      recordId: result.positionId,
      identityHash: target.identityHash,
      sport: target.sport,
      event: target.event,
      eventDate: target.eventDate,
      outcome,
      settledAt,
      eventCompleted: result.eventStatus === "completed",
      termsConfirmed: true,
      termsReference: source.note,
      verification: "source_supplied",
      ownerAttested: false,
      sources: [{ url: source.url, observedAt: source.observedAt, note: source.note }],
      notes: result.uncertainty,
      actualPayoutCents: kind === "actual" ? result.actualPayoutCents : null,
      legs: target.legs.map((leg, index) => {
        const observed = result.legs[index];
        return {
          legId: leg.legId,
          sport: leg.sport,
          event: leg.event,
          participant: leg.participant,
          market: leg.market,
          selection: leg.selection,
          line: leg.line,
          outcome: observed.outcome === "WIN"
            ? "won"
            : observed.outcome === "LOSS"
              ? "lost"
              : observed.outcome === "VOID"
                ? "void"
                : null,
          statistic: observed.statistic === null ? null : String(observed.statistic),
          observedValue: observed.statistic,
          clearanceMargin: observed.clearanceMargin,
        };
      }),
      specialCases: [],
      specialCaseResolution: null,
    });
  }
  if (!observations.length) return { response: null, keys: [], skipped };
  const response: SettlementResponse = {
    format: "edgelab.settlement-response",
    version: 1,
    id: `daily-cycle:${review.cycle.metadata.cycleId}`,
    createdAt: review.cycle.metadata.generatedAt ?? new Date().toISOString(),
    observations,
  };
  return {
    response,
    keys: observations.map((observation) => `${observation.kind}:${observation.recordId}`),
    skipped,
  };
}
