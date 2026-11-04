# Source-extraction recovery review

The Historical Import page recognizes the user-supplied source-extraction review staging shape and maps it through the existing historical validator. This is a **local preview-only adapter**, not an alternate persistence system or an approved import. No new dependency, migration, external API or financial transaction is required.

Upload the original recovery JSON through Historical Import's CSV/JSON source selector and choose validation. The adapter recognizes the staging envelope, retains its exact source text/SHA-256, maps explicit facts, and shows category counts, known-amount reconciliation, every global warning, original row references and complete per-row details. Download the complete Markdown or JSON review to inspect all warnings and transformations. Real recovered sources remain unverified even when previewed locally while Demo is selected; they are not relabelled synthetic or saved into Demo.

## Separation and missing facts

- Reported actual cash and bonus wagers map to actual **archive previews** with their original stake types, reported prices, stakes, returns and outcomes. Original individual leg prices/results are not inferred from combined odds or aggregate results. Exact timestamps stay null when missing or date-only.
- Identified settled and source-time unresolved papers remain separate paper categories. A historical pending status is not a claim about a current result. Unspecified hypothetical cash/bonus stake type remains null.
- Unconfirmed future cash/paper proposals have null kind, committed stake, payout and outcome. Source proposed amounts remain raw evidence; they are not exposure, placed bets or registered paper predictions. Ambiguous A/B strategy remains null.
- Unidentified historical papers remain aggregate metadata only. No placeholder predictions, prices, outcomes or timestamps are created to make a checkpoint match.
- Reported allocation and a lifetime cap are not deposits or a verified bookmaker balance. Promotional bonus credit is not cash funding and is not counted twice.

Do not expand names, invent event/market identities, assign original timestamps from report time, derive point probabilities from quoted ranges, or silently resolve source contradictions. Original source line references and supplied excerpt hashes remain claims until their actual source is checked.

## Reconciliation and duplicates

Known source amounts are calculated separately from registration readiness. An incomplete row can contribute a known reported stake/return to a source arithmetic check while still being wholly blocked from the actual ledger. Missing amounts produce unknown totals and explicit known/unknown subtotals, not fabricated zeroes. Cash stakes, bonus face value/cash winnings, paper hypothetical values and proposed future amounts are presented separately.

The adapter compares source checkpoint counts/amounts and explicit supplied calculation fields. Repeated selection identities are flagged within/across categories; original external IDs, source references and the existing fingerprint detector are retained. It never merges uncertain records. Without an authenticated existing-history snapshot, the review explicitly states that only within-file comparisons were performed. Missing events/dates weaken duplicate certainty.

## Approval and privacy

Every mapped row carries a `recovery_mapping_v1` review marker. The UI disables selection, correction and final saving for this staging format, and `prepareImportCommit` independently rejects those marked rows. Source booleans such as `import_approved`/`approved_to_import` are not authority to write. A future explicitly approved import step must be reviewed separately; the current feature deliberately contains no release or auto-commit path.

Private review artifacts live under Git-ignored `.local/` or a user-chosen local download location. Do not put real recovery files or detailed previews in tracked fixtures, screenshots or reports. Permanent tests contain only explicitly synthetic examples. The supplied original file is read without modification; source references, missing fields and transformations are fully retained in the local review.

Files: `src/lib/imports/recovery.ts` (mapping/validation/reconciliation), `recovery-report.ts` (complete read-only artifacts), `src/components/imports/recovery-review.tsx` (review panel), the existing import wizard (format dispatch and disabled commit), and recovery regression tests. The generic CSV/JSON/manual import flow is preserved.
