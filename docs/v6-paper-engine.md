# V6 isolated paper engine and worker

The [team-moneyline milestone](v6-team-moneyline-pilot.md) adds a reproducible `nba_team_elo` method, exact current-team/fixture bridge, earlier-of-source-start gate, two-pass research checks and an independent-result grader. Twenty genuine future observations are frozen in a separate shadow store; all remain excluded. The core A$5,000/A$50 uncapped accounting, owner/cohort isolation, append-only registration and commit latch are unchanged. No production model/policy or hosted SQL is activated.

Implementation checkpoint: **LOCAL_TEST_ONLY**, default disabled. This is a distinct prospective cohort, separate from Demo and legacy V5 financial/paper history. No standing policy/model has been activated and no V6 prospective position has been registered. Historical activation is complete; do not repeat it.

The later [genuine-source pilot](v6-prospective-pilot.md) adds persistent blocked identifier mappings, retained raw/fetch/quota evidence, an experimental shrunk NBA points distribution/chronological benchmark, exact final-grading adapter, worker preflight exclusions and emergency-stop latch/health receipts. It found **no eligible position**: free current NBA statistics are denied, odds-player IDs are missing and the historical model underperformed its benchmark. The pilot never promoted an old quote or retrospective calculation into a prospective registration.

## Frozen policy

`src/lib/v6/policy.ts` implements `v6-uncapped-paper-1`: AUD reference **500,000 cents**, fixed hypothetical stake **5,000 cents**, uncapped notional participation. There is no count, daily exposure, sport count or available-balance admission gate. The reference is not funding. Negative availability and virtual excess exposure are reported, never treated as credit or grounds to suppress qualifying entries.

Qualification currently proposes a 300-second maximum source age, 2% minimum model EV and no exploratory entries. These are explicit implementation thresholds requiring exact policy-hash activation, not a claim that approved V5 methodology changed. Every supplied observation is retained in the run journal, including failures; there is no top-N filter. Statistical experiment design and correlation/sample reporting still need further validation before live activation.

Registration freezes exact sport/event/subject/statistic/operator/line/period/overtime/terms, bookmaker, original price, source hash and times, independent forecast/version and input snapshot. A selection can register once per exact market/bookmaker/policy (`pre_event_once`); repricing does not create another entry. A genuinely different threshold remains distinct. Provider source permissions, fresh quotes, pre-event commit time, activated model registry and reproducible numerical inputs are mandatory.

## Statistics and accounting

Experimental baselines implement Poisson count probabilities from pre-event minutes/rate and surface Elo for tennis moneyline. The formulas are implemented; current complete features, empirical calibration, out-of-sample model validation and a real activated model are **not**. An LLM-supplied probability or `validated` string does not activate a model. The worker requires a separate registry model/version/manifest identity and recalculates supplied probabilities from frozen inputs.

Integer-line over/under push mass is modeled separately; `>=3` and `>3.5` are different markets. EV is `p(win) × (odds−1) − p(loss)`, with pushes returning stake. Numerical count outcomes must be nonnegative integers. Official winner identity is required for decisive moneyline grades. DNP, retirement, postponement and ambiguous terms remain unresolved until a supported exact rule is implemented. No SGM independence assumption or theoretical parlay price is used.

The new NBA points-only DNP-void adapter is an exception for positively evidenced nonparticipation under a frozen `nba-points-ot-dnp-void-v1:<rules hash>`; zero/missing minutes alone do not establish DNP. Other exceptions remain unresolved. Source-issued result time may be null only alongside actual final observation time and hashed raw evidence. Retrieval is never renamed as publication. Matching result bytes with new fetch receipts do not generate new settlements. This was tested with synthetic local fixtures; no real registered position has been graded.

Money uses integer cents with BigInt half-up payout rounding; SQL uses NUMERIC. Accounting uses the latest append-only grade revision, so corrections and retries do not double P/L. Pending amounts, notional turnover, decisive settled ROI, reference equity, virtual excess exposure, Brier/log loss and unique-fixture counts are separate. Probability scores use decisive outcomes conditional on no push; pushes/voids are not false losses. De-vig baselines require complete mutually exclusive market prices. Full calibration/CLV/benchmark panels, drawdown and correlation-adjusted uncertainty reporting remain unfinished and must not be fabricated.

## Durable local worker

`localV6Repository` stores owner/cohort-isolated files beneath ignored `.local/v6/state`. Mode-600 atomic replacement, fsync, a live-process lock, dead-process recovery, revision checks and append-only source/run/grade validation support restart and retry. This is local single-host storage, not hosted RLS or tamper-proof storage against a filesystem owner. It has no legacy repository, Supabase token, funding, bookmaker, LLM or messaging capability.

`runV6Worker` has read-only collection/result and independent-model ports. Network/model work precedes its short commit lock; eligibility is rechecked against the commit clock. Repeated run IDs and position/grade identities are idempotent. Any late invalid grade aborts the entire local transaction, including new positions/run journal. A malformed source causes failure, not an unverified partial save. Later production orchestration still needs durable failure/status logs and retry/backoff integration.

The CLI is deliberately disabled with no model or connected final-result adapter. This safe smoke test makes no provider or database request:

```bash
node scripts/run-v6-worker.mjs --config ops/v6-worker.config.example.json --once
```

The CLI can screen a normalized source inbox under `.local/v6`; it currently cannot qualify live positions without an activated model. `source-matching.ts` is the pure upstream decoder, not yet wired to automatic collection. Raw files, registry and trusted worker config must remain local/private. No key belongs in a source URL or browser variable.

## Scheduling, deployment and messaging

`ops/com.edgelab.v6-paper.plist.example` is an **uninstalled** launchd template for a local once-per-day worker. Placeholders must be resolved, host calendar timezone verified as Melbourne, free quotas shared and all source/model/result gates passed before enabling. `TZ` alone does not change launchd's host calendar timezone. A sleeping/offline Mac cannot provide continuous availability. No schedule is currently loaded and no hosted worker/UI deployment occurred.

The proposed hosted schema is `supabase/proposals/202611110001_v6_paper.sql`, intentionally outside `migrations`. It is additive, contains ten isolated V6 tables and normal-owner RLS/invoker operations. Its non-login worker role has no V5 grants and cannot activate policy/models. Hosted JWT issuance, role membership and the Supabase adapter are not configured. See [database.md](database.md). **Explicit owner approval is required before any deployment**; this implementation did not push SQL.

Future Hermes/iMessage delivery is deferred. The proposed outbox permits `in_app` only; no external message, identity permission, bot or account access has been installed/used. Delivery credentials/recipient scope, deployment environment and notification permission need a separate concrete review. There is no background push claim.
