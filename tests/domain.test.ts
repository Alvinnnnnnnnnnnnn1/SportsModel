import { describe, expect, it } from "vitest";
import {
  betProfit,
  betReturn,
  calculateMetrics,
  calibration,
  estimateSyntheticProbability,
  expectedValue,
  groupPerformance,
  impliedProbability,
  multiplyMoney,
  paperAsBets,
  performanceSeries,
} from "../src/lib/domain/calculations";
import { createDemoData, createEmptyData } from "../src/lib/domain/fixtures";
import {
  appDataSchema,
  betSchema,
  candidateSchema,
  paperSchema,
  settingsSchema,
} from "../src/lib/domain/validation";
import type { Bet, Transaction } from "../src/lib/domain/types";
import {
  createTestNotification,
  getMockNotificationHistory,
  inAppNotificationProvider,
  mockResearchEngine,
} from "../src/lib/providers/mock";
import {
  OpenAIResearchAdapter,
  TheOddsApiAdapter,
} from "../src/lib/providers/stubs";

const deposit: Transaction = {
  id: "57ec993d-c58e-4dac-b5cb-6b02b3d2bc55",
  amountCents: 25_000,
  kind: "deposit",
  createdAt: "2026-10-01T00:00:00.000Z",
  note: "Test deposit",
};
function bet(overrides: Partial<Bet> = {}): Bet {
  return {
    id: "3c4283a2-63b3-43b6-914b-e8c933013de4",
    placedAt: "2026-10-02T00:00:00.000Z",
    settledAt: "2026-10-03T00:00:00.000Z",
    confirmedAt: "2026-10-02T00:00:00.000Z",
    bookmaker: "Demo Sports",
    stakeCents: 500,
    stakeType: "cash",
    odds: 1.91,
    outcome: "won",
    strategy: "B",
    notes: "",
    probability: 0.6,
    probabilityProvenance: {
      source: "Synthetic unit test",
      timestamp: "2026-10-02T00:00:00.000Z",
      method: "Fixed numerical fixture",
      modelVersion: "test-v1",
      simulated: true,
    },
    legs: [
      {
        id: "c143f40c-0454-4e58-b5d7-ea5bbd2dfc8e",
        sport: "NBA",
        event: "Fictional A vs Fictional B",
        participant: "Fictional A",
        market: "Total points",
        selection: "Over 20.5",
        line: "20.5",
        odds: 1.91,
        outcome: "won",
      },
    ],
    ...overrides,
  };
}

describe("deterministic synthetic frequency estimator", () => {
  it("uses Laplace smoothing, including zero observations and extreme counts", () => {
    expect(estimateSyntheticProbability(55, 98)).toBe(56 / 100);
    expect(estimateSyntheticProbability(0, 0)).toBe(0.5);
    expect(estimateSyntheticProbability(0, 98)).toBe(1 / 100);
    expect(estimateSyntheticProbability(98, 98)).toBe(99 / 100);
    expect(estimateSyntheticProbability(3, 5)).toBe(4 / 7);
  });
  it("rejects impossible, fractional or non-finite observation counts", () => {
    for (const [wins, trials] of [
      [-1, 5],
      [2, 1],
      [1.5, 5],
      [1, 5.5],
      [0, -1],
      [NaN, 5],
      [1, Infinity],
      [0, Number.MAX_SAFE_INTEGER],
    ]) {
      expect(() => estimateSyntheticProbability(wins, trials)).toThrow(
        "integer counts",
      );
    }
  });
  it("reproduces every registered demo estimate from the stored synthetic counts", () => {
    const data = createDemoData();
    const snapshots = [
      ...data.candidates,
      ...data.bets,
      ...data.paperPredictions.map((p) => p.candidate),
    ];
    for (const snapshot of snapshots) {
      if (snapshot.probability === undefined) continue;
      expect(snapshot.probabilityProvenance?.modelVersion).toBe(
        "synthetic-frequency-v1",
      );
      const counts = snapshot.probabilityProvenance?.method.match(
        /wins=(\d+), trials=(\d+)/,
      );
      expect(counts).not.toBeNull();
      expect(snapshot.probability).toBe(
        estimateSyntheticProbability(Number(counts![1]), Number(counts![2])),
      );
      expect(snapshot.probabilityProvenance?.simulated).toBe(true);
    }
    const unmodelled = data.candidates.find((c) => c.market === "Player aces");
    expect(unmodelled?.probability).toBeUndefined();
    expect(unmodelled?.probabilityProvenance).toBeUndefined();
  });
});

describe("money and settlement", () => {
  it("calculates decimal odds returns and realised cash profits in cents", () => {
    expect(betReturn(bet())).toBe(955);
    expect(betProfit(bet())).toBe(455);
    expect(betProfit(bet({ outcome: "lost" }))).toBe(-500);
  });
  it("does not realise a pending loss and returns a void cash stake", () => {
    expect(betProfit(bet({ outcome: "pending" }))).toBe(0);
    expect(betReturn(bet({ outcome: "pending" }))).toBe(0);
    expect(betReturn(bet({ outcome: "void" }))).toBe(500);
    expect(betProfit(bet({ outcome: "void" }))).toBe(0);
  });
  it("only returns bonus winnings, never the bonus stake", () => {
    expect(betReturn(bet({ stakeType: "bonus" }))).toBe(455);
    expect(betProfit(bet({ stakeType: "bonus" }))).toBe(455);
    expect(betProfit(bet({ stakeType: "bonus", outcome: "lost" }))).toBe(0);
    expect(betReturn(bet({ stakeType: "bonus", outcome: "void" }))).toBe(0);
  });
  it("rounds a half cent up and prevents invalid money inputs", () => {
    expect(multiplyMoney(501, 1.5)).toBe(752);
    expect(multiplyMoney(5, 1.91)).toBe(10);
    expect(() => multiplyMoney(1.5, 1.9)).toThrow();
    expect(() => multiplyMoney(100, Infinity)).toThrow();
  });
});

describe("portfolio metrics", () => {
  it("reserves pending cash, counts deposits and withdrawals, and excludes void stakes from ROI", () => {
    const result = calculateMetrics(
      [
        bet(),
        bet({ outcome: "lost" }),
        bet({ outcome: "pending" }),
        bet({ outcome: "void" }),
      ],
      [
        deposit,
        {
          ...deposit,
          id: crypto.randomUUID(),
          kind: "withdrawal",
          amountCents: 1_000,
        },
      ],
    );
    expect(result.profitCents).toBe(-45);
    expect(result.bankrollCents).toBe(23_455);
    expect(result.equityCents).toBe(23_955);
    expect(result.totalDepositsCents).toBe(25_000);
    expect(result.stakedCents).toBe(1_000);
    expect(result.roi).toBeCloseTo(-4.5);
    expect(result.hitRate).toBe(50);
    expect([result.won, result.lost, result.pending, result.void]).toEqual([
      1, 1, 1, 1,
    ]);
  });
  it("keeps bonus profits out of cash ROI and pending bonus stakes out of cash reserves", () => {
    const result = calculateMetrics(
      [
        bet(),
        bet({ stakeType: "bonus" }),
        bet({ stakeType: "bonus", outcome: "pending" }),
      ],
      [deposit],
    );
    expect(result.bankrollCents).toBe(25_910);
    expect(result.bonusProfitCents).toBe(455);
    expect(result.stakedCents).toBe(500);
    expect(result.roi).toBe(91);
    expect(result.pendingStakeCents).toBe(0);
  });
  it("returns insufficient-data values for undefined ratios", () => {
    const result = calculateMetrics([], []);
    expect(result.roi).toBeNull();
    expect(result.hitRate).toBeNull();
    expect(result.averageOdds).toBeNull();
    expect(result.brierScore).toBeNull();
    expect(result.bankrollCents).toBe(0);
  });
  it("scores only decisive forecasts and handles probabilities at the boundaries", () => {
    const result = calculateMetrics(
      [
        bet({ probability: 0.8 }),
        bet({ outcome: "lost", probability: 0.2 }),
        bet({ outcome: "void", probability: 0 }),
        bet({ outcome: "pending", probability: 1 }),
        bet({ probability: undefined }),
      ],
      [],
    );
    expect(result.brierScore).toBeCloseTo(0.04);
    expect(result.forecastCount).toBe(2);
  });
  it("builds an accounting timeline whose final cash matches portfolio metrics", () => {
    const bets = [
      bet(),
      bet({ outcome: "pending" }),
      bet({ stakeType: "bonus" }),
      bet({ outcome: "void" }),
    ];
    const series = performanceSeries(bets, [deposit]);
    expect(series.at(-1)?.bankroll).toBe(
      calculateMetrics(bets, [deposit]).bankrollCents / 100,
    );
    expect(series.at(-1)?.profit).toBe(9.1);
    expect(series[0].bankroll).toBe(250);
  });
  it("buckets Melbourne midnight correctly and orders equivalent offset timestamps chronologically", () => {
    const transactions: Transaction[] = [
      { ...deposit, createdAt: "2026-11-03T12:59:59.000Z" },
      {
        ...deposit,
        id: crypto.randomUUID(),
        kind: "withdrawal",
        amountCents: 1_000,
        createdAt: "2026-11-04T01:00:00.000+11:00",
      },
    ];
    const offsetBet = bet({
      placedAt: "2026-11-04T00:00:00.000+11:00",
      settledAt: "2026-11-03T13:30:00.000Z",
    });
    const series = performanceSeries([offsetBet], transactions);
    expect(series).toEqual([
      { date: "2026-11-03", profit: 0, bankroll: 250 },
      { date: "2026-11-04", profit: 4.55, bankroll: 244.55 },
    ]);
    const utcEquivalent = {
      ...offsetBet,
      placedAt: "2026-11-03T13:00:00.000Z",
    };
    expect(performanceSeries([utcEquivalent], transactions)).toEqual(series);
    expect(series.at(-1)?.bankroll).toBe(
      calculateMetrics([offsetBet], transactions).bankrollCents / 100,
    );
  });
  it("counts multi-sport parlays once, with no duplicate P/L", () => {
    const mixed = bet({
      legs: [...bet().legs, { ...bet().legs[0], sport: "ATP" }],
    });
    const groups = groupPerformance([bet(), mixed], "sport");
    expect(groups).toEqual([
      { name: "NBA", profit: 4.55, bets: 1 },
      { name: "Mixed", profit: 4.55, bets: 1 },
    ]);
    expect(groupPerformance([bet()], "strategy")).toEqual([
      { name: "Track B", profit: 4.55, bets: 1 },
    ]);
  });
  it("shows actual calibration sample sizes, excluding pending/void outcomes", () => {
    expect(
      calibration([
        bet({ probability: 0.75 }),
        bet({ probability: 0.75, outcome: "lost" }),
        bet({ outcome: "void", probability: 0.75 }),
        bet({ probability: 1 }),
      ]),
    ).toEqual([
      { bucket: "70–80%", predicted: 75, actual: 50, count: 2 },
      { bucket: "90–100%", predicted: 100, actual: 100, count: 1 },
    ]);
  });
});

describe("provenance and demo isolation", () => {
  it("validates all generated demo data, with fictional provenance", () => {
    const demo = createDemoData(new Date("2026-11-03T00:00:00.000Z"));
    expect(appDataSchema.safeParse(demo).success).toBe(true);
    expect(demo.bets).toHaveLength(30);
    expect(demo.candidates.every((c) => c.oddsProvenance.simulated)).toBe(true);
    expect(demo.bets.every((b) => b.oddsProvenance?.simulated)).toBe(true);
    expect(
      demo.bets
        .filter((b) => b.probability !== undefined)
        .every(
          (b) =>
            b.probabilityProvenance?.source &&
            b.probabilityProvenance.simulated,
        ),
    ).toBe(true);
    expect(demo.notifications.every((n) => n.simulated)).toBe(true);
  });
  it("starts authenticated storage empty and preserves configurable experiment defaults", () => {
    const data = createEmptyData();
    expect(data.bets).toEqual([]);
    expect(data.candidates).toEqual([]);
    expect(data.transactions).toEqual([]);
    expect(data.settings).toMatchObject({
      fundingCapCents: 50_000,
      defaultStakeCents: 500,
    });
    expect(
      settingsSchema.safeParse({
        ...data.settings,
        fundingCapCents: 75_000,
        defaultStakeCents: 1_000,
      }).success,
    ).toBe(true);
  });
  it("separates hypothetical analytics from the actual ledger", () => {
    const data = createDemoData();
    const original = calculateMetrics(data.bets, data.transactions);
    const paperBets = paperAsBets(data.paperPredictions);
    paperBets[0].stakeCents = 1_000_000;
    expect(calculateMetrics(data.bets, data.transactions)).toEqual(original);
    expect(data.paperPredictions[0].hypotheticalStakeCents).toBe(500);
  });
  it("preserves reconciliation history while excluding explicitly invalid records", () => {
    const active = bet({ id: "active", outcome: "lost" });
    const incorrect = bet({ id: "incorrect", outcome: "won", lifecycle: "entered_in_error", accountingExcluded: true });
    const metrics = calculateMetrics([active, incorrect], []);
    expect(metrics.settledCount).toBe(1);
    expect(metrics.profitCents).toBe(-500);
    expect(betSchema.safeParse(bet({ id: "9d1c8b3a-3bd0-4b9f-91c3-4f4f0a6b0d1e", placedAt: null, recordedAt: "2026-10-02T00:00:00.000Z", placementStatus: "unknown_owner_reported", lifecycle: "provisional" })).success).toBe(true);
    expect(calculateMetrics([bet({ lifecycle: "provisional", placedAt: null })], []).totalBets).toBe(0);
  });
  it("rejects invalid financial inputs and probabilities without provenance", () => {
    expect(betSchema.safeParse(bet({ stakeCents: 1.2 })).success).toBe(false);
    expect(betSchema.safeParse(bet({ odds: 1 })).success).toBe(false);
    expect(betSchema.safeParse(bet({ probability: 1.01 })).success).toBe(false);
    const candidate = createDemoData().candidates[0];
    expect(
      candidateSchema.safeParse({
        ...candidate,
        probabilityProvenance: undefined,
      }).success,
    ).toBe(false);
  });
  it("rejects contradictory aggregate settlements and records exact thresholds", () => {
    expect(
      betSchema.safeParse(
        bet({ legs: [{ ...bet().legs[0], outcome: "lost" }] }),
      ).success,
    ).toBe(false);
    expect(betSchema.safeParse(bet({ outcome: "lost" })).success).toBe(false);
    expect(betSchema.safeParse(bet({ outcome: "void" })).success).toBe(false);
    expect(betSchema.safeParse(bet({ settledAt: undefined })).success).toBe(
      false,
    );
    expect(
      betSchema.safeParse(bet({ settledAt: "2026-10-01T00:00:00.000Z" }))
        .success,
    ).toBe(false);
    expect(
      betSchema.safeParse(bet({ legs: [{ ...bet().legs[0], line: "" }] }))
        .success,
    ).toBe(false);
    expect(betSchema.safeParse(bet()).success).toBe(true);
  });
  it("requires probability snapshots even when an original candidate is linked", () => {
    expect(
      betSchema.safeParse(bet({ probabilityProvenance: undefined })).success,
    ).toBe(false);
    expect(
      betSchema.safeParse(
        bet({
          probability: 0,
          probabilityProvenance: undefined,
          candidateId: crypto.randomUUID(),
        }),
      ).success,
    ).toBe(false);
    expect(
      betSchema.safeParse(
        bet({ probability: undefined, probabilityProvenance: undefined }),
      ).success,
    ).toBe(true);
    const candidate = createDemoData().candidates[0];
    expect(
      candidateSchema.safeParse({ ...candidate, line: "   " }).success,
    ).toBe(false);
    expect(
      candidateSchema.safeParse({ ...candidate, line: "N/A" }).success,
    ).toBe(true);
  });
  it("keeps pending and settled bet timestamps mutually consistent", () => {
    expect(betSchema.safeParse(bet({ outcome: "pending" })).success).toBe(
      false,
    );
    expect(
      betSchema.safeParse(
        bet({
          outcome: "pending",
          settledAt: undefined,
          legs: [{ ...bet().legs[0], outcome: "pending" }],
        }),
      ).success,
    ).toBe(true);
  });
  it("requires chronological paper settlement and clears the timestamp on pending predictions", () => {
    const paper = createDemoData(new Date("2026-11-03T00:00:00.000Z"))
      .paperPredictions[0];
    expect(
      paperSchema.safeParse({ ...paper, settledAt: undefined }).success,
    ).toBe(false);
    expect(
      paperSchema.safeParse({ ...paper, settledAt: "2020-01-01T00:00:00.000Z" })
        .success,
    ).toBe(false);
    expect(
      paperSchema.safeParse({ ...paper, settledAt: paper.registeredAt })
        .success,
    ).toBe(true);
    expect(
      paperSchema.safeParse({ ...paper, outcome: "pending" }).success,
    ).toBe(false);
    expect(
      paperSchema.safeParse({
        ...paper,
        outcome: "pending",
        settledAt: undefined,
      }).success,
    ).toBe(true);
  });
  it("calculates implied probability and expected value only with valid inputs", () => {
    expect(impliedProbability(2)).toBe(0.5);
    expect(impliedProbability(0)).toBeNull();
    expect(expectedValue(0.6, 2)).toBeCloseTo(0.2);
    expect(expectedValue(undefined, 2)).toBeNull();
  });
  it("runs functioning mock services without keys, with linked notifications and run status", async () => {
    const result = await mockResearchEngine.run();
    expect(result.run.status).toBe("completed");
    expect(result.run.simulated).toBe(true);
    expect(result.candidates).toHaveLength(8);
    expect(result.notifications).toHaveLength(8);
    expect(
      result.notifications.every((n) =>
        result.candidates.some((c) => c.id === n.candidateId),
      ),
    ).toBe(true);
    expect(createTestNotification().notification.title).toContain("Test");
  });
  it("fails explicitly rather than making live calls from future adapters", async () => {
    await expect(new TheOddsApiAdapter().getMarkets(["NBA"])).rejects.toThrow(
      "No live request",
    );
    await expect(
      new OpenAIResearchAdapter().explain(createDemoData().candidates[0]),
    ).rejects.toThrow("No live request");
  });
  it("delivers once to the mock in-process inbox and protects the stored snapshot", async () => {
    const { notification } = createTestNotification();
    await inAppNotificationProvider.deliver(notification);
    await inAppNotificationProvider.deliver(notification);
    notification.message = "Changed outside provider";
    const matching = getMockNotificationHistory().filter(
      (n) => n.id === notification.id,
    );
    expect(matching).toHaveLength(1);
    expect(matching[0].message).not.toBe(notification.message);
  });
});
