#!/usr/bin/env node
// Explicit, opt-in hosted checks using two NEW dedicated normal Auth users.
// No service-role key, management token, password file or auth.users SQL is used.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { createClient } from "@supabase/supabase-js";

const TABLES = [
  "user_profiles",
  "experiment_settings",
  "sports",
  "events",
  "model_versions",
  "research_candidates",
  "bets",
  "bet_legs",
  "financial_transactions",
  "paper_predictions",
  "odds_snapshots",
  "notifications",
  "research_runs",
  "audit_history",
];
const option = (name) => {
  const i = process.argv.indexOf(name);
  return i < 0 ? undefined : process.argv[i + 1];
};
const projectRef = option("--project-ref");
const reportPath = option("--report");
const browserRuntime = option("--browser-runtime");
const browserExecutable =
  option("--browser") ??
  (process.platform === "darwin"
    ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    : undefined);
const applicationUrl = option("--app-url") ?? "http://localhost:3000";
class CheckFailure extends Error {}
const fail = (message) => {
  throw new CheckFailure(message);
};
function publicFailure(error) {
  if (error instanceof CheckFailure) return error.message;
  if (error instanceof assert.AssertionError)
    return "A security or persistence assertion failed; inspect this check before continuing.";
  return "The check could not complete. No credentials or response bodies are printed.";
}
function apiOk(response, operation) {
  if (response.error) {
    const code = /^[a-zA-Z0-9_]+$/.test(response.error.code ?? "")
      ? ` (${response.error.code})`
      : "";
    fail(`${operation} failed${code}.`);
  }
  return response.data;
}
const now = () => new Date().toISOString();
const clone = (value) => structuredClone(value);
function emptyWorkspace() {
  return {
    version: 1,
    settings: {
      fundingCapCents: 50000,
      defaultStakeCents: 500,
      currency: "AUD",
      timezone: "Australia/Melbourne",
    },
    bets: [],
    transactions: [],
    candidates: [],
    paperPredictions: [],
    notifications: [],
    researchRuns: [],
    audit: [],
  };
}
function clientFor(url, key, storage) {
  return createClient(url, key, {
    auth: {
      persistSession: !!storage,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      debug: false,
      ...(storage
        ? {
            storage: {
              getItem: (name) => storage.get(name) ?? null,
              setItem: (name, value) => storage.set(name, value),
              removeItem: (name) => storage.delete(name),
            },
          }
        : {}),
    },
  });
}
/** Syntax only: reserved .invalid domains are valid for confirmed test users. */
export function isTestAccountEmail(value) {
  if (typeof value !== "string") return false;
  const email = value.trim();
  return (
    email.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)
  );
}
async function publicConfiguration() {
  if (!projectRef || !/^[a-z]{20}$/.test(projectRef))
    fail("Supply the exact --project-ref for the hosted project.");
  const source = await readFile(path.resolve(".env.local"), "utf8").catch(() =>
    fail("The ignored .env.local public configuration is missing."),
  );
  const values = {};
  for (const line of source.split(/\r?\n/)) {
    const match =
      /^(NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY|NEXT_PUBLIC_SUPABASE_ANON_KEY)\s*=\s*(.*)$/.exec(
        line.trim(),
      );
    if (match)
      values[match[1]] = match[2].replace(/^(["'])(.*)\1$/, "$2").trim();
  }
  const url = values.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    values.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    values.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    fail("The public Supabase URL is invalid.");
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.host !== `${projectRef}.supabase.co` ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  )
    fail(
      "Project reference and .env.local URL do not match; no authentication was attempted.",
    );
  if (!key || key.startsWith("sb_secret_"))
    fail("Only a public publishable or legacy anon key is accepted.");
  if (!key.startsWith("sb_publishable_")) {
    let role;
    try {
      role = JSON.parse(
        Buffer.from(key.split(".")[1], "base64url").toString(),
      ).role;
    } catch {
      fail(
        "The configured public key is not a publishable or legacy anon key.",
      );
    }
    if (role !== "anon")
      fail("Privileged or unknown API keys are prohibited in this harness.");
  }
  return { url: parsed.origin, key };
}
async function credentialsFromTerminal() {
  if (!process.stdin.isTTY || !process.stdout.isTTY)
    fail(
      "Run this command in your own interactive terminal. Passwords must never be passed in command arguments, chat or files.",
    );
  let muted = true;
  const output = new Writable({
    write(chunk, encoding, done) {
      if (!muted) process.stdout.write(chunk, encoding);
      done();
    },
  });
  const terminal = createInterface({
    input: process.stdin,
    output,
    terminal: true,
    historySize: 0,
  });
  const ask = (prompt, hidden = true) =>
    new Promise((resolve, reject) => {
      const cancelled = () =>
        reject(new CheckFailure("Terminal input ended before authentication. No application records were written."));
      terminal.once("close", cancelled);
      muted = false;
      terminal.question(prompt, (answer) => {
        terminal.off("close", cancelled);
        muted = true;
        if (hidden) process.stdout.write("\n");
        resolve(answer);
      });
      muted = hidden;
    });
  const askEmail = async (label, otherEmail) => {
    while (true) {
      const email = (
        await ask(`Account ${label} email (.invalid supported; input visible): `, false)
      ).trim();
      if (!email) continue;
      if (!isTestAccountEmail(email)) {
        process.stdout.write(
          `Account ${label} email has invalid syntax. Enter one address without labels or spaces; @example.invalid is supported.\n`,
        );
        continue;
      }
      if (email.toLowerCase() === otherEmail?.toLowerCase()) {
        process.stdout.write("Use the other dedicated test account, not the same email twice.\n");
        continue;
      }
      return email;
    }
  };
  const askPassword = async (label) => {
    while (true) {
      const password = await ask(`Account ${label} password (hidden): `);
      if (password) return password;
      process.stdout.write(`Account ${label} password was empty. Enter it at the hidden prompt and press Enter once.\n`);
    }
  };
  try {
    const a = {
      email: await askEmail("A"),
      password: await askPassword("A"),
    };
    const b = {
      email: await askEmail("B", a.email),
      password: await askPassword("B"),
    };
    if (
      !a.password ||
      !b.password ||
      a.email.toLowerCase() === b.email.toLowerCase()
    )
      fail(
        "Two distinct dedicated accounts and their ordinary passwords are required.",
      );
    return { a, b };
  } finally {
    terminal.close();
    muted = false;
  }
}
async function load(client) {
  const data = apiOk(
    await client.rpc("edgelab_load_workspace"),
    "Workspace load",
  );
  assert(data && Number.isSafeInteger(Number(data.revision)));
  return { revision: Number(data.revision), workspace: data.workspace };
}
async function save(client, snapshot, revision) {
  const next = apiOk(
    await client.rpc("edgelab_save_workspace", {
      workspace: snapshot,
      expected_revision: revision,
    }),
    "Workspace save",
  );
  assert.equal(Number(next), revision + 1);
  return Number(next);
}
async function signIn(client, credentials) {
  const data = apiOk(
    await client.auth.signInWithPassword(credentials),
    "Password sign-in",
  );
  assert(data.user && data.session);
  const claims = JSON.parse(
    Buffer.from(
      data.session.access_token.split(".")[1],
      "base64url",
    ).toString(),
  );
  assert.equal(claims.role, "authenticated");
  assert.equal(claims.sub, data.user.id);
  const verified = apiOk(
    await client.auth.getUser(),
    "Authenticated user verification",
  );
  assert.equal(verified.user?.id, data.user.id);
  assert(verified.user?.email_confirmed_at);
  return data.user.id;
}
function manualWorkspace(marker, label) {
  const value = emptyWorkspace();
  const timestamp = now();
  const bet = {
    id: randomUUID(),
    placedAt: timestamp,
    bookmaker: "INTEGRATION TEST ONLY - no wager",
    stakeCents: 500,
    stakeType: "cash",
    odds: 1.9,
    outcome: "pending",
    strategy: "C",
    notes: `${marker} ${label}: synthetic manual bookkeeping verification only. No real event or wager.`,
    confirmedAt: timestamp,
    legs: [
      {
        id: randomUUID(),
        sport: "NBA",
        event: `${marker} fictional verification event ${label}`,
        participant: "TEST PARTICIPANT - no real player",
        market: "Manual integration verification",
        selection: "TEST ENTRY ONLY - no wager",
        line: "N/A",
        odds: 1.9,
        outcome: "pending",
      },
    ],
  };
  value.bets.push(bet);
  value.transactions.push({
    id: randomUUID(),
    kind: "deposit",
    amountCents: 1000,
    createdAt: timestamp,
    note: `${marker} synthetic bookkeeping only; no money transferred`,
  });
  value.audit.push({
    id: randomUUID(),
    entityType: "bet",
    entityId: bet.id,
    action: "created_integration_test_record",
    timestamp,
    before: null,
    after: clone(bet),
  });
  value.settings.defaultStakeCents = 600;
  return value;
}
async function fresh(client) {
  const result = await load(client);
  if (result.workspace !== null || result.revision !== 0)
    fail(
      "A test account already has a workspace. Aborting before any application writes; create two new dedicated test accounts.",
    );
  for (const table of TABLES) {
    const rows = apiOk(
      await client.from(table).select("*").limit(1),
      "Fresh-account ownership check",
    );
    if (rows.length)
      fail(
        "A test account already owns application records. Aborting before any application writes.",
      );
  }
}
async function browserVerification({ url, key, credentials, marker, check }) {
  let app;
  try {
    app = new URL(applicationUrl);
  } catch {
    fail("The app URL is invalid.");
  }
  if (
    app.protocol !== "http:" ||
    !["localhost", "127.0.0.1"].includes(app.hostname) ||
    app.pathname !== "/" ||
    app.search ||
    app.hash ||
    app.username ||
    app.password
  )
    fail("Browser verification only accepts a local HTTP app URL.");
  const { chromium } = createRequire(
    path.resolve(browserRuntime, "package.json"),
  )("playwright");
  const browser = await chromium.launch({
    executablePath: browserExecutable,
    headless: true,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: "en-AU",
    timezoneId: "Australia/Melbourne",
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  let runtimeErrors = 0;
  let rejectedAuthTarget = false;
  page.on("pageerror", () => {
    runtimeErrors++;
  });
  await page.route("**/auth/v1/**", async (route) => {
    const request = route.request();
    if (
      new URL(request.url()).origin !== url ||
      (request.method() !== "OPTIONS" && request.headers().apikey !== key)
    ) {
      rejectedAuthTarget = true;
      await route.abort();
    } else await route.continue();
  });
  let demoBefore;
  const open = async (route) => {
    await page.goto(app.origin + route);
    await page.getByRole("heading", { level: 1 }).waitFor();
  };
  const registeredEvent = `${marker} fictional verification event A`;
  try {
    await check(
      "Browser Settings sign-in opens the correct private workspace",
      async () => {
        await open("/settings");
        const privateOption = page.getByRole("button", {
          name: /Private workspace Supabase Auth/,
        });
        assert(await privateOption.isEnabled());
        demoBefore = await page.evaluate(() =>
          JSON.parse(localStorage.getItem("edgelab:demo:v1")),
        );
        await page
          .getByLabel("Email", { exact: true })
          .fill(credentials.a.email);
        await page
          .getByLabel("Password", { exact: true })
          .fill(credentials.a.password);
        await page
          .getByRole("button", { name: "Sign in", exact: true })
          .click();
        await page.getByText("PRIVATE WORKSPACE", { exact: true }).waitFor();
        await page
          .getByText("Signed in with Supabase", { exact: true })
          .waitFor();
        assert.equal(rejectedAuthTarget, false);
        await open("/ledger");
        await page
          .locator("tbody")
          .getByText(registeredEvent, { exact: true })
          .waitFor();
      },
    );
    await check(
      "Authenticated browser reload restores the saved ledger and session",
      async () => {
        await page.reload();
        await page
          .getByRole("heading", { name: "Betting ledger", exact: true })
          .waitFor();
        await page.getByText("PRIVATE WORKSPACE", { exact: true }).waitFor();
        await page
          .locator("tbody")
          .getByText(registeredEvent, { exact: true })
          .waitFor();
      },
    );
    await check(
      "Switching browser workspaces retains the original demo snapshot",
      async () => {
        await open("/settings");
        await page
          .getByRole("button", { name: /Demo workspace Synthetic fixtures/ })
          .click();
        await page.getByText("DEMO MODE", { exact: true }).waitFor();
        const demoAfter = await page.evaluate(() =>
          JSON.parse(localStorage.getItem("edgelab:demo:v1")),
        );
        assert.deepEqual(demoAfter, demoBefore);
        await page
          .getByRole("button", { name: /Private workspace Supabase Auth/ })
          .click();
        await page.getByText("PRIVATE WORKSPACE", { exact: true }).waitFor();
        await page
          .getByText("Signed in with Supabase", { exact: true })
          .waitFor();
      },
    );
    await check(
      "Browser logout clears private visibility without removing demo data",
      async () => {
        await page
          .getByRole("button", { name: "Sign out", exact: true })
          .click();
        await page.getByText("DEMO MODE", { exact: true }).waitFor();
        await page
          .getByRole("button", { name: "Sign in", exact: true })
          .waitFor();
        assert.deepEqual(
          await page.evaluate(() =>
            JSON.parse(localStorage.getItem("edgelab:demo:v1")),
          ),
          demoBefore,
        );
        await page
          .getByRole("button", { name: /Private workspace Supabase Auth/ })
          .click();
        await page.getByText("PRIVATE WORKSPACE", { exact: true }).waitFor();
        await open("/ledger");
        await page
          .getByText("Sign in to load your private workspace.", { exact: true })
          .waitFor();
        assert.equal(
          await page
            .locator("tbody")
            .getByText(registeredEvent, { exact: true })
            .count(),
          0,
        );
        assert.equal(runtimeErrors, 0);
        assert.equal(rejectedAuthTarget, false);
      },
    );
  } finally {
    await browser.close();
  }
}

async function main() {
  if (!process.argv.includes("--confirm-test-writes")) {
    console.log(
      "Usage: node scripts/check-hosted-access.mjs --project-ref <project-ref> --confirm-test-writes [--report <new-file.json>] [--browser-runtime <temporary Playwright prefix>]",
    );
    console.log(
      "Create two NEW confirmed Auth users in the Dashboard first: edgelab-test-a-<unique>@example.com and edgelab-test-b-<unique>@example.com. Use private passwords; no emails are sent by this harness. It retains clearly labelled test bookkeeping records and never deletes existing data.",
    );
    return;
  }
  if (
    ["DEBUG", "PWDEBUG", "NODE_DEBUG", "NODE_DEBUG_NATIVE"].some(
      (name) => process.env[name],
    )
  )
    fail(
      "Unset debug/tracing environment options before running a credential verification command.",
    );
  const { url, key } = await publicConfiguration();
  console.log(
    `Target project: ${projectRef}. This run uses public-key password grants and retains new test records.`,
  );
  let credentials = await credentialsFromTerminal();
  const marker = `EDGELAB HOSTED CHECK ${randomUUID()}`;
  const storageA = new Map();
  const storageB = new Map();
  const anonymous = clientFor(url, key);
  const a = clientFor(url, key, storageA);
  const b = clientFor(url, key, storageB);
  const clients = [a, b];
  const results = [];
  let writesStarted = false;
  const check = async (name, operation) => {
    try {
      await operation();
      results.push({ name, passed: true });
      console.log(`PASS ${name}`);
    } catch (error) {
      const message = publicFailure(error);
      results.push({ name, passed: false, message });
      console.error(`FAIL ${name}: ${message}`);
      throw new CheckFailure(
        "Hosted verification stopped at the first failed check.",
      );
    }
  };
  let idA;
  let idB;
  let initialA;
  let initialB;
  try {
    await check(
      "Unauthenticated RPC and private-table access denied",
      async () => {
        const response = await anonymous.rpc("edgelab_load_workspace");
        assert(response.error);
        for (const table of TABLES) {
          const queried = await anonymous.from(table).select("*").limit(1);
          assert(queried.error);
          assert.equal(queried.data, null);
        }
      },
    );
    await check(
      "Two distinct password grants issue normal authenticated JWTs",
      async () => {
        idA = await signIn(a, credentials.a);
        idB = await signIn(b, credentials.b);
        assert.notEqual(idA, idB);
      },
    );
    await check(
      "Both accounts are completely empty before application writes",
      async () => {
        await fresh(a);
        await fresh(b);
      },
    );
    initialA = manualWorkspace(marker, "A");
    initialB = manualWorkspace(marker, "B");
    await check(
      "Manual ledger, funding and settings save and round-trip",
      async () => {
        writesStarted = true;
        await save(a, initialA, 0);
        await save(b, initialB, 0);
        for (const [client, expected] of [
          [a, initialA],
          [b, initialB],
        ]) {
          const saved = await load(client);
          assert.equal(saved.revision, 1);
          assert.deepEqual(saved.workspace.bets, expected.bets);
          assert.deepEqual(saved.workspace.transactions, expected.transactions);
          assert.deepEqual(saved.workspace.settings, expected.settings);
        }
        const betRows = apiOk(
          await a.from("bets").select("stake,decimal_odds,outcome"),
          "Typed financial projection",
        );
        assert.equal(Number(betRows[0].stake), 5);
        assert.equal(Number(betRows[0].decimal_odds), 1.9);
        const fundingRows = apiOk(
          await a.from("financial_transactions").select("amount"),
          "Typed funding projection",
        );
        assert.equal(Number(fundingRows[0].amount), 10);
      },
    );
    await check(
      "Each user sees only their own records across every user table",
      async () => {
        for (const [client, otherId] of [
          [a, idB],
          [b, idA],
        ])
          for (const table of TABLES) {
            const rows = apiOk(
              await client
                .from(table)
                .select("*")
                .eq(table === "user_profiles" ? "id" : "user_id", otherId),
              "Cross-account read probe",
            );
            assert.equal(rows.length, 0);
          }
      },
    );
    await check(
      "Cross-account modification and ownership forgery rejected",
      async () => {
        const edited = {
          ...clone(initialA.bets[0]),
          notes: "This cross-account edit must never be saved.",
        };
        const response = await b
          .from("bets")
          .update({ payload: edited })
          .eq("id", edited.id)
          .select("id");
        assert(response.error || response.data?.length === 0);
        const forged = { ...clone(initialA.bets[0]), id: randomUUID() };
        const inserted = await b.from("bets").insert({
          id: forged.id,
          user_id: idA,
          payload: forged,
          placed_at: forged.placedAt,
          confirmed_at: forged.confirmedAt,
        });
        assert.equal(inserted.error?.code, "42501");
        assert.deepEqual((await load(a)).workspace.bets, initialA.bets);
      },
    );
    await check(
      "Bet edit and settlement persist with before/after audit",
      async () => {
        const state = await load(a);
        const next = clone(state.workspace);
        const before = clone(next.bets[0]);
        next.bets[0] = {
          ...before,
          outcome: "won",
          settledAt: now(),
          notes: `${marker} synthetic settlement verification; no wager`,
          legs: before.legs.map((leg) => ({
            ...leg,
            outcome: "won",
            statistic: "TEST OUTCOME ONLY",
          })),
        };
        next.audit.push({
          id: randomUUID(),
          entityType: "bet",
          entityId: before.id,
          action: "integration_settlement",
          timestamp: now(),
          before,
          after: clone(next.bets[0]),
        });
        await save(a, next, state.revision);
        const saved = await load(a);
        assert.equal(saved.workspace.bets[0].outcome, "won");
        assert.equal(
          saved.workspace.bets[0].legs[0].statistic,
          "TEST OUTCOME ONLY",
        );
        assert(
          saved.workspace.audit.some(
            (entry) =>
              entry.entityId === before.id &&
              entry.before?.outcome === "pending" &&
              entry.after?.outcome === "won",
          ),
        );
      },
    );
    await check(
      "Session and records survive SDK re-instantiation",
      async () => {
        const restored = clientFor(url, key, storageA);
        clients.push(restored);
        assert.equal(
          apiOk(await restored.auth.getUser(), "Restored session verification")
            .user?.id,
          idA,
        );
        assert.deepEqual(
          (await load(restored)).workspace,
          (await load(a)).workspace,
        );
      },
    );
    await check(
      "Stale workspace revision rejected without changing newer settings",
      async () => {
        const original = await load(a);
        const first = clone(original.workspace);
        first.settings.defaultStakeCents = 700;
        first.audit.push({
          id: randomUUID(),
          entityType: "settings",
          entityId: "experiment",
          action: "integration_settings_update",
          timestamp: now(),
          before: clone(original.workspace.settings),
          after: clone(first.settings),
        });
        await save(a, first, original.revision);
        const stale = await a.rpc("edgelab_save_workspace", {
          workspace: original.workspace,
          expected_revision: original.revision,
        });
        assert(stale.error && /revision conflict/i.test(stale.error.message));
        assert.equal((await load(a)).workspace.settings.defaultStakeCents, 700);
      },
    );
    await check(
      "Append-only financial and audit history cannot be changed",
      async () => {
        const state = await load(a);
        const transaction = clone(state.workspace.transactions[0]);
        transaction.amountCents = 9999;
        assert(
          (
            await a
              .from("financial_transactions")
              .update({ payload: transaction })
              .eq("id", transaction.id)
          ).error,
        );
        const audit = state.workspace.audit[0];
        assert(
          (
            await a
              .from("audit_history")
              .update({ action: "must not change" })
              .eq("id", audit.id)
          ).error,
        );
        assert.deepEqual(
          (await load(a)).workspace.transactions,
          state.workspace.transactions,
        );
      },
    );
    await check(
      "Authenticated delete is denied and the test ledger survives",
      async () => {
        const response = await a
          .from("bets")
          .delete()
          .eq("id", initialA.bets[0].id);
        assert.equal(response.error?.code, "42501");
        assert.equal((await load(a)).workspace.bets[0].id, initialA.bets[0].id);
      },
    );
    await check(
      "Simulated research is rejected atomically without relabelling provenance",
      async () => {
        const before = await load(a);
        const invalid = clone(before.workspace);
        const timestamp = now();
        invalid.transactions.push({
          id: randomUUID(),
          kind: "deposit",
          amountCents: 100,
          createdAt: timestamp,
          note: `${marker} rejection probe - must not persist`,
        });
        invalid.candidates.push({
          id: randomUUID(),
          sport: "NBA",
          event: "SYNTHETIC REJECTION PROBE - not a real event",
          participant: "SYNTHETIC TEST",
          market: "Integration test",
          selection: "MUST NOT REGISTER",
          line: "N/A",
          bookmaker: "SYNTHETIC TEST",
          odds: 1.9,
          strategy: "C",
          rationale:
            "Synthetic integration probe. Private research must reject this.",
          uncertainty: "illustrative",
          startsAt: timestamp,
          registeredAt: timestamp,
          oddsProvenance: {
            source: "Explicit synthetic integration fixture",
            timestamp,
            method: "Synthetic rejection probe; no bookmaker or live source",
            modelVersion: "integration-test-only",
            simulated: true,
          },
        });
        const response = await a.rpc("edgelab_save_workspace", {
          workspace: invalid,
          expected_revision: before.revision,
        });
        assert(
          response.error &&
            /simulated|research candidate/i.test(response.error.message),
        );
        assert.deepEqual(await load(a), before);
      },
    );
    await check(
      "Logout removes client access while the second session remains valid",
      async () => {
        apiOk(await a.auth.signOut({ scope: "local" }), "Logout");
        assert((await a.rpc("edgelab_load_workspace")).error);
        assert.equal(
          apiOk(await b.auth.getUser(), "Independent second session").user?.id,
          idB,
        );
      },
    );
    if (browserRuntime)
      await browserVerification({ url, key, credentials, marker, check });
  } catch (error) {
    console.error(publicFailure(error));
    process.exitCode = 1;
  } finally {
    await Promise.allSettled(
      clients.map((client) => client.auth.signOut({ scope: "local" })),
    );
    for (const client of clients) client.auth.stopAutoRefresh();
    storageA.clear();
    storageB.clear();
    credentials = null;
    const report = {
      timestamp: now(),
      projectRef,
      method:
        "Public-key password grants; Auth-issued JWTs verified through getUser; no privileged key or SQL role impersonation",
      marker,
      applicationWritesStarted: writesStarted,
      retainedRecords: writesStarted
        ? "Clearly labelled new manual bookkeeping records retained in the two dedicated test accounts; no existing account records deleted"
        : "No application records written",
      passed: results.filter((result) => result.passed).length,
      total: results.length,
      results,
      limits: [
        "No signup or confirmation email delivery tested; accounts must be created and confirmed in Dashboard first",
        browserRuntime
          ? "Authenticated browser sign-in/reload/demo switch/logout checks were requested; see individual results"
          : "SDK memory-storage restoration tested; authenticated browser F5 was not requested",
        "Hosted research, paper and notification round-trip writes remain unverified; simulated data rejection is tested with truthful flags",
      ],
    };
    console.log(JSON.stringify(report, null, 2));
    if (reportPath) {
      try {
        await writeFile(
          path.resolve(reportPath),
          JSON.stringify(report, null, 2) + "\n",
          { flag: "wx", mode: 0o600 },
        );
      } catch {
        console.error(
          "Could not create the sanitized report file; existing files are never overwritten.",
        );
        process.exitCode = 1;
      }
    }
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  main().catch((error) => {
    console.error(publicFailure(error));
    process.exitCode = 1;
  });
}

// Shared secure terminal/public-key helpers; importing this module never runs the write harness.
export { CheckFailure, apiOk, clientFor, credentialsFromTerminal, publicConfiguration, publicFailure, signIn };
