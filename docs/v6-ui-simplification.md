# V6 UI simplification — 14 November 2026

The UI branch starts at `f686b1d630e235961e6a1435ce5a6dad27eaeac9` and targets `feature/v6-autonomous-paper`. It changes presentation only. No deployment or operational activation is included.

## Visible changes

| Before | After |
| --- | --- |
| Nine mixed top-level links plus a second V6 tab bar | Four primary links: Dashboard, Research, Paper Ledger, Model Analytics |
| Duplicate settings, workspace/motivational cards, MVP label | One Account settings utility, small wordmark, header notifications/unread count |
| Legacy routes mixed with prospective research | Legacy V5 disclosure, initially closed on V6 and expanded on V5 deep links |
| Large disabled banner and repeated empty financial cards | Narrow hosted status, four KPIs, two research/registration cards and compact worker/source summary |
| Missing ledger could be confused with zero activity | Not connected / Not available distinguished from a connected ledger with zero positions |
| Bookmaker labels on rows without a quote | No attributable quote; unsupported bookmaker/EV claims withheld |
| Raw evidence repeated across pages | System Status → Technical details retains evidence validity, credentials status and all scheduled checkpoints |

The existing read-only authenticated API, response types (apart from route labels), model/chart calculations, source validation and owner binding are unchanged. Reload snapshot performs only the existing authenticated GET; it never discovers fixtures, queries a bookmaker or writes records. Hosted PAPER autonomy remains disabled. The Mac source worker runs independently; snapshot presence is not process-health proof.

The A$5,000 display is explicitly a nominal opening reference when the owner ledger is inaccessible. A$50 is hypothetical policy metadata. Observations remain separate from registered positions. The website still does not read the P0 local paper journal; neither its five forecasts nor its journal counts are hardcoded into this UI. Settled P/L and ROI require connected registered-position evidence; unavailable metrics are not invented zeros.

Research details preserve every retained selection, both passes, exact event/market identity, model/version decisions, source classifications, source/capture/forecast/frozen clocks (including original ISO values), observational scores and limitations. Missing prices do not erase forecast observations. Model score/calibration charts, fitting/sample caveats, exact score tables and evidence fingerprints remain available.

## Files

- `src/components/shell.tsx`: single sidebar, exact active routes, Legacy V5, header unread count and accessible mobile dialog.
- `src/components/v6/dashboard.tsx`: compact page/status, read-only reload, searchable research evidence.
- `src/components/v6/panels.tsx`: overview, honest ledger states, position fields/accounting and status disclosures.
- `src/components/v6/model-intelligence.tsx`: concise headings, chart label readability and labelled sample selector.
- `src/lib/v6/dashboard.ts`: labels only; IDs, URLs, DTOs and API behaviour preserved.
- `scripts/check-v6-dashboard-browser.mjs`: intercepted UI regression coverage.
- `vercel.json`: disables automatic deployment for this UI branch; the existing feature-branch guard remains.
- This document, dashboard documentation and implementation status.

## Executed verification

All checks use local/disposable fixtures; no personal browser session, provider call, hosted data write or migration is used.

```sh
EDGELAB_POSTGRES_RUNTIME=/private/tmp/edgelab-cloud-validation npm test
node scripts/check-database.mjs --runtime /private/tmp/edgelab-cloud-validation
node scripts/check-import-database.mjs --runtime /private/tmp/edgelab-cloud-validation
node scripts/check-v6-cloud-proposal.mjs --runtime /private/tmp/edgelab-cloud-validation
npm run typecheck
npm run lint
npm run build
node scripts/check-v6-dashboard-browser.mjs --runtime /private/tmp/edgelab-browser \
  --cloud \
  --screenshot /private/tmp/edgelab-v6-ui-simplification/desktop.png \
  --mobile-screenshot /private/tmp/edgelab-v6-ui-simplification/mobile.png \
  --analytics-screenshot /private/tmp/edgelab-v6-ui-simplification/models.png
```

Results: **793 tests / 74 files**, **70 core +77 historical +15 source SQL checks**, **15 browser groups**, typecheck, lint and production build pass. Browser groups cover all V6/V5 routes, exact active links, four primary links/no second tab bar, one account utility, unread badge, distinct snapshot event counts, unavailable versus empty ledgers, absence of unsupported ROI, registered snapshot fields, missing quotes/withheld EV, search/filters, retained clocks/exclusions, model/calibration samples, missing/invalid source states, error/retry, mobile focus trap/Escape/focus return, distinct-user denial and Demo isolation. Intercepted non-owner denial tests UI handling; existing server authentication/RLS tests remain unchanged and passing. It is not a fresh live hosted two-user acceptance test.

## Visual review and handoff

Local screenshot artifacts (synthetic intercepted evidence, not genuine performance):

- `/private/tmp/edgelab-v6-ui-simplification/desktop.png` — 1440px overview.
- `/private/tmp/edgelab-v6-ui-simplification/mobile.png` — 390px overview.
- `/private/tmp/edgelab-v6-ui-simplification/models.png` — chart/sample/limitation rendering.

Compared with the retained 12 November baseline screenshot (`/private/tmp/edgelab-v6-dashboard.png`) and the base source: no second V6 navigation, marketing cards, duplicate settings, large disabled banner or repeated empty summary tiers remain. Desktop overview fits within the initial 1000px viewport. Mobile uses a single column without document overflow; its drawer traps focus, closes with Escape and returns focus to its trigger. Chart labels, sample roles and limitations remain readable. The retained baseline predates the exact branch base and is a qualitative comparison, not a fresh pixel-identical base capture.

Inspect `http://localhost:3000/v6`, `/v6/research`, `/v6/models`, `/v6/positions` and `/v6/health` using the existing private session. V5 links remain under Legacy V5; notifications and settings remain directly accessible. No new setup is required locally. A manual Vercel Preview deployment and live owner inspection remain separate, unperformed steps requiring approval. Do not merge, deploy or activate a worker merely because UI checks pass.
