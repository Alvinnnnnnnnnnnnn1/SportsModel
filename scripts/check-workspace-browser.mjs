#!/usr/bin/env node
/** Optional local UI verification. Fresh fake session and intercepted Auth/RPCs only.
 * Never opens a personal browser profile, requests credentials or contacts hosted Supabase.
 */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
const option = name => { const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1]; };
const runtime = option('--runtime');
if (!runtime) throw new Error('Supply --runtime with an existing optional Playwright installation.');
const app = new URL(option('--url') ?? 'http://localhost:3101');
if (app.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(app.hostname)) throw new Error('Only a local HTTP application is supported.');
const { chromium } = createRequire(path.resolve(runtime, 'package.json'))('playwright');
const publicEnvironment = await readFile('.env.local', 'utf8');
const configuredUrl = publicEnvironment.match(/^NEXT_PUBLIC_SUPABASE_URL\s*=\s*["']?([^\s"']+)/m)?.[1];
if (!configuredUrl) throw new Error('The public Supabase URL must be configured; no keys or credentials are read.');
const supabase = new URL(configuredUrl);
const authKey = `sb-${supabase.hostname.split('.')[0]}-auth-token`;
const owner = '10000000-0000-4000-8000-000000000099';
const email = 'synthetic-readonly-browser@example.invalid';
const user = { id: owner, email, aud: 'authenticated', role: 'authenticated', app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z', email_confirmed_at: '2026-01-01T00:01:00Z' };
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const expiresAt = Math.floor(Date.now() / 1000) + 3600;
const session = { access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: owner, role: 'authenticated', exp: expiresAt })}.synthetic-not-a-real-token`, refresh_token: 'synthetic-readonly-refresh', token_type: 'bearer', expires_in: 3600, expires_at: expiresAt, user };
const actual = { version: 1, settings: { fundingCapCents: 50000, defaultStakeCents: 500, currency: 'AUD', timezone: 'Australia/Melbourne' }, bets: [], transactions: [], candidates: [], paperPredictions: [], notifications: [], researchRuns: [], audit: [] };
const history = { revision: 0, batches: [], records: [], paperResults: [], notifications: [], audit: [] };
const results = [], unexpectedRequests = [], runtimeErrors = [];
let settingsStored = true, saveCalls = 0, authReads = 0;
const browser = await chromium.launch({ headless: true, executablePath: option('--browser') ?? (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined) });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
await context.route('**/*', async route => {
  const request = route.request(), url = new URL(request.url());
  if (url.origin === app.origin) return route.continue();
  if (url.origin !== supabase.origin) { unexpectedRequests.push({ origin: url.origin, path: url.pathname }); return route.abort('blockedbyclient'); }
  const send = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'X-Supabase-Api-Version': '2024-01-01', 'Access-Control-Allow-Origin': app.origin, 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS' }, ...(status === 204 ? {} : { body: JSON.stringify(body) }) });
  if (request.method() === 'OPTIONS') return send(null, 204);
  if (url.pathname === '/auth/v1/user') { authReads++; return send(user); }
  if (url.pathname === '/rest/v1/rpc/edgelab_load_workspace') return send({ revision: 0, workspace: settingsStored ? actual : null });
  if (url.pathname === '/rest/v1/rpc/edgelab_load_history') { assert.equal(request.postDataJSON()?.expected_owner_id, owner); return send(history); }
  if (url.pathname.includes('save')) { saveCalls++; return send({ code: 'P0001', message: 'Mocked transport rejects all writes.' }, 403); }
  unexpectedRequests.push({ origin: 'intercepted-supabase', path: url.pathname }); return route.abort('blockedbyclient');
});
const page = await context.newPage();
page.on('pageerror', () => runtimeErrors.push('Browser runtime exception'));
const panel = () => page.getByRole('region', { name: 'Personal workspace verification' });
const check = () => panel().getByRole('button', { name: 'Check private workspace · read only', exact: true });
const read = async () => { await check().click(); await panel().getByText('Authenticated settings and research reads passed with a stable normal-user identity.', { exact: true }).waitFor(); };
async function downloadReport() {
  const pending = page.waitForEvent('download');
  await panel().getByRole('button', { name: 'Download sanitized check', exact: true }).click();
  const downloaded = await pending, stream = await downloaded.createReadStream();
  assert(stream); let raw = ''; for await (const chunk of stream) raw += chunk.toString('utf8');
  for (const prohibited of [owner, email, session.access_token, session.refresh_token, 'access_token', 'refresh_token']) assert(!raw.includes(prohibited));
  assert.match(downloaded.suggestedFilename(), /^edgelab-personal-workspace-check-\d{4}-\d{2}-\d{2}\.json$/);
  return JSON.parse(raw);
}
async function test(name, run) {
  try { await run(); results.push({ name, passed: true }); process.stdout.write(`PASS ${name}\n`); }
  catch { results.push({ name, passed: false, error: 'Local assertion failed; no credentials or page contents retained.' }); process.stdout.write(`FAIL ${name}\n`); throw new Error('Read-only browser verification stopped.'); }
}
let demoBefore;
try {
  await test('demo disables the private read-only checker without creating private records', async () => {
    assert.equal((await page.goto(new URL('/settings', app).toString())).status(), 200);
    await page.getByRole('heading', { name: 'Settings', exact: true }).waitFor();
    await page.getByText('Loading workspace…', { exact: true }).waitFor({ state: 'hidden' });
    assert(await check().isDisabled()); assert.equal(saveCalls, 0);
    demoBefore = await page.evaluate(() => localStorage.getItem('edgelab:demo:v1'));
  });
  await test('an already signed-in mocked session reads both workspaces without account setup or writes', async () => {
    await page.evaluate(({ key, value }) => { localStorage.setItem(key, JSON.stringify(value)); localStorage.setItem('edgelab:workspace', 'supabase'); }, { key: authKey, value: session });
    await page.reload(); await page.getByText('Signed in with Supabase', { exact: true }).waitFor();
    await page.getByText('Loading workspace…', { exact: true }).waitFor({ state: 'hidden' });
    await read();
    assert((await panel().innerText()).includes('Stored cap'));
    assert.match(await panel().innerText(), /recorded deposits (?:A)?\$0\.00/);
    assert.equal(saveCalls, 0); assert(authReads >= 4);
  });
  await test('download exposes counts and stored settings while excluding every fake credential and identity', async () => {
    const report = await downloadReport();
    assert.equal(report.format, 'edgelab.personal-workspace-check'); assert.equal(report.status, 'passed');
    assert.equal(report.normalUserIdentityVerified, true); assert.equal(report.writesPerformed, 0);
    assert.equal(report.settingsStored, true); assert.deepEqual(report.settings, actual.settings);
    assert.equal(report.recordedDepositsCents, 0); assert.equal(report.counts.historicalRecords, 0);
    assert(report.unverified.some(item => item.includes('read-after-write')));
    assert.equal(await page.evaluate(() => localStorage.getItem('edgelab:demo:v1')), demoBefore);
  });
  await test('browser reload retains the mocked session and repeats reads without persisting anything', async () => {
    await page.reload(); await page.getByText('Signed in with Supabase', { exact: true }).waitFor();
    await page.getByText('Loading workspace…', { exact: true }).waitFor({ state: 'hidden' });
    assert.equal(await panel().getByRole('button', { name: 'Download sanitized check', exact: true }).count(), 0);
    await read(); assert.equal((await downloadReport()).settingsStored, true);
    assert.equal(saveCalls, 0);
  });
  await test('missing stored settings remain null and never turn the A$500 cap into a deposit', async () => {
    settingsStored = false; await page.reload(); await page.getByText('Signed in with Supabase', { exact: true }).waitFor();
    await page.getByText('Loading workspace…', { exact: true }).waitFor({ state: 'hidden' });
    await read(); const report = await downloadReport();
    assert.equal(report.settingsStored, false); assert.equal(report.settings, null); assert.equal(report.recordedDepositsCents, 0);
    assert((await panel().innerText()).includes('No stored settings record yet.'));
    assert.equal(saveCalls, 0);
  });
  await test('switching back to demo removes the private report without modifying either workspace', async () => {
    await page.getByRole('button', { name: /Demo workspace/ }).click();
    await page.getByText('DEMO MODE', { exact: true }).waitFor();
    assert(await check().isDisabled());
    assert.equal(await panel().getByRole('button', { name: 'Download sanitized check', exact: true }).count(), 0);
    assert.equal(await page.evaluate(() => localStorage.getItem('edgelab:demo:v1')), demoBefore);
    assert.equal(saveCalls, 0);
  });
  await test('all checks used blocked external transport without browser runtime errors', async () => { assert.deepEqual(unexpectedRequests, []); assert.deepEqual(runtimeErrors, []); assert.equal(saveCalls, 0); });
} catch { process.exitCode = 1; }
finally {
  await context.close(); await browser.close();
  const reportPath = path.resolve(option('--report') ?? '/private/tmp/edgelab-workspace-browser.json');
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, JSON.stringify({ mode: 'local browser with mocked existing session and intercepted Supabase responses', hostedVerification: false, createdAt: new Date().toISOString(), results, saveCalls, authReads, unexpectedRequests, runtimeErrors }, null, 2));
}
