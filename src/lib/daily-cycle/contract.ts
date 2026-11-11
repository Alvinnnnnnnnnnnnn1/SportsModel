import { z } from "zod";

const id = z.string().trim().min(1).max(200);
const uuid = z.string().uuid();
const timestamp = z.string().datetime({ offset: true });
const nullableText = z.string().trim().min(1).max(2000).nullable();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const publicSourceUrl = z.string().url().refine(value=>{const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password&&![...u.searchParams.keys()].some(key=>/^(?:api_?key|password|access_?token|refresh_?token|token|secret|key)$/i.test(key));},'Use an attributable HTTP(S) source URL without credentials.');
const source = z.object({
  url: publicSourceUrl.nullable(),
  observedAt: timestamp.nullable(),
  note: nullableText,
}).strict();
const identity = z.object({
  eventId: nullableText,
  event: nullableText,
  sport: z.enum(["NBA", "NBL", "ATP", "WTA"]).nullable(),
  participant: nullableText,
  market: nullableText,
  selection: nullableText,
  line: z.string().max(100).nullable(),
}).strict();
const leg = identity.extend({
  id: uuid,
  outcome: z.enum(["WIN", "LOSS", "VOID", "PUSH", "UNRESOLVED"]).nullable(),
  statistic: z.number().finite().nullable(),
  clearanceMargin: z.number().finite().nullable(),
}).strict();

export const dailyCycleResultSchema = z.object({
  positionId: uuid,
  candidateId: id.nullable(),
  identity,
  eventStatus: z.enum(["scheduled", "completed", "postponed", "cancelled", "unknown"]),
  sportingOutcome: z.enum(["WIN", "LOSS", "VOID", "PUSH", "UNRESOLVED"]),
  legs: z.array(leg).max(20),
  sources: z.array(source).max(30),
  sourcePublicationAt: timestamp.nullable(),
  retrievedAt: timestamp.nullable(),
  matchConfidence: z.enum(["high", "medium", "low", "unknown"]),
  uncertainty: nullableText,
  actualPayoutCents: z.number().int().min(0).nullable(),
  deterministicSettlementEligible: z.boolean(),
  financialSettlementReviewRequired: z.boolean(),
}).strict();

const recommendation = identity.extend({
  candidateId: id,
  startsAt: timestamp.nullable(),
  originalOdds: z.number().min(1.0001).max(10000).refine(value => Math.abs(value * 10000 - Math.round(value * 10000)) < .00001).nullable(),
  quoteSource: nullableText,
  bookmaker: nullableText.optional(),
  quoteTimestamp: timestamp.nullable(),
  probability: z.number().min(0).max(1).nullable(),
  probabilityMethod: nullableText,
  modelVersion: nullableText,
  probabilityProvenance: z.object({
    origin: z.enum(['deterministic_model', 'external_forecast', 'llm', 'unknown']),
    source: nullableText, method: nullableText, modelVersion: nullableText, timestamp: timestamp.nullable(),
  }).strict().optional(),
  uncertainty: nullableText,
  evidenceCutoff: timestamp.nullable(),
  riskFactors: z.array(z.string().trim().min(1).max(500)).max(30),
  reasoning: nullableText,
  strategy: z.enum(["A", "B", "C"]).nullable(),
  sources: z.array(source).max(30),
  proposedStakeCents: z.number().int().min(0).nullable(),
}).strict();

export const dailyCycleSchema = z.object({
  format: z.literal("edgelab.daily-cycle"),
  version: z.literal(1),
  sourceClass: z.enum(['owner_research', 'synthetic']).optional(),
  metadata: z.object({
    cycleId: id,
    researchSessionId: id,
    researchDate: date,
    generatedAt: timestamp.nullable(),
    sourceDataCutoff: timestamp.nullable(),
    previousCheckpoint: id.nullable(),
    methodologyVersion: nullableText,
    modelVersion: nullableText,
    contextVersion: nullableText,
  }).strict(),
  resultUpdates: z.array(dailyCycleResultSchema).max(500),
  betRecommendations: z.array(recommendation).max(100),
  paperRecommendations: z.array(recommendation).max(100),
  modelFeedback: z.object({
    resultsEvaluated: z.number().int().min(0),
    calibration: nullableText,
    forecastErrors: z.array(z.string().trim().min(1).max(1000)).max(50),
    missingDataPatterns: z.array(z.string().trim().min(1).max(1000)).max(50),
    marketObservations: z.array(z.string().trim().min(1).max(1000)).max(50),
    proposedModelVersion: nullableText,
    validationStatus: z.enum(["validated", "experimental", "insufficient_evidence"]),
    evidenceLimitations: z.array(z.string().trim().min(1).max(1000)).max(50),
  }).strict(),
  processing: z.object({
    outstandingActualReviewed: z.number().int().min(0),
    resolved: z.number().int().min(0),
    unresolved: z.number().int().min(0),
    paperReviewed: z.number().int().min(0),
    unresolvedReasons: z.array(z.string().trim().min(1).max(1000)).max(100),
  }).strict(),
}).strict().superRefine((value, context) => {
  const resultIds = value.resultUpdates.map(item => item.positionId);
  if (new Set(resultIds).size !== resultIds.length) {
    context.addIssue({ code: "custom", path: ["resultUpdates"], message: "Each position may appear only once." });
  }
  const recommendationIds = [...value.betRecommendations, ...value.paperRecommendations].map(item => item.candidateId);
  if (new Set(recommendationIds).size !== recommendationIds.length) {
    context.addIssue({ code: "custom", path: ["betRecommendations"], message: "Recommendation IDs must be unique across BET and PAPER." });
  }
});

export type DailyCycle = z.infer<typeof dailyCycleSchema>;
export type DailyCycleResult = z.infer<typeof dailyCycleResultSchema>;
