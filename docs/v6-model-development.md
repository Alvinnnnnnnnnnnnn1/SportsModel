# V6 model development — Prediction Engine 2.0

Offline implementation and actual retained-data evaluation, 12 November 2026. No new source requests, model activation, hosted changes, position registrations or V5 writes. Frozen Elo-only remains unchanged.

## What was built

The score-only NBA framework compares frozen Elo, a bounded margin-of-victory Elo, a regularised feature-strength model, original form/rest challenger, smoothed win-rate benchmark and three separately fitted logistic recalibrations. They are independent numerical forecasts of sporting outcomes, not LLM guesses; models sharing game histories/ratings are **not independent corroborating evidence**. All new variants remain experimental.

Reference implementation: src/lib/v6/prediction/{models,statistics,evaluation,forecast,shadow.server,report}.ts. Reproducibility implementation commit: 896cfda. No statistical package, paid SDK or Python dependency was added.

## Sources and unchanged reference

Uses only the original frozen 5,082 canonical NBA regular-season final-game snapshot, retained from permitted API-NBA historical and BALLDONTLIE Free game responses. No ESPN/NBA CDN/mirror download or additional API request occurred. Every new challenger uses the same 4,774 eligible distinct games as the existing evaluator; 308 initial warm-up games are not scored. Source receipts and fixture identities remain under ignored .local/v6.

The unchanged original dataset-file SHA-256 is `31aa630215a5583b90f87f92e6193883a778f6795a9068f2014118685c9283a0`. The canonical frozen forecast-history array is a separate retained representation. Snapshot SHA-256: `5459a26d13015afa7fc6793b6d970493042bec197c78e305d2d2d8ea6d92e808`. Existing baseline definition SHA-256: `ee61e69d684fd15862f9fdd0335f0f9359743aa8377911103451909e2d8fb564`. Existing 20-selection shadow hash stays `98fc72f7a26e68dae7dc5dc55db30bad15561e4b690fb3fdc8285992496e31c8`. The old 4,774-game scores reproduce exactly; the baseline code/definition and original predictions were not rewritten.

Possessions, pace, offensive/defensive efficiency, timely injuries/rosters/lineups and historical rest completeness are **unavailable and excluded** from the new feature model. Original publication times remain null. A prior-date result simulation cannot establish when that result was actually published. No historical pre-event odds are available; historical results are not bookmaker-relative backtests.

## Model definitions

- **Frozen reference — nba-team-elo-only/candidate-1:** initial1500, K20, home60, season retention0.75, no form/rest/shrinkage. It remains frozen.
- **Margin Elo — mov-1:** ordinary Elo logistic win expectation; update K × bounded MOV multiplier × (result − expected result). The multiplier is clamp(log(1+min(margin,40))/log(11) × 2.2/(2.2+0.001×clamp(winner advantage,−600,600)),0.5,2.5). Winner advantage uses pre-date-block ratings plus home advantage. Blowout contribution has diminishing returns and is capped; updates are zero-sum. This is EdgeLab's declared experimental formula, not a reproduction of FiveThirtyEight's specific NBA formula.
- **Feature strength — features-1:** regularised logistic regression over intercept, margin-Elo rating difference, opponent-adjusted last5 and last10 margins, season strength shrunk toward longer-term strength, home/away venue strength shrunk toward team history, and longer-term60-game strength. Inputs have fixed predeclared scaling/clipping; no full-dataset normalization. Opponent-adjusted margin subtracts home advantage/25 and adds the opponent's pre-date-block rating deviation/25, with signed inversion away. The /25 conversion is a declared modelling approximation, not an independently observed statistic. Season prior weight20 and venue prior weight10 regularise sparse history. Rest/injuries/possession features are absent.
- **Original challenger — experimental-1:** preserved without rewriting. Its historical rest term remains disabled because completeness was unverified. Future original-challenger forecasts can use that existing term only when the current pagination-based completeness check supports it.
- **Win-rate benchmark — benchmark-1:** the existing smoothed team-win-rate construction, not a learned advanced forecast.
- **Recalibrations — elo-cal-1, mov-cal-1, features-cal-1:** logistic recalibration of each raw logit, fitted only on the designated earlier calibration period. Regularisation toward intercept0/slope1; slope constrained0.25–2; output0.01–0.99. These bounds regularise numerical overconfidence; they do not establish calibration. Raw probabilities remain preserved. Isotonic fitting was not added as a second flexible search on this already inspected history.

All predictions for a UTC date block precede every result update in that block. Recent/season/venue features use prior dates only, opponent ratings are taken before that date, and season ratings regress before the new-season prediction. No post-target label enters the target features. Historical comparisons preserve the original evaluator’s fixture cohort, while live freshness/completeness checks can additionally exclude season openers or sparse current coverage. Missing injury/lineup facts are never filled with invented data.

[FiveThirtyEight's primary dataset documentation](https://github.com/fivethirtyeight/data/blob/master/nba-elo/README.md) provides general NBA Elo context; its data were not imported. [Scikit-learn's calibration guidance](https://scikit-learn.org/stable/modules/calibration.html) supports separating calibration fitting from evaluation and distinguishing calibration from other components of proper scores. EdgeLab implements its own deterministic TypeScript calculations.

## Frozen chronology and selection protocol

Protocol `f53585ca5fbf2bcffbb8dd9283885ba362261710a54a0283fc192d58dcc9b854` was written before executing this evaluation. It is versioned as nba-prediction-development-2. No parameters were selected against the ten-game genuine prospective slate.

| Role | Eligible unique games | Exact UTC period | Use |
| --- | ---: | --- | --- |
| training | 922 | 2022-11-29T00:00:00.000Z → 2023-04-09T19:30:00.000Z | 2022 initial coefficient fitting |
| tuning | 1231 | 2023-10-24T23:30:00.000Z → 2024-04-14T19:30:00.000Z | 2023 MOV/penalty selection; then included in coefficient refit |
| calibration | 1231 | 2024-10-22T23:30:00.000Z → 2025-04-13T19:30:00.000Z | 2024 recalibrator fitting only |
| finalTest | 1230 | 2025-10-21T23:30:00.000Z → 2026-04-13T00:30:00.000Z | 2025 later evaluation; previously inspected history |
| monitoring | 160 | 2026-10-20T19:00:00.000Z → 2026-11-11T04:00:00.000Z | 2026 partial-season monitoring; also previously inspected |

The 2025 period is isolated from **this run's** fitting/tuning; it is not an untouched scientific holdout because the earlier engine already inspected these games. The same limitation applies to partial2026. No score is reclassified as genuinely prospective. Future pre-event freezes across new slates are the decisive next evidence. Per-season training/tuning/calibration metrics are retained but explicitly labelled by role.

MOV search: K∈{12,20,28}, home∈{40,60,80}, season retention∈{0.5,0.75}:18 declared trials. Select lowest 2023 Brier. Feature penalties∈{0.001,0.01,0.1,1}: initial fit on2022, choose by2023 Brier, then refit coefficients on2022+2023. Fit all calibrators on2024 only; compare calibrated and raw outputs on2025/2026. Final-test scores were not used to retune the grid or choose a calibration formula.

Selected MOV K=20, home=40, retention=0.75; feature penalty=0.001. Every losing trial, validation score, coefficient vector, prediction and model version is retained in the content-addressed report.

## Later chronological evaluation — 2025 season

| Model | n | Brier | Log loss | ECE (10 bins) | Δ Brier vs Elo | 95% paired block interval |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Frozen Elo-only / candidate-1 | 1230 | 0.209461 | 0.607578 | 0.025729 | 0.000000 | 0.000000 to 0.000000 |
| Margin-adjusted Elo / mov-1 | 1230 | 0.206445 | 0.600459 | 0.037434 | -0.003016 | -0.004884 to -0.001267 |
| Feature-enhanced strength / features-1 | 1230 | 0.207452 | 0.602772 | 0.031338 | -0.002010 | -0.005384 to 0.001307 |
| Elo + logistic calibration / elo-cal-1 | 1230 | 0.209228 | 0.606622 | 0.028054 | -0.000233 | -0.001848 to 0.001427 |
| Margin Elo + calibration / mov-cal-1 | 1230 | 0.206530 | 0.600552 | 0.034852 | -0.002931 | -0.005013 to -0.000868 |
| Features + calibration / features-cal-1 | 1230 | 0.207370 | 0.602563 | 0.030334 | -0.002092 | -0.005195 to 0.001303 |
| Original form/rest challenger / experimental-1 | 1230 | 0.208857 | 0.605772 | 0.022633 | -0.000604 | -0.002105 to 0.000829 |
| Smoothed historical win rate / benchmark-1 | 1230 | 0.241202 | 0.675284 | 0.057528 | 0.031740 | 0.021215 to 0.042662 |

Margin Elo has the lowest raw-model error here: Brier improves by0.003016 (about1.44% relative), with log loss improving by0.007118. ECE is **worse** than frozen Elo (0.037434 versus0.025729), so improved discrimination/proper scores do not imply improved calibration. The feature model's improvement interval includes zero. None is promoted.

## Partial 2026 monitoring

| Model | n | Brier | Log loss | ECE | Δ Brier |
| --- | ---: | ---: | ---: | ---: | ---: |
| Frozen Elo-only | 160 | 0.204304 | 0.591515 | 0.077400 | 0.000000 |
| Margin-adjusted Elo | 160 | 0.200912 | 0.584202 | 0.071473 | -0.003393 |
| Feature-enhanced strength | 160 | 0.204899 | 0.591795 | 0.107778 | 0.000594 |
| Elo + logistic calibration | 160 | 0.200909 | 0.584627 | 0.066900 | -0.003395 |
| Margin Elo + calibration | 160 | 0.200258 | 0.582716 | 0.065593 | -0.004046 |
| Features + calibration | 160 | 0.204937 | 0.592388 | 0.116280 | 0.000633 |
| Original form/rest challenger | 160 | 0.203706 | 0.591123 | 0.100855 | -0.000598 |
| Smoothed historical win rate | 160 | 0.235671 | 0.664054 | 0.100888 | 0.031366 |

Margin+calibration is lowest on this small160-game monitoring period, while uncalibrated margin wins on2025. This inconsistency does not justify selecting/re-fitting calibration after seeing the later results. The feature model is slightly worse than Elo on2026; greater complexity is not automatically better.

## Per-season comparisons

| Season / role | n | Elo Brier / log loss | MOV Brier / log loss | Features Brier / log loss | MOV Δ Brier [95%] |
| --- | ---: | --- | --- | --- | --- |
| 2022: feature fitting; not out of sample | 922 | 0.227406 / 0.646681 | 0.227051 / 0.645586 | 0.225674 / 0.642595 | -0.000355 [-0.002505, 0.002162] |
| 2023: tuning/refit; not final evaluation | 1231 | 0.213921 / 0.614695 | 0.211964 / 0.610604 | 0.209775 / 0.605761 | -0.001957 [-0.003539, -0.000101] |
| 2024: calibration fitting; calibrated metrics are in sample | 1231 | 0.214618 / 0.617244 | 0.211683 / 0.610597 | 0.212494 / 0.612450 | -0.002935 [-0.004486, -0.001338] |
| 2025: later chronological evaluation; previously inspected history | 1230 | 0.209461 / 0.607578 | 0.206445 / 0.600459 | 0.207452 / 0.602772 | -0.003016 [-0.004884, -0.001267] |
| 2026: later chronological evaluation; previously inspected history | 160 | 0.204304 / 0.591515 | 0.200912 / 0.584202 | 0.204899 / 0.591795 | -0.003393 [-0.005036, -0.001450] |

MOV's direction is consistent across these years;2022 is training and2023 is selection, so they are not corroborating test replications. Later2024/2025/partial2026 are encouraging relative to Elo, subject to prior-inspection and time/publication limitations. Calibration fitting-year scores are in sample for calibrated variants and never evidence of later reliability. Full per-model, per-season calibration bins, counts, ECE and log-loss uncertainty are retained and inspectable through Model Intelligence.

## Parameter sensitivity — 2023 tuning only

| K | Home advantage | Season retention | Validation Brier | Validation log loss |
| ---: | ---: | ---: | ---: | ---: |
| 12 | 40 | 0.5 | 0.214946 | 0.618721 |
| 12 | 40 | 0.75 | 0.213674 | 0.615509 |
| 12 | 60 | 0.5 | 0.216200 | 0.621023 |
| 12 | 60 | 0.75 | 0.214859 | 0.617705 |
| 12 | 80 | 0.5 | 0.218835 | 0.626280 |
| 12 | 80 | 0.75 | 0.217382 | 0.622823 |
| 20 | 40 | 0.5 | 0.212683 | 0.612621 |
| 20 | 40 | 0.75 | 0.211964 | 0.610604 |
| 20 | 60 | 0.5 | 0.213675 | 0.614595 |
| 20 | 60 | 0.75 | 0.212894 | 0.612488 |
| 20 | 80 | 0.5 | 0.215944 | 0.619475 |
| 20 | 80 | 0.75 | 0.215060 | 0.617252 |
| 28 | 40 | 0.5 | 0.212760 | 0.612164 |
| 28 | 40 | 0.75 | 0.212359 | 0.610916 |
| 28 | 60 | 0.5 | 0.213584 | 0.613949 |
| 28 | 60 | 0.75 | 0.213127 | 0.612626 |
| 28 | 80 | 0.5 | 0.215616 | 0.618632 |
| 28 | 80 | 0.75 | 0.215066 | 0.617213 |

These are sensitivity diagnostics on the selection period, not eighteen independent final tests. Multiple comparisons and prior dataset exposure weaken post-selection inference.

## Calibration and uncertainty

Scores use one home-win binary label per unique fixture. Brier and natural log loss are separate; ECE is a ten-bin, sample-weighted absolute calibration gap and depends on binning. Every populated bucket exposes n, mean forecast and observed rate. Bins below30 are sparse; empty bins are omitted from the scatter plot. The diagonal is perfect calibration, not a fitted assertion.

Descriptive paired intervals resample contiguous blocks of seven NBA event dates within each season,400 deterministic replicates (seed20261112), with each model compared against Elo on identical selected game blocks. Repeated-team dependence beyond seven dates, structural drift, prior inspection, small partial2026 and model search remain limitations. Blocks truncate at the season boundary; effective blocks can therefore contain fewer than seven dates. These intervals are not adjusted proof of a sporting edge or individual-game probability confidence bounds. Adverse candidate scenarios are sensitivity tests, not calibrated confidence intervals.

## Genuine prospective evidence and bookmaker comparison

The original ten fixtures/twenty sides remain frozen observations. Elo Brier/log loss0.1868505827/0.5559565291; old challenger0.1875740042/0.5553625715; original Sportsbet de-vig0.1739424020/0.5209852336. The bookmaker benchmark beat both original models. One slate cannot support a meaningful multi-slate interval. New MOV/features/recalibrations have **zero** genuinely prospective results; no forecasts were backfilled onto those ten outcomes. No model has demonstrated a Sportsbet advantage. No historical odds/ROI or CLV is invented.

## Two-pass research and future shadow lifecycle

The existing nba-moneyline-two-pass-1 thresholds are unchanged: exact fixture/source/identity/time evidence first; credible likelihood plus reasonable actual Sportsbet price second. New shadow decisions expose break-even, de-vig, independent model probability, EV, low-likelihood/price exclusions, margin home-court±20 and feature recent-form ablation, and the existing probability-contraction stress. Model disagreement is recorded without pretending shared Elo inputs are independent confirmation. Every supported side is frozen, including research passes, rejections and missing-data decisions. An experimental research pass is never a strongly supported paper registration.

The existing controlled worker now optionally calls model2 shadow freezing/results using the same source adapters, shared quotas, scheduler jobs and emergency stop. A separate future-date BDL fixture request fixes discovery beyond the through-today feature scope. Actual future source receipts, features, model/parameter artifact, original odds/timestamps, both sides and correlation group are immutable. Existing exact-ID/dual-provider reconciliation verifies results; disparities remain unresolved. Repeated event+artifact/model versions use the **earliest frozen quote** for primary evaluation. Multiple opposing/repriced rows cannot double the primary sample. Immutable result revisions permit independently evidenced corrections; no observational record becomes a position.

No active model2 shadow configuration or source-collection approval was created. No collection/scheduler was run. The positive end-to-end scheduler test uses clearly synthetic responses in a temporary local directory. The shortest route to new honest evidence is a separate bounded **read-only source-collection approval**, then a reviewed shadow artifact/config, existing dry-run worker and independent result checks within the three-day retention window. It does not require falsely proving prior profits, deploying SQL or activating paper positions first.

After such approval only, configure ignored .local/v6/model-development/shadow-config.json with version1, the existing worker ownerId, enabled=true, artifactHash below, reviewedAt, and scope=shadow_only_no_paper_positions. Use the existing expiring collection receipt, mode=dry_run and normal controls; run the existing CLI/scheduler. This text is an instruction for a later approved step, not authority to enable it now. Disabled/missing config performs no model2 collection.

## Reproduction and immutable artifacts

```sh
node scripts/evaluate-v6-prediction-models.mjs --prepare
node scripts/evaluate-v6-prediction-models.mjs --protocol-hash f53585ca5fbf2bcffbb8dd9283885ba362261710a54a0283fc192d58dcc9b854
# Offline only, after future slates exist:
node scripts/evaluate-v6-model2-shadows.mjs --owner EXISTING_WORKER_OWNER_ID
```

Report SHA-256: `3fdc9f21c3abd78aa195b3817452865f82f9bc47fac6bc69d5869ed54c071519`. Artifact SHA-256: `5bfe98cb8fec70db371dd61b037e75f927de3348da524a9bca19790661e0a6b4`. Reports live under ignored .local/v6/model-development/reports/<hash>.json; artifacts under artifacts/<hash>.json. No env/API key is loaded by the offline evaluator. Re-running the same protocol/snapshot produces the same report and artifact hashes.

## UI, security and autonomy boundary

Model Intelligence at /v6/models uses the owner-authenticated existing read-only endpoint, projects only validated summary fields, and now separates Brier/log-loss charts, gives exact game counts/periods/versions/statuses, displays populated calibration dots/counts/perfect reference, per-season scores and explicit fitting/inspection limitations. Genuine original prospective results and historical development remain separate; synthetic tests are excluded. Raw datasets, coefficients, private sources and secrets are not returned by that endpoint.

Approval A is still the exact unchanged SQL SHA-256 `c3a0d368ddbda1b50f3dab13aeec7cb3a939e423bce894aa1d55cfe9f13a3dff`. B remains an explicit model/qualification review; C remains worker installation/activation after security/source checks. Current production types/SQL support the frozen Elo candidate, **not these new challenger methods**. Registering a new margin/features method later needs separately reviewed domain/formula/manifest and SQL support, with a new hash if the proposal changes. This task deliberately does not weaken those checks. A bounded research-only shadow approval is distinct from A/B/C.

A$5,000 nominal reference, fixed A$50 positions, unlimited distinct eligibility, immutable snapshots, existing grading and cash/bonus/V5 separation are unchanged. No model credential, worker credential, migration, daemon, Hermes or real-money execution was activated.

## Verification

See the latest implementation status for final executed unit/SQL/browser/typecheck/lint/build totals. Numerical tests cover identical game units, date-block/future-result leakage, margins/blowouts/opponent strength, fitting/calibration separation, null evidence, original baseline reproduction and deterministic uncertainty. Isolated source/scheduler tests cover future discovery, all-model pre-event freezing, replay/alteration/ownership rejection, two-provider finals/disagreement, multi-slate deduplication and zero registrations.

Executed final checks: **719/719 tests,60 files;147 local SQL assertions;9 browser groups;TypeScript,lint,production build passed**. The identical report/artifact hashes were reproduced in a second offline run. Owner account data, quotas, deployment state and the original frozen snapshots are unchanged. The full verbatim V5.2 document remains unavailable locally; its explicit owner-provided two-pass principles and the existing frozen quality policy were preserved rather than claiming missing text was read.

## Subsequent bounded prospective-pilot preparation — 13 November 2026

No model training or tuning was repeated. The existing artifact/report hashes remain unchanged. Operational review fixed unnecessary verified-result calls, early-freeze/reprice replay, commit-time safety, per-request receipt/stop checks and scheduler restart recovery. Result facts are idempotent; independent corrections append revisions, unavailable sources stay unresolved, and actual fixture counts remain unique. Prospective summaries now retain per-event-date scores/source-quality counts and paired bookmaker Brier/log-loss differences. New research rows expose every model's original probability/price/decision through the existing private pages.

The [proposed14-day research-only source operation](v6-source-pilot-approval.md) remains pending. It uses existing headless source adapters and scheduler,13 daily quote batches plus daily/final result checks,41 normal credits and9 contingency within a50-additional/cumulative60 ceiling. No live source fetch, model activation, position registration, hosted migration or new credential occurred. The source-only namespace is privately bound through the existing owner's RLS archive anchor; it is not a new Auth identity. Synthetic end-to-end integration and final730 tests/147 local SQL checks/browser/typecheck/lint/build pass, but genuine new future-slate results remain zero until explicit collection approval and successful actual capture/grading.
