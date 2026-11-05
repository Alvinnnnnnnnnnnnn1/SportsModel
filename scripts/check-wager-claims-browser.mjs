#!/usr/bin/env node
/** Synthetic browser regression only. Fresh fake sessions, in-memory RPC responses,
 * and blocked external transport. Never opens a personal profile or hosted account.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';

const option = name => { const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1]; };
const runtime = option('--runtime');
if (!runtime) throw new Error('Pass --runtime with an existing optional Playwright installation.');
const app = new URL(option('--url') ?? 'http://localhost:3101');
if (app.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(app.hostname)) throw new Error('Only a local HTTP application is supported.');
const publicUrl = (await readFile('.env.local', 'utf8')).match(/^NEXT_PUBLIC_SUPABASE_URL\s*=\s*["']?([^\s"']+)/m)?.[1];
if (!publicUrl) throw new Error('Configure the existing public Supabase URL. No secret credentials are required.');
const supabase = new URL(publicUrl), authKey = `sb-${supabase.hostname.split('.')[0]}-auth-token`;
const { chromium } = createRequire(path.resolve(runtime, 'package.json'))('playwright');
const ownerA = '70000000-0000-4000-8000-000000000011', ownerB = '70000000-0000-4000-8000-000000000012';
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
function fakeSession(owner) {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const user = { id: owner, email: `synthetic-wager-${owner === ownerA ? 'a' : 'b'}@example.invalid`, aud: 'authenticated', role: 'authenticated', app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z', email_confirmed_at: '2026-01-01T00:01:00Z' };
  return { access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: owner, role: 'authenticated', exp: expiresAt })}.synthetic-not-a-real-token`, refresh_token: 'synthetic-not-a-real-refresh', token_type: 'bearer', expires_in: 3600, expires_at: expiresAt, user };
}
const sessions = new Map([[ownerA, fakeSession(ownerA)], [ownerB, fakeSession(ownerB)]]);
const fixture = {
  format: 'edgelab.historical-wager-claims', version: 1, sourceClass: 'owner_reported',
  sourceId: 'SYNTHETIC-local-browser-eight-claims', sourceReference: 'SYNTHETIC local fake owner report; no real wager or hosted source',
  sourceText: 'SYNTHETIC local-only fake owner report. All teams, players, wagers, prices and results in this browser fixture are invented. It never reaches hosted storage.',
  checkpoint: { reportedRealisedProfitCents: -70, modelledAllocationBeforeExposureCents: 49930, modelledAllocationAfterExposureCents: 48930 },
  records: Array.from({ length: 8 }, (_, index) => {
    const bonus = index === 5, pending = index >= 6, won = index === 0 || bonus;
    return {
      reference: `SYNTHETIC-CLAIM-${index + 1}`, sport: pending ? (index === 6 ? 'ATP' : 'WTA') : 'NBA',
      eventId: null, event: `SYNTHETIC fixture ${index + 1}`, participant: `SYNTHETIC participant ${index + 1}`,
      marketId: null, market: 'Match winner', selection: `SYNTHETIC selection ${index + 1}`, line: null,
      bookmaker: 'SYNTHETIC BOOK', reportedStakeCents: index === 0 ? 1000 : 500, stakeType: bonus ? 'bonus' : 'cash',
      reportedOdds: bonus ? 1.86 : pending ? (index === 6 ? 2.04 : 1.72) : 2.5,
      reportedOddsKind: pending ? 'pre_placement_quote' : 'owner_reported',
      acceptedOdds: null, acceptedOddsSource: null, placedAt: null, settledAt: null, ticketId: null,
      reportedOutcome: pending ? 'pending' : won ? 'won' : 'lost', reportedCashPayoutCents: pending ? null : bonus ? 430 : won ? 2500 : 0,
      strategy: null, sourceReferences: [`edgelab:synthetic-browser-claim-${index + 1}`],
      evidenceNotes: ['SYNTHETIC test only. Accepted execution odds, original dates and ticket ID are unknown.'], legs: [],
    };
  }),
};
const file = (name, value) => ({ name, mimeType: 'application/json', buffer: Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)) });

// Build a fake pre-existing paper/archive and approved-methodology state using the
// actual domain functions. This fixture exists only in this process's mock RPCs.
const loader = await createServer({ configFile: false, resolve: { alias: { '@': `${process.cwd()}/src` } }, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
let imports, baselineHistory, emptyActual;
try {
  imports = await loader.ssrLoadModule('/src/lib/imports/index.ts');
  const { createEmptyData } = await loader.ssrLoadModule('/src/lib/domain/fixtures.ts');
  const { prepareExperimentContextV2Preview, PROPOSED_EXPERIMENT_METHODOLOGY } = await loader.ssrLoadModule('/src/lib/handoff/methodology.ts');
  emptyActual = createEmptyData();
  const paper = await imports.parseHistoricalSource({ text: JSON.stringify([{ externalId: 'SYNTHETIC-EXISTING-PAPER', kind: 'paper', participant: 'SYNTHETIC existing historical paper', market: 'points', selection: 'SYNTHETIC existing paper 25+', line: '25', odds: 1.72, outcome: 'won', verification: 'unverified', sourceReference: 'edgelab:synthetic-existing-historical-paper', notes: 'SYNTHETIC fake pre-existing archive. No actual experiment data.' }]), format: 'json', sourceName: 'synthetic-existing-paper.json', verification: 'unverified' });
  const decision = [{ rowNumber: 1, include: true, acknowledgeIncomplete: true, allowProbableDuplicate: false }];
  baselineHistory = imports.commitHistoricalImport(imports.emptyHistoricalWorkspace(), imports.prepareImportCommit(paper, decision, 'unverified'));
  const paperId = baselineHistory.records[0].id;
  baselineHistory = imports.registerHistoricalPaper(baselineHistory, paperId);
  baselineHistory = imports.createHistoricalNotification(baselineHistory, paperId);
  const notificationId = baselineHistory.notifications[0].id;
  baselineHistory = imports.markHistoricalNotificationRead(baselineHistory, notificationId);
  baselineHistory = imports.dismissHistoricalNotification(baselineHistory, notificationId);
  const policy = await prepareExperimentContextV2Preview({ ownerReportedDay: null, sourceConfirmedCompletedDay: null, sourceConfirmedDayReference: null, researchCreationDate: null, eventDate: null, methodology: { ...structuredClone(PROPOSED_EXPERIMENT_METHODOLOGY), title: 'SYNTHETIC pre-existing approved methodology', sourceReferences: ['SYNTHETIC fake owner policy approval; local transport only'] }, methodologyApprovalConfirmed: true, rulesCompleteConfirmed: false, sourceReference: 'SYNTHETIC existing methodology fixture', verification: 'user_confirmed', confirmed: true });
  baselineHistory = imports.commitHistoricalImport(baselineHistory, imports.prepareImportCommit(policy, decision, 'user_confirmed', baselineHistory.records));
} finally { await loader.close(); }
const actualByOwner = new Map([[ownerA, structuredClone(emptyActual)], [ownerB, structuredClone(emptyActual)]]);
const historyByOwner = new Map([[ownerA, structuredClone(baselineHistory)], [ownerB, imports.emptyHistoricalWorkspace()]]);
const oldPaper = structuredClone(baselineHistory.records[0]), oldPolicy = structuredClone(baselineHistory.records[1]);
const oldAudit = structuredClone(baselineHistory.audit), oldPaperState = structuredClone(baselineHistory.paperResults), oldNotifications = structuredClone(baselineHistory.notifications);
const counters = { authReads: 0, workspaceReads: 0, historyReads: 0, historySaves: 0, financialWriteAttempts: 0, unexpectedExternalRequests: 0, unexpectedMockRequests: 0, runtimeErrors: 0 };
const results = [];
let allowHistorySaves = false;
const browser = await chromium.launch({ headless: true, executablePath: option('--browser') ?? (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined) });
const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, reducedMotion: 'reduce' });
await context.route('**/*', async route => {
  const request = route.request(), url = new URL(request.url());
  if (url.origin === app.origin) return route.continue();
  if (url.origin !== supabase.origin) { counters.unexpectedExternalRequests++; return route.abort('blockedbyclient'); }
  // Supabase requests are fulfilled locally. They are never continued externally.
  const send = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'X-Supabase-Api-Version': '2024-01-01', 'Access-Control-Allow-Origin': app.origin, 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS' }, ...(status === 204 ? {} : { body: JSON.stringify(body) }) });
  if (request.method() === 'OPTIONS') return send(null, 204);
  let owner;
  try { owner = JSON.parse(Buffer.from((request.headers().authorization ?? '').replace(/^Bearer /, '').split('.')[1], 'base64url').toString()).sub; } catch { /* No valid fake identity. */ }
  if (!sessions.has(owner)) { counters.unexpectedMockRequests++; return send({ code: 'AUTH_REQUIRED', message: 'SYNTHETIC test session required.' }, 401); }
  if (url.pathname === '/auth/v1/user') { counters.authReads++; return send(sessions.get(owner).user); }
  const body = request.postDataJSON();
  if (url.pathname === '/rest/v1/rpc/edgelab_load_workspace') { counters.workspaceReads++; return send({ revision: 0, workspace: actualByOwner.get(owner) }); }
  if (url.pathname === '/rest/v1/rpc/edgelab_load_history') {
    counters.historyReads++;
    assert.equal(body.expected_owner_id, owner);
    return send(historyByOwner.get(owner));
  }
  if (url.pathname === '/rest/v1/rpc/edgelab_save_workspace') { counters.financialWriteAttempts++; return send({ code: 'P0001', message: 'All actual/funding writes are forbidden in this browser regression.' }, 403); }
  if (url.pathname === '/rest/v1/rpc/edgelab_save_history') {
    if (!allowHistorySaves) { counters.unexpectedMockRequests++; return send({ code: 'P0001', message: 'No archive save authorized by the synthetic test.' }, 403); }
    assert.equal(body.expected_owner_id, owner);
    const before = historyByOwner.get(owner), next = body.workspace;
    assert.equal(body.expected_revision, before.revision);
    assert.equal(next.revision, before.revision + 1);
    imports.validateHistoricalTransition(before, next);
    historyByOwner.set(owner, structuredClone(next)); counters.historySaves++;
    return send(next.revision);
  }
  counters.unexpectedMockRequests++; return route.abort('blockedbyclient');
});
const page = await context.newPage();
page.on('pageerror', () => counters.runtimeErrors++);
page.setDefaultTimeout(15000);
const intake = () => page.getByRole('region', { name: 'Historical actual wager claims review', exact: true });
const summary = () => page.getByRole('region', { name: 'Historical wager claims summary', exact: true });
const wizard = () => page.locator('#source-import-review');
const claimKey = owner => `edgelab:wager-claims:private:${owner}:v1`;
async function switchOwner(owner) {
  await page.evaluate(({ key, value }) => { localStorage.setItem(key, JSON.stringify(value)); localStorage.setItem('edgelab:workspace', 'supabase'); }, { key: authKey, value: sessions.get(owner) });
  await page.reload();
  await page.getByText('Loading workspace…', { exact: true }).waitFor({ state: 'hidden' });
  await page.getByText('PRIVATE WORKSPACE', { exact: true }).first().waitFor();
  await page.getByText('Loading workspace…', { exact: true }).waitFor({ state: 'hidden' });
}
async function test(name, run) {
  try { await run(); results.push({ name, passed: true }); process.stdout.write(`PASS ${name}\n`); }
  catch (error) { process.stderr.write(String(error.stack ?? error.message) + '\n'); results.push({ name, passed: false, error: 'Synthetic local browser assertion failed; no page source, credentials or owner records retained.' }); process.stdout.write(`FAIL ${name}\n`); throw new Error(`Synthetic browser check stopped at: ${name}`); }
}
const noFinancialChanges = () => { assert.deepEqual(actualByOwner.get(ownerA), emptyActual); assert.deepEqual(actualByOwner.get(ownerB), emptyActual); assert.equal(counters.financialWriteAttempts, 0); };
const preservedExistingHistory = () => {
  const history = historyByOwner.get(ownerA);
  assert.deepEqual(history.records[0], oldPaper); assert.deepEqual(history.records[1], oldPolicy);
  assert.deepEqual(history.audit.slice(0, oldAudit.length), oldAudit);
  assert.deepEqual(history.paperResults, oldPaperState); assert.deepEqual(history.notifications, oldNotifications);
};
try {
  await test('existing mocked private workspace loads approved policy and paper without setup or writes', async () => {
    assert.equal((await page.goto(new URL('/settings', app).href)).status(), 200);
    await page.getByRole('heading', { name: 'Settings', exact: true }).waitFor();
    await switchOwner(ownerA);
    assert.equal(counters.historySaves, 0); noFinancialChanges(); preservedExistingHistory();
  });
  await test('malformed claim files are rejected before retention or archive writes', async () => {
    await page.goto(new URL('/imports', app).href);
    await intake().getByLabel('Historical wager claims JSON', { exact: true }).waitFor({ state: 'visible' });
    await page.waitForFunction(() => { const input = document.querySelector('input[aria-label="Historical wager claims JSON"]'); return input && !input.disabled; });
    await intake().getByLabel('Historical wager claims JSON', { exact: true }).setInputFiles(file('synthetic-bad.json', '{ invalid JSON'));
    await intake().getByRole('alert').waitFor();
    assert.equal(await page.evaluate(key => localStorage.getItem(key), claimKey(ownerA)), null);
    assert.equal(counters.historySaves, 0); noFinancialChanges();
  });
  await test('file selection previews owner reports while accepted execution odds remain unknown', async () => {
    await intake().getByLabel('Historical wager claims JSON', { exact: true }).setInputFiles(file('synthetic-eight-claims.json', fixture));
    await intake().getByText(/Owner-reported historical claims.*8 claims/).waitFor();
    assert.equal(await intake().getByText('Blocking: actual financial registration unavailable', { exact: true }).count(), 8);
    assert.equal(await intake().getByText('Execution-price evidence missing', { exact: true }).count(), 8);
    assert.equal(await intake().getByText('Pre-placement quote: 2.04', { exact: true }).count(), 1);
    assert.equal(await intake().getByText('Pre-placement quote: 1.72', { exact: true }).count(), 1);
    assert.match(await intake().innerText(), /−\$0\.70|-\$0\.70/);
    assert.equal(counters.historySaves, 0);
    assert.equal(await page.evaluate(key => localStorage.getItem(key), claimKey(ownerA)), null);
  });
  await test('explicit local retention survives Overview and Ledger refresh without financial writes', async () => {
    await intake().getByRole('button', { name: 'Retain on this browser', exact: true }).click();
    await intake().getByRole('button', { name: 'Retained on this browser', exact: true }).waitFor();
    assert(await page.evaluate(key => !!localStorage.getItem(key), claimKey(ownerA)));
    for (const route of ['/', '/ledger']) {
      await page.goto(new URL(route, app).href);
      await summary().getByText(/Owner-reported historical claims.*8 claims/).waitFor();
      assert.match(await summary().innerText(), /−\$0\.70|-\$0\.70/);
      assert((await summary().innerText()).includes('$10.00'));
      await page.reload();
      await summary().getByText(/Owner-reported historical claims.*8 claims/).waitFor();
    }
    assert.equal(counters.historySaves, 0); noFinancialChanges(); preservedExistingHistory();
  });
  await test('archive review supports bulk selection, warning acknowledgement and cancellation without writes', async () => {
    await page.goto(new URL('/imports', app).href);
    await intake().getByRole('button', { name: 'Review claims in existing importer', exact: true }).click();
    await wizard().getByRole('checkbox', { name: 'Select row 1', exact: true }).waitFor();
    assert(await wizard().getByRole('button', { name: 'Review archive import', exact: true }).isDisabled());
    await wizard().getByRole('button', { name: 'Select all eligible rows', exact: true }).click();
    assert.equal(await wizard().getByRole('checkbox', { checked: true }).count(), 8);
    await wizard().getByRole('button', { name: 'Deselect all', exact: true }).click();
    assert.equal(await wizard().getByRole('checkbox', { checked: true }).count(), 0);
    await wizard().getByRole('button', { name: 'Select all eligible rows', exact: true }).click();
    assert(await wizard().getByRole('button', { name: 'Review archive import', exact: true }).isDisabled());
    await wizard().getByRole('checkbox', { name: 'Acknowledge selected archive warnings', exact: true }).check();
    await wizard().getByRole('button', { name: 'Review archive import', exact: true }).click();
    let confirmation = page.getByRole('dialog', { name: 'Confirm archive import', exact: true });
    await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click();
    await confirmation.waitFor({ state: 'hidden' });
    assert.equal(counters.historySaves, 0); noFinancialChanges(); preservedExistingHistory();
    await wizard().getByRole('button', { name: 'Review archive import', exact: true }).click();
    confirmation = page.getByRole('dialog', { name: 'Confirm archive import', exact: true });
    await confirmation.waitFor();
    assert.equal(counters.historySaves, 0); noFinancialChanges();
  });
  await test('one explicit archive confirmation persists reports only and shows the exact saved records', async () => {
    const confirmation = page.getByRole('dialog', { name: 'Confirm archive import', exact: true });
    allowHistorySaves = true;
    await confirmation.getByRole('button', { name: 'Confirm archive import', exact: true }).click();
    await wizard().getByRole('region', { name: 'Archive import complete', exact: true }).getByText('8 records archived', { exact: true }).waitFor();
    assert.equal(await wizard().getByRole('button', { name: 'Review saved record', exact: true }).count(), 8);
    await page.getByRole('region', { name: 'Historical archive', exact: true }).getByText(/10 records/).waitFor();
    allowHistorySaves = false;
    assert.equal(counters.historySaves, 1);
    const history = historyByOwner.get(ownerA);
    assert.equal(history.records.length, baselineHistory.records.length + 8);
    assert(history.records.slice(2).every(record => record.snapshot.odds === null && record.snapshot.placedAt === null && record.snapshot.verification === 'unverified'));
    noFinancialChanges(); preservedExistingHistory();
  });
  await test('saved historical summaries survive clearing local attachment and page reload', async () => {
    await intake().getByRole('button', { name: 'Clear local attachment', exact: true }).click();
    await intake().getByText(/Saved historical archive.*8 claims/).waitFor();
    assert.equal(await page.evaluate(key => localStorage.getItem(key), claimKey(ownerA)), null);
    for (const route of ['/', '/ledger']) {
      await page.goto(new URL(route, app).href); await page.reload();
      await summary().getByText(/Saved historical archive.*8 claims/).waitFor();
      assert.match(await summary().innerText(), /−\$0\.70|-\$0\.70/);
    }
    noFinancialChanges(); preservedExistingHistory();
  });
  await test('exact duplicate source cannot be reimported or registered a second time', async () => {
    await page.goto(new URL('/imports', app).href);
    await page.waitForFunction(() => { const input = document.querySelector('input[aria-label="Historical wager claims JSON"]'); return input && !input.disabled; });
    await intake().getByLabel('Historical wager claims JSON', { exact: true }).setInputFiles(file('synthetic-eight-claims.json', fixture));
    await intake().getByText(/No new archive-eligible rows/).waitFor();
    assert(await intake().getByRole('button', { name: 'Review claims in existing importer', exact: true }).isDisabled());
    assert.equal(await intake().getByText(/EXACT archive match/).count(), 8);
    assert.equal(counters.historySaves, 1); noFinancialChanges();
  });
  await test('another mocked account cannot see the first account attachment or saved claim summary', async () => {
    await intake().getByRole('button', { name: 'Retain on this browser', exact: true }).click();
    await switchOwner(ownerB);
    await intake().getByText(/No historical wager claim source is attached or saved/).waitFor();
    assert.equal(await intake().getByText('SYNTHETIC-CLAIM-1', { exact: false }).count(), 0);
    assert.equal(await page.evaluate(key => localStorage.getItem(key), claimKey(ownerB)), null);
    assert.equal(historyByOwner.get(ownerB).records.length, 0);
    assert.equal(counters.historySaves, 1); noFinancialChanges();
  });
  await test('demo does not inherit private claims or accept an owner-reported source', async () => {
    await page.goto(new URL('/settings', app).href);
    await page.getByRole('button', { name: /Demo workspace/ }).click();
    await page.getByText('DEMO MODE', { exact: true }).waitFor();
    await page.goto(new URL('/imports', app).href);
    await intake().getByText(/No historical wager claim source is attached or saved/).waitFor();
    await page.waitForFunction(() => { const input = document.querySelector('input[aria-label="Historical wager claims JSON"]'); return input && !input.disabled; });
    await intake().getByLabel('Historical wager claims JSON', { exact: true }).setInputFiles(file('synthetic-private-shape.json', fixture));
    await intake().getByRole('alert').waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem('edgelab:wager-claims:demo:v1')), null);
    assert.equal(counters.historySaves, 1); noFinancialChanges();
  });
  await test('mobile claim review and summary fit without document overflow', async () => {
    await switchOwner(ownerA); await page.setViewportSize({ width: 390, height: 844 });
    for (const route of ['/imports', '/', '/ledger']) {
      await page.goto(new URL(route, app).href);
      if (route === '/imports') await intake().getByText(/Owner-reported historical claims.*8 claims/).waitFor();
      else await summary().getByText(/Owner-reported historical claims.*8 claims/).waitFor();
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    }
  });
  await test('all transport is mocked and no financial writes or runtime errors occurred', async () => {
    noFinancialChanges(); preservedExistingHistory();
    assert.equal(counters.unexpectedExternalRequests, 0); assert.equal(counters.unexpectedMockRequests, 0); assert.equal(counters.runtimeErrors, 0);
  });
} catch { process.exitCode = 1; }
finally {
  await context.close(); await browser.close();
  const report = path.resolve(option('--report') ?? '/private/tmp/edgelab-wager-claims-browser.json');
  await mkdir(path.dirname(report), { recursive: true });
  await writeFile(report, JSON.stringify({ scope: 'Synthetic local browser regression with fake authenticated users and in-memory RPC transport; no hosted calls, real records or personal browser profile', hostedVerification: false, createdAt: new Date().toISOString(), checksPassed: results.filter(result => result.passed).length, checksFailed: results.filter(result => !result.passed).length, results, counters }, null, 2) + '\n');
}
