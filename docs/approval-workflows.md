# Approval and record review

This is a focused UI and workflow pass. Supabase Auth, RLS, repositories, transactional revision checks, stored enums, immutable forecasts and existing accounting remain in use. No migration or hosted data change is part of development. Existing Methodology Revision 1, the historical paper record and the eight archived wager claims must not be re-imported or edited.

## What the workflow audit found

| Area | Previous friction | Implemented change |
| --- | --- | --- |
| Historical import | Separate upload/parse clicks, per-row repeated warning checks, another full confirmation page plus checkbox, no clear completion screen | File upload validates automatically; one review screen with counts and batch controls; one final confirmation dialog; saved-record success links |
| Page navigation | Optional checkpoint/conversation/wager tools appeared before the main uploader | Main historical uploader and saved archive come first; specialist source tools remain available below |
| Research response | Flat list, expanded warnings, repeated row acknowledgements, little saved-record feedback | Paper/watch/pass groups, eligibility totals, bulk selection, one selected-warning approval, individual probable-duplicate decisions and saved-paper links |
| Paper tracking | Historical reported outcomes could look like qualifying settlements; archive-to-paper action was hard to discover | Explicit tracking actions, source-result labels, separate registration/settlement status and actionable result requirements |
| Actual ledger | Defaults could be mistaken for accepted prices/times; repeated single-leg price entry; settlement evidence was hard to review | New accepted price/time fields are blank, explicit current-time action, single-leg price uses the entered execution price, review plus final financial authorization, settlement payout reconciliation |
| Source review | Long repeated warnings and unclear unavailable actions | Overlapping status badges, grouped financial checklist, linked-record navigation and collapsed immutable source/audit details |
| Methodology/context | Two journal formats and repeated confirmations dominated the page | Saved methodology is concise, original-source format is advanced, review uses a frozen readable summary, exact JSON is expandable and the final save button is the persistence authorization |

## Status dimensions

These labels describe independent facts, not one progression and not new stored verification values.

| Label | Meaning |
| --- | --- |
| Draft | An unsaved proposal or position; browser retention is not archive saving |
| Archived | Original evidence preserved in the private archive, or explicitly in the synthetic Demo browser archive; no financial registration implied |
| Owner-attested | Explicitly confirmed by the workspace owner, without independent verification |
| Evidence-supported | Supporting material supplied; its verification level remains visible and independent verification is not established |
| Financially registered | Actual wager passed the existing financial validator and separate owner authorization |
| Paper registered | A saved paper position, entirely separate from an actual wager |
| Settled | A registered actual wager or eligible pre-registered paper position has a recorded result; external verification is still separate |

An unverified source does not become verified when saved. Historical source-reported wins/losses remain labelled as reports. Missing original registration timing cannot be repaired by recording a result later. The shared status helper does not alter storage or authorize actions.

## A — Historical archive import

1. Open **Historical Import → Import historical evidence**. Choose the JSON/CSV source. Uploads validate automatically; pasted JSON and manually entered records use their validation button.
2. Review **Uploaded**, **Archive eligible**, **Duplicates**, **Requires review**, **Blocked** and **Already saved** counts. Counts can overlap. Expand a row's warnings or **Review source** for the complete evidence.
3. Choose **Select all eligible rows**, **Deselect all**, or select individual rows. Review and acknowledge the selected incomplete/unverified evidence once. Each probable duplicate still needs its own keep-separate decision. Errors, exact duplicates and preview-only recovery mappings remain blocked.
4. Choose **Review archive import**. Check the selected record counts and archive-only effect in the dialog. **Cancel** returns to review without saving. **Confirm archive import** explicitly saves the selected source records only.
5. The success screen lists exactly what was archived and provides **Review saved record** links. Saved records also appear immediately in the archive.

The existing eight wager claims and historical paper are already saved. Re-uploading their same source should show **Already saved**, disable selection and offer **Open saved record**. Do not change IDs or remap them to force another import. No bulk archive action registers actual wagers or paper positions.

Browser-only wager-claim retention remains an optional source-context action in its dedicated tool. It does not make a Supabase write and is separate from this archive confirmation.

## B — ChatGPT research response to paper tracking

1. On **Research → Response review**, upload the response JSON (automatic validation) or paste it and choose **Validate research response**. The exact existing response contract and provenance/time checks apply.
2. Review **Paper candidates**, **Watchlist candidates** and **Passed / rejected candidates**, their eligibility, source odds, probability provenance and missing evidence. Technical mappings and warnings are expandable; blocking reasons stay visible.
3. Select eligible paper candidates individually or with **Select eligible paper candidates**. **Select eligible watch / passes** selects watch/pass evidence separately for archiving; it never creates a paper or actual position. Review uncertain duplicates individually.
4. Check **Approve selected research and warnings**, then **Approve selected research**. **Back to research JSON** returns to the unsaved response; validation and selection alone write nothing.
5. The completion summary provides **View paper tracking**, **View saved archive** and expandable **Saved records** links. Paper results are entered separately from their immutable forecasts.

Post-event or unsupported proposals remain blocked from qualifying forecast registration; keep their evidence through the existing historical archive when appropriate. The paper action also rejects already-tracked, actual-linked or elapsed-event core candidates at both the button and queued save. No ChatGPT recommendation alone authorizes a paper position or actual wager.

## C — Actual wager registration and settlement

1. Open **Betting Ledger → Record bet**. Enter the actual accepted decimal price, original Melbourne placement date/time, bookmaker, cash/bonus stake, research track and exact selections. The optional ticket reference is retained in existing audited notes. Research quotes are shown separately when a selection is linked.
2. Review the outstanding-requirements checklist. New price/time fields are blank; choosing the explicit current-placement-time action is optional and must reflect the actual placement. For a single selection the entered accepted price supplies its one leg price; multis still need their exact individual legs.
3. Choose **Review financial registration**, inspect the read-only summary, check its explicit financial authorization and choose **Confirm financial registration**. Cancel leaves actual data unchanged. The form is a local unsaved draft until that final action; no deposit or wager execution occurs.
4. For a pending registered wager, choose **Settle wager**. Enter the result, individual leg outcomes/statistics, original settlement timestamp and actual cash payout. Bonus face value is not a cash payout.
5. Choose **Review ledger update**, inspect the calculated return and payout reconciliation, explicitly authorize the change, then **Confirm settlement / audited update**. Inconsistent payouts stay blocked; the original evidence and audit history are preserved.

Incomplete historical claims continue to use **Review actual-ledger registration** in their source panel, which opens **Review financial registration**. Its checklist explains why registration is unavailable. Preserve missing evidence in the historical archive rather than filling fields with guessed prices, timestamps or funding. There is no second ledger, automatic registration, external verification service or new paid dependency.

## Verification boundaries

Regression checks use synthetic fixtures, isolated browser contexts and ephemeral PostgreSQL. Hosted personal records are never used as development fixtures. See [verification results](verification.md) for completed commands and exact scope; local checks do not imply a new hosted write or independent sports-source verification.
