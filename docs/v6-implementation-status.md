# V6 implementation status — 11 November 2026

Branch: `feature/v6-autonomous-paper`. Overall status: **LOCAL_TEST_ONLY**. No prospective autonomy, deployment, new hosted migration, V5 change or external messaging is claimed.

## Preserved checkpoint

Commit `2501e80` preserves the completed owner-account activation. Do not repeat reconciliation or imports. The 46 source items, one actual, three tracked legacy papers, zero funding and approved methodology remain untouched. Private exports stay in ignored `.local/`; no personal source record or credential is introduced into this branch's new implementation.

## Private Daily Cycle fix

The old blanket private-mode rejection was caused by a missing durable cycle journal/application boundary, not by missing Auth/RLS or a needed migration. The new research-only operation uses the existing `edgelab_save_history` transaction for source cycle, candidate snapshots, feedback and audit. The final modal says exactly what is saved. It creates no V5 actual/paper position or result, and modifies no legacy financial record. Existing Results Review remains the separate authorised settlement path.

Original JSON bytes, prices and timestamps are retained. Unsupported numerical probability claims stay raw and normalize to null; the optional independent probability provenance extension preserves documented estimates without rebranding LLM output. Synthetic private inputs, malformed prices/URLs, embedded credentials and conflicting duplicate content fail closed. Exact replay is a no-op; renamed content is blocked through a semantic fingerprint; existing SQL uniqueness/revision checks protect concurrent saves. Save errors are visible inside the modal. Success requires an authenticated read-back. Private checkpoints/feedback restore from the historical journal rather than localStorage.

Executed targeted tests: 3 source-domain tests and 1 local PostgreSQL integration pass; 4 isolated mocked-browser groups pass, including injected failure/rollback, retry, read-back and reload duplicate detection. They use invented fixtures in ephemeral databases/intercepted transport, not hosted writes. A new genuine source-backed cycle through the owner's private browser has **not** been saved this turn. Existing production history was not accessed or changed.

## V6 work in progress

- Owner-requested narrow policy exception recorded in AGENTS; legacy guards remain. A$5,000 reference/A$50 fixed notional stakes; no selection/exposure/balance limit. Policy is versioned and requires exact-hash standing activation before armed operation.
- Separate strict V6 domain and canonical market identities, frozen observations/model inputs, deterministic cent accounting, virtual excess exposure, exact settlement/revision replay, Brier/log loss and fixture counts implemented.
- Experimental Poisson minutes/rate and surface-Elo formulas implemented. These are **not validated models**. No live model is activated. Model validation labels in local fixtures are test controls, not empirical validation.
- Headless worker interfaces and isolated owner/cohort file repository implemented; no V5/Supabase financial capability. Source permission, kill switch, standing activation, exact identity and pre-event clock gates remain. Rejected observations are retained; no top-N or budget-based selection suppression.
- Disabled CLI/config and launchd example prepared, **not installed or scheduled**. CLI cannot invent a forecast: missing activated model rejects candidates. Collection and final-result adapter integration remain required.
- Local V6 engine/worker tests currently pass 8 groups, including >100 concurrent notional entries/negative availability, exact market thresholds, replay/corrections, file-lock concurrency, restart read-back and late-error rollback.

## Source gate

Read-only audit pinned `DanielTomaro13/sportsdata-mcp` at `b68d84a8145bd0d29b6342572cdb0b8942467adb`, MIT. Anonymous GET tools coexist with account, slip-pricing and real-wager endpoints; no package/server or account tools are installed/enabled. Direct Sportsbet automation permission is not established; direct requests remain **NO-GO**. MIT code permission does not grant upstream data permission.

The Odds API explicitly permits research/storage/derived analytics. A bounded free-tier pilot used four actual credits, leaving 496/500. NBA/NBL/WTA Sportsbet h2h and one NBA player-points sample returned prices. ATP had no active key in this catalogue sample. Full prop/sport/settlement coverage, stable participant mapping and current statistical completeness remain unverified. Private exact samples/hashes/times are in `.local/v6/odds-pilot-*`; no request used bookmaker login or Supabase. See `docs/v6-provider-coverage.md` for the matrix when completed. No more pilot odds requests are authorised by the four-credit harness this month.

## Next executable tasks

1. Finish local V6 validation/proposed narrow owner-scoped SQL design and tests; do not deploy without separate explicit owner approval. The existing whole-workspace RPC must not become the V6 worker write path.
2. Map permitted provider fixture/player identities and bookmaker terms exactly, and connect reproducible pre-event inputs/official results. Fail closed while coverage is missing. No funded API upgrade.
3. Validate independent models chronologically out of sample, freeze their registry/manifests, and review policy activation. Then run a real-source prospective shadow pilot through registration and final grading before arming unattended operation.
4. UI hosting, managed scheduling, Hermes/iMessage/outbox delivery remain later approval gates. No new UI cosmetics are prioritised.

Resume: read this file, AGENTS and the V6 policy/master; inspect current diff/commits; do not repeat account activation or consume more pilot credits. Continue from the last tested milestone and update this checkpoint with actual results.
