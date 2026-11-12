# V6 deployment approval package — 12 November 2026

**NO-GO for production activation today.** Local code, reconciliation and atomic SQL tests are implemented; model review, scoped credential issuance/renewal and hosted acceptance remain open. This package grants no deployment, registration, scheduling or messaging authority. No paid service is required or enabled. No Hermes.

## Exact database scope

- Target: existing Supabase project **`ilgoswfckkzpoktabbfi`**. A fresh read-only `npx supabase migration list --remote` confirmed only `202611030001`, `202611030002`, `202611040001`. It did not run a push or a complete hosted catalog/security test.
- Proposed migration source: [`supabase/proposals/202611110001_v6_paper.sql`](../supabase/proposals/202611110001_v6_paper.sql), SHA-256 **`535df727704be74882c97f966466965d3993255bd5d9b09cc5f17257c753ec5c`**. It remains **outside migrations and unapplied**. Supersedes local `bac90244…`, never deployed.
- Relative to deployed SQL: ten new private `v6_` tables, indexes, owner RLS, same-owner FKs, immutable/audit guards, model/policy/control registry, deterministic NUMERIC accounting and registration/grade/quota/summary RPCs; a non-login/noinherit `edgelab_v6_worker` role with no V5 grants. No existing application table/row is changed, no seed, DROP, TRUNCATE or reset.
- Delta against the last local review: stricter Elo-only sixty-second pre-event buffer; typed multidimensional baseline-review checks; `v6_worker_identity`, `v6_load_worker_state`, `v6_commit_worker_run` and control-update serialization. Exact diff: `git diff 88bdd7f -- supabase/proposals/202611110001_v6_paper.sql`. The full linked SQL is the complete intended additive schema diff relative to the versioned three-migration baseline; remote catalog/role compatibility must still be checked before deployment. Do not confuse the prior-proposal diff with an already-deployed migration.

Only after explicit approval of this exact file/hash/project: preserve backups, copy **only this proposal** into `supabase/migrations/202611110001_v6_paper.sql`, verify its SHA again, compare local/remote history and run `npx supabase db push --dry-run --remote`. Stop if anything other than the approved migration appears. Apply with `npx supabase db push --remote` only within that exact approval. No reset/seeding/role synchronization. No such copy or push has been done.

## Restricted authentication and storage

`supabase-repository.server.ts` implements a real PostgREST repository for the existing V6 worker interface. Requests go only to three `v6_` RPCs on the exact configured project. The client rejects personal `authenticated`, `service_role`, wrong-owner/project/issuer and expired/near-expiry tokens before transport. Claim parsing is **not** signature verification: PostgREST must verify the signed JWT, then `v6_worker_identity` checks `current_user=edgelab_v6_worker` and the exact `auth.uid()` owner. Every access repeats that probe. Revoked access rejects without echoing response bodies/tokens.

The future worker JWT must have the existing owner's subject, restricted role, project issuer/audience and short expiry. This is a **separate restricted credential**, not the owner's normal browser token, password, service key or a replacement account. The public Supabase publishable/anon key remains public. The private access token is read from a 0600/0400 file inside `.local/v6/`, can rotate atomically between ticks and is never logged or put in `NEXT_PUBLIC` variables. The worker never imports a V5 repository.

**Still missing:** an owner-approved trusted issuer/renewal service for those restricted tokens, actual hosted custom-role compatibility and revocation tests. The application does not mint tokens or possess signing/service-role secrets. The migration deliberately does not grant worker membership to PostgREST's `authenticator`. If choosing this design, separately review/provision the trusted issuer and `GRANT edgelab_v6_worker TO authenticator` through the project's authorised admin process; never grant the worker role to `authenticated`. Do not paste credentials into chat. No role membership, signing-key setup, test account creation or token issuance was performed here. The local filesystem repository remains available independently, but is not claimed as hosted Supabase verification.

Private config can opt into hosted storage after provisioning with `persistence: {kind: "supabase", projectRef: "ilgoswfckkzpoktabbfi", workerTokenFile: ".local/v6/worker-session.json"}`; default is null/local. Session file shape is `{ "accessToken": "<restricted rotating token>" }`. The existing `.env.local` supplies the public project variables and server-only sports keys; do not change/recreate the personal account. Disabled/source-off operation makes no hosted or provider request. No production session file was created.

## Atomic writes, clocks and recovery

One worker run is one `v6_commit_worker_run` transaction. A per-owner advisory lock and expected run revision serialize concurrent commits. It verifies original raw-source hashes, calls guarded registration/grading functions, appends the run and server audit, and returns read-back state. Old arrays are never overwritten. Same-run replay binds the **entire request hash**, not just its ID. Changed requests/stale revisions reject. Server-generated registration times and original forecast deadlines prevent backdating. The model formula, original price, market and quality checks execute again in SQL.

Control updates use the same lock: an owner emergency stop cannot silently race an atomic batch. A late invalid grade rolls back earlier observation/position/audit/run inserts. Lost responses are ambiguous, not proof of failure: reread first; an already committed run returns `already_processed` before new source collection. Grade revisions preserve immutable position hashes; identical result bytes do not repeat P/L. SQL validates hashes/identity/revisions/outcome consistency; it does not independently fetch a sporting result. The worker's result adapter corroborates the exact retained events and applies the versioned reconciliation policy.

## Unattended installation — instructions only, not executed

1. Finish the model/source/auth/host acceptance gates below. Use this existing branch and npm installation on one awake host with reliable connectivity; the Node worker does not need a browser, ChatGPT or `npm run dev`.
2. Copy the disabled `ops/v6-controlled.config.example.json` to `.local/v6/controlled-config.json` **without overwriting an existing config**, chmod 600, and enter the existing owner's UUID. Keep `mode=disabled`, `killSwitch=true`, `sourcesEnabled=false` while preparing. Set reviewed manifest/receipt paths inside `.local/v6/`; never invent approvals. Configure local versus restricted Supabase persistence explicitly.
3. Safe one-shot checks: `node scripts/run-v6-controlled.mjs --config .local/v6/controlled-config.json --once`, then `--plan` and `--health`. They must show disabled/no calls. `--health` displays sanitized shared odds/BDL quotas without reading token files or sending requests.
4. After **separate scheduler installation approval**, copy `ops/com.edgelab.v6-controlled.plist.example` to a private staging file. Replace `REPLACE_WITH_ABSOLUTE_NODE_PATH` with `command -v node`, project path with `/Users/asan/SportsModel/SportsModel`, and both log paths with private files under `.local/v6/`. Keep logs/config readable only by the owner. Validate with `plutil -lint <staged-plist>`.
5. Install only that reviewed file at `~/Library/LaunchAgents/com.edgelab.v6-controlled.plist`, then `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.edgelab.v6-controlled.plist`. Verify with `launchctl print gui/$(id -u)/com.edgelab.v6-controlled`. These commands are **not executed by this task**. Keep controls disabled through the first launch/reboot/health test. RunAtLoad plus a sixty-second tick actually calls the registered worker; it is not a ChatGPT reminder.
6. Only after exact source/model/standing-policy approval, enable the reviewed config. A source-only alternative uses `mode=dry_run` with the separate expiring `edgelab.v6-shadow-collection` receipt in `activationReceipt`; it cannot arm paper, approve a model or settle positions. Its source-rights/policy/owner/budget/expiry binding is enforced before preparation and again at commit. No real collection/activation receipt was generated here.

The scheduler plans Melbourne 19:00 discovery, 18:00 results and grouped pre-start refreshes. Durable leases/retries recover interruptions; expired pre-start deadlines become missed, never backdated. Results must be checked inside the three-day source retention window. A sleeping/offline local Mac is not an always-on production guarantee; a reviewed headless host may run the same one-minute `--once` command, but no hosted/Linux service is installed or tested. Restricted-token renewal must also be unattended before claiming production autonomy.

## Quotas, diagnostics and stop

All source instances share `.local/v6/odds-shared-budget.json` and `balldontlie-team-budget.json` locks. Ten odds credits remain used, 490 available; no new sports calls this continuation. Proposed controlled allowance defaults to 300/month, maximum 400 with reserve 100, and needs exact paper or separate collection approval. BDL is paced below five/minute with the existing 60/day local safety allowance. Provider/body/retention/CPU limits are operational controls, not caps on qualifying paper positions. More than one host with separate counters is unsupported. Hosted quota tables exist in the proposal but are not a replacement for the current single-host source-key budget.

Current features and catalogue refreshes use the same source quotas; canonical catalogue refresh is automatic after seven days only if the native IDs/codes/names remain unchanged. Changed membership blocks for identity review. Original datasets stay read-only. Health, job history, result diagnostics and failure outbox remain local; external alerts are **not delivered**, and no Hermes/push is claimed.

Emergency stop: set `killSwitch=true` or `mode=disabled`; the pre-source gate and commit latch stop the worker. For hosted operation also set the existing owner's V6 control to disabled/kill-switch using authenticated owner access. The SQL serialization guard prevents a stop/commit race. Stop the installed job with `launchctl bootout gui/$(id -u)/com.edgelab.v6-controlled`; this affects only that future V6 agent. Keep evidence/checkpoints. Review failures and quota reservations, refresh only legitimately expired credentials/evidence, then re-enable only the previously approved configuration. Never reset counters, backdate missed work or delete audit history.

## Backup and backout

Before any approved deployment, retain a fresh owner-controlled complete legacy export and a private copy of `.local/v6/` (raw evidence, immutable dataset, proofs, decisions, approvals, state, scheduler and quota journals). Confirm their hashes and file permissions. No new historical/financial record or deposit is part of this package. After hosted operation, a V6-only worker state read plus its raw-evidence backup is required; the legacy export alone does not back up these new tables. No backup/restore portability beyond the current schema is claimed tested.

Pre-commit DDL failure: stop, retain the error and roll back the transaction. After committed deployment: disable/revoke **only V6 worker** access, leave all V6 tables/audits read-only for investigation and preserve V5 untouched. Revoking the future worker membership/issuer is an admin action requiring approval. Do not DROP/TRUNCATE/reset or reseed. Use separately reviewed additive corrective SQL.

## Acceptance and approval boundaries

| Evidence | Actually demonstrated | Remaining gate |
| --- | --- | --- |
| Synthetic local scheduler lifecycle | Source-shaped snapshots, two-pass qualification, immutable A$50 entry, reconciled final, P/L, restart/replay, stop, retry, quotas | Not a genuine registered position |
| Genuine original shadow | 10 fixture outcomes/20 selections verified through separate decisions, Brier/log loss/calibration; zero paper P/L | Still excluded observations; never register retrospectively |
| PostgreSQL roles/atomicity | Nonprivileged owner/other/anon/worker checks, V5 denial, immutable data, late-write rollback, request replay/CAS and settlement | Local embedded PostgreSQL, not hosted JWT/RLS proof |
| Scoped transport | Restricted role/owner/expiry checks, server identity probe, atomic RPC, 401 and lost-response handling | Mocked network; issuer/renewal and real hosted access unverified |
| Genuine registered future paper lifecycle | **Not demonstrated** | Reviewed model/standing policy, provisioned host/auth, approved source collection, future pre-event registration/result acceptance |

Separate exact approvals required:

1. **Schema only:** deploy only the above SQL/hash to `ilgoswfckkzpoktabbfi`, with no seed/reset or V5 writes. This does not activate anything.
2. **Scoped authentication:** approve the restricted issuer/renewal design and narrowly scoped authenticator role membership, then verify two-user hosted access without service-role bypass. This is not a request to recreate the personal account.
3. **Optional shadow collection:** approve the exact source-only policy hash, owner, monthly budget, expiry and scheduler installation for observational evidence. No model or position approval follows.
4. **Paper activation later:** review sufficient baseline evidence, exact model/readiness manifest, source rights/quotas, standing-policy bundle and host tests; then explicitly authorise unattended paper registration/grading. Current ten fixtures/one slate do not pass the proposed thirty-fixture/five-slate floor, and counts alone never suffice. There are no per-position approvals once a valid standing policy is activated.

No approval is inferred from this document, old forecasts, passing tests or user account activation. A$5,000 nominal opening equity, fixed A$50 and unlimited distinct qualifying positions remain unchanged. No paid API, real-money execution, bookmaker account access, V5 edit or Hermes activation is included.

Current **unapproved** policy-bundle SHA-256: `ab421cedaa7060513b3bbcb01d80350ae6d64d7e4f87e2eefa643594f28d66bc`. It binds financial/selection/control/model-readiness/collection/fixture/reconciliation/catalogue/settlement terms. Changing any bound policy invalidates prior receipts. Elo candidate definition SHA-256: `ee61e69d684fd15862f9fdd0335f0f9359743aa8377911103451909e2d8fb564`.

The latest local model draft is `.local/v6/activation-review/elo-only-candidate-1-draft-0a811661a3a5358cf4217054ccfe911a773374870c9492472a4f37b0713a3be4.json`. It references the genuine reconciled evaluation (JSON-byte SHA-256 `df528de6f658ae2960ffde75a87bfe201bc36b1017608ce05c4134ef38ea044e`), records ten fixtures, and retains null approvals/readiness review. It is not an activation receipt.

Executed verification: `EDGELAB_POSTGRES_RUNTIME=/private/tmp/edgelab-db-validation npm test` passed **682/682 in 54 files**, no skips. Core/history SQL scripts passed **70 + 77** assertions. TypeScript, lint, production build, four Daily Cycle plus six reconciliation browser groups, disabled CLI/plan/health, launchd syntax and offline reconciliation replay passed. Browser tests intercepted synthetic transport and used no personal session/hosted writes. Worker JWT transport tests were mocked; V6 role/atomicity tests were embedded PostgreSQL. These successes do not establish hosted custom-role authentication or a genuine registered-paper lifecycle.

Code commits: `5423a6d` (event reconciliation) and `78035c5` (atomic persistence, model/collection gates and tests). No dependencies changed. Original dataset/shadow and all three deployed migration files remain unchanged.
