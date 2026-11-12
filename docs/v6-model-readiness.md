# Elo-only baseline review — proposed policy, 12 November 2026

**Preferred candidate: Elo-only. Not activated. No demonstrated sportsbook edge.** This review preserves the saved owner-approved V5 Methodology Revision 1 and the owner-amended uncapped V6 specification. Saved methodology hash `850a575901851e8e8aa3274d2a609fb95df7766adc250614602dd0c6094c521e` was read from the existing private backup, without modifying it. The local V6 master and original 9 November foundation were read; the later unlimited-volume amendment takes precedence over the foundation's older balance/exposure caps. A separate complete verbatim V5.2 document was not found in the repository/Downloads; the existing documented two-pass interpretation and explicit owner requirements remain unchanged rather than claiming unavailable text was read.

## Existing evidence

| Cohort | Independent game units | Elo Brier / log loss | Challenger Brier / log loss | Benchmark |
| --- | ---: | --- | --- | --- |
| Historical chronological holdout | 4,774 | 0.2152337127 / 0.6189191514 | 0.2156775888 / 0.6196628890 | Smoothed win-rate 0.2340920415 / 0.6606445973 |
| Genuine frozen, reconciled observational | 10, one slate | 0.1868505827 / 0.5559565291 | 0.1875740042 / 0.5553625715 | Original de-vig bookmaker 0.1739424020 / 0.5209852336 |

Historical evaluation is chronological and uses team/game outcomes, but archived feature publication times are unavailable. It is not a reconstructed live execution backtest. Existing 250-replicate date-cluster bootstrap challenger-minus-Elo Brier 95% interval is `[-0.0002728252, 0.0013240094]`; same-team dependence remains a limitation. The challenger does not justify replacing the simpler baseline. Historical bookmaker prices were not supplied, so no historical price edge/ROI is invented.

The prospective sample has ten genuinely pre-event frozen probabilities/quotes, now corroborated through [versioned event reconciliation](v6-event-reconciliation.md). Elo has slightly better Brier, challenger slightly better log loss; bookmaker probabilities beat both here. They share ratings/data and are not independent model agreement. Ten fixtures on one date cannot establish stable calibration, meaningful slate-cluster uncertainty or model superiority. Existing reliability bins have only one to three fixtures each; they are retained rather than used to claim calibration. There are no registered-position results or CLV claims.

Injury, rotation, current roster and alternative-market evidence are unavailable. Their absence is a model limitation requiring explicit acceptance, not a positive evidence check. Elo can be a reproducible, statistically usable **limited baseline**, distinct from a model proven to beat Sportsbet or a genuinely independent ensemble. Current evidence does not approve even that limited production use automatically.

## Proposed readiness policy `nba-baseline-readiness-1`

The earlier thirty-fixture requirement is retained as a **minimum engineering review floor**, not a significance test, proof of reliability, position-volume cap or permission to promote a model automatically. Additional independent slates and actual review are now mandatory:

- Frozen `nba-team-elo-only/candidate-1` formula/definition/data/evaluation hashes and reproducible inputs. No tuning on the reported evaluation outcomes; changes create a new prospective version.
- At least 500 chronological held-out games spanning at least two seasons, with periods, leakage/publication limitations, per-season scores and simple benchmarks disclosed.
- At least thirty verified prospective fixtures across at least five independent research slates, counting each fixture once regardless of sides/markets. An unresolved identity or quote is excluded. Thirty/five are proposed minimum coverage guards; adequate sample size depends on the observed errors and uncertainty, and may need to be much larger.
- A retained report with Brier, log loss, reliability-bin counts/calibration, paired original bookmaker comparisons and uncertainty at fixture and slate levels. Report sparse bins and unavailable intervals explicitly; do not report a degenerate one-slate bootstrap as confidence. Separate predeclared all-screened forecasts from selection-conditioned performance and hypothetical ROI.
- An explicit owner review of that report, historical publication gaps, injury/roster limitations, intended NBA team-market scope and model-drift monitoring. The manifest binds the report hash, review conclusion and limited-baseline scope. Boolean fields are owner attestations linked to a report, not independent statistical proof.

`controlled-activation.ts` enforces the manifest, versioned readiness review and exact standing-policy bundle. Proposed SQL reproduces the minimum count/season/slate/review/formula safeguards. Draft manifests have `readinessReview=null` and cannot activate. Sample count alone can no longer pass the activation gate. Current evidence supplies ten fixtures/one slate, so it remains blocked. No real approval receipt was generated.

## Candidate assessment stays unchanged

The existing V5.2-style two-pass rules remain `nba-moneyline-two-pass-1`: exact attributable source/fixture/market/evidence first, then credible winning likelihood at a reasonable original price. Minimum p=0.55, EV=0.02, maximum market disagreement 0.15 and the existing sensitivity/disagreement rules are not relaxed. The 20% probability contraction is a stress test, not a calibrated uncertainty interval. No top-N, position count, hypothetical exposure or available-balance gate is added. Unsupported probabilities/independent-agreement claims remain excluded. Exploratory entries remain disabled unless separately designed and approved.

Next evidence collection can use the separate expiring **read-only shadow** receipt without approving a model or positions. It shares the existing quota journal and cannot arm paper. After enough genuinely pre-event evidence is evaluated, review a new exact manifest and standing-policy hash. Do not reuse old excluded shadows as positions or lower thresholds to obtain a positive registration count.
