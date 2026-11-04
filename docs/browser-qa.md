# Optional browser smoke checks

The regular app does not depend on Playwright. To reproduce browser QA, install it in a temporary folder and use an installed Chrome/Chromium executable. No account, API keys or browser download is required when using your existing browser.

```sh
mkdir -p /tmp/edgelab-browser
npm install --prefix /tmp/edgelab-browser playwright
npm run dev
# In another terminal (macOS default Chrome path is detected):
node scripts/check-browser.mjs --runtime /tmp/edgelab-browser
```

On other platforms, supply `--browser /absolute/path/to/chrome`. Optional flags: `--url http://localhost:3000` and `--artifacts /tmp/edgelab-qa`. Use a fresh browser context; the script only creates synthetic records in its isolated demo storage. It never signs in or modifies Supabase records.

The checks exercise all seven routes, manual single/parlay ledger entries, audited settlement, browser reload persistence, settings and funding bookkeeping, simulated daily research, immutable paper registration and settlement, paper/cash separation, notification read/dismiss/history, manual actual-bet confirmation, browser notification permission APIs and mobile layouts. Desktop/mobile screenshots and JSON results are written to the artifact directory. OS-level notification display is not verified.

Run against a stable server without editing source files: dev hot reload can interrupt dialogs and invalidate interaction assertions. The harness disables animations for deterministic screenshots.

## Historical import and mocked authentication checks

The new `/imports` route is covered by a separate synthetic workflow suite. Run it against a stable local server:

```sh
node scripts/check-import-browser.mjs \
  --runtime /private/tmp/edgelab-browser \
  --url http://localhost:3000 \
  --artifacts /private/tmp/edgelab-import-browser
```

It blocks every nonlocal request and starts a new browser context. It exercises all eight application routes, malformed input, JSON/CSV/manual review, explicit archive confirmation, exact duplicate rejection, immutable paper forecasts/per-leg settlement, historical notification lifecycle, separate bonus-ledger confirmation without inferred funding, reload and mobile layout. It retains synthetic state only inside that temporary browser context, then closes it. No existing browser profile or account is touched.

With the public Supabase URL configured (no private keys needed), the Auth harness intercepts all Auth and RPC responses before they leave the browser:

```sh
node scripts/check-auth-browser.mjs \
  --app-url http://localhost:3000 \
  --browser-runtime /private/tmp/edgelab-browser \
  --report /private/tmp/edgelab-auth-browser-20261104.json
```

It uses fake tokens/accounts and in-memory RPC responses; it tests real UI forms and the installed SDK rather than hosted Auth. Signup confirmation state, unconfirmed/revoked-session errors, token expiry refresh, failed/successful authenticated funding submission, reload, logout, callback URL cleanup and demo isolation are covered. It reads only the public configured service URL to identify intercepted requests; it requests no credentials and sends no email. Do not call this hosted verification.

For a stable production-server check, first run `npm run build`, then `npm start -- --port 3101`, and pass `http://localhost:3101` to these scripts. Stop the QA server afterward. Browser harnesses and optional temporary runtimes are test tools, not application dependencies or new paid services. Retained reports are summarized in [verification.md](verification.md).


## Complete research continuation check

```sh
node scripts/check-handoff-browser.mjs \
  --runtime /private/tmp/edgelab-browser \
  --url http://localhost:3101 \
  --artifacts /private/tmp/edgelab-handoff-browser
```

Use a stable local production build/server as above. The suite blocks all nonlocal traffic, uses only labelled synthetic records in a fresh context, and fixes/advances its browser clock for source/event/result chronology. It covers selected conversation mapping, archive review and separate financial registration, context journal, generated/copied prompt, malformed/LLM/missing-price responses, paper/pass approval and alerts, duplicate rejection, reminders, per-leg settlement, analytics/day continuation, mobile layout and the complete snapshot export. Actual results and any skipped checks are reported explicitly; a synthetic local success is not hosted verification.
