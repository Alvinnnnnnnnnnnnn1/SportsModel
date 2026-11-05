# EdgeLab project instructions

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
- Recovery sources and detailed previews stay in ignored `.local/` or user-selected local files. The combined recovery remains preview-only. Only the separately reviewed single-paper pilot scope has been approved; inspect `.local/paper-supplement-review/single-paper-approval-scope.json` and current verification evidence before any continuation. No other historical import, financial registration, deletion or migration is approved.

- The 5 November 2026 Day 6 owner checkpoint is local staging only. Two owner-confirmed pending placements have unknown accepted execution odds/times; quoted prices and probability ranges stay raw provenance, not ledger odds or point forecasts. No new checkpoint import or methodology authority has been approved. Do not repeat the already imported historical paper pilot.
- Research methodology approval, original-rule completeness, owner-reported active day and source-confirmed completion are separate. Local continuity evidence never registers positions or affects bankroll. Owner-linked former proposals need distinct paper registration proof before independent paper tracking.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
