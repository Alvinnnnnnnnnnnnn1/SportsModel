# Approval S final checks — 13 November 2026

> **Subsequent correction:** the owner separately approved exact ACL03; it deployed13 November04:10:23Z and passed hosted ACL/catalog/anonymous acceptance. Source remains empty and unprovisioned. [Current evidence and remaining limits](v6-source-acl-deployment.md). The earlier checkpoint below is preserved.

> **Subsequent deployment:** fresh schema-only approval was received and exact source02 applied on13 November at03:41:49Z. Hosted acceptance stopped on an RPC ACL discrepancy; no additional SQL/provisioning was applied. [Actual deployment and proposed unapproved correction](v6-approval-s-deployment.md). The pre-deployment evidence below is retained as its dated checkpoint.

**All documented application-level pre-deployment checks passed. Fresh owner approval is required; no hosted migration was executed.** The earlier conditional approval did not override the backup gate. The owner subsequently requested final checks only and expressly excluded deployment.

## Exact decision target

- Project: `ilgoswfckkzpoktabbfi`, linked project name **Sports Model**, Production environment.
- Proposed file: `supabase/proposals/202611130002_v6_source_cloud_compatible.sql`.
- Reverified SHA-256: **`0b80c5a2412c7a3d10348a75823ae4ad6696e552a29ddc73ccc755108b026a59`**.
- This is the only proposed migration. Superseded source7a03… and PAPERc3a0… files remain unchanged, unapplied and excluded.
- No proposal was added to the repository's normal migration directory. An ignored isolated workdir contains the three unchanged deployed files plus this exact replacement, preventing an accidental ordinary root push before approval.

## Docker-free tooling and isolation

Homebrew and native PostgreSQL tools were absent. Current Homebrew PostgreSQL17 metadata did not offer an Intel Mac bottle, so no Homebrew installation/source build was introduced. The official **Postgres.app2.9.7 / PostgreSQL17.12-only** bundle supplied clients and a server without installing the GUI, login service or Docker. [Official downloads](https://postgresapp.com/downloads.html), [included CLI tools](https://postgresapp.com/documentation/cli-tools.html).

The119,766,608-byte DMG matched its official release SHA-256 `e1f45cf63f2dfc4120e9ef3caae7ffe70dade56d54b9f0e00235dce347f847c9`; deep code-signature verification passed and Gatekeeper accepted its Notarized Developer ID. The image was mounted read-only under `/private/tmp/edgelab-postgres17-tooling/`. No system PATH, package manager, existing service or production configuration was changed. A small PostgreSQL JS driver was installed only in `/private/tmp`, not package.json/package-lock.json.

The disposable native PostgreSQL17.12 cluster used a mode0700 temporary directory and private Unix socket with permissions0700. `listen_addresses=''` disabled TCP. A new empty database received the restore; a separate local clone received migration tests. Neither connection could target Supabase. The temporary cluster is stopped after verification; backup/restore artifacts are retained privately, not deleted. The approved Mac research LaunchAgent is separate and unchanged.

## Connection security and preserved failures

The CLI-generated direct host resolved only to IPv6 and did not connect. The existing linked **free shared session pooler on5432** supplied an IPv4-compatible route to the same project. No paid IPv4 add-on was used. The system CA store alone rejected the pooler's private chain; that failure was retained and TLS verification was never disabled.

The public production root CA was obtained through the certificate URL template in Supabase's official dashboard source (`apps/studio/hooks/custom-content/custom-content.json`), over verified HTTPS. Its subject/issuer is Supabase Root2021CA, CA/self-signature/validity checks passed, SHA-256 fingerprint `807025ad50d4ed219d2c9c7d299c004f824eb00cf7f65afef607d07b72e6cafa`. Node used certificate/hostname verification and pg_dump used `sslmode=verify-full` with this explicit CA. The system trust store and hosted SSL settings were untouched. [Supabase TLS guidance](https://supabase.com/docs/guides/platform/ssl-enforcement).

The existing secure CLI login supplied connection settings in process memory. Its generated shell text was parsed as literal assignments, never executed. No passwords, tokens or secret-bearing connection strings were printed, put in arguments or persisted in the backup artifacts. The backup session explicitly used a read-only repeatable-read transaction and an exported snapshot shared with native pg_dump. The configured existing owner/archive anchor matched the intended database before capture. Privileged administration was used for backup/catalog inspection, **not to claim ordinary-user hosted RLS success**.

The failed direct/TLS attempts remain as private gate reports under `.local/v6/backups/`; they never reached a successful application write. No dump was described as verified until the complete successful report existed.

## Verified backup and restore

Private directory: `.local/v6/backups/2026-11-12T23-25-43.359Z/`.

| Evidence | Result |
| --- | --- |
| Native custom-format archive | `application.dump`,366,171bytes |
| Archive SHA-256 | `9fcb723b14643493e0b4fe6475569f070f845f18803426b49d85dab416817f27` |
| Application tables | All20 `public` tables |
| Migration history | One `supabase_migrations` table; all three deployed versions |
| Record integrity | Every table's count and content fingerprint matched after restore |
| Schema integrity checked | Tables/columns, generated/default expressions, owners, ACLs, RLS policies, functions, constraints/validation flags, indexes and triggers matched |
| Schema manifest fingerprint | `90383386344a5c3ca4066c70d43404803d3bb4b0abf8f6c492de42326ac7da5a` |
| Record manifest fingerprint | `708872833024171c5672880e4570556a1e67c1bac6159ceb3c3c19b9593219ec` |
| Successful verification |16/16checks; PostgreSQL17.11 remote →17.12 native restore |
| Preservation after backup and final dry-run | All21 table fingerprints still equal the backup; no hosted source role/tables |
| Protection | Backup directory0700; all contained artifacts0600; excluded from Git |

The complete `verification.json`, archive TOC, before/restored schema manifests and row fingerprints are retained. Rechecking the archive hash, manifest comparisons and permissions after the interruption passed; the backup was not repeated.

**Scope:** this is a verified **application-scoped logical backup**, including V5 money/history/audits and migration history. Auth user UUIDs and the real Auth UID function definition were retained only as minimal local dependencies for foreign keys/RLS; local named roles were recreated conservatively. Auth password hashes, MFA, sessions, signing keys, full managed Auth schema, Storage metadata/blobs, platform extensions/services and production configuration were **not backed up or recovery-tested**. It is not a full Supabase project disaster-recovery guarantee. No real account was recreated or reset.

**Adequacy for this specific migration:** sufficient for the documented application-level gate. The exact reviewed additive SQL creates new source objects, makes no legacy DML/deletion, does not modify Auth/Storage, and changes only the historical-anchor SELECT grant/policy on an existing application table. The archive covers all affected pre-existing application objects/records and their recovery dependencies; both restored-data preservation and whole-transaction rollback were tested. This conclusion does not authorise destructive recovery, Auth changes or a future broader migration. If live schema/data fingerprints change before deployment, reassess currency and refresh the backup when needed.

## Native migration and rollback evidence

Private report: `.local/v6/approval-s-deployment/native-20261113/native-migration-compatibility.json`.

**22/22 checks passed on actual native PostgreSQL**, supplementing prior embedded tests:

- A separate clone of the restored database ran the exact SQL as non-superuser CREATEROLE postgres, with representative Auth permissions; the source role was absent initially.
- An injected late exception after ownership/cleanup, before COMMIT, removed every new role/relation/function and restored the public ACL/anchor policies. Every legacy row remained identical.
- Fresh unmodified SQL then succeeded: seven enabled/forced-RLS tables,13 source-table policies, five fixed-empty-path functions and two restricted SECURITY DEFINER owners.
- Final source role kept NOLOGIN/NOSUPERUSER/NOBYPASSRLS/NOCREATEDB/NOCREATEROLE/NOINHERIT. Effective schema CREATE=false; creator SET/INHERIT=false; no membership in another role. Only PostgreSQL's documented creator ADMIN-only record remained.
- No authenticated capability-hash/bridge access or source-role financial INSERT privilege appeared. Anonymous dispatch failed through the real bound Auth UID helper.
- All21 legacy table fingerprints remained exact after successful local DDL. **No hosted DDL or source records were created.**

## Remote compatibility and exact dry-run

Private receipts: `.local/v6/approval-s-deployment/native-20261113/`.

All18 read-only remote checks passed: PostgreSQL17.11; actual postgres CREATEROLE/non-superuser/schema grant authority; Auth usage/reference/UID dependencies; no PUBLIC CREATE; expected creator setting; historical anchor key/RLS; builtin UUID/SHA; and absence of source/PAPER roles, source objects and anchor-policy collisions. Migration history is exactly `202611030001`, `202611030002`, `202611040001`.

The first isolated dry-run lacked environment metadata and labelled it unverified. That receipt is preserved as `dry-run-unverified-context.json`. The root linked-history query independently identified project **Sports Model / ilgoswfckkzpoktabbfi / Production**. Only its existing non-secret four-field linkage metadata was copied into the isolated cache, then the dry-run was repeated. No credentials or environment file were copied, and no linked project configuration changed.

Final `dry-run-verified-context.json`:

```json
{
  "dryRun": true,
  "migrations": ["202611130002_v6_source_cloud_compatible.sql"],
  "seeds": [],
  "roles": [],
  "target": {
    "kind": "linked",
    "project_ref": "ilgoswfckkzpoktabbfi",
    "project_name": "Sports Model",
    "environment": "production"
  }
}
```

Command: `npx supabase db push --dry-run --remote --skip-vault --workdir <ignored isolated staging directory>`. The CLI's “Finished db push” status is **a dry-run**, not a deployment. No include-all/include-roles/include-seed/reset or actual push occurred. Final read-only fingerprints/history confirmed no hosted changes. CLI inspection's BYPASSRLS role establishes compatibility metadata, not normal-user isolation.

Current application checks:752/752 tests across67 files with embedded SQL enabled; TypeScript, lint and production build passed; five private-file/source-state safety groups passed. No application code changed. Prior hosted Preview owner acceptance is preserved; second-account, genuinely expired-session and hosted sports POST gaps remain unverified. Actual hosted source DDL hooks/function execution/persistence/two-user RLS remain post-deployment/provisioning acceptance work, not already passed.

## Approval boundary

No source upload, capability issuance, cloud activation, Mac transfer, Production/Preview release, PAPER A/B/C or financial action is authorised. The filtered103-file retention preview remains local; its71 withheld model/source dependencies still block full cloud handover. Mac scope/window/schedule/model/quota are unchanged; no extra provider credit was consumed.

**Fresh decision requested:** approve applying only `202611130002_v6_source_cloud_compatible.sql`, SHA-256 `0b80c5a2412c7a3d10348a75823ae4ad6696e552a29ddc73ccc755108b026a59`, to `ilgoswfckkzpoktabbfi`, on the documented verified application-backup scope, after rechecking current fingerprints/hash/dry-run. No deployment may occur before the owner's new explicit approval.
