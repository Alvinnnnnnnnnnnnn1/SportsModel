> **Latest historical recovery — 13 November 2026:** four approved BDL requests succeeded, then stopped on11 missing exact timestamps. The source-verified partial package now has125 references/121 objects, but no complete reconstructed artifact. No upload, cloud activation or Mac change occurred. [Exact recovery, quota, hashes and next decision](v6-cloud-history-recovery.md). Earlier checkpoints below are retained as history.

> **Previous input audit:** the111-object reconstruction is a partial source archive, not a usable full-runner package. Missing2022–2024 permitted history, pinned-model lineage and original identity dependencies remain blockers. No provisioning/credential/host activation occurred. [Exact four-part readiness report](v6-cloud-data-readiness.md).

> **Current13 November status:** separately approved source ACL03 deployed; hosted ACL/catalog acceptance passed. Source storage is empty/unprovisioned and cloud/PAPER remain disabled. Positive source persistence/two-user acceptance still requires separate approval. [Actual correction evidence](v6-source-acl-deployment.md). Earlier blocked source statements are historical.

> **Current deployment checkpoint:** source02 was explicitly approved and applied on13 November03:41:49Z. Hosted acceptance stopped at the owner-RPC ACL mismatch; no correction/upload/credential/activation followed. [Actual evidence and unapproved correction03](v6-approval-s-deployment.md). Earlier “not deployed” source statements below are historical.

> **Latest Approval S correction — 13 November 2026:** use the separately hashed replacement `202611130002_v6_source_cloud_compatible.sql`, SHA `0b80c5a2412c7a3d10348a75823ae4ad6696e552a29ddc73ccc755108b026a59`, after explicit schema-only approval/backup/preflight. Restricted non-superuser migration and security/rollback tests pass; original7a03 and PAPERc3a0 remain unchanged/unapplied. Five functions now include an INVOKER Auth dependency bridge, with no new Auth schema grants. [Fresh package and exact diff](v6-source-storage-approval.md). Filtered source retention is103 files with71 withheld, including required model/training dependencies; full cloud host transfer remains blocked. Nothing was deployed/provisioned/activated; Preview, Production and the Mac pilot are unchanged. Older proposal paths and pre-correction status below describe earlier checkpoints and must not be used as the new approval target.

> **Latest — actual Preview deployed 13 November 2026:** exact application `2cd0d2805f1e2d5faeed91f33ca92587966b8812` is READY at https://sports-model-foasnqidg-alvinnnnnnnnnnnnn1s-projects.vercel.app . Real owner HTTPS/V5/V6 checks passed with explicit unconnected cloud state; second-account, expired-valid-token and correct sports POST hosted checks remain unverified. Production is unchanged. [Actual acceptance](v6-preview-acceptance.md). Independent [Approval S review](v6-source-storage-approval.md) found a non-superuser function-ownership blocker in unchanged7a03 SQL; **do not apply it as written**. No schema/provision/worker/credential/source/Mac change occurred. All earlier status statements below describe the historical preparation checkpoints, not a claim that the new Preview remains undeployed.

> **Post-sync review — 13 November 2026, Australia/Melbourne:** the owner sync propagated both prior commits. Initial local/remote feature HEAD was `0934b2f7a35d20cc3b50fd58db491b5808d9695b`; main was `7814a1ed9a851d0cf2e6b62e9e3976046ae5bbca`, an ancestor with feature 28 commits ahead / 0 behind. Current tested application target is **`2cd0d2805f1e2d5faeed91f33ca92587966b8812`**. The development commits are authorised for non-force feature push; Production deployment, main merge, source schema/provisioning, cloud credentials and host transfer remain separately gated. A following documentation-only commit records this review.

# V6 private cloud migration — 13 November 2026

**Implemented and locally verified; not deployed or activated.** The approved Mac source-only LaunchAgent remains loaded and unchanged. This work made zero provider requests, consumed zero credits, created no production credentials and performed no hosted database/storage writes. No V5 history, methodology, model, funding or financial entry changed. The original 20 selections and 5,082-game dataset hashes are preserved.

## Actual deployment identity

The owner inspected Vercel and confirmed the current Ready/Current **Production** deployment is a **Redeploy of `feature/v6-autonomous-paper` at `73861e15b7b765e2578d08f7d97d9bed5222bf81`**. Production URL: https://sports-model-mauve.vercel.app/. This differs from the previously displayed Production Branch `main`; the owner has not authorised changing that setting or merging branches.

Independent read-only checks: the live `/v6` returned HTTP200; GitHub default branch is `main` at `7814a1ed9a851d0cf2e6b62e9e3976046ae5bbca`; GitHub reports a successful Vercel check for feature `73861e1`, linking deployment `3pqYroTdgVHEvUAVntxSX6poaXkb`, and a different successful deployment for main. These checks do not independently establish the production alias or current project settings. Vercel management auth/CLI/project linkage is absent here. Production/Preview environment names, current Production Branch and build settings remain to be inspected in Vercel. The original preparation performed no push, branch change, merge, deployment or alias promotion. The subsequent owner sync was independently confirmed during this review; new feature pushes are separate from deployment.

**Previous implementation / Preview target: `2ce4af372c949c8d14f6f3e817597c921be334d2`** (`Prepare private cloud research storage and disabled source-only runner`). A following documentation-only commit records the evidence; it does not change application behavior. Those prior commits are now present on the remote feature branch after the owner sync. The revised API emits `X-EdgeLab-Revision` when Vercel supplies a valid40-character `VERCEL_GIT_COMMIT_SHA`, allowing future deployed revision checks without exposing private data.

## Architecture and free constraints

Vercel serves the existing Next.js UI and owner-authenticated, read-only projections. Supabase PostgreSQL holds private content-addressed UTF-8 JSON objects, immutable versioned manifests, source-only controls, fenced leases, reservations and audit. GitHub Actions invokes the **existing** controlled scheduler and research worker, hydrating a fresh disposable cache from that durable state. Local `.local/v6` remains the original archive; it is neither uploaded to Git nor packaged as web assets. No Supabase Storage bucket is needed for this bounded pilot; no public object URLs or service-role keys exist in this design.

GitHub reports this repository is **public**. Standard Ubuntu-hosted Actions runs are free for public repositories ([billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)); larger runners are excluded. Use only existing free accounts. Supabase Free currently includes500 MB database and5 GB uncached egress, with inactivity pausing ([pricing](https://supabase.com/pricing)). Source objects are capped at16 MiB each and96 MiB aggregate per pilot, including retained old revisions; these guards are acquisition/storage limits, not paper position caps. The database's existing usage, indexes, TOAST/WAL overhead and egress must be checked before provisioning. No code upgrades a plan or starts billing. If free limits cannot support the pilot, stop rather than purchase capacity.

The initial private export is37,701,100 unique bytes, 174 file references/172 objects. Idle runner ticks read only pilot/manifest/scheduler metadata, rather than downloading the entire37.7 MB archive each time. Full restoration occurs only for due/missed work; unchanged objects are not reuploaded. Dashboard projections exclude raw receipts and training datasets. Expect roughly1 GB of baseline worker download traffic for28 jobs, plus growing evidence, retries and dashboard traffic; this is an estimate, not measured hosted usage. Monitor remaining free egress. No production-scale uptime/capacity guarantee is claimed.

Vercel Hobby cron is not selected: its free cadence/precision restrictions are a poor match for separate daily discovery/results, bounded retries and result retention ([limits](https://vercel.com/docs/schedules/cron-jobs/usage-and-pricing)). GitHub schedules also have delay/drop limitations and must exist on the default branch ([schedule rules](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)). Configuring a schedule is not proof it executed.

## HTTPS access and private dashboard

`dashboard-origin.ts` is independent of `sports/access.ts`. The sports proxy remains loopback-only. The V6 read endpoint permits exact `https://sports-model-mauve.vercel.app`, local HTTP in local development, and only the exact current Vercel Preview/branch hosts supplied by trusted Vercel system environment. It rejects sibling/cross-site origins, arbitrary `*.vercel.app`, unexpected ports, URL parameters and mutations. A bearer JWT is verified through Supabase Auth; the same ordinary token must SELECT the configured historical batch under owner RLS. No service key is used.

On Vercel, `.local` is never selected as evidence. Missing binding/schema/snapshot returns an explicit **Cloud research evidence not yet connected**503 after authentication. Another owner gets403 before object access. Missing/expired sessions get401. Errors omit raw upstream text, private paths and identifiers. No CORS wildcard is added. Responses are private/no-store. Demo never calls this endpoint.

The cloud adapter uses the owner's JWT for all reads with explicit owner/pilot filters, verifies manifest/object SHA-256 and lengths, restores only display inputs into an isolated temporary directory, reuses the existing allowlisted projection and removes the directory. It never exposes raw objects, source URLs, private namespace or keys. Its ledger is always empty/not activated because this source store has no registered PAPER domain. Existing statistical reports, first/second pass reasons, null source timestamps, frozen model versions, source quality and original observational outcomes remain distinct. A cloud configuration is not labelled healthy without actual job/source evidence. Local-host state cannot be observed from Vercel; handover evidence is required.

`.vercelignore` excludes `.local`, environment files and build caches from CLI uploads. Next output tracing excludes `.local` and `.env*` for all routes. The safety script checks compiled browser assets against configured server-only key values without printing them. `.vercel/` is Git-ignored.

## Exact separate database proposal

**Not a migration deployment approval request for PAPER A.** New source-only proposal:

`supabase/proposals/202611130001_v6_source_cloud.sql`

SHA-256: **`7a03d765f78b5c1939900d1ddb50809238987104e5399ed772cb900692caf451`**.

It adds seven source-only tables:

| Table | Purpose |
| --- | --- |
| v6_source_pilots | Existing owner/archive anchor, exact original plan/receipt bytes, stopped host controls, lease epoch and current snapshot pointer |
| v6_source_objects | Private immutable UTF-8 JSON bytes and SHA-256 |
| v6_source_snapshots | Append-only manifests, original manifest bytes, hash and revision |
| v6_source_capabilities | Hashed, owner-issued, revocable expiring source capability; no token value stored |
| v6_source_quotas | Durable monthly odds/daily BDL counters, uncertainty and cooldown |
| v6_source_reservations | Unique replay-safe reservations and provider-header completions |
| v6_source_audit | Append-only source operational audit |

It creates4 functions (2 fixed-empty-search-path definer dispatch/control RPCs, 2 immutable/path helpers), 3 immutable triggers, 3 explicit supporting indexes plus primary/unique constraints, and one non-login/non-BYPASSRLS role `edgelab_v6_source`. All7 tables have forced RLS. Ordinary owners get SELECT on6 tables, never raw credential hashes; direct writes/deletion are not granted. Internal role policies exist only for a role not granted to authenticated/anon/authenticator. The owner RPC checks `auth.uid()`; capability dispatch validates token hash, pilot, stored owner, expiry/revocation before access. A narrow additional SELECT grant/policy on `historical_import_batches` lets the source owner RPC verify the existing owner anchor. It adds no grants to V5 financial tables and no memberships allowing callers to assume the role.

The original PAPER SQL remains byte-identical and **unapplied**:
`supabase/proposals/202611110001_v6_paper.sql`, SHA `c3a0d368ddbda1b50f3dab13aeec7cb3a939e423bce894aa1d55cfe9f13a3dff`.

No DROP/TRUNCATE/DELETE/reset/seed or existing-record rewrite appears in the new proposal. Additive DDL is one transaction; a collision/error must abort, not be bypassed. Role creation/ownership compatibility and actual catalog/RLS must still be tested on hosted Supabase after separate approval. PGlite is not hosted proof.

## Durable worker, leases, quotas and failures

`cloud/runner.server.ts` calls `runControlledTick` and `prepareControlledTeamPorts`, preserving models, source parsing, identities, quote cutoffs and result verification. It cannot construct an armed config or select a PAPER repository. The original local config/receipt hash is rechecked; the cloud transport is a separate operational layer, not a rewrite of that approval.

The separately recorded host-transfer receipt must match the exact checked-out code revision and the immutable initial transfer snapshot; it remains bound after later snapshots advance. Pending, missing or mismatched transfer authority blocks execution before any provider read.

The worker obtains a database row-locked10-minute lease with an incrementing fencing epoch and random lease ID, then reloads the latest snapshot/counters **after claiming**. A second active claim is rejected. Renewals occur before source reads and checkpoints. Stop, expiry, capability revocation or epoch mismatch rejects subsequent writes. An in-flight HTTP response may finish after a stop, but cannot publish a new snapshot under the lost lease. Process death leaves conservative reservations and a recoverable expired lease, never an automatic refund.

Each provider transport must make an atomic remote reservation before network access. Odds requests are limited to NBA Sportsbet h2h, the free catalogue and approved1–3 day score reads; BDL only Free teams/games. Shared usage uses max(reserved, provider-used), ceiling60, provider reserve100, and a verified500-credit free counter. Unknown headers/network failures leave uncertainty; a successful free catalogue check is needed before charged work resumes. Retries reserve again. BDL retains60/day,5/minute and12.5-second spacing plus provider cooldown. No API-NBA requests or extra sports are introduced by the cloud worker.

Objects and snapshot publication are separate: interrupted uploads can leave private unreferenced objects, but only one revision-checked transaction can publish a complete verified manifest. The prior snapshot stays current after failure. Replay cannot overwrite a frozen path or omit retained evidence. Source worker state containing PAPER positions/grades is rejected. A new model2 forecast's first cloud publication must still precede the earliest event clock by60seconds; a late upload is rejected, never backdated. Result corrections add distinct content-addressed records while preserving prior evidence. The original scheduler retains deadlines, retry limits and completed-run replay suppression.

The runner reads no source key while disabled. Workflow `v6-source-cloud.yml` defaults to skipped unless the enable variable is exactlytrue and the event is onmain. It uses the protected `v6-source-only` Environment, standard Ubuntu,15-minute timeout, read-only GitHub permissions, no persisted Git credential, no research artifact uploads and a no-cancel concurrency group. Workflow file SHA-256 is `6e52c1b009d59686c85357a16bc54acf8c40754cfccbbeadc07d886808a38128`. Checkout/setup actions are pinned to reviewed SHAs; checkout uses an owner-pinned40-character application SHA, and the entry point checks its actual Git HEAD. No pull-request trigger has secrets.

Wakeups are at UTC07:03–11:53 every10 minutes. This is a **proposed cloud wakeup cadence requiring host-transfer approval**; it does not change original job times, evidence clocks or120-minute catch-up deadlines. The engine executes only due work. Schedules can be delayed/dropped; missed jobs are retained honestly. Frozen forecasts are not manufactured from later results.

## Environment and credential placement

| Host | Names | Scope |
| --- | --- | --- |
| Vercel Production and exact Preview | NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Existing public project settings only |
| Vercel server | V6_EVIDENCE_MODE=cloud, V6_HISTORY_BATCH_ID | Existing private owner's archive anchor; not NEXT_PUBLIC |
| Vercel system | VERCEL, VERCEL_ENV, VERCEL_URL, VERCEL_BRANCH_URL, VERCEL_GIT_COMMIT_SHA | Platform-managed, not caller headers |
| GitHub repository variables | V6_CLOUD_SOURCE_ENABLED=false initially, V6_CLOUD_REVIEWED_SHA | Job admission and exact reviewed code; Environment variables are unavailable during job admission |
| GitHub protected Environment variables | V6_CLOUD_PILOT_ID, public Supabase URL/key | Exact reviewed code/pilot; enable only after approval |
| GitHub protected Environment secrets | V6_SOURCE_CAPABILITY, THE_ODDS_API_KEY, BALLDONTLIE_API_KEY | Owner-approved research-only capability and existing Free keys |

Do not copy source keys onto Vercel or into NEXT_PUBLIC variables, workflow YAML, repo files, logs or Actions artifacts. Creating/rotating/exporting production credentials is not authorised in this task. A future owner-issued capability expires no later than the pilot end, is scoped to one owner/pilot and can read/source-write only these tables. It has no user login, V5, PAPER, billing or model-activation capability. A/B/C remain independent.

## Private staging and owner-only provisioning

A local integrity-checked export exists under ignored `.local/v6/cloud-transfer/2026-11-12T14-12-46.025Z/`. Manifest SHA `a1d71651211ede1410903fe28f23b0240aded2b8e9262853bb7f797899e2b355`. Original counters remained10 reserved / 10 used / 490 remaining. The export is a **preparation snapshot, not a final host-transfer receipt**. The Mac was not stopped. API-NBA historical inputs/denial receipts are retained in the existing archive; no new entitlement or public redistribution right is asserted. Review the private file inventory and existing source-use evidence before approving cloud retention; the tooling will not upload without a separate explicit storage-only approval.

Safe offline commands:

```sh
node scripts/export-v6-cloud-state.mjs
node scripts/provision-v6-cloud-state.mjs --bundle .local/v6/cloud-transfer/2026-11-12T14-12-46.025Z
node scripts/check-v6-cloud-safety.mjs --bundle .local/v6/cloud-transfer/2026-11-12T14-12-46.025Z
node scripts/run-v6-cloud-source.mjs
```

The last command is disabled unless the separately approved Actions configuration is supplied. Export rejects an in-flight source job or changing scheduler/counters; it never stops the service. Provision defaults to offline validation. Its write mode additionally requires `--apply-stopped`, a private existing normal owner session file (0600 under `.local/v6`, never chat) and `--approval-file`. No passwords or service-role key are accepted. That approval must name exact project, SQL proposal hash, snapshot hash, source-rights review, actual recent approval time/reference, `storageOnly:true`, `cloudActivation:false`, `credentialIssue:false`. The normal token is verified with Auth and the archive anchor through RLS before any write. It leaves the source store stopped, issues no credential and reads the published hash back. Multi-request bootstrap can leave partial immutable uploads; reuse the same staging/pilot ID after inspecting the failure/audit. No deletion or implicit reset occurs. A changed final snapshot needs its own reviewed hash; never reuse an approval for different bytes.

## Exact approval boundaries and host handover

1. **S — source storage deployment:** review only the new 7-table SQL/hash/project and source retention scope. Approve DDL separately from owner data provisioning. Preserve owner backup; compare remote migrations/catalog, stage only this proposal as an approved migration and dry-run before applying. Never mix in the original PAPER SQL.
2. **Source provisioning:** approve the exact private manifest/inventory and stopped owner-only upload. After schema deployment, verify two normal accounts, anonymous rejection, object hashes, read-after-write/new-session persistence, immutability and rollback. Hosted tests are currently unexecuted.
3. Prepare a protected Actions Environment and reviewed default-branch workflow without enabling it. Any future merge/default-branch change needs owner authorisation. No schedule on this feature branch is asserted to execute.
4. Validate stored state from separate fresh runners with sources disabled; compare all hashes/counters/receipts. No key or production capability is created in this task.
5. **H — separate source-host transfer approval**, proposed exact scope:

   > Approve transfer of only the NBA Sportsbet full-game moneyline source-only pilot from the named Mac LaunchAgent to the reviewed GitHub Actions code/workflow SHA and private snapshot hash. Preserve canonical plan c81a3f7e…, original receipt c5f23605…, artifact 5bfe98cb…, 14 Nov 00:00–28 Nov 00:00 Melbourne exclusive end, maximum 50 additional/cumulative 60 odds credits and 100 reserve. Approve the reviewed ten-minute cloud wakeups, one narrow expiring source capability and private Free-key placement in the protected Environment. Authorise stopping/unloading only com.edgelab.v6-shadow-pilot, final quiescent snapshot/quota synchronization and activating exactly one source-only cloud host. No PAPER registrations/settlements, A/B/C, V5 changes, model promotion, paid APIs or external messaging.

   This is a **template, not recorded approval**. Populate actual future approval timestamp/reference, final full code/workflow/snapshot hashes and remaining allowance after local execution. The RPC transfer record binds plan/snapshot hashes and explicit `localStopped:true`, `localInFlight:false` attestations; the cloud cannot independently inspect the Mac. Never invent that evidence.
6. **Only after H:** engage persistent `.local/v6/source-pilot/STOP`; unload only the approved LaunchAgent; verify no process/provider/job in flight; export fresh state; compare counters monotonically; upload final snapshot and seed/sync quotas while cloud stays stopped. Initial sync never reduces counters and is forbidden after the first cloud activation epoch. Issue only the separately approved capability and owner transfer action; then enable the single reviewed workflow. The Mac stays stopped. No steps in this item were executed here.
7. Verify the first actual provider receipt, frozen cloud forecast, database publication, quota headers, scheduler audit, website projection and eventual exact-ID independent results. Do not report success from a configured cron alone. Original expiry remains firm; if insufficient time remains, request new dates/hashes rather than extending them.

Emergency stop: disable the repository enable variable **and** use normal owner `v6_source_owner` actionstop (invalidates epoch/lease); revoke the specific capability. Disabling a workflow alone cannot stop an in-flight API request. Keep all evidence/audits. Do not DROP/reset or restart the Mac automatically. Rollback requires review of cloud quiescence and the latest shared counters, a fresh private snapshot, separate authority to resume one local host, and a monotonic journal transfer. No dual-active journals. Source storage can remain private/read-only while the website is rolled back independently.

## Vercel Preview and eventual Production steps

No Vercel deployment was performed here. `vercel.json` now disables automatic Git deployment **only for feature/v6-autonomous-paper**, preserving main/default behavior. This lets explicitly authorised feature pushes remain separate from web release. Manual CLI Preview is deliberate; Production still requires approval. Do not merge or change Production Branch settings. First inspect project Settings → Git and the actual current Production Source SHA; leave settings unchanged. Use the exact post-sync tested implementation commit `2cd0d2805f1e2d5faeed91f33ca92587966b8812`, and confirm `git status --short` plus its full SHA. If the current checkout includes a later documentation commit, either review that exact additional commit too or prepare an isolated worktree at the tested target; never discard the current branch/worktree or deploy a different SHA implicitly.

With owner-approved Vercel access, use the existing project/scope (never create a second app):

```sh
npx vercel login
npx vercel link --project sports-model --scope alvinnnnnnnnnnnnn1s-projects
npx vercel deploy
```

Default CLI deploy is Preview, **without --prod** ([CLI deployment](https://vercel.com/docs/cli/deploy)). Confirm the dashboard labels it Preview and its Source SHA matches the reviewed target. Set Preview-scoped public Supabase configuration plus server-only cloud binding in Vercel first; do not copy `.env.local` or provider keys. Check existing Supabase Auth Site URL/redirect allowlist for the production callback and, if callback login is being tested, that exact Preview callback URL. Do not recreate/reset the existing owner account or use broad unreviewed redirect wildcards.

Inspect `/v6`, `/v6/research`, `/v6/models`, `/v6/positions`, `/v6/health`; verify anonymous401, cross-site403, normal owner access, wrong-owner403, expired401 and explicit unconnected503 before provision. The private endpoint's optional revision header should match Vercel Source. After approved provisioning, verify genuine immutable observations/models and empty unactivated paper ledger through normal owner RLS. Do not claim an actual Preview passed until it exists and has been tested.

**Production is a separate final approval:** review that exact successful Preview commit and environment scopes, then promote that reviewed deployment through Vercel or deploy the exact approved commit as Production. Do not change Production Branch/merge main implicitly. Do not publish a new commit without checking whether the feature branch itself triggers Production. V5 routes, signed-in workspace and existing Supabase records must pass smoke checks. No real data import is part of the web release.

## Verification and remaining blockers

Passed locally:746 Vitest tests/65 files, including source-cloud SQL, owner isolation, expired capabilities, lease fencing, immutable object/manifests, quota uncertainty/replay, snapshot rollback, independent fresh-runner recovery, source transports gated before I/O, exact HTTPS/Preview origin matching, private projection and empty paper accounting. Existing70 core+77 historical SQL checks also passed. Production build, TypeScript and lint passed. Browser suites passed22 V5/demo groups,11 intercepted Auth/form groups and8 intercepted V6/cloud UI groups. Stale legacy browser selectors were updated to the existing Placed earlier/Placed just now controls; the removed simulation action was replaced by a read-only synthetic-inbox invariant. One browser rerun during a rebuild timed out on analytics loading; a stable production-server rerun passed all22 groups. The current UI behavior was preserved. The staging integrity and compiled-secret/trace checks passed. No test required a new paid dependency.

Still **unverified hosted**: new schema/role compatibility, two-user source-cloud RLS/persistence, a real Vercel Preview/updated Production release, actual cloud capability issuance, GitHub Environment/secret scopes, default-branch scheduling, fresh hosted runner persistence, current free egress/capacity, first genuine cloud capture and result follow-up. Existing owner Production login is owner-verified; local mocked Auth tests do not retest their live session. Paper A/B/C, model promotion, source-host transfer and Hermes remain unapproved. Until S/provision/H/deployment are approved and accepted, turning off the Mac still stops research collection.


## Post-sync acceptance and remaining deployment evidence

A read-only `git ls-remote --heads origin` independently verified the initial 0934b2f feature/main 7814a1e refs. No initial uncommitted or unpushed changes existed. Main has not changed. The repository sync was successful; the website release is a separate issue.

Live anonymous and cross-site GET probes on13November returned403 with **Local same-origin access required**, without the newer revision/evidence headers. Thus the HTTPS fix has **not reached the live endpoint**. GitHub returned no Deployment API rows and no legacy deployment status for0934b2f; its checks were Vercel Preview Comments/success and Supabase Preview/skipped. A comments check is not proof of a deployed Preview. The last owner-inspected Production SHA remains73861e1 on the feature branch, while the previously reported Production Branch setting wasmain. Current exact Vercel Source SHA/settings cannot be reverified through available management access; inspect them before releasing. Do not infer the alias from Git HEAD.

The feature-specific automatic-deployment guard follows [Vercel Git configuration](https://vercel.com/docs/project-configuration/git-configuration). It changes neither Production Branch nor the running site. Do not remove it to obtain a green deployment check. An explicitly approved manual Preview/release remains necessary. Updated API revision headers will make its deployed commit observable once released.

Post-sync fixes preserve source/forecast identity and grading strictness:

- Revalidate owner, namespace, exact approval/code and fencing after lease acquisition. Failed second reads release the lease immediately. Even the idle scheduler fast path verifies the object hash and length before trusting its contents.
- Missing cloud provisioning now returns exactly **Cloud research evidence not yet connected**. Corrupt evidence/transport outages remain distinct generic unavailable states; owner/JWT/origin checks still precede reads.
- Team registry creation uses the worker clock. Result reconciliation obtains verification time **after** receiving the independent response, rather than treating a valid later receipt as future evidence. Original quotes, forecasts and nullable publication timestamps are unchanged. No result or price criterion was relaxed.

### Reproducible separate-process lifecycle

```sh
node scripts/check-v6-cloud-runners.mjs
```

This executes eight separate Node workers in eight fresh empty working directories with no environment file or original private archive. All sport transports are intercepted into loopback synthetic responses. A private disposable test relay retains objects/manifest/quota state and restarts its listener between workers. The actual source adapters, scheduler, independent numerical models, freezing, result reconciliation and fixture-level evaluation run.13 groups passed: capture, immutable source publication, replay suppression, two-source final verification, one fixture/nine model-and-market scores, original byte preservation, zero paper positions/grades, cumulative synthetic odds counters10→13, missed deadlines without late reads, emergency stop, expiry and fresh process isolation. This is **durable mock transport proof, not hosted Supabase persistence proof**. The exact SQL and normal-role boundaries are separately exercised by the PostgreSQL tests. No synthetic evidence enters `.local/v6` or an account.

Full post-sync checks:746/746 tests, 65 files;70 core + 77 historical SQL checks;10 source-schema compatibility checks;22 V5 + 11 Auth + 8 V6/cloud browser groups; TypeScript, lint, production build and five secret/trace/staging safety groups. Real hosted source persistence, current Vercel management state, an actual updated Preview and actual cloud execution remain unverified.

### Retention review is now bound to staging

A fresh local export exists at ignored `.local/v6/cloud-transfer/2026-11-12T21-40-02.656Z/`. It has the same174file references/172objects/37,701,100bytes and unchanged snapshot SHA `a1d71651211ede1410903fe28f23b0240aded2b8e9262853bb7f797899e2b355`. New `retention-inventory.json` SHA is **`8416185b74103ad9f3cc3d67c13dee2f9288bd94b0900ddd50fb96c9119e8f8f`**. The inventory classifies provider receipts, training histories, model development, observations and operational/derived data, retaining known provider terms references and API-NBA historical-access restrictions. Every file still requires owner retention review; references are not a grant of rights. It includes no raw bodies or source credentials. Nothing was uploaded.

New provisioning requires the exact inventory hash in addition to proposal/snapshot hashes and the existing explicit storage-only approval. Old staging directories remain untouched; regenerate an inventory before attempting their future approved upload. The SQL proposal is unchanged at **7a03d765…caf451**; PAPER SQL remainsc3a0d368…a3dff. Cloud enablement remains false. The Mac source LaunchAgent remains loaded, with exit0 between waiting ticks; source counters remain10 reserved / 10 used / 490 remaining. First genuine capture remains14 November19:00 Melbourne. No date, quota or model artifact changed.
