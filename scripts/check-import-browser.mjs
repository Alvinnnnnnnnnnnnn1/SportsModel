#!/usr/bin/env node
// Optional local-only UI checks; synthetic records in a fresh browser context.
// No hosted requests, credentials or application dependencies are required.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
const option = name => { const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1]; };
const runtime = option('--runtime');
if (!runtime) throw new Error('Pass --runtime with an existing optional Playwright installation.');
const { chromium } = createRequire(path.resolve(runtime, 'package.json'))('playwright');
const app = new URL(option('--url') ?? 'http://localhost:3000');
if (app.protocol !== 'http:' || !['localhost','127.0.0.1','[::1]'].includes(app.hostname)) throw new Error('Use a local development server.');
const artifacts = path.resolve(option('--artifacts') ?? '/private/tmp/edgelab-import-browser');
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: option('--browser') ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, timezoneId: 'Australia/Melbourne', reducedMotion: 'reduce' });
const network = []; const errors = []; const results = [];
await context.route('**/*', route => { if (new URL(route.request().url()).origin === app.origin) return route.continue(); network.push(new URL(route.request().url()).origin); return route.abort('blockedbyclient'); });
const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
const store = () => page.evaluate(() => JSON.parse(localStorage.getItem('edgelab:history:demo:v1') ?? 'null'));
const ledger = () => page.evaluate(() => { const data = JSON.parse(localStorage.getItem('edgelab:demo:v1')); return { bets: data.bets, transactions: data.transactions }; });
async function route(target) { await page.goto(new URL(target, app).href); await page.getByRole('heading', { level: 1 }).waitFor(); await page.getByText('Loading historical workspace…', { exact: true }).waitFor({ state: 'hidden' }); }
async function test(name, work) {
  try { await work(); results.push({ name, passed: true }); console.log('PASS ' + name); }
  catch (error) { results.push({ name, passed: false, error: error.message }); console.log('FAIL ' + name + ': ' + error.message); await page.screenshot({ path: path.join(artifacts, 'failure-' + results.length + '.png'), fullPage: true }).catch(() => {}); throw error; }
}
async function jsonPreview(records) { await page.getByRole('button', { name: 'Paste mapped JSON', exact: true }).click(); await page.getByLabel('Mapped research records').fill(JSON.stringify(records)); await page.getByRole('button', { name: 'Validate mapped JSON', exact: true }).click(); await page.getByRole('button', { name: 'Select valid rows', exact: true }).waitFor(); }
async function approve() { await page.getByRole('button', { name: 'Select valid rows', exact: true }).click(); const flags = page.getByText('I reviewed the missing/unverified information.', { exact: true }); for (let i = 0; i < await flags.count(); i++) await flags.nth(i).locator('..').getByRole('checkbox').check(); await page.getByRole('button', { name: 'Review final confirmation', exact: true }).click(); const consent = page.getByText('I reviewed the proposed records, classifications, duplicates, missing information and source provenance. I explicitly approve saving only the selected archive records.', { exact: true }); await consent.locator('..').getByRole('checkbox').check(); await page.getByRole('button', { name: 'Save approved archive records', exact: true }).click(); await page.getByRole('button', { name: 'Save approved archive records', exact: true }).waitFor({ state: 'hidden' }); }
const common = { kind: 'paper', sport: 'NBA', event: 'SYNTHETIC browser fixture event', participant: 'SYNTHETIC browser player', market: 'Points', selection: 'Over 18.5 points', line: '18.5', bookmaker: 'SYNTHETIC browser book', odds: 1.9, predictionAt: '2026-01-01T00:00:00Z', probability: 0.6, probabilitySource: 'SYNTHETIC UI fixture', probabilityMethod: 'Explicit synthetic test input; no actual estimate', modelVersion: 'synthetic-ui-only', strategy: 'B', sourceReference: 'synthetic:browser:import', stakeCents: 500, stakeType: 'cash', outcome: 'pending', verification: 'synthetic' };
let before;
try {
  await test('all eight application routes still render', async () => { for (const target of ['/','/ledger','/research','/paper','/analytics','/notifications','/settings','/imports']) await route(target); before = await ledger(); assert.equal(await store(), null); });
  await test('malformed JSON creates no stored records', async () => { await page.getByRole('button', { name: 'Paste mapped JSON', exact: true }).click(); await page.getByLabel('Mapped research records').fill('[broken'); await page.getByRole('button', { name: 'Validate mapped JSON', exact: true }).click(); await page.getByRole('alert').filter({ hasText: 'Malformed JSON' }).waitFor(); assert.equal(await store(), null); });
  await test('invalid UTF-8 file clears earlier file selection without saving', async () => {
    await page.getByRole('button', { name: 'Upload file', exact: true }).click();
    await page.locator('input[type=file]').setInputFiles({ name: 'valid-synthetic.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify([common])) });
    assert(!(await page.getByRole('button', { name: 'Parse, validate & detect duplicates', exact: true }).isDisabled()));
    await page.locator('input[type=file]').setInputFiles({ name: 'invalid-utf8.json', mimeType: 'application/json', buffer: Buffer.from([0xc0,0xaf]) });
    await page.getByRole('alert').filter({ hasText: 'not valid UTF-8' }).waitFor();
    assert(await page.getByRole('button', { name: 'Parse, validate & detect duplicates', exact: true }).isDisabled()); assert.equal(await store(), null);
  });
  await test('JSON preview, unknown nulls and explicit batch approval', async () => {
    const actual = { ...common, externalId: 'SYNTHETIC-ACTUAL-001', kind: 'actual', participant: 'SYNTHETIC bonus actual', stakeType: 'bonus', odds: 2, placedAt: '2026-01-01T00:01:00Z', settledAt: '2026-01-01T01:00:00Z', outcome: 'won', payoutCents: 500 };
    const unknown = { ...common, externalId: 'SYNTHETIC-UNKNOWN-001', kind: null, participant: 'SYNTHETIC unknown type', odds: null, probability: null, stakeCents: null, stakeType: null, predictionAt: null };
    await jsonPreview([{ ...common, externalId: 'SYNTHETIC-PAPER-001', outcome: 'won', settledAt: '2026-01-01T01:00:00Z' }, actual, unknown]);
    assert.equal(await store(), null); await approve(); const saved = await store(); assert.equal(saved.records.length, 3); assert.equal(saved.audit[0].action, 'import_confirmed'); assert.equal(saved.records[2].snapshot.odds, null); assert.equal(saved.records[2].snapshot.predictionAt, null); assert.deepEqual(await ledger(), before);
  });
  await test('exact duplicates blocked without modifying archive', async () => { await jsonPreview([{ ...common, externalId: 'SYNTHETIC-PAPER-001' }]); await page.getByText(/EXACT duplicate:/).waitFor(); assert(await page.getByRole('checkbox', { name: 'Select row 1', exact: true }).isDisabled()); assert.equal((await store()).records.length, 3); await page.getByRole('button', { name: 'Back to source', exact: true }).click(); });
  await test('paper forecast frozen and per-leg settlement audited', async () => {
    const snapshot = (await store()).records[0].snapshot;
    await route('/paper'); const section = page.getByRole('heading', { name: 'Historical paper tracking', exact: true }).locator('..').locator('..');
    await section.getByRole('button', { name: 'Record result', exact: true }).first().click(); const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Imported paper outcome', { exact: true }).selectOption('won'); await dialog.getByLabel('Imported result timestamp', { exact: true }).fill('2026-01-01T02:00:00Z'); await dialog.getByLabel('Imported leg 1 outcome', { exact: true }).selectOption('won'); await dialog.getByLabel('Imported leg 1 statistic', { exact: true }).fill('SYNTHETIC final 24 points'); await dialog.getByRole('button', { name: 'Save paper result', exact: true }).click(); await dialog.waitFor({ state: 'hidden' });
    const saved = await store(); assert.deepEqual(saved.records[0].snapshot, snapshot); assert.equal(saved.paperResults[0].outcome, 'won'); assert.equal(saved.paperResults[0].legs[0].statistic, 'SYNTHETIC final 24 points'); assert(saved.audit.some(a => a.action === 'paper_result_recorded')); await page.reload(); await page.getByText('+$4.50', { exact: true }).first().waitFor(); assert.deepEqual(await ledger(), before);
  });
  await test('explicitly cleared result timestamp stays unknown when editor reopens', async () => {
    const row = page.getByRole('row').filter({ hasText: 'SYNTHETIC browser player' });
    await row.getByRole('button', { name: 'Record result', exact: true }).click();
    let dialog = page.getByRole('dialog'); await dialog.getByLabel('Imported result timestamp', { exact: true }).fill(''); await dialog.getByRole('button', { name: 'Save paper result', exact: true }).click(); await dialog.waitFor({ state: 'hidden' });
    assert.equal((await store()).paperResults[0].settledAt, null); assert.equal((await store()).records[0].snapshot.settledAt, '2026-01-01T01:00:00.000Z');
    await row.getByRole('button', { name: 'Record result', exact: true }).click(); dialog = page.getByRole('dialog'); assert.equal(await dialog.getByLabel('Imported result timestamp', { exact: true }).inputValue(), ''); await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  });
  await test('notifications deduplicate, persist read and add unknown record to paper', async () => {
    await route('/imports'); const row = page.getByRole('row').filter({ hasText: 'SYNTHETIC unknown type' }); await row.getByRole('button', { name: 'Review source', exact: true }).click(); let dialog = page.getByRole('dialog'); await dialog.getByRole('button', { name: 'Create research notification', exact: true }).click(); await dialog.getByRole('button', { name: 'Notification registered', exact: true }).waitFor(); assert(await dialog.getByRole('button', { name: 'Notification registered', exact: true }).isDisabled()); await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await route('/notifications'); const region = page.getByRole('region', { name: 'Historical research notifications', exact: true }); await region.getByRole('button', { name: 'Research source details', exact: true }).click(); dialog = page.getByRole('dialog'); await dialog.getByRole('button', { name: 'Close', exact: true }).click(); await region.getByRole('button', { name: 'Add to paper tracking', exact: true }).click(); await region.getByRole('link', { name: 'Open paper tracking', exact: true }).waitFor(); await page.reload();
    const saved = await store(); assert.equal(saved.notifications.length, 1); assert(saved.notifications[0].readAt); assert.equal(saved.records[2].snapshot.kind, null); assert(saved.paperResults.some(r => r.recordId === saved.records[2].id));
    await page.getByRole('button', { name: /Dismiss historical notification/ }).click(); const next = await store(); assert(next.notifications[0].dismissedAt); assert(next.audit.some(a => a.action === 'notification_dismissed')); assert.deepEqual(await ledger(), before);
  });
  await test('separate financial confirmation registers bonus entry without funding', async () => {
    await route('/imports'); const row = page.getByRole('row').filter({ hasText: 'SYNTHETIC bonus actual' }); await row.getByRole('button', { name: 'Review source', exact: true }).click(); await page.getByRole('dialog').getByRole('button', { name: 'Review actual-ledger registration', exact: true }).click(); const dialog = page.getByRole('dialog'); const confirm = dialog.getByRole('button', { name: 'Confirm financial registration', exact: true }); assert(await confirm.isDisabled()); await dialog.getByRole('checkbox').check(); await confirm.click(); await page.getByRole('dialog').getByRole('button', { name: 'Already in actual ledger', exact: true }).waitFor(); const after = await ledger(); assert.equal(after.bets.length, before.bets.length + 1); assert.deepEqual(after.transactions, before.transactions); const sourceId = (await store()).records[1].id; assert.equal(after.bets.find(b => b.id === sourceId).stakeType, 'bonus');
  });
  await test('CSV file upload and manual entry work through review', async () => {
    await route('/imports'); const csv = 'externalId,kind,sport,event,participant,market,selection,line,bookmaker,odds,predictionAt,strategy,sourceReference,stake,stakeType,outcome,verification\nSYNTHETIC-CSV-001,paper,ATP,SYNTHETIC CSV Event,SYNTHETIC CSV Player,Match winner,SYNTHETIC CSV Player,Moneyline,SYNTHETIC CSV Book,2.1,2026-01-01T00:00:00Z,C,synthetic:csv,5.00,cash,pending,synthetic\n'; await page.locator('input[type=file]').setInputFiles({ name: 'synthetic.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) }); await page.getByRole('button', { name: 'Parse, validate & detect duplicates', exact: true }).click(); await approve(); assert.equal((await store()).records.length, 4);
    await page.getByRole('button', { name: 'Enter record manually', exact: true }).click(); await page.getByLabel('Event', { exact: true }).fill('SYNTHETIC manual unknown fields'); await page.getByRole('button', { name: 'Validate manual record', exact: true }).click(); await approve(); const saved = await store(); assert.equal(saved.records.length, 5); assert.equal(saved.records.at(-1).snapshot.odds, null); assert.equal(saved.records.at(-1).snapshot.stakeCents, null);
  });
  await test('mobile import layout remains usable', async () => { await page.setViewportSize({ width: 390, height: 844 }); await route('/imports'); await page.screenshot({ path: path.join(artifacts, 'imports-mobile.png'), fullPage: true }); assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)); await page.setViewportSize({ width: 1440, height: 1100 }); await page.screenshot({ path: path.join(artifacts, 'imports-desktop.png'), fullPage: true }); });
  await test('no browser errors or external network', async () => { assert.deepEqual(errors, []); assert.deepEqual(network, []); });
} catch { process.exitCode = 1; }
finally { await writeFile(path.join(artifacts, 'report.json'), JSON.stringify({ simulatedOnly: true, results, runtimeErrors: errors, externalRequests: network }, null, 2)); await browser.close(); }
