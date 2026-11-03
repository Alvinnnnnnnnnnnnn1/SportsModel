import type {
  AppData,
  Bet,
  Candidate,
  Outcome,
  PaperPrediction,
  Sport,
  Strategy,
} from "./types";
import { estimateSyntheticProbability } from "./calculations";

const uid = () => crypto.randomUUID();
const iso = (date: Date, hours = 0) =>
  new Date(date.getTime() + hours * 3_600_000).toISOString();
const fixtures: {
  sport: Sport;
  event: string;
  participant: string;
  market: string;
  selection: string;
  line: string;
  odds: number;
  observations?: { wins: number; trials: number };
  strategy: Strategy;
  rationale: string;
}[] = [
  {
    sport: "NBA",
    event: "Harbour Hawks vs Metro Wolves",
    participant: "Marcus Bell",
    market: "Player points",
    selection: "Over 19.5 points",
    line: "19.5",
    odds: 1.91,
    observations: { wins: 55, trials: 98 },
    strategy: "B",
    rationale:
      "A fictional player-points market demonstrates the potential value track. No current injury, usage, lineup or player data has been checked.",
  },
  {
    sport: "ATP",
    event: "Southern Open · Round of 16",
    participant: "Luca Moretti vs Evan Cole",
    market: "Match winner",
    selection: "Luca Moretti to win",
    line: "Moneyline",
    odds: 1.48,
    observations: { wins: 70, trials: 98 },
    strategy: "A",
    rationale:
      "A fictional match demonstrates the high probability track. Surface and form inputs are invented. A higher estimated hit rate does not guarantee a profitable price.",
  },
  {
    sport: "NBL",
    event: "Coastal Kings vs Valley United",
    participant: "Coastal Kings",
    market: "Team total points",
    selection: "Over 88.5 points",
    line: "88.5",
    odds: 1.95,
    observations: { wins: 53, trials: 98 },
    strategy: "C",
    rationale:
      "An alternative team-total market demonstrates the research workflow. All matchup data is invented; no actual pace or possession statistics are connected.",
  },
  {
    sport: "WTA",
    event: "Harbour Classic · Quarterfinal",
    participant: "Amelia Novak vs Sofia Marin",
    market: "Total games",
    selection: "Over 20.5 games",
    line: "20.5",
    odds: 1.87,
    observations: { wins: 56, trials: 98 },
    strategy: "B",
    rationale:
      "A fictional total-games market demonstrates numerical research provenance. These observations are synthetic and do not measure actual hold or break performance.",
  },
  {
    sport: "NBA",
    event: "Capital Comets vs Pacific Bears",
    participant: "Daniel Price",
    market: "Player rebounds",
    selection: "Over 7.5 rebounds",
    line: "7.5",
    odds: 2.05,
    observations: { wins: 50, trials: 98 },
    strategy: "C",
    rationale:
      "A niche prop demonstrates alternative-market tracking. Player, event and price are fictional. Synthetic results cannot establish a statistical advantage.",
  },
  {
    sport: "NBL",
    event: "Metro Falcons vs Southern Sharks",
    participant: "Metro Falcons",
    market: "Match winner",
    selection: "Metro Falcons to win",
    line: "Moneyline",
    odds: 1.55,
    observations: { wins: 67, trials: 98 },
    strategy: "A",
    rationale:
      "A fictional high probability scenario demonstrates interface behaviour. No actual team statistics or market feed is connected; original price and estimate provenance are retained.",
  },
  {
    sport: "ATP",
    event: "River Masters · Round of 32",
    participant: "Noah Sterling",
    market: "Player aces",
    selection: "Over 8.5 aces",
    line: "8.5",
    odds: 2.1,
    strategy: "C",
    rationale:
      "A synthetic alternative-market watch item with no defensible probability estimate. EV is intentionally unavailable until a documented numerical model exists.",
  },
  {
    sport: "WTA",
    event: "Coastal Open · Round of 16",
    participant: "Isabel Laurent",
    market: "Match winner",
    selection: "Isabel Laurent to win",
    line: "Moneyline",
    odds: 1.62,
    observations: { wins: 64, trials: 98 },
    strategy: "A",
    rationale:
      "An entirely fictional match demonstrates the high probability strategy. The synthetic observations have no evidential betting value.",
  },
];

export function createMockCandidates(now = new Date()): Candidate[] {
  return fixtures.map(({ observations, ...fixture }, index) => ({
    ...fixture,
    id: uid(),
    bookmaker: index % 2 ? "Demo Exchange" : "Demo Sports",
    uncertainty: "illustrative",
    registeredAt: now.toISOString(),
    startsAt: iso(now, 3 + index * 2),
    oddsProvenance: {
      source: "EdgeLab synthetic market fixtures",
      timestamp: iso(now, -0.08),
      method: "Static mock price; no bookmaker connection",
      modelVersion: "fixture-odds-v1",
      simulated: true,
    },
    ...(observations === undefined
      ? {}
      : {
          probability: estimateSyntheticProbability(
            observations.wins,
            observations.trials,
          ),
          probabilityProvenance: {
            source: "EdgeLab synthetic counts; no real observations",
            timestamp: now.toISOString(),
            method: `Laplace smoothing of fictional counts: wins=${observations.wins}, trials=${observations.trials}; (wins+1)/(trials+2) = ${observations.wins + 1}/${observations.trials + 2}. Illustrative only; no runtime AI.`,
            modelVersion: "synthetic-frequency-v1",
            simulated: true,
          },
          rationale: `${fixture.rationale} Deterministic illustrative estimate from synthetic observations; no runtime AI.`,
        }),
  }));
}

export function createEmptyData(): AppData {
  return {
    version: 1,
    settings: {
      fundingCapCents: 50_000,
      defaultStakeCents: 500,
      currency: "AUD",
      timezone: "Australia/Melbourne",
    },
    bets: [],
    transactions: [],
    candidates: [],
    paperPredictions: [],
    notifications: [],
    researchRuns: [],
    audit: [],
  };
}

export function createDemoData(now = new Date()): AppData {
  const data = createEmptyData();
  data.candidates = createMockCandidates(now);
  const outcomes: Outcome[] = [
    "won",
    "lost",
    "won",
    "won",
    "lost",
    "won",
    "lost",
    "won",
    "won",
    "lost",
    "won",
    "won",
    "lost",
    "won",
    "won",
    "lost",
    "won",
    "lost",
    "won",
    "won",
    "lost",
    "won",
    "won",
    "lost",
    "won",
    "won",
    "void",
    "pending",
    "pending",
    "pending",
  ];
  data.transactions = [
    {
      id: uid(),
      kind: "deposit",
      amountCents: 25_000,
      createdAt: iso(now, -31 * 24),
      note: "Synthetic starting funds. No real transfer.",
    },
  ];
  data.bets = outcomes.map((outcome, index): Bet => {
    const candidate = data.candidates[index % data.candidates.length];
    const placedAt = iso(now, -(30 - index) * 24);
    const bonus = index === 18;
    return {
      id: uid(),
      placedAt,
      confirmedAt: placedAt,
      ...(outcome === "pending"
        ? {}
        : { settledAt: iso(new Date(placedAt), 3) }),
      bookmaker: candidate.bookmaker,
      stakeCents: 500,
      stakeType: bonus ? "bonus" : "cash",
      odds: candidate.odds,
      outcome,
      strategy: candidate.strategy,
      notes: "Synthetic demonstration ledger entry. No wager was placed.",
      probability: candidate.probability,
      oddsProvenance: { ...candidate.oddsProvenance, timestamp: placedAt },
      ...(candidate.probabilityProvenance
        ? {
            probabilityProvenance: {
              ...candidate.probabilityProvenance,
              timestamp: placedAt,
            },
          }
        : {}),
      legs: [
        {
          id: uid(),
          sport: candidate.sport,
          event: candidate.event,
          participant: candidate.participant,
          market: candidate.market,
          selection: candidate.selection,
          line: candidate.line,
          odds: candidate.odds,
          outcome,
          ...(outcome === "pending"
            ? {}
            : {
                statistic:
                  outcome === "won"
                    ? "Synthetic selection met"
                    : outcome === "void"
                      ? "Synthetic event cancelled"
                      : "Synthetic selection not met",
              }),
        },
      ],
    };
  });
  data.paperPredictions = Array.from(
    { length: 12 },
    (_, index): PaperPrediction => {
      const registeredAt = iso(now, -(12 - index) * 24);
      const outcome: Outcome =
        index > 8 ? "pending" : index % 3 === 0 ? "lost" : "won";
      const candidate = {
        ...data.candidates[index % data.candidates.length],
        id: uid(),
        registeredAt,
        startsAt: iso(new Date(registeredAt), 1),
        oddsProvenance: {
          ...data.candidates[index % data.candidates.length].oddsProvenance,
          timestamp: registeredAt,
        },
        ...(data.candidates[index % data.candidates.length]
          .probabilityProvenance
          ? {
              probabilityProvenance: {
                ...data.candidates[index % data.candidates.length]
                  .probabilityProvenance!,
                timestamp: registeredAt,
              },
            }
          : {}),
      };
      return {
        id: uid(),
        candidate,
        registeredAt,
        hypotheticalStakeCents: 500,
        outcome,
        ...(outcome === "pending"
          ? {}
          : {
              settledAt: iso(new Date(registeredAt), 3),
              statistic: "Synthetic demonstration result",
            }),
      };
    },
  );
  data.notifications = data.candidates
    .slice(0, 4)
    .map((candidate, index) => ({
      id: uid(),
      candidateId: candidate.id,
      title: `Simulated ${candidate.sport} research opportunity`,
      message: `${candidate.participant} · ${candidate.selection}. Synthetic data, research only.`,
      createdAt: iso(now, -index * 0.5),
      simulated: true,
      ...(index > 1 ? { readAt: iso(now, -index * 0.25) } : {}),
    }));
  data.researchRuns = [
    {
      id: uid(),
      startedAt: iso(now, -0.1),
      completedAt: iso(now, -0.09),
      status: "completed",
      candidateCount: data.candidates.length,
      simulated: true,
    },
  ];
  return data;
}
