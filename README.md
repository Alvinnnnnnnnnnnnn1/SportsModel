# EdgeLab

A private, zero-cost sports research and record-keeping MVP built with Next.js App Router, React, TypeScript, Tailwind CSS, shadcn/ui components, Recharts, Zod and optional Supabase Auth/PostgreSQL.

**All initial sports, teams, players, markets, odds, forecasts, alerts and results are synthetic.** They demonstrate the product and are not real opportunities or evidence of a betting advantage. EdgeLab never places wagers, connects bookmaker accounts, accesses bookmaker credentials, scrapes bookmakers or transfers money.

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

Historical imports use a new, prepared but **unapproved and unapplied** migration (`202611040001_historical_import.sql`). The full new workflow works in Demo. Hosted historical storage stays unavailable until separate approval/deployment; existing authenticated bookkeeping remains operational. No real experiment history was imported. See [historical import](docs/historical-import.md), [pending schema](docs/database.md#pending-historical-import-schema--not-deployed), and the [exact migration review](docs/historical-migration-review.md).

There is no demo-to-private import. Mock research and test alerts run only in Demo mode, and simulated records are rejected by the private repository/database. RLS restricts records to `auth.uid()`; RPC writes are atomic with a workspace revision check. Live sports/OpenAI providers remain unconnected. Supabase's [Free plan](https://supabase.com/pricing) is sufficient for this setup; no paid hosting or billing account is required by EdgeLab.

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

Future adapters for The Odds API, OpenAI, NBA, NBL and ATP/WTA statistics deliberately fail with a clear “not configured” error and make no live request. No paid SDKs are installed. Scheduled jobs, live odds ingestion, verified model training and background push remain future work.

The recommended next stage is review/approval of the prepared historical migration, followed by ordinary-user hosted historical persistence/RLS checks and one authorized real email-confirmation flow. Local auth transport tests cover expiry/refresh and failure cases; hosted email delivery and the new hosted history path remain unverified. Retain existing synthetic accounts/records; see [verification](docs/verification.md) and [roadmap](docs/roadmap.md).
