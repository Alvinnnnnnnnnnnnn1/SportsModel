# Source RPC ACL correction deployed — 13 November 2026

**The separately approved migration03 is deployed and its hosted ACL/catalog acceptance passed. The source workspace remains empty and unprovisioned; cloud and PAPER activation remain disabled.** This closes the specific permissions blocker found after migration02. It does not establish positive hosted source persistence or two-user source RLS acceptance.

## Approval and exact execution

- Owner reply to `call_61f84ed781604eadb139a766a33df4b9`: **“Approve ACL correction only.”** Receipt recorded at `2026-11-13T04:05:52.456Z`. An owner-click timestamp was not supplied and is not invented.
- Project **Sports Model / `ilgoswfckkzpoktabbfi` / Production**.
- Applied only `202611130003_v6_source_rpc_acl.sql`, SHA-256 **`f694b79c7ab64997bbfea0615687232fd56ff623d0784d3b919e4cb2a87ac184`**.
- Actual deployment completed at `2026-11-13T04:10:23.631Z`, **15:10:23 Australia/Melbourne**.
- The isolated dry-run and actual push both listed only03, with no seeds or role synchronization. No superseded source01 or PAPER migration was applied. No retries, privilege workaround or migration-history repair occurred.
- The exact deployed bytes now appear in `supabase/migrations/` and remain unchanged in `supabase/proposals/`. Remote history is exactly `202611030001`, `202611030002`, `202611040001`, `202611130002`, `202611130003`.

## Current backup and preflight

The previously verified application backup/archive/native restore remains intact; archive SHA-256 `9fcb723b14643493e0b4fe6475569f070f845f18803426b49d85dab416817f27`. All20 existing application table counts/content fingerprints still matched the backup. The four-version pre03 migration history matched the preceding deployment receipt. Every source table was empty. The complete source catalog, RPC ACLs, anchor grant, event/default-grant metadata and memberships exactly matched the reviewed pre-correction receipts. Current source function-definition hashes and ACLs were retained privately before execution.

The application restore plus exact deployed source02 SQL, current empty-source catalog/ACL snapshot and native correction/rollback evidence cover this narrowly scoped ACL-only operation; no full backup was repeated. This remains **application-level recovery evidence**, not full managed Auth/Storage recovery. The correction alters no rows or function bodies.

The initial checker incorrectly assumed postgres itself was NOINHERIT. It stopped without deployment. The actual executor is non-superuser CREATEROLE **INHERIT** postgres, while its source-role membership has **INHERIT=false and SET=false**. This was an overly restrictive checker assumption, not evidence that the remote role changed. The relevant restriction is effective membership: the executor does not inherit the source owner's privileges. The unchanged SQL was then tested against those exact attributes before the final successful preflight.

**18/18 additional native PostgreSQL17.12 checks passed** with the actual INHERIT executor plus noninheriting membership. They reproduced the broad owner/PUBLIC ACL, proved correction and injected late-failure rollback, verified no temporary SET/INHERIT/CREATE remained, and preserved all function definitions and21 restored table fingerprints. The previous18 native NOINHERIT checks remain a separate stricter fixture, not a claim about the actual hosted role's rolinherit attribute. The disposable server used explicit TCP-disabled/private socket0700 flags, was stopped after tests, and tooling was unmounted.

## Hosted verification

**25/25 read-only catalog/privilege checks passed:**

- Only three ACL entries were removed: PUBLIC EXECUTE on owner/dispatcher and anon EXECUTE on owner control. Every other grant is unchanged.
- Authenticated owner control and anon/authenticated capability-bound dispatch retain their intended permissions. An anonymous EXECUTE grant on dispatch is deliberate; its Auth/capability guard is still required.
- All five source function definitions are byte-for-byte identical by SHA-256. Owners, fixed search paths, Auth UID binding, all7 forced-RLS tables,13 source policies plus anchor policy,34 constraints,13 indexes and3 immutable triggers are unchanged.
- Source role remains NOLOGIN/NOSUPERUSER/NOBYPASSRLS/NOCREATEDB/NOCREATEROLE/NOINHERIT/NOREPLICATION, with no schema CREATE/Auth USAGE, other role membership or V5 save/financial capability. The creator has only the documented ADMIN-only/no-SET/no-INHERIT membership.
- All20 existing public table counts and full-content fingerprints are unchanged. The hosted V5 catalog verifier reports zero differences, including46 function bodies,182 constraints,68 indexes,42 triggers and21 policies (including the approved anchor addition).
- All7 source tables remain empty: no upload, pilot, quota seed, snapshot, capability, lease, audit entry or activation.

**10/10 genuine anonymous HTTP checks passed**, using only the public publishable key:

- Seven table reads:401 /SQLSTATE42501.
- Owner RPC:401 /42501 at its function ACL, before entering its body.
- Dispatcher without capability/session:400 /P0001 “Authentication required”.
- Auth UID helper RPC:401 /42501.

Administrative catalog inspection is not represented as ordinary-user RLS testing. **Positive authenticated source read/write persistence and hosted two-account source isolation remain untested** because no provisioning, source upload, capability issuance or normal-user write session was authorised. Prior V5/Preview evidence remains separately documented.

## Local replay and application checks

The optional disposable PostgreSQL test loader now replays all five migrations. For03 it uses a temporary non-superuser DDL actor because `pg_has_role` returns true for a superuser independently of membership; running this cleanup assertion as a superuser cannot represent the hosted executor. This actor is administrative test infrastructure, not an ordinary-user RLS context or a worker. Its grants/role are removed after exact SQL replay. No app runtime dependency or package was added. Dedicated proposal/rollback fixtures still run their intended pre-source baseline explicitly.

Final rerun: **754/754 tests in68 files** with embedded SQL enabled;70 core +77 history SQL checks;15 source/PAPER-coexistence checks;10 catalog drift groups; TypeScript, lint and production build passed. Five offline safety groups passed, including private bundle/trace exclusion and disabled cloud CLI. Existing41 mocked browser groups passed in the preceding schema deployment session; they were not repeated for this ACL/test-loader-only correction. No Vercel deployment or app runtime change is part of this correction.

## Preserved boundaries and next task

Private approval/preflight/before-after/native/HTTP receipts are under `.local/v6/approval-s-acl-deployment/approved-2026-11-13T04-05-52.456Z/`. No private rows, passwords, keys, capability values or database connection strings are committed.

Next is separately reviewed **stopped source provisioning and normal-owner/two-user persistence acceptance**, using the retained rights-filtered inventory. The103-file bundle still withholds71 source/model dependencies; full cloud forecasting handover is not ready. No provisioning approval is inferred here. Cloud credentials/activation, Mac transfer, Vercel releases, PAPER A/B/C, financial registration and external messaging remain excluded. Preserve the existing Mac source pilot and global quota; do not run two workers.

Backout requires a new reviewed action. Do not drop source tables, restore over Production, reapply02 or repair migration history. Reinstating the old ACL would reopen the finding; keep the corrected empty source state and workers disabled while investigating any later issue.
