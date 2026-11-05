# Sports Betting Experiment methodology

Document: sports-betting-experiment · schema 1 · revision 1

Status: PROPOSED — not approved or saved.
Full original methodology: not available; this document is a reconstructed proposal.

Scope and operating boundaries
- Research NBA and Australian NBL basketball, and ATP and WTA tennis. Sportsbet is the primary bookmaker research context; this does not establish available prices, market coverage or a verified account balance.
- Preserve the lifetime A$500 funding cap, with no reload beyond that cap. Generally use A$5 exploratory stakes; this is the existing usual stake, not a fabricated per-entry restriction or deposit.
- Use Track A — High Probability (likely outcomes without equating probability with positive EV), Track B — Potential Value (attributable prices versus independent forecasts, preserving disagreements), and Track C — Alternative Markets (props, spreads, handicaps, totals, alternate thresholds, singles and same-game multis).
- Preserve original strategy classifications, including mixed Track A/B labels. If the application schema permits only one track, retain the original mixed label separately in immutable source/provenance and flag classification mapping for review; never silently change it to a single track.
- Do not increase stakes to recover losses. Do not force daily wagering or a paper quota. NO BET and source-backed passes are valid research outcomes.

Evidence and forecasting
- High probability alone does not imply positive expected value. Use attributable original decimal odds, exact market identities and source timestamps. Never invent available bookmaker odds or missing player statistics.
- Record the bookmaker-implied break-even probability as 1 / original decimal odds for a standard win/loss market. Where appropriate, compare with de-vig market probabilities using a complete set of comparable, mutually exclusive and exhaustive outcome prices; document the method, quote timing and assumptions. Do not call a raw implied probability a fair probability or invent missing prices to remove the margin.
- Numerical forecasts require independent, attributable forecasting methods: documented deterministic calculations or external forecasts with original source, method, model/version and time. Unsupported LLM-generated probabilities are not independent model forecasts; keep missing estimates null.
- Calculate expected value only when both the original odds and probability estimate have defensible provenance and the calculation matches the payout and settlement terms. Otherwise keep estimated EV null and flag the missing evidence for review.
- Record uncertainty, assumptions, sample limitations and model disagreements. A source link or owner review is provenance, not independent verification.

Research methods and model validation
- Possible NBA/NBL research methods include team ratings, player minutes and usage, injury and rotation effects, game pace and context, and player-statistical distributions.
- Possible ATP/WTA research methods include surface-adjusted Elo, serve and return performance, match conditions and rest, and model disagreement. These are approaches to investigate, not claims that any of these models are already implemented or validated in EdgeLab.
- Validate models with time-ordered out-of-sample testing, using only information available at the forecast time. Track model/version, data provenance, evaluation periods, sample size and uncertainty; do not tune a model on its reported evaluation outcomes.
- Compare forecasting performance against bookmaker-based baselines, distinguishing raw implied probabilities from de-vig baselines where available. Report Brier score, log loss and calibration when valid probabilities and outcomes exist, with sample-size and uncertainty reporting. Do not fabricate missing forecasts or claim an advantage from insufficient evidence.
- Keep hit rate, probability calibration and profitability separate: a high hit rate does not establish calibrated probabilities or positive ROI. Use attributable original prices, cash/bonus payout terms and eligible samples for the corresponding evaluation.

Paper research integrity
- Preserve all pre-registered research hypotheses. Retain both successful and unsuccessful candidates, including rejected cash candidates, passed candidates and NO BET decisions, with their original rationale and source evidence. Assess paper performance using original recorded odds; comparison quotes never overwrite original forecasts.
- Pre-register eligible paper forecasts before outcomes. If original timing or pre-event registration cannot be established, retain historical proposals in the review archive; never retrospectively promote a proposal into a qualifying forecast. Keep original predictions, odds, timestamps and provenance immutable. Record event dates separately from research creation, prediction, quote and settlement timestamps. Unknown original facts remain null.
- Record a hypothetical A$5 stake where applicable to a newly pre-registered paper position, together with individual selection and parlay-leg outcomes. Preserve any explicitly sourced historical stake; leave missing historical stakes null rather than applying the usual stake retrospectively. Hypothetical paper P/L remains separate from actual cash P/L.

Records, evaluation and review
- Keep cash wagers, bonus bets and cash winnings, paper predictions, funding transactions, payouts and hypothetical returns separate. Paper results never affect actual bankroll or financial ROI. A funding cap or modelled allocation is not a deposit or verified bookmaker balance.
- Preserve exact event/market/selection/threshold identities and every individual parlay leg, including original leg odds where known and separately recorded final statistics/outcomes. Never infer missing legs, prices or timestamps from a summary.
- Track closing line value (CLV), calibration, Brier scores and ROI when the necessary attributable prices, timestamps, probabilities and outcomes are present. Show missing data or insufficient samples; do not infer a statistical advantage. CLV is an evaluation objective, not a claim that a live closing-price feed exists.
- CLV comparisons require identical markets, selections, thresholds and settlement terms for the same event and participant. Preserve the original and closing quotes and their source timestamps separately; flag incompatible identities or terms rather than calculating a misleading comparison.
- Do not assume independence between same-game multi legs. Record the actual quoted SGM price separately from any theoretical combined price, identifying its method and correlation assumptions; a product of leg prices is not evidence of an available SGM quote or a valid joint probability.
- Distinguish verified database facts, owner-attested source records, unverified historical archives, owner-reported checkpoints, unresolved historical predictions and unregistered proposals. Aggregate checkpoints never create individual bets or predictions.
- Preserve actual/paper source relationships. A former paper proposal linked to an owner-confirmed actual placement does not establish an independent paper position without distinct registration evidence.

Manual control and cost
- Register an actual wager only after the owner separately confirms a bet placed manually outside EdgeLab. Research proposals and paper approvals never place or automatically register a real wager.
- Never access bookmaker accounts or credentials, scrape bookmakers, or execute wagers. No automatic bookmaker account access or wagering is permitted.
- The current EdgeLab MVP operates at A$0 additional cost. Paid APIs, infrastructure or subscriptions require separate explicit owner approval. Any future infrastructure upgrades must not automatically change the betting experiment's funding cap, staking rules or methodology.
- The copy/paste research handoff requires no paid API, OpenAI API key, paid subscription or background service. This proposed document does not approve any spending.

Source completeness
- This draft reconstructs the explicit requirements supplied by the owner. It does not claim to contain the full original conversation methodology. Preserve any subsequently supplied original text verbatim and review proposed revisions before approval; do not silently replace original rules.

## Source references

- Owner-supplied EdgeLab research continuity requirements, 4 November 2026; full original conversation methodology not supplied
- Owner-supplied Day 6 continuation and methodology requirements, 5 November 2026; reconstructed policy, not the exact original transcript
- Owner-requested Revision 1 refinements, 5 November 2026: market benchmarking, model validation, paper integrity, CLV/SGM correlation, mixed strategy labels and explicit future cost approval; formal methodology approval still pending

Approval is separate from confirming a completed research day, verifying historical claims, importing records or registering an actual wager.
