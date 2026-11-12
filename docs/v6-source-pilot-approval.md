# Proposed 14-day source-only NBA pilot

Status: **OWNER APPROVED AND SOURCE-ONLY LAUNCHAGENT INSTALLED13NOVEMBER2026. Waiting for the14November window; no early research capture.** This is a separate research-only decision, not Approval A, B or C. All proposal files are ignored/private under .local/v6/source-pilot/proposal. No source request or credential issuance occurred during preparation.

Execution record: owner approval recorded at2026-11-12T13:31:50.636Z (13November00:31:50 Melbourne); installed at2026-11-12T13:33:57.141Z. Active config and installed plist exactly match the reviewed bytes. Actual completed approval receipt SHA-256: `c5f236058560271ff86fe4c3f7c042d8a93ced970e171835adfb64c6ded55a16`. This is the expected new hash after completing the reviewed template's approval fields. A/B/C remain unapproved. [Actual installation and pending live acceptance](v6-source-pilot-activation.md). The proposal text below is retained as the reviewed scope; its pre-approval wording is historical.

Tested implementation commit: `7d8275d` on `feature/v6-autonomous-paper`.

## Exact proposed window and operation

- Australia/Melbourne: **14 November 2026 00:00 inclusive → 28 November 2026 00:00 exclusive** (14 calendar days). UTC: 2026-11-13T13:00:00.000Z → 2026-11-27T13:00:00.000Z.
- Approval must arrive before the start. If approval is later, prepare and re-review new dates/hashes; never backdate approval or silently extend this plan. Actual approvedAt and owner approval reference are recorded only after explicit approval.
- NBA full-game, two-sided Sportsbet moneyline **observations only**, using existing permitted The Odds API and BALLDONTLIE permanent-Free teams/games paths. No direct bookmaker collection, login, wagers, paper positions, paper settlements/P&L, promotion, hosted access, Hermes or external messaging.
- Existing fixed model artifact: 5bfe98cb8fec70db371dd61b037e75f927de3348da524a9bca19790661e0a6b4. Frozen Elo, MOV, feature strength, original challenger, win-rate and three calibrations share one fixture information cutoff. No training or tuning is rerun.
- Discovery/odds at19:00 Melbourne on **14–26 November** (13 captures). The collector examines every attributable supported side; it does not ask the owner to select teams, shortlist winners or approve individual observations. Rejected/null candidates are retained.
- Results at18:00 on **14–27 November**, plus a final21:00 check on27 November. The first18:00 check is a no-op if no observations exist. Fully verified events are removed from recurring network checks; unresolved events are checked only inside the three-day retention window.
- No new forecasts for events scheduled after **27 November16:00 Melbourne**. This leaves five hours before the last result attempt, but does not assume any particular event must be final. Late, postponed, missing or conflicting scores can remain unresolved at pilot expiry. No request after expiry is authorised.
- Existing headless scheduler tick:60 seconds; it invokes the registered Node worker. There are **28 planned jobs**, not one API request per tick. Pre-start jobs are disabled for this small source budget. Each daily job has a two-hour catch-up window, bounded retry/backoff, durable checkpoints, lease serialization and replay protection. Missed windows are recorded, never backdated.

## Quota arithmetic and feasibility

Last retained Odds API quota at 2026-11-12T06:38:54.705Z: **10 reserved /10 provider-used /490 remaining**. No fresh account query was made because this task authorises offline work only. Baseline cumulative usage is max(reserved,provider-used)=10. Add maximum50 → **cumulative ceiling60**, not a reset to50 and not a new allowance every day.

Normal plan:13 odds ×1 +13 daily result batches ×2 +1 final result batch ×2 = **41 credits**, leaving **9 contingency credits**. Jobs with no pending events consume no result credits; unavailable markets may leave unused credits. Source catalogue/status reads are free but remain receipt/window/stop gated. Every attempt shares the existing odds-shared-budget journal. Failed transport reservations remain charged conservatively. Both local reservations and observed provider usage enforce the ceiling. The provider's minimum100-credit reserve and permanent500-credit Free-plan verification remain enforced. If other key users consume credits, the pilot has less capacity; it never increases its ceiling or enables billing. Provider resets never erase the pilot's retained local reservations. The plan is restricted to one local quota month.

BALLDONTLIE retained snapshot: UTC2026-11-12,10 locally reserved requests; current-day capacity has not been queried. Existing transport enforces at most5 starts per minute,≥12.5-second spacing,60 local requests/day and Retry-After. Runtime queues at12.6 seconds. Current-season full pagination, the next-two-day fixture page, an occasional catalogue refresh and one result read per distinct pending fixture share those counters. Capacity is conditional on actual slate size, retries and provider responses; exhaustion leaves explicit unresolved diagnostics, never a paid upgrade or missing-data invention.

The cadence fits the proposed Odds API allowance under normal availability. It deliberately sacrifices repeated near-start quotes/CLV to collect a broad pre-event sample cheaply. It is not live market monitoring. [The Odds API documentation](https://the-odds-api.com/liveapi/guides/v4/#get-scores) describes completed-score retention up to three days; [BALLDONTLIE's account tiers](https://docs.balldontlie.io/#account-tiers) show Free teams/games and5 requests/minute. No trial or paid endpoint is part of this plan.

## Exact review files and fingerprints

The following are SHA-256 hashes of **actual UTF-8 file bytes**, including formatting:

| Private review file | SHA-256 |
| --- | --- |
| .local/v6/source-pilot/proposal/plan.json | `2fc79107ab00630e7ff4cf829b4e4fec501118cf9a9beed3261c80a0b023fa59` |
| .local/v6/source-pilot/proposal/receiptTemplate.json | `dbb2e7282458a10e8574ef5a2fe805f83999e7c792791eb7ef7edefbd2042179` |
| .local/v6/source-pilot/proposal/intended.json | `2badec1068928b44c272c7641724d6e0d7d8dc675e1f03bdb85b9c0f169f7177` |
| .local/v6/source-pilot/proposal/disabled.json | `ad049620a03d81351395d010e481180c2fb946a1c0477b9901f6ac82c67ccb7e` |
| .local/v6/source-pilot/proposal/modelConfig.json | `962826422229b42472c7ef206a90a626e7f235e708ae0222f9b7786742f84248` |
| .local/v6/source-pilot/proposal/schedule.json | `d116f51c976a2a55c937453e689304baab12feec98e6be0e610eb28cad8fa8b4` |
| .local/v6/source-pilot/proposal/com.edgelab.v6-shadow-pilot.plist | `f8cd8fbaa773011577b638b81cf3baea38f0680360f6180451eb550e3248bba1` |

Canonical JSON **plan binding hash** used inside receipt/config: `c81a3f7ee8c7b441276e6459befef36da52d4855fcb237aeb392f03b5591c879`. This differs from the pretty-printed plan file's byte hash by design. The immutable artifact hash above is also a canonical JSON content hash.

receiptTemplate.json is intentionally non-executable: approvedAt=null, approvalReference=null, approvalStatus=pending. Its byte hash above is the exact reviewed **template**, not a claim that an approved receipt already exists. On approval, only those attestation fields are completed; scope, plan, dates, model artifact, policy bundle and credit limits remain bound. The approved receipt gets a new recorded hash at that time. No already-approved receipt hash can truthfully be supplied before the owner's timestamp/reference exist.

intended.json is the exact intended dry_run/sourceOnly configuration, referencing an absent approved-receipt.json. disabled.json is the safe installed-in-project review configuration: disabled, killSwitch=true, sourcesEnabled=false. The active config and active model2 shadow config do not exist. ModelConfig is an inactive proposal, not model activation. No secret is in any review file.

## Research-only identity/security boundary

The pilot uses a local source-only namespace derived from the existing private archive-batch binding, so no Auth account, password, service role, browser token or paper-worker credential is needed by the headless process. This namespace is **not** an Auth UUID and cannot be used for hosted writes. The signed-in dashboard verifies the real owner via Supabase Auth and an ordinary RLS-filtered SELECT of that existing batch before resolving the local research namespace. A second account fails before any evidence load. No legacy/test-account data is copied.

The exact pilot receipt must match owner, canonical plan hash, scope, month, cumulative ceiling and expiry. Source-only config cannot arm, load an activated model manifest or choose hosted persistence. Its separate local source-only-state repository rejects existing positions/grades; the dry-run worker never registers/settles anything. Margin/features remain observation-only and do not bypass existing production TypeScript/SQL rules. Releasing the **source** kill switch after approval does not activate any paper standing policy.

Controls are re-read before each provider request, including inside shared quota locks, and before new shadow/result writes. Expiry, changed controls or .local/v6/source-pilot/STOP blocks subsequent reads/writes. Records committed too late for the conservative pre-start safety buffer are rejected. Existing actual paper/V5 repositories are not worker capabilities.

Emergency stop: create .local/v6/source-pilot/STOP, or set active source config killSwitch=true /mode=disabled. Remove/disable the source LaunchAgent to stop ticks. No record deletion/reset is needed. Do not clear quota reservations when resuming. An expired pilot needs a separately approved replacement, not a clock adjustment.

## Installation and first acceptance — only after approval

Approval would authorise completing the source receipt with the owner's real approval timestamp/reference, copying the intended config to .local/v6/source-pilot/config.json and the reviewed modelConfig to .local/v6/model-development/shadow-config.json, and installing the reviewed **source-only** LaunchAgent. These are the explicitly proposed future actions; none happened in this turn. No permission to install/activate PAPER autonomy is included.

The generated LaunchAgent calls scripts/run-v6-controlled.mjs --config .local/v6/source-pilot/config.json --once every60 seconds, from this project with an absolute Node path. It uses the existing scheduler, not a new daemon framework, cron service or ChatGPT scheduled message. The signed-in browser and npm run dev are not needed for collection.

Before installation: recheck all proposal/artifact hashes, confirm the window has not started, preserve current quota counters, ensure only the existing permanent-Free source keys are configured server-side, create private log folders, and confirm no STOP file/other worker is active. No key value is printed/requested in chat. First approved catalogue read verifies the free quota before a credit-bearing request. Changed capacity, missing market coverage or unsupported data must stop/report rather than fabricate a successful collection.

The existing Mac must be awake, network-connected and running the owner LaunchAgent session. Sleep/offline outages are **not solved by launchd**; delayed ticks may coalesce, missed jobs are recorded and result checks after72 hours cannot recover expired provider data. Actual installation, uptime, live provider acceptance and a genuine new-slate lifecycle are unverified until the separately approved pilot runs. No new paid/always-on host is required or enabled.

After the first source-backed freeze: inspect /v6/research for every model/side, exact original price/time, exclusions and observational verification; /v6/models → New multi-slate shadows for one-fixture-per-version scoring, matched bookmaker differences, populated calibration/counts and per-event-date performance; /v6/health for execution checkpoints. /v6/positions must stay empty/unmodified. Fully verified fixtures are not re-fetched routinely. Independently supplied corrections append result revisions and update scores without rewriting original forecasts; automatic discovery of all later corrections is not claimed.

## Verification and approval request

Final executed checks are recorded in docs/v6-implementation-status.md. Synthetic transport tests exercise the actual scheduler/worker from beyond-today discovery to all-model freeze and independent final verification, with zero paper positions/grades. They cover scope/owner/hash/window rejection, no-read stop gates, credit ceilings/reserves, first-quote locking, late commits, no-result/reprice replay, missing/conflicting scores, corrected/idempotent results and no further requests for verified events. Browser tests use intercepted synthetic sessions; they do not prove real source availability or installed-job uptime.

**Requested approval:** approve this exact14-day source-only pilot bound to canonical plan `c81a3f7ee8c7b441276e6459befef36da52d4855fcb237aeb392f03b5591c879`, the exact intended config and LaunchAgent above, maximum50 additional odds credits /cumulative60, existing permanent-Free sources and model artifact, including source-only LaunchAgent installation. This grants no A/B/C approval, hosted migration, paper registration/settlement, bookmaker account access, model promotion, paid service or external messaging. If the dates lapse, request a refreshed package.
