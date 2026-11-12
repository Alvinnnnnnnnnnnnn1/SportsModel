# V6 production decision package — 12 November 2026

**LOCAL PREFLIGHT PASSED; NO HOSTED DEPLOYMENT OR ACTIVATION AUTHORISED.** Read the [SQL/security audit](v6-security-preflight.md) and [proposed experimental policy](v6-experimental-paper-policy.proposed.md). The twenty immutable observations remain outside paper positions/P&L. V5, Methodology Revision1, the existing private account and all deployed migrations are unchanged.

## Approval A — hosted schema only

Full reviewed candidate path: `/Users/asan/SportsModel/SportsModel/supabase/proposals/202611110001_v6_paper.sql`.

SHA-256: **`c3a0d368ddbda1b50f3dab13aeec7cb3a939e423bce894aa1d55cfe9f13a3dff`**.

Target: **`ilgoswfckkzpoktabbfi`**. The file is **outside migrations, unapplied**. Its eventual deployment path is `supabase/migrations/202611110001_v6_paper.sql`, created only after A. The original requested `535df727…753ec5c` hash matched and was separately executed/audited locally; it is superseded, not approved or deployed. Diff: `git diff 2c94865 -- supabase/proposals/202611110001_v6_paper.sql`.

Scope: **eleven new V6 tables, twenty-one functions, twenty-three triggers, thirteen policies, nineteen indexes including constraints**, plus a non-login limited worker role. The eleventh table stores hashed owner-scoped worker credentials. Four tightly scoped definer functions run as that limited role; all other functions are invoker. Existing application/history tables, functions, grants, policies and records are not altered. No seed, DROP, TRUNCATE, reset, Auth account creation or paid service. An existing same-name worker role aborts instead of being reused or modified.

A adds capability enrollment and experimental-tier support but creates **no credential, model, policy activation, position or schedule**. Normal private login, A$500 cap, A$5 usual V5 stake, cash/bonus/paper separation and zero evidenced deposits remain untouched. Authenticated owners retain their existing normal application permissions. No V6 role is granted to `authenticator` or `authenticated`.

After exact approval: take backups, verify linked project/history/catalog/role compatibility, copy only this proposal to the stated migration path, verify SHA, then `npx supabase db push --dry-run --remote`. Stop if anything else is pending. Actual `npx supabase db push --remote` is allowed only within explicit A for the exact hash/project. No such copy or push was performed by this task. Any changed hash needs a fresh approval.

## Hosted authentication and enrollment

**Preferred design: opaque, revocable capability; no project signing/service key in worker.** Supabase Auth verifies the existing owner's one-time enrollment/rotation/revocation actions. The unattended worker uses its separate capability through an anonymous-public-key RPC which checks stored owner, SHA-256 secret, scope, expiry and revocation before any V6 operation. RLS then runs under the non-login V6 role with claims bound from the stored owner, restored on success/exception. See [the audited trust boundary and intentional internal hash lookup exception](v6-security-preflight.md).

After A and explicit owner setup action: existing private Settings → **V6 restricted worker access · advanced setup** → Check worker credentials. Choose research-only by default, or paper-worker scope only for separately reviewed paper operation. Acknowledge and create/download; rotation can atomically revoke a selected previous credential. No secret is shown in page text or later metadata. Creating it does not enable B/C. If creation/download is ambiguous, check metadata and revoke the unwanted credential before retrying. No password, access token or credential belongs in chat.

Move the one-time download into `.local/v6/worker-credential.json` and run `chmod 600 .local/v6/worker-credential.json`. Configure `persistence: {kind: "supabase_capability", projectRef: "ilgoswfckkzpoktabbfi", workerCredentialFile: ".local/v6/worker-credential.json"}`. Existing public Supabase environment variables and server-only sports keys remain as configured. The CLI rejects credential files outside private `.local/v6/` or readable by group/others. It rereads a rotated file on each access. No browser session/daily login is required for worker operation.

Default credential lifetime is thirty days, maximum ninety. Expiry stops access; periodic owner rotation is required. This is not indefinite automatic renewal. The credential can operate only on its owner's V6 state and cannot issue credentials, enable models/controls, disable audits or write V5 cash/funding. `research_only` cannot register or settle positions. Revocation affects only the worker credential, not the personal account/login.

The old JWT transport remains regression-compatible in the library but is **not the approved provisioning route**. Do not distribute project signing keys, use service-role keys, or grant worker membership to an API role to make it work.

## Approval B — experimental qualification policy only

Review [nba-experimental-paper-1](v6-experimental-paper-policy.proposed.md) and its generated draft. It uses frozen Elo-only/candidate1, reproducible inputs, chronological evaluation, immutable feature/quote clocks and disclosed uncertainty. It does **not** require prior sportsbook profitability or thirty prior prospective wins. It does not claim calibrated probabilities, profitability or Tier1. The higher-evidence cohort retains its separate review gate; no model has been promoted into it.

Source/identity/freshness/likelihood/price/EV/sensitivity rules remain strict and unchanged. B must name the exact model definition, experimental review/manifest and current bundle hash; it permits only prospective experimental PAPER qualification. Any approved registry record must be written using the normal authenticated owner and the exact reviewed data. Keep hosted controls disabled and local kill switch true after B. No real approval record was created here. **B does not install/start C.**

A$5,000 is one nominal reference, fixed stake A$50, unlimited distinct qualifying positions, no daily count/exposure/balance gate. Experimental and stronger-evidence performance are separate; old forecasts cannot be relabelled or retrospectively registered. Actual wagers and V5 remain manual and untouched.

## Approval C — unattended PAPER worker installation and activation

Only after A, successful hosted acceptance, B, source/permission/quota/host review and scoped credential enrollment:

1. Use this branch, the existing Node/npm installation and one reliable awake host. No Next dev server, browser or ChatGPT prompt is needed by `scripts/run-v6-controlled.mjs`.
2. Preserve any existing config. Copy `ops/v6-controlled.config.example.json` to private `.local/v6/controlled-config.json` only if absent; chmod600. Set the existing owner UUID, exact reviewed manifest/receipt files and capability persistence. Keep disabled/kill=true/source=false through preparation.
3. Run `node scripts/run-v6-controlled.mjs --config .local/v6/controlled-config.json --once`, then `--plan` and `--health`. Disabled mode sends no hosted/provider requests and reads no credential file. Health shows sanitized shared quotas.
4. Prepare `ops/com.edgelab.v6-controlled.plist.example` with absolute Node path (`command -v node`), project path and private stdout/stderr paths. Validate `plutil -lint <staged-file>`; install only the reviewed file at `~/Library/LaunchAgents/com.edgelab.v6-controlled.plist` after C. Then `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.edgelab.v6-controlled.plist`; inspect with `launchctl print gui/$(id -u)/com.edgelab.v6-controlled`.
5. Prove disabled launch/reboot/health first. Only the approved C action enables hosted controls and sets local armed/kill=false/source=true. The sixty-second scheduler tick actually invokes the registered worker: Melbourne19:00 discovery,18:00 results, grouped pre-start refreshes, durable leases/retries/deadlines and idempotent runs. It is not a ChatGPT reminder.

No job is installed by this task. A sleeping/offline Mac cannot guarantee retention windows; Linux/hosted uptime remains untested. Same-host quota files are authoritative: existing odds usage ten/500,490 remaining; controlled allowance defaults300/max400 with reserve100 and exact approved receipt. BDL remains paced below five/minute with a60/day local safety allowance. Operational quotas never cap already-qualified position count. Multi-host collection is unsupported. A source-only dry-run schedule is a separate narrower C choice and cannot register positions. No Hermes or external notifications.

## Atomic writes, stop, recovery and rollback

Each worker batch uses one SQL transaction, owner lock and expected run revision; server-clock registration, exact formula/market/price guards, original-source/input hashes and full-request replay hashes remain. A late failure rolls back source/position/audit/run writes together. Grades use immutable position hashes and append revisions; identical result replay cannot double profit. Credential/owner locks serialize stop/revocation; expiry is checked before returning. SQL does not independently fetch a sporting truth: the trusted read-only collector and corroborating grader remain required.

Emergency stop: local kill=true/mode=disabled; hosted owner control disabled/kill=true; revoke the worker credential through its owner UI. Stop only the future V6 agent with `launchctl bootout gui/$(id -u)/com.edgelab.v6-controlled`. Preserve every row/audit/source/checkpoint. Lost responses require read-back before retry. Never reset quotas, backdate a missed run or blindly repeat an import.

Pre-commit DDL failure rolls back the entire role/schema/grants, verified for both original and candidate SQL. After committed deployment, backout means stop/revoke V6 only and preserve all tables/audits for investigation. Use separately approved additive corrective SQL; no DROP/TRUNCATE/reset. Do not restore a revoked credential to active status.

## Backups and restoration

Before A: fresh owner-controlled complete legacy export, private `.local/v6/` copy, SQL/hash/catalog baseline and current free source quota journals. The legacy export alone does not include future V6 tables or credentials. Preserve private permissions/encryption for any capability files; plaintext secrets are not recoverable from database hashes.

After V6 deployment: capture owner-scoped V6 state, policies/models/controls, raw evidence/proofs, scheduler/quotas, grade/audit history and credential metadata separately. Restore first into an isolated database at the reviewed schema version; compare counts/hashes and recompute equity/ROI before any approved live restore. Preserve original IDs/timestamps and append-only chains. Revocation state must not be rolled backwards; revoke restored/uncertain credentials and issue fresh ones before reconnecting an approved worker. Never restore V6 data into V5 tables. No live restore/backup reset was executed or claimed tested; local DDL rollback and operational non-destructive stop were tested.

## Exact post-A acceptance gates

- Verify eleven V6 tables, thirteen policies, twenty-one fixed-path functions/four limited-role definers, twenty-three triggers, indexes/constraints and zero existing schema/data changes. Check actual hosted role transfer/default ACL behavior and no API-role membership.
- In the existing normal signed-in owner session, explicitly issue a research-only credential; verify metadata/reload, rotation/revocation and the one-time private file. Test missing/expired/revoked access, cross-owner expectations and a second ordinary user context without service-role bypass. Do not create/reset the personal account or copy test-account data.
- Read empty V6 state; verify no cash/funding/history mutation and no model/controls implicitly enabled. Confirm public callers without a valid capability cannot access private state; other direct anonymous V6 table/function access must reject.
- Inspect hosted request/log handling for credential redaction and test multi-connection rollback/CAS/stop behavior. Local mocks do not prove these.
- Actual fresh pre-event source-backed paper registration, result and P/L acceptance waits for B **and C**, not synthetic records in the real account. Zero qualifying candidates is valid. Never use the twenty old observations as positions. Malformed/synthetic payload negative tests must leave no rows.

**Decision:** ready to review A's exact schema scope, not permission to deploy it. B is a proposed experimental policy, C remains disabled. Hosted platform compatibility, real two-user auth/atomicity/logging and a genuinely registered future-paper lifecycle remain unverified. A stolen capability can poison V6 research under its active scope; byte hashes are not upstream digital signatures. Protect/revoke credentials and retain source provenance. These are residual risks, not claims that passing local tests proves production security.

## Verification receipt and exact B review artifact

- Full suite: **690/690 tests,56 files,no skips** with the embedded PostgreSQL runtime; updated rollback/reapplication, foreign-winner rejection and secret-bearing parse-error redaction passed. Original535df and current c3a0 SQL were both actually migrated in isolated databases, with late-failure rollback and preserved legacy sentinel fingerprints. The capability-backed synthetic lifecycle waited for actual server clocks; it did not disable guards/backdate evidence.
- **147** core/history SQL assertions (70+77); **14** intercepted browser groups (4 Daily Cycle,6 reconciliation,4 credential enrollment/privacy/revocation/demo isolation); TypeScript, lint and production build passed. Disabled CLI and launchd syntax passed. Browser requests used synthetic identities and no hosted writes. A browser assertion was corrected to wait for asynchronous revocation completion before checking its counter.
- Fresh remote history confirmed project `ilgoswfckkzpoktabbfi` and only `202611030001`,`202611030002`,`202611040001`. The candidate remains outside migrations. No actual credential, policy/model approval, schedule or notification was created. Protected dataset/shadow and V5/deployed migration files are unchanged; no dependency change or sports API read.

Current **unapproved** bundle SHA-256: `a5a80cfeea36147279f1a58294cf2793ff43fcf535353382c4498a9bf726c398`. Initial Elo definition SHA-256 remains `ee61e69d684fd15862f9fdd0335f0f9359743aa8377911103451909e2d8fb564`.

Implementation commit: `de5d774`, branch `feature/v6-autonomous-paper`. New security/credential/policy code is committed; deployment remains a separate action.

The local experimental review is `.local/v6/activation-review/elo-only-candidate-1-draft-4bad9a2eefe8618804a34bb2f54b0ca62b2690cd54cafd5cd283b8355e8f0b56.json`. Its accepted manifest is still draft/null-approved/null-review; proposed review fields are outside it. Proposed review SHA-256 is `36cb3d916484f9a6387a1bf7727dbfc72bf5df255dfd53bfe476d538791682b0`. B must review these contents and the final approved manifest separately; a developer-created proposal is not an owner approval.
