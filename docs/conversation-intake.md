# Preparing a supplied experiment conversation

No conversation export has been supplied or imported by this implementation. The Days 1–5 checkpoint is an unverified reconciliation reference, not a set of invented source records.

## Local preparation

1. Obtain your own official ChatGPT data export outside EdgeLab. If it arrives as a ZIP, extract it using your computer's built-in archive tool. EdgeLab does not sign in to ChatGPT, request an export, read other chats or parse ZIP/HTML files.
2. If the export includes `conversations.json`, select it in Historical Import → **Prepare a supplied conversation source**. A JSON file containing one extracted conversation object is also supported. The local limit is 25 MiB / 5,000 conversations; larger or differently structured exports require a smaller manually extracted source.
3. Search the local titles/source IDs and choose exactly the experiment conversation. Review its current branch from export metadata, or explicitly choose **All branches** if the metadata is missing or alternatives matter. The source preview retains IDs and supplied message timestamps; invalid or absent times stay unknown. Attachments and non-text content are not interpreted or downloaded.
4. Select source messages to map. Enter source-supported historical fields in the nullable JSON drafts. No bet type, odds, stake, probability, funding, prediction timestamp or outcome is inferred from prose. A message creation timestamp is source metadata, not automatically the event's prediction/placement/result timestamp. For multiple predictions in one message, enter an explicit JSON array of record objects in that message's draft. One parlay remains one record with a `legs` array. The prepared batch may contain at most 500 records.
5. Confirm that the chosen conversation is relevant and that its whole original content, including alternative branches, may accompany the proposed records. Choose **Prepare mapped records for review**. This prepares text for the existing import wizard; it does not save anything.
6. In the normal wizard, complete validation, resolve errors/missing facts, review duplicates and reconciliation, select approved rows and explicitly confirm the archive import. Do not commit actual Days 1–5 history until the owner has reviewed the detailed source-backed preview and approved it. Actual financial registration requires its separate confirmation afterward; paper records cannot be turned into wagers.

Demo accepts synthetic exports only. Use your authenticated private workspace for real sources after the historical migration is explicitly approved/deployed. Preparing a source does not bypass that deployment gate or synthetic/private separation.

## Source provenance and format limits

The supported input shape is a conversation array or one conversation object with `id`/`conversation_id`, `mapping`, and message objects under mapping nodes. Current-branch review follows `current_node` and explicit parent references; cycles/missing parents are rejected. This is a supported file shape, not a claim that every past/future official export has a stable API schema. Unsupported exports remain available for manual mapping.

Prepared records retain `chatgpt-export:<conversation-id>/node:<node-id>/message:<message-id>` source references (message IDs are omitted when absent), an original message excerpt/object and the manually entered fields. The envelope retains the complete selected conversation object, selected node IDs, original whole-file SHA-256, source filename and the declared mapping transformation. The object is reserialized from the selected JSON; it is not falsely described as a byte-for-byte standalone original file. The whole-file hash identifies the supplied original export, which the user should keep privately.

Only the chosen conversation is included in the proposed archive source. Other conversations remain transient local file-preview data and are excluded from the prepared JSON. The complete chosen conversation includes skipped messages/alternative branches; this is stated before preparation and again at archive confirmation. Known credential-bearing fields/patterns, malformed Unicode and unsupported controls are rejected by the normal import safeguards. They are guards, not a complete secret scanner; review the source yourself.

The final retained source must fit the existing 1 MiB historical import limit. Large conversations fail with a clear instruction to prepare a smaller extracted source or split manually structured records with references. Nothing is silently truncated. Blank facts remain null, unsupported source columns are flagged, and no synthetic test fixture is relabelled as real research.

## Verification

`tests/conversation-import.test.ts` uses synthetic exports only. It covers array/single/BOM inputs, malformed and oversized files, duplicate/missing IDs, current/all branches, cycles/missing ancestors, attachment noninterpretation, nullable drafts, exact source references, selected-conversation-only retention, manual field mappings, duplicate/stale message selections and normal credential/Unicode protections. These tests do not access a real export or verify every official export version.
