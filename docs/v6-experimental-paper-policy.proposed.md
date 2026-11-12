# Proposed experimental paper policy — `nba-experimental-paper-1`

**PROPOSED. Requires Approval B; not activated, signed or saved for the owner.** Approval A deploys schema only. Approval C installs/enables the unattended worker only after its own checks. None implies another.

Purpose: gather honest new prospective PAPER-only results from a reproducible research-grade NBA baseline. Prior sportsbook profitability, thirty prior prospective games or a demonstrated market advantage are **not prerequisites for experimental research**. This does not upgrade the model to a reliable recommendation service, calibrated probabilities, profitable betting or Tier 1.

## Frozen initial model and evidence

- Model `nba-team-elo-only/candidate-1`, method `nba_team_elo_only`; initial rating 1500, K20, home advantage60, season retention0.75, zero form/rest/shrinkage. Definition SHA-256 remains `ee61e69d684fd15862f9fdd0335f0f9359743aa8377911103451909e2d8fb564`.
- Retain independently reproducible raw training/source receipts, immutable history/registry/input hashes and a feature-cutoff policy. The existing 5,082-game dataset SHA-256 remains `31aa630215a5583b90f87f92e6193883a778f6795a9068f2014118685c9283a0`.
- Review chronological evaluation across at least 500 held-out games/two seasons as a proposed reproducibility/research floor. Current retained evidence has 4,774 held-out games over five seasons. Historical publication times are not fully archived; disclose that limitation instead of claiming a reconstructed live backtest.
- Forecast inputs must be observed by the recorded cutoff, cutoff must precede the fixture, forecast must precede registration, and original prices/capture/registration must precede the conservative earliest clock minus sixty seconds. Live inputs cannot use future results/closing prices. Version changes apply only prospectively.
- Explicit owner review of numerical probability methodology, uncertainty, source coverage, historical publication gaps and absent injury/roster evidence. Report hashes and an experimental review bind those attestations; a developer-generated draft does not approve them.

The genuine ten-fixture observational sample has Elo Brier/log loss `0.1868505827/0.5559565291`, versus bookmaker de-vig `0.1739424020/0.5209852336`. Bookmaker probabilities performed better. Ten fixtures/one slate do not establish calibration, independent model agreement or an advantage. The challenger stays experimental and is not the initial candidate.

## Admission stays strict

Use the existing `nba-moneyline-two-pass-1` philosophy: inspect source, exact fixture/market identity and independent pre-event inputs first; assess supported winning likelihood and reasonable price second. Require p≥0.55, estimated EV≥0.02, existing market/model disagreement and sensitivity checks, attributable fresh original Sportsbet two-way NBA full-game moneyline prices, source-issued odds timestamp and supported settlement terms. Positive theoretical EV alone never suffices. The probability contraction is a stress test, not a statistical interval. Unsupported probabilities/missing prices remain rejected or observations.

No thresholds are lowered for paper counts. No top-N, daily count, aggregate hypothetical exposure or available-balance admission cap. Register every distinct genuinely eligible future selection automatically after B **and C** are activated. A$5,000 is one nominal account reference; stake is fixed A$50. No forced entry when nothing qualifies, no real-money execution and no V5 policy changes.

## Separate immutable cohorts

`researchTier=experimental` plus `validation=chronologically_evaluated` identifies experimental entries. `researchTier=strongly_supported` retains the separate higher-evidence gate: prospective coverage, calibration/benchmark/uncertainty review and explicit evidence-based approval. Thirty games alone never qualify as high confidence. No current model is claimed to have passed that stronger gate.

The position freezes its tier with the original forecast; it cannot later be relabelled stronger. Previously unlabelled local V6 positions remain `legacy_unclassified` in tier reporting; V5/demo/history is never brought into V6. `paperResearchCohorts` reports separate P/L, ROI, probability scores and fixture counts without creating another A$5,000 reference. The shared nominal account has deterministic overall equity/exposure. Exact market uniqueness prevents registering the same selection twice across tiers or model reprices; genuinely different markets remain distinct and correlation groups stay labelled.

Original twenty shadow observations are never positions, regardless of their later results. Future experimental entry changes no actual wager, funding, bonus or legacy paper record. Settlements require exact registered identity, independently corroborated final evidence and supported terms; unresolved cases remain open. Grades append revisions and replay cannot double P/L.

## Approval and review artifact

`modelManifestSchema` supports `researchPurpose=experimental` and an `experimentalReview` with report/training/feature-policy hashes, chronological seasons, reproducibility/evaluation review, disclosure and the conclusion `experimental_research_only_no_profitability_or_calibration_claim`. The stronger `readinessReview` remains separate. Both require owner approval time/reference, matching definition/manifest/standing-policy hashes and existing source/kill-switch controls.

Prepare only a local draft, zero HTTP:

```sh
node scripts/prepare-v6-activation-review.mjs --purpose experimental --evaluation .local/v6/team-shadow-reconciliations/204dd518-19e2-4250-ad80-b6218430d838/evaluations/db4c6cb8844803a9f249849f279f7033c7f072e4479a24166497a32253eb1cca.json
```

The draft retains `status=draft`, null approval fields, null accepted review and `teamResultsOnlyAccepted=false`. Proposed review fields are outside the active manifest for owner inspection. No real receipt, approved model row or policy activation has been generated. Approval B must explicitly name this experimental policy, model definition, actual reviewed manifest and current bundle hash. Worker installation and enabling remains Approval C.
