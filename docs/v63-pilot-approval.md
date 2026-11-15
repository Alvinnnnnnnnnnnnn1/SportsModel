# V6.3 bounded local pilot — approval requested, not recorded

Mode A forecast tracking is implemented and has genuinely frozen168 no-price forecasts across12 future fixtures using retained evidence. It requires no new source scope or PAPER permission. Existing next operations are16 November18:00 results and19:00 forecasting, Melbourne. See [actual execution](v63-forecast-pilot.md).

Your instruction requires explicit owner approval before new-market requests or broader PAPER registration. The following is one **local-only** review package; its checked-in file is disabled and cannot be used as an executable receipt:

[`ops/v63-pilot.proposed.json`](../ops/v63-pilot.proposed.json)

Canonical package hash, excluding its own `packageHash` field:

`9625d48dde809a6b4f517e0e2e19dd90e3c5787c16fa5908ae8a9ba3894e5783`

## Proposed permission

**Source extension:**16 November00:00 through22 November00:00 AEDT (15 November13:00Z–21 November13:00Z). Replace the existing19:00 h2h request on **16,18 and20 November** with one Sportsbet NBA request for `h2h,spreads,totals` at `/v4/sports/basketball_nba/odds`. Maximum3 credits per replacement,6 incremental credits total. All other captures remain h2h. Same Mac worker, no new schedule, poller, host or source. Provider documentation is not a coverage guarantee; unavailable Sportsbet markets stay unavailable.

Retained baseline16 used/reserved,484 remaining. Eleven remaining existing discovery jobs plus13 results jobs cost up to37 further credits. Six incremental replacement credits bring worst-case cumulative usage to **59/60**, before unplanned retries. The global60 ceiling and100-credit provider reserve stay enforced; no refunds or counter resets. A quota stop can leave later work unresolved, never trigger a paid upgrade. Recheck actual counters/remaining jobs before issuing the receipt.

**Separate bounded PAPER permission:** the same16–22 November local window, **NBA full-game Sportsbet moneyline only**, frozen original Elo-only definition and existing two-pass quality rules. A$5,000 nominal reference/A$50 hypothetical entries; unlimited distinct qualifying positions with no aggregate hypothetical exposure/balance admission cap. Only newly generated, genuinely pre-event, source-backed forecasts after the approved start may register; their events must start within the window. Independent retained finals may settle those existing positions afterward. No force to create a position and no manual shortlisting once this exact policy is authorised.

This is experimental research; it asserts no profitability, calibration, injury coverage or independent-model agreement. It does **not** approve score-model promotion or spread/total PAPER registration. Original observations and P0 entries stay unchanged; the expired P0 permit is not extended.

## Exact bindings

| Binding | SHA-256 |
| --- | --- |
|Source plan|`748e5615be985fe4af8186211be1b2f69ef345b5db113fb0e66de51db53a1ce9`|
|Source code manifest|`f289f1b8c15f188dce9d8be2b7af90f1255b995521739f636f9686a436b5e4d7`|
|PAPER policy|`98ca96b831922e48b4e3ac1f87279f27228b3808b66023dc5fcfc624d8b7c31d`|
|PAPER code manifest|`dc4a28d819e3a0787b806763b9ce62f9d8cb119c8d4a7a866db03cc3812579a2`|

The JSON additionally binds the unchanged source receipt, Elo definition, score protocol, original pinned source-model artifact and every listed code-file hash. Dynamic forecast input/artifact snapshots are individually recorded and reproducible under the frozen methods; they are not model promotion.

## After an explicit decision

Do not manually copy the pending proposal into runtime configuration. Following explicit approval, recheck package/code/source hashes, actual counters, one active worker, unchanged original controls and a wholly future window. Record the **actual** approval time/reference; never backdate. Only then create owner-scoped private receipts at `source-pilot/market-extension-approval.json` and `local-paper/daily-pilot/approval.json`, matching the strict schemas. These are not API/service credentials. Originals remain unchanged.

Approval must be recorded **before16 November00:00 AEDT** for this exact future-window package. If that time passes, a hash changes, usage erodes the allowance or the host/plan changes, prepare a fresh future plan instead. Approval can explicitly cover source only, PAPER only, or both; no broader permission is implied.

Emergency stop remains the existing `.local/v6/source-pilot/STOP`; the bounded PAPER consumer also honours `.local/v6/local-paper/daily-pilot/STOP`. Stopping the source pilot prevents new reads; PAPER STOP prevents new local registrations/settlements. Do not alter power settings or unload the source worker without separate instructions.

Excluded: hosted PAPER A/B/C, SQL/migrations/provisioning, cloud activation, worker credentials, additional workers, Vercel deployment, real wagers/bookmaker accounts, V5 records, paid services, Hermes/external messaging and historical backdating. No receipt or approval was saved by this development task.
