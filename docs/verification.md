# EdgeLab verification status — 4 November 2026

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

## Historical import and authentication hardening — local completion

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
