# Historical actual-wager claims

Owner-reported history is a source claim until its evidence meets the existing financial-registration requirements. It can be preserved in the private historical archive without registering a bet, creating a transaction, verifying an outcome or changing the experiment methodology.

## Review and approve

1. Use the existing signed-in private workspace. Open **Historical Import → Import historical evidence** and choose a new claim JSON. The eight previously saved claims must not be re-imported; the same file should show them as already saved. Files are parsed locally; choosing a file does not upload or save it to Supabase.
2. Review every source row, reported cash/bonus stake, reported price, accepted execution price, source-time outcome, payout, missing evidence and current archive/ledger matches. Pending at the source time does not establish the current result.
3. The optional **Historical actual wager claims** tool below the archive can retain a source on this browser for provisional context. This uses an account-specific local key, separate from Demo and from Supabase. Overview and Betting Ledger can then show its provisional summary before archive approval.
4. The primary uploader validates automatically. Select only intended archive rows, acknowledge the selected incomplete evidence once and separately resolve each probable duplicate. Exact duplicates cannot be imported.
5. Choose **Review archive import**, inspect the summary, then choose **Confirm archive import** only if you want those selected sources saved. Cancel leaves records unchanged. This preserves their immutable raw source, source hash, nulls, transformations and audit history. It creates no actual bet, deposit, payout transaction or paper position.
6. Saved claim summaries remain available from the private archive after refresh. They stay separate from registered actual-ledger totals and charts. Remove a browser attachment if you want the summary to use saved archive claims instead; clearing the attachment never deletes an archived record.
7. For a financially complete record, choose **Review source → Review actual-ledger registration**. Inspect the evidence and deterministic settlement, check the separate financial authorization, then choose **Confirm financial registration**. Missing or inconsistent execution evidence keeps this action disabled. Never fill gaps with import time, a pre-placement quote, guessed leg results or the funding cap.

The existing lifetime funding cap is a limit, not evidence of a deposit. Modelled allocations are source context only and never a verified bookmaker balance. Cash, promotional winnings, paper returns and funding remain separate.

## Format and provenance

The versioned `edgelab.historical-wager-claims` JSON envelope retains a stable source ID, source reference, original source text, explicit `owner_reported`/`synthetic` classification, records and an optional reconciliation checkpoint. Each claim preserves its reference, exact known selection/legs, reported stake and price, price type, accepted odds and their source when actually known, original timestamps, ticket reference, reported outcome/cash payout, strategy and evidence notes. Unknown fields are explicitly null.

Reported prices and pre-placement quotes are preserved in raw provenance. Only evidenced accepted execution odds map to the financial snapshot's odds field. Snapshot corrections cannot silently turn a reported quote into accepted execution evidence. Aggregate checkpoint figures never create individual records or funding entries. Conflicting amounts require source resolution rather than an inferred adjustment.

The adapter hands nullable records to the existing Historical Import workflow; it does not create a second database or registration path. Archive uniqueness, append-only audits, user-scoped RLS, authenticated repositories and optimistic revision checks continue to apply. Both the current archive and loaded actual ledger are checked for duplicates; uncertain matches are flagged rather than merged.

## Financial summary

Reported settled cash P/L is reported cash payouts minus settled cash stakes. Reported promotional cash winnings are separate and exclude the promotional stake's face value. Reported combined P/L is the sum of these source amounts. Outstanding cash exposure uses source-time pending cash stakes and does not infer a new loss or a current settlement. Unknown or contradictory amounts are flagged; incomplete totals must not be presented as a complete reconciliation.

The provisional summary is not added to ledger totals, bankroll, financial ROI or performance charts. When a source is both locally attached and archived, the UI displays the chosen source set rather than summing it twice. Registered matches are disclosed; reported and registered totals remain separate.

If distinct source rows may describe the same wager, preserve both sources for review and leave their combined money rollups unknown. Keeping a probable duplicate as separate evidence does not establish two separate financial positions.

## Boundaries

Private sources cannot be relabelled as synthetic Demo data; synthetic fixtures cannot be saved into a private workspace. Local retention is scoped to the active authenticated identity and is not a hosted backup or a substitute for explicit archive approval. No new migration, paid service, bookmaker access, automatic settlement or wager execution is required.

Actual ticket/execution evidence, placement timestamps, settlement timestamps, strategy and exact leg identity/prices/outcomes remain necessary wherever required by the existing financial validator. A ticket ID helps provenance but does not replace those fields. For historical SGMs where leg prices were never quoted or retained, the current strict ledger may remain unsuitable; preserve the claim in the archive rather than weakening validation to populate charts.
