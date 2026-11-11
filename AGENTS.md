# EdgeLab project instructions

## V6 owner-requested exception — 11 November 2026

- V6 is a separate prospective PAPER-only cohort. Its approved reference is A$5,000 and fixed hypothetical A$50 entries, with no position-count/exposure cap or available-balance admission gate. Never change V5's A$500/A$5 policy, methodology, history or financial approvals.
- Implement read-only collection only from specifically permitted feeds, frozen objective qualification, independent numerical models and automatic paper registration/grading under an activated, versioned V6 standing policy. No per-position approval is required under that activated policy. Default to disabled/dry-run until source rights, identity, pre-event provenance and policy activation are established. This exception does not authorise direct bookmaker scraping, account access, wagering, paid services, hosted migrations/deployment or external messaging.
- V6 workers must have no V5 repository or financial capability. Never load historical/demo records as V6 prospective observations. Unverified source coverage is a NO-GO, not permission to fabricate prices, grades or model inputs. Keep provider/operational quotas separate from paper volume rules.

- Build a private, zero-cost, local-first Next.js App Router application with strict TypeScript, npm, Tailwind and accessible shadcn/ui components.
- All seeded sports, prices, forecasts, alerts and results are synthetic. Label demo data clearly. Never connect bookmaker accounts, scrape bookmakers, execute bets, automatically access ChatGPT history or add paid services. User-selected exports require manual mapping, preview and explicit import approval.
- Demo storage and authenticated Supabase storage must be isolated. Production starts empty. Mock research is available only in demo mode.
- Store dates in UTC and display in Australia/Melbourne. Store money as integer AUD cents in TypeScript and NUMERIC in PostgreSQL. Paper activity must never affect cash bankroll.
- Keep deterministic calculations, providers, persistence and presentation separate. Predictions and provenance are immutable after registration; ledger edits require an audit record.
- Use only public Supabase publishable/anon keys in the browser. Enforce auth.uid() ownership in database RLS. Never commit credentials.
- Before handoff run npm test, npm run typecheck, npm run lint and npm run build; report verification gaps accurately.

- Historical intake lives in `src/lib/imports` and its own workspace. Preserve raw sources, nullable facts, immutable forecasts and transformations. Archive approval never implies a ledger write; actual registration needs separate explicit financial confirmation.
- New hosted migrations always require explicit approval. `202611040001_historical_import.sql` was explicitly approved and deployed to `ilgoswfckkzpoktabbfi` on 4 November 2026; do not reapply it. Its reviewed SHA-256 is in docs/historical-migration-review.md. Never relabel synthetic fixtures as private research.

- Research Handoff is a manual copy/paste workflow with no OpenAI API. Preserve source claims, uncertainty, original forecast immutability, explicit paper approval and separate actual-ledger confirmation. Day 5 aggregate figures are an unverified reference, never invented records, deposits or bookmaker balances.
- The Odds API readiness targets the-odds-api.com only, stays disabled without optional server-only free-plan configuration, and must not poll or make implicit requests.

- The personal Supabase account already exists. Use its current normal authenticated session; do not recreate/reset it, request credentials, copy test-account data or equate the funding cap with deposits. Settings includes a read-only sanitized access check.
- The canonical 12-actual/34-paper inventory was archived/linked through owner approval on 11 November 2026. The refreshed private export verifies 46 archive records, one unchanged core actual, three unchanged archive paper states and zero funding transactions. Do not repeat that import or treat 34 paper sources as 34 qualifying forecasts. Private source/backups/receipts stay under ignored `.local/account-activation-20261111/`; see docs/account-activation.md. Private Daily Cycle now supports research-only source archival/read-back through the existing history RPC; it never implicitly registers or settles positions. Local correction types still do not imply deployed SQL support.
- Recovery sources and detailed previews stay in ignored `.local/` or user-selected local files. The owner reports that the single-paper pilot and eight historical wager claims are already archived. Preserve them and check the current user-scoped workspace; never repeat those imports. The combined recovery remains preview-only. This UX work authorizes no new hosted import, financial registration, deletion or migration.

- The 5 November 2026 Day 6 owner checkpoint is local staging only. Two owner-confirmed placement claims have unknown accepted execution odds/times; quoted prices and probability ranges stay raw provenance, not ledger odds or point forecasts. Source-time pending claims never establish a current outcome. The owner reports approved Methodology Revision 1; preserve its saved content and do not save or approve another revision on their behalf.
- Research methodology approval, original-rule completeness, owner-reported active day and source-confirmed completion are separate. Local continuity evidence never registers positions or affects bankroll. Owner-linked former proposals need distinct paper registration proof before independent paper tracking.
- Approval statuses are overlapping presentation dimensions, not stored verification upgrades. Archived is not financially registered; owner-attested and evidence-supplied are not independently verified; historical source results are not qualifying forecast settlements. Keep one clear final action at each meaningful persistence/financial boundary, with explicit warning review and individual probable-duplicate decisions.

- The daily workspace archives research before separate actual/paper approval. Results use `edgelab.settlement-response` v1, exact identities and a final owner-approved batch. App and history RPCs are separate transactions; retain partial-success and replay protection. A historical record UUID must not become a core research-candidate FK; preserve its audited origin marker.
- Optional sports reads require server-only `API_SPORTS_KEY`, explicit local-single-process enablement, normal auth and same-origin loopback access. Preserve quota counters/locks in ignored `.local/sports-provider`; no polling, paid upgrades or synthetic private fallback. Exact provider identity mappings are separately owner-reviewed source journals, not forecasts or settlements. Live coverage is sample-specific; see docs/sports-data.md.
- Paper learning excludes retrospective/incomplete history and unsupported forecasts. Keep source/sample classifications in exports; do not manufacture CLV, missing features or input cutoffs. Offline manifest checks do not train/activate/promote models. Recovered V3 material remains unapproved evidence; approved Revision 1 is unchanged.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
