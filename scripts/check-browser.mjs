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
  await test("manual bet confirmation and audited settlement", async () => {
    await route("/ledger");
    await page.getByRole("button", { name: "Record bet", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("Bookmaker", { exact: true })
      .fill("QA Synthetic Bookmaker");
    await dialog.getByLabel("Stake · AUD", { exact: true }).fill("5.00");
    await dialog.getByLabel("Decimal odds", { exact: true }).fill("2.10");
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
    await dialog.getByRole("checkbox").check();
    await dialog.getByRole("button", { name: "Confirm & record bet" }).click();
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
    await edit.getByRole("button", { name: "Save audited changes" }).click();
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
  });
  await test("parlay individual leg settlement", async () => {
    await page.getByLabel("Search ledger").fill("");
    await page.getByRole("button", { name: "Record bet", exact: true }).click();
    let dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("Bookmaker", { exact: true })
      .fill("QA Synthetic Parlay");
    await dialog.getByLabel("Decimal odds", { exact: true }).fill("3.80");
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
    await dialog.getByRole("checkbox").check();
    await dialog.getByRole("button", { name: "Confirm & record bet" }).click();
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
    await dialog.getByRole("button", { name: "Save audited changes" }).click();
    await dialog.waitFor({ state: "hidden" });
    assert(
      await page
        .getByText("2-leg parlay · QA Multi Over 10.5", { exact: true })
        .isVisible(),
    );
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
        "Experiment settings saved · change recorded in audit history",
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
  await test("run simulated daily research", async () => {
    await route("/research");
    const before = await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("edgelab:demo:v1")).researchRuns.length,
    );
    await page
      .getByRole("button", { name: "Run Daily Research", exact: true })
      .click();
    await page.getByText(/Simulation complete/).waitFor({ timeout: 20000 });
    const after = await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("edgelab:demo:v1")).researchRuns.length,
    );
    assert.equal(after, before + 1);
  });
  await test("research detail and immutable paper registration", async () => {
    await page
      .getByRole("button", { name: "Review", exact: false })
      .first()
      .click();
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
    await page.getByRole("button", { name: "Dismissed", exact: true }).click();
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
    await page
      .getByRole("button", { name: "Review", exact: false })
      .first()
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Record actual bet", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByRole("heading", { name: "Record a manual bet", exact: true })
      .waitFor();
    assert(!(await dialog.getByRole("checkbox").isChecked()));
    assert(
      await dialog.getByLabel("Exact selection", { exact: true }).isDisabled(),
    );
    await dialog.getByRole("checkbox").check();
    await dialog
      .getByRole("button", { name: "Confirm & record bet", exact: true })
      .click();
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
  await test("no browser runtime exceptions", async () =>
    assert.deepEqual(errors, []));
  fs.writeFileSync(
    path.join(artifacts, "results.json"),
    JSON.stringify({ results, errors }, null, 2),
  );
  await browser.close();
  if (results.some((r) => !r.passed)) process.exitCode = 1;
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
