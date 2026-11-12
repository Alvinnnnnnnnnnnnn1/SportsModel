# V6 controlled activation readiness — 12 November 2026

**Prepared locally, disabled, not deployed or activated.** All ten fixtures/twenty observational selections are now verified under [versioned event reconciliation](v6-event-reconciliation.md): one originally strict, nine newly reconciled, zero unresolved. The original strict journal remains unchanged. No observational selection became a paper position. No V5 record, account, methodology, funding or deployed schema changed. Production remains **NO-GO** pending model review, scoped credential provisioning/renewal and hosted acceptance. The exact [deployment approval package](v6-deployment-approval-package.md) includes SQL/hash, auth, installation, backup and stop instructions.

Latest implementation commits `5423a6d` (reconciliation) and `78035c5` (atomic persistence/readiness/collection authority), branch `feature/v6-autonomous-paper`. Original foundation commits `59b129e` and `60b6b91` remain preserved.

## Proposed activation policy

`controlled-activation.ts` binds the existing uncapped `v6-uncapped-paper-1` financial policy, `nba-moneyline-two-pass-1` selection policy, fixture identity/settlement terms and new `nba-controlled-paper-1` controls into one SHA-256 approval bundle. This is a local proposal, not saved owner approval or a change to Methodology Revision 1.

The possible registered baseline is **`nba-team-elo-only` / `candidate-1`**, method `nba_team_elo_only`: initial rating 1500, K 20, home advantage 60, season retention 0.75, zero form/rest adjustment and zero shrinkage. The formula is reproduced by TypeScript and the proposed SQL. The existing form/rest challenger remains experimental; it underperformed Elo on the chronological benchmark. Their shared data/rating family is not independent agreement.

Activation requires a strict owner-scoped model manifest and separate standing-policy receipt, including exact definition/evaluation/manifest/policy hashes, approval references and non-future approval times. The proposed evidence floor remains 500 chronological games and thirty verified prospective fixtures, now additionally requiring at least two historical seasons/five prospective slates and a retained calibration/benchmark/fixture-and-slate uncertainty review. These are model-review requirements, not position-volume caps or proof of an edge. Current evidence supplies 4,774 chronological games and **ten verified observational fixtures on one slate**. See [the justified readiness proposal](v6-model-readiness.md); no model is promoted by count alone.

A fresh private draft under `.local/v6/activation-review/` records ten reconciled fixtures with `status=draft`, null approvals/readiness review, placeholder owner and `teamResultsOnlyAccepted=false`. It activates nothing. A separate expiring `edgelab.v6-shadow-collection` receipt can authorise read-only dry-run collection without model promotion; it cannot arm positions or settle P/L. Scheduler/worker check its owner, policy, budget and expiry before preparing sources and again at commit. No real receipt of either kind was created.

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
- Fresh current-season feature pages merge into a separate controlled cache; the original 5,082-game dataset remains read-only. The native catalogue refreshes after seven days under the approved source policy only when IDs/codes/names remain identical. Changed canonical membership blocks for identity review. Feature pagination/coverage, source clocks and price age still gate eligibility. No new source read was made this continuation.

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

`535df727704be74882c97f966466965d3993255bd5d9b09cc5f17257c753ec5c`

It creates ten prefixed V6 tables (`policies`, `controls`, `models`, `observations`, `positions`, `grade_revisions`, `runs`, `provider_quotas`, `outbox`, `audit`), owner-scoped RLS, same-owner foreign keys, indexes, immutable guards, registration/grading/quota/summary functions and a non-login V6-only worker role. No existing table/row is altered, no seed is inserted and no V5 permission is granted. The new Elo method additionally requires owner-reviewed model registry evidence, minimum sample counts and zero form/rest/shrinkage. SQL tests reject missing review, wrong formulas and late batch failures. Existing tests cover cross-owner/anonymous restrictions, immutable forecasts, atomic rollback, stale grade revisions, duplicate prevention and more than 100 positions without a balance gate.

Fresh read-only remote history confirmed project **`ilgoswfckkzpoktabbfi`** and only `202611030001`, `202611030002`, `202611040001`. V6 is **unapplied**; no push/reset/application write. A real optional Supabase repository and atomic worker-run RPC now exist and pass local SQL/mocked transport tests, including late-write rollback, full request replay hashes, stale revisions and lost-response read-back. New worker-only identity/state/commit functions require the exact owner and restricted role; owner control updates serialize against worker batches. Hosted JWT/RLS compatibility and trusted restricted-token issuance/renewal are still unverified/unprovisioned. No personal or service-role token is accepted by this adapter. Default persistence remains isolated local storage.

Backout: before commit, the SQL transaction rolls back on any error. After deployment, stop/revoke only the V6 worker under approval, preserve all V6 data/audits and leave V5 untouched. Do not drop/reset/truncate tables. Prefer a separately reviewed additive correction. See [deployment checklist](v6-deployment-readiness.md).

## Executed verification and remaining approvals

- 682/682 tests across 54 files, including V6 proposal integration; no skipped tests.
- 147 core/history local SQL assertions (70 + 77), TypeScript, lint and production build passed. Ten intercepted browser regression groups passed without personal-session/hosted writes. The launchd template passes `plutil` syntax validation.
- Offline reconciliation verified all ten genuine observational fixtures without more API requests or rewriting old evidence. Genuine registered A$50 position → final-result settlement is **not yet proven**. The scheduled synthetic lifecycle now runs through qualification, immutable registration, reconciled grading, P/L and restart/idempotency.
- Scheduler/activation tests use explicitly synthetic local approvals and ports. The concrete armed source/model/grading adapter has **not** run live, and no schedule is installed. Hosted V6 RLS/worker auth/restart/concurrency tests remain unverified.

Next executable work is an exact source-only collection/scheduling approval to accumulate new frozen evidence across more slates, followed by offline result/model review. Original strict decisions and exclusions remain preserved. The exact SQL proposal can be separately approved for hosted acceptance work; scoped issuer/renewal and real two-user tests must follow before hosted operation. Model/standing activation remains blocked. No deployment, real source receipt, scheduler installation, external messaging or paid service is authorised by this implementation.
