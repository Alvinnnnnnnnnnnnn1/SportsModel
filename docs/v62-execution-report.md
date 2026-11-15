# V6.2 multi-market execution — 15 November 2026

Branch: `feature/v6-2-multimarket-research`, stacked on V6.1 `35580e7`. No merge or deployment. This task used retained evidence and disposable tests only: **zero sports-provider requests, new genuine PAPER entries, hosted writes or financial changes**.

## Missed 19:00 discovery: evidence and limits

All times below are Australia/Melbourne, 14 November 2026.

| Actual evidence | Time / finding |
| --- | --- |
| Earlier results job claimed | 18:00:44.302 |
| Successful committed source-only worker run | 18:03:59.970 |
| Discovery due / final deadline | 19:00 / 21:00 |
| Discovery claimed | 19:39:05.327 |
| First BDL games page retained | 19:39:05.800, 100 rows; receipt `28a4f0b2-1a6b-4f58-a89b-7baf4656131f` |
| Next-page failure retained | 20:39:57.435: `Team source transport failed; reservation retained, no retry` |
| Retry due | 20:41:57; never claimed |
| Final status | `missed`, `deadline_elapsed_no_backdating`; original transport error remains in attempt history |

Read-only `pmset -g log` confirms repeated Maintenance Sleep: Sleep at 19:39:02 for 3,652 seconds, DarkWake at 20:39:54, Sleep at 20:40:10 for 3,653 seconds, then DarkWake at 21:41:03, after the job deadline. The Mac was not continuously available across pagination/retry. The old transport catch discarded the underlying exception, so **DNS, network availability and timeout cannot be distinguished retrospectively**. Sleep is established; the precise low-level transport failure is unknown.

The two additional Odds credits (11 → 13) belong to the earlier 18:00 scores request, not the failed discovery. Its source receipts and independent BDL checks concern older observational events, not P0 settlements. The old audit's `lastActualScheduledWorkerInvocation=null` was incorrect: it read the latest failed health receipt and hid the prior committed results run.

### Implemented recovery and diagnostics

- Separate latest attempt, successful scheduled worker, provider capture, fixtures discovered, frozen research and PAPER registration. Backfill actual prior success from validated source-only repository runs.
- Retain fixed-name/code transport diagnostics without messages, stacks, credentials or query URLs. Preserve original attempt errors when recording deadline expiry.
- Recheck claim ownership, original deadline and 15-minute execution lease before another provider reservation, worker invocation and commit. A late response may be checkpointed but cannot authorize another read or publication. Lease expiry can retry only within the original deadline.
- Checkpoint successful feature pages by exact query, source hash, cursor and four-hour window. A bounded retry reuses successful pages, retains failed reservations and never replays an expired historical job. Invalid retained pagination fails closed without another HTTP call.
- Correct the local result writer to use its injected verification clock, including date-rollover regression coverage.

No sleeping-host setting, LaunchAgent, source plan, authority receipt or worker installation was changed. Code cannot execute while the Mac sleeps. Reliable scheduled collection still requires an awake, network-connected Mac or a separately approved host handover. No expired job was retried.

## Markets, models and evidence

The typed registry separates retained source evidence, model support, validation, exact grading and registration authority across NBA/NBL moneyline, spread, total and points/rebounds/assists/threes/PRA/PR/PA/RA, plus ATP/WTA winner and set/game handicaps/totals. Alternate lines retain exact thresholds. Unsupported candidates remain visible with exclusions.

Normalization preserves Sportsbet identity, raw-source hashes, original quote/event clocks, exact period, selection, side, signed line, player identity and reviewed settlement terms. It rejects ambiguous identities, conflicting duplicates and incomplete two-sided lines. Independent spread/total reconciliation verifies original quote identity and two retained final-result sources; it produces observational outcomes, never financial grades. Unproven cancellation/void terms remain unresolved.

Genuine retained inventory: **38 NBA moneyline quote observations and ten NBA player-points observations**. These are historical snapshots, not current usable coverage. No retained Sportsbet spread/total, NBL or tennis quotes were found. No live coverage was asserted or requested.

### Actual score-model evaluation

Executed `node scripts/analyse-v62-markets.mjs` with network transport disabled. The unchanged 5,600-row source journal deduplicates to **5,082 NBA fixtures**, zero conflicts. New opponent-adjusted offense/defense, training-only home effect, shrinkage and score-variance/tail mixture produce separate margin and total distributions, integer pushes and sensitivity ranges. NBA final margins condition out ties. Models refit on strictly earlier UTC dates with a rolling 900-game maximum; no test-period parameter search. Missing possessions, injuries and reliable complete rest schedules are not invented.

Frozen protocol: `team-score-distribution/research-1`. Analysis lines were declared before this execution: spreads −7.5/0/+7.5 and totals 200.5/220.5/240.5. These are **analysis thresholds, not historical Sportsbet lines**. Three correlated lines per family are not three independent games. Calendar blocks differ from the existing Elo model's season blocks and must not be compared as identical samples.

| Calendar block | Family | Unique fixtures | Model / baseline Brier | Model / baseline log loss |
| --- | --- | ---: | --- | --- |
| 2023 development | Spread | 1,168 | .203340 / .222109 | .592901 / .635351 |
| 2023 development | Total | 1,168 | .150467 / .159932 | .461401 / .486833 |
| 2024 validation | Spread | 1,236 | .203539 / .229618 | .592867 / .651526 |
| 2024 validation | Total | 1,236 | .162870 / .171784 | .493068 / .517836 |
| 2025 later test | Spread | 1,241 | .204282 / .228112 | .594654 / .648253 |
| 2025 later test | Total | 1,241 | .149215 / .157412 | .457597 / .481176 |
| 2026 monitoring | Spread | 899 | .199489 / .230656 | .584359 / .653589 |
| 2026 monitoring | Total | 899 | .154893 / .163912 | .472554 / .495999 |

The comparator is a training-only league-score mean/variance baseline. Historical source publication times are incomplete and this history was inspected previously. Calibration buckets and prediction errors are retained, but neither these scores nor model agreement prove a sportsbook edge, pristine holdout or prospective calibration. Historical bookmaker benchmarks, EV and CLV are **unavailable** without original market prices. No model was promoted.

Actual score artifact: `12eff7a1b7da451f22b72c46e7b74f179848a2947d22b5d7c3d054dec100b37c`; independent repeated offline runs and serialized restoration reproduce it. Dataset SHA-256: `31aa630215a5583b90f87f92e6193883a778f6795a9068f2014118685c9283a0`. Private report `.local/v6/multimarket/reports/95d57be7b1904dd864c0fe9e26dcacce1841f6a52c4cd22882db293daf81234c.json` retains all evaluations, provenance and screened exclusions. It is not committed or served raw.

The existing minutes-mixture Gamma-Poisson player-points prototype remains conditional on playing. Its 191 retained player rows end 4 April 2025; 157 evaluated player-games score Brier .133360 versus .129568 and log loss .435124 versus .408188 for the simple benchmark. It underperforms. Current logs, role/rotation, injury and DNP evidence remain absent; BDL Free is not treated as a stats/injuries entitlement. Other props lack fitted/evaluated distributions. NBL has a reusable score-input interface but no evaluated dataset. Tennis remains blocked on source-permitted match history, exact identities, surfaces and serve/return data; no generic tennis probability was added.

## Source integration and authority

The optional expanded adapter supports featured `h2h,spreads,totals` and event-level additional markets behind a **separate exact-hash owner receipt**. Existing scheduled reads remain NBA h2h only. A future three-featured-market request reserves up to three credits using the existing shared quota, reserve and stop controls; it replaces the relevant h2h read rather than adding an unbounded second worker. Actual quota headers are retained. Event-level markets require their own approved scope.

Provider costs and market keys were checked against [official V4 documentation](https://the-odds-api.com/liveapi/guides/v4/) and [market definitions](https://the-odds-api.com/sports-odds-data/betting-markets.html). Additional markets use event endpoints; `/participants` costs one credit. Documentation does not establish Sportsbet coverage. No API request was made to verify new coverage in this task.

All new candidate screens retain every evaluated selection, including price-only rows with null forecast/EV, and fixture correlation groups. Expected value requires a matching numerical model and attributable evidence. The new review artifact `ops/v62-research-activation.proposed.json` binds exact code/model hashes and is **disabled, incomplete review material**, not an executable approval or receipt. A dated scope, revised source plan/allowance accounting and final hash review are still required before requesting broader collection or PAPER approval.

Original P0 permit expired **15 November 12:47:21.079 AEDT**. Journal remains revision 1, head `b546f3acc82aec0ffe9d273ba93685b88f07bd2c1e08bcca5a978af002b4c916`, with zero genuine positions/settlements. A$5,000 nominal reference/A$50 hypothetical stake and all V5 records are unchanged. No broader local authority or hosted PAPER A/B/C exists.

## UI and verification

- `/v6/research`: sport, family, Melbourne-date and evidence filters; exact-market evidence, fixture grouping and collapsed readiness table. Empty spread/NBL/tennis results explain missing evidence.
- `/v6/models`: actual score-model comparison, independent fixture counts, player audit and immutable artifact provenance; existing Elo/challenger/calibration views preserved.
- `/v6/health`: latest failure, historical successful worker, stages, original deadlines/permit expiry and retained quota counters shown separately.
- Normal owner Auth/RLS binding and private display DTOs remain required. Demo does not request private evidence; cloud mode does not read local reports. No arbitrary path, source body, personal identifier or credential is exposed.

Passed: **834 tests in 79 files**, including disposable native PostgreSQL/security tests; **162 local SQL checks** (70 core, 77 history, 15 cloud proposal); **21 isolated browser groups**; TypeScript, lint, production build and whitespace checks. Browser authentication/transports are intercepted, not new hosted owner acceptance. Browser checks made zero unexpected/provider requests and no hosted writes; actual retained-data desktop/mobile/model/status screenshots were visually reviewed. SQL checks are local, not migration deployment or hosted acceptance.

Actual read-only operational audit at **15 November 16:33:09 AEDT**: sole LaunchAgent loaded, 60-second ticks, 1,151 invocations, exit 0; latest attempt failed, prior successful worker retained. Next queued operations: **15 November 18:00 results, 19:00 discovery**, neither executed by this task. Odds retained **13 used/reserved, 487 remaining**; original monthly ceiling 60 and 100-credit reserve remain unchanged. BDL journal retains seven requests for UTC 14 November; that is not a claim of today's usage. Protected original dataset, capture, report, seal, journal, control/challenger, source config, plan and receipt remain unchanged.

## Next executable step

Keep the approved Mac host awake for its existing source-only schedule and inspect the new stage diagnostics after an actual run. Separately prepare one dated NBA Sportsbet featured-market discovery replacing the scheduled h2h request, with exact source-plan/code/model hashes and budget reallocation under the unchanged allowance. Review genuine prices, exact terms and independent results prospectively before any market-specific PAPER activation. Do not extend the expired P0 permit, relax qualification, replay the missed job or treat this implementation as authority.
