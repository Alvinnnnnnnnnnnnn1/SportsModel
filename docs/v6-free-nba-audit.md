# V6 free NBA coverage and observation archive — 11 November 2026

Later team-market milestone: [BALLDONTLIE current games and genuine moneyline shadow](v6-team-moneyline-pilot.md). It resolves current game-level inputs; the player-stat coverage/rights restrictions in this earlier audit are preserved. Current odds usage is eight cumulative credits, not the five at this checkpoint.

Status: **REAL_DATA_SHADOW_BLOCKED / LOCAL_TEST_ONLY**. No new position, settlement, policy activation, hosted write or migration. No historical account import was repeated. The A$5,000/A$50 uncapped paper policy, V5 finances and saved methodology are unchanged.

Implementation commit: `6bad6d0`, branch `feature/v6-autonomous-paper`; local only.

## Source permissions and actual scope

| Priority/source | Finding | Actual collection this continuation |
| --- | --- | --- |
| ESPN via hoopR or direct endpoints | [Australian Disney terms, section 2](https://disneytermsofuse.com/australia-newzealand/) restrict automated extraction and model/dataset use without written permission. [hoopR endpoint documentation](https://hoopr.sportsdataverse.org/articles/espn-endpoints.html) establishes available wrappers, not upstream permission. | No ESPN statistics request. Availability, limits and current-season coverage **not tested**; rights gate failed first. No proxy or alternate host used. |
| NBA CDN via nba_api | [NBA statistics restrictions](https://www.nba.com/termsofuse) do not establish permission for this betting-research database. Written permission is absent. | No NBA statistics/CDN request. [Box-score endpoint documentation](https://github.com/swar/nba_api/blob/master/docs/nba_api/live/endpoints/boxscore.md) reviewed, not treated as a data licence. |
| API-Basketball, existing API_SPORTS_KEY | Separately verified Free/100-per-day subscription. NBA league `12`, correct season string `2026-2027`, current catalogue advertises player-stat coverage. **Actual season request denied.** | Status, `/leagues?name=NBA`, `/games?league=12&season=2026-2027`, final status. No alternate date/filter used after denial. |
| API-NBA, existing key | Known current-season restriction retained. Provider-declared historical range 2022–2024 works. | Two status reads and four historical data requests: games plus player `428` statistics for seasons 2022 and 2024. No repeat 2026 request. |
| Historical public datasets | [NBA game logs dataset card](https://huggingface.co/datasets/cbratkovics/nba-game-logs) explicitly distinguishes its CC0 packaging from underlying NBA terms and identifies NBA.com-derived provenance. [hoopR data package metadata](https://github.com/sportsdataverse/hoopR-nba-data/blob/main/DESCRIPTION) likewise cannot establish ESPN's permission. | Metadata inspected; no bulk dataset downloaded or training use assumed. No new account, subscription or credential requested. |

The [API-Sports terms](https://api-sports.io/terms) permit API-backed projects but explicitly do not supply all downstream publication licences. Evidence remains private; public redistribution and production rights are not asserted. Providers' subscription restrictions remain decisive even when catalogue coverage flags are true. These are evidenced scope/permission gaps, not a claim that free NBA data can never exist.

### Actual HTTP evidence

Private raw bodies and per-fetch receipts remain under ignored `.local/v6/`, with SHA-256 integrity, credential-free URLs and nullable original publication times. Status bodies retain only plan/usage. Times below are UTC on 11 November; Melbourne is UTC+11.

| Read | Observation | SHA-256 |
| --- | --- | --- |
| API-Basketball `/status`, 11:21:38.234 | Active Free, 100/day | `8044ade889a07dee8abdc2f9fca87a8435ee45101167e941f9d68ac02fecd0a1` |
| `/leagues?name=NBA`, 11:21:54.821 | One NBA league, ID12; nineteen listed seasons, including `2026-2027` | `a5e8899728c9b81e44ff3263cbd158bcd51169474954fba11f18107012c2f24d` |
| `/games?league=12&season=2026-2027` | Empty response and explicit Free plan error: seasons 2022–2024 only | `64628b82ef676a03e79e1e13ab1d58e261a1c50a646371d767a54680c93c7bb6` |
| API-NBA `/games?league=standard&season=2022`, 11:22:46.941 | 1,391 fixtures | `9c1abcaaf30c9cc5495e071c7086be64b9721fd451a6ec40691a87e58ee4aec0` |
| `/players/statistics?id=428&season=2022`, 11:23:04.194 | 77 player-games | `2315cadc5b37f96924a30b667ac0c3f8cbbee5c9ada6541d69815a5e037cf6d2` |
| `/games?league=standard&season=2024`, 11:23:21.563 | 1,406 fixtures | `4f802745fe4955d2b171c230a49a922268cb6cb1d56002d7332ba4ff34e46fcb` |
| `/players/statistics?id=428&season=2024`, 11:23:38.314 | 62 player-games | `bb00626da3933826719a619e3a57a3d2c62b54f3f55a74846c770017caa74f73` |
| Final API-Basketball status, 11:25:43.308 | **1/100 used, 99 remaining** | `1a9d464264c0595a99412f71170d10b5a2ac21cdaa49057b5198c095eb864df0` |
| Final API-NBA status, 11:27:53.027 | **7/100 used, 93 remaining** | `c1575ca03ea50d746dcba6a5ecb85fe76a4fbe3551c84f5ee3822f458e8d0d56` |

NBA made six provider requests this continuation (four data, two status); Basketball made four (catalogue, denied data, two status). One initial sandbox transport failure and one cooldown refusal delivered no confirmed provider response. They were not covertly retried; the explicit network-authorised run recovered status first. No automatic transport retry exists. Local conservative reservations are NBA9 and Basketball2; failed attempts are never refunded. These differ from billed provider usage. The 16-second source cooldown, ten-data-attempt daily pilot ceilings, reserve and separate legacy inspector budgets remain. Odds usage: **zero new credits, five cumulative, 495 remaining**. No fresh price request is justified until statistics/identity gates are solved.

## Incremental historical dataset

`training-dataset.server.ts` joins exact API-NBA player/game/team IDs, records opponent/home, season/stage, nullable starter/participation/minutes/points, actual availability observation, null original publication time and original hashes. It persists a private locked source-qualified player-game store with append-only, hashed corrections. Repeated facts do not create extra labels; stale corrections, mismatched teams/fixtures, impossible final clocks and corrupted chains reject atomically. Re-ingestion was run and retained **191 rows / 191 revisions**.

| Player namespace/ID | Provider season | Player-games | Regular-season participating finals | First / last source fixture |
| --- | --- | ---: | ---: | --- |
| api-nba / 428, Jakob Poeltl | 2022 | 77 | 72 | 2 October 2022 / 12 April 2023 UTC |
| api-nba / 428 | 2023, prior retained sample | 52 | 50 | 9 October 2023 / 3 March 2024 UTC |
| api-nba / 428 | 2024 | 62 | 57 | 6 October 2024 / 4 April 2025 UTC |
| Total | Three seasons, **one player only** | **191** | **179** | **Not current-season coverage** |

All 191 exact joins are final with nonnull minutes/points; all starter flags remain null. No official NBA personId is inferred from API-NBA's provider-qualified ID. No current rosters, injury/rotation/lineup features, current fixture or point-in-time historical publication archive was obtained. Thus these rows cannot support a current eligible forecast. Historical availability is first actual retrieval of each revision, not invented original release time.

Offline reproducible command (zero network calls):

```sh
node scripts/analyse-v6-coverage.mjs
```

Private summary: `.local/v6/training-reports/c23c614e2837d0a8a2489668a55877d4d1de47dd17b3c0a3932b6ccdf48c0ee1.json`. Store: `.local/v6/training/player-games.json`. Sources include prior content blobs plus new per-fetch receipts; identical content fetched with different scope is not substituted for an exact roster receipt.

## Chronological evaluation, no promotion

The **unchanged** experimental Gamma–Poisson/minutes challenger was evaluated against the retained smoothed empirical benchmark. Features precede each target, but raw data was retrieved later: this is retrospective chronological research, not a historical as-of backtest. No parameters or thresholds were tuned to improve these reported results.

| Metric, lower is better | Challenger | Simple benchmark |
| --- | ---: | ---: |
| Brier | 0.1333596631 | **0.1295681240** |
| Log loss | 0.4351235595 | **0.4081881439** |

**157 held-out player-games, 785 correlated threshold scores**, using the five previously declared lines. Do not interpret 785 as independent samples. All data is one player; season drift, absent injury/minutes context and unarchived revisions remain limitations. The challenger still loses. Neither it nor the benchmark has been activated. There are no historical quote baselines/CLV/ROI to report.

## Exact exclusion resolution for the original ten outcomes

All refer to odds event `37f4c00ff7ec01d5aa7c33dd1ac84bbc`, Sportsbet event SID `11151326`, Toronto–Boston, source start `2026-11-12T00:10:00Z` (12 November 11:10 Melbourne). Original quote source hash remains `4af62606ecabceb5dfc7c71b55f449b5fd5ea5c5ef1aa8eb64550b3f7a12bf2e`. Market update `07:38:43Z`, actual retrieval `07:39:33.371Z` on 11 November: attributable and fresh **then**, stale at later analysis. Original prices remain in local evidence, unchanged.

| Selection | Canonical player verified | Statistics fixture confirmed | Exact threshold supported | Frozen rules verified | Price freshness now | Valid pre-game forecast | Decision |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Ja'Kobe Walter Over 12.5 | No | No | Yes | No | Stale | No | Excluded |
| Ja'Kobe Walter Under 12.5 | No | No | Yes | No | Stale | No | Excluded |
| Jakob Poeltl Over 11.5 | No; profile428 is only a suggestion | No | Yes | No | Stale | No | Excluded |
| Jakob Poeltl Under 11.5 | No; profile428 is only a suggestion | No | Yes | No | Stale | No | Excluded |
| Collin Murray-Boyles Over 12.5 | No | No | Yes | No | Stale | No | Excluded |
| Collin Murray-Boyles Under 12.5 | No | No | Yes | No | Stale | No | Excluded |
| R.J. Barrett Over 23.5 | No | No | Yes | No | Stale | No | Excluded |
| R.J. Barrett Under 23.5 | No | No | Yes | No | Stale | No | Excluded |
| Immanuel Quickley Over 18.5 | No | No | Yes | No | Stale | No | Excluded |
| Immanuel Quickley Under 18.5 | No | No | Yes | No | Stale | No | Excluded |

Provider player, market and outcome IDs are still null. An event SID does not identify a player. No current game/player bridge or season-qualified roster was recovered. Existing name matches remain blocked. Mapping verification now additionally requires exact fixture date/home/away/league/season and roster membership from **specific retained fetch receipts**. Shared profile/roster bytes are not sufficient query-scope proof. Unmapped/mismatched fixtures, teams, seasons, roster scopes and later evidence fail closed. Old blocked mappings remain readable; no registry revision was rewritten or approved.

Latest exact screen: `.local/v6/shadow-reports/35e7d6e8c03207c87448d9d8c52f3bffcf33ac16be0b9069a3e66e0d4ced1bc3.json`. It includes per-selection evidence flags/reasons and null probability/EV. Known price/line does not establish valid settlement terms or an independent forecast. These observations will never be retroactively promoted into paper registrations.

## Separate observational lifecycle

`observations.server.ts` automatically retains every supported outcome passed through the explicit NBA points collector, including blocked/unmapped rows. Original source bytes, quote/line/clocks, immutable screening decision, mapping version/hash, exact nullable canonical IDs, model diagnostic snapshot when defensible and fixture correlation cluster remain separate from paper positions. Same receipt replay reloads its frozen batch; it cannot recompute/promote the decision with newer evidence. A new actual fetch creates a new observational receipt, sharing its market/game cluster rather than inventing independent labels.

The existing real-source screen has now been archived once locally as ten excluded observations, financialPosition=false. Archive ID `b69ebf2c-ceb7-438f-b4cc-d65727c375b5`; it is a pre-event observation of already stale prices, **not a qualifying prospective forecast**. It preserves the original screening snapshot; later report fields do not overwrite it. Dry-run worker replay remains `already_processed`, with zero positions/grades.

The outcome-observation port accepts exact final player/game evidence only for a frozen verified mapping, keeps original publication time null, and appends correction/replay-safe statistical outcomes. It cannot settle or register positions and cannot resolve the ten unmapped observations. This port's positive final-result lifecycle uses synthetic local tests; **no genuine prospective outcome has been verified**. Actual historical parsing verifies 191 exact final player-game joins, not a prospective position settlement.

## Verification and remaining gates

Implementation files:

- Source transport/evidence: `src/lib/v6/free-sources.server.ts`, `src/lib/v6/evidence.server.ts`.
- Mapping and screening: `src/lib/v6/identity-registry.server.ts`, `src/lib/v6/shadow.ts`.
- New isolated stores: `src/lib/v6/training-dataset.server.ts`, `src/lib/v6/observations.server.ts`.
- Explicit collectors: `scripts/collect-v6-basketball-scope.mjs`, `scripts/collect-v6-training-history.mjs`, `scripts/collect-v6-nba-pilot.mjs`.
- Offline/replay analyses: `scripts/analyse-v6-coverage.mjs`, `scripts/analyse-v6-nba-pilot.mjs`.
- Regression tests: `tests/v6-observational.test.ts`.
- Documentation: this audit, `docs/v6-implementation-status.md`, `README.md`, `AGENTS.md`.

- 631 unit/integration tests, 49 files, no skips; includes six new observational/dataset/transport groups.
- 147 local PostgreSQL assertions (70 core +77 history), plus V6 proposal tests in Vitest. No hosted schema assertion or write.
- Ten mocked private browser groups (4 Daily Cycle +6 reconciliation), zero external/hosted/financial requests. Initial browser attempts found no listening dev server; after starting localhost, both passed. The private personal session was never used.
- TypeScript, lint and production build passed. The disabled worker and existing SQL proposal remain unactivated/unapplied. No dependency, migration or policy change.

**No new current-season source passed, zero verified cross-provider mappings, zero eligible future shadow candidates, zero real automatic result settlements.** Enabling a schedule or deploying SQL cannot fix these gates. Next executable task is to obtain documented permission for a current-season source (or evidence another genuinely free authorised provider), then collect multiple completed current games and exact current roster/fixture bridges. No credential needs to be sent in chat. Afterwards validate a model, freeze a *new* future-event snapshot and wire the existing worker ports. Hosted migration, scoped worker identity and standing production activation still need separate approval. No per-position volume cap is introduced.
