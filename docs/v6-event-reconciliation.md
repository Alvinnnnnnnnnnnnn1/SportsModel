# NBA event reconciliation — 12 November 2026

**Ten genuine fixtures / twenty observational selections now have verified outcomes under `nba-event-reconciliation-1`.** One fixture passed the original strict rule; nine are newly verified by separate identity/result/quote checks. Zero remain ambiguous in this retained sample. The original strict journal still says one verified/nine unresolved. Neither that journal nor any frozen quote, forecast, event clock, original exclusion or position count was rewritten. No paper P/L or retrospective registration.

## Investigation and cause

All ten frozen Odds API event IDs are identical to their final-score IDs. All ten retained BALLDONTLIE game IDs, native home/away team IDs, NBA league and season 2026 match the pre-event fixture receipts and frozen registry. Both providers report completion and agree on every final score. BALLDONTLIE UTC `datetime` values did not change. Odds API `commence_time` changed for nine games:

| Home–away | Final | Original → result Odds API UTC time, 12 November | Delta |
| --- | --- | --- | ---: |
| Toronto–Boston | 93–98 | 00:10:00 → 00:13:00 | 180 sec |
| New York–Cleveland | 107–115 | 00:10:00 → 00:13:00 | 180 sec |
| Indiana–Washington | 114–101 | 00:10:00 → 00:10:26 | 26 sec |
| New Orleans–Brooklyn | 111–145 | 01:10:00 → 01:10:34 | 34 sec |
| Chicago–San Antonio | 119–124 | 01:10:00 → 01:10:36 | 36 sec |
| Memphis–Denver | 118–123 | 01:10:00 → 01:10:00 | 0 sec |
| Milwaukee–Lakers | 112–123 | 01:10:00 → 01:12:00 | 120 sec |
| Utah–Orlando | 108–123 | 02:10:00 → 02:12:00 | 120 sec |
| Houston–Golden State | 115–108 | 02:40:00 → 02:42:48 | 168 sec |
| Portland–Oklahoma City | 118–108 | 03:10:00 → 03:13:00 | 180 sec |

The application-level cause was using exact equality of a revised start field as an event-identity requirement. The retained data proves **same-ID provider metadata revisions**. Seconds appearing in several final timestamps are consistent with more precise timing, but the receipts do not establish rounding rules, a reschedule, or actual tip-off. We do not relabel the final field as actual start. All times already carry UTC offsets; this is not an inferred timezone conversion error. BDL's separate date field can differ from its UTC datetime; the policy compares UTC instants, not an unqualified calendar label.

The [Odds API V4 guide, scores section](https://the-odds-api.com/liveapi/guides/v4/#get-scores) explicitly states that scores and odds share game IDs. Its examples include second-level commence times; they do not guarantee clock immutability or define these revisions as actual tip-off. [BDL game documentation](https://nba.balldontlie.io/#games) provides native IDs, season, datetime, lifecycle and scores. These public documentation reads used no sports API credits. No new provider result/odds call was made for reconciliation.

## Versioned policy and separate decisions

`src/lib/v6/team-reconciliation.ts` defines policy version 1, SHA-256 **`d78648e0e114c685861aa16043065e5231996e7039813e97231ee56843224b2a`**.

1. **Identity:** exact persistent original/final IDs from both providers; exact original odds teams and BDL native home/away IDs through the frozen hashed registry; NBA scope and unchanged sourced season; unique original fixture bridge; compatible UTC date. Maximum original-to-final drift is **300 seconds per provider**, never a fuzzy-name join. Original cross-provider bridge remains at its separately frozen fifteen-minute tolerance. Postponed/canceled/delayed/ambiguous lifecycle, close competing doubleheaders, changed teams/season, duplicate results or larger shifts reject or remain unresolved.
2. **Quote eligibility:** validate each selection's original raw Sportsbet h2h price and timestamp, capture, freeze and forecast times. Maximum quote age remains 300 seconds. Use the earliest original odds/statistics deadline and available revised times, with a **60-second safety buffer**. A later final time can never move the deadline forward. Actual tip-off remains null where unknown. This is conservative available evidence, not proof of an observed tip-off. All twenty original quotes pass with hours of margin. The new Elo-only registration path enforces the same buffer in TypeScript and proposed SQL.
3. **Result:** both exact events must be final, scores decisive and identical, source hashes valid and source/retrieval clocks non-future. Winner follows the exact canonical home/away identity.
4. **Paper settlement:** an observation's decision is always ineligible. Only an existing immutable prospective paper position with its original exact market, quote/forecast/proof and supported settlement terms can use the separate reconciled grading adapter. That adapter does not create positions.

Five minutes is a conservative **identity-review bound**, not a provider SLA or scientifically estimated timing error. The observed maximum is three minutes; the tighter independent ID/team/season/final checks do the identification. The bound is not applied to quote freshness, pre-event deadlines or price qualification. Same-date and postponed-game restrictions intentionally leave some otherwise plausible cases unresolved. Any wider policy must be versioned and reviewed prospectively.

## Reproducible evidence and metrics

Offline, zero HTTP:

```sh
node scripts/reconcile-v6-shadow.mjs --shadow-id 204dd518-19e2-4250-ad80-b6218430d838
```

Each fixture receives a content-addressed immutable decision under `.local/v6/team-shadow-reconciliations/<shadow>/<policy hash>/<event hash>/`. Decisions link all four original/final source receipts, source hashes, original strict revision hash, per-side quote checks, clocks, season provenance and the new result. Identical replay preserves the same decision/report hashes. Originals remain in their existing stores.

Latest evaluation: `.local/v6/team-shadow-reconciliations/204dd518-19e2-4250-ad80-b6218430d838/evaluations/db4c6cb8844803a9f249849f279f7033c7f072e4479a24166497a32253eb1cca.json`.

| Model | Verified observational fixtures | Brier | Log loss |
| --- | ---: | ---: | ---: |
| Frozen Elo second-pass baseline | 10 | 0.1868505827 | 0.5559565291 |
| Frozen challenger | 10 | 0.1875740042 | 0.5553625715 |
| Original two-way de-vig bookmaker baseline | 10 | 0.1739424020 | 0.5209852336 |

One home-win forecast per fixture is the primary unit; the twenty complementary selections are not independent games. Each retains its original probability, reported outcome, residual/Brier/log loss and original strict status. All ten games are on **one slate/date**. Calibration bins are unchanged from the earlier provisional calculations; their classification is now reconciled observational, not financial performance. The bookmaker baseline scores better on both metrics here. No reliable calibration, edge or model promotion follows. The prior [strict-only report](v6-shadow-results-20261112.md) is preserved as an earlier policy checkpoint.

Protected hashes: original shadow `98fc72f7a26e68dae7dc5dc55db30bad15561e4b690fb3fdc8285992496e31c8`; original 5,082-game dataset `31aa630215a5583b90f87f92e6193883a778f6795a9068f2014118685c9283a0`; original result revision `6bcd8fa0f38e0694d94060386a142407b30d93e321e0163c44d67607873ef541`. Source use remains **ten cumulative odds credits /490 remaining**, ten BDL result reads from the earlier check. No reset, new source investigation, financial write or hosted change.

The real observational result path is demonstrated for all ten fixtures. A genuine future registered-position-to-result-to-P/L lifecycle remains unproven and disabled. See [model review](v6-model-readiness.md) and [the exact deployment package](v6-deployment-approval-package.md).
