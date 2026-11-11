Latest 5 November approval-UX check: 502 tests including three embedded PostgreSQL tests, 70 workflow browser checks and a 22-check production rerun passed; TypeScript, lint and build passed. Existing archives, approved methodology and financial records were not changed. See the final section and [approval walkthroughs](approval-workflows.md).

# EdgeLab verification status — 4 November 2026

Latest operating checkpoint: personal settings and the explicitly approved genuine single-paper archive/tracking/notification pilot passed normal-session persistence verification. Fresh anonymous probes passed **8/8**; local tests passed **386 units**, **73 browser groups**, PostgreSQL checks, TypeScript, lint and build. See the final operating-transition section for exact evidence and remaining limits. Earlier migration, 17-group bookkeeping and 11-group history reports are preserved as dated checkpoints below.

The approved migrations are deployed to `ilgoswfckkzpoktabbfi`. The user-executed hosted security run completed at `2026-11-04T00:13:32.537Z` with **17/17 passing groups and zero recorded failures**. The sanitized [report](reports/hosted-access-20261104.json) is retained with its exact hash in [deployment-verification.md](deployment-verification.md). No test accounts or application records were removed or changed during this report review.

## Preserved hosted checkpoint

| Check | Verified result |
| --- | --- |
| Hosted authentication | Two distinct password-issued normal-user JWTs; both identities verified through Auth getUser |
| Session persistence | Account A SDK restoration and actual browser F5 retained session/data |
| Cross-account RLS | Cross-owner reads empty across all 14 tables; bet update changed nothing; forged-owner insert rejected |
| Unauthenticated access | Private table/RPC access rejected; separate deployment probes confirmed HTTP 401 / 42501 on 14 tables and both RPCs |
| Read/write persistence | Both users saved/reloaded manual synthetic bets, deposit records and settings; A settlement/leg statistic/audit persisted |
| History/delete protection | Financial/audit mutations rejected; authenticated bet deletion rejected |
| Stale snapshots | Sequential stale revision rejected and newer settings retained |
| Simulated research boundary | Rejected synthetic research left workspace and revision unchanged |
| Browser verification | A sign-in, private-ledger reload, demo/private separation and logout passed |
| Approved migrations | Both reviewed versions recorded remotely; original hashes retained |
| Exact hosted catalog | 14 tables, 97 columns, 134 constraints, 42 indexes, 14 policies, 24 triggers, 24 function bodies; zero raw differences |
| Unit tests at the hosted checkpoint | 61 passed; expanded local suite below |
| TypeScript / lint / production build | Passed; see local recheck notes below |
| Embedded PostgreSQL | 70 checks passed using temporary PGlite; separate from hosted JWT tests |
| Signed-out browser regression | 20 demo groups, eight isolation groups and three negative-callback cases passed |

The 17 hosted groups consist of 13 API/SDK groups and four browser groups. The user supplied credentials privately in their own terminal; the report contains no passwords, email addresses or JWTs. Privileged catalog inspection was used only to inspect configuration, not to claim normal-user RLS enforcement. Local optional Playwright/PGlite runtimes stay outside application dependencies.

The local report-review recheck passed all four required commands: 61 unit tests, TypeScript, lint and the production build. No hosted write tests were rerun, and no remote records or accounts were modified.

## Scope limits

- Signup/confirmation email delivery and the positive email callback flow were not tested with the preconfirmed accounts.
- Expired tokens, refresh/rotation, long-duration sessions and immediate JWT revocation were not tested.
- Positive hosted research/paper/notification/run/odds/model round trips remain unverified. These related tables were empty in cross-account probes. Fixtures remain truthfully simulated and are rejected by private storage.
- Browser checks used account A and read records created through the API. Hosted form CRUD, B's browser session and full hosted parlay/bonus/void/loss coverage were not exercised.
- Stale updates were sequential. Simultaneous transactions, load stress and mid-transaction fault injection remain untested.
- Live sports feeds, model advantage, scheduled research, background push and OS notification delivery remain outside verified scope.
- The nine reviewed CHECKs remain NOT VALID: new/changed rows are checked without automatically certifying historical rows.

The current lockfile's previously recorded runtime audit was clean; development-only lint dependencies had 16 moderate glob-matching advisories. Those audit findings were not re-queried during this report review.

## Reproduction and retained evidence

```sh
npm test
npm run typecheck
npm run lint
npm run build
```

The database, catalog and browser runbooks are in [database.md](database.md), [browser-qa.md](browser-qa.md), and [deployment-verification.md](deployment-verification.md). The completed hosted report is preserved; the populated test accounts/records must remain. Any new full write-test run requires fresh dedicated accounts and a new output filename. No hosted write tests are replayed just to regenerate documentation.

The pre-deployment approval and exact migration hashes remain in [migration-review.md](migration-review.md). Earlier screenshots in [screenshots](screenshots) show synthetic demo data; they do not imply live odds or model validity.

## Earlier local checkpoint before historical deployment

Continued the existing partial implementation without rebuilding the app or changing either deployed migration. The new historical workflow is functional in Demo; its private schema is prepared but **unapproved and unapplied**. No real history, hosted seed, test-account deletion, real email or new paid service was used. Existing hosted accounts/records remain intact. Remote activity during this stage was limited to migration-history inspection and a dry-run.

Final verification on 4 November 2026:

| Check | Result and scope |
| --- | --- |
| `npm test` | **194/194**, 8 files; includes 105 import/domain lifecycle cases, 13 history-repository cases and 15 new installed-SDK auth cases |
| `npm run typecheck` | Passed (`next typegen` and strict `tsc --noEmit`) |
| `npm run lint` | Passed, including new UI, tests and scripts |
| `npm run build` | Passed; all seven original routes, new `/imports`, and `/auth/callback` generated |
| Existing embedded PostgreSQL suite | **70/70**, all three local migrations applied in memory; original behavior preserved |
| New embedded history/security suite | **77/77**, two ordinary authenticated contexts, anonymous denial, ownership-bound RPCs, immutable sources, reconciliation, lifecycle/audits, stale updates, rollback and size-boundary checks |
| Existing production-browser UI suite | **20/20**, original ledger/parlay/research/paper/alerts/settings/reload/mobile functionality |
| New synthetic import production-browser suite | **12/12**, all eight routes, malformed JSON/UTF-8, JSON/CSV/manual approval, duplicate rejection, frozen forecasts, per-leg settlement, explicit-null timestamps, alerts/paper tracking, separate bonus-ledger confirmation and mobile |
| Mocked Auth production-browser suite | **9/9**, signup confirmation state, signin errors/success, failed form retention/no phantom record, retry/reload, local logout, expired-token refresh, revoked-session rejection, callback cleanup and demo isolation |
| Browser exceptions/external escapes | Zero in both new browser suites; all nonlocal requests intercepted/blocked |
| Remote migration history/dry-run | Correct project `ilgoswfckkzpoktabbfi`; two deployed versions retained; **only `202611040001_historical_import.sql` pending**, no seeds or roles planned; dry-run applied nothing |

The final production browser suites ran against the locally built app on port 3101. A legacy notification assertion initially became ambiguous because both notification sections expose a Dismissed tab; scoping that test to the original panel restored the same behavior assertions. Initial import harness currency/step-wait assumptions were corrected, then all suites passed. Review also fixed null-result timestamp fallback, safe settlement-dialog rendering during workspace changes, decoded control/Unicode input rejection, fatal UTF-8 file decoding and expected-owner binding on new history RPCs. These were local fixes, not hosted deployments.

Retained sanitized evidence:

- [Mocked Auth browser report](reports/auth-browser-mocked-20261104.json): fake accounts/tokens, intercepted transport, no hosted Auth requests or emails.
- [Synthetic import browser report](reports/import-browser-synthetic-20261104.json): browser-local synthetic state only.
- [Existing demo browser report](reports/demo-browser-20261104.json): original regression suite.
- [Pending migration review](historical-migration-review.md): exact final SQL hash, object counts, read-only remote plan and approval boundary.

An extra `npm run dev -- --port 3102` startup correctly detected the existing development process on port 3000 and exited without replacing it. The existing server was retained: `/imports` returned HTTP 200 and its hydrated import heading rendered without browser runtime errors. An initial HTML-only heading assertion was replaced with this appropriate hydration check because the route uses a Suspense fallback. The extra-start exit is a single-dev-process lock, not an application build failure. The temporary production QA server was stopped after verification.

The earlier **17/17 hosted** report above is preserved unchanged. These new local checks do not expand its scope. Embedded PostgreSQL uses an `auth.uid()` shim and nonprivileged roles; it is not the hosted authentication gateway. Mocked browser success is not evidence of hosted email delivery or hosted token rotation.

### Remaining manual or unverified work

1. Explicit approval is still required for the single prepared historical migration. Recheck target, current file hash, remote history, name conflicts and dry-run before applying. No remote deployment is authorized by these test results.
2. After authorized deployment, verify the six new hosted tables, policies, constraints, functions/triggers and expected-owner RPC signatures, then perform a dedicated reviewed normal-user persistence/isolation verification. Hosted positive historical import/paper/notification round trips remain untested. Preserve private synthetic rejection; do not relabel fixtures to force a positive hosted write.
3. Complete one authorized real email signup/confirmation callback flow. Hosted email delivery/click-through, long-lived refresh/rotation and hosted revocation timing remain unverified; no unnecessary emails were sent by this stage.
4. Full hosted form settlement variants, simultaneous transactions, load and mid-flight account/token-switch stress are not claimed. The new history expected-owner guard is covered locally; the existing deployed legacy workspace interface is unchanged.
5. Won parlays with void legs require separately documented adjusted settlement pricing before financial registration/hypothetical P/L. The source archive retains those records with warnings and explicit acknowledgement; no adjusted facts are invented.
6. Raw ChatGPT exports/freeform text, unknown vendor formats, backup restore and real experiment imports still require manual mapping/review and separate user approval. No live provider, scheduled job, push delivery or wagering integration was added.

Use [historical-import.md](historical-import.md) for exact UI steps, supported fields and missing-data rules. Development runbooks remain in [database.md](database.md) and [browser-qa.md](browser-qa.md).


## Research continuity continuation — current hosted results

The reviewed migration was explicitly approved by the user, passed a pre-deployment exact hash/namespace check and applied successfully once. During the later resume, remote history confirmed `202611040001` already applied, so it was **not reapplied**. No other migration, seed, reset, account deletion or existing-record deletion occurred. The three migration hashes are unchanged.

The SELECT-only hosted verifier matched **20 tables, 136 columns, 182 constraints, 68 indexes, 20 RLS policies, 42 triggers and 46 function bodies**, with zero raw differences. All six historical tables and both expected-owner RPCs are present. The nine earlier NOT VALID checks retain their prior status. [Catalog evidence](reports/history-hosted-catalog-20261104.json) records this configuration scope, not normal-user behavior.

Direct public-key anonymous probes passed **8/8**: every one of the six historical tables and both history RPCs returned HTTP 401 / SQL 42501. No private record was read. [Anonymous report](reports/history-anonymous-20261104.json).

The user ran the secure two-account terminal harness. Its sanitized [report](reports/hosted-history-access-20261104.json) completed with **11 passed, 0 failed, 0 skipped**, from `2026-11-04T06:47:58.057Z` to `2026-11-04T06:48:51.116Z`. Exact report SHA-256: `ed845e2ba0d3a54a4ac0de557b7aec0fff1f7fbfa13ea7867a6a25fc60aa9340`.

It verified distinct password-issued normal-user identities through Auth getUser, own-workspace reads, both expected-owner read/save mismatch directions, null-owner rejection, cross-owner read filtering on all six tables, deployed synthetic validators, rejected honestly synthetic saves, unchanged snapshots/revisions, and anonymous table/RPC restrictions. Both historical contexts were empty. This proves read/negative enforcement in those contexts, **not positive writes or non-empty cross-account paper/notification isolation**. No passwords, emails, JWTs, user IDs or record contents are retained in the report. Existing users/legacy records remain intact.

The private boundary rejects `verification: synthetic`; tests do not relabel those records as genuine/unverified/user-confirmed, bypass checks or use service-role access to manufacture positive hosted results. Positive historical/paper/notification persistence, hosted forecast-update rejection and non-empty lifecycle isolation therefore remain unverified. Appropriate separately approved genuine sources or a separately reviewed test facility are needed before claiming them.

## Research continuity continuation — local results

- `npm test`: **323 passed**, with **one optional PostgreSQL test skipped** when its external test runtime is not configured.
- Optional actual-domain PostgreSQL lifecycle: **1/1 passed** with `EDGELAB_POSTGRES_RUNTIME=/private/tmp/edgelab-db-validation npx vitest run tests/handoff-postgres.test.ts`.
- Existing embedded PostgreSQL: **70/70** passed; historical embedded PostgreSQL: **77/77** passed.
- Updated exact-catalog generator: baseline verified and **10 drift/final-restoration checks** passed for the three-migration schema.
- TypeScript and ESLint passed. The production build passed; final UI regression evidence is recorded in the completion addendum below.

The optional integration calls the actual parser/import/context/handoff/research approval/paper settlement/calculation functions through fresh in-memory PostgreSQL and all three migrations. It exercises a separate explicit ledger registration without funding inference, source round trips, server audits, atomic revisions, alerts/read/dismiss, duplicate and immutable-source rejection, stale saves, two ordinary role contexts and anonymous denial. Its Auth shim and labelled synthetic local fixtures never reach hosted Supabase. It is distinct from the hosted report above.

No original Days 1–5 file was supplied or imported. The reported checkpoint remains an unverified aggregate reference, with explicit count/bonus ambiguity and no inferred deposits or bookmaker balance. The comparison covers current records rather than a proven historical day subset. Full original rules and completed-day status need explicit owner source attestation. The application now supports manual continuity without an OpenAI API, but source checking, research, approval, actual-entry confirmation and result collection remain manual. The optional odds readiness is disabled; no live odds request was made.


### Completion addendum — final local checks

The final production build passed after fixing overview action wrapping on mobile and assigning usable heights to the new prompt/JSON editors. All required checks passed: **323 unit tests** (one optional PostgreSQL test skipped by default), TypeScript, ESLint and production build. The separately enabled actual-domain PostgreSQL lifecycle test passed **1/1**; existing/history PostgreSQL suites passed **70/70** and **77/77**, and the catalog generator passed its 10 drift/restoration checks. No dependencies or migration contents changed.

Final browser evidence totals **57 passing groups**, with no reported runtime exceptions:

| Suite | Result | Retained evidence |
| --- | --- | --- |
| Original dashboard/ledger/research/paper/notification/settings/mobile regression |20/20|[Report](reports/continuity-demo-regression-20261104.json)|
| Historical import/paper/notification regression |12/12|[Report](reports/continuity-import-synthetic-20261104.json)|
| Mocked Auth/session/form regression |9/9|[Report](reports/continuity-auth-mocked-20261104.json)|
| Complete research continuation |16/16|[Report](reports/handoff-browser-synthetic-20261104.json)|

The 16-group suite verified selected-conversation manual mapping and source isolation, explicit archive approval, separate actual bookkeeping confirmation with no inferred funding, source-backed context journal, generated prompt/native clipboard copy, malformed/LLM-probability/missing-price handling, reviewed paper/pass records and alerts, exact duplicate rejection, result reminders, original-forecast immutability through individual-leg settlement, deterministic analytics/Brier scoring, next-day continuation, complete backup download and mobile layout. Desktop prompt/JSON editor heights are asserted. All new suites used fresh synthetic contexts with nonlocal requests blocked; the Auth suite intercepted its external transport.

Two existing browser selectors needed scoping after adding a second source uploader and response-review controls. Their original behavioral assertions were preserved. The overview action row initially overflowed on mobile after adding the handoff link; wrapping was fixed, rebuilt and all 20 existing checks passed. The temporary QA production server was stopped; the user's existing development server was preserved.

The hosted 11/11 report and 8/8 anonymous checks above remain the live evidence. Positive hosted historical/paper/notification persistence and non-empty cross-account lifecycle behavior remain unverified. The app is ready for a **user-reviewed genuine-source pilot**, not an assertion that real experiment history has already been migrated. No source file was supplied, no real history was imported, no paid service or live odds/OpenAI request was enabled, and no automatic wagering was added.

The preserved localhost:3000 development server also passed a fresh-browser smoke check: Research rendered with HTTP 200, Run Daily Research generated the handoff prompt, and there were no runtime errors or escaped external requests. [Development smoke report](reports/continuity-dev-smoke-20261104.json). No extra QA server remains running.

## Recovery staging review — local only

A conservative source-extraction adapter now feeds the existing historical validator, with explicit category separation, null preservation, source/transform provenance and known-amount reconciliation. Recovery rows are locked to preview-only in both the UI and import command. Internal source approval booleans never authorize persistence. Real source data and full source-specific reviews are kept in Git-ignored, private `.local/` artifacts; permanent fixtures are synthetic.

Verification passed: **350 unit tests** (one optional PostgreSQL integration test skipped by default), TypeScript, ESLint and the production build. This includes 22 recovery-adapter tests and five report/approval-lock regressions. The existing generic import browser suite passed **12/12** after integration. A separate private real-file browser check verified complete review/download, disabled row selection/edit/save controls, mobile layout, unchanged source bytes and local storage, and zero external requests/runtime errors. No Supabase call, migration, real-record registration or hosted write was made during this recovery-preview task. Source-specific details and warnings are intentionally not copied into tracked reports or fixtures.

## Personal operating transition — verified results

The existing personal account was preserved. The user completed the explicitly approved single-paper pilot through normal authenticated UI access; no service-role credential, account reset, test-account copy, migration or financial write was used. The configured public URL matches project `ilgoswfckkzpoktabbfi`.

### Retained hosted evidence

| Check | Verified result |
| --- | --- |
| Personal settings | Saved A$500 lifetime cap / A$5 default stake, AUD, Australia/Melbourne; three unchanged before/after settings audits |
| Funding and actual ledger | Zero recorded deposits, zero financial transactions and zero actual wagers; actual workspace matches the pre-pilot baseline |
| Approved archive | Exactly one unverified paper record and one source batch; every snapshot field, null, raw source byte and source hash matches the approved file |
| Paper tracking | One persisted tracking state, preserving the original source-time outcome and leg statistic; unknown original/result times remain null |
| Notification | Exactly one historical notification; read and dismissed states persisted after reload |
| Forecast/source preservation | Original record and batch equal the first archive export after all tracking/notification actions; no retrospective change |
| Audit and revision | Ten historical audit entries at revision 5: client confirmations and server audits for import, notification creation, paper registration, read and dismissal |
| Fresh normal-user read | Read-only checker passed stable identity verification; stored settings and historical counts match the full export |
| Duplicate protection | Existing importer flags the approved source as an exact duplicate against the actual persisted snapshot; prepareImportCommit rejects it locally; one stored row remains |
| Anonymous restriction | Eight fresh hosted probes rejected with HTTP 401 / PostgreSQL 42501 across six historical tables and two read RPCs |

The final complete export is `edgelab-supabase-continuity-2026-11-04 (2).json`, exported `2026-11-04T12:36:19.992Z`, SHA-256 `7e839372a5ae742dbd9ef463c99a9df3e7720a800352f447bb4ab190b2b47c5d`. The fresh normal-session check is `edgelab-personal-workspace-check-2026-11-04 (3).json`, checked `2026-11-04T12:36:27.968Z`, SHA-256 `acba63023738c23650e5a0ea79dfc6164cbbc6dd27a57034645f57ff9968ab7e`. Detailed exports remain private under Downloads and ignored `.local/`. See [sanitized pilot results](reports/operating-hosted-pilot.json) and [anonymous results](reports/operating-hosted-anonymous.json).

The earlier empty reports predated the later settings saves. Settings now also reloads through normal authenticated access and requires exact saved values plus an appended settings audit before showing **Private settings saved and read back**. Mocked tests reject an acknowledged write that was not retained. The settings cap remains a limit, never an inferred deposit or bookmaker balance.

### Recovery review and separation

Both supplied source hashes were checked and files left unchanged. The local review describes 28 source items: six reported actual wagers, fifteen historical papers (8 reported wins / 3 losses / 4 source-time unresolved), and seven unregistered proposals. Only the separately approved one-paper pilot was imported. Other history remains local and unapproved; incomplete actual records remain blocked from financial registration. Seven papers rely on secondary summaries, missing facts stay null, and full historical paper P/L/ROI remain unknown. The reported monetary checkpoint reconciles arithmetically without becoming deposits, a bookmaker balance or actual ledger results.

The importer retains already-archived evidence in the fifteen-paper source coverage while marking it as an exact duplicate blocked from another import. Repeated rows inside the preview are excluded, uncertain identities are not merged, and extra void rows cannot falsely reconcile the checkpoint. Warning classes distinguish Blocking, Requires review and Informational without changing SQL payloads. Recovered summaries remain excluded from verified accuracy/Brier metrics even after tracking is registered.

### Latest local validation

- `npm test`: **386 passed**, one optional PostgreSQL test skipped by default; that integration was separately enabled and passed.
- Embedded PostgreSQL: **70/70** core checks, **77/77** historical checks, plus the actual-domain continuation lifecycle and exact approved nullable-pilot lifecycle (one test each). These are local role/SQL tests, not hosted JWT probes.
- Private actual-file mapping/hash/reconciliation diagnostic and final exported-evidence/duplicate/coverage diagnostic passed. No additional hosted record was created by them.
- Browser: **73 passing groups** — original app 20, import 12, mocked Auth/settings 11, handoff 16, mocked personal read check 7, supplied-source local preview 7. Auth/settings includes expired/revoked sessions and write/readback failure behavior.
- TypeScript, ESLint and production build passed. Run type generation separately from a build because both write `.next/types`. All eight application views responded successfully on the user's unchanged development server.

The full local handoff lifecycle passed: selected historical source → archive → separately confirmed ledger fixture → self-contained daily prompt → structured response validation → candidate approval → immutable paper registration → final/leg results → analytics → complete export. All such browser fixture actions remained isolated from personal/hosted data.

### Limits and next use

The pilot proves positive personal archive/paper/notification persistence with fresh normal-user read evidence. No deliberate duplicate INSERT, retrospective forecast-edit attempt, fresh nonempty cross-account JWT probe, or new hosted result correction was attempted on this personal record. Previous hosted 17-group bookkeeping and 11-group history read/negative checks remain retained evidence; comprehensive local RLS/immutability tests remain separate. The source-time outcome is still secondary evidence, not a newly verified official event result or proof of pre-event registration.

Full original rules, exact missing history, official results and numerical methodology still require source review. Hosted signup delivery/long-duration session behavior and full-backup restoration remain outside this verification. No paid integration, live price feed, automatic wager or background push was enabled. Use [the operating guide](operating-edgelab.md) to continue research while older evidence stays under review.

Implementation files: `src/lib/imports/paper-supplement.ts`, `review-status.ts`, `review-warnings.ts`, `calculations.ts`, `recovery.ts`, `recovery-report.ts`; import wizard/review/paper components; `src/lib/workspace-verification.ts`, its Settings panel and settings readback; supplement/warning/workspace tests; `scripts/check-workspace-browser.mjs` and expanded Auth browser checks. README, AGENTS, architecture, database, recovery, continuity, roadmap, verification and operating documentation were updated. Sanitized `docs/reports/operating-*.json` retain results. Original migrations and package dependencies are unchanged.

## Research memory and Day 6 staging — 5 November 2026

Existing changes were preserved. Methodology/context v2, local evidence retention, compact prompts, separate active/reported/completed days, response replay/selection checks and owner-checkpoint previews are implemented. The research response contract remains v1 with optional nullable createdAt; stored historical snapshot/SQL shapes are unchanged. No migration or dependency was added.

The full owner-provided checkpoint and local mapping/reconciliation are private and Git-ignored. A local diagnostic compared the last verified personal continuity export with the primary recovery, paper supplement and new source. It found the existing historical paper match, staged two owner-confirmed pending placement claims, preserved all missing accepted odds/times as null, reconciled A$10 reported exposure and A$489.30 modelled allocation separately from realised P/L, retained four unregistered paper proposals and five cash passes, and linked the former paper proposal to its owner-confirmed actual claim without an independent paper position. Historical four-prediction statuses remain unresolved at the previous source time. No source odds, results or funding record was rewritten. The comparison uses the supplied retained export, not a new hosted authenticated probe.

The reconstructed methodology remains proposed. Approval of policy, original-rule completeness, owner-reported active progress and source-backed completion are independent. No methodology or checkpoint was saved to the real workspace. Older missing IDE attachment paths were checked and unavailable; a full original methodology is not claimed. The current owner request and structured recovery sources are preserved.

Executed results:

| Suite | Result |
| --- | --- |
| npm test | 450 passed; 2 optional PostgreSQL tests skipped by default |
| Optional PostgreSQL integration, explicitly enabled | 2/2 passed, including v2 journal round trip and normal-role ownership/immutability |
| Existing SQL security/persistence scripts | Core70/70 and history77/77 |
| Browser | 73 groups: original20, import12, mockedAuth11, handoff16, mockedworkspace7, newcontinuity7 |
| Actual-source local mapping diagnostic | Passed; private files only, no hosted requests/writes |
| TypeScript, lint, production build | Passed |

The initial concise-prompt check exposed excessive demo history and was fixed by a bounded pending/recent excerpt with full context retained. An old browser assertion was updated to the existing mode-specific Settings success text; persisted values and audits remain asserted. A PostgreSQL prompt-text regression was corrected by retaining the explicit no-inferred-funding instruction. A stale-generation TypeScript race is avoided by running typecheck separately from build. Final executed suites pass.

See [sanitized local results](reports/continuity-memory-local-20261105.json). All browser contexts are fresh synthetic/mocked and block/intercept remote transport. No new real email, bookmaker request, wager, account, API key, funding or privileged authentication was used. The three reviewed migration hashes are unchanged. Previous hosted pilot/security verification remains evidence for its earlier scope; new v2/checkpoint hosted writes remain untested pending explicit approval.

Unsupported execution evidence, complete original rules, precise pre-registration/fixture identities, first-class range forecasts, closing-price collection/persistence and full-backup restore remain documented limits. The CLV helper returns insufficient evidence for comparison/reported quotes, nonmatching identities or invalid quote times. No new statistical advantage or autonomous research is claimed.


## Historical actual-wager claims — 5 November 2026

The owner-provided eight-claim source was reconciled locally against retained recovery files, the owner checkpoint and the latest available complete workspace export. The source and row-level preview remain private under ignored `.local/wager-claims-review/`. The preview contains eight archive-eligible records and zero financially eligible entries: accepted execution odds and original timestamps remain null, reported prices stay in raw provenance, and incomplete leg evidence/strategy/fixture descriptions are flagged. The reported amounts reconcile without treating the cap/modelled allocation as funding or including bonus face value in cash returns. This is source reconciliation, not independent ticket verification or a fresh hosted read. The signed-in application checks its current archive and ledger before staging. Archive duplicate/revision checks run again at final archive confirmation; ledger overlap is rechecked before separate financial registration.

- `EDGELAB_POSTGRES_RUNTIME=/private/tmp/edgelab-db-validation npm test`: **469/469 passed**, including all three opt-in embedded-PostgreSQL tests; no tests skipped. Sixteen wager-claim unit tests cover bonus/cash arithmetic, unknown accepted prices, malformed amounts, duplicates/source aliases, ambiguous rollups, credential guards, Demo isolation, immutable-source correction gates and absent leg preservation.
- The new local PostgreSQL test verified private historical save/read-back, reported-price preservation, nullable execution facts, unchanged existing paper/notification/audits, zero actual/funding rows, immutable source rejection, duplicate protection and two ordinary authenticated identities plus anonymous rejection. It used an ephemeral database with the existing migrations; this is not hosted verification.
- **12/12 browser checks passed** using a fresh browser, fake identities and intercepted Auth/RPC transport. One archive save occurred only in memory after the simulated final approval. There were zero actual/funding write attempts, unexpected external requests or runtime errors. Checks covered Overview/Ledger summaries, reload, row/warning/final-confirmation gates, existing paper/methodology/audit preservation, duplicates, account/Demo isolation and mobile layout. [Sanitized browser report](reports/wager-claims-browser.json).
- `npm run typecheck`, `npm run lint`, `npm run build` and `git diff --check`: **passed**. The existing development server was preserved.

No hosted writes, new account, financial registration, funding transaction, migration or methodology change was performed. Existing migration and methodology file hashes were unchanged. Hosted persistence for this new claim batch remains unverified until the owner reviews and explicitly approves an archive save in the existing signed-in UI. Financial registration remains separately blocked until source-supported execution/settlement evidence satisfies the existing validator. See [claim review and approval instructions](historical-wager-claims.md) and [sanitized local verification](reports/wager-claims-local.json).


## Approval UX optimisation — 5 November 2026

The owner reports that the eight historical wager claims now appear correctly alongside the earlier paper archive; this pass did not repeat or modify those imports. It changed presentation, draft review and final-confirmation ergonomics while reusing the existing repositories, validation, source provenance, immutable records, audit paths and RLS. No hosted reads/writes, accounts, deposits, financial registrations, migrations or paid dependencies were introduced by development.

- **502/502 tests passed**, zero skips, with `EDGELAB_POSTGRES_RUNTIME=/private/tmp/edgelab-db-validation npm test`. This includes the three existing embedded-PostgreSQL tests and 33 new pure regression tests for statuses, selection, cancellation/approval decisions, paper eligibility and ledger payout/evidence handling. Existing financial, auth, import, persistence and immutable-source tests remain passing.
- **70/70 synthetic browser groups passed** across [historical imports](reports/approval-import-browser.json) (12), [mocked private wager-claim review](reports/approval-wager-browser.json) (12), [research continuation](reports/approval-handoff-browser.json) (17), [ledger/all-route UI](reports/approval-ledger-browser.json) (22) and [methodology/context](reports/approval-context-browser.json) (7). All use isolated test contexts and blocked/intercepted nonlocal traffic. They do not open personal browser profiles or contact hosted Supabase.
- The [22-check ledger/all-route suite passed again against the production build](reports/approval-production-browser.json), including actual/paper separation, explicit review/authorization, cancellation, bonus payout reconciliation and responsive mobile routes. Its data is synthetic browser-local Demo activity. No real wagers, deposits or financial records were created. The temporary QA server was stopped; the existing development server remains available.
- `npm run typecheck`, `npm run lint`, `npm run build` and `git diff --check` passed. All routes built successfully. An intermediate dev-run runtime error during concurrent Fast Refresh changes was investigated and did not recur in unchanged-assertion clean reruns or production checks; no error filter or suppression was added.

Archive upload now validates automatically, keeps eligibility/duplicate counts visible and uses batch controls plus one final archive dialog. Research is grouped by paper/watch/pass with one selected-warning approval and saved-record navigation. Probable duplicates still require individual decisions. Record statuses are overlapping display dimensions and never change stored verification enums. New manual actual entries require explicit accepted execution price/time; registration and settlement keep a separate financial review/authorization. Optional ticket and payout evidence uses existing audited notes, not a new database field or transfer. Paper approval is rechecked against existing actual links and event timing; a source outcome without qualifying registration never becomes a forecast settlement.

Methodology Revision 1 content and migration file hashes were unchanged. The context UI retains explicit policy-content review, a frozen readable preview and an explicit final save; cancellation writes nothing. Full original rule completeness remains a separate attestation. Hosted writes through the revised screens were intentionally not performed; local browser/SQL verification is not a claim of new hosted persistence or independent sports evidence verification. See [workflow audit and exact A/B/C steps](approval-workflows.md) and [sanitized local summary](reports/approval-ux-local.json).

## Master daily workflow and hybrid providers — 6 November 2026

Current local evidence: 575 unit/domain/PostgreSQL tests; 70 core and 77 historical SQL checks; 103 production browser groups; TypeScript, lint and build pass. These include synthetic actual/paper registration and batch settlement, source/audit immutability, replay prevention, nullable stats, quota restoration, cross-workspace isolation and paper evaluation. Live free-provider reads are separately reported; they did not write application records. See [master verification](master-verification.md) for exact coverage, failures corrected, remaining hosted/manual checks and the [continuation checkpoint](master-implementation-checkpoint.md). Prior hosted checkpoints do not constitute testing of new hosted writes.


## Canonical private-account activation — 11 November 2026

**Owner-approved archive import persisted.** The preserved 6 November private export had one core actual, no core paper, no transactions, 12 archive records and three tracked archive papers. The owner uploaded the durable canonical source, approved its 34 eligible rows in the existing PRIVATE UI, reloaded and downloaded a fresh complete export. That export confirms 46 archive records in six batches, the same actual workspace and three paper states, all previous immutable source/audit records, and server/client audits for one 34-row import. New records are three actual claims and 31 paper sources; 12 existing positions are linked. All 12 actual claims and 34 paper sources are represented without a second position or retrospective registration. No financial write, migration, Demo change, provider call, account or service-role access occurred.

An initial strict notification comparison found a legitimate audited read transition on 7 November, between the old backup and this import. The verifier requires immutable notification content and monotonic timestamp transitions backed by retained lifecycle audits; it reports this intervening change separately. It does not attribute that old read to the new import. Actual data, funding, methodology, original paper states and historical snapshots compare unchanged. Reimport replay excludes all 46 positions against the fresh export; this is not a claim that a duplicate hosted insert was attempted. Financial source reconciliation preserves the known cash/bonus subtotal separately from unknown later payouts, never an invented bookmaker balance.

- 595/595 Vitest tests pass with the optional local PostgreSQL runtime; no skips. New tests cover the source adapter, exact links, null preservation, credential/malformed-file guards, archive replay, original-record preservation, daily memory inclusion and unchanged historical settlement boundaries. The new ephemeral SQL test round-trips all 46 invented source items with two ordinary roles, anonymous rejection, immutable forecasts and zero financial writes.
- Existing embedded SQL scripts pass 70 core and 77 historical checks. All tests use disposable local databases, not hosted test records.
- Six focused isolated browser checks pass with invented fixtures and intercepted Auth/RPC transport: 46 rows/12 links, final approval, 34 approved records, preservation, refresh/replay, and visibility of all 34 paper sources. The first run exposed premature test upload before private history load; the wizard now also refuses validation until the signed-in private workspace is ready. No personal profile is opened.
- TypeScript, lint and production build pass; final reruns follow the read-only prompt-context changes.

The Daily Cycle prompt previously included only a history count; it now carries saved source classifications, original quotes versus execution facts, approved methodology and tracked historical paper identities. Archive-only proposals never become settlement targets. Private **Review & Apply Daily Update** remains blocked by its existing service guard; historical results use the existing separately approved Results Review path. This task does not claim a full hosted daily-cycle import, portable checkpoint journal, correction/supersession deployment, independent ticket verification or new hosted two-user RLS tests. See [sanitized counts](reports/account-activation-20261111.json) and [activation runbook](account-activation.md).

The ordinary manual wager form had been sending three optional local lifecycle fields rejected by the deployed core SQL. Known private placements now use the existing supported payload shape; confirmation and audit retain recording times. Unknown private placement times remain blocked and directed to the archive. Unit and embedded SQL checks cover the compatible shape and the rejection of the extra fields. No new real financial entry was created to test this correction.

## Private Daily Cycle fix and V6 foundation — 11 November 2026

The earlier private Apply guard is now resolved for **research-only source persistence**. A validated cycle, immutable journal, candidate-source snapshots and audit commit through the existing authenticated history RPC, followed by required read-back. Original source JSON, prices, times and supported numerical provenance remain; unsupported probabilities normalize to null without discarding their raw claims. Synthetic/malformed sources, same-ID conflicts and renamed replays are rejected. No result, actual or paper position is implicitly registered. The new normal-user path passed embedded PostgreSQL and intercepted browser checks; no new genuine hosted cycle was written during development.

The independent V6 domain/worker implements fixed A$50 hypothetical entries against a nominal A$5,000 reference, without available-balance, daily-count or exposure caps. Tests exercise 121 pending entries and negative availability; a separate proposal SQL test registers more than 100 as well. Exact markets and frozen model/source snapshots, reproducible experimental baselines including push mass, append-only final grade corrections, cent accounting, owner/cohort isolation, process-lock recovery and restart/replay are covered. Fixture `validated` controls are synthetic local test controls, not empirical evidence. No prospective position or actual standing/model activation occurred.

Final executions:

- **612/612 tests passed**, 47 files, no skips: `EDGELAB_POSTGRES_RUNTIME=/private/tmp/edgelab-db-validation npm test`.
- **147 existing local SQL checks passed**: 70 core and 77 historical. New Daily Cycle and V6 SQL integrations also pass within Vitest. All use disposable local databases with ordinary-role checks, never a hosted service-role test claim.
- **10 mocked private-browser groups passed**: four Daily Cycle save/retry/reload groups and six existing reconciliation/memory preservation groups. Invented sessions/sources and intercepted transport, zero personal/hosted writes, zero financial RPC calls, zero unexpected external requests.
- Typecheck, ESLint and webpack production build passed. Disabled worker CLI smoke test and launchd-template syntax validation passed; no schedule installed.
- Live read-only provider pilot used **four free credits** and observed Sportsbet NBA/NBL/WTA featured prices plus one NBA player-points sample; **A$0**, no account/wager access. ATP had no active catalogue key in that sample. Exact evidence and limitations: [V6 provider coverage](v6-provider-coverage.md).

No deployed migration, account, funding, historical source, existing position or Methodology Revision 1 was changed. The V6 ten-table SQL proposal is outside migrations, locally tested but **unapproved/unapplied**. Hosted V6 repository, restricted JWT issuance, validated current models, complete live grading, canonical real mappings, prospective shadow pilot, unattended schedule, V6 reporting UI, deployment and Hermes/iMessage remain unfinished. Overall status remains **LOCAL_TEST_ONLY**. See [implementation/resume status](v6-implementation-status.md).
