# Actual P0 execution — 14 November 2026

**Executed, not a proposed command. Five genuine pre-event numerical research forecasts; zero qualifying paper registrations.** The owner's EXECUTE P0/P1 NOW request authorizes this separate local experimental batch, preserving the existing source-only schedule and all hosted gates. It does not approve hosted PAPER A/B/C, the BDL challenger for registration, real wagers or a second source worker.

## Command and retained execution

```sh
node scripts/execute-v6-local-paper.mjs --execute
```

The actual foreground capture ran14November12:47:36–12:48:05 AEDT. Forecast/input cutoff **2026-11-14T01:48:05.347Z /12:48:05.347 AEDT**, commit12:48:07.100. The command returned `paper_run_completed` with **positions:0**, nominal equityA$5,000, pending exposureA$0, P/LA$0 and ROI unavailable. No deposit is implied by the nominal opening reference.

The existing adapters captured three Free BDL games responses plus The Odds API catalogue and one Sportsbet NBA h2h response. **One additional Odds credit**, cumulative11 used/reserved,489 provider credits remaining,49 credits remaining under the approved cumulative60 ceiling;100-credit reserve remains enforced. BDL UTC14November journal3/60,57 local daily slots remain. The prior day's39 requests were not refunded/reset; the adapter performed its normal UTC-day rollover. No paid endpoint, trial, login, bookmaker scraping or other sports API was used.

Native source receipts/capture, approval, original execution and per-cycle evidence stay under ignored `.local/v6/local-paper/p0-20261114/`. Original execution report: `execution.json`. Source quote receipt: `2c8a3f7c-6fff-47c4-bef2-79ccfa475061`. Raw source data is not committed or exposed by an endpoint.

## Actual prospective forecasts

Fixtures are attributed to the fresh BDL NBA schedule and exact native IDs/teams. **No Sportsbet event/quote match was available for these five fixtures**, so bookmaker-side identity/price verification remains unavailable rather than invented. These are source-backed research forecasts, not registered positions.

| Sunday15November AEDT | BDL fixture ID | Home vs away | Control home win | Control away win | BDL challenger home win | Difference pp |
| --- | --- | --- | ---: | ---: | ---: | ---: |
|11:00|21718104|New Orleans vs Denver|28.983004%|71.016996%|28.978015%|−0.004989|
|11:30|21718105|Cleveland vs Dallas|75.607690%|24.392310%|75.607236%|−0.000453|
|12:00|21718106|Miami vs Detroit|39.253661%|60.746339%|39.252400%|−0.001261|
|12:00|21718107|Memphis vs Brooklyn|66.663255%|33.336745%|66.670273%|+0.007017|
|12:00|21718108|Minnesota vs Chicago|83.940060%|16.059940%|83.944569%|+0.004509|

Control: frozen `nba-team-elo-only/candidate-1` definition `ee61e69d684fd15862f9fdd0335f0f9359743aa8377911103451909e2d8fb564`, original Model2 artifact **`5bfe98cb8fec70db371dd61b037e75f927de3348da524a9bca19790661e0a6b4`**, original protected history plus the actual current-source snapshot. Challenger: the same Elo formula with the separate BDL input lineage, artifact **`44edd804bb3aa0802d80928aa61f764adc2f18ae86982a83cab55dc2659a87e7`**, remains explicitly experimental and cannot register a position. All eight model-family outputs for both artifacts are retained in the report; the table compares the same Elo method to isolate input differences.

These are **provisional**. Each fixture involves an unresolved intervening game:21718099 affects New Orleans/Memphis,21718097 affects Cleveland/Miami,21718098 affects Chicago. Available prior finals support a numerical forecast now; their future outcomes were never imputed. `forecastResearchModels` retains these IDs/reasons and always returns `registrationAllowed:false`. The strict worker/forecast path remains unchanged; the local registrar also blocks unresolved intervening games, including games already started. New final evidence at a later cutoff creates a separate future forecast record, never an edit to this one.

Uncertainty: team-results-only models, missing attributable injury/lineup evidence, correlated methods and the challenger's historical quarantine/source-time limitations. No supported calibrated confidence interval exists. Stored home-court/recent-form sensitivity scenarios are parameter scenarios, **not** statistical confidence intervals or independent model agreement. Current model uncertainty cannot be reduced to the number of decimal places printed here. Local paper eligibility uses the frozen date-block cutoff; current-UTC-date finals are excluded consistently with the original Model2 protocol.

## Why registration was zero

The actual Sportsbet response contained **nine Saturday fixtures only**, including in-play markets that were rejected for this Sunday batch. No available Sunday price, original bookmaker timestamp, implied probability or defensible EV could be attributed to these five selections. Existing rules were retained: pre-event exact identity, supported fresh price/source timestamp,60-second safety buffer, original Elo-only experimental baseline, p≥0.55, EV≥0.02, market disagreement and sensitivity checks. High model win probability without a genuine price never qualifies. Unfinished intervening games are an additional exclusion for all five.

No alternative day's wager, fabricated price or historical observation was registered to produce a positive count. The A$50 fixed hypothetical stake applies only after qualification. The five-fixture allowlist is this owner's requested batch scope, not a new daily position/exposure cap.

## Local journal, restart and result lifecycle

Authoritative local ledger: `.local/v6/local-paper/p0-20261114/ledger/`. Each committed revision is a separate immutable file, with actual write timestamp, previous revision hash, state hash and full append-only state. Files are fsynced and published atomically under the existing cross-process mutex; readers verify every revision before loading. Temporary uncommitted files cannot become positions. Schema ownership/cohort checks reject mixed synthetic/real data. There is no V5, funding, Supabase or real wagering capability.

Actual initial head, revision1/file1:

`b546f3acc82aec0ffe9d273ba93685b88f07bd2c1e08bcca5a978af002b4c916`

Original research seal:

`271fd7d2ca65ae6a6898bb91dc42663f93d00c57ac7310bb9285eea0e8ee2915`

The seal records its actual later sealing time separately from the genuine12:48 generation time. It binds the original report/capture/permit bytes. It is not a retrospective registration. Directory/file permissions are0700/0600; hashes detect changed revisions and broken chains, but do not provide hardware WORM protection against privileged directory deletion/truncation.

Fresh-process commands actually executed:

```sh
node scripts/replay-v6-local-paper.mjs
node scripts/execute-v6-local-paper.mjs --status
node scripts/execute-v6-local-paper.mjs --settle
node scripts/execute-v6-local-paper.mjs --consume-retained
```

Replay rehydrated the exact captured inputs at the original cutoff and reproduced **all80 probabilities exactly**, maximum difference0, with network disabled and zero paper writes. Status reload verified revision/head/accounting. Settlement returned `no_registered_positions`; offline consumption returned `no_new_fresh_retained_quote`. No additional API request was made by these commands.

The new local result consumer uses the existing reconciled grader: immutable registered proof, exact market/event/native IDs and original quote; independently agreeing final scores; existing bounded clock-drift/settlement policy. Missing/disagreeing finals remain unresolved. Won/lost/void/push accounting stays in integer cents. Replayed grades cannot double P/L. Synthetic fixtures in disposable directories exercised registration→independent grading→restart→duplicate settlement and positive/negative accounting. **No genuine future-game settlement has occurred yet.**

## Running now and next actual triggers

The original Mac LaunchAgent is still the sole source worker, interval60seconds, original config/model/receipt/schedule unchanged, last exit0. The foreground capture has exited. No second polling process, daemon or LaunchAgent was installed.

- **14November18:00 AEDT:** existing scheduled result job; it can verify Saturday source observations. No Sunday result is assumed.
- **14November19:00 AEDT:** existing scheduled research capture. After it succeeds, the same worker invokes an **offline, keyless** bounded consumer using only retained fresh evidence for the original five BDL IDs. It recomputes forecasts at the new real cutoff, retains a separate cycle/context, and may register qualifying original-control entries automatically under this local execution request. It cannot call a provider or admit the challenger. Original forecasts/quotes stay frozen. The consumer scope expires **15November12:47:21.079 AEDT**; no broad unattended registration policy was activated.
- **15November18:00 AEDT:** next existing result job after these fixtures. If any entries qualify tonight, retained primary/independent finals can be graded automatically by the passive local consumer. No extra result API calls are added. The usual tick/catch-up/missed-job/retention rules apply; this requires the Mac awake, logged in and online. Future availability/qualification/grading has not been claimed as tested live today.

Local emergency stop: create `.local/v6/local-paper/p0-20261114/STOP`. This stops local registration/settlement while preserving the source pilot. Existing source STOP/kill-switch also blocks paper commits. `consumer-scope.json` binds the five original IDs and sealed initial execution; it is operational scope derived from this execution request, not global model/PAPER approval. Existing cloud/hosted PAPER activation remains disabled.

## Verification, limitations and hosted blocker

**793 tests in74 files passed**, including8 new disposable journal/research/result tests. Also passed:70 core +77 history +15 source SQL checks,13 isolated multi-process cloud regression groups, TypeScript, lint, production build, original-model/source hash checks and five private-file/secret/disabled-state groups. All database/positive lifecycle tests here are local/synthetic, not new hosted acceptance. No paid dependency, hosted write/migration/credential, Vercel release, GitHub Actions activation or V5 change occurred. The bounded future scheduled consumer is installed in the existing tick; its future live outcome remains unverified.

Hosted unattended PAPER is still blocked by **undeployed/unapproved PAPER schema and scoped hosted worker provisioning/activation**, plus unresolved cloud source/model/identity compatibility and single-host handover. Deployed source-only storage is not a PAPER ledger. This local permit approves none of those hosted changes. The P0 local journal/research report is a filesystem artifact; no unrelated UI redesign or new public endpoint was added.
