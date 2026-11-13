# Approval S deployment — 13 November 2026

**The approved schema deployed. Hosted security acceptance is blocked by an RPC ACL discrepancy. No corrective hosted SQL has been applied.** Source uploads, credentials, cloud scheduling, host transfer, Vercel releases and PAPER A/B/C remain unapproved.

## Actual deployment

- Project **Sports Model / `ilgoswfckkzpoktabbfi` / Production**.
- Fresh owner decision: “Approve this schema only”, replying to `call_28f1f1e7b1554f05bb3acf854434f240`. It was recorded at `2026-11-13T03:35:12.395Z`; the transport provides no owner-click timestamp, so none is invented.
- Deployed only `202611130002_v6_source_cloud_compatible.sql`, approved SHA-256 **`0b80c5a2412c7a3d10348a75823ae4ad6696e552a29ddc73ccc755108b026a59`**.
- Actual CLI completion `2026-11-13T03:41:49.184Z` / **14:41:49 Australia/Melbourne**.
- Remote migration history now contains exactly `202611030001`, `202611030002`, `202611040001`, `202611130002`. Superseded source01 and PAPER remain unapplied and byte-identical.
- The deployed file is now copied byte-for-byte into `supabase/migrations/`, preserving the reviewed proposal. Ordinary migration history must reflect the deployed version. Correction03 stays in proposals only.

The final hash/archive/manifest/currency checks passed. All21 pre-existing table fingerprints, including migration history, matched the verified application backup immediately before deployment. All18 remote compatibility checks and the isolated single-file dry-run passed. The real execution role was postgres / CREATEROLE / non-superuser. The metadata SELECT initially hit the CLI's agent-consent flag; the already approved `--yes` rerun succeeded. No permission bypass or migration-history repair was used.

The [verified backup and native restore](v6-approval-s-final-checks.md) remain application-scoped:20 public application tables plus migration history, with minimal local Auth UUID/function dependencies. Full managed Auth/Storage recovery is not claimed. The verified archive remains private under `.local/v6/backups/2026-11-12T23-25-43.359Z/`.

## Hosted evidence

| Check | Actual result |
| --- | --- |
| Source tables |7 exact tables; enabled and forced RLS |
| Policies |13 source policies,6 UID-bound owner SELECT +7 source-role internal policies; additional anchor SELECT policy |
| Functions |5 fixed-empty-search-path functions;2 SECURITY DEFINER RPCs owned by restricted source role |
| Constraints / indexes / immutable triggers |34 validated constraints /13 valid-ready indexes /3 enabled triggers |
| Restricted role |NOLOGIN, NOSUPERUSER, NOBYPASSRLS, NOCREATEDB, NOCREATEROLE, NOINHERIT, NOREPLICATION |
| Temporary permissions |No remaining public CREATE, Auth USAGE, creator SET/INHERIT or membership in other roles; documented bootstrap creator ADMIN-only record remains |
| Financial permissions |No source-role bets/funding INSERT or core/history save RPC EXECUTE |
| Direct API access |Anonymous SELECT denied on all7; authenticated read-only on6, no capability-hash access or direct writes/deletes |
| Existing anchor |Original historical owner policy retained; source anchor SELECT grant confirmed through catalog ACL and effective privilege |
| Auth dependency |SQL-bound real Auth UID dependency present; original Auth UID definition unchanged |
| Source records / activation |All7 tables empty; no pilot, snapshot, quota seed, credential, lease, audit record or activation |
| V5 preservation |All20 existing public table counts **and content fingerprints** unchanged; generated hosted catalog verifier passes with0 differences, including46 function bodies,182 constraints,68 indexes,42 triggers and21 policies (the reviewed new anchor policy included) |
| Anonymous HTTP tests |7 REST reads rejected with401/42501; owner and dispatcher RPCs rejected with400/P0001 “Authentication required” before mutation |
| Hosted normal-user positive writes / two-owner source RLS |Not tested; no provisioning/write approval or normal-user session used |

The inspection identity is administrative/read-only. Catalog checks are **not** substituted for normal-user RLS or positive persistence tests. `information_schema.role_table_grants` under that inspection identity omits grants for inaccessible roles; the anchor grant was therefore checked with `aclexplode` and `has_table_privilege`, rather than treating the omitted row as a missing grant.

## Acceptance blocker: owner-grantor revocation

Hosted ACLs retain PUBLIC EXECUTE on both definer RPCs and explicit anon EXECUTE on `v6_source_owner`, contrary to the reviewed owner-only endpoint boundary. Table permissions, user binding and the initial Auth guard are intact; anonymous HTTP calls demonstrably fail. This does **not** make the ACL mismatch acceptable or establish complete hosted acceptance.

The NOINHERIT executor can transfer ownership via temporary SET membership, but its subsequent unqualified REVOKE does not act with the new owner's inherited grant options. PostgreSQL can warn without aborting when a non-owner lacks those options. [PostgreSQL17 REVOKE notes](https://www.postgresql.org/docs/17/sql-revoke.html#SQL-REVOKE-NOTES).

The prior native22-check suite did not assert the owner-RPC ACL; the embedded migration fixture's executor implicitly had INHERIT, unlike the actual hosted executor. That gap is now reproduced using explicit NOINHERIT. The deployed approved file remains unchanged. No privileges were repaired remotely, no extra migration was run, and no data was provisioned after the finding.

## Proposed correction — NOT approved or deployed

File: [`202611130003_v6_source_rpc_acl.sql`](../supabase/proposals/202611130003_v6_source_rpc_acl.sql).

SHA-256: **`f694b79c7ab64997bbfea0615687232fd56ff623d0784d3b919e4cb2a87ac184`**.

This transaction requires the expected restricted role/RPC owners and empty source tables. It temporarily grants SET-only membership, explicitly assumes the actual owner/grantor, revokes PUBLIC from both RPCs and anon from owner control, retains authenticated owner control and anon/authenticated capability dispatch, restores the executor and removes temporary SET membership. Final assertions reject PUBLIC RPC access, anonymous owner access or residual runtime membership. It changes no function body, table, policy, source/financial row, model, quota or activation.

Local regression tests cover reproduction, exact ACL correction, ordinary anonymous rejection, authenticated Auth checks, cleanup and injected late-failure rollback. The correction remains outside normal migrations. A separate explicit owner decision plus current backup/hash/catalog preflight is required before any hosted correction. No approval is inferred from Approval S.

**Native correction evidence:**18/18 checks passed on the retained disposable PostgreSQL17.12 clone, running as real non-superuser NOINHERIT CREATEROLE postgres. It reproduced the hosted broad ACL, corrected it, verified anonymous ACL/Auth rejection, preserved all function bodies/owners and21 restored table fingerprints, and proved late-failure rollback restored the original ACL/membership. The first restart omitted the old command-line socket flags and listened on loopback; connection to the expected private socket failed before any test. It was stopped immediately and restarted with explicit `listen_addresses=''`, socket path/port and0700 flags. Existing pg_hba rejected IPv4/IPv6 host connections throughout. That failed attempt is retained separately. Successful native tests verified no TCP listener; afterward the cluster was stopped and tooling unmounted. This was local testing only, not a hosted correction.

Backout: do not drop the newly deployed schema, restore over Production or repair history. Preserve the empty disabled state and evidence. The ACL discrepancy requires a reviewed forward correction; reverting that correction would reintroduce the broader ACL and requires separate review.

## Evidence and next step

Private receipts: `.local/v6/approval-s-deployment/approved-2026-11-13T03-35-12.367Z/`, including actual approval/deployment result, catalog, privilege diagnostic, legacy fingerprints, nine anonymous HTTP checks and `deployment-acceptance.json`. No raw personal rows, passwords or source capability tokens are committed.

Review the exact ACL-only correction before requesting deployment. Even after correction, stopped provisioning and normal-owner/two-user source persistence acceptance require their own approval. The filtered103-file bundle has71 withheld source/model dependencies, so full cloud forecasting handover is still blocked. The Mac source-only pilot stays installed and unmodified; the cloud worker remains disabled.

## Application verification after deployment

- 754/754 Vitest tests in68 files, with the optional embedded PostgreSQL runtime enabled. The NOINHERIT fixture is explicit; dedicated pre-source migration/rollback tests intentionally start before source02, while normal integration tests apply all four deployed migrations.
- 70 core +77 historical SQL checks and12 deployed-schema/PAPER-proposal coexistence checks passed locally. This does not deploy or approve PAPER.
- 41 synthetic browser groups passed against a separate localhost production server:22 V5/demo,11 mocked Auth/form and8 mocked V6/cloud dashboard groups. External requests were intercepted; no real user session was used.
- TypeScript, lint and production build passed. Five offline safety groups passed: browser bundles/traces exclude private values/files, original source/PAPER/config/model-data hashes stay protected, cloud CLI remains disabled, and retained staging objects preserve hashes.
- Initial local test failures reflected three-file migration lists and PAPER-only object-count assertions after tracking the now-deployed fourth migration. Those harnesses were updated with exact lists or an explicit pre-source fixture; the complete rerun passed. No deployed SQL was edited to make tests pass.
- Mac source LaunchAgent remains loaded, not running between60-second ticks, last exit0. Odds reserved10 /used10 /remaining490; no additional provider requests. The separate test web server was stopped. No hosted normal-user source persistence, second-account source acceptance, cloud runner or new Vercel deployment is claimed.
