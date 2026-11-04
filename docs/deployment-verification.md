# Supabase deployment and verification — 4 November 2026

Project: `ilgoswfckkzpoktabbfi` (Sports Model, production). The user explicitly approved only the following reviewed files. Their contents and the linked reference were rechecked immediately before application.

| Applied migration | SHA-256 |
| --- | --- |
| `202611030001_edgelab.sql` | `550af08d2a33026e641103bda42444193723b701ed0152bff3ce344667a3d33b` |
| `202611030002_harden_workspace_integrity.sql` | `d90a2fc096dfed2bc8c0aeb38ae4ba7f86783afa86fb1e905e824affadf3fb21` |

The pre-application history/dry-run listed exactly these two pending files. Applied in order with `npx supabase db push --remote --skip-vault --agent no --output-format text --yes`. The command completed with exit 0 and no reported migration errors. Both versions then appeared in remote migration history. No seeds, resets, extra migrations, vault changes, paid services or live integrations were applied.

Immediately after deployment, read-only counts showed zero rows in every one of the 14 application tables. Migration application itself did not create betting or funding records. Test accounts were subsequently created by the user through Dashboard; they are separate from real ledger accounts.

## Verified deployed schema

The SELECT-only catalog verifier in `scripts/check-hosted-schema.sql` compared exact object names and definitions against the two migrations, including function-body SHA-256s, column types/nullability/defaults, constraints, indexes, trigger timing/deferral, RLS expressions, SECURITY INVOKER/search paths, and effective/explicit permissions.

| Object | Verified count |
| --- | --- |
| Tables | 14 |
| Columns, including nullability checks | 97 |
| Constraints, excluding separately checked NOT NULL metadata | 134 |
| Indexes, including primary and unique indexes | 42 |
| Ownership RLS policies | 14 |
| Triggers | 24 |
| Functions with exact body hashes | 24 |

Final remote result: `passed: true`, `differences: []`, `rawDifferences: []`. The nine new CHECK constraints remain `NOT VALID`, exactly as reviewed: new/changed rows are checked, historical rows are preserved without automatic validation or repair. All app tables have RLS enabled. Workspace RPCs remain SECURITY INVOKER. Normal authenticated roles have no table DELETE privilege.

The initial catalog comparison exposed 14 redundant explicit EXECUTE ACL entries on trigger-only functions. Read-only `pg_default_acl` inspection confirmed Supabase grants EXECUTE to anon/authenticated by default in the public schema. The local verifier baseline now models those actual platform defaults; all raw differences still fail, and tests detect unauthorized execution/grant-option expansions. No hosted permissions were altered to make verification pass.

Catalog inspection uses an administrative connection to inspect configuration. It does not establish normal-user Auth/JWT or cross-account RLS behavior.

## Verified live anonymous rejection

Using only the public publishable key with no user session:

- SELECT probes on all 14 private tables returned HTTP 401 / PostgreSQL code `42501`.
- Both `edgelab_load_workspace` and `edgelab_save_workspace` rejected anonymous requests with HTTP 401 / `42501`.
- These probes used zero-row SELECTs and a save call that lacked an authenticated identity; no application rows were written.

## Application checks

- `npm test`: 61 passed after the terminal-input follow-up (43 original tests plus 18 email-input regressions).
- `npm run typecheck`: passed.
- `npm run lint`: passed (verification scripts also receive focused lint after changes).
- `npm run build`: passed; all seven workspace routes and `/auth/callback` built.
- Embedded PostgreSQL: 70 checks passed across the unchanged migrations.
- Catalog-verifier baseline and deliberate drift detection: passed, including extra RLS policy, DELETE grants, definer functions, altered triggers/indexes, anonymous RPC/helper execution and grant options.
- Browser regression: 20 demo workflow groups passed, eight private/demo isolation groups passed, and three negative callback cases passed. No runtime exceptions or attempted Supabase mutations occurred in these isolated signed-out contexts.
- The local dev server served at `http://localhost:3000`; Demo uses separate browser-local storage, and signed-out Private workspace displays empty records.

Local checks were rerun during this report review: 61 unit tests, TypeScript, lint and the production build all passed. The hosted write harness was not replayed.

## Verified live authenticated run

The user ran the secure terminal harness with two dedicated confirmed accounts. The sanitized report completed at `2026-11-04T00:13:32.537Z` (4 November 2026, 11:13 Australia/Melbourne). Result: **17/17 passed**, comprising 13 API/SDK groups and four actual browser groups. No failures are recorded.

Evidence is preserved in [reports/hosted-access-20261104.json](reports/hosted-access-20261104.json), copied byte-for-byte from `/private/tmp/edgelab-hosted-access-20261104.json`. SHA-256: `83a96ebb2432b5d5caad90dedc96f12b131f748987ec6d60889a18077c93609f`. The report contains no passwords, email addresses or JWTs. The report and the corresponding harness were inspected; hosted write tests were not rerun for this documentation review.

The harness used only the public publishable key and password-issued user sessions. It checked distinct JWT subjects with role `authenticated` and verified both users through Supabase Auth `getUser()`. No service-role key, management token, SQL role impersonation or forged JWT was used for these access tests. Both accounts were checked for completely empty application storage before any test writes.

| # | Executed check group | Result |
| --- | --- | --- |
| 1 | Unauthenticated RPC and private-table access denied | Passed |
| 2 | Two distinct password grants issue normal authenticated JWTs | Passed |
| 3 | Both accounts are completely empty before application writes | Passed |
| 4 | Manual ledger, funding and settings save and round-trip | Passed |
| 5 | Each user sees only their own records across every user table | Passed |
| 6 | Cross-account modification and ownership forgery rejected | Passed |
| 7 | Bet edit and settlement persist with before/after audit | Passed |
| 8 | Session and records survive SDK re-instantiation | Passed |
| 9 | Stale workspace revision rejected without changing newer settings | Passed |
| 10 | Append-only financial and audit history cannot be changed | Passed |
| 11 | Authenticated delete is denied and the test ledger survives | Passed |
| 12 | Simulated research is rejected atomically without relabelling provenance | Passed |
| 13 | Logout removes client access while the second session remains valid | Passed |
| 14 | Browser Settings sign-in opens the correct private workspace | Passed |
| 15 | Authenticated browser reload restores the saved ledger and session | Passed |
| 16 | Switching browser workspaces retains the original demo snapshot | Passed |
| 17 | Browser logout clears private visibility without removing demo data | Passed |

### What this verifies

- Both ordinary accounts can sign in and save/reload labelled synthetic manual ledger entries, deposit records and experiment settings. Stored NUMERIC stake/odds/funding projections were checked. Account A's cash single was edited from pending to won with leg statistics and before/after audits.
- Each account's cross-owner SELECT probes returned no rows across all 14 tables. A cross-account bet UPDATE was denied or affected zero rows, the owner's bet remained unchanged, and an INSERT claiming another owner failed with `42501`.
- Anonymous RPC/private-table requests failed. Authenticated deletion of the test bet failed with `42501`. Financial/audit mutations were rejected and the persisted transaction remained unchanged.
- Account A's session and data survived SDK re-instantiation. Actual browser Settings sign-in opened A's private ledger; F5 retained both its session and saved record. Demo/private switching preserved the original demo snapshot, and browser logout cleared private visibility while preserving demo data.
- An old snapshot was rejected after a newer settings save. A simulated research save was rejected with the entire workspace and revision unchanged. API logout removed A's client access while B's separate session remained valid.

All labelled synthetic test accounts and records are retained. No accounts or records were deleted or changed during this report review. Do not rerun the write harness on these populated accounts: its empty-account guard intentionally stops that operation.

### Remaining unverified behavior

- Signup and confirmation-email delivery: these users were created and confirmed through Dashboard. The positive email confirmation callback flow was not exercised by this run.
- Expired-token handling, token refresh/rotation and long-duration sessions. Logout clearing was verified; immediate invalidation of already-issued JWTs was not tested or claimed.
- Successful hosted research, paper-prediction, odds/model and notification/run writes. Those tables were empty in the cross-account probes, so non-empty record isolation and full positive round trips there remain unverified. Truthful simulated-research rejection passed; fixtures must not be relabelled as real.
- Authenticated browser coverage used account A and read SDK-created records. Hosted bet/funding/settings form submission, all hosted parlay/bonus/loss/void settlement variants and account B's browser workflow were not exercised.
- True simultaneous transactions, load/race stress and failure injected after partial SQL execution. The stale-update scenario was sequential; rejected synthetic input proved no persisted change but did not force a mid-transaction fault.
- OS notification delivery, background push, scheduled research, live sports providers and external numerical-model validity.

## Verification tooling and terminal input

`check-hosted-access.mjs` requires two fresh dedicated accounts and keeps all labelled test rows. Emails are visible and validated immediately, including reserved `@example.invalid` addresses. Passwords stay hidden; neither credentials nor tokens enter arguments, files or reports. Unit coverage includes 18 email-input cases, and a no-network PTY regression checked retries and non-echoed dummy passwords. The initial pre-authentication input issue was resolved before this successful run without changing authentication or RLS rules.

For a separately authorized repeat, use two new empty accounts and a new report filename. See [database.md](database.md) for the runbook. The existing report is the evidence for this completed run; it is not necessary to rerun it to inspect the results.
