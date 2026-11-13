# Completed BDL continuation and separate candidate — 13 November 2026

**Approved acquisition completed; no hosted upload or model activation.** The fresh owner instruction `c53cca8e-c5d5-4467-b826-6e641eb92ca8` explicitly permits continuing despite valid date-only finals, with quarantine confined to historical acquisition. The original strict timestamp validator, live forecast availability rules and chronological fitting protocol are unchanged. The original stopped acquisition below is retained as an earlier checkpoint.

## Actual source execution

Fresh approval first recorded **2026-11-13T10:24:24.422Z /21:24:24.422 Melbourne**; the unavailable chat-message timestamp was not invented. New requests ran **10:24:35.139Z–10:31:47.887Z**, completing within eight minutes. No request began at page1 again. Original report SHA `e86b6a775fee9ece5c9677dd5c853a2ea220c297419a28b1215d11d16dd455e7` and all four prior IDs/raw hashes/receipt times/cursors were verified before transport. The first new request used cursor **857754**, page5 of2022. The original report remains byte-identical.

**35 additional BDL requests /39 total acquisition requests**, all HTTP200. Each season ended legitimately on page13, below the14-page cap. No extra request was spent checking final pagination or account tier. Additional-request minimum start spacing was **12,706ms**, within5/minute; minimum across all39 starts was12,678ms. Source quota receipts account for every reservation1–39 without gaps, resets or refunds. Shared UTC13November application allowance is **39/60 used,21 remaining**. The unused three requests under this acquisition's maximum were not repurposed.

The current [BDL documentation](https://docs.balldontlie.io/) still lists games on Free and5/minute. Actual responses demonstrate historical games access on the existing key for all three requested seasons. Billing tier remains owner-attested; no billing endpoint, key change, trial, upgrade or other endpoint was used. The Odds API consumed **zero additional credits**; its global retained journal remains10 reserved/used and490 remaining. No other sports data API was called.

| Season | Original eligible fixtures | Retained BDL records | Exact-time eligible | Date-only quarantine | Pages / completed |
| --- | ---: | ---: | ---: | ---: | --- |
|2022|1,230|1,230|1,219|11|13 / yes|
|2023|1,231|1,230|1,230|0|13 / yes|
|2024|1,231|1,230|1,230|0|13 / yes|
|Total|3,692|3,690|3,679|11|39 / yes|

All eleven missing timestamps occur on **the same provider calendar date,2022-12-02:11 of11 returned games for that date**. This is systematic date-block missingness, not a random sample. It represents0.8943% of the2022 regular-season records and0.2981% of this three-season acquisition. The quarantine stores native IDs857680–857690, genuine scores, source dates, `startsAt:null`, receipt IDs, raw hashes and actual retrieval times. No midnight/noon, timezone, borrowed provider time or historical availability was assigned. Other exclusions in the acquired pages:0. Neither quarantine nor source-count summaries become qualified forecasts.

## Reconciliation and remaining source limitations

The strict policy finds **3,678 exact home/away/season/UTC-date correspondences**,0 ambiguous correspondences,0 score disagreements and12 intraday timestamp disagreements (12–50minutes). Original and BDL times remain separate. The detailed report has14 unmatched original rows and1 unmatched exact-time BDL row; those counts are decomposed rather than presented as14 absent games:

1. **11 date-only records** each have a unique original team/score/near-calendar-date correspondence. These are labelled suggestions, not proof of an exact start or permission to fill the null field.
2. **One cross-date discrepancy:** Detroit–Portland,104–110. API-NBA ID12026 reports2023-03-08 00:00Z; BDL ID858332 reports2023-03-07 00:00Z. Same teams/score/season support a correspondence suggestion, but the24-hour source disagreement remains **REQUIRES_SOURCE_TIME_REVIEW**, without automatic merging or changing either time. The candidate uses the BDL-issued claim; its chronology is conditional on that unresolved source field.
3. **Two competition-coverage differences:** the original contains Lakers–Indiana123–109 (ID13779,10December2023 UTC) and Oklahoma City–Milwaukee81–97 (ID15347,18December2024 UTC). Neither fixture appears in the completed BDL regular-season chains. They are the two Cup championship fixtures previously identified; the [NBA format explainer](https://www.nba.com/news/2024-emirates-nba-cup-tracker) excludes the championship from regular-season statistics. No Cup endpoint was queried, no BDL Cup IDs/results were invented, and the original inclusion policy was not changed.

Thus3692 original entries are accounted for as3678 strict matches +11 date-only suggestions +1 date-disagreement suggestion +2 outside regular-season coverage. This accounting does not upgrade the suggestions into verified exact-time inputs. The full source/raw reports retain every field and limitation.

## Separate model reconstruction

The original5,082-game dataset and frozen artifact5bfe… remain unchanged. A **new BDL-only journal has5,103 latest source rows,5,069 eligible finals**:3,679 new eligible historical games plus the previously retained1,390. The11 quarantines and23 nonfinal source fixtures remain outside fitting. No original API-NBA coefficient, timestamp or missing game is copied into this candidate.

The unchanged protocol now fits successfully:2022 training (911 scored games after warmup),2023 tuning/refit (1,230),2024 calibration (1,230),2025 later evaluation (1,230),2026 monitoring (160). Model parameters were not tuned on the ten frozen fixtures. Selected margin parameters remainK20/home40/season retention0.75; feature lambda0.001. The new artifact has `productionApproved:false` and separately versioned source provenance. Exact-time coverage is **not** complete because the11 quarantines are excluded; successful fitting is not clearance of missingness or the cross-date disagreement.

On the **same1,230-game2025 evaluation cohort**, using the existing date-block methodology:

| Model | Original Brier | Reconstructed Brier | Reconstructed log loss | Reconstructed calibration ECE |
| --- | ---: | ---: | ---: | ---: |
|Elo-only|0.20946131|0.20943896|0.60752729|0.02439157|
|Margin Elo|0.20644506|0.20642811|0.60041801|0.03872590|
|Feature strength|0.20745151|0.20764727|0.60324560|0.03446016|
|Elo calibrated|0.20922849|0.20918785|0.60653561|0.02842193|
|Margin calibrated|0.20653048|0.20648885|0.60046270|0.03985379|
|Features calibrated|0.20736973|0.20750910|0.60289195|0.02953295|
|Form/rest challenger|0.20885698|0.20883723|0.60572364|0.02258017|
|Win-rate benchmark|0.24120154|0.24116197|0.67520180|0.05869606|

The candidate report retains all calibration bins, monitoring/per-season scores, tuning trials, uncertainty intervals and existing limitations. These are retrospective, previously inspected historical cohorts. No historical Sportsbet prices support a bookmaker-relative backtest or profit/edge claim. Better compatibility or a small score difference does not promote a model; the feature model worsened on this cohort.

Eight fresh credential-free/network-disabled Node processes checked portable inputs: two cutoff-aware runs, two independent artifact refits, two post-hoc diagnostics, original control, original diagnostic. Both refits regenerate the candidate hash exactly; both reconstructed diagnostics agree exactly. **All20 original-input frozen selection probabilities still reproduce exactly, max difference0.**

The reconstructed counterpart of every frozen selection is retained as **RETROSPECTIVE_RECONSTRUCTION_DIAGNOSTIC**, never a forecast registered before the result. Its maximum difference from the actual original selection is **0.0421707494 percentage points**. New retrieval clocks are preserved and those new results remain unavailable at the original forecast cutoffs. The older cutoff-aware diagnostic therefore still has the previously observed partial-history discrepancy; do not mix that with the new post-hoc comparison.

| Model2 comparison,10 fixtures | Maximum absolute reconstructed-vs-original difference (percentage points) |
| --- | ---: |
|Elo-only|0.05162506|
|Form/rest challenger|0.04423862|
|Win-rate|0.17451925|
|Margin Elo|0.04153217|
|Features|0.43922112|
|Elo calibrated|0.09351601|
|Margin calibrated|0.10219602|
|Features calibrated|0.36216141|

These are date-block **post-hoc input/model comparisons**, distinct from the original legacy selection formula above. They demonstrate non-equivalence, not new genuine prospective performance. All eight candidate model variants can execute offline from the BDL-only inputs/artifact. None has been installed into the live pilot or qualified for paper registration.

## Exact private package and gates

Continuation root: `.local/v6/history-continuation/2026-11-13T10-24-24.422Z/`. Its separate approval, immutable four-request parent hash, report, quota evidence and `verification.json` are retained. `latest-audit.json` points to `audit-2026-11-13T10-32-21.915Z/`. Candidate data/artifact/evaluation, all source receipts, quarantines and a BDL-only registry enter the private archive. Original-provider comparison outputs remain local review metadata outside that archive. All previous exports/reports remain intact.

| Binding | SHA-256 |
| --- | --- |
|New eligible canonical dataset|`b00cae6f0fafcd2eb1572f281353f448755179f784b3f54fb9524013da5afcac`|
|New candidate artifact|`44edd804bb3aa0802d80928aa61f764adc2f18ae86982a83cab55dc2659a87e7`|
|Snapshot manifest|`b23e4af9724ef6fac2e22b4c249625cfe88e056ce5514bbb2a22180ee4526ed1`|
|Retention inventory|`ac7b25bf5bc1b0a5acf8f05d6e075fb5d1f87b270ff68a31614e153c7fdcdf4c`|
|Retention review|`a7b331fceb83e414d3b1867f13b0db20bbadeeae86de9a14607841bcade6ac00`|
|Dependency manifest|`f3629798695eb03f2409544dee2ecf333b19c4fb3de068c870dde91a8ed11aaf`|
|Model readiness/comparison report|`915bede0ba2c8e64918b6372b6846052e382616c55df199fd312d4f00dae22ba`|

**233 references /194 distinct objects /21,790,899 object bytes**. Every included typed parent resolves to permitted BDL/Odds lineage or software definitions; the original mixed-provider artifact/identity/forecasts remain withheld. A local restore reproduces the candidate dataset hash. Existing offline inventory/provisioning validation passes while truthfully reporting `fullRunnerReady:false`. Private source terms remain reviewed for bounded research retention, not raw-feed redistribution. No upload approval is inferred.

A **reproducible candidate input archive** now exists. A complete package for the **currently approved cloud runner does not**: that runner/plan still pins artifact5bfe… and the old identity bridge. Its write gate correctly refuses this non-equivalent reconstruction; it was not relaxed to make the archive deployable. The candidate's missing date block, source-time disagreement and competition scope also need explicit methodological review. No stopped Supabase provisioning approval is requested at this stage.

The smallest next action is an offline owner/model review of artifact44edd…, the explicit exclusions and time discrepancy, followed by a versioned compatible candidate plan/identity/readiness review. Do not fetch more historical pages merely to spend the remaining allowance. Any subsequent storage-only approval must bind the exact compatible plan, dataset/artifact, snapshot/inventory/review/dependency/reproducibility hashes, intended project and stopped/no-credential/no-host-transfer state. New model use by the pilot, credentials, cloud transfer/activation and PAPER A/B/C remain separate approvals. No new SQL is proposed or applied here.

## Verification and preservation

**785/785 tests in71 files**, including23 recovery/diagnostic cases;70 core +77 historical +15 source SQL checks;13 fresh-process cloud simulation groups; eight genuine-input model subprocesses; TypeScript; lint; production build; local bundle/restore validation; original/continuation replay rejection and five private-file/secret/disabled-state checks passed. Source-quota receipts verify39 successful reservations without duplicates. SQL ownership/rollback and worker recovery/result/quota/stop checks remain local/synthetic; no fresh hosted normal-owner/two-user persistence or genuine cloud execution was attempted.

Mac LaunchAgent remains loaded at60-second intervals, exit0 between waiting ticks, with original config/receipt/artifact/schedule unchanged. First result job14November18:00 and first odds capture19:00 Melbourne remain intact. No hosted writes, source credentials, Actions activation, Vercel release, PAPER positions/settlements, funding or V5 changes occurred. No closed-browser delivery or actual new future-fixture forecast is claimed.

Repeat **offline** analysis only:

```sh
node scripts/audit-v6-bdl-history.mjs --acquisition-dir .local/v6/history-continuation/2026-11-13T10-24-24.422Z
node scripts/provision-v6-cloud-state.mjs --bundle <new-private-candidate-archive>
```

Re-auditing creates a new review version and bundle hashes. Both acquisition CLIs reject existing reports; claims survive failure. Do not delete those guards, replay spent pages or modify the old stopped report.

# Previous stopped BDL acquisition — 13 November 2026

**Stopped on incomplete source metadata. Cloud forecasting and stopped provisioning remain blocked.** Four approved Free games requests succeeded; page4 contains11 finals without an exact `datetime`. The collector stopped without retrying, skipping the page or requesting another season. No hosted write, Odds request, model promotion, schedule change, credential issuance, migration or paper activity occurred.

## Authority and actual acquisition

The owner's attached approval (`740099b9-15bb-4318-bfd3-0c01da6ce6e2`) permits only BDL `GET /v1/games`, seasons2022/2023/2024, `season_type=regular`,100 rows/page,14 pages/season,42 requests total,5/minute and at least12.6seconds apart. Existing60/day shared accounting and pilot priority remain enforced. The approval was first recorded locally at **2026-11-13T06:58:19.948Z**; no unavailable chat-message timestamp was invented or backdated. Execution was immediate and within the approved window.

Preflight checked the existing key's presence without revealing it, the shared journal/lock, unchanged original dataset/config/receipt, loaded Mac source-only agent and reviewed next jobs. The stored BDL day was12November with11 requests. The existing adapter's normal UTC-day rollover—not a manual reset—provided today's60 slots. No competing lock was present; the first pilot job remains14November18:00 Melbourne results, followed by19:00 research. No pilot schedule or source settings changed.

The [official BDL documentation](https://docs.balldontlie.io/) lists games on Free,5 requests/minute and100-row pagination. The four actual HTTP200 responses establish that **this existing key accesses some2022 historical games**; they do not establish complete2022 coverage or any2023/2024 coverage. Observed `x-ratelimit-limit:5` is consistent with the documented limit. Billing/account tier is not independently exposed by this endpoint; permanent-Free account status remains the owner's attestation. No trial, subscription or entitlement change was made.

- Actual request starts:06:58:35.506Z,06:58:48.192Z,06:59:00.870Z,06:59:13.553Z. Minimum measured spacing **12,678ms**; four requests in the minute, no retry.
- Last retrieval: **06:59:13.820Z /17:59:13.820 Australia/Melbourne**. All raw response bytes, IDs, scores, cursor metadata and actual retrieval clocks are retained privately.
- Shared UTC13November BDL journal: **4 consumed /56 remaining local daily slots**. This is the application's daily ceiling, not a provider-reported daily allowance. No reservations were refunded after the coverage failure.
- The Odds API: **0 requests/credits this task**; retained global journal remains10 reserved/used,490 remaining.

## Coverage and exact reconciliation

| Season | Original eligible API-NBA games | New BDL rows retained | New exact-time eligible games | Complete season verified |
| --- | ---: | ---: | ---: | --- |
|2022|1,230|400|389|No; stopped at page4|
|2023|1,231|0|0|Not requested|
|2024|1,231|0|0|Not requested|

The original5,082-game journal is unchanged. The separate BDL-only reconstruction contains **1,813 latest source rows and1,779 eligible finals**: the previous1,390 eligible games plus389 newly acquired ones. The11 date-only finals and the prior23 nonfinal fixtures remain source evidence rather than qualifying training inputs. The collector admitted only the first300 rows before stopping; the offline audit separately retains all400 rows, including the failed page with nullable starts. Neither path updates the original journal.

Explicit matching uses season, exact home/away team codes and the UTC event date when present. There are **389 exact fixture matches,0 ambiguous matches,0 additional exact-time fixtures,0 score disagreements and2 original start-time disagreements**. The3,303 unmatched original entries include the11 source games whose BDL exact starts are null; they are not all evidence of absent BDL fixtures. No date-only record is assigned midnight or an API-NBA timestamp.

| Fixture | Original source ID/start UTC | BDL ID/start UTC | Difference |
| --- | --- | --- | --- |
|Denver–LA Lakers|11113;2022-10-27 02:15|857411;2022-10-27 02:00|−15minutes|
|Phoenix–New Orleans|11128;2022-10-29 02:15|857424;2022-10-29 02:00|−15minutes|

The11 missing exact starts are IDs **857680–857690**, each reporting `date:2022-12-02`, `datetime:null`, final status and decisive scores. The full source-backed identities/scores are in the private missing-start report. Their calendar dates remain separate source fields; they do not prove UTC start times. No duplicate IDs or correction conflicts appeared in these four pages; no claim is made about unfetched pages.

The3692-versus3690 question remains **partly unresolved**, because2023/2024 were not fetched. The original source includes Lakers–Indiana,123–109,10December2023 UTC (ID13779), and Oklahoma City–Milwaukee,81–97,18December2024 UTC (ID15347), consistent with the two NBA Cup finals suspected earlier. Their exclusion from a full BDL regular-season feed has **not** been verified here. Original season classifications and scores remain unchanged; `season_type=regular` is not assumed to reproduce the original inclusion policy.

## Model reconstruction and statistical limits

The existing chronological protocol was attempted unchanged on the partial BDL-only history. It rejects fitting with **“Insufficient chronological tuning data”**:2023 tuning/refit and2024 calibration coverage are missing. The failed attempt is retained. **No new fitted artifact exists**, and no valid new Brier/log-loss/calibration comparison is available. Existing original chronological reports remain intact; no smaller sample was substituted for the required protocol and no tuning used the ten prospective fixtures.

Three fresh offline Node processes used portable temporary input files, no environment file, no API credentials and a forbidden network transport. Two partial-history runs agree exactly. A separate original-input control reproduces all20 frozen selection probabilities **exactly (maximum difference0)**. Each original selection also has an explicit cutoff-aware comparison against the partial BDL input:

- Maximum absolute difference **2.399465198 percentage points**, mean **0.950230961 pp**, for the original frozen form/rest challenger selections.
- These partial-history values still use only the previously retained1,390 eligible games at the old cutoff. All newly fetched2022 rows have later real retrieval times and are excluded there. These are diagnostic replays, **not new prospective forecasts or evidence that the original model was reconstructed**.
- Standalone Elo/challenger code can execute partial diagnostics; this does not make its incomplete rating state a valid full cloud replacement. All eight existing Model2 entry points still require the withheld pinned fitted artifact. There is no independently reconstructed complete cloud model to activate.

Protected semantic artifact hash remains `5bfe98cb8fec70db371dd61b037e75f927de3348da524a9bca19790661e0a6b4`. Its pretty-printed file hash is a different, unchanged byte hash. Original dataset byte hash remains `31aa630215a5583b90f87f92e6193883a778f6795a9068f2014118685c9283a0`. The original20 frozen quotes/forecasts/events/registration clocks are unchanged; none became paper positions.

## Versioned private partial package

Private root: `.local/v6/history-recovery/2026-11-13T06-58-19.948Z/`.

Latest review: `audit-2026-11-13T07-11-22.043Z/`; `latest-audit.json` points to it. Detailed acquisition, failed model attempt, missing starts, per-fixture reconciliation, three subprocess outputs and cutoff comparisons are retained. Earlier audit outputs remain preserved. Original full and prior partial transfer bundles are untouched.

| Binding | SHA-256 |
| --- | --- |
|New **partial** canonical dataset|`0ed81e860c8359130368c99f257e64b80cc325d98547ccd681ba04be201f1aba`|
|New fitted artifact|**Unavailable; fitting rejected**|
|Snapshot manifest|`3b4afedd2b4fe355b4fd928db9604bdc02dba8ef582d768121d20089f195ff98`|
|Retention inventory|`9870d04fcd75165df07732d1d0357481c7b971282c81c3dd5d295064cb5499b4`|
|Retention review|`104386f543f7685be4bf20ee4f20a82789c06039ae18c918b96b8c994aca0d4e`|
|Dependency manifest|`171d3e6d9267a9f9991a47ceb7b8fa2438da909f00488a50513ed3a3152e83cb`|
|Reproducibility/failed-fit report|`c333246d0f4243eeb264952ff41d11a3a548d0072206cb29ec9e42d96ec4cd6c`|

The package has **125 references,121 distinct objects,9,149,396 object bytes**. The typed dependency graph verifies permitted BDL/Odds receipt parents for this **partial archive**, not complete runner readiness. Inventory/hash checks, a fresh local restore and the existing offline provisioning validator pass with `fullRunnerReady:false`. The existing write gate rejects incomplete readiness before any owner session or HTTP operation. No package was uploaded. A9.15MB object count is not a hosted storage-size or billing estimate.

Retention review remains bounded to private research under [BDL terms](https://www.balldontlie.io/terms.html) and [The Odds API terms](https://the-odds-api.com/terms-and-conditions.html). Raw redistribution is not approved, original mixed API-NBA lineage remains withheld, and derived artifacts do not automatically gain independent rights.

## Verification

New tests cover approved request scope, nullable timestamps, receipt/hash/query tampering, incomplete finals, duplicate IDs, looping/ambiguous cursors, excessive page size, ambiguous identity and score/start discrepancies. **775/775 tests in71 files passed** with embedded PostgreSQL enabled, including13 new recovery tests. Also passed:70 core +77 historical +15 source-schema SQL checks;13 fresh-process cloud simulation groups; three genuine-history replay subprocesses; TypeScript; lint; production build; offline bundle validation; local restored-input verification; and5 private-file/secret/disabled-state safety groups. SQL, owner-isolation, atomicity and scheduler/result/quota/emergency-stop checks are local/synthetic regressions, not new hosted acceptance or genuine cloud execution.

No fresh hosted positive persistence/two-user acceptance was attempted; that remains a separate approval and normal-session task. No UI changed or Vercel deployment occurred. No new genuine prospective model evaluation, registration or settlement is claimed. Mac LaunchAgent, original plan/model/configuration and cloud/PAPER disabled state remain preserved.

Repeat the **offline** audit only:

```sh
node scripts/audit-v6-bdl-history.mjs --acquisition-dir .local/v6/history-recovery/2026-11-13T06-58-19.948Z
node scripts/provision-v6-cloud-state.mjs --bundle <private-partial-bundle>
```

The acquisition CLI rejects its existing report; do not delete that guard or blindly rerun it. A new audit creates a new review/hash version; it never resumes acquisition or authorizes upload.

## Next decision

**Do not request stopped-only Supabase provisioning for this incomplete package.** The complete, reproducible cloud forecasting target has not been met.

A fresh bounded source decision is required before continuing after this coverage stop. A possible reviewed continuation would retain `datetime:null` records as quarantined date-only evidence, follow the retained next cursor857754, and acquire the remaining pages within the original total allowance (**at most38 further requests**, still14 per season including the four already consumed). It must explicitly permit continuing source acquisition despite missing exact start metadata; no such continuation has been executed. Provider dates must not become fabricated UTC starts, existing model admission must remain strict, and pilot/shared quotas must be rechecked. New sources to repair timestamps, or a separately versioned calendar-date model protocol, would need their own provenance/method review rather than silent changes to this pilot.

Even after complete data recovery, new artifact/identity hashes must be reviewed against the unchanged original pinned plan. Storage approval, credential issuance, single-host transfer and any model activation remain separate gates. The Mac stays the sole approved source-only worker; cloud Actions, Vercel releases, hosted SQL, capabilities and PAPER A/B/C remain untouched.
