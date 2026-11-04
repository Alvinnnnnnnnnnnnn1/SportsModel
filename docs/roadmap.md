# Development roadmap

## Completed foundation: hosted bookkeeping and access checks

The two approved migrations are deployed. The hosted two-account report passed 17/17 groups: normal password JWTs, manual ledger/funding/settings persistence, settlement/audits, cross-account bet protection, anonymous/deletion restrictions, stale revisions, SDK session restoration and account A's browser sign-in/F5/demo separation/logout. See [verification](deployment-verification.md) for evidence and precise limits. Retain the labelled synthetic accounts/records; do not replay the write harness against them.

## Completed locally: controlled historical intake and lifecycle

CSV/JSON/manual source intake now has bounded parsing, nullable missing facts, validation, audited manual resolution, exact/probable duplicate review, explicit archive confirmation and immutable source provenance. Separate financial confirmation registers only complete, consistent actual records; paper and funding never silently mix. Imported paper results/legs, hypothetical performance, notification idempotency/read/dismiss and paper registration are implemented. The new schema and isolated repositories are prepared locally. No real history was imported.

Installed-SDK tests cover expired refresh, invalid/revoked sessions, signup/confirmation state, callback failures, logout and authenticated saves with mocked transport. The existing two-user hosted checkpoint remains preserved. Local PostgreSQL and browser checks are distinct from hosted verification; see [verification](verification.md).

## Next stage: approve and verify hosted historical storage

Review the exact prepared `202611040001_historical_import.sql` migration, its hash and local database evidence; inspect remote history and dry-run, then obtain explicit approval before deployment. It creates six isolated historical tables and does not modify existing records or policies. Until approved, the private history UI reports the missing migration while Demo works fully.

After approved deployment, verify the new hosted catalog and non-empty historical/paper/notification access with two ordinary user contexts. Prepare a dedicated, reviewed test path that respects private synthetic rejection; do not relabel test fixtures, reuse the old empty-account harness on populated accounts, delete existing records or bypass RLS with service-role credentials. The local embedded tests establish SQL behavior, not hosted Auth/gateway behavior.

Complete one authorized real signup/email-confirmation/callback flow without unnecessary emails. Add hosted form-level entry/edit/settlement coverage including parlay, bonus, loss and void cases, and long-duration session refresh. Keep all new authorized test records clearly labelled and retain them for review.

After these checks, review a tiny user-approved mapped historical sample before any real import. Resolve missing facts and financial contradictions explicitly. Add source-supported adjusted parlay settlement prices separately from frozen original odds before handling partial-void wins. Add a reviewed archive export/backup path before growing history substantially.

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
