# V6 deployment and rollback readiness

Status: **not deployed, not enabled**. [Event reconciliation](v6-event-reconciliation.md) now verifies all ten genuine observational fixtures through new decisions, preserving the original strict journal. No qualifying activated model, registration or genuine paper settlement is claimed. The [exact deployment approval package](v6-deployment-approval-package.md) supersedes earlier readiness gaps below: the atomic Supabase adapter/RPC and scoped identity checks are implemented locally, but trusted credential issuance/renewal and hosted acceptance remain open. No migration, legacy record, schedule, paid service or external message was enabled.

## SQL diff for review

Proposed file: `supabase/proposals/202611110001_v6_paper.sql`, outside `migrations/`. Latest SHA-256:

`535df727704be74882c97f966466965d3993255bd5d9b09cc5f17257c753ec5c`

Supersedes local `bac90244…`, never deployed. New delta: sixty-second Elo pre-event buffer; typed model-readiness review; worker-only identity/state/atomic-run RPCs; owner control serialization. No additional table or V5 permission. Full scope/authentication/backout and exact commands are in [the approval package](v6-deployment-approval-package.md).

This supersedes local hash `3d6353aadfea1d0ef9fdd026ab6aa44b963e667732c3156aa6beb980f56c54f5`, never deployed. The 12 November delta adds a separate `nba_team_elo_only` method with zero form/rest/shrinkage, exact model ID/version, owner-reviewed registry evidence and minimum 500 chronological/30 strictly verified prospective games. Those proposed validation thresholds require review; they are not paper-volume caps. Local tests reject missing approval, reproduce a valid baseline, and prove late failure rolls back its batch. Exact delta from the last proposal review: `git diff bada5d6 -- supabase/proposals/202611110001_v6_paper.sql`.

Previous local hash `19316b6afaf61a1354aced38996fb061c223fdaa71c39e07da9c7c98889164c0` is superseded, never deployed. Team continuation adds `nba_team_elo` to the model registry, database reproduction of its frozen formula/two-pass/original-price/earliest-start gates, and HTTPS query support that rejects secret or encoded parameter names. No new table/role or wider V5 permission was added. Synthetic embedded tests prove team registration and late-failure rollback; they do not activate a real model. Diff from the previous review:

```sh
git diff 8bc99fd -- supabase/proposals/202611110001_v6_paper.sql
```

The previous local proposal hash `8e718d755c70fa049f70981e3d7db0bfbdbbd3a5b2166e8c5d69501c077649da` is superseded, not a deployed migration. Changes since that proposal preserve null source-issued result timestamps, require actual observation time/raw-hash evidence in that case, bound raw evidence, retain original published times when available and support narrowly frozen DNP-void terms. Source timestamps are not invented from completion/retrieval. Tests exercise rejected bad hashes and subsequent valid revisions. Full local diff:

```bash
git diff b05b906 -- supabase/proposals/202611110001_v6_paper.sql
```

Relative to the deployed schema, the proposal creates ten new owner-scoped V6 tables, new helper/guard/summary/quota/registration/grading functions, indexes, RLS and triggers, plus a non-login `edgelab_v6_worker` role. No existing table is altered, no existing row updated/deleted and no seed inserted. Monetary results are NUMERIC/integer cents. Exact market uniqueness and serialized grade revision chains prevent duplicate positions or double P/L without count/exposure gates.

The worker role can read/write narrowly scoped V6 data but cannot activate policies/models, change controls, call the legacy workspace RPC or access `bets`/funding. Functions use SECURITY INVOKER; owner checks and same-owner composite FKs remain. The one UPDATE-column grant on `v6_positions.registered_at` permits PostgreSQL row locks; the unconditional immutable trigger still rejects all edits. Tests prove ordinary-user isolation, anonymous rejection, revoked V5 access, stale revisions, late-write rollback and uncapped positions. Embedded role simulation is **not hosted worker-auth verification**.

Remaining deployment work: review sufficient model evidence, provision trusted scoped JWT issuance/renewal and role access, and run hosted acceptance. The optional atomic Supabase adapter is now implemented and locally tested; it never imports a V5/financial repository. Source quotas remain single-host; multi-host aggregation is unsupported. The worker role is non-login and no authenticator membership/token broker is installed. A normal personal token or service-role key is rejected. Do not request secrets in chat.

## Approval and failure/rollback plan

1. Finish data/identity/model gates and review this exact SQL/hash and scope with the owner. Read-only linked migration history on 12 November confirmed project `ilgoswfckkzpoktabbfi` and only `202611030001`, `202611030002`, `202611040001`. This is migration-history evidence, not a new complete hosted catalog/RLS test. Repeat the read-only comparison before a separately approved deployment.
2. Preserve a new owner-controlled backup before any separately approved deployment. Prepare only the approved V6 migration, inspect a dry-run and ask explicit final owner approval for its exact contents/project. Do not automatically move this proposal into migrations or push it.
3. DDL is enclosed in one transaction. If any statement fails before COMMIT, stop and let PostgreSQL roll back; report the error, never reset/reseed or continue with a partially altered design. Privilege/role compatibility must be checked on the actual free Supabase project; PGlite cannot establish hosted support.
4. If committed schema later needs operational rollback, first stop/revoke the **V6 worker only** under explicit approval, retain all rows/audits and leave V5 untouched. Preserve V6 tables for read-only investigation; do not automatically DROP/TRUNCATE them or delete a policy/model/position. Owner-approved corrective additive SQL is preferred to destructive rollback.
5. After deployment, perform scoped authenticated two-user persistence/RLS tests with approved evidence, atomic registration/settlement and real restart/concurrency verification. Prior local successes are not hosted proof. Keep controls disabled until exact standing policy/model activation and a prospective pilot are separately authorised.

## Local worker, scheduler and emergency stop

The current concrete entry point is `scripts/run-v6-controlled.mjs`, with disabled controls in `ops/v6-controlled.config.example.json`. Its **uninstalled** one-minute launchd template calls the actual worker with durable jobs, leases, retries and commit latch. Ten verified observational fixtures on one slate still fail the proposed multidimensional model-readiness gate. A separate expiring source-only receipt can authorise dry-run research without positions. Live armed operation, hosted persistence and delivered alerts remain unverified. See [current operations](v6-controlled-readiness.md); older disabled template instructions below remain historical smoke-test guidance.

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
