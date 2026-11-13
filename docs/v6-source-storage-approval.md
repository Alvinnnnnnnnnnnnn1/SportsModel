# Approval S — corrected source-only schema, 13 November 2026

> **Subsequent correction:** the owner separately approved exact ACL03; it deployed13 November04:10:23Z and passed hosted ACL/catalog/anonymous acceptance. Source remains empty and unprovisioned. [Current evidence and remaining limits](v6-source-acl-deployment.md). The earlier checkpoint below is preserved.

> **Subsequent deployment:** fresh schema-only approval was received and exact source02 applied on13 November at03:41:49Z. Hosted acceptance stopped on an RPC ACL discrepancy; no additional SQL/provisioning was applied. [Actual deployment and proposed unapproved correction](v6-approval-s-deployment.md). The pre-deployment evidence below is retained as its dated checkpoint.

**FINAL PRE-DEPLOYMENT CHECKS PASSED; FRESH APPROVAL REQUIRED; NOT DEPLOYED.** The owner gave conditional schema approval, then required a Docker-free backup route and a fresh decision after verification. The application backup/isolated native restore,22 native migration checks,18 remote checks and exact single-file dry-run now pass. [Full evidence and precise backup scope](v6-approval-s-final-checks.md). This does not authorise data upload, credentials, cloud scheduling, Mac handover, Production release or PAPER A/B/C.

## Exact approval target

| Item | Value |
| --- | --- |
| Supabase project | `ilgoswfckkzpoktabbfi` |
| Corrected proposal | `supabase/proposals/202611130002_v6_source_cloud_compatible.sql` |
| **New complete SHA-256** | **`0b80c5a2412c7a3d10348a75823ae4ad6696e552a29ddc73ccc755108b026a59`** |
| Original source file | `202611130001_v6_source_cloud.sql`, unchanged `7a03d765f78b5c1939900d1ddb50809238987104e5399ed772cb900692caf451`; never apply as a prerequisite |
| Original PAPER proposal | Unchanged/unapplied `c3a0d368ddbda1b50f3dab13aeec7cb3a939e423bce894aa1d55cfe9f13a3dff`; excluded from S |

Deploy **only the corrected replacement**, after approval; never both source files. Neither is in `supabase/migrations` yet. The [complete original/revised diff](v6-source-sql-compatibility.diff) is retained alongside both full SQL files. No original function signatures, source counters, models, financial rules or qualification criteria changed.

## Cause and targeted correction

The non-superuser migration role must be able to SET ROLE to the new function owner, and that owner needs schema CREATE at ownership transfer. PostgreSQL 17's automatic creator ADMIN grant supplies neither runtime SET nor INHERIT. Earlier superuser-only DDL checks bypassed the requirement. [ALTER FUNCTION](https://www.postgresql.org/docs/17/sql-alterfunction.html), [role grants](https://www.postgresql.org/docs/17/sql-grant.html).

The new transaction uses `SET LOCAL createrole_self_grant='set'`, temporarily grants public-schema CREATE to the restricted source role, transfers both definer functions, then revokes CREATE and the temporary creator SET membership **before COMMIT**. A final catalog assertion aborts if effective CREATE, SET/INHERIT memberships or membership of the source role in another role remain. The setting restores automatically at transaction end. No API role receives source-role membership.

PostgreSQL retains a bootstrap-issued **ADMIN-only** grant to the privileged role that created the source role; its SET and INHERIT flags are false. This standard creator-administration record is explicit, tested and not described as zero memberships. Removing it as a non-superuser would require authority over the bootstrap grantor. It grants the source worker no administrative role and cannot itself be used to SET ROLE. The database administrator can still administer the role, as expected; no such credential is given to a worker.

Actual hosted ACL inspection revealed a second dependency: postgres has Auth schema USAGE but cannot delegate it or `auth.uid()` EXECUTE. PUBLIC already has EXECUTE on `auth.uid()`. Rather than widening Auth privileges, the corrected SQL adds **`v6_source_auth_uid()`**, a SECURITY INVOKER, fixed-empty-search-path SQL-standard `RETURN auth.uid()` helper. PostgreSQL binds its Auth function dependency at creation time. The two existing definer functions call that helper; the source role needs no Auth-schema USAGE. It still returns the actual session's `auth.uid()`, not a supplied owner ID or replacement JWT interpretation. Missing upstream EXECUTE permission aborts the transaction. The Auth schema and its function ACLs are not changed.

## Final catalog and security boundaries

- Same seven source-only tables, all forced RLS; same 13 table policies plus one narrow existing-history-anchor SELECT policy; same three immutable triggers and three explicit supporting indexes.
- **Five functions:** two SECURITY DEFINER RPCs owned by `edgelab_v6_source`; the Auth bridge and two existing helpers are SECURITY INVOKER, owned by the migration role. Every function fixes an empty search path. The Auth bridge has a catalog dependency on the real `auth.uid()` and is not executable by ordinary anon/authenticated callers.
- Source role stays NOLOGIN/NOSUPERUSER/NOBYPASSRLS/NOCREATEDB/NOCREATEROLE/NOINHERIT. Final public CREATE=false, Auth schema USAGE=false in the representative ACL fixture, no membership in any other role. No source-role membership for authenticated/anon/authenticator; creator has only the ADMIN-only record described above.
- Runtime source permissions remain public-schema USAGE; source-table SELECT/INSERT/UPDATE; audit-sequence USAGE/SELECT; helper EXECUTE; and RLS-filtered historical anchor SELECT. No source DELETE or V5/core financial RPC access. No registration or settlement action exists in dispatch.
- Owners can directly SELECT only their own rows in six tables. Capability hashes have no owner/anonymous direct SELECT. The owner/dispatch responses do not expose them. Source-role internal policies deliberately span source rows; inaccessible role membership and explicit owner/capability binding are essential controls.
- Existing platform `service_role` default privileges remain administrative access. This is not a service-role isolation claim. No service key or signer was used or issued.

## Actual PostgreSQL evidence

Tests execute the corrected file as **non-superuser CREATEROLE / NOBYPASSRLS** with representative Supabase default ACLs, separate Auth owner, Auth USAGE without grant option, and existing PUBLIC Auth UID EXECUTE. All three deployed legacy migrations are also exercised together with an existing synthetic historical workspace. No hosted test records were inserted.

Passed actual SQL assertions cover fresh creation; final owners/attributes/ACLs/dependencies; no residual CREATE/SET/INHERIT; normal-owner reads; every readable table's cross-owner isolation; all seven tables' anonymous rejection; owner/capability gates; token format, expiry and revocation; private capability hashes; immutable objects/manifests/audits; exact bytes and nullable source facts; quota replay/rollback and lease fencing; forbidden PAPER state and unsupported register/settle calls; and no legacy data changes. A CHECK assertion on audit writes proves the owner RPC executes with the restricted role. Capability dispatch succeeds where the anonymous caller lacks table privileges, with catalog ownership also checked.

An injected late exception **after ownership transfer and temporary-privilege cleanup, before COMMIT** rolls back every new function/table/index/sequence/role, the source-anchor policy, schema ACL changes and creator membership. Existing legacy data/policies remain byte-for-byte equal in the SQL snapshots. A missing Auth dependency also aborts cleanly. This is transaction rollback, not a destructive backout.

Current verification: **752/752 tests across 67 files**, including four source SQL lifecycle/migration groups and three retention tests; **70 core +77 historical SQL checks**, **11 full-schema coexistence checks**, TypeScript, lint, production build and private-file safety checks pass. The original six-assertion failure reproducer remains unchanged. Private reports live under `.local/v6/approval-s-20261113/`. `first-sql-audit.json` preserves one corrected test-harness escaping error; `corrected-sql-audit.json` and `full-tests.json` retain successful reruns. It was not a SQL migration failure. Original hosted Preview evidence is untouched.

These are local PostgreSQL assertions, not hosted deployment, production concurrency-load or hosted two-user source persistence proof. True simultaneous independent hosted sessions, platform DDL hooks, PostgREST schema-cache refresh and hosted source reads remain post-approval acceptance items. Existing local cross-process scheduler/lease tests do not remove that gap.

## Remote preflight, backup and backout gate

Read-only catalog/history checks on 13 November confirm project identity, PostgreSQL17.11, the three original deployed migrations only, no source/PAPER role or tables, approximately13.34MiB database, empty `createrole_self_grant`, required builtin UUID/SHA functions, existing anchor composite key/RLS and the observed Auth ACL dependency. The CLI inspection role has BYPASSRLS: this establishes catalogs only, never user isolation. No hosted DDL was attempted.

Before approved deployment: recheck current schema/data fingerprints, exact file hash, project, migration role permissions, Auth dependency, collision checks and pending list. The verified application backup/restore is retained privately; its scope excludes full managed Auth/Storage recovery and is adequate for this additive application-only change as explained in the final-checks record. Refresh if intervening changes make it stale. Do not print/store passwords in source or rely on a paid backup product.

After explicit S approval and prerequisites, stage only this corrected file as migration202611130002, inspect remote history and show `db push --dry-run --remote` containing only that file, no seed/vault/role synchronization. Apply only that reviewed transaction. Any unexpected collision/permission/history error stops deployment. Do not stage the original source or PAPER proposals, use reset/include-all, silently repair migration history or create a role membership workaround.

If deployment fails before COMMIT, rollback and inspect catalogs/history. If committed, back out operationally: keep cloud disabled, issue no capability and preserve the Mac and all evidence. Do not DROP/CASCADE/delete tables or source objects. Separately review any future access-revocation rollback SQL. Uploading objects and publishing a snapshot are separate transactions; a failed later publication may leave private unreferenced objects and is not whole-bundle rollback.

## Reverified retention and stopped provisioning preview

The original private bundle remains untouched at `.local/v6/cloud-transfer/2026-11-12T21-40-02.656Z/`. Actual bytes still match original snapshot `a1d71651211ede1410903fe28f23b0240aded2b8e9262853bb7f797899e2b355` and inventory `8416185b74103ad9f3cc3d67c13dee2f9288bd94b0900ddd50fb96c9119e8f8f`; all objects were integrity-checked.

Source terms were re-read on13November. [The Odds API terms](https://the-odds-api.com/terms-and-conditions.html) explicitly permit storage/retention and derived research, excluding standalone raw-data resale. [BALLDONTLIE terms](https://www.balldontlie.io/terms.html), updated20October2026, permit copying/storing/archiving lawfully obtained data and app/model use, with substitute-feed restrictions and reserved third-party rights; independent result verification remains required. [API-Sports terms](https://api-sports.io/terms) allow project uses but disclaim publication/competition rights; this review does not establish the needed cloud retention rights for those archived raw records. No new source API call was made.

Offline filtering recursively inspects arrays/nested providers, fails closed for unknown sources and unresolved parent provenance, and propagates exclusions through known hash/reference dependencies. This fixes the old inventory's shallow classification of the mixed canonical game array without altering that old file. No raw bytes or original hashes are rewritten.

**New private preview:** `.local/v6/cloud-transfer/retention-2026-11-12T22-49-24.840Z/`.

| Binding | Exact SHA-256 |
| --- | --- |
| Filtered snapshot | `61a5c9ca052cc2898b5210194ff27ed4d1ee9b911d526d11e71fa3896b932876` |
| Filtered inventory | `3a5bc03897056ebb93af3f5330f94f22b9ee9efd82d767243513d22ff0d32357` |
| Retention review | `c81b224bca56420219dc6786226b3cca89504e83a3f756718896e40bff48114a` |

103 references/distinct objects, **3,101,754 raw bytes (~2.96MiB)**, proposed for private retention; **71 files withheld locally**. Included:83 BDL receipts,17 Odds API receipts and3 internal protocol/quota files. Withheld: API-NBA/API-Basketball, TheSportsDB, mixed-provider histories, unresolved derived records and permitted-provider records linked to withheld evidence. Per-file reasons remain in private `retention-review.json`; no private archive is committed to Git.

**Functional impact:** the mixed5,082-game journal/canonical snapshot, original frozen model artifact and dependent analyses are not in the cloud preview. They remain unchanged locally. This filtered bundle cannot support the full forecasting runner or all model/observation views. Cloud host transfer is therefore **not technically ready for activation**. Resolve the relevant retention provenance/permissions in a separately reviewed package, without replacing the frozen model or silently relabelling its training history. The Mac remains the approved collector.

The filtered bundle passes offline provision validation; a future apply must bind its new proposal/snapshot/inventory/**retentionReviewHash** and explicit owner rights review. Old unfiltered bundles cannot enter the write path without a filtered review. Owner-JWT/anchor checks, stopped-only bootstrap, object hashes, revision CAS, read-after-write and new-session persistence tests remain the provisioning plan. No owner session file/credential, upload or quota seeding was created/performed.

Free-tier capacity: inspection saw13.34MiB existing database; filtered bodies add2.96MiB before indexes/TOAST/WAL and future revisions. Supabase Free's published500MB database/5GB uncached egress must be rechecked against actual project usage. The16MiB object/96MiB aggregate guards remain unchanged. This estimate is not proof of billed footprint, egress or available capacity. [Supabase pricing](https://supabase.com/pricing).

## Separate hosted acceptance and approvals

S authorises schema only. Provisioning needs its own exact reviewed inventory, rights decision and stopped owner approval. Then verify exact read-after-write/new-session hashes, owner/other/anonymous access, immutable rejection, stale revision rollback, private capability hashes, no V5/funding/PAPER changes and no provider reads. Hosted second-owner/expired-session/sports-POST Preview tests remain unverified; none is claimed passed here.

Mac config/receipt/model/dataset and quotas remain frozen. First capture remains14November19:00 Melbourne;14November00:00→28November00:00 window,50 additional/cumulative60 odds credits,100 reserve. Cloud Actions stays disabled; no credentials or host transfer. No new Preview deployment is needed: changes are SQL proposals, offline planning/provisioning tools, tests and docs, with no dashboard runtime behavior change.

**Exact owner decision requested:** Approve schema-only deployment of `202611130002_v6_source_cloud_compatible.sql`, SHA-256 `0b80c5a2412c7a3d10348a75823ae4ad6696e552a29ddc73ccc755108b026a59`, to `ilgoswfckkzpoktabbfi`, after the documented backup and final preflight. This excludes data upload/provisioning, credentials, cloud activation, Mac transfer, Production release and PAPER A/B/C. Do not apply until explicit approval is received.

<details>
<summary>Original pre-correction review — preserved historical evidence</summary>

# Approval S — original source storage review

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

</details>
