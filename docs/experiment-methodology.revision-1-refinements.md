# Revision 1 methodology refinement review

Status: proposed only. Refining this unapproved draft does not approve it, append a journal entry or change any experiment records.

The full revised text is in [experiment-methodology.proposed.md](experiment-methodology.proposed.md); its matching machine-readable draft is [experiment-methodology.proposed.json](experiment-methodology.proposed.json).

## Local verification — 5 November 2026

`npm test`: 450 passed; two optional embedded-PostgreSQL tests skipped because their runtime was not enabled. Existing tests verified document synchronization, explicit approval, content hashes, original-text completeness boundaries and append-only context behavior. `npm run typecheck`, `npm run lint`, `npm run build` and `git diff --check` passed. No hosted or browser checks were rerun for this policy-text refinement; no hosted writes, approval actions or migrations were performed.

## Approval-system compatibility

- Document schema remains version 1, document ID `sports-betting-experiment`, revision 1, status `proposed`.
- `originalText` and `supersedesHash` remain null. The complete original methodology is still unavailable; approving the reconstructed policy will not establish original-rule completeness.
- Only the proposed policy text and its source references changed. No storage schema, approval logic, immutable forecast rule or database migration changed.
- The refined standalone content SHA-256 is `adac7521194dc3136a3b6b19f7d6ccd07d05c291aa61a49b59132272613f7700`. The app adds its proposed-revision title and your journal source reference, so its displayed hash can differ. Review the exact UI preview that you approve.
- Model approaches, benchmarking and evaluation requirements are policy objectives, not claims that these methods or metrics have been implemented or validated. No future spending is approved by this proposal.

## Approve and save through EdgeLab

1. Refresh your existing signed-in EdgeLab tab. Open Research → Experiment context → Versioned methodology and research days.
2. Read Proposed methodology revision 1 and its source references. The new text should include Research methods and model validation, Paper research integrity and the revised cost policy. You can use Download proposed methodology to review the exact UI draft.
3. Enter Journal source reference, for example `Owner review of refined Revision 1 methodology, 5 November 2026`. Enter this before checking approval because editing it clears the content-approval checkbox.
4. Leave day numbers, completed-day evidence and dates blank for methodology-only approval. Leave Original methodology text blank unless you have the actual source. Leave the original-completeness attestation unchecked.
5. Check Include this methodology revision in the proposed journal entry, then check the statement beginning I reviewed the full proposed document and sources (Approve proposed methodology content).
6. Click Review versioned context. Inspect the full proposed JSON, including the policy, sources and hash. This review has not saved anything.
7. Only if you approve that exact preview, click Confirm context save. The content-approval checkbox already reviewed the policy; this final button is the explicit persistence authorization. Cancel review returns without saving.

The final action creates the owner-approved immutable context/audit entry. It does not register a wager, paper position, deposit, historical result or completed research day. If the UI shows an already saved methodology or revision 2 or higher, preserve that saved version and review a separate proposed revision; do not replace approved text silently.

## Exact changes from the preceding Revision 1 proposal

```diff
--- Revision 1 before requested refinements
+++ Revision 1 refined proposal
@@ -9,28 +9,42 @@
 - Research NBA and Australian NBL basketball, and ATP and WTA tennis. Sportsbet is the primary bookmaker research context; this does not establish available prices, market coverage or a verified account balance.
 - Preserve the lifetime A$500 funding cap, with no reload beyond that cap. Generally use A$5 exploratory stakes; this is the existing usual stake, not a fabricated per-entry restriction or deposit.
 - Use Track A — High Probability (likely outcomes without equating probability with positive EV), Track B — Potential Value (attributable prices versus independent forecasts, preserving disagreements), and Track C — Alternative Markets (props, spreads, handicaps, totals, alternate thresholds, singles and same-game multis).
+- Preserve original strategy classifications, including mixed Track A/B labels. If the application schema permits only one track, retain the original mixed label separately in immutable source/provenance and flag classification mapping for review; never silently change it to a single track.
 - Do not increase stakes to recover losses. Do not force daily wagering or a paper quota. NO BET and source-backed passes are valid research outcomes.
 
 Evidence and forecasting
 - High probability alone does not imply positive expected value. Use attributable original decimal odds, exact market identities and source timestamps. Never invent available bookmaker odds or missing player statistics.
+- Record the bookmaker-implied break-even probability as 1 / original decimal odds for a standard win/loss market. Where appropriate, compare with de-vig market probabilities using a complete set of comparable, mutually exclusive and exhaustive outcome prices; document the method, quote timing and assumptions. Do not call a raw implied probability a fair probability or invent missing prices to remove the margin.
 - Numerical forecasts require independent, attributable forecasting methods: documented deterministic calculations or external forecasts with original source, method, model/version and time. Unsupported LLM-generated probabilities are not independent model forecasts; keep missing estimates null.
+- Calculate expected value only when both the original odds and probability estimate have defensible provenance and the calculation matches the payout and settlement terms. Otherwise keep estimated EV null and flag the missing evidence for review.
 - Record uncertainty, assumptions, sample limitations and model disagreements. A source link or owner review is provenance, not independent verification.
-- Pre-register eligible paper forecasts before outcomes. If original timing or pre-event registration cannot be established, retain historical proposal evidence rather than invent qualifying registration. Keep original predictions, odds and provenance immutable. Record event dates separately from research creation, prediction, quote and settlement timestamps. Unknown original facts remain null.
+
+Research methods and model validation
+- Possible NBA/NBL research methods include team ratings, player minutes and usage, injury and rotation effects, game pace and context, and player-statistical distributions.
+- Possible ATP/WTA research methods include surface-adjusted Elo, serve and return performance, match conditions and rest, and model disagreement. These are approaches to investigate, not claims that any of these models are already implemented or validated in EdgeLab.
+- Validate models with time-ordered out-of-sample testing, using only information available at the forecast time. Track model/version, data provenance, evaluation periods, sample size and uncertainty; do not tune a model on its reported evaluation outcomes.
+- Compare forecasting performance against bookmaker-based baselines, distinguishing raw implied probabilities from de-vig baselines where available. Report Brier score, log loss and calibration when valid probabilities and outcomes exist, with sample-size and uncertainty reporting. Do not fabricate missing forecasts or claim an advantage from insufficient evidence.
+- Keep hit rate, probability calibration and profitability separate: a high hit rate does not establish calibrated probabilities or positive ROI. Use attributable original prices, cash/bonus payout terms and eligible samples for the corresponding evaluation.
+
+Paper research integrity
+- Preserve all pre-registered research hypotheses. Retain both successful and unsuccessful candidates, including rejected cash candidates, passed candidates and NO BET decisions, with their original rationale and source evidence. Assess paper performance using original recorded odds; comparison quotes never overwrite original forecasts.
+- Pre-register eligible paper forecasts before outcomes. If original timing or pre-event registration cannot be established, retain historical proposals in the review archive; never retrospectively promote a proposal into a qualifying forecast. Keep original predictions, odds, timestamps and provenance immutable. Record event dates separately from research creation, prediction, quote and settlement timestamps. Unknown original facts remain null.
+- Record a hypothetical A$5 stake where applicable to a newly pre-registered paper position, together with individual selection and parlay-leg outcomes. Preserve any explicitly sourced historical stake; leave missing historical stakes null rather than applying the usual stake retrospectively. Hypothetical paper P/L remains separate from actual cash P/L.
 
 Records, evaluation and review
 - Keep cash wagers, bonus bets and cash winnings, paper predictions, funding transactions, payouts and hypothetical returns separate. Paper results never affect actual bankroll or financial ROI. A funding cap or modelled allocation is not a deposit or verified bookmaker balance.
 - Preserve exact event/market/selection/threshold identities and every individual parlay leg, including original leg odds where known and separately recorded final statistics/outcomes. Never infer missing legs, prices or timestamps from a summary.
 - Track closing line value (CLV), calibration, Brier scores and ROI when the necessary attributable prices, timestamps, probabilities and outcomes are present. Show missing data or insufficient samples; do not infer a statistical advantage. CLV is an evaluation objective, not a claim that a live closing-price feed exists.
+- CLV comparisons require identical markets, selections, thresholds and settlement terms for the same event and participant. Preserve the original and closing quotes and their source timestamps separately; flag incompatible identities or terms rather than calculating a misleading comparison.
+- Do not assume independence between same-game multi legs. Record the actual quoted SGM price separately from any theoretical combined price, identifying its method and correlation assumptions; a product of leg prices is not evidence of an available SGM quote or a valid joint probability.
 - Distinguish verified database facts, owner-attested source records, unverified historical archives, owner-reported checkpoints, unresolved historical predictions and unregistered proposals. Aggregate checkpoints never create individual bets or predictions.
-
-- Retain both successful and unsuccessful candidates, rejected cash candidates and source-backed passes. Assess paper performance using original recorded odds; comparison quotes never overwrite original forecasts.
-
 - Preserve actual/paper source relationships. A former paper proposal linked to an owner-confirmed actual placement does not establish an independent paper position without distinct registration evidence.
 
 Manual control and cost
 - Register an actual wager only after the owner separately confirms a bet placed manually outside EdgeLab. Research proposals and paper approvals never place or automatically register a real wager.
 - Never access bookmaker accounts or credentials, scrape bookmakers, or execute wagers. No automatic bookmaker account access or wagering is permitted.
-- Keep additional development and operating costs at A$0. This methodology and copy/paste research handoff require no paid API, OpenAI API key, paid subscription or background service.
+- The current EdgeLab MVP operates at A$0 additional cost. Paid APIs, infrastructure or subscriptions require separate explicit owner approval. Any future infrastructure upgrades must not automatically change the betting experiment's funding cap, staking rules or methodology.
+- The copy/paste research handoff requires no paid API, OpenAI API key, paid subscription or background service. This proposed document does not approve any spending.
 
 Source completeness
 - This draft reconstructs the explicit requirements supplied by the owner. It does not claim to contain the full original conversation methodology. Preserve any subsequently supplied original text verbatim and review proposed revisions before approval; do not silently replace original rules.
@@ -39,5 +53,6 @@
 
 - Owner-supplied EdgeLab research continuity requirements, 4 November 2026; full original conversation methodology not supplied
 - Owner-supplied Day 6 continuation and methodology requirements, 5 November 2026; reconstructed policy, not the exact original transcript
+- Owner-requested Revision 1 refinements, 5 November 2026: market benchmarking, model validation, paper integrity, CLV/SGM correlation, mixed strategy labels and explicit future cost approval; formal methodology approval still pending
 
 Approval is separate from confirming a completed research day, verifying historical claims, importing records or registering an actual wager.
```
