# BDL historical recovery — 13 November 2026

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
