# Development roadmap

## Completed foundation: hosted bookkeeping and access checks

The two approved migrations are deployed. The hosted two-account report passed 17/17 groups: normal password JWTs, manual ledger/funding/settings persistence, settlement/audits, cross-account bet protection, anonymous/deletion restrictions, stale revisions, SDK session restoration and account A's browser sign-in/F5/demo separation/logout. See [verification](deployment-verification.md) for evidence and precise limits. Retain the labelled synthetic accounts/records; do not replay the write harness against them.

## Completed locally: controlled historical intake and lifecycle

CSV/JSON/manual source intake now has bounded parsing, nullable missing facts, validation, audited manual resolution, exact/probable duplicate review, explicit archive confirmation and immutable source provenance. Separate financial confirmation registers only complete, consistent actual records; paper and funding never silently mix. Imported paper results/legs, hypothetical performance, notification idempotency/read/dismiss and paper registration are implemented. The new schema and isolated repositories are prepared locally. No real history was imported.

Installed-SDK tests cover expired refresh, invalid/revoked sessions, signup/confirmation state, callback failures, logout and authenticated saves with mocked transport. The existing two-user hosted checkpoint remains preserved. Local PostgreSQL and browser checks are distinct from hosted verification; see [verification](verification.md).

## Current checkpoint: deployed history and manual research continuation

The historical migration was explicitly approved/deployed and its exact hosted catalog passed. The secure two-user hosted read/negative report passed **11/11** checks without changing historical snapshots. Anonymous access was rejected. Positive hosted history/paper/notification round trips remain unverified; preserve synthetic rejection instead of relabelling fixtures to force a pass.

The zero-cost Research Handoff is implemented: owner-attested context journals, current prompt generation/copy, structured response contract and validation, manual candidate review, atomic immutable paper/alert registration, separate actual confirmation, results and analytics. User-selected conversation JSON supports manual multi-record mapping with original references; no real export/history has been supplied or imported. See [research-continuity.md](research-continuity.md).

## Recommended next stage: source review and genuine private pilot

Obtain the original Days 1–5 source from the user and manually map a tiny sample. Review missing facts, day membership, duplicate identities and the unverified checkpoint reconciliation before explicit import approval. Source totals never justify inventing stakes, a funding transaction or a bookmaker balance. Confirm the full original rule set and completed day separately in the context journal.

After separately authorized genuine-source registration, verify a small positive hosted paper/notification/result lifecycle and non-empty two-account isolation using ordinary users. Keep existing records/accounts; use no service-role proof or synthetic relabelling. Complete an authorized email confirmation callback and real long-duration session checks if needed. No additional migrations are currently required for the manual handoff.

Add a reviewed complete-backup restore path and explicit historical day scoping before larger migrations. Add source-supported adjusted parlay settlement prices separately from immutable original odds before partial-void wins can enter financial totals. Build a durable provider quota ledger only before any future exposed The Odds API endpoint; the readiness adapter remains disabled and untested against live prices.

## Strengthen the local research workflow

Add interaction tests for the manual confirmation form, parlay settlement, paper snapshots, notification read/dismiss flows and workspace switching. Maintain the existing local PostgreSQL, hosted catalog and secure two-user harnesses, keeping account-independent tests fast. Validate Melbourne daylight-saving boundary input and recorded UTC ordering. Keep account-independent unit tests fast.

Improve research-run idempotency and record run failure details, cancellation and partial provider errors. Add explicit source freshness rules and reproducible model manifests before accepting non-synthetic research. Add per-entity repositories and pagination when dataset size warrants them. Add opt-in reviewed backup/import tools with strict mode and provenance checks rather than copying demo history to production.

## Introduce documented data sources

Research genuinely free, permitted data sources with clear coverage and licensing for NBA, NBL, ATP and WTA. Verify source terms, update frequency, timestamps and availability before implementing a provider. Integrate one sport and one market first, with recorded raw snapshots, rate limits, retry policy and visible stale/missing-data states. Do not introduce paid APIs or billing dependencies without a separate explicit decision.

The Odds API adapter is currently a placeholder, not a commitment that a particular free quota meets the app's needs. Do not scrape bookmaker sites or connect bookmaker accounts.

## Validate numerical models separately

Implement a deterministic, explainable numerical baseline and retain training/evaluation splits, source versions and forecast timestamps. Register predictions before outcomes and evaluate out of sample with Brier score, calibration and adequate samples. Separate the evidence for forecast quality from illustrative EV arithmetic. Never infer a statistical edge from synthetic fixtures or a small hit rate.

An optional future AI integration can summarize documented research and cite its sources. It must not supply numerical model probabilities or alter the registered forecast. No OpenAI API or other paid service is required for the MVP.

## Scheduling and monitoring later

Only after verified data ingestion and persistence, add an idempotent scheduler, background run status, source freshness checks, duplicate alert suppression and failure observability. Select infrastructure compatible with an explicitly agreed cost budget. A manual Run Daily Research button does not imply unattended daily execution.

Implement and test a real push subscription/service worker only if background notifications are wanted. Until then, describe browser alerts as open-tab notifications. Automatic wager execution, bookmaker logins, real-money transfers, public subscriptions and social features remain outside EdgeLab's scope.
