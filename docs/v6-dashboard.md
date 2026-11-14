> **14 November V6.1 local journal integration:** the separate bounded P0 journal is now projected **locally**, with immutable research/proof validation and independent-grade replay under the existing owner binding. Cloud mode still refuses local PAPER; hosted persistence is not inferred. The original statement below that the local journal is not projected belongs to the earlier UI-only checkpoint. All existing routes/charts remain. [Current read-only adapter, real zero positions, activation expiry and verification](v61-local-paper-lifecycle.md).

> **14 November UI simplification:** the `feature/v6-ui-simplification` branch replaces the redundant navigation and repeated empty summaries with four primary destinations, a compact read-only overview, separate ledger states and expandable status diagnostics. All five V6 and eight V5 routes remain accessible. The separate local P0 paper journal is still **not projected** here; unavailable is not zero. Backend `productionStatus`, source access, models, worker schedules and PAPER activation are unchanged. See [UI changes and verification](v6-ui-simplification.md). Older access/deployment statements below are dated checkpoints, not the current cloud security policy.

> **13 November post-sync review:** remote 0934b2f sync is verified; new tested code is 2cd0d28. Exact unconnected message, post-lease/idle-integrity guards and post-response result clocks are implemented. Eight isolated worker processes passed 13 synthetic lifecycle groups; this is not hosted persistence proof. The live site still serves the old localhost403. Feature pushes are guarded from automatic Vercel deployment; manual Preview/Production, source storage/provisioning and host transfer remain separate approvals. Mac pilot unchanged; see [current cloud evidence](v6-cloud-deployment.md#post-sync-acceptance-and-remaining-deployment-evidence).

> **13 November cloud continuation:** authenticated Production/Preview HTTPS access and a private durable source-store adapter are implemented locally. The sports proxy stays loopback-only. Cloud storage, a disabled pinned GitHub Actions runner and code-bound host transfer are prepared; no hosted migration, deployment, credential issue, source request or local service change was performed. The approved Mac source-only pilot remains loaded. The original local-only descriptions below are dated checkpoints, superseded for the new dashboard access policy by [cloud deployment](v6-cloud-deployment.md). PAPER A/B/C and cloud host transfer remain unapproved.

# V6 read-only dashboard

The existing website now exposes the retained V6 research through the existing design system. It does not require the proposed V6 hosted schema. No dashboard action starts a worker, requests sporting data, activates a model, registers a position, settles a result or changes V5 history.

## Routes

- `http://localhost:3000/v6`: nominal A$5,000 / fixed A$50 policy, owner-local paper accounting when available, separate genuine observations and synthetic-test classification.
- `/v6/research`: all 20 frozen NBA moneyline selections and ten blocked player-prop observations in the retained archives, including both-pass exclusions, original odds, probability/EV when supported, source/capture/forecast/frozen clocks, exact event IDs and reconciled observational scores. Search and outcome/upcoming filters work. Upcoming means future-dated retained evidence; it does not fetch current fixtures. Other sports are not represented as working feeds.
- `/v6/models`: functional model score and calibration charts, exact metric table, historical/prospective sample selector, candidate/challenger/bookmaker comparisons and limitations. One home-win forecast per verified fixture is the prospective unit. Historical bookmaker metrics remain unavailable because historical odds were not retained. Ten games on one slate cannot establish calibration or profitability.
- `/v6/positions`: only an authenticated owner's isolated `v6-prospective` positions, original snapshots and latest grade revision, deterministic hypothetical P/L and accounting. No archived observation is converted into a position. Empty/unactivated repositories are explicit rather than implying a verified hosted zero balance.
- `/v6/health`: retained owner configuration, scheduler jobs, sanitized error indicators, actual invocation receipt when available, source/quota snapshots and independent A/B/C blockers. No scheduled service, credential validity or live provider coverage is asserted without evidence. No emergency-stop write control is introduced.

`GET /api/v6/dashboard` is a private, local-only, read-only adapter. Other verbs are unsupported. No arbitrary path, owner or query argument is accepted. Its output contains an explicit display DTO rather than source-file objects.

## Owner access without account setup

Use the **existing signed-in private workspace**. Browser code reads the current session and sends its access token only in the Authorization header. The server independently verifies it with Supabase Auth, then uses the same ordinary authenticated token to SELECT an existing archive batch ID through RLS, with an explicit `user_id` predicate. It has no privileged service credential. The batch primary key is global; a different owner cannot reproduce that batch ID in another account.

Ignored `.local/v6/dashboard-access.json` contains `{ "version": 1, "historyBatchId": "<existing private archive batch UUID>" }`. This task configured that local binding from the existing reviewed account-activation backup. It created no hosted record, session or credential. It is intentionally not a first-user enrollment endpoint. Never commit that binding or the owner's exports. If restoring onto a different development machine, restore the access file privately from the same local backup, or set its batch UUID from your own existing archive export; do not import another batch just to unlock the dashboard. Missing/invalid binding yields a clear 503; a session without access to the batch yields 403. Authenticated positive access in the owner's actual browser still requires opening the route; synthetic transport tests do not prove that hosted check.

Demo never requests this API and never displays the private evidence. An owner switch hides the prior owner's loaded DTO immediately. Missing/revoked sessions, public hosts and cross-origin requests fail closed; no auth token is accepted in a URL. Responses use private/no-store headers and contain no raw source bodies, query URLs, API keys, credential hashes/files, personal history, private filesystem paths, owner identifiers or upstream error contents. Loopback-only deployment is deliberate; a future hosted dashboard needs a separately reviewed evidence repository/owner binding.

## Evidence and accounting boundaries

`src/lib/v6/dashboard.server.ts` reads fixed allowlisted retained archives and the requesting owner's hashed controlled-worker directory. It validates source DTOs with Zod, frozen-wrapper hashes and content-addressed report hashes, and rejects symlinks outside the evidence root. Source status distinguishes available/missing/invalid independently, so one damaged file cannot create invented metrics or erase other source statuses. It does not call the report-generation functions, which would write new reports.

The original 20-selection shadow ID and player-prop batch are explicitly selected. Future batches require extending this allowlisted adapter; this is an evidence viewer, not an automatically discovering collector. Within these batches every selection is retained, including exclusions. Real observations are never added to paper accounting. Synthetic fixtures/repositories are never searched or aggregated. Forecast probabilities remain original model outputs, not LLM estimates or refreshed calculations.

Owner paper state: `controlled/<SHA256(ownerId)>/state/<SHA256(ownerId + ':v6-prospective')>.json`; schemas reject owner/cohort mismatch and synthetic position evidence. Grades must also be prospective. Existing `paperAccounting` and `hypotheticalProfit` supply cents-based accounting. Missing state means not activated/unavailable; the A$5,000 reference is not a deposit or verified sportsbook balance.

Owner scheduler: the same controlled directory's `scheduler.json` and `health.json`; only actual `workerInvoked=true` receipts count as last worker executions. `controlled-config.json`, if present, must match the owner; no manifest or secret file is followed. The dashboard deliberately does not use the private configuration's credential path. It does not infer daemon installation from the presence of a planned job. Shared Odds API and BALLDONTLIE quota receipts are timestamped observations; missing remaining quota is null, not guessed.

Production status is conservatively locked to disabled for this undeployed dashboard stage. No UI state can grant A/B/C approval. If those approvals/deployment are later completed, review and update this adapter; do not assume that changing a local config makes this page a production control plane.

## Verification

Unit/endpoint tests cover anonymous/expired/non-owner rejection, same-origin/loopback enforcement, no-store, malformed evidence, tampered hashes, source redaction, owner/cohort mismatch, observational result isolation and error/retry handling. Browser checks use synthetic accounts and intercepted transports; they cover all five routes, functional charts/filters, empty ledger/reload, health/error/retry, mobile layout and Demo isolation. They never use the personal browser profile or write to hosted Supabase.

Commands:

```sh
npm test
npm run typecheck
npm run lint
npm run build
node scripts/check-v6-dashboard-browser.mjs --runtime /private/tmp/edgelab-browser
```

Optional browser/embedded-PostgreSQL runtimes remain external local test tools; no new paid dependency was added. See the latest implementation-status entry for executed results and outstanding live verification.

Executed for this change: 701/701 tests (57 files), 70 core +77 historical SQL assertions, seven new dashboard browser groups plus fourteen existing regression groups, typecheck, lint and production build all passed. Actual anonymous localhost GET returned 401. Adapter inspection loaded the real retained 30-selection/10-result/5,082-game evidence without rewriting it. Positive owner access through the real signed-in browser remains a manual read-only inspection, not a claimed hosted acceptance result.

## Prediction Engine 2.0 integration

Model Intelligence now includes the retained development report from `model-development/reports` and a separate owner-scoped read-only multi-slate shadow summary. These are projected through strict display schemas. Brier/log loss have separate charts; calibration uses populated scatter points/counts and a perfect-reference diagonal. Exact model versions, experimental/benchmark statuses, sample periods, per-season roles, ECE and paired error intervals are visible. Historical fitting/tuning/calibration roles and prior inspection are explicit. The separate new prospective tab is empty until genuine approved collection/results exist; no newly fitted forecasts are backfilled onto the original ten fixtures. Source/raw scores/coefficients never leave the server.

The owner reported successful private Overview/Model Intelligence access before this update. New charts were exercised with synthetic intercepted transport and actual retained aggregate data in an isolated render; no fresh positive normal-user hosted production write/security claim is made. Final checks for this update:719 tests,147 local SQL assertions,9 statistical/dashboard browser groups, typecheck/lint/build passed. Full methods and reproducible actual results: [model development](v6-model-development.md).
