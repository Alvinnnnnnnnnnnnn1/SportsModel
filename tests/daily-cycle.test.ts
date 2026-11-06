import { describe, expect, it } from "vitest";
import { createDemoData } from "../src/lib/domain/fixtures";
import { emptyHistoricalWorkspace } from "../src/lib/imports/types";
import { buildSettlementTargets } from "../src/lib/results";
import { applyAppResultBatch } from "../src/lib/daily/result-batch";
import {
  buildDailyCyclePrompt,
  collectDailyCyclePositions,
  dailyCycleSchema,
  prepareDailyCycleSettlements,
  recommendationToCandidate,
  calculateDailyFeedback,
  prepareDailyResearch,
  reviewDailyCycle,
} from "../src/lib/daily-cycle";

const paperId = "9d1c8b3a-3bd0-4b9f-91c3-4f4f0a6b0d1e";
const cycleFor = (positionId: string) => ({
  format: "edgelab.daily-cycle" as const,
  version: 1 as const,
  metadata: {
    cycleId: "cycle-2026-11-06",
    researchSessionId: "session-2026-11-06",
    researchDate: "2026-11-06",
    generatedAt: null,
    sourceDataCutoff: null,
    previousCheckpoint: null,
    methodologyVersion: null,
    modelVersion: null,
    contextVersion: null,
  },
  resultUpdates: [{
    positionId,
    candidateId: null,
    identity: { eventId: null, event: null, sport: "NBA" as const, participant: "Player", market: "Player points", selection: "Over 20.5", line: "20.5" },
    eventStatus: "completed" as const,
    sportingOutcome: "UNRESOLVED" as const,
    legs: [],
    sources: [],
    sourcePublicationAt: null,
    retrievedAt: null,
    matchConfidence: "unknown" as const,
    uncertainty: "Statistics unavailable",
    actualPayoutCents: null,
    deterministicSettlementEligible: false,
    financialSettlementReviewRequired: true,
  }],
  betRecommendations: [],
  paperRecommendations: [],
  modelFeedback: {
    resultsEvaluated: 0,
    calibration: null,
    forecastErrors: [],
    missingDataPatterns: [],
    marketObservations: [],
    proposedModelVersion: null,
    validationStatus: "insufficient_evidence" as const,
    evidenceLimitations: [],
  },
  processing: {
    outstandingActualReviewed: 1,
    resolved: 0,
    unresolved: 1,
    paperReviewed: 0,
    unresolvedReasons: ["Statistics unavailable"],
  },
});

describe("daily-cycle v1", () => {
  it("keeps the existing research-response contract separate and validates a cycle", () => {
    const cycle = cycleFor("3c4283a2-63b3-43b6-914b-e8c933013de4");
    expect(dailyCycleSchema.parse(cycle).format).toBe("edgelab.daily-cycle");
  });

  it("includes every active actual and paper position in the GPT prompt", () => {
    const data = createDemoData();
    const positions = collectDailyCyclePositions(data);
    const prompt = buildDailyCyclePrompt({
      data,
      history: emptyHistoricalWorkspace(),
      researchDate: "2026-11-06",
      researchSessionId: "session-2026-11-06",
      previousCheckpoint: null,
    });
    for (const position of positions) expect(prompt).toContain(position.positionId);
  });

  it("matches known positions, preserves unresolved results and warns on unknown IDs", () => {
    const data = createDemoData();
    data.bets = [data.bets[0]];
    const cycle = cycleFor(data.bets[0].id);
    const review = reviewDailyCycle({
      raw: {
        ...cycle,
        resultUpdates: [
          cycle.resultUpdates[0],
          { ...cycle.resultUpdates[0], positionId: paperId },
        ],
      },
      data,
      history: emptyHistoricalWorkspace(),
      previousCycleKeys: [],
    });
    expect(review.matchedResults).toBe(1);
    expect(review.unresolvedResults).toBe(1);
    expect(review.warnings).toContain(`Unknown position ID: ${paperId}`);
  });

  it("marks repeated cycles as duplicates without applying them", () => {
    const cycle = cycleFor(createDemoData().bets[0].id);
    const review = reviewDailyCycle({
      raw: cycle,
      data: createDemoData(),
      history: emptyHistoricalWorkspace(),
      previousCycleKeys: ["cycle-2026-11-06:session-2026-11-06"],
    });
    expect(review.duplicateCycle).toBe(true);
  });

  it("keeps unresolved or incomplete result evidence pending", async () => {
    const data = createDemoData();
    const review = reviewDailyCycle({
      raw: cycleFor(data.bets[0].id),
      data,
      history: emptyHistoricalWorkspace(),
      previousCycleKeys: [],
    });
    const prepared = await prepareDailyCycleSettlements(
      review,
      data,
      emptyHistoricalWorkspace(),
    );
    expect(prepared.response).toBeNull();
    expect(prepared.skipped).toContain(`actual:${data.bets[0].id}`);
  });

  it("converts complete recommendations without inventing missing identity", () => {
    const recommendation = {
      candidateId: "3c4283a2-63b3-43b6-914b-e8c933013de4",
      eventId: null,
      sport: "NBA" as const,
      event: "Synthetic fixture",
      participant: "Player",
      market: "Moneyline",
      selection: "Player",
      line: null,
      startsAt: "2026-11-07T08:00:00+00:00",
      originalOdds: 2,
      quoteSource: "synthetic source",
      quoteTimestamp: "2026-11-06T10:00:00+00:00",
      probability: 0.5,
      probabilityMethod: "test",
      modelVersion: "test-v1",
      uncertainty: null,
      evidenceCutoff: null,
      riskFactors: [],
      reasoning: "test",
      strategy: "A" as const,
      sources: [],
      proposedStakeCents: 500,
    };
    expect(recommendationToCandidate(recommendation)?.id).toBe("3c4283a2-63b3-43b6-914b-e8c933013de4");
    expect(recommendationToCandidate({ ...recommendation, event: null })).toBeNull();
  });

  it("reports insufficient feedback samples and explicit Demo provider coverage", async () => {
    const data = createDemoData();
    expect(calculateDailyFeedback({ ...data, bets: [], paperPredictions: [] }).calibration).toBe("insufficient_sample");
    const preparation = await prepareDailyResearch({ mode: "demo", now: new Date("2026-11-06T10:00:00Z") });
    expect(preparation.observations).toHaveLength(0);
    expect(preparation.warnings.join(" ")).toContain("no player statistics were simulated");
  });

  it("includes mocked provider observations with freshness and coverage labels", async () => {
    const snapshot = {
      provider: "api-nba" as const,
      source: "https://v2.nba.api-sports.io",
      retrievedAt: "2026-11-06T10:00:00.000Z",
      cached: false,
      observations: [],
      discovery: null,
      warnings: [],
    };
    const preparation = await prepareDailyResearch({
      mode: "supabase",
      accessToken: "test-token",
      now: new Date("2026-11-06T10:00:00Z"),
      read: async () => snapshot,
    });
    expect(preparation.observations).toHaveLength(2);
    expect(preparation.coverage).toContain("0 provider observations");
  });

  it("applies eligible actual and paper results together while leaving unresolved paper pending", async () => {
    const data = createDemoData(new Date("2026-11-06T10:00:00Z"));
    data.bets = data.bets.filter((bet) => bet.outcome === "pending").slice(0, 2);
    data.paperPredictions = data.paperPredictions.filter((paper) => paper.outcome === "pending").slice(0, 2);
    data.bets = data.bets.map((bet) => ({
      ...bet,
      candidateId: data.candidates.find((candidate) => candidate.event === bet.legs[0].event)?.id,
    }));
    data.candidates = data.candidates.map((candidate) => ({
      ...candidate,
      startsAt: "2026-11-05T08:00:00Z",
    }));
    data.paperPredictions = data.paperPredictions.map((paper) => ({
      ...paper,
      candidate: { ...paper.candidate, startsAt: "2026-11-05T08:00:00Z", registeredAt: "2026-11-04T08:00:00Z" },
      registeredAt: "2026-11-04T08:00:00Z",
    }));
    const targets = await buildSettlementTargets(data, emptyHistoricalWorkspace());
    const resultUpdates = targets.map((target, index) => {
      const resolved = index < 3;
      const outcome = resolved ? (index % 2 === 0 ? "WIN" as const : "LOSS" as const) : "UNRESOLVED" as const;
      return {
        positionId: target.recordId,
        candidateId: target.recordId,
        identity: {
          eventId: null,
          event: target.event,
          sport: target.sport,
          participant: target.participant,
          market: target.market,
          selection: target.selection,
          line: target.line,
        },
        eventStatus: resolved ? "completed" as const : "unknown" as const,
        sportingOutcome: outcome,
        legs: target.legs.map((leg) => ({
          id: leg.legId,
          eventId: null,
          sport: leg.sport,
          event: leg.event,
          participant: leg.participant,
          market: leg.market,
          selection: leg.selection,
          line: leg.line,
          outcome,
          statistic: null,
          clearanceMargin: null,
        })),
        sources: resolved ? [{ url: "https://example.com/result", observedAt: "2026-11-06T10:00:00Z", note: "Owner-reviewed synthetic result source" }] : [],
        sourcePublicationAt: resolved ? "2026-11-06T10:00:00Z" : null,
        retrievedAt: resolved ? "2026-11-06T10:01:00Z" : null,
        matchConfidence: resolved ? "high" as const : "unknown" as const,
        uncertainty: resolved ? null : "Result unavailable",
        actualPayoutCents: target.kind === "actual" && resolved ? (outcome === "WIN" ? Math.round((target.stakeCents ?? 0) * (target.acceptedOdds ?? 0)) : 0) : null,
        deterministicSettlementEligible: resolved,
        financialSettlementReviewRequired: target.kind === "actual",
      };
    });
    const cycle = cycleFor(data.bets[0].id);
    const raw = { ...cycle, resultUpdates, metadata: { ...cycle.metadata, cycleId: "batch-cycle", generatedAt: "2026-11-06T10:02:00Z" } };
    const review = reviewDailyCycle({ raw, data, history: emptyHistoricalWorkspace(), previousCycleKeys: [] });
    const prepared = await prepareDailyCycleSettlements(review, data, emptyHistoricalWorkspace());
    expect(prepared.keys).toHaveLength(3);
    const saved = await applyAppResultBatch(data, emptyHistoricalWorkspace(), prepared.response!, prepared.keys, "demo");
    expect(saved.summary.applied).toHaveLength(3);
    expect(saved.data.bets.filter((bet) => bet.outcome !== "pending")).toHaveLength(2);
    expect(saved.data.paperPredictions.filter((paper) => paper.outcome !== "pending")).toHaveLength(1);
    expect(saved.data.paperPredictions.filter((paper) => paper.outcome === "pending")).toHaveLength(1);
  });
});
