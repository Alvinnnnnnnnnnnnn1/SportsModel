# Proposed additional source use — retained BDL NBA history

**Not approved or executed. No API request has been made under this proposal.** This is a bounded source-use request to resolve the identified missing2022–2024 game outcomes; it is not cloud provisioning or a worker/model activation request.

Proposed provider: existing **BALLDONTLIE permanent Free** account, `GET https://api.balldontlie.io/v1/games` only. Parameters: `seasons[]=2022`, then2023 and2024; `season_type=regular`, `per_page=100`, and only the exact cursor returned by the preceding retained page. No stats, injuries, odds, player props, trials, account creation or payment details. The [official tier table](https://docs.balldontlie.io/#account-tiers) lists games as Free and5 requests/minute; [pagination documentation](https://docs.balldontlie.io/#pagination) caps page size at100. The provider's current server response must still establish actual coverage; do not assume older seasons are accessible because an endpoint is documented.

## Bounds for a later explicit owner decision

- Maximum14 pages per season /42 additional requests total; stop on a missing/looping cursor, scope mismatch, denial, rate limit, incomplete season or error. No implicit retry, upgrade or bypass. Expected39 pages is only an estimate, not verified coverage.
- Use the existing shared BDL journal/lock, at most5 requests/minute with at least12.6seconds between calls, and the existing60/day application ceiling. Daily pilot work takes priority. Defer rather than resetting counters or borrowing another key. No change to The Odds API allowance:0 additional Odds credits requested here.
- Execute only within24hours of a fresh explicit approval, after checking the actual journal, current terms/free account, source scope and no conflicting operation. Do not change or stop the Mac LaunchAgent or its schedule.
- Retain raw responses, true retrieval times, pagination receipts and any failures privately. Write a separate versioned reconstruction directory, preserving the original5,082-game journal, registry, artifacts, forecasts and reports.
- No hosted upload, owner session, cloud credential, GitHub Actions, host transfer, Vercel release, PAPER A/B/C, funding or betting record is included.

## Acceptance after any approved acquisition

Compare exact identities, final scores, season/regular-season scope, duplicate/correction histories and per-date game coverage. A different competition definition, missing NBA Cup fixture or changed start field must remain a discrepancy. Never massage data to match the original model. Independently fetched historical results retain their new retrieval timestamps; they cannot become available before the original forecast cutoff or establish new pre-registration proof.

Refit/replay only in an offline, versioned diagnostic. Compare coefficients, selected parameters, calibration and every probability numerically against the frozen original. New provider/receipt metadata necessarily changes input hashes; do not overwrite the frozen artifact or claim hash equivalence. If a new artifact is needed, the current source pilot's pinned original artifact/plan does not authorise using it: a separately reviewed version and approval are required. Numeric agreement alone is not model promotion or a source-rights grant.

An alternative is owner-provided clarification establishing the needed private cloud retention rights for the original API-Sports lineage. Its [terms](https://api-sports.io/terms) permit app/project use but reserve relevant third-party rights. Current exclusion is the existing conservative retention policy, not a claim that every private cloud use is prohibited. No provider/rights-holder message has been sent.
