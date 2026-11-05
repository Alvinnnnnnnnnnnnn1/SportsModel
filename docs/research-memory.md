# Research memory and checkpoint review

EdgeLab is the permanent application record; a ChatGPT conversation receives only the brief you copy. No OpenAI API key, paid odds feed or automatic research is required. The existing personal account and deployed schema are retained. No new migration is required by these changes.

## Methodology authority

[Proposed methodology revision 1](experiment-methodology.proposed.md) is a reconstructed draft from the explicit owner requirements, not the full original conversation methodology. It now includes all four sports, Sportsbet context, A$500 lifetime cap/no reload, usual A$5 stakes, no loss chasing/forced wager, Tracks A/B/C, independent forecasts, uncertainty/disagreements, pre-registration, original odds, exact markets/legs, cash/bonus/paper separation, conditional CLV/calibration/Brier/ROI and retained passes/rejected candidates.

The prior short recovery rules are preserved; the draft adds the owner's more complete controls, not an automatic settings change. The full original methodology is still unavailable. Old attachment paths named in earlier IDE tabs are no longer available; the current owner request and both structured recovery files were read. No private ChatGPT conversation is accessed automatically.

On Research → Experiment context, **Versioned methodology and research days** shows the complete draft, source references, revision and hash. Including a methodology requires its explicit content-approval checkbox, then review and final append confirmation. Nothing is saved by opening, editing, downloading or generating a prompt. Approved revisions use the existing append-only historical context journal; older sources and rule text remain immutable. Revisions preserve known original text. A day-only update does not erase saved methodology.

Approval of reconstructed policy is separate from attesting that full original text is available. Until the latter is supplied and separately attested, `fullOriginalRulesAvailable` remains false. `ownerProvidedRules` refers to retained original text; proposed/approved reconstructed policy lives in `context.methodology`. A false original-completeness flag is not fixed by fabricating an original rulebook.

## Dates and progression

- Research creation time is UTC metadata; its planning date displays in Australia/Melbourne.
- Response `createdAt` is optional/nullable. Unknown original creation time is not replaced by import time.
- Event dates and event-start timestamps are separate. They are not inferred from research day or placement date.
- Source-confirmed completed days require explicit journal evidence/attestation or a separately confirmed completed response.
- Owner-reported day numbers remain reports. An active owner-reported Day 6 does not mean Day 6 is completed or silently advance to Day 7.
- The next proposed day respects confirmed completion and the active reported day; generating/copying a prompt never writes a session or marks it complete.

The suggested response ID is stable for a day/date. Saved response IDs, semantic content fingerprints and selection identities protect against replay, renamed row IDs and accidental reuse of proposals. New revisions/follow-ups require deliberate identifiers and source review; concurrent stale saves retain the existing revision guard. These are application guards over existing immutable metadata, not a new SQL session-uniqueness migration.

## Local historical evidence without importing records

Under Research → Research prompt, attach the primary recovery, optional paper supplement and optional owner-checkpoint review. A prepared `edgelab.continuity-evidence` source bundle can be selected as the primary file. Only selected files are read; all raw manifests are hashed and derived facts are rebuilt on reload rather than trusting editable summary fields.

**Validate and attach local context** changes only the current browser state. **Retain on this browser** is an explicit local-storage action, scoped to the existing authenticated account or isolated synthetic Demo. Real sources cannot be retained as synthetic Demo data. Switching accounts cannot load another account's retained key. Clearing an attachment never deletes a hosted record. Retention survives page reload; a complete experiment backup includes the separate local source bundle. Keep raw sources/backups private. Full database-backup restoration is still not implemented.

The handoff distinguishes saved database records (with their actual verification classification), unverified historical evidence, owner-reported aggregate checkpoints, outstanding source-time predictions, owner-confirmed pending placement claims and unregistered proposals/passes. Database presence verifies persistence, not independent bookmaker/result accuracy. Aggregate counts never generate individual rows. Existing archived matches remain included in source coverage but blocked from another import.

The concise prompt excludes the full JSON Schema and bounds settled/history excerpts when large. Full context, original documents and source evidence remain inspectable/exportable. Relevant unresolved and provisional items are prioritised; source omissions are disclosed. Downloadable JSON Schema/template and strict validation remain available under Response review.

## Owner-attested Day 6 checkpoint

The owner-supplied raw checkpoint, manual field mapping, existing canonical matches, source hashes, quote/range disagreements, financial blockers, four paper proposals and five cash passes are staged only in ignored `.local/day6-checkpoint-review/`. No raw checkpoint, player selections or complete private backup belongs in Git.

The two placement claims have known owner-reported cash stakes but unknown accepted prices, exact placement times and ticket IDs. Their historical snapshot `odds` and `placedAt` stay null. Reported pre-placement quotes live in immutable source metadata, never execution fields. Probability ranges remain unreconciled provenance; no midpoint forecast or EV is derived.

The prior source arithmetic is separate from live bookkeeping: A$30 cash stakes, A$25 cash returns, A$4.30 bonus cash winnings, modelled realised P/L −A$0.70. The new owner-reported pending exposure is A$10. The reported modelled allocation changes A$499.30 → A$489.30, not a deposit or realised loss. Neither allocation is a verified sportsbook balance. No funding transaction or actual-ledger row is proposed by this staging step.

One former paper proposal is linked to a new owner-confirmed actual placement, so it is not an independent paper position without distinct registration proof. Original paper/proposal prices are preserved alongside later comparison quotes. Source-time pending historical records are not assumed currently pending or automatically settled. Approximate discussion/retention windows do not establish exact forecast timestamps or pre-event registration.

The existing Historical Import recognises the generic `{records, sourceEvidence}` checkpoint review and displays its preview. Saving is locked by UI and command guard pending separate explicit approval. It is **ready for archive review, not financial registration or qualifying retrospective paper registration**. Later accepted-price/time evidence needs a separately reviewed receipt mapping/amendment; original snapshots cannot be overwritten to fill missing facts. No additional real record has been imported by this development task.

## Probability, EV and CLV integrity

Numerical probabilities require documented source, independent origin, method/version and timestamp. Explicit LLM/gut-feel labels in source, method or model version are blocked. Origin labels alone are not independent verification; uncertain evidence remains flagged. Missing probabilities are null. Odds require bookmaker/source/time provenance before EV is defensible. Implied probability is a price transformation, not an independent model forecast.

Ranges and model disagreement can be retained in checkpoint source metadata or research evidence text; response contract v1's point probability remains null until supported. No unsupported range field or new replacement research JSON contract was introduced. Candidates linked to an owner-confirmed placed wager cannot be added as an independent paper position merely by acknowledging a duplicate. Watch/pass evidence can remain archived without a paper registration.

`calculateClv` is a deterministic helper only. It requires matching known event/market/selection/line, attributable original accepted/registered and explicitly closing prices, valid decimals and exact quote times no later than event start. Its price definition is `(original odds / closing odds - 1) × 100`; implied-probability movement is separately returned. Reported execution quotes, comparison quotes, unmatched markets and unknown times return insufficient evidence. No live closing-price collection or persisted CLV analytics feature is claimed.

## Operational sequence

1. Keep the existing private session; no account setup or credentials are needed.
2. Review the proposed methodology before approving any journal append. Reported progress and completed-day evidence are separate optional fields.
3. Attach/retain the local source bundle if the remaining unapproved history is needed in the prompt. This is not a Supabase import.
4. Run Daily Research Handoff, copy its brief to a fresh conversation, and request JSON matching the existing response contract.
5. Validate returned fields, dates, odds, probabilities, identity and replay flags; manually review candidate decisions. Unknown/unverifiable facts remain null or lead to a pass.
6. Explicitly approve eligible paper forecasts. Actual bets require their separate manual confirmation; no wager is executed by EdgeLab.
7. Record genuinely observed event/leg results with source evidence, review analytics and export the complete experiment.

No methodology or Day 6 checkpoint is authoritative/saved until separately approved. Existing history, audits, RLS and the personal account remain unchanged.
