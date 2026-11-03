# MVP verification

Executed locally on 3 November 2026 with Node.js 24.21 and npm 11.19. No hosted project, live sports API, bookmaker account or paid service was used.

| Check | Result |
| --- | --- |
| Dependency installation | Passed; compatible stable versions locked in `package-lock.json` |
| `npm test` | 35 passed: 27 domain/provider tests and 8 persistence tests |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed without warnings |
| `npm run build` | Passed; all seven workspace routes generated |
| Embedded PostgreSQL verification | 34 checks passed using temporary PGlite |
| Chrome browser workflow checks | 20 groups passed using the optional browser script |
| Additional Chrome smoke checks | 3 passed: initial/reload dashboard; failed browser alert preserves in-app alert; mobile overview |
| Responsive layout | All seven routes checked at 390px with no document overflow |
| Production startup/browser smoke | All seven routes HTTP 200 with expected headings and no browser exceptions; mobile overview fits 390px |
| Runtime dependency audit | Zero known vulnerabilities |

The database harness executes the migration against PostgreSQL WASM, substituting built-in `gen_random_uuid` for the unavailable `pgcrypto` extension in that runtime. Checks include actual/paper round trips, NUMERIC values, complete provenance, immutable forecasts, audited edits, atomic rollback, stale revisions, two-user RLS isolation and anonymous access denial. Reproduction instructions are in [database.md](database.md).

Browser checks exercise manual single and parlay entry/settlement, audit records, reload persistence, settings and funding, simulated research, paper registration/settlement without changing actual funds, notifications and manual actual-bet confirmation. They use isolated synthetic browser storage. The permission API and browser-delivery failure fallback were tested; actual OS notification display was not verified. See [browser-qa.md](browser-qa.md).

## Remaining verification limits

- Hosted Supabase email confirmation, sign-in and remote persistence need a configured free project. Embedded SQL checks do not test Supabase's hosted Auth, JWT or network layers.
- All sports inputs and results are synthetic. No live provider, external statistical dataset, real model validity, scheduled research or background push was tested or claimed.
- The optional Playwright and PGlite runtimes were installed under `/private/tmp`, outside application dependencies. They are needed only to reproduce those additional checks.
- The development-only lint dependency tree has 16 moderate transitive glob-matching advisories. Runtime dependencies audit clean. ESLint 9 and TypeScript 6 are pinned to satisfy the current Next.js lint plugin compatibility ranges.

Production screenshots: [desktop](screenshots/overview.png), [mobile](screenshots/mobile.png). These show synthetic data in a fresh browser workspace.

## Existing Supabase project integration checkpoint

The local integration was configured for the supplied existing Free project on 3 November 2026. The original migration checksum remains `550af08d2a33026e641103bda42444193723b701ed0152bff3ce344667a3d33b`. A separate `202611030002_harden_workspace_integrity.sql` contains reviewed local hardening changes; neither migration has been applied remotely by this integration.

- Live read-only public-key connection: Auth settings returned HTTP 200; Email/sign-up enabled and email confirmation required. Anonymous table/RPC probes returned schema-cache not-found responses, which do not prove hosted RLS or migration status.
- Local `.env.local` is ignored, and `.env.example` remains blank. CLI 3.0.0 is installed as a development dependency; config is initialized with no seeding and localhost callback settings. No password, service-role key or management token was added to source.
- `npm test`: 43 passed, including callback safety and explicit persistent public-client configuration.
- `npm run lint`, `npm run typecheck`, `npx tsc --noEmit`, and `npm run build`: passed. The build includes all seven workspace routes plus `/auth/callback`.
- Embedded PostgreSQL: 70 checks passed across both migrations, including new integrity/direct-write revision regressions and historical-row preservation. This uses test authentication shims, not hosted JWTs.
- Existing browser regression: 20 groups passed against localhost:3000, preserving demo features and all mobile layouts. Five additional browser auth checks passed: configured sign-in UI, expired/error callback handling, URL cleanup, fixed destination, and empty signed-out private mode with demo history unchanged. No credentials were entered or hosted records changed.

Hosted CLI linking, remote migration-history/dry-run review, explicit migration approval, email delivery, successful real-account sign-up/sign-in/logout, refresh persistence and two-account hosted RLS tests remain pending. True simultaneous multi-connection races have not been tested. See [database.md](database.md) for the exact secure-terminal and Dashboard steps. This checkpoint is not a claim of fully tested hosted functionality.

## Remote migration preflight

After the user completed CLI login/linking, the project reference was verified as `ilgoswfckkzpoktabbfi`. Remote history is empty. `db push --dry-run --remote --skip-vault` succeeded and lists the initial and hardening migrations; no migration was applied. A SELECT-only CLI query with `--read-only` confirmed PostgreSQL 17.11, required Auth roles/table, existing pgcrypto in extensions, no public tables/views/indexes and no EdgeLab functions. All 70 local PostgreSQL checks passed again on the unchanged files.

See [migration-review.md](migration-review.md). Actual remote application awaits explicit approval; hosted user-session security tests have not been claimed as passed.
