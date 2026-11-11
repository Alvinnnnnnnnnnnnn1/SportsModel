# V6 implementation status — 11 November 2026

Branch: `feature/v6-autonomous-paper`. Overall status: **LOCAL_TEST_ONLY**. No prospective autonomy, deployment, new hosted migration, V5 change or external messaging is claimed.

## Preserved checkpoint

Commit `2501e80` preserves the completed owner-account activation. Do not repeat reconciliation or imports. The 46 source items, one actual, three tracked legacy papers, zero funding and approved methodology remain untouched. Private exports stay in ignored `.local/`; no personal source record or credential is introduced into this branch's new implementation.

## Private Daily Cycle fix

The old blanket private-mode rejection was caused by a missing durable cycle journal/application boundary, not by missing Auth/RLS or a needed migration. The new research-only operation uses the existing `edgelab_save_history` transaction for source cycle, candidate snapshots, feedback and audit. The final modal says exactly what is saved. It creates no V5 actual/paper position or result, and modifies no legacy financial record. Existing Results Review remains the separate authorised settlement path.

Original JSON bytes, prices and timestamps are retained. Unsupported numerical probability claims stay raw and normalize to null; the optional independent probability provenance extension preserves documented estimates without rebranding LLM output. Synthetic private inputs, malformed prices/URLs, embedded credentials and conflicting duplicate content fail closed. Exact replay is a no-op; renamed content is blocked through a semantic fingerprint; existing SQL uniqueness/revision checks protect concurrent saves. Save errors are visible inside the modal. Success requires an authenticated read-back. Private checkpoints/feedback restore from the historical journal rather than localStorage.

Commit `533ccf8` contains this fix. Three source-domain tests and one local PostgreSQL integration pass; four isolated mocked-browser groups pass, including injected failure/rollback, retry, read-back and reload duplicate detection. They use invented fixtures in ephemeral databases/intercepted transport, not hosted writes. A new genuine source-backed cycle through the owner's private browser has **not** been saved this turn. Existing production history was not accessed or changed. To use the fix, refresh the existing signed-in Research page, validate a genuine cycle and review the research-only confirmation; no account setup is required.

## V6 implemented milestone

- Owner-requested narrow policy exception recorded in AGENTS; legacy guards remain. A$5,000 reference/A$50 fixed notional stakes; no selection/exposure/balance limit. Policy is versioned and requires exact-hash standing activation before armed operation.
- Separate strict V6 domain and canonical market identities, frozen observations/model inputs, deterministic cent accounting, virtual excess exposure, exact settlement/revision replay, Brier/log loss and fixture counts implemented. Integer-line push probabilities are distinct from win probabilities and included correctly in EV; prices round half up to cents.
- Experimental Poisson minutes/rate and surface-Elo formulas implemented. These are **not validated models**. No live model is activated. Model validation labels in local fixtures are test controls, not empirical validation.
- Headless worker interfaces and isolated owner/cohort file repository implemented; no V5/Supabase financial capability. Source permission, kill switch, standing activation, exact identity and pre-event clock gates remain. Rejected observations are retained; no top-N or budget-based selection suppression.
- Disabled CLI/config and launchd example prepared, **not installed or scheduled**. CLI cannot invent a forecast: missing activated model rejects candidates. Collection and final-result adapter integration remain required.
- Pure permitted-source normalization requires a hash-approved exact fixture/participant/terms registry, retains original response bytes/hash and rejects fuzzy matches, duplicate outcomes and source credentials. Missing market timestamps remain null. No live canonical registry has been approved/connected.
- Commit `b4bcc29` contains the engine/worker/matcher. Twelve V6 engine/worker/source tests pass, including >100 notional entries/negative availability, exact thresholds, push mass, replay/corrections, file-lock concurrency, dead-process recovery, restart read-back and late-error rollback.
- Commit `b05b906` records the bounded diagnostic and ten-table owner-scoped SQL proposal in `supabase/proposals/202611110001_v6_paper.sql`, **outside migrations, unapproved and unapplied**. Its embedded PostgreSQL integration passes against all three existing migrations, including worker denial of V5 access, RLS, inactive policy/model rejection, immutable sources/grades, uncapped registration and quota rollback. SHA-256: `8e718d755c70fa049f70981e3d7db0bfbdbbd3a5b2166e8c5d69501c077649da`. Worker JWT issuance and Supabase V6 repository are not implemented; review is required before a deployment request.

## Source gate

Read-only audit pinned `DanielTomaro13/sportsdata-mcp` at `b68d84a8145bd0d29b6342572cdb0b8942467adb`, MIT. Anonymous GET tools coexist with account, slip-pricing and real-wager endpoints; no package/server or account tools are installed/enabled. Direct Sportsbet automation permission is not established; direct requests remain **NO-GO**. MIT code permission does not grant upstream data permission.

The Odds API explicitly permits research/storage/derived analytics. A bounded free-tier pilot used four actual credits, leaving 496/500: 20 NBA h2h, 10 NBL h2h, 8 WTA h2h and 10 NBA player-points outcomes observed. ATP had no active key in this catalogue sample. Full prop/sport/settlement coverage, stable participant mapping and current statistical completeness remain unverified. Private exact samples/hashes/times are in `.local/v6/odds-pilot-*`; no request used bookmaker login or Supabase. See [the completed coverage matrix](v6-provider-coverage.md). No more pilot odds requests are authorised by the four-credit harness this month.

## Final executed verification

- `EDGELAB_POSTGRES_RUNTIME=/private/tmp/edgelab-db-validation npm test`: **612/612 passed**, 47 files, no skips. Includes the new private-cycle and V6 proposal PostgreSQL tests plus all existing auth/persistence/security/domain tests.
- Core and historical embedded SQL scripts: **70 + 77 = 147 checks passed**. The separate V6 SQL integration also passed within Vitest; it is not counted as 147 new hosted checks.
- Private Daily Cycle mocked browser: **4/4 passed**. Existing reconciliation regression: **6/6 passed** with invented fixtures and intercepted transport. Zero hosted/financial writes or escaped external requests. This is not a repeat of the personal import.
- `npm run typecheck`, `npm run lint`, `npm run build`: passed. Production build generated all existing routes. Existing local development server remains running.
- Disabled CLI smoke test returned `disabled`, no model activated, no final grader connected, no V5 access. `plutil -lint ops/com.edgelab.v6-paper.plist.example` passed; no launchd job was installed.
- The historical migration still hashes to approved `fa9c50ac7e4be61ec8eaa92e7e6c66a89c8d583b966843cd97cb64f97afef08a`. No existing migration changed and no remote CLI write/push/reset ran.

Real-source observation → qualifying forecast → automatic pre-event registration → official final result → grade has **not** passed. No SHADOW_MODE or PAPER_AUTONOMY_VERIFIED status is claimed. Existing account security verification remains the prior checkpoint; new local tests do not replace fresh normal-user hosted evidence.

## Next executable tasks

1. Build/verify the permitted provider-to-canonical fixture/player/settlement-terms registry against retained samples **offline**, and connect source-retained current statistical inputs and final-result adapters. No more pilot credits, fuzzy identities, fabricated features or funded API upgrade. Unsupported sports/markets must remain disabled.
2. Implement chronological independent model validation and a trusted model registry, then wire the real collector/model/grader ports. Labels/formulas alone do not qualify a model. Preserve raw source/grade snapshots and add complete benchmark/calibration/exposure reporting and operational failure journaling.
3. Review the proposed SQL/role/JWT/quota/atomic hosted repository design, obtain explicit deployment approval, and implement/test its scoped adapter; never use the legacy whole-workspace RPC as worker access. Review exact standing policy activation separately.
4. Run a real-source prospective shadow pilot from registration through final grading. Only after those gates may scheduling be activated. UI hosting, managed availability, Hermes/iMessage/outbox delivery remain later explicit deployment/permission gates. No UI cosmetics are prioritised.

Resume: read this file, AGENTS and the V6 policy/master; inspect current diff/commits; do not repeat account activation or consume more pilot credits. Continue from the last tested milestone and update this checkpoint with actual results.
