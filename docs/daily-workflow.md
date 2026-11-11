# Daily workflow — local implementation, 6 November 2026

This extends the existing application. Approved Methodology Revision 1, existing historical sources, owner claims, settings and financial/RLS rules remain unchanged. There were no hosted writes or migrations during development.

## Private Daily Cycle source save — updated 11 November

In your existing signed-in private tab, open Research → **2 · Import GPT Results**, paste a genuine source-backed Daily Cycle, then **Validate Daily Cycle** → **Review & Apply Daily Update**. Review the **Save private Daily Cycle** dialog and use **Confirm research-only save**. Success says **Private cycle saved and read back** and links its archived source. Reloading restores the receipt and disables replay. If a save errors, the draft stays available; revalidate/reload current history before retrying. Do not repeat the completed historical reconciliation.

This operation archives the cycle, source candidates, checkpoint and feedback only. Quoted prices/times remain original source claims; unsupported probability values remain raw and normalize to null. It neither registers an actual/paper position nor applies `resultUpdates`. Use the existing separate paper/financial and Results Review workflows for those actions. The new source save was tested in local PostgreSQL and intercepted private-browser transport; a new genuine hosted cycle through your personal session remains unverified. No additional migration is needed.

V6 autonomous paper implementation is separate from this legacy manual workflow. It is currently **LOCAL_TEST_ONLY** and disabled; see [current status](v6-implementation-status.md).

## Using the workflow

1. Run `npm run dev`, retain the existing private sign-in, and open **Research → Daily workspace**. Demo remains a separate synthetic browser workspace.
2. **Run Daily Research** prepares the manual ChatGPT prompt. It includes registered financial totals, labelled history/checkpoints/proposals, unresolved positions and the current approved methodology. Download the full methodology if needed. Source-confirmed day completion remains separate from an owner-reported active day.
3. Copy the prompt into a separate conversation. Require attributable original odds, exact fixture/market identities, uncertainty and defensible probability provenance. Unknowns stay null. No OpenAI API is used.
Provider inspection can supply additional source JSON for the separate conversation. Copy its observed values/source timestamps when useful; automatic provider-to-prompt feature hydration is not implemented, and descriptive statistics are not a numerical forecast.

4. **Import research JSON** accepts existing `edgelab.research-response` v1. Preview, explicitly acknowledge warnings/any probable duplicate, then **Import research candidates**. This archives source candidates without registering positions or completing a day. Exact sessions/selections are blocked from reimport, including renamed response/row IDs.
5. Each card offers **Confirm Placed**, **Track as Paper**, **Watch**, **Pass**. Original classifications/evidence remain immutable; Watch/Pass create separate dated decision journals. NO BET evidence remains visible.
6. **Confirm Placed** prefills research fields. Supply accepted execution odds, cash/bonus stake, actual placement time and any ticket/evidence reference. Research quote/time remain separate. Review the financial form and give its final confirmation. No bookmaker request or funding is generated. Research links are retained in a validated notes marker because historical UUIDs cannot be used as core research-candidate foreign keys.
7. **Track as Paper** requires separate final approval and current pre-event eligibility. It preserves original quote, prediction, provenance, hypothetical stake and all supplied legs. An actual-linked source cannot subsequently create a second independent paper forecast. Later actual registration does not silently settle or edit an existing paper position.
8. **Results and settlements / Check Results** opens the unified queue. Check Results refreshes records without unmounting the review screen. It queries only explicitly saved, currently matching provider identities when local access is enabled, with no more than three fixtures per click and no automatic settlement. Missing/unsupported coverage stays manual. Optional provider inspection is described in [sports-data.md](sports-data.md).
9. Enter results in the prefilled rows, or use **Generate Results Check Prompt** and import **edgelab.settlement-response v1**, a separate strict contract ([JSON Schema](settlement-response.schema.json)). Inspect exact IDs/identity hashes, final statistics/leg outcomes, source timing, event completion, terms and exceptions. Actual payout is separately supplied; calculated returns are never payout evidence. Unknown DNP/void/push/overtime/retirement/dead-heat rules stay unresolved.
10. Select eligible rows → **Review selected settlements** → final authorization → **Confirm selected settlements**. Source JSON is inspected, never blindly applied. Exact response replay is a no-op; changed-ID payload collisions, stale market identities, already-settled overwrites and inconsistent payouts are rejected.
11. Overview/Ledger/Paper/Analytics/next handoff read the persisted results. **Export complete experiment** includes existing immutable sources and audits. Confirm day completion only through its separate explicit control; import or settlement does not advance Day 6/7.

## Transactions and refresh

Actual/core-paper updates use one existing atomic app-workspace RPC. Imported-paper results plus append-only evidence/audits use one existing historical-workspace RPC. A batch spanning these workspaces uses **two transactions**, not a distributed transaction. A partial success is displayed; retry only remaining rows. Replays are idempotent. Each save revalidates current records and revision; account switches invalidate queued mutations.

The legacy historical Maxey paper and eight owner claims are excluded from qualifying daily forecast settlement. Their source-time outcomes, unknown prices/timestamps and provisional financial summaries remain unchanged. The A$500 cap is not a deposit.

## Research v1 optional leg extension

Existing single-selection files remain valid. Candidates may additionally supply `legs`, 1–20 objects with exactly:

`id` (UUID), `sport`, `eventId`, `event`, `participant`, `marketId`, `market`, `selection`, `line`, `odds`.

All fields other than ID allow null; incomplete market identity blocks paper registration. Per-leg source odds remain null when unavailable. `originalOdds` is the attributable combined ticket quote, never a product of unknown leg prices. Multiple legs require combined probability and EV null because no validated joint model exists. Leg forecasts, mixed Track A/B and original BET/CONDITIONAL/PAPER-TRACK/PASS labels can be retained verbatim in evidence. No schema migration is required: existing raw sources/snapshots already retain legs.

## Paper learning

**Analytics → Paper evaluation laboratory** exports a hash-addressed point-in-time dataset and grouped statistics. Qualifying entries require original attributable pre-event odds, prediction/registration proof and audited result receipts. Retrospective/incomplete historical evidence is explicitly excluded. Unsupported probabilities do not enter Brier/log-loss/calibration. Comparisons use original implied break-even odds on the same scored sample; these are not de-vigged market estimates. Cash and bonus hypothetical returns remain distinct and never enter actual bankroll. Wilson intervals assume trials; correlated selections make their effective sample smaller.

CLV, missing features and unrecorded input cutoffs stay null. Infinite log loss from an incorrect certainty forecast is reported explicitly, not clipped into a finite success. Dataset exports preserve raw research evidence and final receipts.

Offline manifest review validates exact dataset identity, ordered training/validation/frozen-model/unseen-test boundaries, input/outcome availability, duplicate IDs and fixture separation. Minimum independent fixture counts are 100/30/30 and can only be increased. It never trains, activates, promotes or rolls back a live model. `ownerApproved` in an imported file is an assertion, not an authoritative approval. There is no validated forecasting model, calibrated player distribution or correlation-aware SGM model. These remain future work after adequate source-supported data.
