#!/usr/bin/env node
// Hosted history read/negative probes using two ordinary Auth-issued JWT contexts.
// Importing/running this file never reads a privileged key or creates Auth users.
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { open } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  CheckFailure, apiOk, clientFor, credentialsFromTerminal,
  publicConfiguration, publicFailure, signIn,
} from "./check-hosted-access.mjs";

const TABLES = ["historical_workspace_revisions", "historical_import_batches", "historical_research_records", "historical_paper_results", "historical_notifications", "historical_audit_history"];
const option = name => { const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1]; };
const hash = value => createHash("sha256").update(value).digest("hex");
export function emptyHistoricalProbeWorkspace() { return { revision: 0, batches: [], records: [], paperResults: [], notifications: [], audit: [] }; }
export function isEmptyHistoricalProbeWorkspace(workspace) {
  return workspace?.revision === 0 && ["batches", "records", "paperResults", "notifications", "audit"].every(key => Array.isArray(workspace[key]) && workspace[key].length === 0);
}
/** This remains explicitly synthetic. It must be rejected, never relabelled to force acceptance. */
export function syntheticHistoricalRejectionProbe() {
  const timestamp = new Date().toISOString(); const batchId = randomUUID(); const recordId = randomUUID();
  const snapshot = {
    externalId: `SYNTHETIC-NEGATIVE-${recordId}`, eventId: null, marketId: null,
    kind: "paper", sport: "NBA", event: "SYNTHETIC HOSTED NEGATIVE PROBE - no actual event",
    participant: "SYNTHETIC TEST PARTICIPANT", market: "SYNTHETIC points test", selection: "SYNTHETIC Over", line: "18.5",
    bookmaker: "SYNTHETIC TEST BOOK - no account", odds: 1.9, predictionAt: timestamp,
    placedAt: null, settledAt: null, probability: null, probabilitySource: null, probabilityMethod: null, modelVersion: null,
    strategy: "C", sourceReference: "SYNTHETIC HOSTED REJECTION TEST ONLY; no real source", stakeCents: 500, stakeType: "cash", payoutCents: null, outcome: "pending", verification: "synthetic",
    notes: "SYNTHETIC SECURITY REJECTION PROBE ONLY. No real research, wager, funding or result. This payload must not persist.",
    legs: [{ id: randomUUID(), sport: "NBA", eventId: null, event: "SYNTHETIC HOSTED NEGATIVE PROBE - no actual event", participant: "SYNTHETIC TEST PARTICIPANT", marketId: null, market: "SYNTHETIC points test", selection: "SYNTHETIC Over", line: "18.5", odds: 1.9, outcome: "pending", statistic: null }],
  };
  const rawSource = JSON.stringify({ notice: "SYNTHETIC REJECTION PROBE; must never persist", records: [snapshot] });
  const batch = { id: batchId, createdAt: timestamp, sourceName: "SYNTHETIC HOSTED NEGATIVE PROBE.json", format: "json", rawSource, sourceHash: hash(rawSource), verification: "synthetic", summary: { parsed: 1, imported: 1, skipped: 0, warnings: 0, actual: 0, paper: 1 } };
  const record = { id: recordId, batchId, rowNumber: 1, importedAt: timestamp, raw: { notice: "SYNTHETIC NEGATIVE PROBE ONLY", ...snapshot }, fingerprint: hash(JSON.stringify(snapshot)), snapshot, issues: [], transformations: [], probableDuplicateConfirmed: false, incompleteConfirmed: true };
  return { revision: 1, batches: [batch], records: [record], paperResults: [], notifications: [], audit: [] };
}
function requireHistoryShape(value) {
  assert(value && Number.isSafeInteger(value.revision) && value.revision >= 0);
  for (const key of ["batches", "records", "paperResults", "notifications", "audit"]) assert(Array.isArray(value[key]));
  return value;
}
async function loadHistory(client, userId) { return requireHistoryShape(apiOk(await client.rpc("edgelab_load_history", { expected_owner_id: userId }), "Historical load")); }
async function requireRejected(result, description, expectedMessage) {
  if (!result.error) throw new CheckFailure(`${description} unexpectedly succeeded. Stop and inspect the dedicated test accounts; this harness does not delete or repair anything.`);
  if (expectedMessage && !expectedMessage.test(result.error.message ?? "")) throw new CheckFailure(`${description} was rejected for an unexpected reason; no security success is claimed.`);
}
export async function runHostedHistoryAccessChecks({ clients, identities, negativeWrites = false, onCheck = () => {} }) {
  const [a, b] = clients; const [ownerA, ownerB] = identities;
  assert(ownerA && ownerB && ownerA !== ownerB);
  const results = []; const pass = (name, detail) => { results.push({ name, passed: true, ...(detail ? { detail } : {}) }); onCheck(name, detail); };
  const before = [await loadHistory(a, ownerA), await loadHistory(b, ownerB)];
  pass("Both ordinary authenticated users load their own historical workspace");
  for (const [client, other] of [[a, ownerB], [b, ownerA]]) await requireRejected(await client.rpc("edgelab_load_history", { expected_owner_id: other }), "Expected-owner read mismatch", /Authenticated historical owner changed/);
  pass("Expected-owner RPC checks reject both directions of account mismatch before historical access");
  await requireRejected(await a.rpc("edgelab_load_history", { expected_owner_id: null }), "Null expected owner", /Authenticated historical owner changed/);
  pass("A null expected owner cannot bypass the history RPC identity guard");
  for (const [client, other] of [[a, ownerB], [b, ownerA]]) for (const table of TABLES) {
    const rows = apiOk(await client.from(table).select("user_id").eq("user_id", other).limit(1), "Cross-owner historical read"); assert.deepEqual(rows, []);
  }
  const bothEmpty = before.every(isEmptyHistoricalProbeWorkspace);
  pass("Cross-owner reads return no rows across all six historical tables in both directions", bothEmpty ? "Both historical contexts were empty; this is empty-state isolation evidence, not non-empty cross-user lifecycle proof." : "No cross-owner rows were visible; record contents and identifiers are omitted from this report.");
  const probe = syntheticHistoricalRejectionProbe();
  assert.equal(apiOk(await a.rpc("edgelab_history_batch", { value: probe.batches[0] }), "Synthetic batch validation probe"), false);
  assert.equal(apiOk(await a.rpc("edgelab_history_record", { value: probe.records[0] }), "Synthetic record validation probe"), false);
  pass("Deployed read-only validators reject honestly classified synthetic source batches and records");
  let negativeWriteStatus = "not_requested";
  if (negativeWrites) {
    if (!bothEmpty) {
      negativeWriteStatus = "skipped_nonempty_history";
      results.push({ name: "Synthetic RPC rejection and cross-owner save probes", passed: null, skipped: true, detail: "A historical workspace was not empty. No write RPC was attempted; existing records were preserved." });
    } else {
      for (const [client, owner, other] of [[a, ownerA, ownerB], [b, ownerB, ownerA]]) {
        await requireRejected(await client.rpc("edgelab_save_history", { workspace: probe, expected_revision: 0, expected_owner_id: other }), "Expected-owner save mismatch", /Authenticated historical owner changed/);
        assert.deepEqual(await loadHistory(client, owner), emptyHistoricalProbeWorkspace());
      }
      pass("Cross-owner save expectations are rejected before any write in both empty test contexts");
      await requireRejected(await a.rpc("edgelab_save_history", { workspace: probe, expected_revision: 0, expected_owner_id: ownerA }), "Synthetic historical save", /synthetic data stays in Demo/);
      negativeWriteStatus = "rejected_unchanged";
      pass("An honestly synthetic save RPC is rejected without relabelling test data");
    }
  }
  const after = [await loadHistory(a, ownerA), await loadHistory(b, ownerB)]; assert.deepEqual(after, before);
  pass("Both historical snapshots and revisions remain unchanged after all probes");
  return { results, bothHistoryContextsEmpty: bothEmpty, negativeWriteStatus };
}
export async function runAnonymousHistoryChecks(anonymous, sampleUserId, onCheck = () => {}) {
  const results = []; const pass = name => { results.push({ name, passed: true }); onCheck(name); };
  for (const table of TABLES) {
    const result = await anonymous.from(table).select("user_id").limit(1);
    assert(result.error && result.error.code === "42501"); assert(result.data === null || result.data.length === 0);
  }
  pass("Unauthenticated requests are denied across all six historical tables");
  for (const [rpc, args] of [["edgelab_load_history", { expected_owner_id: sampleUserId }], ["edgelab_save_history", { workspace: { ...emptyHistoricalProbeWorkspace(), revision: 1 }, expected_revision: 0, expected_owner_id: sampleUserId }]]) {
    const result = await anonymous.rpc(rpc, args); assert(result.error && result.error.code === "42501");
  }
  pass("Unauthenticated callers cannot execute either historical workspace RPC");
  return results;
}
async function main() {
  const reportPath = option("--report");
  const anonymousOnly = process.argv.includes("--anonymous-only");
  if (!reportPath) throw new CheckFailure("Supply a new --report output path. Existing reports are never overwritten.");
  const { url, key } = await publicConfiguration();
  const reportFile = await open(path.resolve(reportPath), "wx", 0o600).catch(() => { throw new CheckFailure("Choose a new writable --report path. Existing report files are never overwritten; no authentication was attempted."); });
  const report = { projectRef: option("--project-ref"), mode: anonymousOnly ? "hosted anonymous historical permission probes only" : "hosted normal-user historical read and negative probes only", startedAt: new Date().toISOString(), results: [], complete: false,
    limitations: ["No positive hosted historical, paper-result or notification writes are attempted.", "Synthetic fixtures remain labelled synthetic and are expected to be rejected, never relabelled as real or unverified.", "Empty-table isolation checks do not prove non-empty cross-account lifecycle behavior.", "Local PostgreSQL lifecycle tests and hosted JWT checks are separate evidence.", "No application records are intentionally changed or deleted; no accounts are created or deleted. Normal Auth sign-in/out updates sessions. Expected-failure write probes require both historical workspaces to start empty."],
  };
  const a = clientFor(url, key); const b = clientFor(url, key); const anonymous = clientFor(url, key);
  let credentials;
  try {
    const onCheck = (name, detail) => { report.results.push({ name, passed: true, ...(detail ? { detail } : {}) }); console.log(`PASS ${name}`); };
    if (anonymousOnly) {
      report.limitations.push("Authenticated user, ownership, persistence and synthetic rejection checks were not run in anonymous-only mode.");
      await runAnonymousHistoryChecks(anonymous, randomUUID(), onCheck);
      report.complete = true;
      return;
    }
    console.log("Use the two dedicated ordinary test accounts. Passwords stay hidden and are never written to the sanitized report.");
    credentials = await credentialsFromTerminal();
    const ownerA = await signIn(a, credentials.a); const ownerB = await signIn(b, credentials.b); assert.notEqual(ownerA, ownerB);
    credentials.a.password = ""; credentials.b.password = "";
    report.results.push({ name: "Two distinct password-issued normal JWT identities are verified through Auth getUser", passed: true });
    const run = await runHostedHistoryAccessChecks({ clients: [a, b], identities: [ownerA, ownerB], negativeWrites: process.argv.includes("--confirm-negative-writes"), onCheck });
    report.results.push(...run.results.filter(result => result.skipped)); report.bothHistoryContextsEmpty = run.bothHistoryContextsEmpty; report.negativeWriteStatus = run.negativeWriteStatus;
    await runAnonymousHistoryChecks(anonymous, ownerA, onCheck);
    report.complete = true;
  } catch (error) {
    report.results.push({ name: "Hosted history verification", passed: false, error: publicFailure(error) }); process.exitCode = 1;
  } finally {
    if (credentials) { credentials.a.password = ""; credentials.b.password = ""; }
    await Promise.allSettled([a.auth.signOut({ scope: "local" }), b.auth.signOut({ scope: "local" })]);
    report.finishedAt = new Date().toISOString();
    report.summary = { passed: report.results.filter(r => r.passed === true).length, failed: report.results.filter(r => r.passed === false).length, skipped: report.results.filter(r => r.skipped).length };
    try { await reportFile.writeFile(JSON.stringify(report, null, 2) + "\n", "utf8"); }
    catch { console.error("Could not complete the sanitized report; no credentials are printed."); process.exitCode = 1; }
    finally { await reportFile.close(); }
    console.log(JSON.stringify({ ...report.summary, complete: report.complete, negativeWriteStatus: report.negativeWriteStatus }, null, 2));
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch(error => { console.error(publicFailure(error)); process.exitCode = 1; });
