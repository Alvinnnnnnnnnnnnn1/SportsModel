# V6 controlled activation readiness — 12 November 2026

**Prepared locally, disabled, not deployed or activated.** Genuine result verification is partial: one fixture/two selections pass the frozen clock rule; nine fixtures/eighteen selections remain unresolved despite matching final scores. See [results and prediction metrics](v6-shadow-results-20261112.md). No observational selection became a paper position. No V5 record, account, methodology, funding or deployed schema changed.

Implementation commit `59b129e`; result/evaluation commit `60b6b91`, branch `feature/v6-autonomous-paper`.

## Proposed activation policy

`controlled-activation.ts` binds the existing uncapped `v6-uncapped-paper-1` financial policy, `nba-moneyline-two-pass-1` selection policy, fixture identity/settlement terms and new `nba-controlled-paper-1` controls into one SHA-256 approval bundle. This is a local proposal, not saved owner approval or a change to Methodology Revision 1.

The possible registered baseline is **`nba-team-elo-only` / `candidate-1`**, method `nba_team_elo_only`: initial rating 1500, K 20, home advantage 60, season retention 0.75, zero form/rest adjustment and zero shrinkage. The formula is reproduced by TypeScript and the proposed SQL. The existing form/rest challenger remains experimental; it underperformed Elo on the chronological benchmark. Their shared data/rating family is not independent agreement.

Activation requires a strict owner-scoped model manifest and separate standing-policy receipt, including exact definition/evaluation/manifest/policy hashes, approval references and non-future approval times. The proposed evidence gate is **500 chronological games and 30 strictly verified prospective fixtures**, plus explicit acceptance of limited team-results-only matchup evidence. These are model-validation requirements, not position-count or exposure caps. Thirty fixtures alone would not prove an edge; the owner must review calibration, benchmark comparisons and limitations. Current evidence supplies 4,774 chronological games and **one** strictly verified prospective fixture. The nine unresolved games cannot increase that count.

A private draft was generated under `.local/v6/activation-review/`. It has `status=draft`, null approval fields, placeholder owner and `teamResultsOnlyAccepted=false`; it activates nothing. Do not change the recorded sample count to make it pass. Future genuinely frozen evidence needs evaluation and a new reviewed manifest. No approval receipt was created.

Qualification still requires exact NBA two-way full-game Sportsbet moneyline identity, original fresh source-backed odds, immutable forecast/inputs, pre-event registration against the earlier source clock, minimum predicted win probability 0.55, defensible EV at least 0.02, price/market-baseline comparisons and the frozen sensitivity checks. A higher hit probability alone is insufficient. Missing injury/roster evidence remains visible; accepting that limitation requires explicit model review, not a fabricated independent forecast.

Only new **model-supported prospective paper** entries can qualify. Observations and rejected candidates remain research; exploratory positions are disabled. Historical shadows cannot be promoted after results. Every distinct eligible selection registers automatically under an activated standing policy, without per-entry approval, top-N filtering, daily count/exposure limits or an available-balance gate. A$5,000 is a nominal reference, A$50 is the fixed hypothetical stake, and negative available notional balance is reported rather than used as an admission gate. Shared event correlation groups remain separate from position count; no same-game independence assumption is made. This initial controlled adapter has no alternate-line/SGM support.

## Actual worker and schedule

`scripts/run-v6-controlled.mjs` invokes `runControlledTick` → `runControlledWorker` → the existing `runV6Worker`. It uses Node/npm's installed Vite runtime directly and needs neither Next's development server nor daily ChatGPT prompts. Its concrete read-only ports use permitted Odds API/BDL feeds, the preserved dataset and newly fetched game/quote evidence. No V5 repository or Supabase service-role capability is imported.

Implemented scheduling:

- Melbourne **19:00** daily discovery, **18:00** result checks, plus pre-start acquisition windows about 20–50 minutes before the earliest fixture in each 30-minute group. The one-minute host tick picks due work; one job can register every eligible selection.
- Durable per-owner queue, claimed-job leases, append-only attempt history and deterministic worker run IDs. Interrupted leases recover after 15 minutes; already committed runs replay without new source calls or duplicate registration.
- Transient failures retry after 2, 10, 30 and 60 minutes, up to six attempts. Missed pre-event deadlines become `missed`; nothing is backdated. Changed controls can release blocked jobs for reconsideration.
- Results use retained exact provider IDs/proofs, a deduplicated score batch and exact BDL cross-checks. The adapter excludes positions outside the three-day score retention window and records a local diagnostic. Ambiguous identities/clocks remain unresolved. Grading diagnostics also preserve unresolved reasons/source hashes. Idempotent grade revisions and A$50 P/L remain in the existing atomic engine.
- New reads share durable quota locks/counters. The proposed controlled odds budget defaults to 300 credits/month, permits at most 400 and preserves the 100-credit reserve; that override requires an approved receipt. Existing pilot counters are retained. BDL reads serialize with cooldown and the existing 60/day free-read ceiling. These are operational quotas, never paper-volume caps. Shared coordination is **single host**, not a multi-host service.
- Fresh current-season feature pages merge into a separate controlled cache; the original 5,082-game dataset remains read-only. Catalogue evidence older than seven days blocks collection pending a reviewed refresh. Automatic catalogue refresh is not implemented. Feature pagination/coverage, source clocks and price age still gate eligibility.

The run journal, `scheduler.json`, `health.json`, grade diagnostics and local failure-alert outbox live under ignored `.local/v6/controlled/`. Alerts are local files only: no external delivery, Hermes, background push or hosted health service is connected. `--health` reports the last attempted job and missed-run age; a completed job does not by itself prove useful source coverage or any qualifying positions. A stopped/offline host cannot meet source retention windows.

Safe commands (default disabled; no source requests):

```sh
node scripts/run-v6-controlled.mjs --config ops/v6-controlled.config.example.json --once
node scripts/run-v6-controlled.mjs --config ops/v6-controlled.config.example.json --plan
node scripts/run-v6-controlled.mjs --config ops/v6-controlled.config.example.json --health
```

`ops/com.edgelab.v6-controlled.plist.example` is an **uninstalled** launchd template executing that actual worker every 60 seconds, not a scheduled chat message. After separate activation/install approval, resolve absolute Node/project/private-log paths, use a private config under `.local/v6/`, protect keys/config/logs, verify disabled one-shot execution and restart recovery, then install only the reviewed job. Do not run two hosts against independent quota files. No launchd job was installed or loaded here. A Linux host can invoke the same `--once` command with a reviewed timer, but no Linux deployment was tested.

Emergency stop: `killSwitch=true` or `mode=disabled`. The source gate checks controls first, and the registration/settlement commit latch re-reads exact controls/approval hashes inside the atomic repository transaction. A stop during collection prevents the whole position/grade batch from committing; immutable source receipts already fetched remain evidence. Shutdown cannot undo an HTTP request already in flight.

## Hosted SQL and approval gate

Exact proposal: `supabase/proposals/202611110001_v6_paper.sql`, **outside migrations**, SHA-256:

`bac90244c59afe3624d358b5840dfdae2e23f845b0effa8406bea593a21da5bc`

It creates ten prefixed V6 tables (`policies`, `controls`, `models`, `observations`, `positions`, `grade_revisions`, `runs`, `provider_quotas`, `outbox`, `audit`), owner-scoped RLS, same-owner foreign keys, indexes, immutable guards, registration/grading/quota/summary functions and a non-login V6-only worker role. No existing table/row is altered, no seed is inserted and no V5 permission is granted. The new Elo method additionally requires owner-reviewed model registry evidence, minimum sample counts and zero form/rest/shrinkage. SQL tests reject missing review, wrong formulas and late batch failures. Existing tests cover cross-owner/anonymous restrictions, immutable forecasts, atomic rollback, stale grade revisions, duplicate prevention and more than 100 positions without a balance gate.

Read-only remote migration history was checked on 12 November against project **`ilgoswfckkzpoktabbfi`**. It still lists only `202611030001`, `202611030002`, `202611040001`. V6 is **unapplied**; no push/reset or hosted write was performed. Local PGlite role simulation does not establish hosted JWT/RLS behavior. A production Supabase V6 atomic repository and scoped worker token/role issuance are still unimplemented; a personal token or service-role key must not substitute for a restricted worker identity. The independent headless path currently persists to its own local repository only.

Backout: before commit, the SQL transaction rolls back on any error. After deployment, stop/revoke only the V6 worker under approval, preserve all V6 data/audits and leave V5 untouched. Do not drop/reset/truncate tables. Prefer a separately reviewed additive correction. See [deployment checklist](v6-deployment-readiness.md).

## Executed verification and remaining approvals

- 653/653 tests across 52 files, including V6 proposal integration; no skipped tests.
- 147 core/history local SQL assertions (70 + 77), TypeScript, lint and production build passed. Ten intercepted browser regression groups passed without personal-session/hosted writes. The launchd template passes `plutil` syntax validation.
- Real observational result collection and offline evaluation ran. One strict final fixture is proven; the other nine remain unresolved. Genuine registered A$50 position → final-result settlement is **not yet proven**. Synthetic registration/settlement/replay/rollback tests do pass.
- Scheduler/activation tests use explicitly synthetic local approvals and ports. The concrete armed source/model/grading adapter has **not** run live, and no schedule is installed. Hosted V6 RLS/worker auth/restart/concurrency tests remain unverified.

Next executable work is a reviewed result-clock discrepancy policy/resolution, followed by new pre-event observations to build a defensible prospective baseline sample. Preserve the original clock rule and unresolved old cohort unless a separate resolution is approved. Then review the actual model manifest, source rights/quotas, exact standing policy and always-on host before approving activation. Hosted SQL approval and scoped access verification are additional gates if choosing Supabase persistence. No deployment, standing activation, scheduler installation, external messaging or paid service is authorised by this implementation.
