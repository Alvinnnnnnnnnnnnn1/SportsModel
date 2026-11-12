# V6 real-data pilot — 11 November 2026

12 November continuation: [team-shadow final results](v6-shadow-results-20261112.md) and [disabled controlled-worker readiness](v6-controlled-readiness.md). One strict verified fixture; nine unresolved clock discrepancies. Ten cumulative odds credits/490 remaining. The player-prop evidence below is a preserved earlier checkpoint.

Later milestone: the [NBA team-moneyline pilot](v6-team-moneyline-pilot.md) resolves current **game-level** data using BALLDONTLIE and freezes genuine experimental forecasts/quotes. The player-stat/identity findings below remain valid for this earlier prop sample; they do not block team-market research. No prospective paper settlement is claimed by either checkpoint.

**Result: genuine source collection and blocked shadow screening, not a completed prospective paper lifecycle.** No paper position, settlement, hosted write, policy activation or real wager occurred. Code milestone: `f161368`, branch `feature/v6-autonomous-paper`. Existing personal account, 46 historical sources, legacy actual/paper positions, funding and Methodology Revision 1 were untouched.

## Genuine source observations

The configured existing free keys were used only by an explicitly invoked server-side collector. No key, account detail or raw sports dataset was committed. Files remain in ignored `.local/v6/` with private permissions.

| Observation | Actual result | Retained SHA-256 |
| --- | --- | --- |
| NBA free subscription, final check 07:52:46.774 UTC | Active Free, 100/day, current usage 3; headers show 97 remaining. Personal account fields discarded | `fe326c08d4fd1debf91ca6f7ed9886fa1b17c204a8570a61421577caec381b3d` |
| Current NBA season 2026, 07:43:42.923 UTC | Explicit plan denial; provider recommends seasons 2022–2024 | `3ce2c4070eb30ed097893aa66672a12e9a0102e328052b9592e4a5693979cfa0` |
| Historical player profile, 07:41:16.182 UTC | One Jakob Poeltl profile, API-NBA ID `428` | `afd88e298d69d24cd24341271e25a56b0117cc58bd8507ccd2bc605b9ef33a34` |
| Historical season 2023 games, 07:41:33.108 UTC | 1,390 fixtures | `75441aeeea020e2fb39aebf1687214413a6bf9125226dba93119a6e8f80caa83` |
| Player `428`, season 2023, 07:41:50.382 UTC | 52 player-game rows, all joined to exact source fixture IDs | `100a82bb2afc7eeac9e76917f55c480f40e4fc89084de3831817c4a56869b78a` |
| Sportsbet NBA player points, 07:39:33.371 UTC | Ten over/under outcomes, market update 07:38:43 UTC; original prices/lines retained locally | `4af62606ecabceb5dfc7c71b55f449b5fd5ea5c5ef1aa8eb64550b3f7a12bf2e` |

Times are UTC on 11 November (add eleven hours for Melbourne). The observed upcoming event is Toronto–Boston, odds event `37f4c00ff7ec01d5aa7c33dd1ac84bbc`, source start `2026-11-12T00:10:00Z`, Sportsbet event SID `11151326`. **No corresponding statistics game ID or cross-provider player identity is verified.** `includeSids=true` returned null market/outcome SIDs; no player participant IDs were supplied. The documented [participants endpoint](https://the-odds-api.com/liveapi/guides/v4/#get-participants) returns NBA teams, not roster players; it cannot solve this player join. A bookmaker event SID is not a player ID.

Actual odds usage this turn: **one new free credit**, five cumulative, **495/500 remaining**. There were three odds HTTP reads: free catalogue, free NBA event list and one charged event-points read. The new shared counter adopts the previous four reservations; the bounded extension permits at most six cumulative pilot credits with a 100-credit reserve. This is an acquisition quota, not a position-volume cap. No more reads are needed while identities/features are blocked.

NBA transport made nine requests: four free status checks, three successful data reads and two denied current-season probes. Five data attempts were conservatively reserved locally; provider final usage is **3/100**, not five billed credits. The first denied probe failed closed on absent quota headers before its body was retained; the second retained the explicit denial. Failed/uncertain reservations are not silently refunded. Status recovery restored known free quota. One initial identical status response reused its first content timestamp; the evidence store now retains a separate immutable receipt for every fetch, preserving later actual retrieval times.

The [API-Sports terms](https://api-sports.io/terms) permit API-backed projects but do not grant all upstream publication/commercial rights. These samples remain private research; public redistribution and future production-use rights are not asserted. [The Odds API terms](https://the-odds-api.com/terms-and-conditions.html) explicitly permit research, storage and derived models. Direct Sportsbet automated market collection remains unapproved; the prior pinned collector-code audit grants no upstream permission. No direct market/account request, identity spoofing, access bypass or alternative filter to evade the NBA season restriction was attempted. No third-party collector server was installed.

## Canonical mapping status

`identity-registry.server.ts` persists versioned append-only mapping revisions with source hashes, original start time, league/nullable season, separate internal/odds/bookmaker/statistics identifiers, exact market/side/line/full-game/overtime terms and nullable authority evidence. Conflicting replay and stale revision/clock changes fail. A verified mapping requires non-name cross-provider identifier evidence; arbitrary JSON paths cannot repurpose a price/name as identity proof.

The actual journal contains **ten blocked selection mappings**. It preserves the observed odds fixture/SID and all missing fields. The one matching statistics profile is a **name-only suggestion**, not a verified bridge. Upcoming season, statistics fixture ID, canonical player link, player ID in the odds response and frozen rule-source approval remain unresolved. Verified cross-provider mappings: **zero**. No provisional ID is used to admit a paper entry.

## Independent NBA baseline

`nba-points.ts` implements `nba-points-shrunk-gamma-poisson / experimental-1` from real historical logs. It separates expected minutes from scoring rate. Ten recent minutes are shrunk toward the disjoint earlier-history minutes mean; rate uses a Gamma prior estimated from earlier points/minutes with 60 prior minutes, updated by recent points and exposure. The predictive full points distribution is a mixture of Gamma–Poisson negative binomials over the shrunken minutes components. Rate/minutes conditional SD, frozen inputs, source hashes and exact threshold/push probabilities are retained; unresolved tail mass rejects the forecast.

Predeclared controls: at least 20 completed participating games, provider stage code 2 only, maximum 45 days since the latest game, support 0–250 points, supported thresholds through 100. This is a limited experimental model cohort, not a universal NBA model. Features require exact IDs, positive observed minutes and final evidence available by the cutoff. Missing minutes/points stay null; zero minutes do not alone prove DNP. The known availability time is the later of fixture and box-score retrievals. No injuries, lineups, usage, rest effects or expected minutes are invented as source facts.

Chronological evaluation used **30 held-out player-games**, each with five predeclared half-point thresholds (150 correlated threshold observations). Prior-game features alone determine each forecast. The benchmark is a smoothed empirical historical exceedance probability. Original historical publication times are unavailable: this is **retrospective chronological research**, not an archived point-in-time backtest or pre-registration. Calculation timestamps are actual calculation times, separate from historical feature cutoffs; every score retains an input hash.

| Score, lower is better | Experimental baseline | Historical benchmark |
| --- | ---: | ---: |
| Brier | 0.1146983462 | 0.1090586482 |
| Log loss | 0.3574099262 | 0.3418322899 |

The model underperformed. No advantage, calibration claim or model activation follows. One player's sample cannot establish NBA-wide validity; thresholds from the same game are dependent. Minutes/rate dependence, injuries, distribution misspecification, historical stat revisions and season drift remain limitations. The 2023 logs are also too old for this upcoming event: current probability and EV remain **null**. No historical odds exist in this dataset, so bookmaker-baseline forecasting scores, CLV and profitability were not manufactured.

## Actual shadow and grading evidence

`analyse-v6-nba-pilot.mjs` normalizes retained sources, evaluates the baseline, appends only missing blocked mappings and runs the existing worker in **dry_run**. The worker journals all ten unmapped source exclusions without inventing canonical observations. Re-analysis returns `already_processed` for the same source hash, survives a fresh repository and never promotes a prior shadow row.

All ten source outcomes were retained; **zero eligible proposals, zero registrations, zero settlements**. Reasons include missing non-name mapping, null odds-player identifiers, absent current history/stale features and quote expiry by analysis time. The actual historical probability estimate is not copied onto an unmapped current player. Negative available balance, unlimited positions, A$5,000 reference and A$50 fixed unit remain unchanged.

`nba-grading.ts` now implements exact final game/player points, full-game/overtime rules, integer-line pushes, and DNP voids only with positive participation evidence and a frozen supported rules hash. [Overtime](https://helpcentre.sportsbet.com.au/hc/en-us/articles/18431711744781-Does-My-NBA-Bet-Include-Overtime) and [DNP](https://helpcentre.sportsbet.com.au/hc/en-us/articles/18431742362125-My-Player-Did-Not-Play-What-Happens-To-My-Bet) references informed the rule adapter; no rules version was activated. Missing participation, wrong player/team/fixture, unsupported terms or nonfinal results stay unresolved. Missing publication time stays null; actual final-observation time and immutable raw evidence are separate. Identical result bytes with a later fetch receipt do not create another settlement.

These grading/settlement/revision/restart/concurrency checks use **synthetic local fixtures**, not the upcoming real event. No genuine registered position or verified completed result exists for this pilot. The target end-to-end prospective lifecycle has **not passed**.

## Executable evidence and next gate

Safe **offline**, no source calls, no registrations:

```bash
node scripts/analyse-v6-nba-pilot.mjs \
  --odds-directory .local/v6/nba-shadow-2026-11-11T07-38-55-846Z \
  --history-directory .local/v6/nba-shadow-2026-11-11T07-40-58-457Z
```

Latest detailed analysis: ignored `.local/v6/shadow-reports/ae9b0c47ed5d6dc50802e5d9c36998d04a004b6bf2f0fa7ab47d7bf7b0318563.json`. Raw samples, mapping journals, quota receipts and local dry-run state are retained under `.local/v6`; no account export is needed. Collector reruns are unnecessary while these blockers remain.

Next Codex task: establish a permitted **current** NBA player-game source and an authoritative identifier crosswalk/rule registry, then connect and test the real collector/model/grader ports. Do not change filters to bypass the configured free plan, substitute old logs, approve a weak model or relax identity gates. If no permitted free source can satisfy these requirements, report that A$0 NBA-prop autonomy is blocked rather than deploying a fabricated pilot. A source file already lawfully available to the owner may be reviewed locally, without sending credentials. Migration/production activation approvals remain separate; they cannot solve missing data. See [deployment and rollback readiness](v6-deployment-readiness.md).
