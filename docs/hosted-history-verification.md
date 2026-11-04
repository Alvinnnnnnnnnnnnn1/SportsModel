# Hosted historical access verification

This runbook verifies the deployed historical schema without importing genuine experiment history or falsely classifying synthetic research as real. It creates no Auth users, deletes no accounts/records, and never asks for a password in chat. The previous populated dedicated users may be reused for read/negative checks; their legacy bookkeeping records are preserved.

## Scope and the synthetic boundary

Private historical storage rejects `verification: "synthetic"`. Keep that label intact. A test must not change it to `unverified` or `user_confirmed` to force a positive write, even within a rollback transaction. No privileged key, temporary constraint bypass or schema clone is used to claim ordinary-user RLS success.

Accordingly, this harness verifies hosted normal-user reads, expected-owner checks, cross-owner read filtering, honest synthetic rejection and anonymous restrictions. **Positive hosted history/paper-result/notification round trips remain unverified** until an appropriate separately authorized genuine source or approved isolated test facility exists. Local PostgreSQL/browser lifecycle tests are separate evidence and remain useful.

## Anonymous checks without credentials

From the repository, run:

```sh
node scripts/check-hosted-history-access.mjs \
  --project-ref ilgoswfckkzpoktabbfi \
  --anonymous-only \
  --report /private/tmp/edgelab-history-anonymous-20261104.json
```

Only the public URL/publishable key from ignored `.env.local` is read. The six table requests and both RPC execution probes must be denied with PostgreSQL code `42501`. No user session is created. This does not test authenticated ownership, positive persistence or user isolation.

## Two ordinary user contexts

Use your own interactive terminal, not chat. The public URL must match the exact project reference. The helper rejects privileged keys and validates two distinct ordinary password-issued JWT identities through Auth `getUser()`.

```sh
node scripts/check-hosted-history-access.mjs \
  --project-ref ilgoswfckkzpoktabbfi \
  --report /private/tmp/edgelab-history-access-20261104.json
```

Enter each test email at its visible prompt (`@example.invalid` is supported) and its private password at the hidden prompt. No credentials are accepted through flags/files or saved in the report. The existing secure terminal helper is shared with the earlier harness, but the earlier write harness is **not** executed or replayed.

Default authenticated probes load each user's own historical workspace, reject mismatched/null expected owners, inspect both cross-owner directions across six tables, call the read-only deployed validators with honestly synthetic source objects, and compare final snapshots/revisions with the initial state. Anonymous table/RPC restrictions are checked as well. No authenticated save RPC is attempted by default.

If both historical contexts are empty and you explicitly authorize expected-failure save probes, use a new report filename and add:

```sh
--confirm-negative-writes
```

These additional probes must reject wrong expected owners and a synthetic batch, then leave both historical snapshots/revisions unchanged. Both histories must start at revision zero with no batches, records, results, notifications or audits. If either is nonempty, all authenticated save probes are skipped and recorded as skipped; existing history is not cleared. An unexpected success stops the run and requests inspection; the harness never deletes or automatically repairs anything.

A successful read against empty related tables is reported as **empty-state evidence**, not proof that another user cannot read a populated paper/notification lifecycle. Normal sign-in/out updates Auth sessions, but creates/deletes no users. The tests do not access bookmaker credentials or place wagers.

## Reports and limitations

Choose a new writable report path. It is reserved with exclusive creation and mode `0600` before authentication, so prior reports are never overwritten. Results contain project reference, check names, limited scope notes, counts and pass/fail/skip state. Emails, passwords, JWTs, user UUIDs and source/record contents are omitted. Controlled failures avoid printing raw API bodies; completed checks remain in a partial report if a later check fails.

After the command finishes, supply only the sanitized report for review. Do not paste credentials or screenshots of terminal secrets. Preserve both users and all pre-existing records. A completed report proves only its executed checks; it does not imply hosted email delivery, positive source imports, paper settlement, notification persistence, concurrent load behavior, or live odds integration.

## Local harness validation

`tests/hosted-history-verifier.test.ts` runs entirely against in-memory mocked client responses. It checks empty-history guards, immutable synthetic classification/hash, default no-save behavior, optional rejected saves, nonempty skip behavior, unexpected-success stopping, cross-owner failure handling, distinct identities and anonymous permission handling. It sends no network requests. The existing hosted-input tests still validate the shared prompt/email helper.

```sh
npx vitest run tests/hosted-history-verifier.test.ts tests/hosted-access-input.test.ts
```
