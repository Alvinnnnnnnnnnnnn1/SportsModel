# EdgeLab project instructions

- Build a private, zero-cost, local-first Next.js App Router application with strict TypeScript, npm, Tailwind and accessible shadcn/ui components.
- All seeded sports, prices, forecasts, alerts and results are synthetic. Label demo data clearly. Never connect bookmaker accounts, scrape bookmakers, execute bets, import ChatGPT history or add paid services.
- Demo storage and authenticated Supabase storage must be isolated. Production starts empty. Mock research is available only in demo mode.
- Store dates in UTC and display in Australia/Melbourne. Store money as integer AUD cents in TypeScript and NUMERIC in PostgreSQL. Paper activity must never affect cash bankroll.
- Keep deterministic calculations, providers, persistence and presentation separate. Predictions and provenance are immutable after registration; ledger edits require an audit record.
- Use only public Supabase publishable/anon keys in the browser. Enforce auth.uid() ownership in database RLS. Never commit credentials.
- Before handoff run npm test, npm run typecheck, npm run lint and npm run build; report verification gaps accurately.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
