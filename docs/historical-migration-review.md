# Pending historical migration review — 4 November 2026

**Prepared and locally tested; NOT approved or deployed.** The user's earlier approval covered only `202611030001` and `202611030002`. No remote writes, seed, resets, account deletions or record deletions were performed during this development stage.

## Target and plan

Read-only CLI checks confirmed the linked reference `ilgoswfckkzpoktabbfi` (Sports Model, production). `npx supabase migration list --remote` lists the two earlier versions on both local and remote sides and `202611040001` locally only. `npx supabase db push --dry-run --remote --skip-vault` completed successfully and explicitly reported no migration would be pushed in dry-run mode. Its sole pending file was:

```text
202611040001_historical_import.sql
```

No seeds or role synchronizations were planned. The final reviewed local SHA-256 is:

```text
fa9c50ac7e4be61ec8eaa92e7e6c66a89c8d583b966843cd97cb64f97afef08a
```

The deployed files retain their previous exact hashes:

| File | SHA-256 |
| --- | --- |
| `202611030001_edgelab.sql` | `550af08d2a33026e641103bda42444193723b701ed0152bff3ce344667a3d33b` |
| `202611030002_harden_workspace_integrity.sql` | `d90a2fc096dfed2bc8c0aeb38ae4ba7f86783afa86fb1e905e824affadf3fb21` |

If the pending file changes after this review or any unexpected migration appears in a later dry-run, review again before approval/deployment.

## What will be created

Six initially empty user-owned tables: `historical_workspace_revisions`, `historical_import_batches`, `historical_research_records`, `historical_paper_results`, `historical_notifications`, `historical_audit_history`. The total application table count would increase from 14 to 20.

Local catalog inspection found 6 owner RLS policies, 22 SECURITY INVOKER functions (two public history RPCs plus 20 helpers), 18 triggers including two deferred completeness triggers, 26 indexes, 22 CHECK constraints, 11 ownership/reference FKs, 6 primary keys and 9 UNIQUE constraints. Indexes include constraint-backed indexes plus a separate external-reference uniqueness index and lookups.

`edgelab_load_history(expected_owner_id)` and `edgelab_save_history(workspace, expected_revision, expected_owner_id)` are new authenticated RPCs. All 22 new functions explicitly revoke PUBLIC/anonymous execution and grant authenticated execution. All six tables have RLS; no authenticated DELETE privileges are granted. Both RPCs require an expected owner UUID and reject session-owner mismatch before reads/writes. Source/record/audit UPDATEs are forbidden. User-owned FKs and guards prevent cross-account references; source hashes, payload projections, summary counts, result legs and notification lifecycle state are checked. Direct writes generate audit entries and invalidate stale snapshots. RPC writes are atomic with a locked per-user revision.

## What will change in existing data

Nothing. The SQL creates new objects and their grants. It does not update/delete existing application rows, alter the earlier tables/policies, or seed history. It creates no Auth accounts and invokes no external services. Financial source records are archived separately; no migration writes bets, funding or payouts.

There are no `DROP`, `TRUNCATE`, reset, paid-service or live-provider operations. New names use the `historical_`/`edgelab_history_` namespace to avoid the deployed objects. The read-only dry-run found no migration-history conflict. Local execution against both earlier migrations succeeded. A CLI dry-run identifies pending versions; it does not execute the SQL against the hosted schema or prove the absence of manually created conflicting objects. Inspect those exact new namespaces immediately before approved deployment and stop on unexpected errors.

## Local security evidence and remaining limits

- 70 existing embedded PostgreSQL checks passed against all three local migrations.
- 77 new embedded history checks passed: source/nullability/projection constraints, duplicates, no ledger changes, immutability/deletion, paper/notification lifecycle, authenticated owner access, anonymous denial, non-empty two-user isolation, cross-owner references and stale-save rollback.
- 13 history repository tests passed; included in the complete unit suite.
- No service-role key was used to claim user-isolation results. Embedded tests use ordinary roles with an Auth UID shim; they do not test the hosted Auth gateway.

Pending deployment has **not** been verified in hosted PostgREST, including schema-cache refresh, hosted source/paper/notification round trips and non-empty two-user history access. Real email confirmation and long-duration hosted session refresh remain separate manual checks. Simultaneous transaction stress/load and fault injection remain untested.

## Approval boundary

Request explicit approval to apply **only** this exact migration to `ilgoswfckkzpoktabbfi`. After approval, recheck target, hash, history, new namespace conflicts and dry-run. Apply only the reviewed pending file with seeds disabled. Stop/report unexpected errors; never reset or repair existing data. Verify resulting remote history, catalog and normal-user access before claiming hosted historical persistence. Keep all existing test accounts/records.
