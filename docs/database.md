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

On 4 November 2026, after explicit user approval and hash/reference checks, both reviewed migrations were applied in order to `ilgoswfckkzpoktabbfi`. Remote history confirms versions `202611030001` and `202611030002`. No additional migration, seed or reset was used. Immediately afterward all 14 application tables were empty.

Exact hosted catalog verification passed for the tables, columns, policies, functions, triggers, constraints, indexes and permissions. Anonymous requests to all 14 tables and both workspace RPCs returned HTTP 401 / `42501`. The nine reviewed CHECK constraints remain NOT VALID. See [deployment-verification.md](deployment-verification.md) for exact counts, commands, limitations and normal-user test status. [migration-review.md](migration-review.md) remains the historical pre-deployment approval review.

The user completed the two-account secure terminal run: **17/17 passed** (13 API/SDK and four browser groups). It verified normal-user sign-in/JWT identity, manual ledger/funding/settings writes, session restoration, cross-account bet protection, stale snapshots, deletion/history restrictions, private/demo separation and logout. The sanitized [report](reports/hosted-access-20261104.json) and exact [verification scope](deployment-verification.md) are retained. Signup/email delivery, token expiry/refresh and positive hosted research/paper/notification round trips remain unverified. Test accounts and records are retained; this report review performs no remote writes.

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

Automated repository tests cover local isolation, validation, simulated-record rejection and revision error handling. The deployed project also passed the 17-group real-user test. Local SQL/catalog checks and hosted normal-user checks are distinct evidence. Email delivery, expired sessions and positive research-related writes still require separate verification.

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

The completed run's exact outcomes are recorded in [deployment-verification.md](deployment-verification.md): core Auth, bookkeeping persistence, RLS bet protection and browser session checks passed. The checklist above remains a runbook; it does not expand coverage beyond the report. Signup/email and the stated remaining behaviors are still unverified.

### Secure two-account hosted test

Create two new dedicated users in Dashboard → Authentication → Users → Add user → Create new user, with distinct emails, private strong passwords and Auto Confirm User enabled. Do not use personal accounts containing application data. No CLI secret-key retrieval is needed.

With the local app running at localhost:3000, run in your own interactive terminal:

```sh
node scripts/check-hosted-access.mjs \
  --project-ref ilgoswfckkzpoktabbfi \
  --confirm-test-writes \
  --browser-runtime /private/tmp/edgelab-browser \
  --report /private/tmp/edgelab-hosted-access-20261104.json
```

The optional browser runtime above is the existing temporary Playwright installation used for local QA; omit `--browser-runtime` for API/SDK-only checks. To reproduce on another machine, install Playwright into a temporary prefix and supply that path, as described in `docs/browser-qa.md`. Installed Chrome is detected on macOS, with `--browser /absolute/path` available elsewhere. `--app-url` defaults to `http://localhost:3000`.

Emails are visible in your own terminal and validated immediately; reserved addresses such as `edgelab-test-a-20261104@example.invalid` are accepted syntactically. Passwords remain hidden. Passwords/tokens are never accepted in arguments or saved to files; errors and the JSON report are sanitized and omit both emails and credentials. The harness first verifies two normal Auth-issued sessions, then requires both workspaces AND all 14 user-owned table reads to be empty before any app write. It aborts if either account already contains application records.

The single run executes 13 API/SDK groups and four optional browser groups: real password sign-in, authenticated ownership, labelled synthetic bookkeeping round trips and settlement/audits, session restoration, stale-update rejection, immutable-history/deletion restrictions, truthful simulated-research rejection, logout, browser F5 and demo isolation. Test bookkeeping rows remain in the dedicated accounts for review. It creates no Auth users and deletes no records. Do not rerun the write harness against already-used accounts: the empty-account guard will stop it. Preserve its report for review; use a new report filename and two new dedicated accounts for a deliberate new full run.

The authenticated write test intentionally uses manual records without a forecast or invented source provenance. Its records explicitly say SYNTHETIC/INTEGRATION TEST/no wager. Research/paper/notification successes are not claimed from relabelling synthetic research as real. Production rejection of such fixtures is a passing boundary check.

## Historical-import schema — deployed after approval

`202611040001_historical_import.sql` received its own explicit approval and was deployed to the intended project on 4 November 2026. Remote history and exact hosted catalog verification passed. Do not reapply it. No source data or seed was included. Review [historical-import.md](historical-import.md) for the UI/format contract and [historical-migration-review.md](historical-migration-review.md) for the exact hash, object counts and read-only remote plan.

The additive migration creates:

- `historical_workspace_revisions`: a private per-user optimistic-concurrency counter, independent of the existing financial workspace revision.
- `historical_import_batches`: immutable original source text, SHA-256, classification and approved summary.
- `historical_research_records`: immutable nullable source snapshots, raw rows, fingerprints, transformation history and explicit review acknowledgements. Numeric money projections derive from integer cents; unknowns remain SQL NULL.
- `historical_paper_results`: separate mutable overall/leg results, guarded against contradictory outcomes and changes to original forecasts.
- `historical_notifications`: source-linked, deduplicated reminders with monotonic read/dismiss state and retained history.
- `historical_audit_history`: append-only import/lifecycle audit payloads. Database triggers also generate audit records for direct authenticated changes.

All six tables enforce `auth.uid()` ownership with RLS. Authenticated roles receive no DELETE privileges. Source/record/audit updates are forbidden. Composite UUID/user foreign keys prevent cross-owner references. A private historical batch cannot be classified synthetic. Original source UTF-8 SHA-256, payload projections, source snapshot references, summaries and duplicate fingerprints are checked. The migration does not alter existing application rows, tables or policies.

`edgelab_load_history(expected_owner_id)` and `edgelab_save_history(workspace, expected_revision, expected_owner_id)` are SECURITY INVOKER RPCs with fixed search paths. Anonymous/Public execution is revoked. Both RPCs require the captured expected user UUID and reject a mismatch with `auth.uid()` before access, so a shared-client account switch between identity verification and the request cannot redirect a historical operation into another account. Save validates before writing, locks the user's revision, rejects stale snapshots, preserves old immutable rows and performs the approved append/lifecycle changes atomically. Direct writes invalidate stale snapshots. Unique source identity and notification keys prevent exact duplicate registration; uncertain matches still require application review. A failed save rolls back.

Read-only status checks (the historical migration is already applied):

```sh
npx supabase migration list --remote
npx supabase db push --dry-run --remote --skip-vault
```

Confirm the linked project is `ilgoswfckkzpoktabbfi` and all three versions are already recorded. No pending migration is expected for this stage. Do not replay the historical file. Stop if remote history/schema differs or an unexpected migration appears; any future migration requires separate review and approval. Never reset or push seeds. The original pre-deployment plan and approval are retained in the migration review.

The private Historical Import and paper/alert sections can now address the deployed history RPCs. Normal-user reads and expected-failure synthetic writes passed the secure hosted checks. Positive hosted historical/paper/notification writes remain unverified. Existing bookkeeping/Auth and Demo separation are preserved.

### Local verification of the pending schema

With the already installed temporary PGlite runtime (or the optional setup above):

```sh
node scripts/check-database.mjs --runtime /private/tmp/edgelab-db-validation
node scripts/check-import-database.mjs --runtime /private/tmp/edgelab-db-validation
```

The first preserves the original security/persistence regression checks while applying all local migrations; the second covers the new archive, paper and alert lifecycle, negative financial/source cases, two normal-role user contexts, anonymous denial and stale saves. This is embedded PostgreSQL with an Auth shim, **not hosted Auth or gateway verification**. No remote records or accounts are changed.

After authorized deployment, hosted verification must use ordinary authenticated users and the public key. Do not reuse populated accounts with the old empty-account write harness, label synthetic tests as real research, weaken private synthetic rejection, or use service-role results as RLS proof. A dedicated reviewed hosted historical verification path remains to be prepared; local mocked/SQL successes do not replace it.


## Research continuity storage and hosted checkpoint

The manual research handoff reuses the six historical tables without schema changes. Versioned response/context envelopes remain the immutable batch source; original candidate objects remain raw rows; mapping, metadata and day-completion attestations remain transformations. Paper approval adds separate result state and linked alerts atomically. Context journals and pass/watch decisions are kind-null archives, not actual/paper bets. Source-supported actual records still need separate financial confirmation.

The latest hosted report passed **11/11** ordinary-user read/negative checks with distinct password-issued sessions. Both historical contexts began empty; cross-owner reads returned no rows, expected-owner loads/saves rejected, null-owner access rejected, synthetic batch/record validators and saves rejected, anonymous reads/RPCs denied, and both snapshots/revisions stayed unchanged. This is not non-empty cross-account persistence proof. See [hosted-history-verification.md](hosted-history-verification.md) and [retained report](reports/hosted-history-access-20261104.json). Existing accounts/records were preserved.

The exact catalog matches 20 tables / 20 policies / 46 functions / 42 triggers with zero differences, including the original schema. Positive local PostgreSQL lifecycle tests remain separate. No normal-user hosted immutability/update/settlement success is claimed merely from catalog definitions or rejected synthetic inserts. The private synthetic boundary must remain intact.

## Personal operating verification

Settings includes a read-only check using the existing authenticated session and both normal repositories. `settingsStored: false` distinguishes an empty settings table from the A$500/A$5 display defaults; no funding is created. The first personal reports were empty; the subsequent explicitly approved genuine single-paper pilot verified positive archive, paper state, notification read/dismiss, audits and refreshed normal-user reads. One record exists at history revision 5; actual wagers and funding remain empty. No synthetic record was relabelled or seeded. The six historical tables, RLS, triggers, RPCs and immutable source constraints were not changed. See [operating guide](operating-edgelab.md) and [current verification](verification.md).

## Versioned context / owner checkpoint continuation

No fourth migration is required or prepared. Context v2 and methodology text live inside the existing immutable raw journal source, with the same strictly validated historical snapshot shape and normal owner-bound RPCs. Owner checkpoint reviews use nullable snapshots and separate raw quote/range provenance; unknown execution fields are not filled to satisfy financial constraints. Preview guards block the staged owner checkpoint until separately approved. All three deployed migration files remain unchanged. See [research memory](research-memory.md) and [Day 6 review](day6-review-status.md).

## Daily settlement persistence — 6 November 2026

No migration was added or applied. Daily app settlements reuse `edgelab_save_workspace`; imported-paper result evidence/legs and audits reuse `edgelab_save_history`. Source snapshots remain immutable. Existing user ownership, RLS and revision conflicts remain enforced. A mixed batch spans two transactions and reports partial success; unchanged replay is idempotent. Research-to-actual links use an audited notes marker rather than misusing the core `research_candidates` foreign key. Local PostgreSQL tests exercise these paths with two normal authenticated roles and anonymous rejection; this is not proof of a new hosted write.

Provider quota JSON is local operational state only; it stores no credentials or betting records. Provider reads never write tables. Real production history, Methodology Revision 1, eight archived wager claims, Maxey and Day 6/7 records were not changed by this development.


## Canonical private-account activation — 11 November 2026

The existing historical schema accepted an owner-approved 34-record archive import through the normal signed-in UI. A fresh private export after the owner reported reload confirms 46 archive records, one unchanged actual wager, three unchanged historical paper tracking states and no funding transactions. All 46 canonical source positions (12 actual claims, 34 paper sources) are represented by existing links or new immutable archives. The import added three actual claims and 31 paper sources; it did not financially register or settle anything. Verification used owner-provided before/after exports, preserved source hashes and retained server/client import audits, not a privileged database session. See [account activation](account-activation.md).

No schema changes were needed for archive representation. The deployed core snapshot validator still requires placement timestamps and rejects optional lifecycle/correction fields added later in TypeScript; do not force incomplete claims into core bets. The private Daily Cycle blocker present at this checkpoint is resolved by the source-only archival path below. Local correction types still do not establish hosted support.

## Private Daily Cycle source persistence — 11 November 2026

`archiveDailyCycle` creates one source batch, an immutable cycle journal and nullable candidate-source snapshots using the existing history schema. `edgelab_save_history` commits these with source/audit/revision validation in one transaction. Success requires read-back through the normal authenticated repository. A failure rolls back source, audit and revision. A unique semantic fingerprint plus namespaced cycle/source reference protects exact, renamed and concurrent replay. The original input bytes/hash and full recommendation/result/feedback objects remain raw evidence; unsupported model probabilities normalize to null.

This adds no table, migration, privileged client, financial write or automatic result/paper registration. Private explicit synthetic sources are rejected. Unit, mocked-browser and local PostgreSQL tests cover this new path; a new genuine Daily Cycle hosted write through the owner's browser is still unverified. Existing hosted records were not touched.

## V6 SQL proposal — not deployed

`supabase/proposals/202611110001_v6_paper.sql` is deliberately outside the migration directory. **It has no deployment approval and must not be pushed.** All three previously deployed migrations remain unchanged. The isolated local worker currently uses private V6 files, not Supabase.

The proposal adds ten `v6_` tables: policies, controls, models, observations, positions, grade revisions, runs, provider quotas, in-app outbox and audit. All have owner RLS, composite same-owner foreign keys where applicable, no DELETE permission, immutable original evidence and append-only revisions. Invoker RPCs register exact distinct paper positions, append source-backed grade revisions, reserve operational credits and summarize hypothetical accounts. Source SHA uses deterministic UTF-8; prices are NUMERIC and stakes integer cents. The proposal updates no legacy table/data and seeds nothing.

The non-login `edgelab_v6_worker` role receives no legacy table/RPC grants, financial capability, model/policy activation permission or external-message capability. A single `registered_at` UPDATE-column privilege permits PostgreSQL row locking during serialized grading; an unconditional BEFORE UPDATE trigger still rejects every edit. Local tests verify that rejection. Credit reservations cannot rewind and the proposed per-owner UTC-month ceiling is an operational safeguard, not a paper-exposure cap. Multi-owner aggregation under a shared provider key and the existing local pilot budget are not integrated yet.

The proposal passes embedded PostgreSQL with the original schema, normal owner/second-user contexts, anonymous denial, a restricted worker context, pre-event/policy/model gates, synthetic/malformed rejection, >100 distinct positions despite negative availability, source/grade immutability, corrections/replay, quota rollback and unchanged legacy rows. These are local tests, **not hosted deployment or real empirical model validation**. PostgreSQL constraints do not independently verify upstream truth or prove a model's validation label; trusted registry creation needs a reviewed chronological validation process.

Before a deployment request: review the SQL/hash, model-registry activation policy, role/JWT issuance and private API exposure, quota sharing and atomic hosted repository design. A custom worker JWT/role membership is deliberately not issued/configured; a Supabase V6 adapter is not implemented. No full hosted concurrent-worker claim is made from an embedded single-connection database. Owner approval and a targeted remote dry-run are separate future steps.
