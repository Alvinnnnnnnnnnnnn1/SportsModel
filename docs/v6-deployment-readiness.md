# V6 deployment and rollback readiness

> **Subsequent correction:** the owner separately approved exact ACL03; it deployed13 November04:10:23Z and passed hosted ACL/catalog/anonymous acceptance. Source remains empty and unprovisioned. [Current evidence and remaining limits](v6-source-acl-deployment.md). The earlier checkpoint below is preserved.

> This page covers the separate PAPER proposal, which is still undeployed/disabled. Source-only02 deployed under fresh Approval S; its hosted acceptance is blocked on RPC ACLs, with no provisioning or cloud activation. [Current source status](v6-approval-s-deployment.md).

Status: **not deployed, not enabled**. The [final SQL/security preflight](v6-security-preflight.md) and [current A/B/C approval package](v6-deployment-approval-package.md) supersede earlier checkpoints below. Owner-issued hashed, revocable capabilities close the external JWT-issuer gap without a signing/service key or new account. The [experimental paper policy](v6-experimental-paper-policy.proposed.md) is separately proposed; no approval, genuine position, schedule or hosted change. All ten genuine observations and V5 history remain unchanged.

## SQL diff for review

Proposed file: `supabase/proposals/202611110001_v6_paper.sql`, outside `migrations/`. Latest SHA-256:

`c3a0d368ddbda1b50f3dab13aeec7cb3a939e423bce894aa1d55cfe9f13a3dff`

The original requested535df… hash matched and was applied/audited in isolation. It is superseded by the hardened candidate: collision-safe role creation, an eleventh credential table/four limited-role definer functions, experimental-tier binding and exact winner validation. No existing table/policy/record is altered. New counts:11 tables,21 functions,23 triggers,13 policies,19 indexes. Detailed grants/definer boundaries and rollback evidence: [security review](v6-security-preflight.md). Older proposal hashes below are historical, never deployed.

Earlier checkpoint535df… superseded local `bac90244…`, never deployed. That prior delta added the sixty-second buffer/typed review/atomic RPCs without another table. The current c3a0… candidate additionally has the credential table and reviewed definer boundary; [the approval package](v6-deployment-approval-package.md) is authoritative for its exact scope.

This supersedes local hash `3d6353aadfea1d0ef9fdd026ab6aa44b963e667732c3156aa6beb980f56c54f5`, never deployed. The 12 November delta adds a separate `nba_team_elo_only` method with zero form/rest/shrinkage, exact model ID/version, owner-reviewed registry evidence and minimum 500 chronological/30 strictly verified prospective games. Those proposed validation thresholds require review; they are not paper-volume caps. Local tests reject missing approval, reproduce a valid baseline, and prove late failure rolls back its batch. Exact delta from the last proposal review: `git diff bada5d6 -- supabase/proposals/202611110001_v6_paper.sql`.

Previous local hash `19316b6afaf61a1354aced38996fb061c223fdaa71c39e07da9c7c98889164c0` is superseded, never deployed. Team continuation adds `nba_team_elo` to the model registry, database reproduction of its frozen formula/two-pass/original-price/earliest-start gates, and HTTPS query support that rejects secret or encoded parameter names. No new table/role or wider V5 permission was added. Synthetic embedded tests prove team registration and late-failure rollback; they do not activate a real model. Diff from the previous review:

```sh
git diff 8bc99fd -- supabase/proposals/202611110001_v6_paper.sql
```

The previous local proposal hash `8e718d755c70fa049f70981e3d7db0bfbdbbd3a5b2166e8c5d69501c077649da` is superseded, not a deployed migration. Changes since that proposal preserve null source-issued result timestamps, require actual observation time/raw-hash evidence in that case, bound raw evidence, retain original published times when available and support narrowly frozen DNP-void terms. Source timestamps are not invented from completion/retrieval. Tests exercise rejected bad hashes and subsequent valid revisions. Full local diff:

```bash
git diff b05b906 -- supabase/proposals/202611110001_v6_paper.sql
```

Relative to the deployed baseline, the current candidate creates eleven V6 tables and the reviewed helper/auth functions, indexes, RLS and triggers plus a non-login V6 role. No existing table/row is changed or seeded. NUMERIC/cents, exact uniqueness and serialized grade revisions remain uncapped and deterministic.

The worker role cannot activate policies/models, change controls, access V5/funding or disable historical audits. Seventeen functions are invoker; four narrowly reviewed auth functions are definer under that non-table-owner/non-BYPASSRLS role. Anonymous access exists only at a secret-checked fixed dispatcher. Credential hash lookup is an intentional internal policy exception; it exposes no hashes or cross-owner state to callers. The position UPDATE-column grant permits row locks only; immutable triggers reject edits. These are isolated SQL proofs, not hosted authentication verification.

Remaining deployment work: explicit A, hosted gateway/default-ACL/role ownership/logging/two-user/concurrency tests, owner capability enrollment, independent B and C. No JWT broker, project signing key or worker-to-authenticator membership is needed or recommended. The capability expires (default30 days); rotate periodically. Multi-host quota aggregation is unsupported. No credentials belong in chat.

## Approval and failure/rollback plan

1. Finish data/identity/model gates and review this exact SQL/hash and scope with the owner. Read-only linked migration history on 12 November confirmed project `ilgoswfckkzpoktabbfi` and only `202611030001`, `202611030002`, `202611040001`. This is migration-history evidence, not a new complete hosted catalog/RLS test. Repeat the read-only comparison before a separately approved deployment.
2. Preserve a new owner-controlled backup before any separately approved deployment. Prepare only the approved V6 migration, inspect a dry-run and ask explicit final owner approval for its exact contents/project. Do not automatically move this proposal into migrations or push it.
3. DDL is enclosed in one transaction. If any statement fails before COMMIT, stop and let PostgreSQL roll back; report the error, never reset/reseed or continue with a partially altered design. Privilege/role compatibility must be checked on the actual free Supabase project; PGlite cannot establish hosted support.
4. If committed schema later needs operational rollback, first stop/revoke the **V6 worker only** under explicit approval, retain all rows/audits and leave V5 untouched. Preserve V6 tables for read-only investigation; do not automatically DROP/TRUNCATE them or delete a policy/model/position. Owner-approved corrective additive SQL is preferred to destructive rollback.
5. After deployment, perform scoped authenticated two-user persistence/RLS tests with approved evidence, atomic registration/settlement and real restart/concurrency verification. Prior local successes are not hosted proof. Keep controls disabled until exact standing policy/model activation and a prospective pilot are separately authorised.

## Local worker, scheduler and emergency stop

The existing Node entry point and uninstalled one-minute template remain disabled. Experimental paper needs explicit reviewed reproducibility/uncertainty approval B and activation C, not prior profitability or thirty earlier results; the stronger cohort retains its additional review. Separate source-only receipts still cannot register. Local capability-backed scheduler/registration/settlement/restart tests pass; genuine future hosted positions and external alerts remain unverified. See [current operations](v6-controlled-readiness.md); older templates below remain historical smoke-test guidance.

The worker uses Node and the installed npm/Vite runtime directly; **no `npm run dev` or Next HTTP server is needed**. A full existing `npm ci` installs the development runtime used by scripts; an `--omit=dev` worker distribution is not prepared. Example safe smoke test:

```bash
node scripts/run-v6-worker.mjs --config ops/v6-worker.config.example.json --once
```

The example is `disabled`, kill switch true, no inbox/model/grader/activation. It reads no provider and registers nothing. It writes only a local operational health receipt. The actual source audit uses a separate dry-run owner label clearly marked **not a Supabase account**; it cannot overwrite an authenticated workspace or V6 prospective position.

`ops/com.edgelab.v6-paper.plist.example` is an uninstalled once-daily launchd template. Only after source/model/result gates and explicit production approval: resolve absolute Node/project/log paths, make private config/log directories, verify host Melbourne calendar timezone, test a one-shot disabled run, review the installed job permissions and then enable the approved mode. A `TZ` environment entry does not change launchd calendar scheduling. No job was loaded by this task; no install/load command is being executed. A sleeping/offline local host cannot guarantee run availability.

Emergency stop is `killSwitch: true` and/or `mode: disabled` in the private worker config. An armed prospective worker must have a commit latch; CLI rereads mode, owner, activation and kill switch after source/model reads **inside the commit lock**. A changed latch aborts before position/grade/run persistence. No automatic policy activation occurs. Provider evidence collected before a stop remains local immutable source evidence, not a registered position.

## Health, missed runs and UI deployment

The team one-shot collector/worker runs in local observational `dry_run` only. `scripts/check-v6-team-results.mjs` has a no-request future-event gate, then narrow source/result verification and an append-only observation journal; it cannot settle financial positions. Its actual follow-up used two credits, bringing usage to ten/500, with 490 remaining. No schedule is installed. After model/rules review, the controlled worker enforces frozen two-pass checks and the **earliest** attributed fixture clock with its commit latch. Later results never upgrade the excluded pilot. Quota coordination remains single-host; the manual team pilot retains its 12-credit ceiling. Only exact approved controlled receipts can enable the proposed 300-credit monthly controlled allowance (maximum 400, reserve 100). None was enabled.

CLI operational attempts go to ignored `.local/v6/worker-health/`. `v6WorkerHealth` distinguishes stopped/disabled, never-run, failure, invalid clock, missed run (default >26 hours, accounting for Melbourne DST) and a fresh run with no usable source data/all candidates blocked. A recent successful transaction is not proof of healthy coverage. The function/receipts are implemented; no running monitoring daemon, alert delivery or hosted health dashboard is claimed. Failure receipts do not invent successful screened counts.

`free-sources.server.ts` serializes all new V6 collection instances through durable per-provider locks/counters, reserves before transport, retains uncertain attempts, enforces free-plan/reserve/body/endpoint/cooldown limits and makes no automatic retry or paid upgrade. The NBA pilot caps at ten data attempts/day and ≥16-second spacing; the legacy inspector separately caps at 70/day and six/minute. This is single-host protection, not a multi-host shared quota service. Old odds pilot is already exhausted at its four-credit ceiling; use the new shared path for any separately justified further V6 read, never reset counters to get more credits.

The existing UI still builds locally with authenticated Supabase access. A future hosted UI needs its own reviewed free hosting target, HTTPS Auth callback/site URLs, correct public-only browser variables, private source endpoints, and server-only provider/worker credentials. The old loopback sports route is unsuitable for serverless deployment. Do not expose local raw evidence, journals, private exports or all MCP tools. Public redistribution/production data rights need review. No hosting provider, DNS, billing account or production credentials were created/configured.

Hermes/iMessage and all external messaging are deferred. The proposed outbox is in-app only; no closed-browser push or message delivery is implemented or claimed.
