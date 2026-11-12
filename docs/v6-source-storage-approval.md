# Approval S — independent source storage review

**Decision status: NOT READY TO APPLY AS WRITTEN. No approval requested for the failing file.** The Preview is deployed separately; source schema, provisioning, credentials and host transfer remain unapproved. No hosted changes were made during this review.

## Exact reviewed scope

- Project: `ilgoswfckkzpoktabbfi`.
- File: `supabase/proposals/202611130001_v6_source_cloud.sql`.
- Unchanged SHA-256: `7a03d765f78b5c1939900d1ddb50809238987104e5399ed772cb900692caf451`.
- Original PAPER proposal remains unchanged/unapplied, SHA `c3a0d368ddbda1b50f3dab13aeec7cb3a939e423bce894aa1d55cfe9f13a3dff`. Approval S does not include it or A/B/C.
- DDL is inside one transaction. No DROP/TRUNCATE/DELETE/reset, seed, legacy record rewrite, Storage bucket or paid feature is included. Control RPC definitions contain future source-state updates; merely deploying their definitions does not invoke them.

## DDL, RLS and grants

| New table | Function | Ordinary authenticated access |
| --- | --- | --- |
| `v6_source_pilots` | Owner/archive anchor, exact plan/receipt, stopped host, lease and revision | Own rows SELECT |
| `v6_source_objects` | Content-addressed JSON bytes | Own rows SELECT |
| `v6_source_snapshots` | Immutable manifest revisions and source bytes | Own rows SELECT |
| `v6_source_capabilities` | Expiring/revocable capability hashes | No direct SELECT or writes |
| `v6_source_quotas` | Shared counters, uncertainty and cooldown | Own rows SELECT |
| `v6_source_reservations` | Replay-safe provider reservations/completions | Own rows SELECT |
| `v6_source_audit` | Append-only source actions | Own rows SELECT |

All seven enable **and force RLS**. There are 13 new-table policies: six `user_id=auth.uid()` owner SELECT policies and seven internal-role policies. No ordinary authenticated or anonymous table writes/deletes are granted. The internal role's policies use `true`; their safety depends on that role never being assumable by API roles and on the dispatcher's explicit owner/capability checks. Treat granting it to `anon`, `authenticated` or `authenticator` as a security failure.

New `edgelab_v6_source` is NOLOGIN, NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOINHERIT, NOBYPASSRLS. It receives SELECT/INSERT/UPDATE on source tables, audit-sequence USAGE/SELECT, schema USAGE and `auth.uid()` EXECUTE. It has no V5 financial write grant. The sole existing-table change is SELECT on `historical_import_batches` plus `v6_source_anchor`, restricted to `user_id=auth.uid()` for this internal role. No existing policy is replaced.

Four functions:

- `v6_source_owner`: SECURITY DEFINER, fixed empty search path, owned by the source role. Authenticated only. It derives owner from `auth.uid()` and verifies the existing owner anchor for provisioning. Future issue/revoke/stop/transfer/seed actions are separate owner operations, not migration side effects.
- `v6_source_dispatch`: SECURITY DEFINER, fixed empty search path, same role. Callable by anon/authenticated **only as an entry point**: null capability requires normal owner identity and stopped-bootstrap limits; non-null capability is hashed, pilot-bound, expiry/revocation checked and resolved to the stored owner before access. A public EXECUTE grant is not public evidence access.
- `v6_source_immutable`: SECURITY INVOKER trigger helper; three triggers reject updates/deletes on objects, manifests and audits.
- `v6_source_path_ok`: immutable SECURITY INVOKER allowlist helper. No arbitrary filesystem paths, environment files, personal workspaces or paper states may be published.

Three explicit indexes support latest snapshots, provider reservation rates and owner audit; primary/unique indexes enforce identities and replay constraints. Composite owner keys preserve cross-user foreign-key isolation. SHA checks bind actual retained bytes. Commit locks the pilot, checks expected revision, objects and retained paths, rejects evidence removal and PAPER state, and keeps the previous published snapshot after a failed commit. Uploading many objects and publishing one manifest are **not one database transaction**: interrupted provisioning may leave private unreferenced immutable objects; do not claim whole-bundle rollback or delete those objects automatically.

## Actual remote compatibility inspection — read only

`supabase/checks/v6_source_approval_s_read_only.sql` reads catalogs/capacity only. It was executed with `db query --remote --read-only`. Remote migration history still lists only `202611030001`, `202611030002`, `202611040001`. Source role/tables/functions and PAPER role are absent.

Observed PostgreSQL 17.11, existing database approximately **13.34 MiB** at inspection, owner-anchor composite key available, existing historical owner RLS enabled, and builtin UUID/SHA functions available. Public schema is owned by `pg_database_owner`; PUBLIC has USAGE, not CREATE. `createrole_self_grant` is empty. The database `postgres` role is **not a superuser**, has CREATEROLE/BYPASSRLS and schema CREATE. `auth.uid()` belongs to `supabase_auth_admin`; postgres lacks its EXECUTE grant option. A deployment amendment must verify that dependency's effective EXECUTE/USAGE without granting broader Auth privileges.

The CLI used `supabase_read_only_user`, which has BYPASSRLS. These queries establish **catalog metadata only**, never normal-user access or two-account RLS success.

Remote default public-table ACLs grant privileges to the platform's `service_role`. The proposal explicitly removes PUBLIC/anon/authenticated privileges but does not remove that administrative default. Do not claim that service-role credentials cannot access these tables. No such key is used by the app or worker; keep it absent from Vercel/GitHub worker settings and tests. Owner access must be proven with ordinary JWTs.

## Blocking ownership transfer

The original file transfers both definer functions to the new role without establishing the deployment role's SET ROLE permission or the new owner's schema CREATE permission. PostgreSQL requires **both** for a non-superuser ownership transfer. See [ALTER FUNCTION](https://www.postgresql.org/docs/17/sql-alterfunction.html) and [createrole_self_grant](https://www.postgresql.org/docs/17/runtime-config-client.html).

Existing local schema tests applied DDL as a superuser, so they did not detect this hosted compatibility problem. A new constrained-role reproducer runs the exact unchanged SQL with a non-superuser CREATEROLE migrator and even stronger prerequisite grants than observed remotely. It fails with:

```text
must be able to SET ROLE "edgelab_v6_source"
```

Rollback leaves zero source tables/role and preserves its synthetic legacy anchor. Reproduce locally with:

```sh
node scripts/check-v6-source-role-compatibility.mjs --runtime /private/tmp/edgelab-cloud-validation
```

Its six assertions pass by proving the expected rejection; `originalProposalReady=false`. This is not a successful deployment. No failing hosted DDL was attempted. **Next engineering step:** prepare a separate minimally amended proposal, review temporary ownership-transfer privileges and final role memberships, reproduce using constrained PostgreSQL roles/default ACLs, then record a new exact hash for independent Approval S. Do not overwrite the reviewed original, silently grant source-role membership to API roles, or use a service-role workaround.

## Exact retained source inventory — not uploaded

Private bundle: `.local/v6/cloud-transfer/2026-11-12T21-40-02.656Z/`.

- Manifest: `a1d71651211ede1410903fe28f23b0240aded2b8e9262853bb7f797899e2b355`.
- Per-file retention inventory: `8416185b74103ad9f3cc3d67c13dee2f9288bd94b0900ddd50fb96c9119e8f8f`.
- 174 manifest references, 172 distinct immutable objects, 37,701,100 bytes of distinct object bodies.
- Existing provider receipts, dataset/registries, frozen models/forecasts, reconciled observational results and operational journals; no V5 workspace, environment file, source key or worker capability. The detailed path/hash/byte inventory stays ignored/private for owner review.
- Offline integrity validation succeeded. Retaining source references does not itself establish publication/source rights. No data was uploaded, and the original local archive was not removed.

Provisioning this exact inventory needs separate explicit **storage-only** owner approval, with project/proposal/manifest/inventory hashes and source-rights review. Schema deployment alone does not approve upload, capability issuance, quota seeding, Mac stop, host transfer, worker scheduling or registration.

## Backup, capacity and staging prerequisites

Before any future approved DDL: retain the owner's complete experiment export and a securely obtained schema/data backup of existing application tables and migration history; test restoration on disposable local PostgreSQL. The experiment export alone is not a full database backup. No new database backup/restore was performed here. Do not print connection secrets or depend on a paid backup service.

Supabase Free's documented allowance is 500 MB database / 5 GB uncached egress; confirm the project's actual free plan and current usage before provisioning. Source bodies are limited to 16 MiB each and 96 MiB aggregate per pilot, **including older revisions/unreferenced uploads**. The retained bundle fits the raw-body guard, but indexes, JSONB manifests, TOAST/WAL, other owners/pilots and egress require headroom. Raw bytes are not a guarantee of database footprint or monthly egress. Use standard free GitHub runners only after separate host approval. [Supabase pricing](https://supabase.com/pricing).

After a compatible proposal is prepared and explicitly approved: stage only that exact proposal under the approved migration version, verify project/hash/history/backup, show a read-only dry-run containing only it, then apply that one transaction. Never copy the PAPER proposal into migrations or use reset/seed/include-all. Stop on any unexpected privilege, object collision or migration-history discrepancy.

## Backout and hosted acceptance — future authorised work

If DDL fails before commit, rollback the transaction and verify no partial source objects or migration entry; preserve existing data. Once committed, prefer a **non-destructive operational backout**: keep cloud enablement false, do not issue capabilities, retain the loaded Mac pilot and use unconnected/read-only UI. If later provisioning/activation has occurred, obtain explicit authority to stop/revoke source access; retain all evidence. No DROP/CASCADE, schema deletion or automatic migration-history repair is approved. Any grant-revocation backout SQL must be separately reviewed with its actual execution-role privileges.

After separately approved provisioning, use two **normal authenticated accounts** and anonymous access (no service key):

1. Owner reads only their seven-table projections; capability hashes remain inaccessible. Other account sees no owner rows and cannot invoke owner bootstrap/control for that pilot. Anonymous direct SELECT fails.
2. Owner provision/put/commit is stopped-only; read back exact bytes and hashes in a new browser session. Verify dashboard cloud projection and original prices/forecasts/timestamps; no synthetic/private fallback.
3. Reject direct writes/deletes, altered object hash, immutable edits, stale revision, duplicate/conflicting publication and cross-owner keys. Check that failed commit leaves the prior snapshot/revision/audit unchanged; separately account for any uploaded unreferenced objects.
4. Confirm zero PAPER/V5/funding mutations. Test capability expiry/revocation, fenced lease, quota reserve/ceiling, emergency stop and fresh-runner recovery using specifically authorised source fixtures or retained evidence, without initiating provider reads.
5. Only after those pass may a separately reviewed S/provisioning acceptance be recorded. Source-host transfer/credentials/scheduling and Production promotion remain independent decisions. The Mac remains the sole collector throughout this task.
