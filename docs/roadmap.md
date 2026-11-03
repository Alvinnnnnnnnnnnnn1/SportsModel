# Development roadmap

## Next: verify private persistence

Configure a free Supabase test project, apply the migration and test email/password sign-in with two accounts. Confirm every table/RPC denies cross-user access, unauthenticated access fails, direct bet edits produce audit history, registered forecasts cannot be changed and stale browser revisions are rejected. Exercise sign-out, expired sessions and failure recovery. Keep synthetic fixtures in Demo mode and use controlled manual test records in the private project.

## Strengthen the local research workflow

Add interaction tests for the manual confirmation form, parlay settlement, paper snapshots, notification read/dismiss flows and workspace switching. Add a local Supabase integration test harness when suitable tooling is available. Validate Melbourne daylight-saving boundary input and recorded UTC ordering. Keep account-independent unit tests fast.

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
