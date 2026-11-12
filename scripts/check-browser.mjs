#!/usr/bin/env node
// Optional browser QA. Install Playwright in a temporary folder, never in the app.
// node scripts/check-browser.mjs --runtime /tmp/edgelab-browser --browser '/path/to/Chrome'
import { createRequire } from "node:module";
import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";
import fs from "node:fs";
const option = (name) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
};
const runtimePath = option("--runtime");
if (!runtimePath) {
  console.error(
    "Pass --runtime <folder containing an independently installed playwright package>. See docs/browser-qa.md.",
  );
  process.exit(1);
}
const { chromium } = createRequire(path.resolve(runtimePath, "package.json"))(
  "playwright",
);
const baseUrl = option("--url") ?? "http://localhost:3000";
const origin = new URL(baseUrl);
if (origin.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)) throw new Error('Only a local synthetic QA server is permitted.');
const browserPath =
  option("--browser") ??
  (process.platform === "darwin"
    ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    : undefined);
const artifacts = path.resolve(
  option("--artifacts") ?? path.join(os.tmpdir(), "edgelab-browser-artifacts"),
);
fs.mkdirSync(artifacts, { recursive: true });
(async () => {
  const browser = await chromium.launch({
    executablePath: browserPath,
    headless: true,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    locale: "en-AU",
    timezoneId: "Australia/Melbourne",
    reducedMotion: "reduce",
  });
  const externalRequests = [];
  await context.route('**/*', route => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.origin === origin.origin) return route.continue();
    externalRequests.push(requestUrl.origin);
    return route.abort('blockedbyclient');
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const results = [];
  async function test(name, fn) {
    try {
      await fn();
      results.push({ name, passed: true });
      console.log("PASS " + name);
    } catch (e) {
      results.push({ name, passed: false, error: e.message });
      console.log("FAIL " + name + ": " + e.message);
      try {
        await page.screenshot({
          path: path.join(
            artifacts,
            "failure-" + name.replaceAll(/[^a-z0-9]+/gi, "-") + ".png",
          ),
          fullPage: true,
        });
      } catch {}
    }
  }
  async function route(path) {
    await page.goto(baseUrl + path);
    await page
      .getByText("Loading workspace…", { exact: true })
      .waitFor({ state: "hidden", timeout: 20000 });
  }
  async function openEligibleResearch(action) {
    const reviews = page.locator('.panel').filter({ has: page.getByLabel('Search research candidates', { exact: true }) }).getByRole('button', { name: 'Review', exact: false });
    for (let index = 0; index < await reviews.count(); index++) {
      await reviews.nth(index).click();
      const dialog = page.getByRole('dialog');
      await dialog.waitFor();
      const target = dialog.getByRole('button', { name: action, exact: true });
      if (await target.count() && await target.isEnabled()) return dialog;
      await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
    }
    throw new Error('No eligible synthetic research selection for this action.');
  }
  await test("overview desktop", async () => {
    await route("/");
    await page.getByRole("heading", { level: 1 }).waitFor();
    await page.screenshot({
      path: path.join(artifacts, "overview.png"),
      fullPage: true,
    });
    assert(await page.getByText("DEMO MODE", { exact: true }).isVisible());
  });
  for (const path of [
    "/ledger",
    "/research",
    "/paper",
    "/analytics",
    "/notifications",
    "/settings",
  ])
    await test("route " + path, async () => {
      await route(path);
      await page.getByRole("heading", { level: 1 }).waitFor();
      assert(!(await page.getByRole("heading", { name: "404" }).count()));
    });
  await test("cancelled manual drafts make no financial writes and execution facts are not prefilled", async () => {
    await route('/ledger');
    const before = await page.evaluate(() => JSON.parse(localStorage.getItem('edgelab:demo:v1')));
    await page.getByRole('button', { name: 'Record bet', exact: true }).click();
    const dialog = page.getByRole('dialog');
    assert.equal(await dialog.getByLabel('Accepted decimal odds', { exact: true }).inputValue(), '');
    await dialog.getByRole('button', { name: 'Placed earlier', exact: true }).click();
    assert.equal(await dialog.getByLabel('Placed at · Melbourne', { exact: true }).inputValue(), '');
    await dialog.getByLabel('Bookmaker', { exact: true }).fill('SYNTHETIC cancelled draft');
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('edgelab:demo:v1'))), before);
  });
  await test("manual bet confirmation and audited settlement", async () => {
    await route("/ledger");
    await page.getByRole("button", { name: "Record bet", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("Bookmaker", { exact: true })
      .fill("QA Synthetic Bookmaker");
    await dialog.getByLabel("Stake · AUD", { exact: true }).fill("5.00");
    await dialog.getByRole('button', { name: 'Placed earlier', exact: true }).click();
    await dialog.getByLabel('Placed at · Melbourne', { exact: true }).fill('2026-01-15T12:00');
    await dialog.getByLabel('Sportsbook ticket reference · optional', { exact: true }).fill('QA-SYNTHETIC-TICKET-1');
    await dialog.getByLabel("Accepted decimal odds", { exact: true }).fill("2.10");
    await dialog
      .getByLabel("Participant / team", { exact: true })
      .fill("QA Test Player");
    await dialog
      .getByLabel("Event", { exact: true })
      .fill("QA Synthetic Tigers vs Falcons");
    await dialog
      .getByLabel("Exact market", { exact: true })
      .fill("Player points");
    await dialog
      .getByLabel("Exact selection", { exact: true })
      .fill("QA Over 20.5 points");
    await dialog.getByLabel("Line / threshold", { exact: true }).fill("20.5");
    const beforeReview = await page.evaluate(() => JSON.parse(localStorage.getItem('edgelab:demo:v1')));
    await dialog.getByRole('button', { name: 'Review financial registration', exact: true }).click();
    const confirm = dialog.getByRole('button', { name: 'Confirm financial registration', exact: true });
    assert(await confirm.isDisabled());
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('edgelab:demo:v1'))), beforeReview);
    await dialog.getByRole('checkbox').check();
    await confirm.click();
    await dialog.waitFor({ state: "hidden" });
    await page.getByLabel("Search ledger").fill("QA Over");
    await page
      .getByRole("button", { name: "Edit QA Over 20.5 points", exact: true })
      .click();
    const edit = page.getByRole("dialog");
    await edit.getByLabel("Bet outcome", { exact: true }).selectOption("won");
    await edit
      .getByLabel("Recorded statistic", { exact: true })
      .fill("25 points (synthetic QA)");
    await edit.getByLabel('Settled at · Melbourne', { exact: true }).fill('2026-01-16T12:00');
    await edit.getByLabel('Actual cash payout · AUD', { exact: true }).fill('10.50');
    await edit.getByRole('button', { name: 'Review ledger update', exact: true }).click();
    assert(await edit.getByRole('button', { name: 'Confirm settlement / audited update', exact: true }).isDisabled());
    await edit.getByRole('checkbox').check();
    await edit.getByRole('button', { name: 'Confirm settlement / audited update', exact: true }).click();
    await edit.waitFor({ state: "hidden" });
    await page
      .getByRole("button", {
        name: "View details: QA Over 20.5 points",
        exact: true,
      })
      .click();
    await page.getByText("25 points (synthetic QA)", { exact: true }).waitFor();
    assert(await page.getByText("Audit history", { exact: true }).isVisible());
    assert(await page.getByText("+$5.50", { exact: true }).isVisible());
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('edgelab:demo:v1')).bets.find(bet => bet.legs[0].selection === 'QA Over 20.5 points'));
    assert.match(saved.notes, /QA-SYNTHETIC-TICKET-1/);
    assert.match(saved.notes, /recorded cash payout cents.*1050/);
  });
  await test("parlay individual leg settlement", async () => {
    await page.getByLabel("Search ledger").fill("");
    await page.getByRole("button", { name: "Record bet", exact: true }).click();
    let dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("Bookmaker", { exact: true })
      .fill("QA Synthetic Parlay");
    await dialog.getByLabel("Accepted decimal odds", { exact: true }).fill("3.80");
    await dialog.getByRole('button', { name: 'Placed earlier', exact: true }).click();
    await dialog.getByLabel('Placed at · Melbourne', { exact: true }).fill('2026-01-15T12:00');
    await dialog.getByRole("button", { name: "Add leg" }).click();
    for (let i = 0; i < 2; i++) {
      const field = dialog.locator("fieldset").nth(i);
      await field
        .getByLabel("Participant / team")
        .fill("QA Multi Player " + (i + 1));
      await field
        .getByLabel("Event", { exact: true })
        .fill("QA Multi Event " + (i + 1));
      await field.getByLabel("Exact market").fill("Player points");
      await field
        .getByLabel("Exact selection")
        .fill("QA Multi Over " + (i + 10) + ".5");
      await field.getByLabel("Line / threshold").fill(String(i + 10) + ".5");
      await field
        .getByLabel("Leg decimal odds")
        .fill(i === 0 ? "1.90" : "2.00");
    }
    const beforeReview = await page.evaluate(() => JSON.parse(localStorage.getItem('edgelab:demo:v1')));
    await dialog.getByRole('button', { name: 'Review financial registration', exact: true }).click();
    const confirm = dialog.getByRole('button', { name: 'Confirm financial registration', exact: true });
    assert(await confirm.isDisabled());
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('edgelab:demo:v1'))), beforeReview);
    await dialog.getByRole('checkbox').check();
    await confirm.click();
    await dialog.waitFor({ state: "hidden" });
    await page.getByLabel("Search ledger").fill("QA Multi");
    await page
      .getByRole("button", { name: "Edit QA Multi Over 10.5", exact: true })
      .click();
    dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("Bet outcome", { exact: true })
      .selectOption("lost");
    await dialog
      .locator("fieldset")
      .nth(0)
      .getByLabel("Leg outcome", { exact: true })
      .selectOption("won");
    await dialog
      .locator("fieldset")
      .nth(1)
      .getByLabel("Leg outcome", { exact: true })
      .selectOption("lost");
    await dialog.getByLabel('Settled at · Melbourne', { exact: true }).fill('2026-01-16T12:00');
    await dialog.getByLabel('Actual cash payout · AUD', { exact: true }).fill('0.00');
    await dialog.getByRole('button', { name: 'Review ledger update', exact: true }).click();
    await dialog.getByRole('checkbox').check();
    await dialog.getByRole('button', { name: 'Confirm settlement / audited update', exact: true }).click();
    await dialog.waitFor({ state: "hidden" });
    assert(
      await page
        .getByText("2-leg parlay · QA Multi Over 10.5", { exact: true })
        .isVisible(),
    );
  });
  await test('bonus payout reconciliation and cancelling a final financial review preserve actual totals', async () => {
    await route('/ledger');
    const before = await page.evaluate(() => JSON.parse(localStorage.getItem('edgelab:demo:v1')));
    async function enterBonus() {
      await page.getByRole('button', { name: 'Record bet', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByLabel('Bookmaker', { exact: true }).fill('QA SYNTHETIC BONUS');
      await dialog.getByLabel('Stake · AUD', { exact: true }).fill('5.00');
      await dialog.getByLabel('Stake type', { exact: true }).selectOption('bonus');
      await dialog.getByLabel('Accepted decimal odds', { exact: true }).fill('1.86');
      await dialog.getByRole('button', { name: 'Placed earlier', exact: true }).click();
    await dialog.getByLabel('Placed at · Melbourne', { exact: true }).fill('2026-01-15T12:00');
      await dialog.getByLabel('Participant / team', { exact: true }).fill('QA Bonus Player');
      await dialog.getByLabel('Event', { exact: true }).fill('QA Bonus fixture');
      await dialog.getByLabel('Exact market', { exact: true }).fill('Player points');
      await dialog.getByLabel('Exact selection', { exact: true }).fill('QA Bonus over 10.5');
      await dialog.getByLabel('Line / threshold', { exact: true }).fill('10.5');
      await dialog.getByLabel('Bet outcome', { exact: true }).selectOption('won');
      await dialog.getByLabel('Settled at · Melbourne', { exact: true }).fill('2026-01-16T12:00');
      return dialog;
    }
    let dialog = await enterBonus();
    await dialog.getByLabel('Actual cash payout · AUD', { exact: true }).fill('9.30');
    await dialog.getByRole('button', { name: 'Review financial registration', exact: true }).click();
    await dialog.getByText(/recorded cash payout does not match/).waitFor();
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('edgelab:demo:v1'))), before);
    await dialog.getByLabel('Actual cash payout · AUD', { exact: true }).fill('4.30');
    await dialog.getByRole('button', { name: 'Review financial registration', exact: true }).click();
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('edgelab:demo:v1'))), before);
    dialog = await enterBonus();
    await dialog.getByLabel('Actual cash payout · AUD', { exact: true }).fill('4.30');
    await dialog.getByRole('button', { name: 'Review financial registration', exact: true }).click();
    await dialog.getByRole('checkbox').check();
    await dialog.getByRole('button', { name: 'Confirm financial registration', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    const after = await page.evaluate(() => JSON.parse(localStorage.getItem('edgelab:demo:v1')));
    assert.equal(after.bets.length, before.bets.length + 1);
    assert.equal(after.bets[0].stakeType, 'bonus');
    assert.match(after.bets[0].notes, /recorded cash payout cents.*430/);
    assert.deepEqual(after.transactions, before.transactions);
  });
  await test("demo reload persistence", async () => {
    await page.reload();
    await page
      .getByText("Loading workspace…", { exact: true })
      .waitFor({ state: "hidden" });
    await page.getByLabel("Search ledger").fill("QA Multi");
    assert(
      await page
        .getByText("2-leg parlay · QA Multi Over 10.5", { exact: true })
        .isVisible(),
    );
  });
  await test("settings funding record and audit", async () => {
    await route("/settings");
    await page.getByLabel("Default experimental stake · AUD").fill("6.00");
    await page
      .getByRole("button", { name: "Save settings", exact: true })
      .click();
    await page
      .getByText(
        "Demo settings saved · change recorded in local audit history",
        { exact: false },
      )
      .waitFor();
    await page.getByLabel("Amount · AUD", { exact: true }).fill("10.00");
    await page.getByLabel("Note", { exact: true }).fill("QA synthetic funding");
    await page
      .getByRole("button", { name: "Add funding record", exact: true })
      .click();
    await page.getByText("QA synthetic funding", { exact: true }).waitFor();
  });
  await test("demo inbox preserves synthetic classification and performs no implicit research or financial writes", async () => {
    const before = await page.evaluate(() => JSON.parse(localStorage.getItem("edgelab:demo:v1")));
    await route("/research");
    await page.getByRole('heading', { name: 'Daily Research Inbox', exact: true }).waitFor();
    const after = await page.evaluate(() => JSON.parse(localStorage.getItem("edgelab:demo:v1")));
    assert(after.candidates.length > 0);
    assert(after.candidates.every(candidate => candidate.oddsProvenance.simulated));
    assert.deepEqual(after, before);
    assert.equal(externalRequests.length, 0);
  });
  await test("research detail and immutable paper registration", async () => {
    await openEligibleResearch('Add to paper tracking');
    await page.getByRole("dialog").waitFor();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Add to paper tracking", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "In paper tracking", exact: true })
      .waitFor();
    await page.keyboard.press("Escape");
    await route("/paper");
    assert(await page.getByRole("heading", { level: 1 }).isVisible());
  });

  await test("paper settlement preserves forecast and actual finance", async () => {
    await route("/paper");
    const before = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("edgelab:demo:v1")),
    );
    const target = before.paperPredictions[0];
    await page
      .getByRole("button", { name: "Outcome", exact: true })
      .first()
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Outcome", { exact: true }).selectOption("won");
    await dialog
      .getByLabel("Observed statistic / result notes")
      .fill("QA paper synthetic result");
    await dialog
      .getByRole("button", { name: "Save paper outcome", exact: true })
      .click();
    await dialog.waitFor({ state: "hidden" });
    const after = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("edgelab:demo:v1")),
    );
    assert.deepEqual(before.bets, after.bets);
    assert.deepEqual(before.transactions, after.transactions);
    assert.deepEqual(
      target.candidate,
      after.paperPredictions.find((p) => p.id === target.id).candidate,
    );
    assert.equal(
      after.paperPredictions.find((p) => p.id === target.id).outcome,
      "won",
    );
    assert(
      after.audit.some(
        (a) => a.entityId === target.id && a.entityType === "paper",
      ),
    );
  });
  await test("notification test read dismiss and history", async () => {
    await route("/notifications");
    const before = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("edgelab:demo:v1")),
    );
    await page
      .getByRole("button", { name: "Test Notification", exact: true })
      .click();
    await page
      .getByText("Simulated test notification created", { exact: false })
      .waitFor();
    let after = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("edgelab:demo:v1")),
    );
    assert.equal(after.notifications.length, before.notifications.length + 1);
    const created = after.notifications[0];
    assert(created.simulated);
    const article = page.locator("article").first();
    await article
      .getByRole("button", { name: "Research details", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor();
    assert(
      await dialog.getByText("Research rationale", { exact: true }).isVisible(),
    );
    assert(await dialog.getByText("Odds source", { exact: true }).isVisible());
    await page.keyboard.press("Escape");
    await page.waitForTimeout(100);
    after = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("edgelab:demo:v1")),
    );
    assert(after.notifications.find((n) => n.id === created.id).readAt);
    await page
      .locator("article")
      .first()
      .getByRole("button", { name: "Dismiss " + created.title, exact: true })
      .click();
    await page.locator(".panel").filter({ has: page.getByLabel("Search notifications", { exact: true }) }).getByRole("button", { name: "Dismissed", exact: true }).click();
    await page
      .getByRole("heading", { name: created.title, exact: true })
      .waitFor();
    after = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("edgelab:demo:v1")),
    );
    assert(after.notifications.find((n) => n.id === created.id).dismissedAt);
    await page
      .getByRole("button", { name: "Mark all read", exact: true })
      .click();
    await page.waitForTimeout(100);
    after = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("edgelab:demo:v1")),
    );
    assert(after.notifications.every((n) => n.readAt));
  });
  await test("research actual record needs manual confirmation", async () => {
    await route("/research");
    const before = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("edgelab:demo:v1")),
    );
    await openEligibleResearch('Record actual bet');
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Record actual bet", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByRole("heading", { name: "Record a manual bet", exact: true })
      .waitFor();
    assert(await dialog.getByLabel('Exact selection', { exact: true }).isDisabled());
    assert.equal(await dialog.getByLabel('Accepted decimal odds', { exact: true }).inputValue(), '');
    await dialog.getByLabel('Accepted decimal odds', { exact: true }).fill('2.10');
    await dialog.getByRole('button', { name: 'Placed just now', exact: true }).click();
    await dialog.getByRole('button', { name: 'Review financial registration', exact: true }).click();
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('edgelab:demo:v1'))), before);
    assert(await dialog.getByRole('button', { name: 'Confirm financial registration', exact: true }).isDisabled());
    await dialog.getByRole('checkbox').check();
    await dialog.getByRole('button', { name: 'Confirm financial registration', exact: true }).click();
    await page
      .getByRole("heading", { name: "Record a manual bet", exact: true })
      .waitFor({ state: "hidden" });
    const after = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("edgelab:demo:v1")),
    );
    assert.equal(after.bets.length, before.bets.length + 1);
    const created = after.bets[0];
    assert(created.confirmedAt);
    assert(created.probabilityProvenance);
    assert(created.oddsProvenance.simulated);
    assert.deepEqual(before.candidates, after.candidates);
    await page.keyboard.press("Escape");
  });
  await test("open-tab browser permission feature", async () => {
    await context.grantPermissions(["notifications"], { origin: baseUrl });
    await route("/settings");
    await page
      .getByRole("button", {
        name: "Enable browser notifications",
        exact: true,
      })
      .click();
    await page.getByText("Permission: granted", { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => Notification.permission), "granted");
  });
  await test("all mobile routes have no document overflow", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of [
      "/",
      "/ledger",
      "/research",
      "/paper",
      "/analytics",
      "/notifications",
      "/settings",
    ]) {
      await route(path);
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        path + " document overflows",
      );
    }
  });

  await test("mobile layout", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await route("/");
    await page.screenshot({
      path: path.join(artifacts, "mobile.png"),
      fullPage: true,
    });
    assert(
      await page
        .getByRole("button", { name: "Toggle navigation", exact: true })
        .isVisible(),
    );
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    );
    await page
      .getByRole("button", { name: "Toggle navigation", exact: true })
      .click();
    assert(
      await page
        .getByRole("link", { name: "Betting Ledger", exact: true })
        .isVisible(),
    );
    await page
      .getByRole("link", { name: "Betting Ledger", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Betting ledger", exact: true })
      .waitFor();
    await page.setViewportSize({ width: 1440, height: 1100 });
  });
  await test("no browser runtime exceptions or external requests", async () => {
    assert.deepEqual(errors, []); assert.deepEqual(externalRequests, []);
  });
  fs.writeFileSync(
    path.join(artifacts, "results.json"),
    JSON.stringify({ scope: "Fresh synthetic Demo browser only; external requests blocked; no hosted data or personal session", results, errors, externalRequests }, null, 2),
  );
  await browser.close();
  if (results.some((r) => !r.passed)) process.exitCode = 1;
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
