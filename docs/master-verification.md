# Master implementation and verification — 6 November 2026

This is a local continuation, not a rebuild or hosted deployment. No hosted application records, settings, funding, historical imports, settlements, accounts or approved methodology were written during development. No migration was created/applied. The API audits read public sports data using the existing free key; those are separate from the synthetic application tests.

## 1. Recovered unfinished P0

Preserved and completed the interrupted daily workspace, research-origin placement prefill, archive-only research intake, append-only Watch/Pass journals, strict result contract, unified queue and app/history batch transforms. Fixed background refresh so checking results does not unmount drafts; fixed accessible prompt naming, missing-fact paper eligibility, UTC settlement normalization, paper-summary counting and research context after settlement.

## 2. Implemented daily workflow

Research JSON v1 → preview/archive only → actionable cards → separate actual financial confirmation or pre-event paper approval → manual/source/provider result proposals → final reviewed batch → persistence → analytics/next handoff. Day completion is separate. Existing JSON backup, historical review, notification and actual-ledger paths remain available. Original quote and actual accepted price remain separate. Source links and original forecasts are retained. Exact import/session and settlement replays cannot register a second position/result.

## 3. Incomplete scope

No scheduled polling, autonomous research, live bookmaker odds, bookmaker account access, automatic wager execution, push infrastructure, calibrated forecasting model, model training, automatic model promotion/rollback or correlation-aware SGM simulation. Free-plan coverage is partial. Original/closing comparable prices, original settlement times and missing model features/input cutoffs are not manufactured. Provider proposals leave missing settlement/completion time null, requiring explicit entry in the review form. Current NBA player coverage was not established by the sampled recent-date request.

## 4. Actual API-NBA findings

The locally configured key confirmed active **Free** access, 100 daily requests, 6 leagues and 12 seasons. Historical season 2023 returned 1,390 games. Exact game 12478 returned **36 player rows** with non-null points, total rebounds, assists, made threes and minutes. Team identities, season team statistics, player roster, game team statistics and standings returned sampled data. A broad season read exposed an exact-game cache-eviction join issue; the adapter now reloads a missing exact fixture before normalizing statistics, with a regression test and successful live retest.

Season 2026 was rejected by the free plan. An explicit historical date filter was also denied with a different permitted-date window. The recent-date-only query for 4 November 2026 succeeded but returned **zero games**. Historical success does not establish current NBA coverage. All successes, failures and query parameters remain in the [sanitised report](reports/api-sports-coverage.json).

## 5. Actual API-Basketball/NBL findings

The same key independently confirmed active **Free Basketball** access, 100/day. Australia discovery returned 16 leagues, with NBL ID 1. Coverage flags alone were not accepted as proof. The 2023–24 season returned 154 games; game 394747 returned **18 player rows** with all five required fields. Sampled game team statistics returned 2 rows and the roster 16 players.

A whole-season 2026–27 query was rejected. A recent-date-only query worked: exact NBL game **501228**, start **4 November 2026 09:00 UTC**, season 2026–27, final, returned **19 player rows** with the required fields. This is verified sampled recent coverage, not a guarantee of every NBL fixture or future quota entitlement.

## 6. Actual TheSportsDB findings

The requested Arsenal call returned **HTTP 200**, Arsenal **133604**. Country/sport league discovery found NBA 4387 and Australian NBL 4434. Past-league reads returned one final-score event each. Both sampled event-stat responses were **null**. Free team search remains Arsenal-only; schedules/discovery can be truncated. No NBA/NBL player-prop or ATP/WTA automated grading coverage is claimed. See [the report](reports/sportsdb-coverage.json) and [coverage matrix](sports-data.md#actual-sampled-coverage).

## 7. Quotas

The audit reserved **18 NBA** and **12 Basketball** app requests, including rejected reads and the normalization correction. Final provider headers reported **86 / 90 daily credits** remaining and **9/minute**. Provider accounting can differ from conservative app reservations. Seven public SportsDB reads succeeded including Arsenal. No live 429 occurred.

Transport tests cover one queue/provider, SportsDB 20/minute and >=3-second spacing, each API-Sports API capped at 70/day and 6/minute, header exhaustion, UTC resets, restart reservations, bounded 429 retry/Retry-After, cooldown, cancellation and shared in-flight reads. Quotas cannot be reset by refreshing a page. Exclusive local process ownership rejects a second live process. Serverless/distributed deployment is disabled; this is not a distributed limiter.

## 8. Cache and identities

Bounded in-process caches: identities 24h; fixtures 15m; player/game observations 2h; status 1m; negative results 15s. Identical requests share one fetch. Quota counters/window/cooldowns persist privately in ignored `.local/sports-provider`, without credentials. Approved final result evidence persists through existing source receipts/audits. Unreviewed cache observations are not permanent official results.

Provider event/player namespaces, league, season, UTC fixture time, retrieval time, source reference, statistic units and completeness are retained. Unknown source-observation time remains null. No fuzzy identity merge is performed. The owner can explicitly save reviewed per-position provider identity journals. Check Results reuses matching mappings for at most three fixtures/click and fetches each game's box score once. A changed position hash invalidates its mapping; another workspace has no access to its journals.

## 9. Supported props

Conservative, mock-tested final full-game grading: player points/rebounds/assists/made threes, PR, PA, RA and PRA; explicit over/under/at-least alternate thresholds. Required numbers and participation must be present. Unknowns stay null. Ambiguous periods, pushes/DNP/postponement/retirement, unclear overtime/void/dead-heat terms remain pending/manual.

## 10. Singles and multis

Research v1 retains an optional backward-compatible exact `legs` array. Unknown leg prices stay null; original combined quote is separate. Final individual-leg values, outcomes and clearance margins are retained. Multi outcome proposals require complete matching leg evidence. **Combined probability unavailable — correlation not validated** is shown; no independent multiplication or theoretical combined bookmaker price is generated. Mixed-void/repriced multis require individual reviewed handling; the pending batch does not invent adjusted terms or payouts.

## 11. Forecast models

No validated numerical forecasting model exists. `describePlayerHistory` supplies reproducible descriptive count/mean/deviation from pre-cutoff observations, with null probability/EV and sample limitations. Unsupported LLM forecasts remain blocked. Source origin labels alone are not independent verification.

## 12. Paper learning

The evaluation export is functional for qualifying pre-event, attributable registrations and audited final results: hypothetical cash/bonus separation, hit rate/Wilson interval, Brier, log loss, calibration, original implied-odds baselines, model/sport/market/strategy groups and per-forecast residuals. Certainty errors retain an explicit infinite-log-loss count. Synthetic exports are labelled; incomplete/retrospective history is excluded. CLV/features/unrecorded input cutoffs stay null.

Offline manifest review is **foundational only**: frozen dataset hash, chronological train/validation/freeze/test boundaries, pre-event input and outcome availability, duplicate and fixture leakage checks, minimum 100/30/30 independent fixtures. There is no live training or activation. An imported `ownerApproved` value does not authorize promotion. Adequate source data, model comparison, independent unseen validation and a separately reviewed owner-approval/rollback system are prerequisites.

## 13. Database and security

No new schema is needed for the implemented paths. All three existing migration SHA-256 values are unchanged; the methodology module and proposed Revision 1 JSON hashes are unchanged. App and imported-history persistence use existing RLS/revision-controlled RPCs. Each workspace save is atomic; a mixed batch uses **two transactions**, reports partial success and retries only remaining rows. Original forecasts/audits are not overwritten.

The sports POST proxy validates a normal Supabase user with public project credentials; no service-role key. It requires same-origin loopback HTTP, server-only configuration and allowlisted operations. The private API key appears in outbound server headers only. A final client-bundle scan found zero key occurrences in 42 JavaScript files. Anonymous requests returned 401; foreign-origin requests 403, without provider quota use.

## 14. Tests

- `EDGELAB_POSTGRES_RUNTIME=/private/tmp/edgelab-db-validation npm test`: **575/575**, 37 files, including four real local PostgreSQL lifecycle tests using ordinary authenticated roles.
- `node scripts/check-database.mjs --runtime /private/tmp/edgelab-db-validation`: **70/70**.
- `node scripts/check-import-database.mjs --runtime /private/tmp/edgelab-db-validation`: **77/77**.
- `npm run typecheck`: passed.
- `npm run lint`: passed, no warnings.
- `npm run build`: production build passed; final bundle recheck is recorded in the continuation checkpoint.
- Production browser regressions: **103/103 groups** across daily cycle (15), seven-route/mobile checks (22), Auth (11), import (12), handoff (17), continuity/methodology (7), archived wager claims (12), private read-only workspace (7). All use fresh synthetic/mock contexts and blocked external application transport. See [summary](reports/master-browser-summary.json) and [daily report](reports/daily-workflow-browser.json).

The old handoff assertion was corrected because an archived-only loss must not enter registered-paper returns. The continuity harness now opens the prompt tab after reload and checks the current source-time placement heading. Prompt wording was shortened; the standard synthetic Demo handoff is 15,960 characters without embedding the JSON Schema. The full methodology remains downloadable; clipped excerpts carry an explicit warning. No policy content was changed.

## 15. Setup

No new dependency or account is required. Keep the existing Supabase sign-in and public environment settings. Run `npm run dev`. The manual research/result workflow needs no sports key.

The owner saved `API_SPORTS_KEY` locally and it was tested without printing it. To enable optional in-app reads, set `EDGELAB_SPORTS_DATA_MODE=local-single-process` in the ignored `.env.local` and restart the one local server. Do not prefix the key with NEXT_PUBLIC. Keep `.local/sports-provider` quota state. See [sports setup](sports-data.md) for operations and restrictions.

## 16. Daily usage

Research → Run Daily Research → copy prompt to ChatGPT → import structured research in Daily workspace → review candidates → explicitly approve paper or confirm accepted actual ticket details → Results and settlements → Check Results with saved identities, manual evidence, or separate settlement JSON → review terms/payout/legs → final batch authorization → inspect Analytics and generate the next handoff. Export complete experiment for backup. NO BET/Watch/Pass and unresolved results are valid outcomes. Actual wager execution remains outside EdgeLab.

## 17. Hosted verification limit

**No hosted financial data was modified.** Existing personal/test accounts, Maxey, eight historical claims, Day 6/7 research/papers, audit history, funding cap and Revision 1 were not imported, copied, settled or rewritten. No A$500 deposit was invented.

This development does **not** claim a positive personal authenticated browser roundtrip through the new sports proxy, a hosted mixed settlement batch or long-duration hosted Auth/email delivery test. Prior hosted checkpoints remain historical evidence; current normal-role database and browser tests are local. A positive hosted lifecycle requires separately approved genuine pre-event source records and explicit UI financial/result approval. Do not relabel synthetic research to pass production provenance restrictions.

## 18. Next step and continuation

Start one genuine future daily session through the existing signed-in workspace, retaining null probability/EV when no independent forecast exists. First inspect optional provider status read-only; use the demonstrated NBL date/exact-game route and manual NBA/tennis fallback where unavailable. Review one qualifying paper registration before considering a larger research sample or forecasting model work. No account recreation or repeat historical import is necessary.

See [checkpoint](master-implementation-checkpoint.md), [operating workflow](daily-workflow.md), [sports setup/coverage](sports-data.md). The recovered V3 supplement is privately staged as **unapproved source evidence** under `.local/methodology-v3-supplement`; approved Revision 1 remains authoritative.

## Main files changed

- Daily UI: `src/components/daily-workspace.tsx`, `bet-form.tsx`, Handoff/Response review, app/history providers, Overview and imported-paper summaries.
- Results: `src/components/results/`, `src/lib/results/`, `src/lib/daily/`, separate settlement JSON Schema.
- Sports: `src/lib/sports/`, `src/components/sports/`, `src/app/api/sports/route.ts`, `.env.example` and bounded read-only audit scripts/reports.
- Evaluation: `src/lib/learning/`, `src/components/paper-learning.tsx`, Analytics.
- Research contract/context: `src/lib/handoff/contract.ts`, `response.ts`, `context.ts`, compatible downloadable schema.
- Tests: daily persistence/SQL, result domain, sports transport/grading, reviewed provider results, paper learning and updated browser harnesses.
- Documentation: README, AGENTS, architecture/database/approval/verification/roadmap, daily operation, sports coverage and continuation checkpoint.

No migration, package or lockfile change. All changes remain local and uncommitted.
