#!/usr/bin/env node
/**
 * Browser-only Auth/form regression checks. Every non-local request is intercepted;
 * all Auth responses, accounts and bookkeeping records exist only in memory.
 * No hosted project is contacted and no credentials are requested or loaded.
 * Requires an already installed Playwright runtime and Chrome (no new dependency).
 */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const option = (name) => {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
};
const app = new URL(option("--app-url") ?? "http://localhost:3000");
if (app.protocol !== "http:" || !["localhost", "127.0.0.1", "[::1]"].includes(app.hostname))
  throw new Error("Only a local development server is supported.");
const runtime = option("--browser-runtime");
if (!runtime) throw new Error("Supply --browser-runtime with an existing Playwright installation.");
const requireRuntime = createRequire(path.join(path.resolve(runtime), "package.json"));
const { chromium } = requireRuntime("playwright");
const publicEnvironment = await readFile(".env.local", "utf8");
const configuredUrl = publicEnvironment.match(/^NEXT_PUBLIC_SUPABASE_URL\s*=\s*["']?([^\s"']+)/m)?.[1];
if (!configuredUrl) throw new Error("Public Supabase URL configuration is required; no keys are read.");
const supabase = new URL(configuredUrl);
const authKey = `sb-${supabase.hostname.split(".")[0]}-auth-token`;
const id = "10000000-0000-4000-8000-000000000001";
const email = "synthetic-browser-test@example.invalid";
const user = {
  id, email, aud: "authenticated", role: "authenticated",
  app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {},
  created_at: "2026-01-01T00:00:00Z", email_confirmed_at: "2026-01-01T00:01:00Z",
};
const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const session = (expired = false) => {
  const expiresAt = Math.floor(Date.now() / 1000) + (expired ? -60 : 3600);
  return {
    access_token: `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: id, role: "authenticated", exp: expiresAt })}.synthetic-not-a-real-credential`,
    refresh_token: "synthetic-browser-refresh-only", token_type: "bearer",
    expires_in: 3600, expires_at: expiresAt, user,
  };
};
const empty = () => ({
  version: 1,
  settings: { fundingCapCents: 50000, defaultStakeCents: 500, currency: "AUD", timezone: "Australia/Melbourne" },
  bets: [], transactions: [], candidates: [], paperPredictions: [], notifications: [], researchRuns: [], audit: [],
});
const results = [];
let step = "starting";
const unexpectedRequests = [];
const runtimeErrors = [];
const browser = await chromium.launch({
  headless: true,
  executablePath: option("--browser") ?? (process.platform === "darwin" ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : undefined),
});
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
let stored = empty();
let revision = 0;
let failSave = false;
let revoked = false;
let confirmEmail = false;
let refreshes = 0;
let successfulSaves = 0;
let signupRedirect;
let logoutScope;
const endpointCounts = new Map();
await context.route("**/*", async (route) => {
  const request = route.request();
  const url = new URL(request.url());
  // This is the only passthrough. No request to a configured hosted service leaves the test.
  if (url.origin === app.origin) return route.continue();
  if (url.origin !== supabase.origin) {
    unexpectedRequests.push({ origin: url.origin, path: url.pathname });
    return route.abort("blockedbyclient");
  }
  const endpoint = url.pathname;
  endpointCounts.set(endpoint, (endpointCounts.get(endpoint) ?? 0) + 1);
  const body = request.postDataJSON() ?? {};
  const send = (value, status = 200) => route.fulfill({
    status, contentType: "application/json",
    headers: {
      "X-Supabase-Api-Version": "2024-01-01",
      "Access-Control-Allow-Origin": app.origin,
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    },
    ...(status === 204 ? {} : { body: JSON.stringify(value) }),
  });
  if (request.method() === "OPTIONS") return send(null, 204);
  if (endpoint === "/auth/v1/signup") {
    signupRedirect = url.searchParams.get("redirect_to");
    assert.equal(body.email, email);
    return send({ ...user, email_confirmed_at: null });
  }
  if (endpoint === "/auth/v1/token") {
    if (url.searchParams.get("grant_type") === "refresh_token") {
      refreshes++;
      return revoked
        ? send({ error_code: "refresh_token_not_found", message: "Synthetic revoked refresh" }, 400)
        : send(session());
    }
    return confirmEmail
      ? send(session())
      : send({ error_code: "email_not_confirmed", message: "Synthetic confirmation required" }, 400);
  }
  if (endpoint === "/auth/v1/user") {
    return revoked
      ? send({ error_code: "session_not_found", message: "Synthetic revoked session" }, 401)
      : send(user);
  }
  if (endpoint === "/auth/v1/logout") {
    logoutScope = url.searchParams.get("scope");
    return send(null, 204);
  }
  if (endpoint === "/rest/v1/rpc/edgelab_load_workspace")
    return send({ revision, workspace: stored });
  if (endpoint === "/rest/v1/rpc/edgelab_save_workspace") {
    if (failSave) return send({ code: "P0001", message: "Synthetic save failure; retry retained draft" }, 400);
    assert.equal(body.expected_revision, revision);
    assert.equal(body.workspace.candidates.length, 0);
    assert.equal(body.workspace.paperPredictions.length, 0);
    assert.equal(body.workspace.bets.length, 0);
    assert.equal(body.workspace.researchRuns.length, 0);
    stored = structuredClone(body.workspace);
    successfulSaves++;
    return send(++revision);
  }
  // A prepared import migration is intentionally not assumed to be deployed.
  if (endpoint.startsWith("/rest/v1/rpc/edgelab_") && (endpoint.includes("import") || endpoint.includes("history")))
    return send({ code: "PGRST202", message: "Synthetic prepared migration not deployed" }, 404);
  unexpectedRequests.push({ origin: "intercepted-supabase", path: endpoint });
  return route.abort("blockedbyclient");
});
const page = await context.newPage();
page.on("pageerror", () => runtimeErrors.push("Browser runtime exception"));
async function check(name, run) {
  step = name;
  try {
    await run();
    results.push({ name, passed: true });
    process.stdout.write(`PASS ${name}\n`);
  } catch {
    // Avoid locator/error output which could include form contents in future runs.
    results.push({ name, passed: false, error: `Local browser assertion failed at ${step}; no form contents were recorded.` });
    process.stdout.write(`FAIL ${name}\n`);
    throw new Error("Browser verification stopped after the failed check.");
  }
}
async function settings() {
  const response = await page.goto(new URL("/settings", app).toString());
  assert.equal(response.status(), 200);
  await page.getByRole("heading", { name: "Settings", exact: true }).waitFor();
  await page.getByText("Loading workspace…", { exact: true }).waitFor({ state: "hidden" });
}
let demoBefore;
let exitCode = 0;
try {
  await check("signup keeps confirmation pending and uses the fixed local callback", async () => {
    step = "load settings";
    await settings();
    step = "capture demo";
    demoBefore = await page.evaluate(() => localStorage.getItem("edgelab:demo:v1"));
    assert(JSON.parse(demoBefore).bets.length > 0);
    step = "select private workspace";
    await page.getByRole("button", { name: /Private workspace/ }).click();
    await page.getByText("No funding records yet.", { exact: true }).waitFor();
    step = "toggle or submit signup";
    await page.getByRole("button", { name: "Create account", exact: true }).click();
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill("synthetic-browser-password-only");
    step = "toggle or submit signup";
    await page.getByRole("button", { name: "Create account", exact: true }).click();
    step = "pending confirmation message";
    await page.getByRole("status").filter({ hasText: "Check your email to confirm your account, then sign in here." }).waitFor();
    step = "fixed callback redirect";
    assert.equal(signupRedirect, new URL("/auth/callback", app).toString());
    step = "password cleared";
    assert.equal(await page.getByLabel("Password", { exact: true }).inputValue(), "");
    step = "session cleared";
    assert.equal(await page.evaluate((key) => localStorage.getItem(key), authKey), null);
    assert.equal(successfulSaves, 0);
  });
  await check("unconfirmed sign-in fails safely and confirmed sign-in opens an empty private workspace", async () => {
    await page.getByRole("button", { name: "Use existing account", exact: true }).click();
    await page.getByLabel("Password", { exact: true }).fill("synthetic-browser-password-only");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.getByText("Confirm your email before signing in.", { exact: true }).waitFor();
    step = "password cleared";
    assert.equal(await page.getByLabel("Password", { exact: true }).inputValue(), "");
    confirmEmail = true;
    await page.getByLabel("Password", { exact: true }).fill("synthetic-browser-password-only");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.getByText("Signed in with Supabase", { exact: true }).waitFor();
    await page.getByText("No funding records yet.", { exact: true }).waitFor();
    assert.equal(stored.bets.length, 0);
    assert.equal(await page.evaluate(() => localStorage.getItem("edgelab:demo:v1")), demoBefore);
  });
  await check("failed authenticated funding submission retains its draft and does not publish a financial record", async () => {
    failSave = true;
    await page.getByLabel("Amount · AUD", { exact: true }).fill("5.00");
    await page.getByLabel("Note", { exact: true }).fill("SYNTHETIC AUTH FORM CHECK — no money moved");
    await page.getByRole("button", { name: "Add funding record", exact: true }).click();
    await page.getByText(/Synthetic save failure; retry retained draft/).waitFor();
    assert.equal(await page.getByLabel("Amount · AUD", { exact: true }).inputValue(), "5.00");
    assert.equal(stored.transactions.length, 0);
    await page.getByText("No funding records yet.", { exact: true }).waitFor();
    assert.equal(successfulSaves, 0);
  });
  await check("retrying the authenticated form persists exactly once and survives browser refresh", async () => {
    failSave = false;
    await page.getByRole("button", { name: "Add funding record", exact: true }).click();
    await page.getByText("SYNTHETIC AUTH FORM CHECK — no money moved", { exact: true }).waitFor();
    assert.equal(await page.getByLabel("Amount · AUD", { exact: true }).inputValue(), "");
    assert.equal(stored.transactions.length, 1);
    assert.equal(stored.transactions[0].amountCents, 500);
    assert.equal(successfulSaves, 1);
    await page.reload();
    await page.getByText("Signed in with Supabase", { exact: true }).waitFor();
    await page.getByText("SYNTHETIC AUTH FORM CHECK — no money moved", { exact: true }).waitFor();
    assert.equal(successfulSaves, 1);
    assert.equal(await page.evaluate(() => localStorage.getItem("edgelab:demo:v1")), demoBefore);
  });
  await check("local logout clears private UI and browser tokens while restoring isolated demo records", async () => {
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await page.getByText("DEMO MODE", { exact: true }).waitFor();
    await page.getByRole("heading", { name: "Sign in to private storage", exact: true }).waitFor();
    assert.equal(logoutScope, "local");
    step = "session cleared";
    assert.equal(await page.evaluate((key) => localStorage.getItem(key), authKey), null);
    assert.equal(await page.getByText("SYNTHETIC AUTH FORM CHECK — no money moved", { exact: true }).count(), 0);
    assert.equal(await page.evaluate(() => localStorage.getItem("edgelab:demo:v1")), demoBefore);
  });
  await check("a browser reload refreshes a genuinely expired session before reading private data", async () => {
    await page.evaluate(({ key, seed }) => {
      localStorage.setItem(key, JSON.stringify(seed));
      localStorage.setItem("edgelab:workspace", "supabase");
    }, { key: authKey, seed: session(true) });
    await page.reload();
    await page.getByText("Signed in with Supabase", { exact: true }).waitFor();
    await page.getByText("SYNTHETIC AUTH FORM CHECK — no money moved", { exact: true }).waitFor();
    assert.equal(refreshes, 1);
    const recovered = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), authKey);
    assert(recovered.expires_at > Math.floor(Date.now() / 1000));
  });
  await check("revoked browser sessions fail closed without submitting a stale authenticated form", async () => {
    revoked = true;
    const savedBefore = successfulSaves;
    await page.getByLabel("Amount · AUD", { exact: true }).fill("1.00");
    await page.getByRole("button", { name: "Add funding record", exact: true }).click();
    await page.getByRole("heading", { name: "Sign in to private storage", exact: true }).waitFor();
    assert.equal(successfulSaves, savedBefore);
    assert.equal(stored.transactions.length, 1);
    assert.equal(await page.getByText("SYNTHETIC AUTH FORM CHECK — no money moved", { exact: true }).count(), 0);
    step = "session cleared";
    assert.equal(await page.evaluate((key) => localStorage.getItem(key), authKey), null);
    assert.equal(await page.evaluate(() => localStorage.getItem("edgelab:demo:v1")), demoBefore);
  });
  await check("failed authentication callbacks clear URL parameters and show controlled errors", async () => {
    await page.goto(new URL("/auth/callback?error=access_denied&error_description=SYNTHETIC_UNTRUSTED_CALLBACK#access_token=synthetic-never-a-token", app).toString());
    await page.getByRole("heading", { name: "Authentication needs attention", exact: true }).waitFor();
    assert.equal(page.url(), new URL("/auth/callback", app).toString());
    const text = await page.locator("body").innerText();
    assert(!text.includes("SYNTHETIC_UNTRUSTED_CALLBACK"));
    assert(!text.includes("synthetic-never-a-token"));
    assert(text.includes("This authentication link is invalid or could not be completed."));
  });
  await check("no external requests or browser runtime exceptions escaped the isolated transport", async () => {
    assert.deepEqual(unexpectedRequests, []);
    assert.deepEqual(runtimeErrors, []);
  });
} catch {
  exitCode = 1;
} finally {
  await context.close();
  await browser.close();
  const report = {
    mode: "local browser with intercepted Supabase Auth and RPC responses; no hosted checks",
    createdAt: new Date().toISOString(), results, unexpectedRequests, runtimeErrors,
    interceptedEndpoints: [...endpointCounts.entries()],
    interceptedAuthRequests: [...endpointCounts.entries()].filter(([endpoint]) => endpoint.startsWith("/auth/")).reduce((sum, [, count]) => sum + count, 0),
    mockedSuccessfulSaves: successfulSaves,
  };
  if (option("--report")) await writeFile(option("--report"), JSON.stringify(report, null, 2));
}
process.exitCode = exitCode;
