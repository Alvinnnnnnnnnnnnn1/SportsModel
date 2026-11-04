# Historical research import

## Status and storage boundaries

The controlled import UI is at `/imports` (Historical Import in the sidebar). Demo is fully local and accepts **explicitly synthetic** sources only. It saves a separate, initially empty historical workspace under `edgelab:history:demo:v1`. It never copies history to a private account. The existing demonstration ledger remains under `edgelab:demo:v1`.

Private historical persistence requires the **prepared, unapproved** migration `202611040001_historical_import.sql`. It has not been applied to the hosted project. Until deployment is approved, the private import screen reports that historical storage is unavailable and refuses to save. Existing authenticated ledger/settings persistence continues to use the two already-deployed migrations. No real experiment history has been imported.

Private imports must be unverified or manually user-confirmed source records; synthetic fixtures are rejected by both the repository and SQL. User-confirmed means the user reviewed the source, not that EdgeLab independently verified it. Do not relabel a synthetic fixture to bypass that boundary.

## Using the workflow

1. Open Historical Import. In Demo, download a CSV/JSON template or choose **Load synthetic example**. Templates contain fictional records only.
2. Upload a UTF-8 `.csv`/`.json` file, paste mapped JSON, or choose **Enter record manually**. Select the honest source classification. Limits: 1 MiB and 500 rows per batch, at most 20 legs per record. No data is saved during parsing.
3. Choose **Parse, validate & detect duplicates** (or validate JSON/manual record). Review each row's normalized values, raw source, transformations, errors, warnings and duplicate matches. Blank or absent information becomes `null`; the app does not invent missing facts.
4. Use **Resolve** for source-supported corrections before registration. This retains the original source and raw row and appends the correction to the transformation audit. An imported snapshot cannot subsequently be rewritten.
5. Select approved rows. Errors and exact duplicates are blocked. Acknowledge incomplete/unverified information explicitly. A probable duplicate needs a separate **keep separately** decision; no uncertain records are merged automatically.
6. Review the final summary, check the explicit approval statement and choose **Save approved archive records**. Source text, SHA-256, selected rows, skipped-row count, flags and approval audit are saved together.
7. Review saved records and batch audit summaries below the form. Original source text is retained. Paper records appear in Paper Tracking. Actual-source records remain archive-only and have **no financial effect**.
8. To register an actual record financially, open its source detail → **Review actual-ledger registration**. A second confirmation shows the stake, cash/bonus type, original price, outcome, reported payout and deterministic return. Only complete and consistent actual records are allowed. Paper records cannot be converted into actual wagers. Funding must be recorded independently; no deposit is inferred.

Do not upload passwords, tokens, private keys, or bookmaker credentials. Known credential-key patterns are rejected before source retention; this is a guard, not a general secret scanner. Sources stay in your browser during preview, then only the chosen workspace receives an explicitly approved batch. Full original source text is retained, including skipped rows, for audit; review that text before confirming.

## Supported formats

CSV uses a header row, commas, quoted fields (including commas/newlines), doubled quote escaping and optional UTF-8 BOM. JSON accepts an array of objects or `{ "formatVersion": 1, "records": [...] }`. Manual entry uses the same validator. The format version currently documents the template; it is not an automatic schema migration system.

Canonical fields:

| Fields | Representation |
| --- | --- |
| `externalId`, `eventId`, `marketId` | Optional source identifiers |
| `kind` | `actual`, `paper`, or null when unknown |
| `sport` | `NBA`, `NBL`, `ATP`, `WTA`, or null |
| `event`, `participant`, `market`, `selection`, `line`, `bookmaker` | Exact source text; line may explicitly say `Moneyline`/`N/A` only when supported by the source |
| `odds` | Original decimal odds greater than 1, up to four decimal places, or null |
| `predictionAt`, `placedAt`, `settledAt` | ISO-8601 with `Z` or an explicit UTC offset; normalized to UTC. No timezone is guessed |
| `probability` | Original numerical probability in 0–1, or null; not an LLM estimate |
| `probabilitySource`, `probabilityMethod`, `modelVersion` | Original probability provenance, or null |
| `strategy` | `A`, `B`, `C`, or null |
| `sourceReference`, `notes` | Traceable source reference and optional source notes |
| `stakeCents`, `payoutCents` | Nonnegative integer AUD cents; unknown is null |
| `stake`, `payout` | Alternative AUD decimal amounts, at most two places; must agree if cents are also supplied |
| `stakeType` | `cash`, `bonus`, or null |
| `outcome` | `pending`, `won`, `lost`, `void`, or null |
| `verification` | `synthetic`, `unverified`, `user_confirmed`; must agree with the batch classification |
| `legs` | JSON array of individual selections; CSV stores this as a properly quoted JSON cell |

Common snake_case names and documented aliases are accepted, with normalization retained in transformations: `betType`→`kind`, `player`/`team`→`participant`, `marketType`→`market`, `threshold`→`line`, `decimalOdds`→`odds`, `predictedAt`→`predictionAt`, `source`→`sourceReference`. Conflicting aliases are flagged. Unknown columns are flagged for review rather than interpreted by AI.

Leg objects support `id` (optional UUID metadata), `sport`, `eventId`, `event`, `participant`, `marketId`, `market`, `selection`, `line`, `odds`, `outcome`, `statistic`. Missing leg facts remain null. A single selection may be represented as one leg by copying its supplied fields; no absent value is invented. Generated UUIDs are metadata and are excluded from duplicate identity.

Raw ChatGPT exports, freeform conversation prose, PDFs, screenshots, arbitrary sportsbook CSV schemas and complete workspace backup snapshots require **manual mapping** into this format. Nothing reads ChatGPT automatically. Source references can identify a conversation supplied by the user, but EdgeLab does not fetch it. No real records should be imported without the user's separate approval.

## Duplicates and reconciliation

The same external record ID within the same source reference is blocked as an exact duplicate even if its proposed type differs; resolve contradictory mapping explicitly. External record IDs identify source records, rather than a shared event or forecast. Canonical comparisons include bet/prediction type, so independently identified paper and actual records can coexist without conversion. Canonical fingerprints compare source identity including event/market identifiers, selections, thresholds, original odds, timestamps and kind. Probable matches flag overlapping identifiers/selections with changed or missing details. Detection runs within the source, against saved history, and again at confirmation to catch stale previews. No automatic merge or overwrite occurs.

Actual archives, registered cash bets, bonus bets, paper records, funding and hypothetical returns remain separate. Integer cents and the existing deterministic money helper calculate returns. Contradictory outcomes, fractional/negative money, conflicting amount aliases, impossible timestamp order and inconsistent payouts are blocked. Incomplete archives may be retained after acknowledgement; they cannot silently become complete financial entries. Registering an actual record uses its stable archive UUID, preventing repeated registration in the existing ledger.

A won parlay with some void legs needs a source-supported adjusted settlement price, which the historical format does not yet store separately. Such archives are flagged, financial registration is blocked, and hypothetical P/L is unavailable. EdgeLab does not infer adjusted odds. All-void refunds and decisive losses retain the supported deterministic treatment.

## Paper and notification lifecycle

Imported paper forecasts stay frozen. Record final overall outcome, exact leg outcomes/statistics and the known result timestamp in Paper Tracking. Unknown dates remain null; they are not replaced with import time. Corrections append before/after audits. Hypothetical cash/bonus returns never reach bankroll. Hit rate requires known prediction/result ordering; Brier scoring additionally requires original probability provenance. Missing samples show insufficient data. Imported paper metrics appear separately on Paper Tracking and Analytics.

From source details, **Create research notification** creates one historical reminder per record. It is labelled historical/synthetic/unverified as appropriate; prices are not rechecked. Notifications support unread/read, dismissal with retained history, source details, and explicit addition to paper tracking. An unclassified source can be tracked as paper through a separately audited action without changing its original null kind. An actual source cannot be converted to paper. Duplicate creation is idempotent. No background push or external messages are sent.

## Limits

The MVP retains source batches as whole snapshots and is designed for a small private archive. Hosted history saves have a 32 MiB serialized-workspace limit; browser storage has its own smaller browser-dependent quota. Large histories need paginated per-entity persistence. Browser localStorage is not encrypted, cross-device storage or a backup. File parsing is bounded but occurs on the main thread. There is no automatic freeform mapping, financial transfer, funding import, actual payout adjustment, historical forecast correction, delete/merge workflow, or general-purpose backup restore. A correction to an already registered forecast should be a separately reviewed source record, not a retroactive edit.


## Implementation map

| Files | Responsibility |
| --- | --- |
| `src/app/imports/page.tsx` | New App Router entry with a Suspense boundary |
| `src/components/imports/history-page.tsx`, `import-wizard.tsx`, `history-status.tsx` | Source selection/manual entry, parsing/review/confirmation, immutable archive, retained source/audit summaries and unavailable/loading states |
| `src/components/imports/imported-paper.tsx`, `imported-notifications.tsx` | Historical settlement/per-leg UI, metrics and notification/paper-registration lifecycle |
| `src/components/history-provider.tsx`, `history-detail.tsx` | Isolated workspace state, queued saves, immutable source detail and separate financial confirmation |
| `src/lib/imports/types.ts`, `validation.ts`, `parser.ts`, `duplicates.ts`, `commands.ts`, `calculations.ts`, `fixtures.ts`, `index.ts` | Nullable entities, strict validation, bounded parsing, provenance, matching, audited commands, deterministic reconciliation and synthetic templates |
| `src/lib/imports/repository.ts` | Separate browser and authenticated history repositories with revision/expected-owner checks |
| `supabase/migrations/202611040001_historical_import.sql` | Prepared additive schema, RLS, guards, audits and transactional RPCs; not deployed |
| `src/lib/auth/actions.ts`, `src/components/settings.tsx`, `src/lib/persistence/index.ts` | Controlled Auth actions/errors, verified user checks, password clearing and local-session logout |
| `src/app/layout.tsx`, `src/components/shell.tsx`, `overview.tsx`, `paper.tsx`, `analytics.tsx`, `notifications.tsx` | History provider/navigation and imported counts/performance/lifecycle sections, preserving original features |
| `tests/auth-session.test.ts`, `import.test.ts`, `import-lifecycle.test.ts`, `import-persistence.test.ts` | New transport, parser/domain, lifecycle and persistence regressions |
| `scripts/check-auth-browser.mjs`, `check-import-browser.mjs`, `check-import-database.mjs`, existing `check-browser.mjs` | Optional free local verification; original notification test scoped to its panel |
| `README.md`, `AGENTS.md`, `docs/architecture.md`, `database.md`, `verification.md`, `roadmap.md`, `browser-qa.md`, `historical-import.md`, `historical-migration-review.md`, `docs/reports/*browser*20261104.json` | Setup/architecture/security/format/approval documentation and sanitized local evidence |

Earlier hosted verification helpers and evidence present at resume were retained. No dependency, lockfile, environment template, deployed migration or existing data changes were required for this stage.
