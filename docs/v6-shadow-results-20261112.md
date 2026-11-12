# Genuine NBA shadow results — 12 November 2026

**Strict verification: 1 fixture / 2 selections verified; 9 fixtures / 18 selections unresolved.** Both providers agree on all ten final scores, event/game IDs and teams. Nine Odds API start fields changed by 26–180 seconds after the freeze. The frozen rule requires original clocks, so those discrepancies remain unresolved. No automatic exception or retrospective position registration.

The requested check ran **17:38:55–17:41:05 Australia/Melbourne on 12 November**, after the 17:10 gate. It fetched one completed-score response (two credits) and ten exact-game BALLDONTLIE responses. No funding, paper P/L, financial write, migration or external message.

## Actual source-agreed results

| Home | Away | Final home–away | Source-reported winner | Odds start change | Frozen rule |
| --- | --- | --- | --- | ---: | --- |
| Toronto Raptors | Boston Celtics | 93–98 | Boston Celtics | +180 sec | Unresolved |
| New York Knicks | Cleveland Cavaliers | 107–115 | Cleveland Cavaliers | +180 sec | Unresolved |
| Indiana Pacers | Washington Wizards | 114–101 | Indiana Pacers | +26 sec | Unresolved |
| New Orleans Pelicans | Brooklyn Nets | 111–145 | Brooklyn Nets | +34 sec | Unresolved |
| Chicago Bulls | San Antonio Spurs | 119–124 | San Antonio Spurs | +36 sec | Unresolved |
| Memphis Grizzlies | Denver Nuggets | 118–123 | Denver Nuggets | 0 sec | **Verified** |
| Milwaukee Bucks | Los Angeles Lakers | 112–123 | Los Angeles Lakers | +120 sec | Unresolved |
| Utah Jazz | Orlando Magic | 108–123 | Orlando Magic | +120 sec | Unresolved |
| Houston Rockets | Golden State Warriors | 115–108 | Houston Rockets | +168 sec | Unresolved |
| Portland Trail Blazers | Oklahoma City Thunder | 118–108 | Portland Trail Blazers | +180 sec | Unresolved |

Both sources report completion; no winner was inferred from elapsed time. Exact Odds API and BDL IDs match the original proof, and BDL scheduled times are unchanged. The data establishes a changed field, not why it changed. For Toronto–Boston the frozen Odds API start is `00:10:00Z`, its final response says `00:13:00Z`, and BDL remains `00:00:00Z`, all on 12 November. Both scores are 93–98. Original quotes, inputs, probabilities, freeze time and earlier deadline remain unchanged.

## Frozen prediction evaluation

Probabilities come from the actual 11 November freeze, including its Elo second-pass baseline. No model is refit on results. The primary independent unit is one home-win prediction per fixture; paired sides are not twenty independent games. Each selection retains original probability/price/times, actual or source-reported outcome, residual, Brier, log loss and original exclusions.

Strict verified cohort: **one fixture**, insufficient for model promotion or calibration conclusions.

| Model | Brier | Log loss |
| --- | ---: | ---: |
| Frozen challenger | 0.1075868823 | 0.3975034768 |
| Frozen Elo-only | 0.1064275039 | 0.3948698642 |
| Frozen bookmaker de-vig | 0.1537106934 | 0.4976783514 |

Separate **provisional source-agreement** cohort: ten fixtures including nine unresolved clocks. This is **not verified performance** and cannot populate paper ROI or activation sample counts.

| Model | Provisional Brier | Provisional log loss |
| --- | ---: | ---: |
| Frozen challenger | 0.1875740042 | 0.5553625715 |
| Frozen Elo-only | 0.1868505827 | 0.5559565291 |
| Frozen bookmaker de-vig | 0.1739424020 | 0.5209852336 |

Elo is slightly better on provisional Brier, challenger slightly better on log loss, and the bookmaker baseline best on both. No edge follows from ten games. Calibration bins/counts are retained; log loss uses an explicit `1e-15` clip. The models share a rating/data family and are not independent corroborating forecasts.

Elo home-win calibration, **provisional ten-game source-agreement sample only**:

| Probability bin | Fixtures | Mean forecast | Source-reported home-win rate |
| --- | ---: | ---: | ---: |
| 0.1–0.2 | 1 | 0.1968 | 0 |
| 0.2–0.3 | 1 | 0.2343 | 0 |
| 0.3–0.4 | 3 | 0.3369 | 0 |
| 0.4–0.5 | 1 | 0.4116 | 1 |
| 0.6–0.7 | 3 | 0.6335 | 0.3333 |
| 0.7–0.8 | 1 | 0.7086 | 1 |

Empty bins are omitted. Strict calibration contains just one 0.3262 home-win forecast with outcome zero. Neither view supports a calibration claim or model promotion; paired away selections do not double these counts.

The historical benchmark is preserved: 4,774 held-out games, Elo Brier/log loss `0.2152337127/0.6189191514`, challenger `0.2156775888/0.6196628890`, win rates `0.2340920415/0.6606445973`. That remains retrospective chronological research without archived publication times. The challenger stays experimental.

## Why nothing was registered

Original exclusions overlap; do not sum these counts as distinct positions.

| Dimension | Original finding |
| --- | --- |
| Missing original price/clock/fixture/team identity | No first-pass exclusions across twenty observations |
| Matchup evidence | Injury/roster evidence unavailable for all twenty; alternative markets not collected |
| Model reliability | Twenty experimental forecasts; no approved activation manifest |
| Price/value | Fourteen fail minimum EV; fourteen fail sensitivity EV |
| Winning likelihood | Ten below the frozen 0.55 threshold |
| Authority | Twenty retain model-validation/standing-activation exclusion |
| New result issue | Eighteen selections have unresolved changed result clocks |

Winning after the event never overrides a pre-event exclusion. New activation applies only to new prospective positions.

## Retained evidence and replay

- Shadow ID `204dd518-19e2-4250-ad80-b6218430d838`; original hash unchanged: `98fc72f7a26e68dae7dc5dc55db30bad15561e4b690fb3fdc8285992496e31c8`.
- Original dataset SHA-256 `31aa630215a5583b90f87f92e6193883a778f6795a9068f2014118685c9283a0`, last modified 11 November; its 5,082 compatible games were not updated with these results.
- Result journal revision 1: `.local/v6/team-shadow-results/204dd518-19e2-4250-ad80-b6218430d838.json`, revision hash `6bcd8fa0f38e0694d94060386a142407b30d93e321e0163c44d67607873ef541`.
- Primary receipt `db768409-9352-4355-94bb-72351edbae0d`, raw SHA-256 `1f7ecb5463049c8d9b4af4a8bf8c9e85b44ea95a6b113d0453f780451bde4bda`.
- Evaluation `.local/v6/team-shadow-evaluations/204dd518-19e2-4250-ad80-b6218430d838/69ca94c8ebe70178a245e5cbb56366feafcbf4eb08a865f64c529887624ba2f5.json`.

Safe offline command, zero source requests:

```sh
node scripts/evaluate-v6-shadow.mjs --shadow-id 204dd518-19e2-4250-ad80-b6218430d838
```

Evaluation checks result-journal links, source hashes/IDs, frozen input hashes, complementary forecasts and pre-event timestamps. Unresolved selections retain `outcome=unresolved`, with source-reported outcomes separately labelled. Primary metrics exclude them; provisional scores cannot upgrade them. Corrupt journals, duplicate events and altered inputs reject. Only a new local analysis artifact is written.

Usage: **two new free odds credits, ten cumulative, 490 remaining**; ten free BDL exact-game reads. No new odds refresh, source investigation, paid endpoint or quota reset. Reproduce metrics offline rather than repeating live checks.

## Remaining decision

The real-result path passes one strict fixture and corroborates scores for all ten. This is **not a fully verified twenty-selection lifecycle**; there is no real registered-position settlement.

A separately reviewed, versioned identity policy could distinguish small same-ID metadata drift from postponement/rescheduling while preserving every original clock and deadline. No such exception is implemented or approved for this cohort. Until explicit resolution, eighteen selections stay unresolved. Controlled activation also requires a reviewed baseline and more verified prospective evidence; see [controlled readiness](v6-controlled-readiness.md).
