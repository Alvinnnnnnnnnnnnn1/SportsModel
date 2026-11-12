# V6 security preflight — 12 November 2026

**Local review passed with documented changes; hosted deployment and activation remain unapproved.** This review covers actual SQL/catalog privileges, not just passing application tests. No research pilot was repeated, no sports API credit used, no private account/session changed and no hosted write performed.

## Exact reviewed input and hardened output

The requested file at `supabase/proposals/202611110001_v6_paper.sql` initially matched **`535df727704be74882c97f966466965d3993255bd5d9b09cc5f17257c753ec5c`**. The test retrieves those exact bytes from commit `2c94865`, verifies SHA-256 and actually applies them to an isolated database. A private original copy remains under `.local/v6/security-review/535df…sql`.

That proposal is superseded locally by **`c3a0d368ddbda1b50f3dab13aeec7cb3a939e423bce894aa1d55cfe9f13a3dff`**, at the same **unapplied proposal path**, outside `supabase/migrations/`. A new Approval A must name this hash. No working/deployed migration was overwritten. Diff: `git diff 2c94865 -- supabase/proposals/202611110001_v6_paper.sql`.

Findings and corrections:

- **Role collision:** the original silently reused any existing `edgelab_v6_worker`, without proving it was unprivileged. The candidate aborts on collision, creates an explicit NOLOGIN/NOINHERIT/NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOREPLICATION/NOBYPASSRLS role, and does not alter an existing role to force success.
- **Unattended authentication gap:** the original expected externally signed worker JWTs and an unimplemented issuer/renewal mechanism. The preferred candidate uses owner-issued, independently revocable opaque capabilities, with no project signing key or service-role credential in the worker. No role is granted to `authenticator` or `authenticated`.
- **Experimental versus stronger evidence:** the original activation path conflated experimental prospective paper collection with the higher-evidence gate. New immutable research tiers distinguish `chronologically_evaluated` experimental Elo from `out_of_sample_validated` stronger-evidence models. Data/price/time/formula checks remain unchanged; the new research-only policy requires explicit approval and never asserts calibration/profitability/Tier 1.
- **Winner validation:** a decisive team grade now rejects a winner outside the original home/away IDs in both TypeScript and SQL.
- **Error redaction:** native malformed-JSON errors could echo a secret-file excerpt. Control/credential file decoding and malformed worker-response errors now omit input contents; a regression test proves the credential is not echoed.

## Every DDL/permission operation

| Operation | Exact scope and review result |
| --- | --- |
| CREATE ROLE | One new collision-guarded non-login V6 role; no existing role modified |
| CREATE TABLE | Eleven: `v6_policies`, `v6_controls`, `v6_models`, `v6_observations`, `v6_positions`, `v6_grade_revisions`, `v6_runs`, `v6_provider_quotas`, `v6_outbox`, `v6_audit`, `v6_worker_credentials` |
| ALTER TABLE | Only newly created V6 tables: exact-market constraint and RLS enablement. No existing table/policy/column changed |
| CREATE INDEX | Three explicit performance indexes plus PK/unique indexes; **19** actual catalog indexes |
| CREATE FUNCTION | **21**, all fixed `search_path=''`; **17 invoker**, **4 definer** listed below |
| CREATE TRIGGER | **23** catalog triggers: immutable evidence, source/model/grade/quota guards, audit inserts, owner-control serialization, credential guard/audit |
| CREATE POLICY | **13**: ten owner policies plus three internal credential lookup/issuance/revocation policies |
| ALTER FUNCTION OWNER | Only the four new definer functions, transferred to the limited worker role, never `postgres` execution authority |
| GRANT | Schema public/auth USAGE and `auth.uid()` EXECUTE to worker; explicit V6 table/helper rights; model/policy/control activation remains authenticated-owner-only. Credential metadata table is not directly accessible to anon/authenticated. Owner management RPCs to authenticated; credential-checked dispatch to anon |
| Temporary GRANT/REVOKE | Public-schema CREATE granted solely for function ownership transfer, revoked before COMMIT. Effective worker CREATE is tested false |
| REVOKE | Defaults removed from new V6 tables/functions and sensitive definer surface, including possible service-role default EXECUTE grants. No legacy API grant/revoke performed |
| DROP/TRUNCATE/seed | None. No DELETE or UPDATE against existing application/history records. Trigger definitions reject deletes; they do not execute a deletion |

The generated complete function definitions/ACLs, indexes, policies and triggers are in ignored `.local/v6/security-review/catalogue.json`. The original catalog has 10 tables/16 functions/21 triggers/10 policies/17 indexes; the hardened catalog has 11/21/23/13/19. The test also simulates permissive Supabase new-function default grants rather than relying on clean defaults.

Existing owner SELECT/INSERT/UPDATE permissions on normal application tables are preserved. The V6 worker cannot read the legacy workspace RPC, insert cash/funding, or disable historical audit triggers. All ten ordinary V6 tables retain `user_id=auth.uid()` USING/WITH CHECK; same-owner composite FKs and immutable/audit guards remain. No DELETE grant is added.

## Exact security-critical SQL

```sql
if exists(select 1 from pg_roles where rolname='edgelab_v6_worker') then
  raise exception 'V6 worker role collision requires explicit review';
end if;
create role edgelab_v6_worker nologin noinherit nosuperuser
  nocreatedb nocreaterole noreplication nobypassrls;

-- Ordinary V6 tables:
create policy v6_owner on public.v6_positions for all
  using(user_id=auth.uid()) with check(user_id=auth.uid());

-- The sole anonymous-executable V6 entry point:
grant execute on function
  public.v6_worker_access(uuid,text,text,jsonb) to anon;
```

Each of `v6_issue_worker_credential`, `v6_list_worker_credentials`, `v6_revoke_worker_credential` and `v6_worker_access` is `SECURITY DEFINER SET search_path=''`, owned by **edgelab_v6_worker**. Names are schema-qualified; there is no user-controlled SQL identifier or dynamic query dispatch. All other V6 functions are invoker. Definers run with RLS because their owner is neither table owner nor BYPASSRLS. [Supabase's function guidance](https://supabase.com/docs/guides/database/functions) explains why fixed paths and explicit EXECUTE grants matter.

**Intentional internal RLS exception:** the limited worker role can SELECT credential hashes across owners to resolve an unknown opaque secret. Anon/authenticated have no table SELECT. The dispatcher requires exact SHA-256 secret + stored owner + scope + expiry + revocation, and returns no hash/secret metadata. This is not a blanket claim that every internal role has a `user_id=auth.uid()` lookup policy. Never grant this non-login role directly to an API/login role.

## Credential trust boundary

The authenticated owner issues a capability via the existing signed-in Settings page. Two independent cryptographic UUIDv4 values provide about 244 random bits. Only SHA-256 is stored; plaintext is downloaded once, never placed in page text, localStorage, audit payloads, logs or public environment variables by this application. Default TTL is 30 days; SQL permits 1–2,160 hours, maximum 90 days. Expiry is immutable. Rotation atomically revokes the selected old credential; revocation cannot be undone. Missing/expired/revoked/non-owner/scope-incompatible credentials reject.

The worker uses HTTPS, the public `apikey` header and a private capability in the RPC body, **not a browser JWT**. [Supabase's API-key guidance](https://supabase.com/docs/guides/getting-started/api-keys) distinguishes publishable application keys from authentication. The dispatcher exposes only identity, load and atomic V6 commit. `research_only` cannot register or grade. `paper_worker` still cannot approve models, enable controls, issue more credentials or call V5 operations. Owner management APIs require authenticated-owner claims and are not in dispatch.

After secret validation, the dispatcher binds temporary owner claims from the stored credential, takes consistent owner/credential locks, and restores both claim settings on success/exception. It rechecks expiry before returning; late expiry rolls back a write. Revocation serializes against an in-flight batch. Credential operations/audits retain hash-only metadata. A lost commit response is handled by rereading durable run state; retries cannot duplicate P/L.

## Executed isolated tests and rollback

- Exact old and new SQL applied to separate disposable PostgreSQL instances. Nonempty legacy profile/settings/audit sentinels, existing row snapshots, table ACLs/ownership, constraints, triggers, policies and function definitions/grants fingerprint unchanged.
- Late `1/0` before COMMIT rolled back the complete old/new DDL, role and grants. Reapplication after rollback works; an existing login-role collision aborts without changing that role. No database-reset command or destructive hosted backout was used.
- Ordinary owner/non-owner, anon and worker contexts verify owner isolation, scope, missing/expired credentials, rotation/revocation, non-leaking claim restoration and V5 permission denial. Test setup uses admin only to create isolated fixtures, not to claim normal-user access passed.
- The exact scheduler/worker and PostgREST repository run against migrated local SQL through intercepted HTTP: reproducible synthetic Elo forecast, qualification, real-clock pre-event A$50 registration, original snapshot preservation, corroborated synthetic final, A$40 hypothetical profit/A$5,040 equity, restart/replay, server/client stop and revocation. More than sixty seconds elapse naturally before result grading; no source/registration clock or trigger is bypassed.
- Operational backout disables controls/revokes the credential while retaining position/grade/audit rows. Actual cash/funding remains empty in the isolated acceptance account.

## Remaining risks and hosted acceptance

No actual hosted migration/capability issuance or genuine prospective position was executed. Actual Supabase role-ownership transfers, gateway/default ACL behavior, logging redaction, two live user contexts, concurrency and restart behavior need post-Approval-A verification. Embedded PostgreSQL cannot establish these. Ordinary admin/service roles remain privileged by platform design; this worker holds none of their credentials.

A stolen capability could poison new V6 research within an active standing policy; it cannot execute cash wagers or modify immutable old evidence. Hashes establish retained-byte integrity, not cryptographic proof of upstream sporting truth. The trusted read-only collector and independent result checks remain required. Protect the downloaded file, enforce 0600/0400 in `.local/v6/`, verify HTTPS/log redaction before C, and revoke on loss. Periodic credential rotation is required; no daily login is needed, but indefinite credential renewal is not claimed.

The single-host quota/locking boundary remains; multi-host coordination and always-on host availability are not proven. All twenty genuine observations remain excluded positions, despite verified results. Actual future-market registration/result acceptance must wait for independent A/B/C approvals and must never force a qualifying count. See [the current approval package](v6-deployment-approval-package.md).
