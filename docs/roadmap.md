# EdgeLab development roadmap — 6 November 2026

## Current usable workflow

The existing authenticated workspace and Demo remain separate. Historical review/import, the ledger, paper tracking, notifications, settings, JSON backup and approved Methodology Revision 1 are preserved. Do not recreate the owner's account or repeat archived real-history imports. The eight historical wager claims and historical Maxey remain source evidence with their existing classifications; neither an aggregate checkpoint nor the A$500 funding cap creates funding.

The daily workspace now supports reviewed research intake, separate actual/paper decisions, Watch/Pass journals, a unified result queue, separate settlement JSON, explicit batch approval, replay prevention and analytics/handoff refresh. See [daily operation](daily-workflow.md) and [verification](master-verification.md).

## Optional sports-data stage

Server-only TheSportsDB/API-NBA/API-Basketball adapters, persistent quota state, queues, cache, exact identity review and conservative player-stat grading are implemented. Explicitly reviewed identity journals enable user-triggered result checks; provider observations never automatically settle or place a wager. Current support is sample-specific: recent NBL and historical NBA/NBL statistics were demonstrated; current NBA coverage remains unverified. TheSportsDB has limited fixture coverage and no demonstrated sampled player statistics. Tennis retains source/manual fallback. See [coverage and setup](sports-data.md).

Keep local single-process access disabled unless configured. No polling, free-to-paid upgrade, bookmaker login or API-generated bookmaker price is authorized. No migration is currently needed.

## Next practical step

Use the next genuine daily research session in the existing private account. Generate/copy the prompt, import and review the structured response, and approve one eligible pre-event paper forecast. Check provider status read-only if configured, otherwise use the results prompt/manual evidence path. Hosted positive verification of the new flow needs genuine evidence and explicit UI approval; local synthetic tests do not replace it. Do not relabel synthetic research or invent missing ticket details to pass database restrictions.

Before any financial registration, separately confirm the accepted execution price, stake, placement time, terms and actual result/payout. Existing unresolved claims remain under review. No development task has modified hosted financial data.

## Evaluation and forecasting stage

The paper-evaluation export supplies a reproducible source/result dataset, strict eligibility exclusions, sample sizes, hit rate, calibration, Brier/log loss, original implied-odds benchmarks, grouped model/market/sport/track results and forecast errors. Missing CLV, input features and cutoffs remain null. It does not establish a betting advantage.

Collect an adequate independent pre-event sample before training. Offline manifest checks are foundational: chronological training/validation/freeze/test boundaries, leakage checks, exact dataset identity and minimum independent fixture counts. Parameter fitting, walk-forward experiment execution, validated calibration, joint SGM simulation and an authoritative owner-approved model activation/rollback registry remain unimplemented. No model activates automatically.

Source V3 methodology evidence is staged privately and unapproved. Preserve Revision 1 until a separate owner-reviewed methodology change. Infrastructure changes must not change funding/staking rules.

Later work may include a reviewed backup-restore path and comparable original/closing-price snapshots. Scheduled monitoring, paid providers and deployments require separate approval. Hosted email-confirmation and long-duration refresh behavior still need their documented genuine-user verification where not already established.
