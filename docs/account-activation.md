# Private-account historical activation

This workflow uses the existing normal-user Auth session, historical repository, immutable source tables and final archive confirmation. No privileged key, new account, migration, API request, deposit or financial registration is needed. Demo is never copied or reset.

## Durable source preparation

Use Research → **Export complete experiment** in the intended PRIVATE workspace before changes. Settings → Export JSON is not the complete backup. Preserve the original export.

```sh
node scripts/prepare-reconciliation-import.mjs /absolute/source.md /absolute/private-backup.json .local/private-import-directory
```

This offline tool uses the project's existing Vite test runtime. It validates the private backup, checks all five reconciliation tables, hashes and preserves the original Markdown, maps 12 actual claims and 34 paper selections/proposals, and rehearses import/replay in memory. Artifacts stay under ignored `.local/` with restrictive file permissions. It neither reads credentials nor contacts Supabase. Existing artifacts are not overwritten; choose a new output directory for a new source/backup or preparation revision.

The durable `canonical-reconciliation-source.json` contains the versioned source envelope and exact source text, not a database snapshot to overwrite. Keep it even if authentication expires. Uploading it recomputes matches against the currently loaded account, rather than trusting the older backup's counts. Unknown execution odds, timestamps, receipts, probabilities, stakes and payouts remain null. Planned amounts and source-reported sporting results stay in raw provenance. The original research-price correction and displayed app price both remain available in the retained Markdown. Ambiguous multis do not receive invented fixture identities or leg prices.

## Review and save

1. Open `/imports` in the existing signed-in PRIVATE tab. Wait for the current archive to load. Do not switch accounts or reset Demo.
2. Upload `canonical-reconciliation-source.json` in **Import historical evidence**. The dedicated actual-claims-only upload is for a different envelope format.
3. Keep **Unverified**. Review all rows and exact matches. Exact links are excluded from selection; uncertain overlaps need individual review. Matching uses original UUIDs and exact candidate identities, never a free-text substring or a similar player name.
4. Choose **Select all eligible rows** only after checking the proposed records; acknowledge missing/unverified information. Review archive import → **Confirm archive import** is the final persistence action.
5. A successful archive save does not create an actual wager, paper registration, result, notification or funding transaction. Incomplete actual evidence appears separately in Overview/Ledger's historical claims summary. All archived paper sources appear in Paper Tracking; unregistered proposals remain labelled and outside qualifying forecast metrics. The known settled-source subtotal is distinguished from incomplete overall accounting.
6. Reload, inspect Overview/Ledger/Paper Tracking, and download Research → **Export complete experiment** again. Validate the same source once more without saving: all represented items must be excluded as duplicates/links.

An expired session or revision conflict does not authorize retrying blindly. Keep the source file, reopen the same account, wait for both workspaces to load and validate again. Existing saved rows are linked. A failed save is not reported as success. App and historical revisions remain independent.

## Read-back verification

```sh
node scripts/verify-reconciliation-export.mjs .local/private-import-directory /absolute/fresh-continuity-export.json
```

This read-only tool checks that all 46 source items are represented exactly once, preserves the prior actual workspace, settings, transactions, paper states, history and audits, verifies nullable financial facts and exclusions, and checks complete duplicate replay. It retains a private copy and sanitized summary. Evidence is an owner-downloaded private client export after reported refresh; it is not a privileged hosted query, an independent ticket verification or a fresh two-account hosted RLS test.

## Current validation and limits

The 6 November source and private backup were parsed on 11 November. The backup contains one actual wager, zero core paper predictions, zero financial transactions, 12 archive records and three archive-backed paper tracking states. Twelve source items match those existing positions; 34 missing items consist of three actual-source claims and 31 paper sources. An archive-only save would result in 46 archive records (including the existing context journal), one core actual and three tracked paper states. The owner completed the normal authenticated archive approval and reload on 11 November. The fresh private export at 06:21:45 UTC confirms these exact after-counts: one new batch, 34 new archive records, 12 existing links, no new core actual, no financial transaction and no new paper registration. All previous immutable records, batches and audit entries are retained. One notification was read with retained audits on 7 November, before this import; its original message and source are unchanged.

Local validation: 595 tests pass with the optional PostgreSQL runtime enabled, including the new source adapter and SQL integration. Six isolated browser checks pass with intercepted Auth/RPC transport, covering final approval, preservation, refresh/replay and all 34 paper sources. Core SQL 70/history SQL 77 checks are tracked in the verification log. Browser fixtures never reach hosted storage or personal browser profiles.

The three committed migrations still require exact core placement timestamps and accepted prices and do not support the newer optional core lifecycle/correction fields. Incomplete claims use the existing historical archive; this P0 does not require weakening those checks or deploying a migration. Do not use nullable core entries or hosted correction/supersession features as though their newer TypeScript fields were deployed SQL features. The ordinary manual-entry form now omits the optional local-only metadata when preparing a known private placement, retaining confirmation/audit timestamps in the existing supported fields; an unknown private placement time is rejected and directed to Historical Import. This compatibility fix does not enable lifecycle corrections or financially register incomplete history. Daily Cycle feedback/checkpoint journals are currently browser-scoped; research and approved historical records persist through the existing Supabase path. A separately reviewed additive migration would be needed before promising those local-only journals or newer correction semantics across devices. No such migration is applied here.

After activation, **Prepare Daily Research → Copy Daily GPT Prompt → import Daily Cycle JSON** can generate and validate the next cycle. The daily prompt now includes saved archive context, approved methodology and existing archive-backed paper positions, with proposals and claims kept separate from the financial ledger. **The current Daily Cycle “Review & Apply Daily Update” action still rejects private mode.** It is not a complete hosted cycle-import transaction and has not been enabled in this task. Finish/review that persistence path before relying on it; no new migration is applied or approved here. Historical paper results continue to require the separate existing Results Review transaction and eligibility checks. Review supported results separately, enter accepted prices/stakes only for genuinely placed new wagers, and retain the final actual/paper approval boundaries. Research proposals cannot be backdated into valid pre-event forecasts. A$500 remains a funding cap, not proof of a deposit or available bookmaker balance.
