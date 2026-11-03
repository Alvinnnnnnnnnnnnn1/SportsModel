import { z } from "zod";

const id = z.string().uuid();
const timestamp = z.string().datetime({ offset: true });
const text = z.string().trim().min(1).max(500);
const money = z.number().int().min(0).max(100_000_000);
const odds = z
  .number()
  .min(1.0001)
  .max(10_000)
  .refine(
    (v) => Math.abs(v * 10_000 - Math.round(v * 10_000)) < 0.00001,
    "Use at most four decimal places",
  );
const probability = z.number().min(0).max(1);
const sport = z.enum(["NBA", "NBL", "ATP", "WTA"]);
const strategy = z.enum(["A", "B", "C"]);
const outcome = z.enum(["pending", "won", "lost", "void"]);
export const legSchema = z.object({
  id,
  sport,
  event: text,
  participant: text,
  market: text,
  selection: text,
  line: z.string().trim().min(1, "Record the exact threshold or N/A").max(100),
  odds,
  outcome,
  statistic: z.string().max(500).optional(),
});
export const provenanceSchema = z.object({
  source: text,
  timestamp,
  method: text,
  modelVersion: text,
  simulated: z.boolean(),
});
export const betSchema = z
  .object({
    id,
    placedAt: timestamp,
    settledAt: timestamp.optional(),
    bookmaker: text,
    stakeCents: money.min(1),
    stakeType: z.enum(["cash", "bonus"]),
    odds,
    outcome,
    strategy,
    legs: z.array(legSchema).min(1).max(20),
    notes: z.string().max(5000),
    confirmedAt: timestamp,
    probability: probability.optional(),
    candidateId: id.optional(),
    oddsProvenance: provenanceSchema.optional(),
    probabilityProvenance: provenanceSchema.optional(),
  })
  .superRefine((bet, context) => {
    if (bet.probability !== undefined && !bet.probabilityProvenance)
      context.addIssue({
        code: "custom",
        message: "A probability requires its original provenance snapshot",
        path: ["probabilityProvenance"],
      });
    if (
      bet.outcome === "won" &&
      (bet.legs.some(
        (leg) => leg.outcome === "pending" || leg.outcome === "lost",
      ) ||
        !bet.legs.some((leg) => leg.outcome === "won"))
    ) {
      context.addIssue({
        code: "custom",
        message:
          "A won bet needs all legs won or void, with at least one won leg",
        path: ["outcome"],
      });
    }
    if (
      bet.outcome === "lost" &&
      !bet.legs.some((leg) => leg.outcome === "lost")
    )
      context.addIssue({
        code: "custom",
        message: "A lost bet needs at least one lost leg",
        path: ["outcome"],
      });
    if (
      bet.outcome === "void" &&
      !bet.legs.every((leg) => leg.outcome === "void")
    )
      context.addIssue({
        code: "custom",
        message: "A void bet needs all legs void",
        path: ["outcome"],
      });
    if (bet.outcome !== "pending" && !bet.settledAt)
      context.addIssue({
        code: "custom",
        message: "Record the UTC settlement timestamp",
        path: ["settledAt"],
      });
    if (bet.outcome === "pending" && bet.settledAt)
      context.addIssue({
        code: "custom",
        message: "A pending bet cannot have a settlement timestamp",
        path: ["settledAt"],
      });
    if (bet.settledAt && Date.parse(bet.settledAt) < Date.parse(bet.placedAt))
      context.addIssue({
        code: "custom",
        message: "Settlement cannot be before placement",
        path: ["settledAt"],
      });
  });
export const candidateSchema = z
  .object({
    id,
    sport,
    event: text,
    participant: text,
    market: text,
    selection: text,
    line: z
      .string()
      .trim()
      .min(1, "Record the exact threshold or N/A")
      .max(100),
    bookmaker: text,
    odds,
    probability: probability.optional(),
    strategy,
    rationale: z.string().min(1).max(5000),
    uncertainty: z.enum(["illustrative", "high", "medium"]),
    startsAt: timestamp,
    registeredAt: timestamp,
    oddsProvenance: provenanceSchema,
    probabilityProvenance: provenanceSchema.optional(),
  })
  .refine(
    (c) => c.probability === undefined || c.probabilityProvenance !== undefined,
    {
      message: "A probability requires provenance",
      path: ["probabilityProvenance"],
    },
  );
export const paperSchema = z
  .object({
    id,
    candidate: candidateSchema,
    registeredAt: timestamp,
    hypotheticalStakeCents: money.min(1),
    outcome,
    settledAt: timestamp.optional(),
    statistic: z.string().max(500).optional(),
  })
  .superRefine((paper, context) => {
    if (paper.outcome !== "pending" && !paper.settledAt)
      context.addIssue({
        code: "custom",
        message: "Record the UTC settlement timestamp",
        path: ["settledAt"],
      });
    if (paper.outcome === "pending" && paper.settledAt)
      context.addIssue({
        code: "custom",
        message: "A pending prediction cannot have a settlement timestamp",
        path: ["settledAt"],
      });
    if (
      paper.settledAt &&
      Date.parse(paper.settledAt) < Date.parse(paper.registeredAt)
    )
      context.addIssue({
        code: "custom",
        message: "Settlement cannot be before registration",
        path: ["settledAt"],
      });
  });
export const notificationSchema = z.object({
  id,
  candidateId: id.optional(),
  title: text,
  message: z.string().max(5000),
  createdAt: timestamp,
  readAt: timestamp.optional(),
  dismissedAt: timestamp.optional(),
  simulated: z.boolean(),
});
export const runSchema = z.object({
  id,
  startedAt: timestamp,
  completedAt: timestamp.optional(),
  status: z.enum(["running", "completed", "failed"]),
  candidateCount: z.number().int().min(0),
  simulated: z.boolean(),
  error: z.string().optional(),
});
export const transactionSchema = z.object({
  id,
  kind: z.enum(["deposit", "withdrawal"]),
  amountCents: money.min(1),
  createdAt: timestamp,
  note: z.string().max(1000),
});
export const settingsSchema = z.object({
  fundingCapCents: money.min(1),
  defaultStakeCents: money.min(1),
  currency: z.literal("AUD"),
  timezone: z.literal("Australia/Melbourne"),
});
export const auditSchema = z.object({
  id,
  entityType: z.enum(["bet", "paper", "settings", "transaction"]),
  entityId: text,
  action: text,
  timestamp,
  before: z.unknown(),
  after: z.unknown(),
});
export const appDataSchema = z.object({
  version: z.literal(1),
  settings: settingsSchema,
  bets: z.array(betSchema),
  transactions: z.array(transactionSchema),
  candidates: z.array(candidateSchema),
  paperPredictions: z.array(paperSchema),
  notifications: z.array(notificationSchema),
  researchRuns: z.array(runSchema),
  audit: z.array(auditSchema),
});
