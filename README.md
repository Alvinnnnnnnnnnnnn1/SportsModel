> **Current13 November status:** separately approved source ACL03 deployed; hosted ACL/catalog acceptance passed. Source storage is empty/unprovisioned and cloud/PAPER remain disabled. Positive source persistence/two-user acceptance still requires separate approval. [Actual correction evidence](docs/v6-source-acl-deployment.md). Earlier blocked source statements are historical.



# EdgeLab

A private, zero-cost sports research and record-keeping MVP built with Next.js App Router, React, TypeScript, Tailwind CSS, shadcn/ui components, Recharts, Zod and optional Supabase Auth/PostgreSQL.

**All initial sports, teams, players, markets, odds, forecasts, alerts and results are synthetic.** They demonstrate the product and are not real opportunities or evidence of a betting advantage. EdgeLab never places wagers, connects bookmaker accounts, accesses bookmaker credentials, scrapes bookmakers or transfers money.

## Current V6 implementation checkpoint

Latest: [final Supabase security preflight](docs/v6-security-preflight.md) verifies the original reviewed SQL and prepares a hardened eleven-table candidate with owner-issued, hashed/revocable worker credentials. Existing private Settings has an idle, manual enrollment/rotation/revocation panel for after schema approval. The unattended worker needs no project signing/service key or daily browser login. [Experimental research-grade paper](docs/v6-experimental-paper-policy.proposed.md) is now separate from stronger-evidence claims, with unchanged source/price/cutoff rules. **All A/B/C approvals remain pending; no hosted schema, credential, model, schedule or position was created.** Review [the exact decision package](docs/v6-deployment-approval-package.md). Original observations, V5 account/history and A$500/A$5 methodology remain unchanged. Older checkpoints follow.

Latest: [all ten genuine NBA fixture outcomes are reconciled](docs/v6-event-reconciliation.md) under a versioned identity policy, retaining every original clock and forecast plus the original strict journal. Twenty observations remain outside paper P/L. The existing scheduled worker now has a tested synthetic registration-to-settlement lifecycle, separate expiring source-only approvals, stricter model review and an optional scoped atomic Supabase repository. **Production is not activated:** model evidence, restricted token provisioning/renewal and hosted acceptance remain open. Review [the exact SQL/auth/installation approval package](docs/v6-deployment-approval-package.md). No new sports call, hosted migration, schedule, paid service or legacy change occurred. Earlier checkpoint paragraphs below retain their original status dates.

The [12 November shadow result check](docs/v6-shadow-results-20261112.md) retrieved all ten actual final scores with BDL agreement. The unchanged clock rule verifies one fixture/two selections; nine fixtures/eighteen selections remain unresolved after provider start-field changes. Strict and provisional Elo/challenger/Brier/log-loss/calibration evaluations are separate; no retrospective paper P/L. [Controlled readiness](docs/v6-controlled-readiness.md) now includes a distinct Elo baseline candidate, hash-bound approval gates and a durable headless scheduler calling the registered worker. It is disabled, uninstalled and blocked by insufficient verified prospective evidence. No hosted migration or activation occurred; existing private history remains unchanged. Older milestones below retain their original checkpoint dates.

The [NBA team-moneyline pilot](docs/v6-team-moneyline-pilot.md) now has actual current-season BALLDONTLIE game data, 5,082 compatible training games and 20 genuine pre-event Sportsbet observations/experimental forecasts. All remain excluded by quality/activation gates; no position or settlement was invented. Elo-only outperformed the challenger overall. Source results for 19 previous games were independently corroborated; the frozen future slate still needs post-event verification. Production automation and hosted SQL remain disabled. The guide includes safe offline replay and the explicit result follow-up command; no paid API or bookmaker account is needed. Earlier player-prop checkpoints below remain preserved.

The completed personal-account reconciliation is preserved. Private **Review & Apply Daily Update** now supports a research-only save through the existing authenticated historical archive, followed by read-back. It preserves original source claims and creates no financial or paper position implicitly. Results still use their separate review workflow. See [Daily Cycle instructions](docs/daily-workflow.md).

V6 now has an isolated paper domain, exact source matcher, experimental numerical baselines, deterministic uncapped accounting and a disabled headless worker with restart/replay protection. Its A$5,000 reference and A$50 hypothetical entries are separate from legacy finances. A bounded permitted-provider pilot observed Sportsbet prices using four free credits. **Status: LOCAL_TEST_ONLY**, with no activated model, scheduled operation, prospective registration or automatic live grading. The separate SQL proposal has not been deployed. See [implementation evidence and next task](docs/v6-implementation-status.md), [source coverage](docs/v6-provider-coverage.md) and [paper engine](docs/v6-paper-engine.md).

The later [real-data continuation](docs/v6-prospective-pilot.md) used one further free odds credit (five cumulative), collected 52 genuine historical player rows and screened ten real Sportsbet outcomes. Current NBA access is denied by the configured free plan, player identity joins remain unresolved and the experimental baseline underperformed its benchmark. **No eligible registration or genuine prospective lifecycle passed.** Current probability/EV stay null. Deployment/activation remain disabled; [SQL diff and rollback/worker readiness](docs/v6-deployment-readiness.md) are documented.

The [free-source follow-up](docs/v6-free-nba-audit.md) also verifies API-Basketball's correct NBA season and its actual Free-plan denial. The incremental historical dataset now contains 191 player-games across three seasons for one player; its challenger still loses to the benchmark. A separate immutable observation archive preserves screened markets without paper P/L. ESPN/NBA direct collection remains blocked by source-use permissions. No new odds credit, hosted change or prospective registration occurred. Reproduce the retained-data audit without network requests with `node scripts/analyse-v6-coverage.mjs`.

## Use your existing experiment workspace

Approval workflows now use automatic file validation, compact eligibility summaries, batch selection, one clear final archive/research approval and explicit financial review. Existing saved history stays in place; repeat uploads show already-saved records. See [the three approval walkthroughs](docs/approval-workflows.md) for historical import, ChatGPT paper research, and manual actual-wager registration/settlement.

Your existing personal account can be used directly; no account recreation or credentials in chat are needed. See [the operating guide](docs/operating-edgelab.md) for the read-only personal access check, recovery review, proposed hosted persistence pilot and daily copy/paste research workflow. Historical source review and imports remain separate from actual financial registration. The A$500 cap is never assumed to be a deposit.

Historical Import also accepts a reviewed owner-wager-claims envelope. Overview and Betting Ledger show its labelled provisional history separately from registered financial totals; original reported prices never substitute for missing accepted execution odds. Files remain local until explicit archive approval, and financial registration requires its own separate confirmation. See [historical wager claims](docs/historical-wager-claims.md).

The owner-selected reconciliation Markdown can now be wrapped in a durable `edgelab.reconciliation-source` v1 JSON file and reviewed through the same Historical Import wizard. Exact existing UUID/candidate links are excluded, unknown execution facts stay null, and proposals remain outside qualifying forecasting metrics. See [private-account activation](docs/account-activation.md) for preparation, approval, resume and read-back verification. Preparing a file is not a hosted import.

## Versioned research memory

The handoff now separates approved methodology, owner reports, source-confirmed days, provisional placement claims, local historical evidence and unregistered proposals. It generates a compact brief using the existing strict response contract. See [research memory and Day 6 review](docs/research-memory.md). The existing approved Methodology Revision 1 is preserved; a [local methodology proposal](docs/experiment-methodology.proposed.md) never replaces saved approval. Owner/source checkpoints remain separately labelled rather than upgraded into verified forecasts or funding.

## Run locally

Use Node.js 22 or newer and npm. No account, environment variables, API keys, billing account or hosting is required for Demo mode.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). If the port is occupied, Next.js prints the selected port. Dependencies are pinned by `package-lock.json`; subsequent clean installations can use `npm ci`.

The first Demo visit creates a browser-local synthetic workspace with 30 ledger entries, 12 paper predictions, fictional research candidates, alerts and a $250 demonstration funding record. Nothing is imported from ChatGPT. Demo edits persist under the `edgelab:demo:v1` local-storage key in that browser. Clearing that key starts a fresh demonstration. Settings can export the existing workspace as a local JSON snapshot; restoring that snapshot is not implemented. Historical research intake uses a separate reviewed format and storage key (`edgelab:history:demo:v1`), starting empty.

## Try the MVP

- **Overview:** review available bankroll, funding, realised P/L, cash ROI, bet outcomes, papers, performance charts and recent simulated alerts.
- **Betting Ledger:** switch confirmed/pending/settled views; search/filter; manually record a single or parlay with exact market and threshold, decimal price, cash/bonus stake, bookmaker and Melbourne placement time. Confirmation records a ledger entry only. Edit selections, individual leg outcomes and statistics; inspect before/after audit history.
- **Research Opportunities:** filter synthetic NBA, NBL, ATP and WTA candidates across Track A (High Probability), Track B (Potential Value) and Track C (Alternative Markets). Inspect the original price/forecast provenance and uncertainty before manually paper tracking or confirming an entry.
- **Run Daily Research:** execute the local mock market/statistics workflow. It appends new simulated candidates, notifications and a run record. It is a manual simulation, not scheduled research or live AI analysis.
- **Paper Tracking:** register immutable candidate snapshots and record hypothetical outcomes separately from actual cash records. Imported paper forecasts support separate per-leg results, audited corrections and missing-data-aware hypothetical metrics.
- **Analytics:** compare actual and paper P/L and ROI, sport/strategy results, hit rate, mean odds, Brier score and calibration with sample sizes. Small samples do not establish an advantage.
- **Notifications:** use Test Notification, unread/history views, mark read, dismiss, inspect research details and manually track a selection. Optional browser alerts require permission and an open tab. Background push is not implemented or verified.
- **Historical Import:** upload CSV/JSON, paste mapped JSON or enter a record manually; validate, resolve flags, detect exact/probable duplicates, review provenance and explicitly approve an archive batch. Actual-source archive entries require a second financial confirmation before affecting the ledger. [Formats and exact steps](docs/historical-import.md).
- **Settings:** configure the AUD 500 lifetime funding reference and AUD 5 default stake, record bookkeeping deposits/withdrawals, export a backup and optionally configure private storage. These defaults preserve experiment references; they do not impose new rules or execute transfers.

## Continue the experiment without a paid AI API

On **Research → Run Daily Research**, generate a structured prompt from saved owner-reviewed history, recorded ledger entries, outstanding results and the latest confirmed research day. Copy it into a separate conversation, then paste/upload its structured JSON in **Response review**. Validate evidence, prices, provenance, uncertainty and duplicates before explicitly approving immutable paper forecasts and alerts. Actual bets require their own separate manual ledger confirmation; no wager is submitted.

The reported Day 5 reconciliation is displayed only as an unverified reference. Two structured recovery sources are staged locally for review; the original full export remains unavailable. No records, funding or bookmaker balance are invented from the checkpoint totals. Historical Import now supports selecting a relevant conversation from a user-provided extracted official JSON export and manually mapping its messages. Unknown facts remain null. Experiment rules/day attestations are retained in an append-only context journal. **Export complete experiment** downloads the ledger and historical archive together for a private local backup; restoration remains a separate future reviewed workflow.

Read the [complete continuity guide](docs/research-continuity.md), [conversation intake instructions](docs/conversation-intake.md), [research response JSON Schema](docs/research-response.schema.json), and [verification limits](docs/verification.md). The optional [The Odds API readiness adapter](docs/odds-provider.md) stays disabled and is not called by the handoff. The manual handoff makes no odds or OpenAI API requests. The separately invoked V6 odds diagnostic is documented above; it adds no paid dependency or billing requirement.

Source-extraction recovery staging files can also be reviewed through Historical Import with category separation, known-amount reconciliation and complete warning exports. This path is locked to preview-only until a separately approved import; [review policy](docs/recovery-review.md).

## Financial and statistical conventions

TypeScript stores integer AUD cents. PostgreSQL stores `NUMERIC`, never floating point for money. Decimal odds support four places; payouts round half up to the nearest cent. The combined price entered for a parlay is authoritative. If a leg is void, manually enter the bookmaker's final adjusted combined price; EdgeLab does not infer bookmaker-specific settlement rules.

- Cash win: return = stake × decimal odds; realised profit = return − stake.
- Cash loss: realised profit = −stake. Cash void: stake is returned, zero profit.
- Pending cash stakes reduce **available bankroll** but are not realised losses. Equity includes pending cash reserves.
- Bonus win: cash profit = bonus stake × (odds − 1). Bonus stake is not returned. Bonus loss/void does not reduce cash bankroll.
- Available bankroll = recorded deposits − recorded withdrawals + realised cash/bonus profit − pending cash stakes.
- Cash ROI = realised profit from decisive cash bets ÷ settled won/lost cash stakes. Void and pending stakes and bonus results are excluded. Total P/L separately includes bonus winnings.
- Hit rate excludes pending/void results. Mean odds uses all confirmed bets. Brier score uses only won/lost forecasts with registered probabilities: mean squared error against 1/0. Calibration buckets show mean predicted probability, observed win rate and count.
- Multi-sport parlays appear once under **Mixed**, avoiding duplicated profit. Paper calculations are hypothetical and never feed actual bankroll.

Forecast probabilities are calculated deterministically at runtime from explicitly synthetic win/trial counts using Laplace smoothing: `(wins + 1) / (trials + 2)`. The exact fictional counts, formula, timestamp and `synthetic-frequency-v1` model version are preserved in probability provenance, including historical demo bets and paper snapshots. No real observations or runtime AI are used. Illustrative EV is `probability × odds − 1`; where probability is unavailable, EV is unavailable. This omits bookmaker margin adjustments and is not a claim of verified value.

## Supabase setup and migration approval

The two reviewed migrations were deployed to `ilgoswfckkzpoktabbfi` on 4 November 2026 after explicit approval. Remote history, exact schema metadata, live anonymous rejection and the **17/17 hosted normal-user/API/browser checks** have passed verification. See [deployment results](docs/deployment-verification.md) for the precise scope and remaining gaps, including signup/email delivery and research-related round trips. The setup instructions below also serve as the reproducible runbook; do not replay already-applied migrations.

Demo mode still needs no Supabase account. The local application is configured for the existing project `ilgoswfckkzpoktabbfi` using its public URL and publishable key in ignored `.env.local`. `.env.example` remains a blank template. No secret, service-role or database-password environment variable is used by the application.

The official Supabase CLI is a pinned development dependency. `supabase/config.toml` is initialized with local Site URL `http://localhost:3000`, the exact `/auth/callback` redirect and seeding disabled. This local configuration does not change hosted Dashboard settings. The `project_id` in that file identifies local containers; CLI linking selects the hosted project.

1. In your own terminal, authenticate and link the existing project:

   ```sh
   cd /Users/asan/SportsModel/SportsModel
   npx supabase login
   npx supabase link --project-ref ilgoswfckkzpoktabbfi
   ```

   Complete browser authentication yourself. If linking asks for the database password, type it directly into the secure terminal prompt. Never paste an access token or password into chat, source, `.env.local`, or command-line flags.

2. Inspect remote history and the pending plan:

   ```sh
   npx supabase migration list --remote
   npx supabase db push --dry-run --remote --skip-vault
   ```

   **Stop for explicit approval before an actual remote migration.** Keep the original migration unchanged; later fixes use ordered additive migrations. If hosted tables already exist without matching migration history, review them before doing anything. Do not reset, repair history blindly, or push seeds. After approval, apply only the reviewed pending migrations with `npx supabase db push --remote --skip-vault`.

3. In the project's **Authentication → URL Configuration**, set Site URL to `http://localhost:3000` and add exactly `http://localhost:3000/auth/callback` to Redirect URLs. Under **Authentication → Sign In / Providers**, enable Email and new-user sign-up, retain Confirm Email, and leave anonymous sign-ins disabled. Keep the Confirm signup email template's `{{ .ConfirmationURL }}` link. These settings require a Dashboard check; local config does not deploy them.
4. Restart `npm run dev`. Open Settings to create/sign in to your private account. Sign-up explicitly redirects confirmation to `/auth/callback`, which verifies the resulting user, clears tokens/errors from the address bar, and opens the private workspace. Sessions persist in the browser through the existing Supabase SDK; logout clears the active private view. Private records start empty.
5. Verify refresh persistence and two-user isolation using the checklist in [`docs/database.md`](docs/database.md). Hosted Auth, email delivery and security tests must be reported separately from embedded SQL checks.

The built-in email service currently restricts delivery to organization team-member addresses and two emails per hour; use an authorized address for the free local experiment. This integration does not add paid SMTP. See [Supabase SMTP restrictions](https://supabase.com/docs/guides/auth/auth-smtp) and [redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls). See the [API key guide](https://supabase.com/docs/guides/getting-started/api-keys) for public versus privileged keys.

The historical migration `202611040001_historical_import.sql` was explicitly approved and deployed to `ilgoswfckkzpoktabbfi`. Remote history and the exact hosted catalog passed verification (20 tables, 20 RLS policies); anonymous access was rejected on all six historical tables and both RPCs. No real experiment history was imported. Ordinary-user positive historical lifecycle verification remains separate; see the current verification report. See [historical import](docs/historical-import.md), [deployed history schema](docs/database.md#historical-import-schema--deployed-after-approval), and the [exact migration review](docs/historical-migration-review.md).

There is no demo-to-private import. Mock research and test alerts run only in Demo mode, and simulated records are rejected by the private repository/database. RLS restricts records to `auth.uid()`; RPC writes are atomic with a workspace revision check. OpenAI remains unconnected. Optional server-only sports inspection is disabled by default; its coverage is reported separately. Supabase's [Free plan](https://supabase.com/pricing) is sufficient for this setup; no paid hosting or billing account is required by EdgeLab.

## Checks

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

`npm start` serves the production build locally. Tests cover deterministic settlement/accounting, bonus/cash separation, paper isolation, ratios, calibration, Brier score, validation, mock runs, adapter stubs and persistence boundaries. See [`docs/verification.md`](docs/verification.md) for the checks actually executed, and [`docs/browser-qa.md`](docs/browser-qa.md) for optional browser checks. Browser notification delivery and live Supabase authentication depend on the user's browser/project and are not guaranteed by unit tests.

The lockfile resolves a compatible stable toolchain: Next.js 16.4, React 19.3, Tailwind 4.3 and TypeScript 6.0. TypeScript 7 and ESLint 10 are intentionally deferred because current Next.js lint dependencies do not all support them. ESLint 9 is development-only. The runtime dependency audit reports zero known vulnerabilities; the development lint dependency tree reports 16 moderate advisories for transitive glob-matching code. No forced major-version overrides were applied.

## Structure and next work

- [`src/app`](src/app): App Router entry points and global theme.
- [`src/components`](src/components): dashboard, ledger, forms, research, analytics, notifications, settings and shared UI.
- [`src/lib/domain`](src/lib/domain): strict entities, Zod validation, synthetic fixtures and pure calculations.
- [`src/lib/imports`](src/lib/imports): nullable historical snapshots, bounded parsers, duplicate detection, provenance, reconciliation, paper/notification commands and isolated repositories.
- [`src/lib/providers`](src/lib/providers): replaceable provider interfaces, functioning local mocks and explicit future adapter stubs.
- [`src/lib/persistence`](src/lib/persistence): browser-local and authenticated Supabase repositories.
- [`supabase/migrations`](supabase/migrations): private schema, ownership constraints, RLS, immutable snapshots and transactional RPCs.
- [`tests`](tests): calculation/provider and persistence tests.

Read [`docs/architecture.md`](docs/architecture.md), [`docs/database.md`](docs/database.md), [`docs/roadmap.md`](docs/roadmap.md) and [`AGENTS.md`](AGENTS.md).

The Odds API readiness and OpenAI integration remain optional/unconnected. Hybrid free sports-data adapters now support explicitly requested, authenticated local inspection; no request runs on page load. ATP/WTA retain manual evidence fallback. No paid SDKs are installed. Scheduled polling, automatic odds ingestion, validated model training and background push remain future work.

The current daily-workflow implementation and precise verification limits are documented in [Daily workflow](docs/daily-workflow.md), [sports data](docs/sports-data.md) and [master verification](docs/master-verification.md). Existing hosted history is preserved; this development made no hosted writes or migrations. Normal-user hosted checks of the new batch flow still require a separately approved genuine-record pilot.

## Daily operation

Research → Run Daily Research → copy prompt to a separate conversation → Daily workspace → Import research JSON → review/archive candidates → Confirm Placed / Track as Paper / Watch / Pass → Results and settlements → reviewed batch confirmation. Overview, Ledger, Paper and Analytics then use saved results. Actual ticket odds/payout and financial consent remain separate from research claims. Export complete experiment provides a read-only backup.

The optional Analytics paper-evaluation export excludes retrospective history and unsupported probabilities. Offline model review checks chronology and leakage but does not train or activate a model. No validated statistical advantage is claimed. Approved Methodology Revision 1 remains authoritative; recovered V3 source material is staged privately as unapproved evidence.

V6 dashboard: open [http://localhost:3000/v6](http://localhost:3000/v6) in your existing signed-in private workspace. The five read-only views expose retained research/model evidence and honest unactivated ledger/health states; Demo remains isolated. See [dashboard access and evidence boundaries](docs/v6-dashboard.md). No V6 hosted migration or autonomy activation is required or performed.

Prediction Engine 2.0: `/v6/models` now compares actual MOV/feature-strength/calibrated research models on separately labelled chronological periods, alongside the preserved original prospective benchmarks. [Methods, real results, limitations and reproduction](docs/v6-model-development.md). Future multi-slate collection is prepared through the existing worker but requires separate source approval; no new model, source collection, hosted schema or paper autonomy is activated.

The bounded14-day source-only research pilot is owner-approved and installed, waiting for its approved window: [exact dates, limits, hashes and approval scope](docs/v6-source-pilot-approval.md). It reuses the existing headless worker, requires no hosted V6 schema/worker credential, preserves the source quota journal, and cannot register or settle paper positions. New captured evidence will appear in the existing V6 Research/Model Intelligence pages after explicit owner approval and successful source collection.

The exact source-only pilot is now owner-approved and its macOS LaunchAgent is installed, waiting for14November2026. First research capture:14November19:00 Melbourne; no early research is authorised. [Installation evidence and pending live capture](docs/v6-source-pilot-activation.md). A/B/C and paper autonomy remain disabled.
