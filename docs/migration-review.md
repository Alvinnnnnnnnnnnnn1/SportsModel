# EdgeLab remote migration approval review

Reviewed on 3 November 2026. Target: **Sports Model**, production project **`ilgoswfckkzpoktabbfi`**. No migrations or application records were changed during this review.

## Verified remote state

- Linked `supabase/.temp/project-ref` matches the requested project.
- CLI remote migration listing has no applied versions. A subsequent SELECT-only, read-only catalog query confirmed that the migration-history table does not yet exist.
- PostgreSQL version is **17.11**; `auth.users`, `anon`, and `authenticated` already exist.
- The public schema has no tables/views/materialized views/foreign tables, no indexes, and no `edgelab_*` functions. No corresponding object conflicts were detected.
- `pgcrypto` version 1.3 already exists in the `extensions` schema. The initial migration leaves it installed there.

## Actual dry-run result

Executed `npx supabase db push --dry-run --remote --skip-vault --agent no --output-format text`. Vault synchronization was excluded. The CLI returned exit 0 and explicitly stated that migrations would not be pushed.

```text
Would push these migrations:
 • 202611030001_edgelab.sql
 • 202611030002_harden_workspace_integrity.sql
```

The dry-run lists pending files; it does not execute their SQL or prove hosted RLS behavior.

## Initial schema migration

`202611030001_edgelab.sql` creates the following 14 user-owned tables, with UUID keys, ownership foreign keys, timestamps, financial/probability constraints, and ownership RLS:

- `user_profiles`
- `experiment_settings`
- `sports`
- `events`
- `model_versions`
- `research_candidates`
- `bets`
- `bet_legs`
- `financial_transactions`
- `paper_predictions`
- `odds_snapshots`
- `notifications`
- `research_runs`
- `audit_history`

It creates 14 ownership policies, 11 explicit query indexes plus primary/unique-constraint indexes, six functions and eight triggers. Monetary values use NUMERIC; app payloads use integer AUD cents. Anonymous table access is revoked, authenticated users receive SELECT/INSERT/UPDATE but no DELETE, and the two workspace RPCs are executable only by authenticated callers. RPCs use SECURITY INVOKER and verify auth.uid().

Explicit query indexes:

- `bets_owner_date` on `bets`
- `bets_owner_outcome` on `bets`
- `legs_owner_bet` on `bet_legs`
- `events_owner_sport` on `events`
- `candidates_owner_date` on `research_candidates`
- `papers_owner_outcome` on `paper_predictions`
- `transactions_owner_date` on `financial_transactions`
- `notifications_owner_date` on `notifications`
- `runs_owner_date` on `research_runs`
- `audit_owner_entity` on `audit_history`
- `snapshots_owner_date` on `odds_snapshots`

Functions:

- `edgelab_valid_private_provenance`
- `edgelab_deny_rewrite`
- `edgelab_guard_prediction`
- `edgelab_audit_bet`
- `edgelab_load_workspace`
- `edgelab_save_workspace`

Triggers protect immutable candidates, transactions, odds, models and audits; preserve paper/forecast snapshots; and append server-side bet edit audits. The migration does not call the save RPC or insert user/fixture records.

## Integrity hardening migration

`202611030002_harden_workspace_integrity.sql` creates no tables or indexes. It adds 18 functions, replaces two existing function definitions, adds nine NOT VALID CHECK constraints, and adds 16 triggers.

New functions:

- `edgelab_valid_json_text`
- `edgelab_valid_json_uuid`
- `edgelab_valid_json_timestamp`
- `edgelab_valid_json_cents`
- `edgelab_valid_json_odds`
- `edgelab_valid_json_probability`
- `edgelab_valid_leg_snapshot`
- `edgelab_valid_bet_snapshot`
- `edgelab_valid_candidate_snapshot`
- `edgelab_valid_paper_snapshot`
- `edgelab_valid_transaction_snapshot`
- `edgelab_valid_notification_snapshot`
- `edgelab_valid_run_snapshot`
- `edgelab_valid_audit_snapshot`
- `edgelab_guard_leg_identity`
- `edgelab_check_leg_projection`
- `edgelab_guard_settings_revision`
- `edgelab_bump_direct_revision`

Replaced functions:

- `edgelab_valid_private_provenance`
- `edgelab_save_workspace`

New constraints:

- `edgelab_settings_currency_precision` on `experiment_settings`
- `edgelab_bet_snapshot_valid` on `bets`
- `edgelab_leg_snapshot_valid` on `bet_legs`
- `edgelab_candidate_snapshot_valid` on `research_candidates`
- `edgelab_paper_snapshot_valid` on `paper_predictions`
- `edgelab_transaction_snapshot_valid` on `financial_transactions`
- `edgelab_notification_snapshot_valid` on `notifications`
- `edgelab_run_snapshot_valid` on `research_runs`
- `edgelab_audit_snapshot_valid` on `audit_history`

New triggers preserve leg identity/parent ownership, check normalized active leg projections at commit, guard settings revisions and advance workspace revisions for direct authenticated writes on 12 supporting tables. The replacement save RPC validates snapshot types/precision/outcomes, coordinates exactly one revision per atomic save, and retains SECURITY INVOKER. Validation-helper execution is restricted to authenticated callers. No existing RLS policy is weakened.

## Safety and compatibility findings

- No DROP, TRUNCATE, DELETE, or top-level application-row UPDATE/INSERT statements occur. DML inside function definitions runs only when those functions are later invoked. No seed is pushed.
- Initial CREATE statements are intentionally non-idempotent. Do not replay them over manually created same-named objects or repair migration history blindly. The current read-only catalog check found no corresponding public objects.
- The nine NOT VALID checks apply to new/changed rows while preserving historical rows without scanning or certifying them. Future edits of invalid historical snapshots would fail until reviewed. The current target has no application tables yet.
- Foreign keys from auth.users use ON DELETE CASCADE. Applying the migrations deletes nothing, but future administrative deletion of an Auth user would remove that user's application records. Normal app users have no table DELETE permission.
- DDL takes schema locks. Each SQL file has its own transaction; the two-file deployment is not one all-or-nothing transaction. If the second fails, the first may already be committed and recorded.
- No critical cross-account RLS leak was identified in source review. All 70 embedded PostgreSQL checks passed again, including ownership, anonymous/deletion rejection, immutable history, rollback, direct-write conflicts and preservation. Embedded authentication shims do not verify hosted JWT/Auth or simultaneous multi-connection behavior.
- The CLI will create its migration-history metadata and record the two versions on actual application. No billing, external provider, sports odds, AI, wager execution, or Auth Dashboard configuration changes are in these SQL files.

## Approval scope

Approval is requested only for applying these two exact files, in this order, to the confirmed project. Before actual application, recheck the target, pending list and file hashes. No resets, history repairs, seeds or additional pending files are authorized by this review.

| File | SHA-256 |
| --- | --- |
| `202611030001_edgelab.sql` | `550af08d2a33026e641103bda42444193723b701ed0152bff3ce344667a3d33b` |
| `202611030002_harden_workspace_integrity.sql` | `d90a2fc096dfed2bc8c0aeb38ae4ba7f86783afa86fb1e905e824affadf3fb21` |

After explicit approval and successful application, continue Auth, persistence and hosted RLS verification with dedicated test contexts and clearly labelled synthetic manual test records only. Do not import the demo workspace or relabel simulated research provenance as real; rejection of simulated research remains an expected security boundary. Existing user records must remain untouched.
