# V6 provider coverage — observed 11 November 2026

Status: **permitted-provider read pilot only**, not prospective paper autonomy. Actual cost: **A$0**, four free credits used, 496 remaining according to provider headers. No paid account upgrade, direct bookmaker request, Supabase write or paper registration occurred. Observations describe these samples, not guaranteed ongoing coverage or available execution prices.

## Permission and endpoint audit

The pinned open-source audit is `DanielTomaro13/sportsdata-mcp` at commit `b68d84a8145bd0d29b6342572cdb0b8942467adb`. Its MIT licence permits use of the code; it does not grant upstream data rights. The Sportsbet specification contains anonymous sports/results GET endpoints alongside account/history, slip-pricing and wagering operations. No package/server was installed, no account-capable tools enabled and no direct Sportsbet request made. Direct automated Sportsbet collection remains **NO-GO** until permission is established.

The separate aggregator is **the-odds-api.com**, never the similarly named theoddsapi.com. Its [terms](https://the-odds-api.com/terms-and-conditions.html), reviewed 11 November, permit storing data and research/derived analytics/model use. Its [free plan](https://the-odds-api.com/) advertises 500 monthly credits; the pilot independently required `remaining + used = 500` before further reads. Sportsbet is listed as AU bookmaker key `sportsbet` in the [official bookmaker list](https://the-odds-api.com/sports-odds-data/bookmaker-apis.html). The [V4 guide](https://the-odds-api.com/liveapi/guides/v4/) documents sport catalogue, featured odds and per-event additional-market endpoints. These permissions do not prove every market/fixture/result is supplied.

## Actual observed coverage

| Sport | Request/sample | Sportsbet outcome prices returned | Decision |
| --- | --- | ---: | --- |
| NBA | `basketball_nba`, h2h | 20 | GO for bounded permitted price reads; canonical participant IDs/terms and validated model missing |
| NBL | `basketball_nbl`, h2h | 10 | GO for this featured-price sample; player props not tested |
| ATP | Catalogue had no active ATP tournament key | 0; no odds request made | NO-GO for this run; does not prove permanent lack of ATP support |
| WTA | `tennis_wta_finals`, h2h | 8 | GO for this tournament sample only; independent tennis features/results unverified |
| NBA player points | One exact event, `player_points` | 10 | GO for this prop sample only; ten outcomes are not ten distinct players or registered positions |

The h2h sample finished `2026-11-11T06:54:16.933Z` (17:54 Melbourne). All 38 h2h outcomes had fresh market timestamps under the existing 300-second preview threshold. The NBA prop request finished `2026-11-11T06:58:54.957Z` (17:58 Melbourne). Two free catalogue requests and four one-credit odds requests were made in total; there was no polling, retry or historical-data request. No additional pilot credits are available under this harness's four-credit November ceiling.

Original market timestamps and legacy bookmaker timestamps are retained separately. Retrieval never substitutes for a missing original market timestamp. Participant names in a response are not stable canonical player/team IDs. The raw samples do not establish exact grading rules, all props, SGM pricing, official player statistics or automated settlement coverage. Previous API-Sports statistics audits are documented in [sports-data.md](sports-data.md); those sample-specific findings are not expanded by this odds pilot.

## Retained evidence

Private raw responses and normalized prices are in ignored `.local/v6/odds-pilot-2026-11-11T06-54-13-423Z/` and `.local/v6/odds-pilot-2026-11-11T06-58-53-202Z/`. No API key appears in reports, saved request URLs or logs. Raw-response SHA-256:

| Response | SHA-256 |
| --- | --- |
| NBA h2h | `5a8e53b30bb4ef9d9e46339130d2a287f2c547b652755eb4abcafbbcd9bc2132` |
| NBL h2h | `a5148b6688c721529c7f085b0427c34f2ea7af9b49aa40a15bcf0baf875668c6` |
| WTA h2h | `cc319dd72e9ffbc3216e7b5c7838f3602f834edf3e41aee03fa50cc8118f52e4` |
| NBA player points | `ef25b5b0572aa3d7947ca4f899bb1f0f5519d4fa5a4eb3479f8077ad2abc0633` |

`scripts/check-v6-odds-pilot.mjs` is an explicitly invoked diagnostic, not a scheduled collector. It reserves credits before transport, locks its persistent local budget, rejects redirects, enforces endpoint/body/time limits and fails closed on unknown/nonfree quota. Do not rerun it this month. Its local budget is separate from both legacy sports quotas and the proposed hosted V6 quota table; no shared multi-host quota service is claimed.

## Autonomous collection gate

**NO-GO for unattended registration/settlement today.** `source-matching.ts` now implements pure exact mapping of retained h2h/selected player-stat responses with raw hashes, frozen terms and a separately hash-approved fixture/subject registry. It makes no requests and does not infer IDs. The actual live samples have not been assigned an approved canonical registry. Future odds/stat/result joins must establish exact fixture/player IDs, pre-event feature cutoffs, settlement rules and final evidence. Chronological independent model validation and a prospective source → registration → official result → grade pilot remain required before activation. Missing coverage rejects observations rather than fabricating a fallback.
