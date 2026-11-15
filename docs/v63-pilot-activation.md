# V6.3 bounded local pilot — owner approved and installed

Both parts of package `9625d48dde809a6b4f517e0e2e19dd90e3c5787c16fa5908ae8a9ba3894e5783` passed final gates and were installed on **15 November 2026 at 23:04:38.270 AEDT** (`2026-11-15T12:04:38.270Z`). Both currently report **waiting**, not an executed capture or PAPER position.

Approval reference: the owner's message beginning “I approve BOTH parts of the bounded EdgeLab V6.3 local experimental pilot, subject to the final verification gates”, bound to that package. It was observed at 22:57:39 AEDT. The source message creation timestamp was not supplied; it is recorded as unknown rather than fabricated. Both receipts use the actual installation/recording timestamp above, before the approved window.

## Installed permissions

- **Source:** replace the existing 19:00 Sportsbet NBA h2h request on **16, 18 and 20 November 2026** with one `h2h,spreads,totals` request. Maximum 3 credits each; six incremental credits. Same Mac worker, unchanged schedule, cumulative 60-credit ceiling and 100-credit provider reserve.
- **PAPER:** **16 November 00:00 through 22 November 00:00 AEDT**. Automatically register only new qualifying **NBA Elo-only full-game Sportsbet moneyline** forecasts generated after the permit starts; events must start inside the window. A$50 hypothetical stake, one A$5,000 nominal reference, no position-count/exposure/balance admission cap. Existing quality and evidence checks remain unchanged. Independently supported retained finals may settle these registered positions afterward. No forced registrations.
- Spread/total PAPER, score-model promotion, hosted A/B/C, database changes, deployments, extra workers, paid services, bookmaker accounts, real wagers and external messaging remain excluded. The expired P0 permit is unchanged.

| Private runtime receipt | SHA-256 of exact installed bytes |
| --- | --- |
|`.local/v6/source-pilot/market-extension-approval.json`|`6ac0705336f6ef948d7ca8188e016b23efc18b8edc1f2deca4774c21febed605`|
|`.local/v6/local-paper/daily-pilot/approval.json`|`b3f05a99712ab6c01506ffe2bd070607f8125fe569dc06993f4e5687241b774c`|

Both receipts have mode 0600 under private directories, tied to the existing source namespace. They are not service/API credentials. The reviewed proposal remains unchanged as historical review material; its pending flags do not override the separate approved runtime receipts. Never recreate, overwrite or backdate these receipts.

## Actual gate evidence

- Package hash, every listed source-code byte hash, source-plan/model/protocol/policy bindings and the original source receipt all match the approved package. No application code was changed during activation.
- Original source config, model configuration/artifact, 5,082-game journal, P0 approval/report/seal/capture/scope and both original journal heads remain unchanged. Existing forecast journal revision 1/head `e8946f46…` still contains 168 numerical forecasts across 12 fixtures; P0 revision 1/head `b546f3ac…` has zero positions.
- Exactly one EdgeLab V6 LaunchAgent is loaded: `com.edgelab.v6-shadow-pilot`, 60-second interval, last exit 0. Reviewed installed plist hash `f8cd8fba…` is unchanged. No second worker, service reload, power setting or schedule modification occurred. The worker normally exits between ticks.
- One real **zero-credit** The Odds API `/v4/sports` catalogue request at 23:04:07 AEDT confirmed **16 used/reserved, 484 remaining**. Its retained receipt is `3f427f52-33d7-449b-81ff-237ae87d2f4a`. Source keys were verified present without exposing/changing them. No odds/game/BDL request was made during activation.
- Eleven remaining original discovery jobs and 13 results jobs reserve up to 37 credits; the approved replacements add 6. Worst-case planned cumulative usage is **59/60**, before unplanned retries. 44 credits remain under the ceiling; the 100-credit provider reserve remains enforced. Uncertainty/quota stops never trigger an upgrade or refund.
- Post-install checks verified both receipt hashes/modes, all three approved future slots, rejection of 17 November for expanded capture, current waiting state, zero new positions/profit, and unchanged original controls/worker. Future-slot checks were offline permission evaluations, **not early captures**.
- Verification rerun: **853 tests across 82 files**, **162 local SQL checks** (70 core, 77 history, 15 source-cloud), TypeScript, lint and production build passed. The separate 20 targeted lifecycle/approval/cache/orchestration tests also passed. The initial plain `npm test` passed 835 tests and skipped 18 optional database tests; rerunning with the existing isolated PostgreSQL runtime passed all 853 without skips. The previous implementation checkpoint passed 22 intercepted browser groups and cloud-safety checks; those browser checks were not repeated for this configuration/documentation-only activation. No hosted changes or new genuine PAPER settlements are claimed.

Private audit records are under `.local/v6/v63-activation/`: `preflight-lifecycle.json`, `offline-preflight.json`, `live-quota-verification.json`, `activation.json` and `post-activation-verification.json`. They contain no source keys. The one-shot operator helper is not a scheduled worker and must not be replayed to reinstall existing receipts.

## Next automatic operations and owner inspection

All times Australia/Melbourne:

1. **16 November 18:00:** independently reconcile existing prospective forecast results. Existing forecasts created before the new permit remain forecast-only; they are not retrospectively registered.
2. **16 November 19:00:** first approved expanded-market capture, new prospective forecasts and the first possible automatic qualifying moneyline PAPER registrations. Missing Sportsbet markets or failed quality rules can correctly leave zero positions.
3. **17 November 18:00:** next results cycle, including any independently verifiable registered positions. Ambiguous/missing finals remain unresolved; no result is inferred from elapsed time.

Keep the existing Mac awake, online and in its owner login session. Neither Next.js nor ChatGPT needs to stay open for the worker. Open the existing private local workspace:

- `/v6`: forecast counts, hypothetical equity/exposure and actual registered-position count.
- `/v6/research`: Forecast only, Awaiting price, Registered PAPER snapshots and Final result verified filters; exact clocks and original evidence remain inspectable.
- `/v6/positions`: genuine registered hypothetical snapshots and independently verified settlements/P&L only. No observations or synthetic tests enter this account.
- `/v6/models`: prospective per-family accuracy, separate from historical development and paper accounting.
- `/v6/health`: source/worker checkpoints and permit state. Hosted automation remains disabled.

Source emergency stop: `.local/v6/source-pilot/STOP`. PAPER-only stop: `.local/v6/local-paper/daily-pilot/STOP`. These prevent further corresponding operations without deleting records. No genuine expanded capture or new PAPER registration/settlement has happened at this installation checkpoint; subsequent retained evidence must prove execution.
