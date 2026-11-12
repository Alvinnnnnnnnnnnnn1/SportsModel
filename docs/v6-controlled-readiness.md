# Current source-only readiness — 13 November 2026

The actual model2 worker integration has been exercised with controlled synthetic providers, including genuine-style future fixture discovery, common cutoff/frozen forecasts, exact Sportsbet market identity, dual-provider results, corrected/idempotent revisions, earliest-valid-quote locking, verified-event request suppression, restart recovery, emergency stop and cumulative credit exhaustion. It is ready for a **bounded approved source experiment**, subject to real provider availability and an awake/connected local host; it is not live-accepted or installed.

[Exact proposed14-day window, cadence, file hashes and approval request](v6-source-pilot-approval.md). This uses the existing scheduler/CLI, not a new scheduler. No active receipt/config, network request, LaunchAgent installation or model activation was made. Source-only collection can release its operational kill switch while still forbidding armed mode, paper positions/grades, model/standing manifests, hosted persistence and paper credentials. Every provider request and evidence commit rechecks the approved window/control state; STOP suppresses subsequent calls. Pending/expired/tampered receipts reject.

The source namespace is a local key derived from the existing private batch anchor, not a fabricated Auth account. Dashboard visibility still requires the real account's verified Auth and RLS-owned batch. Source-only state is isolated from actual paper and V5 financial repositories. Model2 prospective display includes actual new source rows only after authorised capture; an empty feed is explicitly not successful collection.

Current retained source allowance:10 reserved/used,490remaining; approved maximum50 additional would become cumulative60, with100reserve. Proposed normal cadence41 credits +9 contingencies,13 captures and result tail inside14days. Fully verified fixtures are not routinely fetched again; later independently supplied corrections append without rewriting forecasts. The Mac sleep/network/retention caveats and date-expiry approval requirement are explicit in the package. No uptime guarantee or future source acceptance is claimed from synthetic tests.

Executed:730 tests,147 local SQL checks,8 intercepted browser groups, typecheck/lint/build; disabled CLI and offline plan/plist checks passed. A/B/C remain independent and unapproved. No new SQL hash; the existing c3a0… proposal is unchanged.

---

# V6 controlled activation readiness — 12 November 2026

**Prepared locally, disabled, not deployed or activated.** All ten fixtures/twenty observations remain verified and immutable; no retrospective position/P&L. The [final security preflight](v6-security-preflight.md) adds owner-issued hashed/revocable capabilities and a separately proposed [experimental paper policy](v6-experimental-paper-policy.proposed.md). No external JWT signer or daily browser session is needed for that worker path. Hosted acceptance and independent A/B/C approvals remain open. No V5/account/methodology/funding/deployed-schema change. [Exact approval package](v6-deployment-approval-package.md).

Latest implementation commits `5423a6d` (reconciliation) and `78035c5` (atomic persistence/readiness/collection authority), branch `feature/v6-autonomous-paper`. Original foundation commits `59b129e` and `60b6b91` remain preserved.

## Proposed activation policy

`controlled-activation.ts` binds the existing uncapped `v6-uncapped-paper-1` financial policy, `nba-moneyline-two-pass-1` selection policy, fixture identity/settlement terms and new `nba-controlled-paper-1` controls into one SHA-256 approval bundle. This is a local proposal, not saved owner approval or a change to Methodology Revision 1.

The possible registered baseline is **`nba-team-elo-only` / `candidate-1`**, method `nba_team_elo_only`: initial rating 1500, K 20, home advantage 60, season retention 0.75, zero form/rest adjustment and zero shrinkage. The formula is reproduced by TypeScript and the proposed SQL. The existing form/rest challenger remains experimental; it underperformed Elo on the chronological benchmark. Their shared data/rating family is not independent agreement.

Activation requires owner/model/standing-policy hashes and approval records. Experimental paper can start after explicit B/C with reproducible frozen Elo inputs, chronological evaluation, feature cutoffs, defensible numerical estimates and reviewed uncertainty; it needs no prior sportsbook profitability or thirty prospective results. Price, p≥0.55, EV≥0.02, sensitivity, source and pre-event gates are unchanged. The stronger-evidence tier retains its separate multi-slate/calibration/benchmark review; thirty games alone never establish reliability. Current evidence is 4,774 chronological games and ten observational games/one slate. Neither tier is activated.

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

`c3a0d368ddbda1b50f3dab13aeec7cb3a939e423bce894aa1d55cfe9f13a3dff`

It creates eleven V6 tables (the ten domain tables plus hashed `worker_credentials`), thirteen policies, twenty-one functions/four limited-role definers, twenty-three triggers and nineteen catalog indexes. No existing record/table/policy is altered. The original requested hash535df… matched and was tested separately; the candidate has a new approval scope. [Complete operation inventory and definer review](v6-security-preflight.md).

Fresh read-only history still confirms project **`ilgoswfckkzpoktabbfi`** and only the three deployed migrations. V6 is unapplied. The preferred optional repository uses a 0600 capability file, public API key and a narrow credential-checked dispatcher. The existing owner can enroll/rotate/revoke once through signed-in Settings after A, without a new account. Thirty-day default expiry requires periodic rotation, not daily login. Local SQL/worker/HTTP/browser tests cover scope, ownership, rollback, real-clock synthetic settlement and revocation. Hosted gateway/RLS/logging/multi-connection behavior remains unverified. No project signing/service key or API-role membership is part of the design.

Backout: before commit, the SQL transaction rolls back on any error. After deployment, stop/revoke only the V6 worker under approval, preserve all V6 data/audits and leave V5 untouched. Do not drop/reset/truncate tables. Prefer a separately reviewed additive correction. See [deployment checklist](v6-deployment-readiness.md).

## Executed verification and remaining approvals

- 690/690 tests across 56 files, including exact SQL audit/rollback, credential error redaction and capability-backed lifecycle; no skipped tests.
- 147 core/history local SQL assertions (70 + 77), TypeScript, lint and production build passed. Ten intercepted browser regression groups passed without personal-session/hosted writes. The launchd template passes `plutil` syntax validation.
- Offline reconciliation verified all ten genuine observational fixtures without more API requests or rewriting old evidence. Genuine registered A$50 position → final-result settlement is **not yet proven**. The scheduled synthetic lifecycle now runs through qualification, immutable registration, reconciled grading, P/L and restart/idempotency.
- Scheduler/activation tests use explicitly synthetic local approvals and ports. The concrete armed source/model/grading adapter has **not** run live, and no schedule is installed. Hosted V6 RLS/worker auth/restart/concurrency tests remain unverified.

Next executable work is **Approval A only** for the exact hardened SQL and hosted security acceptance. B reviews the proposed experimental policy independently; C installs/enables the worker after hosted checks and enrollment. Stronger-evidence review remains separate; do not impose its prior-results floor on approved experimental paper or promote experimental results into high-confidence claims. No approval, hosted credential, model activation, schedule, external notification or paid service was created.
