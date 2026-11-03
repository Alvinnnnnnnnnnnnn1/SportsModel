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
