# Supabase persistence

The default synthetic workspace stays in browser local storage under `edgelab:demo:v1`. Without Supabase credentials it makes no Supabase requests. When credentials are configured, the optional Auth client may refresh an existing session even while Demo is visible; demo records are never sent to that client. Switching to the authenticated workspace loads a separate database and never uploads demo history. A new authenticated account starts empty; there is no migration of ChatGPT history or browser fixtures.

## Existing Free project setup

The local integration targets `https://ilgoswfckkzpoktabbfi.supabase.co`. Its supplied **publishable** key is configured only in ignored `.env.local`; `.env.example` stays a template. Browser access uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (legacy public anon fallback supported). The SDK explicitly persists/refreshes sessions and handles the existing implicit callback flow. No service-role key is required or exposed.

The CLI is installed as a development dependency. Local `supabase/config.toml` disables seed execution and uses `http://localhost:3000` plus the exact callback URL. Its local project ID is not the hosted project reference. Hosted Auth settings must be configured in the Dashboard separately.

### CLI authentication and migration process

Run these commands from the repository in your own terminal:

```sh
npx supabase login
npx supabase link --project-ref ilgoswfckkzpoktabbfi
npx supabase migration list --remote
npx supabase db push --dry-run --remote --skip-vault
```

Complete CLI browser login yourself. If a database password is requested, enter it directly in the terminal's secure prompt; do not use `--password`, shell history, source files or chat. CLI session/link metadata is excluded from Git. The public publishable key is sufficient for the app but cannot administer schema migrations.

Review remote history and display the pending migration summary before requesting explicit approval. **Do not apply a remote migration without that approval.** The original `202611030001_edgelab.sql` remains unchanged; improvements are separate ordered migrations. If objects were previously created manually and migration history is absent, inspect compatibility and stop rather than replaying the initial CREATE statements or marking history applied blindly. Never run remote resets or push synthetic seed data.

Only after approval, apply the reviewed pending files:

```sh
npx supabase db push --remote --skip-vault
```

`--skip-vault` avoids unrelated vault synchronization. Do not add `--include-seed`, `--include-all` or broad automatic confirmation flags. Verify the resulting migration history after applying.

### Hosted Auth settings

In Dashboard → Authentication → URL Configuration:

- Site URL: `http://localhost:3000`
- Redirect URLs: `http://localhost:3000/auth/callback`

Under Authentication → Sign In / Providers, enable Email and sign-up, keep Confirm Email enabled, and keep anonymous sign-ins disabled. Retain `{{ .ConfirmationURL }}` in the Confirm signup email template. Sign-up requests the exact callback; its view validates the authenticated user, shows safe expired/invalid-link errors, removes token/error parameters, selects the private workspace and offers a fixed Settings destination. It does not accept arbitrary `next` redirects.

The default Supabase SMTP service currently sends only to organization team-member email addresses and is limited to two emails/hour. Use authorized emails when testing confirmation without adding paid SMTP. Email delivery still requires manual verification. [Official SMTP restrictions](https://supabase.com/docs/guides/auth/auth-smtp), [redirect URL documentation](https://supabase.com/docs/guides/auth/redirect-urls).

Restart `npm run dev` after environment changes. The app's Settings shows Private workspace as configured; sign in there. No demo history is transferred. Missing hosted RPCs show a workspace error and never cause demo data to be saved as private history.

## Current integration checkpoint

CLI authentication/linking is complete, and the linked reference was verified as `ilgoswfckkzpoktabbfi`. Remote history has no applied migrations. A read-only catalog check found no public tables/views, public indexes or EdgeLab functions; PostgreSQL is 17.11 and the required Supabase roles/Auth table and pgcrypto extension are present.

The remote dry-run succeeded and lists both local migrations in order. No migration was applied and no application records were changed. The next step requires explicit approval of the reviewed files before any remote migration. See [migration-review.md](migration-review.md) for the exact object changes, safety findings, hashes and approval scope.

The supplied URL/key previously returned HTTP 200 from the live Auth settings endpoint: Email enabled, sign-up allowed, email confirmation required. Successful app sign-in/email delivery and authenticated hosted persistence/RLS remain unverified until migrations are approved, applied and tested with normal user sessions. Embedded SQL results are local tests only.

## Data model

Each row belongs to an authenticated user, including sports, events and model versions. The schema contains `user_profiles`, `experiment_settings`, `sports`, `events`, `bets`, `bet_legs`, `financial_transactions`, `research_candidates`, `paper_predictions`, `odds_snapshots`, `notifications`, `research_runs`, `model_versions` and `audit_history`.

UUIDs identify entities. Composite foreign keys include `user_id`, so a user cannot reference another user's event, candidate or bet. RLS checks `auth.uid()` for both reads and writes. Anonymous access has no grants or policies. Financial columns use `NUMERIC(14,2)` in AUD, with decimal odds and probabilities also stored as `NUMERIC`. The TypeScript domain uses integer cents. Timestamps use `timestamptz`; the UI formats Australia/Melbourne.

Validated JSON payloads retain the exact domain snapshot for round-tripping, including audit before/after data. Important searchable and financial fields are normalized into typed/generated columns, with separate leg, event, odds and model tables. Generated monetary columns derive from integer cents; there are no competing mutable money values. Removed parlay legs stay as inactive history, while the bet payload and active legs describe the current selection.

Candidates, odds snapshots, model versions, financial transactions and audit entries are immutable. Forecasts require complete source, method, timestamp and model-version provenance; partial or null provenance cannot bypass database checks. Monetary snapshots require integer cents, UUID/timestamp payloads must match typed columns, and settlement dates cannot precede registration/placement. Paper snapshots retain original candidate/probability/provenance and only allow settlement fields to change. Bet forecasts retain their original probability and candidate reference. Updating a bet appends a server-generated audit record, even if the change is made directly through the authenticated SQL API. The UI also records its descriptive edit audit. No DELETE privileges are granted to authenticated users.

Simulated research candidates, paper snapshots, notifications and research runs are rejected by both the Supabase repository and SQL checks. The local mock service cannot run in the authenticated workspace. Actual bets entered manually are the user's own records; they are never verified against a bookmaker.

## Additive integrity hardening migration

`202611030002_harden_workspace_integrity.sql` is a separate local migration; it does not overwrite `202611030001_edgelab.sql`. It aligns SQL snapshots with application validation, rejects string/NaN/fractional-cent inputs, checks exact odds precision and aggregate leg outcomes, and verifies that current bet snapshots agree with normalized active legs. Direct authenticated changes advance the workspace revision so a stale whole-workspace save cannot silently overwrite them. The save RPC remains `SECURITY INVOKER`, and ownership RLS remains in place.

New checks use `NOT VALID`: they protect new/changed rows without rewriting or deleting pre-existing malformed data. Before hosted approval, inspect any existing data and review invalid historical rows separately. Do not silently repair them. A later explicit validation/repair step may be appropriate after that review. Passing local tests does not establish the state of the hosted schema.

## Repository contract and concurrency

`createDemoRepository()` and `createSupabaseRepository(userId)` implement `Repository.load()` / `Repository.save(data)`. Keep a repository instance for the active user and call `load()` before the first save. A null load means a new, empty account.

The `edgelab_save_workspace(workspace, expected_revision)` PostgreSQL function writes normalized records in one transaction. It runs as the authenticated caller (`SECURITY INVOKER`), checks `auth.uid()`, locks experiment settings, and verifies a monotonically increasing workspace revision. A stale browser tab receives a conflict error instead of silently overwriting newer data. Reload to obtain the latest revision before editing again. Do not automatically retry a rejected stale snapshot. A failed RPC rolls back all changes.

The MVP saves the current workspace in one RPC rather than implementing per-entity synchronization. This is suitable for a private small experiment. Introduce paginated entity repositories before substantially growing the ledger. The database audit generated during saves appears on the next workspace load.

## Verification limits and checks before live use

Automated repository tests cover local isolation, validation, simulated-record rejection and revision error handling. The migration can be syntax/execution tested against local PostgreSQL; authentication, email confirmation and RLS must also be tested against your own configured free Supabase project before relying on it for real records.

With two test accounts, verify that neither account can select/update the other's UUIDs or invoke the RPC unauthenticated; direct immutable-record updates fail; bet edits append audits; a stale tab is rejected; and signing out clears the visible authenticated workspace. Do not use a service-role connection for these isolation checks, since service-role credentials bypass RLS.

### Optional embedded PostgreSQL checks

The repository keeps the database harness separate from runtime and default development dependencies. To reproduce it without a database service, install the test-only runtime in a temporary directory and pass its npm prefix:

```sh
npm install --prefix /tmp/edgelab-db-test @electric-sql/pglite@0.5.14 --no-audit --no-fund
node scripts/check-database.mjs --runtime /tmp/edgelab-db-test
```

The harness runs a fresh in-memory PostgreSQL, applies the migration, and exercises two authenticated users with RLS enabled. It substitutes a small `auth.users`/`auth.uid()` test shim for Supabase Auth and omits `CREATE EXTENSION pgcrypto` because the embedded runtime already exposes PostgreSQL's builtin `gen_random_uuid()`. It tests SQL execution and database privacy/immutability rules, not Supabase email delivery or the hosted authentication gateway. No real sports records, external API requests or cloud writes occur.

## Hosted persistence and security verification after approval

Use two separate browser profiles or private windows with separate authenticated test accounts. Enter passwords directly in the browser/secure terminal; never share them in chat. Use normal user sessions and the publishable key for all RLS checks, never a service-role client. Keep test activity clearly identified and separate from real ledger accounts; do not seed demo fixtures or delete existing data.

1. Sign up using an authorized email, follow its confirmation link back to localhost, sign in, refresh, and sign out. Verify errors on incorrect credentials and expired confirmation links. Verify that a signed-out session cannot load the private RPC.
2. In account A, manually create one authorized ledger/funding record, edit it and record settlement; inspect its before/after audit. Save settings and refresh. Reopen a browser session to verify persisted session and data. Registration of non-simulated research/paper/notification records can be checked through the authenticated repository without connecting a live provider; production research UI remains empty until real, documented data is supplied.
3. In account B, confirm its workspace is separate. Attempt bounded reads/updates of A's known record UUID using B's normal access token: it must see no records and change nothing. Verify unauthenticated access and record deletion are rejected. Never conclude RLS passed from a privileged connection.
4. Open A in two tabs. Save from the first, then save the older second-tab snapshot. The second must report a revision conflict, retain its prior view and require reload. Verify rejected saves leave no partial records.
5. Check immutable candidate/probability/provenance and paper registration fields, append-only financial/audit history and matching current bet/leg projections. Refresh after edits to see server-generated audits.

Record exact hosted outcomes separately. Until those checks are executed, Auth sign-up/sign-in/email and hosted RLS/persistence remain unverified.
