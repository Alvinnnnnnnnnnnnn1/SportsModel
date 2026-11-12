# V6 NBA team-moneyline pilot — 11 November 2026

Latest 12 November follow-up: [event reconciliation](v6-event-reconciliation.md) verifies all ten original fixtures, preserving the old strict journal and immutable twenty observations. No position/P&L or threshold relaxation. [Model review](v6-model-readiness.md) and [the exact deployment package](v6-deployment-approval-package.md) retain disabled production gates. Earlier checkpoints below preserve their original dates/counts.

**12 November follow-up:** [actual final scores and frozen metrics](v6-shadow-results-20261112.md) now exist. Ten finals agree across sources, but only one fixture/two selections pass the original strict clock rule; nine fixtures/eighteen selections remain unresolved. No retrospective registrations or P/L. Usage is ten odds credits/490 remaining. The preserved original pilot checkpoint below precedes those results. [Controlled Elo activation and scheduling](v6-controlled-readiness.md) are prepared, disabled and unapproved; the current SQL hash is in [deployment readiness](v6-deployment-readiness.md).

Implementation commit: `99f2afd`, `feature/v6-autonomous-paper`. **Genuine prospective observational shadow completed; production autonomy disabled.** This is not a completed registered-position lifecycle: no selection qualified, no position was registered and no newly forecast game had finished. The existing account, V5 methodology/ledger, historical imports, funding and deployed schema were untouched. No paid service, bookmaker account, direct bookmaker market scraping or external messaging.

## Acceptance evidence

| Criterion | Actual result |
| --- | --- |
| Authorised historical/current NBA team-game data | Passed: configured owner Free key accessed BALLDONTLIE teams/games; actual current and preceding season responses retained. Earlier permitted API-NBA historical receipts reused, with no new API-NBA request. |
| Reproducible pre-event team probabilities | Passed for **20 selections /10 fixtures**, from a frozen experimental Elo/form/rest model and immutable pre-cutoff inputs. This does not establish calibration or a betting advantage. |
| Sportsbet moneyline prices | Passed: `sportsbet`/`h2h`, two mutually exclusive team outcomes, original decimal prices and market clocks. No prices substituted from another bookmaker. |
| Canonical event identity | Passed for the ten upcoming fixtures under the explicit team scheduling policy below. The Odds API event ID is retained for both odds and scores; separate BALLDONTLIE game/team IDs remain distinct. |
| Genuine pre-event shadow freeze | Passed at **2026-11-11 12:06:28.773 UTC /23:06:28.773 Melbourne**. Twenty fresh quotes, independent experimental forecasts, two-pass exclusions and original inputs frozen; no later promotion on replay. |
| Real final score after the forecast event | **Pending:** newly forecast events were still future. Separately, 21 genuine recent final-score responses were obtained, 19 independently corroborated; those are historical result-adapter evidence, not settlements of this slate. |
| A$50 paper settlement of a qualifying registration | **Not achieved:** zero qualifying/activated positions. Positive grading/correction/accounting checks are synthetic local tests only. No position is invented to complete this criterion. |

Earliest original schedule deadline is 12 November 00:00 UTC /11:00 Melbourne. Result follow-up does not assume a game is complete merely from elapsed time. The command checks provider `Final`/`completed` and independent score agreement.

## Source audit and quotas

[BALLDONTLIE NBA documentation](https://docs.balldontlie.io/) lists teams/games as permanent-Free endpoints with five requests/minute; player statistics/injuries are paid and were never requested. [Its terms, section 6](https://www.balldontlie.io/terms.html), permit lawful research, storage, modelling and derived products, while requiring independent verification for wagering-related use. The owner supplied the key privately in `.env.local`; no signup, trial or payment action was performed. Free endpoint access was tested; account billing settings were not inspected.

Actual **17 BALLDONTLIE GETs**: one team catalogue, two current-season pages, thirteen previous-season pages and one upcoming-date-range page. Persistent budget: 60 starts/day maximum, 12.5-second spacing, five starts/rolling minute, 429 Retry-After blocking, no implicit request/retry. These are acquisition quotas, not paper-volume limits. Server-only `BALLDONTLIE_API_KEY` is optional and documented in `.env.example`; absent keys make zero requests.

| Source | Actual observation | SHA-256 |
| --- | --- | --- |
| `/v1/teams`, 11:55:52.769 UTC | 89 entries including defunct/guest teams; only 30 conference/division-qualified current NBA teams admitted to the canonical registry | `114c347ddd1ecf79aa5d2bee45b777ba9a77b9cb3e1f6ff0d1f7e15dc76c7d7e` |
| `/v1/games?seasons[]=2026&season_type=regular&per_page=100&end_date=2026-11-11`, pages | 100 +70 fixtures; 160 final | `d7e5e3e7b2682ae75c3cb66c8a1348de355d055aabc814a157c1fbc972bea22f`, `f710a50d720afc5ea94514285e3b9834b63c767fcf7815adfd7c18aeb52dd2fc` |
| Season2025 first/last page | Complete 1,230-game regular season; 13 retained pagination receipts | `271e5337e9f92df88c19e1b6383d37a53b38ac5f1825f7ffe9f8f99fa8149193`, `607c14b9c66e1aecc8d19b6a3589ef6bd67a89804fd238bf600db20e9ed02fff` |
| Upcoming 11–13 November range, 12:01:30.304 UTC | 23 fixtures; 13 additional source IDs, with provider-qualified upcoming identities | `71d781f0dcc4a8976bc277723602982801b2e86a137e53c482826cd4a5e818c1` |
| Sportsbet NBA `h2h`, 12:06:28.725 UTC | 20 outcomes /10 events; all fresh at freeze | `bdf886df3a9affad1193be9ecb6053552f46dab65816226da6e6e120992c1761` |
| NBA scores, `daysFrom=3` | 21 completed events, independent agreement on19; two unresolved identity matches retained | `ea9e1c3aee24587385735fb08bdb11919db9608fc6696b48b049e904e0451455` |
| TheSportsDB discovery /NBA season sample | Free league4387 confirmed; **15-row limit**, all returned finals but all timestamp strings lack an explicit UTC offset | `0630e90e12639f2455b5b3ef8ab7f488bb18491bdf4b6b922e269db15591b183`, `a24875b7cd7640685cffd4e0d43e745d7594b4597344a512c3a84c62172e1092` |

TheSportsDB made two free-v1 calls. Initial parsing correctly refused unqualified timestamp strings; offline normalization now preserves their starts as null. The 15 truncated records are not a complete current training source or usable exact-UTC grade source. No UTC suffix or missing fixture was invented. Its [free documentation](https://www.thesportsdb.com/docs/api) confirms the season response limit.

The Odds API used **three new credits: two scores +one h2h**, eight cumulative, **492/500 remaining**. [Scores documentation](https://the-odds-api.com/liveapi/guides/v4/#get-scores) specifies `daysFrom=1..3`, two credits and the shared odds/event ID. The shared counter adopts all previous reservations; only explicit `team-moneyline-v1` allows the new bounded **12 cumulative-credit pilot ceiling**, with a100-credit reserve. No old counter was reset. A later due result check costs two credits; no continuous polling was enabled. API-NBA/Basketball quotas were untouched this continuation.

All source bodies/receipts remain ignored under `.local/v6/` with private permissions. No key, personal account export or raw source dataset is committed. Provider access is not a claim of official league endorsement or unlimited redistribution rights.

## Dataset, canonical identities and timing

The incremental team store contains **5,600 provider-qualified fixtures**: API-NBA2022/2023/2024 =1,391/1,390/1,406, plus BALLDONTLIE2025 =1,230 and current2026 =183 including the upcoming range. Eleven guest/preseason fixture rows lack a current-NBA canonical team bridge and are excluded. Finished, decisive, compatible training rows deduplicate to **5,082 games /30 teams**, not the old191 player-game rows. Unfinished games, missing starts/scores, ties, incompatible phases and conflicting same-game results do not train the model.

Original provider game/team IDs, UTC starts, season, home/away, final scores/status, retrieval clocks, null original publication times and fetch receipt IDs are retained. Corrections append hash-linked revisions; stale updates reject. Same exact game across providers yields one training label. Team normalization is a separate versioned transformation: shared league-qualified abbreviations plus provider IDs and an exact thirty-team catalogue. It does not overwrite raw names or use fuzzy matching. Defunct Washington/guest teams are not current NBA teams. Unproven labels remain blocked.

`nba-team-scheduled-time-1` is a **team-only** identity rule: exact current canonical home/away, NBA league, a unique statistics fixture, and at most900 seconds between attributed provider starts. Both clocks, difference and IDs remain in the proof. Admission/forecast cutoff is the **earlier** clock; original odds `commence_time` is never overwritten. Ambiguous matches, larger discrepancies, rescheduled result clocks or missing source identity remain unresolved. This does not relax the existing player-prop registry. The upcoming sample contains ten-minute differences; historical final observations vary5–14 minutes. Two recent finals still lacked an approved exact label bridge and were excluded from cross-verification.

Pagination completeness requires the full retained cursor chain, no overlap, matching previous cursor/scope and valid hashes. A source may omit `next_cursor` on a short terminal page; that is supported only with `per_page=100` and fewer than100 rows. A full page with unknown next cursor is incomplete. Current evidence verifies season-to-date coverage through11 November, not every future schedule or independently verified lineup/injury.

## Model and research policy

Frozen model `nba-team-elo-form-rest /experimental-1`: initial1500, K20, home-court60, 75% season-to-season retention, recent five opponent-adjusted Elo residuals scaled80, a20-point back-to-back penalty only with complete current schedule evidence, and5% probability shrinkage toward0.5. Each side needs20 prior games and recent features within21 days. Intervening unfinished fixtures block a forecast. Known game scores drive team strength; there are no invented injuries, roster changes or player-stat features.

Chronological evaluation predicts all games on a UTC date before updating that date's results. Historical source publication times were not archived, so this is **retrospective chronological research**, not an as-of backtest. Rest adjustments are not validated by this historical comparison. Each game supplies one home-win label; both moneyline sides and repeated quotes are not independent training labels.

| Lower is better | Challenger | Elo-only | Smoothed historical win rates |
| --- | ---: | ---: | ---: |
| Brier, 4,774 held-out games |0.2156775888|**0.2152337127**|0.2340920415|
| Log loss |0.6196628890|**0.6189191514**|0.6606445973|

Calibration bins and per-season scores are in the private report. Deterministic250-replicate UTC-date cluster bootstrap: challenger-minus-Elo Brier95% interval **[-0.0002728252,0.0013240094]**. Repeated teams remain dependent beyond date clusters. These data do not justify promoting the challenger; it stays experimental. Bookmaker-based Brier/log loss and CLV remain unavailable without historical/pre-event quote outcomes; current complete-market de-vig probabilities are retained for prospective comparison.

`nba-moneyline-two-pass-1` retains separate high-probability, value, alternative-market and exploratory classifications. It preserves the existing A/B/C concepts plus the separate V6 exploratory dimension; it does **not** change approved V5 Methodology Revision1 or claim a recovered verbatim four-track methodology. First pass checks source, market, identity, timing and independent evidence. Second pass checks minimum win probability0.55, EV0.02, model/Elo disagreement≤0.08, model/de-vig disagreement≤0.15, and EV after20% probability contraction toward0.5. Sensitivity is a stress test, not a confidence interval. Alternative markets and injury/roster context are explicitly unavailable. No top-N, exposure or available-balance admission cap exists.

The actual screen excluded Boston at its original1.34 quote (experimental p≈0.6227, EV≈−0.1656) and Toronto at3.42 (p≈0.3773, EV≈0.2904; fails likelihood threshold). These are frozen research examples, **not recommendations or accepted wager prices**. High probability and positive estimated EV each fail to establish qualification by themselves. Every selection also failed the unactivated-model/standing-policy gate. The core worker receives the numerical method and checks reproducibility; it ran `dry_run` and kept zero positions.

## Frozen evidence, replay and result follow-up

- Frozen source receipt/shadow ID: `204dd518-19e2-4250-ad80-b6218430d838`.
- Frozen artifact hash: `98fc72f7a26e68dae7dc5dc55db30bad15561e4b690fb3fdc8285992496e31c8`.
- Snapshot: `.local/v6/team-shadow/204dd518-19e2-4250-ad80-b6218430d838.json`; training snapshots under `team-games/snapshots/` retain the exact input history. Later code additions never rewrite this excluded screen or promote it into a position.
- Model report: `.local/v6/team-reports/c86398ad58bc8bf722d364d2d11395381ec695dbfd44ce439487ffa9d812581d.json`.
- Replay/result-adapter audit: `.local/v6/team-reports/d5eb718434b6c14c2c123b1582434be1e347a261a71f765c8af2dd7872638cea.json`.

Offline, zero network:

```sh
node scripts/analyse-v6-team-games.mjs
node scripts/run-v6-team-shadow.mjs \
  --odds-receipt 204dd518-19e2-4250-ad80-b6218430d838 \
  --scores-receipt 182c78c8-0b60-4f34-80f9-a47419138172
```

Fresh-process replay returned `already_recorded`/`already_processed` with unchanged frozen hash, zero positions/grades and no provider calls. Analysis writes a new local report only; it cannot rewrite original forecasts.

After the games actually complete, within the provider's three-day score window, the owner can explicitly run:

```sh
node scripts/check-v6-team-results.mjs \
  --shadow-id 204dd518-19e2-4250-ad80-b6218430d838 \
  --confirm-free-read-only
```

Before a source start plus three hours, it makes **zero requests**; this execution returned `not_due`. That delay is a conservative fetch gate, not proof of completion. Once due, the script fetches shared-event scores and exact BALLDONTLIE game IDs, then records verified/unresolved **observational outcomes** with append-only/replay-safe hashes. It keeps zero financial settlements because no positions were registered. Repeated checks consume provider credits even if facts are unchanged; run explicitly, not as a frequent loop. Replayed facts do not duplicate outcomes; changed results append a revision. No forecast, exclusion or historical record is promoted retrospectively. This post-event live path still needs actual execution.

`gradeTeamMoneyline` separately supports exact registered-position grading, requires the original frozen model/registry/team proof, both final sources, consistent scores and original clocks. Corrections append grade revisions and delta accounting once. Missing results, conflicting scores, ties, postponements/reschedules or unsupported terms remain unresolved. Positive A$50 grading, correction/retry, worker restart and ownership checks are synthetic local tests. No genuine grade is claimed for the future slate.

## Deployment proposal and verification

The existing **unapproved/unapplied** ten-table V6 SQL proposal now supports the team method, reproduces its numeric probability and two-pass/start gates, and accepts credential-free source query parameters while rejecting plain/encoded secret parameter names. It creates no additional tables beyond that proposal. The updated SHA-256 is:

`3d6353aadfea1d0ef9fdd026ab6aa44b963e667732c3156aa6beb980f56c54f5`

This supersedes `19316b6a…` only for local review. All three deployed migrations remain unchanged. Nothing was moved into `migrations/` or sent to Supabase. Local SQL tests prove team round-trip, missing/altered probability rejection, query credential rejection, late-error transaction rollback, RLS/anonymous isolation, worker denial of V5 access and >100 positions/negative available notional balance. A positive local SQL fixture is not a model activation or hosted test.

Checks passed: **643 tests /50 files/no skips;147 core/history local SQL assertions plus V6 proposal integration;10 mocked private-browser groups;TypeScript;lint;production build**. The private browser/account was not accessed. Fixed local parser/test errors were rerun successfully; no migration failed remotely because no remote operation occurred.

Files implemented: `src/lib/v6/team-{sources.server,games,dataset.server,identity,coverage,model,research-policy,pilot,shadow.server}.ts`; existing V6 `types`, `models`, `engine`, `evidence.server` and `free-sources.server` extended; four team collector/analysis/shadow/result scripts; `tests/v6-team.test.ts` and the existing proposal/provider regression tests; `.env.example`; the local SQL proposal. Documentation includes this guide, implementation status, provider coverage, deployment readiness, engine guide, README and AGENTS. No new dependency or deployed migration.

The policy's minimum held-out sample requirement belongs to the future reviewed activation manifest. No automatic validator or model-promotion system is claimed. The current experimental status blocks admission regardless of sample size; increasing model confidence or changing a JSON flag is not authority to activate it.

Next task: collect actual outcomes for this frozen observational slate, compare the predeclared models against its retained bookmaker baselines, and prepare a reviewed validation manifest. Use a new model version if choosing Elo-only; never relabel the underperforming challenger. Only after model/source/rules readiness, separately review scoped hosted worker identity/repository, this exact SQL and standing activation. The existing disabled launchd/config remains uninstalled. Emergency stop, rollback and scheduler instructions remain in [deployment readiness](v6-deployment-readiness.md). Hermes and UI deployment stay deferred; A$5,000/A$50 unlimited notional paper accounting is unchanged.
