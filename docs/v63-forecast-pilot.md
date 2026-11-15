# V6.3 daily forecast execution — 15 November 2026

Branch `feature/v6-3-autonomous-paper-pilot`, based on V6.2 `7410b8d`; stacked PR, no merge/deployment. This release adds operational forecast tracking, not model promotion or broader PAPER authority.

## Actual execution

Executed **`node scripts/run-v63-forecast-cycle.mjs --freeze-retained`**, with global network transport disabled and no environment/key loading. Used the existing approved 19:00 source capture; no provider request was made.

- Actual generation/input cutoff: **2026-11-15T09:43:12.141Z**, 20:43 AEDT. Commit:09:43:13.988Z.
- Evaluated22 future NBA fixtures: **168 numerical forecasts across12 fixtures**, plus140 excluded rows across10 fixtures. Each numerical fixture has two Elo win probabilities, six spread-side probabilities and six total-side probabilities. These correlated selections are not168 independent games.
- Predeclared analysis spreads:−7.5/0/+7.5; totals:200.5/220.5/240.5. Predicted margin and combined score are separately retained. These thresholds are not claimed as offered Sportsbet markets.
- **No bookmaker quote was attached, no EV/P&L invented, no PAPER position registered or settled.** Genuine forecast results remain unverified because their games are still future at this checkpoint.
- Source fixture receipt:`2bf8c3eb-0a6c-46b5-8c25-b53e3fb30b67`. Original dataset and source artifacts were not rewritten.

| Exact BDL fixture | Event start UTC | Home win probability | Predicted home margin | Predicted total |
| --- | --- | ---: | ---: | ---: |
|21718109 · Indiana at Philadelphia|15 Nov18:00|82.1117%|+6.0524|231.8720|
|21718110 · Lakers at Phoenix|15 Nov21:00|39.9666%|−0.3408|225.0535|
|21718111 · Charlotte at Clippers|15 Nov21:30|58.0382%|−1.4737|221.0582|

All are genuinely pre-event at their20:43 AEDT generation time. Elo snapshot:`b38162d50158a950fbcbba32337155dfd25cff3bead92318acdb9ec500fb6792`; score snapshot:`0a0e90fedab926aabfa46fcbe3bbde09d8bf678d241e8a91036bd7238a13ad67`. Models share underlying results and their agreement is not independent confirmation. No injuries/rotation/possession inputs or calibrated confidence intervals are invented; sensitivity ranges are parameter stress tests.

Fresh-process replay at20:57 appended **zero** forecasts and retained revision1/head`e8946f469ed0f7956d8846b967108e90849cbd8e287dc27da9018a8815677e48`. A separate read-only inspection at21:00 reproduced the stored numerical predictions from their original input/model snapshots. Command: `node scripts/run-v63-forecast-cycle.mjs --inspect`.

Private data: `.local/v6/forecast-ledger/<owner namespace hash>/`; input/model snapshots:`.local/v6/forecast-inputs/`. The initial checkpoint's history-hash input filename and implicit NBA/full-game format are preserved and validated on read; subsequent records explicitly store sport/period and input filenames hash the complete snapshot. Journal entries and original input files were not migrated or backdated. Preserve these folders and original evidence in private backups; the older V5 complete-experiment export does not include this local V6 journal.

## What runs automatically

The **existing** `com.edgelab.v6-shadow-pilot` Mac LaunchAgent remains loaded, with its original60-second tick, source receipt/window and18:00/19:00 schedule. No replacement/second worker or power setting was installed. It runs headlessly without Next.js or ChatGPT.

- **16 November18:00 AEDT:** next scheduled results cycle. Its single existing two-credit NBA scores read includes tracked unresolved forecasts; shared native-ID BDL reads independently verify exact finals. Quotas/cooldowns, three-day retention, original clock/identity bounds and execution leases remain enforced. Missing/conflicting or post-event-eligibility evidence stays unresolved.
- **16 November19:00 AEDT:** next scheduled discovery. The existing feature/future-fixture reads feed no-price Elo and score forecasts before any dependency on a priced market. Immutable forecasts are frozen under current source controls and original pre-event deadlines. Source-backed price observations are retained separately when available.
- New forecast paths are wired into that scheduler and exercised through the actual orchestrator with synthetic transports. **The next genuine scheduled V6.3 cycle has not happened yet**; initial genuine forecasts above came from the explicitly executed offline retained-data command. Prior15 November source jobs genuinely completed under V6.2.

Mac sleep or no network can still prevent execution. No software can run on an asleep Mac; deadlines are not extended. Keep the host awake/connected for these existing windows. Result identity uses retained canonical team aliases, not fuzzy name matching. The initial legacy bridge can be reconstructed from a catalogue already available at generation, at the actual verification time; no timestamp is backdated.

Source collection stops at the original28 November00:00 AEDT expiry. No cloud worker or hosted PAPER operation is activated.

## Persistence, scoring and separation

`forecast-journal.server.ts` is a separate owner-scoped, hash-linked, append-only journal with serialized writers, atomic file publication, fsync, revision/hash/clock validation and no PAPER/cash repository port. It rejects retrospective commits and changed duplicate records. Hash chains detect mutation, not privileged deletion/truncation. Successful source reads are checkpointed per original job; retries reuse original receipts without refreshing timestamps or refunding failed reservations. Stale quotes cannot be reused as fresh captures.

Forecasts freeze exact native fixture identity, market side/threshold, creation/input/event clocks, input/artifact/source hashes, numerical outputs and exclusions. Unknown fixture clocks/identities are retained as source exclusions. All target-day or later training outcomes and post-cutoff retrievals are excluded. An incomplete original forecast is not retroactively made accurate by later results; the earliest valid pre-event forecast remains the primary scoring record per fixture/model/market. Old P0/shadow forecasts never become positions.

Results append independent source IDs/hashes and actual reconciliation timestamps. Later disagreement remains auditable. Scoring uses binary moneyline Brier/log loss; spreads/totals use proper three-category win/push/loss Brier/log loss. Pushes are not silently scored as losses. Conditional non-push calibration is labelled separately. Multiple sides, thresholds and repricings are not independent fixtures; uncertainty intervals remain unavailable until sufficient independent fixture/date clusters. Offered-price and fixed-analysis samples are separate. Matched two-sided moneyline quotes support a de-vig comparator; unavailable prices/probabilities withhold EV and bookmaker scores.

## Disabled PAPER boundary

`daily-paper-pilot.server.ts` implements keyless registration and retained-result settlement through the existing V6 deterministic engine and append-only journal. The optional consumer is invoked by the same scheduled process after completed jobs. Missing approval returns `paper_not_authorised` without creating a journal.

A fresh exact owner receipt must approve a future bounded local window, code/policy/source hashes and an approval reference. Only **new NBA Sportsbet moneyline/Elo forecasts generated after that window starts** may qualify. Events must start within the permit. Existing two-pass probability, value, disagreement, freshness, reproducibility and sensitivity checks apply. No count, aggregate exposure or available-bankroll admission cap is added. The nominal reference isA$5,000; each position isA$50. No retrospectively selected observation can be promoted.

The separate journal lives at `.local/v6/local-paper/daily-pilot/ledger/` only after approval. The old P0 journal/expired permit are unchanged. The read-only dashboard verifies approved daily PAPER proofs and independent results before displaying that journal; two nonempty paper accounts are never combined or given two opening references. Grade revisions and replay checks prevent double P/L. Ambiguous cancellation/postponement/void conditions remain unresolved. Spread/total PAPER policy, terms and method activation remain unsupported/disabled; their fixed-line forecast research works now.

No daily PAPER approval or source-extension receipt was created. [Exact disabled approval package and scope](v63-pilot-approval.md).

## Source coverage and UI

Current source collection remains the approved NBA h2h schedule. New exact-hash preparation can **replace** three h2h reads with `h2h,spreads,totals`; no new-market request occurs without separate owner consent. Original raw multi-market responses and quote times are preserved. Unverified settlement terms or absent exact-line forecasts leave offered-market probabilities null; prices alone do not create EV. NBL/tennis and unsupported player props remain honestly unavailable.

Open your existing private workspace:

1. `/v6`: actual daily numerical/fixture counts, exclusions, last publication, next operation and separate PAPER accounting.
2. `/v6/research`: grouped exact forecasts; filter moneyline/spread/total, date, evidence, Forecast only, Awaiting price, Excluded, Verified or Registered PAPER snapshots. Expand a selection for model hash, cutoff, margin/total, sensitivity and exclusions.
3. `/v6/models`: genuinely prospective per-family scores, matched baselines, calibration/sample limits, separate from historical V6.2 development tables. Until verified results exist, scores say Unavailable.
4. `/v6/positions`: registered hypothetical positions only; no fixed-line forecast enters this ledger.
5. `/v6/health`: scheduled stages/errors, source counters, original permit expiry and daily forecast status. No closed-browser push/Hermes delivery is claimed.

Normal owner Auth/RLS binding remains required. Demo does not fetch private evidence. Cloud mode never falls back to these local journals. Public DTOs contain no owner identity, raw evidence body, filesystem path, source URL or API key. No hosted SQL, credentials, account records, V5 methodology/A$500/A$5 rules, funding or real wagering was changed.

## Verification

**853 tests /82 files;162 local SQL checks (70 core,77 history,15 cloud proposal);22 isolated production-browser groups; TypeScript, lint, production build and four cloud-safety groups passed.** Tests cover automatic scheduled generation/results, source checkpoints, quote integrity, no-price persistence, future-input rejection, owner isolation, missed deadlines/rollback, immutable forecasts, push scoring, bounded approval refusal and hypothetical registration→independent settlement→restart/replay.

Positive PAPER lifecycle tests use invented sources in disposable temporary directories; they are not genuine settled bets. Browser sessions/transports are intercepted, with actual retained data used for render inspection; no new personal-session/hosted acceptance is claimed. An overlapping-build trace check failed, then passed on serialized completed output. Development browser checks also exposed duplicate calibration-row React keys; these were fixed by market family and line source, with the strict request guards preserved. Private data/keys are excluded from final production traces/bundles. No deployment occurred.

Read-only protected audit15 November21:09 AEDT: one loaded LaunchAgent,1,420 invocations/exit0; Odds16 used/reserved,484 remaining; BDL4 retained reads for UTC15 November. All original protected hashes remain identical. P0journal staysrevision1/headb546f3ac…/zero positions, permit expired. Task sports-provider requests: **0**; genuine registered/settled PAPER positions: **0/0**. New genuine forecast outcomes remain future/unverified.

## Exact changed-file inventory

- `AGENTS.md`
- `README.md`
- `docs/architecture.md`
- `docs/v6-dashboard.md`
- `docs/v6-implementation-status.md`
- `docs/v63-forecast-pilot.md`
- `docs/v63-pilot-approval.md`
- `ops/v63-pilot.proposed.json`
- `scripts/check-v6-dashboard-browser.mjs`
- `scripts/run-v6-controlled.mjs`
- `scripts/run-v63-forecast-cycle.mjs`
- `src/components/v6/daily-forecast-panel.tsx`
- `src/components/v6/dashboard.tsx`
- `src/components/v6/model-intelligence.tsx`
- `src/components/v6/panels.tsx`
- `src/lib/v6/controlled-scheduler.server.ts`
- `src/lib/v6/controlled-team-runtime.server.ts`
- `src/lib/v6/daily-forecasts.server.ts`
- `src/lib/v6/daily-paper-pilot.server.ts`
- `src/lib/v6/daily-paper-view.server.ts`
- `src/lib/v6/daily-source-extension.server.ts`
- `src/lib/v6/dashboard.server.ts`
- `src/lib/v6/dashboard.ts`
- `src/lib/v6/forecast-journal.server.ts`
- `src/lib/v6/forecast-view.server.ts`
- `src/lib/v6/job-source-cache.server.ts`
- `src/lib/v6/team-pilot.ts`
- `src/lib/v6/team-reconciliation.ts`
- `tests/v6-prediction-runtime.test.ts`
- `tests/v63-approval.test.ts`
- `tests/v63-forecasts.test.ts`
- `tests/v63-source-cache.test.ts`
- `vercel.json`
