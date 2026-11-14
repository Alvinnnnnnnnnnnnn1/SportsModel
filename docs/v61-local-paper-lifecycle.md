# V6.1 local PAPER lifecycle — 14 November 2026

Implemented on `feature/v6-1-local-paper-dashboard`, based on UI commit `037d8b78d434a4c790703e9655cefdbfced3f4c3`. PR #1 and both earlier branches remain intact. This branch targets the UI branch as a stacked change; it does not merge or deploy anything.

## Actual operational evidence

The offline audit at **14 November 14:11:29 AEDT** retained `.local/v6/v61-audit-20261114.json`. At that point the sole LaunchAgent was loaded, interval60 seconds,1030 process invocations and last exit0. `state=not running` describes the interval between ticks, not an unloaded job. The scheduler had no failed/missed jobs, no actual scheduled research/result invocation yet, and the18:00/19:00 jobs were still pending. Later read-only log inspection at14:23 showed `idle`, `workerInvoked:false` and `no_registered_positions`; stderr was empty. No process was started/stopped/reloaded by this task.

| Genuine local P0 evidence | Verified value |
| --- | --- |
| Original forecast cutoff |14November12:48:05.347 AEDT |
| Fixtures |5, BDL IDs21718104–21718108 |
| Numerical outputs |80 across two correlated artifact lineages/eight methods; not80 independent games |
| Qualifying / registered positions |0 /0 |
| Settled positions |0 |
| Hypothetical equity |A$5,000 nominal opening reference; not money deposited or a sportsbook balance |
| Pending exposure / realised paper P/L |A$0 /A$0 in the verified empty journal; website says No settlements |
| ROI / local Brier / local log loss |Unavailable; no settled registered sample |
| Retained Odds quota |11 used/reserved,489 provider credits remaining;49 under the approved cumulative60 ceiling |
| Retained BDL quota |3 requests on UTC14November |
| Additional provider requests / new paper writes this task |0 /0 |

No attributable Sunday Sportsbet quotes were captured for the five fixtures. Their intervening games were unfinished at the original cutoff. High numerical win probabilities therefore did not qualify. The original forecasts remain provisional research; neither elapsed time nor old ten-game observational results settle these fixtures or create positions.

Actual commands executed:

```sh
node scripts/replay-v6-local-paper.mjs
node scripts/execute-v6-local-paper.mjs --status
node scripts/execute-v6-local-paper.mjs --settle
node scripts/execute-v6-local-paper.mjs --status
node scripts/check-v61-local-lifecycle.mjs --report .local/v6/v61-audit-20261114.json
```

Replay reproduced all80 outputs exactly, maximum difference0, from the original cutoff/source inputs. The fresh status processes agreed on revision1/head `b546f3acc82aec0ffe9d273ba93685b88f07bd2c1e08bcca5a978af002b4c916`. Settlement returned `no_registered_positions`, grades appended0. The original seal remains `271fd7d2ca65ae6a6898bb91dc42663f93d00c57ac7310bb9285eea0e8ee2915`. Original report SHA remains `78007c7b6eddbe59d91356ed5c987b65c71d185c5a13724af9f87a80e97d1fbb`. Source config/receipt/plan, dataset and permit bytes remain unchanged. The audit file is exclusive-create, private and not served to browsers; choose a new report filename for another audit.

## Working read-only dashboard

Use the existing private account at `http://localhost:3000/v6`; refresh or Reload snapshot. No account recreation, import or settings write is needed.

- **Dashboard:** real local journal equity/positions/exposure, nominal reference, generated fixture/output counts, successful retained source capture, last independently verified settlement, bounded permission expiry and next retained scheduled operation. A loaded LaunchAgent, saved mode and scheduled job are not represented as proof of sporting execution.
- **Research:** ten original home/away rows for the five P0 fixtures, plus the earlier separate archives. Upcoming counts use retained BDL fixture IDs where available, so an unmatched original capture and a later Odds-ID match do not count the same game twice; every capture still remains visible. Original control and experimental BDL-lineage probabilities, model hashes, exact source/forecast/input-cutoff/freeze clocks, provider event IDs and exclusions survive. Missing prices remain null with No attributable quote; no synthetic EV or bookmaker timestamp is supplied. Filter Upcoming to inspect the future retained fixtures.
- **Paper Ledger:** positions come only from the committed local journal. Currently zero. Future supported rows retain exact market, quote, forecast/model/version, stake, registration/cutoff clocks, actual grade/settlement clock, hypothetical return, running equity and shared-fixture correlation group. Financial calculations reuse the existing deterministic cents engine. Grade corrections replace prior P/L contribution; they do not double returns or opening reference.
- **Model Analytics → Bounded local PAPER:** separate registered-fixture scores and calibration. One earliest registered forecast per independently corroborated fixture is the primary unit. Matched archived BDL challenger and original de-vig bookmaker prices are scored only where available; they are never promoted. Currently all local metrics are unavailable. Existing historical/observational model charts are unchanged. NBA full-game moneyline is the only supported local domain; NBL/ATP/WTA are not represented as operational feeds.
- **System Status:** existing scheduler/source/quota records plus local permit/expiry, settlement consumer mode and journal head/revision under Technical details. No activation or emergency-stop write button was added.

## Security and failure behaviour

`local-paper-view.server.ts` is a fixed-path, read-only projection behind the unchanged normal Auth + RLS-owned archive-anchor check. The local source namespace must match the approved pilot binding; it is not an Auth identity or hosted principal. Other users fail the endpoint owner check and mismatched journal/permit owners fail independently. No service role is used.

The reader validates original source/seal/capture/permit hashes, source receipt origin/raw hashes, exact quote/fixture identity, policy qualification, model inputs hash, committed research runs and all journal revisions. Pending positions require their immutable original proof. Settled rows additionally replay the ordinary grade checks and reproduce the independent source reconciliation from retained scores and BDL receipts. Missing/disagreeing/mutated finals cannot produce displayed profit. Both exclusive selections from one game never count as two independent scoring units. No provider is queried during projection or grading replay.

The journal now exposes a single-read state/head snapshot and refuses symbolic-link revision files. The projection also refuses symbolic-link paths, missing committed journals, future clocks, invalid evidence and oversized display inputs. Those are read/diagnostic limits, not admission caps on paper volume. Missing/incomplete evidence produces unavailable/invalid, never a fabricated zero. A second nonempty owner repository is not combined with this journal or granted another opening reference.

The existing bounded registrar now rechecks the unchanged permit/scope, source controls, emergency stops and24-hour expiry at its actual commit latch. Future cycle reports receive a seal of **their own** exact bytes. No initial report/seal is rewritten. A partial or damaged report publication is withheld; the journal/proofs must be retained for diagnosis, not deleted/reseeded. Automatic repair of every possible crash between the multiple research/report files is not implemented. Normal journal restart, concurrency, registration/grade replay and failed-write rollback are tested; do not equate those with an arbitrary-crash storage-repair guarantee.

Vercel/cloud mode explicitly refuses local PAPER reads and the local commit helper refuses hosted mode. The hosted endpoint continues using the existing cloud adapter or its truthful unconnected state; it never falls back to this filesystem journal. DTOs expose no private directory, account/namespace identifier, raw payload, source URL or credential. The build continues excluding `.local` and env files. Screenshots use an intercepted account; they are not hosted authentication/persistence proof.

## What executes next under existing authority

1. **14November18:00 AEDT:** original source-only result job. It is not a Sunday settlement promise.
2. **14November19:00 AEDT:** original source-only research capture. The existing tick may invoke the offline/keyless bounded consumer, only for the five original IDs, original control, unchanged qualification and fresh pre-event evidence. No qualifying quote means zero positions. No second source worker or extra API read is introduced.
3. Registration authority expires **15November12:47:21.079 AEDT**. This change does not extend it, permit the challenger to register or create permanent daily authority.
4. **15November18:00 AEDT:** existing next result job after these fixtures. The passive consumer may independently grade any genuinely registered entries from retained evidence. Post-registration settlement may occur after registration authority expires; it never registers a late position. Missing/disagreeing finals remain unresolved. The current NBA result reconciler proves wins/losses; a cancellation/void needs attributable rule/result evidence and must remain unresolved until supported. The Mac must be awake/logged in/online.

The existing local/source STOP files and source kill switch remain authoritative. No price, forecast, selection or result has been invented. **A genuine full registration→final-result→settlement lifecycle is not yet proven**, because genuine positions remain zero and all five fixtures are future at this audit.

## Review package for repeatable autonomy — not activated

`ops/v61-paper-activation.proposed.json` is a review artifact, not a runnable configuration. SHA-256:

`3b7dc4d31e1e8a57b70fc99bd8c444c058e93f80b341460dada488910b835fd4`

It is disabled, owner approval/window unset, no extension of P0. It preserves A$5,000/A$50, no count/exposure/available-balance admission cap, exact NBA Sportsbet h2h identity, frozen `nba-moneyline-two-pass-1`, control-only registration and experimental challenger separation. No runtime consumes this document. Before broader local operation, select an actual future window/source plan, resolve/model-review the documented uncertainty, bind exact code/policy/model/source hashes and obtain explicit owner standing approval. The current bounded CLI intentionally rejects a widened fixture set or changed expiry. Generalising that permit is further reviewed work, not an activated feature of this branch.

### Hosted sequence and approval boundaries

Read-only linked history on14November confirmed **production project `ilgoswfckkzpoktabbfi`**, versions `202611030001`, `202611030002`, `202611040001`, `202611130002`, `202611130003`. Thus source-only02/ACL03 are deployed; PAPER is not. This is fresh migration-history evidence, not a fresh positive hosted persistence/RLS test. The earlier25 catalog +10 anonymous checks remain dated13November evidence. Positive source owner/two-user writes still need separately approved provisioning and acceptance.

1. Review cloud source/model input compatibility: original5,082-game lineage/`5bfe…` versus separate5,069-game BDL/`44edd…` candidate, source rights, date-only exclusions, unresolved source-time/Cup differences and exact reproducibility. The BDL candidate is not the installed pilot or a promoted baseline. Do not upload a partial/incompatible archive or silently change the pinned runner.
2. Obtain **separate source provisioning approval** for an exact complete retained inventory/snapshot; publish only under stopped/no-capability controls and run positive normal-owner/two-user source acceptance. Source-only storage is not a paper ledger.
3. Obtain **PAPER Approval A** for the unchanged reviewed proposal (`202611110001_v6_paper.sql`, SHA `c3a0d368ddbda1b50f3dab13aeec7cb3a939e423bce894aa1d55cfe9f13a3dff`) after fresh backup/restore/currency/hash/remote compatibility and single-file dry-run. Follow its existing atomic/backout review; no reset, drop, V5 alteration or source reapply. Then perform genuine normal-user RLS/atomicity/concurrency/rollback acceptance.
4. Obtain **model/standing-policy Approval B**, acknowledging experimental status and exact policy/version/input lineage. Current descriptive accuracy is not proof of profitability/calibration; challenger agreement is correlated, not independent validation.
5. Obtain scoped owner capability enrollment/credential and **worker/host activation Approval C**, including exact future window, schedule, quota authority, STOP/recovery controls and durable checkpoints. Existing generic scheduler/worker/repositories support the operations but no broad local/hosted receipt is issued here.
6. Obtain a **single-host transfer** approval for the exact cloud plan/snapshot/code. Fence and verify the stopped Mac source owner before arming any hosted runner; no dual independent quota journals. Reuse the reviewed shared counter/reserve semantics; do not reset11 used credits or add a schedule to increase position counts. Validate retries/missed starts and result checks inside retention windows.
7. A Vercel Preview/release remains separate approval. Keep the website and runner independent: no `npm run dev` dependency, no scheduled ChatGPT prompt as a backend scheduler. Existing free-tier infrastructure remains the proposed target; do not create a paid plan/trial. Hosting/SLA and positive unattended hosted paper acceptance remain unverified.

No approval above was granted by this document. Full unattended daily PAPER autonomy is **not operational**. No Hermes/external message was sent. Future alert payloads should include immutable fixture/market/selection, attributable quote/time, numerical method/version/probability, limitations and explicit expiry, with a stable deduplication key. External delivery stays disabled until separate approval and real delivery testing. V5 remains manual with its own A$500/A$5 rules.

## Verification and known gaps

Changed files:

- Evidence/domain display: `src/lib/v6/local-paper-view.server.ts`, `journal-repository.server.ts`, `dashboard.server.ts`, `dashboard.ts` and `prediction/research-view.server.ts`.
- Existing UI: `src/components/v6/dashboard.tsx`, `panels.tsx`, `model-intelligence.tsx`.
- Operations/tests: `scripts/execute-v6-local-paper.mjs`, `check-v61-local-lifecycle.mjs`, `check-v6-dashboard-browser.mjs`, `tests/v6-local-paper-view.test.ts`, `tests/fixtures/v6-local-view.ts`.
- Disabled approval artifact/deployment guard: `ops/v61-paper-activation.proposed.json`, `vercel.json`.
- Documentation: `AGENTS.md`, `README.md`, `docs/architecture.md`, `docs/v6-dashboard.md`, `docs/v6-implementation-status.md` and this report.

Final checks: **808/808 tests in75 files**, including15 new local-view/permission/evidence tests; **70 core +77 historical +15 source SQL checks**; **19 browser groups**; TypeScript, lint and production build pass. Existing backend/auth/ledger tests were preserved. Intermediate declaration/test-loading issues were corrected before the final full run.

Coverage includes synthetic win/loss accounting, registration/settlement restart and replay, owner rejection, source/quote/proof/grade tampering, missing/semi-published evidence, exact clocks, disabled/expired controls, conflict between repositories, cloud refusal and per-cycle seals. All SQL/positive lifecycle fixtures are disposable local tests, never genuine results. Browser interception covers all V5/V6 routes, demo/different-user isolation, registered versus observational rows, model samples, local pending/settled display, reload and keyboard/mobile access. Actual retained P0 records were rendered separately with mocked authentication; a new live signed-in personal browser acceptance was not performed by these tools.

```sh
EDGELAB_POSTGRES_RUNTIME=/private/tmp/edgelab-cloud-validation npm test
node scripts/check-database.mjs --runtime /private/tmp/edgelab-cloud-validation
node scripts/check-import-database.mjs --runtime /private/tmp/edgelab-cloud-validation
node scripts/check-v6-cloud-proposal.mjs --runtime /private/tmp/edgelab-cloud-validation
npm run typecheck
npm run lint
npm run build
node scripts/check-v6-dashboard-browser.mjs --runtime /private/tmp/edgelab-browser --cloud \
  --local-evidence-screenshot /private/tmp/edgelab-v61/local-dashboard.png \
  --local-mobile-screenshot /private/tmp/edgelab-v61/local-mobile.png
```

The1440px/390px screenshots were visually inspected. They show retained local evidence, not a live hosted balance or acceptance result. No provider request, genuine paper position/grade, real financial transaction, model promotion, migration, worker credential, hosted job, LaunchAgent change, Vercel deployment or external notification was created. Automatic deployments are disabled for the new branch. No actual result or successful future capture is claimed.

Next executable milestone: inspect the existing19:00 capture/consumer receipt after it actually occurs; require exact Sunday quote and completed intervening inputs before allowing this existing batch to register. If it again qualifies nothing, preserve the exclusions and report zero. Do not spend credits or lower criteria to produce a position.
