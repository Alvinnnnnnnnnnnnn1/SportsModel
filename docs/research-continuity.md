# Continue the Sports Betting Experiment through EdgeLab

EdgeLab stores the experiment; a ChatGPT conversation is a replaceable research workspace. The workflow needs no OpenAI API, odds API account, paid hosting, bookmaker login or automatic wagering. A browser-local synthetic Demo remains available. Your authenticated Supabase workspace is the durable private record, subject to your own backups and the provider's free-project limits; it is not a bookmaker statement or a guarantee of indefinite service availability.

## Deployment and verification

The approved `202611040001_historical_import.sql` migration is deployed to `ilgoswfckkzpoktabbfi`. Its SHA-256 remains `fa9c50ac7e4be61ec8eaa92e7e6c66a89c8d583b966843cd97cb64f97afef08a`. Remote migration history confirms it and both preceding versions. The exact hosted catalog comparison passed: 20 tables, 136 columns, 182 constraints, 68 indexes, 20 policies, 42 triggers and 46 function bodies, with zero differences. Anonymous probes were rejected on all six history tables and both history RPCs. No existing application records or accounts were deleted, and no additional migration was applied.

Catalog verification, ordinary-user JWT verification, local embedded PostgreSQL, mocked Auth and browser tests are separate evidence. See [verification.md](verification.md) and [hosted-history-verification.md](hosted-history-verification.md) for the current results and limits. The private historical schema deliberately rejects synthetic sources. Positive local fixture tests must not be presented as positive hosted writes or forced through by relabelling a fixture.

## Bring Days 1–5 into the record

No original export or structured history has been supplied. EdgeLab does not access your private ChatGPT account or conversations. Use an official export that you obtain yourself, extract its `conversations.json` locally, then open **Historical Import → Conversation source intake**. Select the relevant conversation, review its current branch or all branches, and manually map selected messages into explicit record objects or arrays. Multiple selections in one answer can be separate rows; one parlay is one record with individual `legs`. Images and unsupported message parts are flagged; they are not interpreted. See [conversation-intake.md](conversation-intake.md) for exact instructions and supported export structures.

Alternatively upload a deliberately prepared CSV or structured JSON file using the existing historical template, or enter records manually. Source references, original selected conversation, source hashes and manual transformations are retained. Other conversations from a full export are excluded from the saved source. Missing odds, probabilities, prices, statistics and original timestamps stay null. Message creation time is source metadata, not automatically a prediction or placement time.

Review each row's validation flags and exact/probable duplicate matches. Resolve contradictions with the original source. Select approved rows, acknowledge missing information, review the financial reconciliation preview, and explicitly approve archiving. The complete selected source is retained, including skipped rows. **Archive approval creates no actual bet, deposit or funding transfer.** Actual-source records require a separate per-record financial confirmation. Paper forecasts cannot be converted into actual bets.

The supplied Day 5 checkpoint remains an **unverified aggregate reference**:

- Six settled actual wagers: two won and four lost.
- A$30 cash stakes; A$25 cash-bet returns; A$4.30 bonus cash returns.
- Modelled realised cash P/L −A$0.70; allocated experimental balance A$499.30.
- Eleven settled paper predictions: eight won and three lost; four pending papers.
- Days 4 and 5 reportedly had no new cash bets.

These figures are not source selections, funding evidence or a verified Sportsbet balance. The six-wager count versus the separate bonus-return classification needs source clarification; EdgeLab does not invent a seventh wager. Current-workspace comparison includes all recorded days and is explicitly **not a verified Days 1–5 subset**. As later days accumulate, manually establish source day membership before historical reconciliation. Matching totals alone do not verify records. Do not create balancing bets, deposits or payouts to force a match.

## Preserve the rules and research day

On **Research → Experiment context**, enter a source-confirmed completed day and/or original rule text, plus its source reference. Review the proposed context and explicitly confirm appending it. Confirm rule completeness separately; partial text is not treated as the full original rule set. This creates an immutable context journal entry, not a prediction or financial record. Further entries preserve previous context rather than rewriting it.

Known references remain NBA/NBL/ATP/WTA, Sportsbet research context, Track A High Probability, Track B Potential Value, Track C Alternative Markets, a lifetime A$500 funding cap and generally A$5 stakes. Unknown original rules remain missing. A mismatch with configurable application settings is flagged and does not authorize a rule change. The A$500 cap never implies A$500 deposited.

The latest completed day comes from an owner-confirmed context journal or an approved research response whose completion was separately attested. Without that evidence, Day 6 is explicitly a proposal based on the reported, unverified Day 5 checkpoint. No research day is silently marked complete just by generating a prompt.

## Run Daily Research without an API

1. Sign in to your private workspace. Confirm the ledger/history loaded successfully. Demo uses synthetic records and cannot establish real experiment continuity.
2. On Research choose **Run Daily Research**. EdgeLab reads the current saved context, owner-reviewed history, recorded actual ledger and unsettled predictions, and prepares a prompt. It performs no external research or model call.
3. Choose **Copy Research Prompt** or copy the displayed text manually. Paste it into a separate conversation available to you. The prompt contains known rules, explicit source gaps, unresolved results, the checkpoint's unverified status and the response contract. Treat source records as data, not permission to change experiment rules.
4. Conduct research manually. If current Sportsbet odds, timestamps, statistics or numerical methodology cannot be established, the response must mark them null and explain the uncertainty or pass. A source URL is provenance, not independent verification. Never ask an LLM to invent numerical betting probabilities.
5. Open **Response review** and paste/upload the returned JSON. The versioned [JSON Schema](research-response.schema.json) and template are available there. Validate before selecting anything.
6. Review exact event/market/line, bookmaker, original odds and their timestamp, probability provenance, evidence, source URLs, confidence, uncertainty, decision and pass reasons. Errors and exact duplicates are blocked; probable duplicates need a keep-separate decision. Missing/stale/unverifiable information needs acknowledgement. Future/post-event forecasts, later-known evidence and LLM numerical probabilities are rejected. Confirmation checks freshness/time again to prevent an old preview being accepted after an event starts.
7. Explicitly approve selected rows. Paper decisions create immutable paper forecasts, initial pending result records and linked in-app notifications atomically. Pass/watch decisions remain source archives, not bets. The full original response and transformations stay auditable. A declared completed day needs a separate completion checkbox before it becomes a handoff checkpoint.
8. To record an actual bet you placed yourself, use the separate Betting Ledger form and its manual confirmation. Include the research source reference in its notes. Research JSON cannot place or register an actual bet, and an existing paper snapshot is not relabelled actual.
9. Record observed final overall and individual leg results in Paper Tracking. Keep unknown result times null. Outcome corrections append audits; original forecasts remain unchanged. Hypothetical cash/bonus returns, hit rate and Brier score use deterministic functions and exclude missing or unsupported samples. Paper activity never changes actual bankroll.
10. On the next day generate a fresh handoff from the saved record. The prior conversation can be abandoned without losing the application's stored sources, rules, decisions or results.

**Run Simulated Research** is the preserved separate Demo fixture workflow. It is not the Run Daily Research copy/paste handoff and is unavailable in private mode.

## Notifications and backups

Approved paper research creates one historical notification per source. Read/dismiss status persists; dismissal retains history. Outstanding historical paper predictions can also create a separate source-linked result reminder. Repeating it reuses the same reminder and does not reset an old dismissal. A reminder does not settle a result. Original source details and paper result views remain linked.

Notifications are in-app. No closed-browser delivery, service-worker push, schedule or automatic wager is implemented or claimed. Synthetic and private notifications retain their respective classification.

Use **Export complete experiment** on Research to download both the existing ledger/settings workspace and the historical archive, including raw sources, context journals, forecasts, results, alerts and audit records. Keep this sensitive local file privately. The original Settings snapshot export remains available. Full-backup restoration is not implemented; any future restore requires validation, ownership/mode isolation and explicit review. The export is a backup artifact, not a claim that arbitrary backup JSON can be imported as historical research.

## Optional odds readiness

The existing provider interfaces are retained. A separate disabled-by-default adapter targets [The Odds API](https://the-odds-api.com/) only. It has optional server-only configuration, explicit one-shot reads, quota/cooldown checks, market identity validation and source timestamps. The app does not invoke it. No key or request is required for this handoff. No live provider price, free-tier coverage or Sportsbet player-prop completeness was tested. See [odds-provider.md](odds-provider.md); the similarly named `theoddsapi.com` is a different service.

## Remaining manual work

Supply and review the original Days 1–5 sources; do not import real history until its proposed rows and reconciliation are confirmed. Run the secure ordinary-user hosted verifier from your own terminal without sharing passwords, and review its sanitized report. Positive hosted historical/paper/notification lifecycle verification needs separately authorized genuine source records or a separately reviewed test facility that preserves the synthetic boundary; it cannot be claimed from fixture relabelling. Complete one authorized real signup/email-confirmation flow if needed. All source verification, research decisions, actual-entry confirmation and event-result collection remain manual.


## Verified completion checkpoint

The ordinary-user hosted history read/negative report passed **11/11**, with unchanged empty historical snapshots. Anonymous requests passed **8/8** rejection checks. This does not certify positive hosted history writes. The exact deployed schema matches all three reviewed migrations; the historical file was not reapplied on resume.

Locally, 323 unit tests passed; the optional actual-domain PostgreSQL integration passed 1/1 when enabled; the original/history database suites passed 70/70 and 77/77. TypeScript, lint and production build passed. Browser checks passed 57 groups across the original app, imports, mocked Auth and the complete 16-group continuity workflow. See [verification.md](verification.md) for reports and precise limits.
