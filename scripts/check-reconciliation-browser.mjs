/** Isolated browser + invented fixtures + intercepted RPCs. No personal profile or hosted writes. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';
const option = name => { const i = process.argv.indexOf(name); return i < 0 ? undefined : process.argv[i + 1]; };
const runtime = option('--runtime');
if (!runtime) throw new Error('Pass --runtime /absolute/path/to/optional/playwright-prefix');
const app = new URL(option('--url') ?? 'http://localhost:3000');
if (app.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(app.hostname)) throw new Error('Local application only.');
const publicUrl = (await readFile('.env.local', 'utf8')).match(/^NEXT_PUBLIC_SUPABASE_URL\s*=\s*["']?([^\s"']+)/m)?.[1];
if (!publicUrl) throw new Error('Public Supabase configuration is required for intercepted private-mode checks.');
const supabase = new URL(publicUrl), key = `sb-${supabase.hostname.split('.')[0]}-auth-token`;
const owner = '92000000-0000-4000-8000-000000000001';
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const user = { id: owner, email: 'synthetic-local-reconciliation@example.invalid', aud: 'authenticated', role: 'authenticated', app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z', email_confirmed_at: '2026-01-01T00:01:00Z' };
const expiresAt = Math.floor(Date.now() / 1000) + 3600;
const session = { access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: owner, role: 'authenticated', exp: expiresAt })}.synthetic-local-signature`, refresh_token: 'synthetic-local-only', token_type: 'bearer', expires_in: 3600, expires_at: expiresAt, user };
const loader = await createServer({ configFile: false, envDir: false, appType: 'custom', resolve: { alias: { '@': `${process.cwd()}/src` } }, server: { middlewareMode: true, hmr: false, ws: false, watch: null } });
let actual, history, sourceText, commands;
try {
  commands = await loader.ssrLoadModule('/src/lib/imports/commands.ts');
  const { createDemoData, createEmptyData } = await loader.ssrLoadModule('/src/lib/domain/fixtures.ts');
  const { emptyHistoricalWorkspace } = await loader.ssrLoadModule('/src/lib/imports/types.ts');
  const { prepareReconciliationImport } = await loader.ssrLoadModule('/src/lib/reconciliation/source.ts');
  const { syntheticReconciliationSource, syntheticReconciliationMarkdown } = await loader.ssrLoadModule('/tests/fixtures/reconciliation-source.ts');
  actual = createEmptyData();
  const bet = createDemoData().bets[0];
  sourceText = await syntheticReconciliationSource(syntheticReconciliationMarkdown().replace('synthetic-actual-8', bet.id));
  delete bet.oddsProvenance; delete bet.probabilityProvenance; delete bet.probability;
  // All transport is mocked, including these invented pre-existing records.
  actual.bets = [bet];
  history = emptyHistoricalWorkspace();
  const review = await prepareReconciliationImport({ text: sourceText, sourceName: 'SYNTHETIC-only.json', data: actual, history, mode: 'supabase' });
  const previous = new Set([...Array.from({ length: 8 }, (_, i) => i + 1), 17, 34, 35]);
  history = commands.commitHistoricalImport(history, commands.prepareImportCommit(review.preview, review.preview.rows.map(row => ({ rowNumber: row.rowNumber, include: previous.has(row.rowNumber), acknowledgeIncomplete: true, allowProbableDuplicate: false })), 'unverified'));
  for (const record of history.records.filter(r => r.snapshot.kind === 'paper')) history = commands.registerHistoricalPaper(history, record.id);
} finally { await loader.close(); }
const baseline = structuredClone({ actual, history });
const { chromium } = createRequire(path.resolve(runtime, 'package.json'))('playwright');
const browser = await chromium.launch({ headless: true, executablePath: option('--browser') ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.addInitScript(({ key, session }) => {
  localStorage.setItem('edgelab:workspace', 'supabase');
  if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(session));
}, { key, session });
let saves = 0, financialAttempts = 0, externalAttempts = 0;
await context.route('**/*', async route => {
  const request = route.request(), url = new URL(request.url());
  if (url.origin === app.origin) {
    if (url.pathname === '/api/sports') return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'SYNTHETIC local test: provider disabled; no outbound read.' }) });
    return route.continue();
  }
  if (url.origin !== supabase.origin) { externalAttempts++; return route.abort('blockedbyclient'); }
  const send = (value, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': app.origin, 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' }, ...(status === 204 ? {} : { body: JSON.stringify(value) }) });
  if (request.method() === 'OPTIONS') return send(null, 204);
  if (url.pathname === '/auth/v1/user') return send(user);
  const body = request.postDataJSON();
  if (url.pathname.endsWith('/edgelab_load_workspace')) return send({ revision: 0, workspace: actual });
  if (url.pathname.endsWith('/edgelab_load_history')) { assert.equal(body.expected_owner_id, owner); return send(history); }
  if (url.pathname.endsWith('/edgelab_save_workspace')) { financialAttempts++; return send({ message: 'Financial writes forbidden in this test.' }, 403); }
  if (url.pathname.endsWith('/edgelab_save_history')) {
    assert.equal(body.expected_owner_id, owner);
    assert.equal(body.expected_revision, history.revision);
    commands.validateHistoricalTransition(history, body.workspace);
    history = structuredClone(body.workspace); saves++;
    return send(history.revision);
  }
  externalAttempts++; return route.abort('blockedbyclient');
});
const page = await context.newPage(); page.setDefaultTimeout(25000);
const errors = []; page.on('pageerror', error => errors.push(error.message));
const checks = [];
const pass = label => { checks.push(label); console.log(`PASS ${label}`); };
const upload = async () => page.getByLabel('Historical import source file', { exact: true }).setInputFiles({ name: 'SYNTHETIC-local-only.json', mimeType: 'application/json', buffer: Buffer.from(sourceText) });
try {
  await page.goto(new URL('/imports', app).href);
  await page.getByText('PRIVATE WORKSPACE', { exact: true }).first().waitFor();
  await page.locator('#historical-archive').getByText(/11 records ·/).waitFor();
  await upload();
  await page.locator('input[aria-label^="Select row "]').last().waitFor();
  assert.equal(await page.locator('input[aria-label^="Select row "]').count(), 46);
  assert.equal(await page.locator('input[aria-label^="Select row "]:disabled').count(), 12);
  pass('46 source rows previewed; 12 existing exact links excluded');
  await page.getByRole('button', { name: 'Select all eligible rows', exact: true }).click();
  assert.equal(await page.locator('input[aria-label^="Select row "]:checked').count(), 34);
  await page.getByLabel('Acknowledge selected archive warnings', { exact: true }).check();
  await page.getByRole('button', { name: 'Review archive import', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Confirm archive import' });
  await dialog.waitFor(); assert.equal(saves, 0);
  pass('source review and final archive confirmation required before mocked persistence');
  await dialog.getByRole('button', { name: 'Confirm archive import', exact: true }).click();
  await page.getByRole('heading', { name: '34 records archived', exact: true }).waitFor();
  assert.equal(saves, 1); assert.equal(history.records.length, 45);
  assert.deepEqual(actual, baseline.actual);
  assert.deepEqual(history.records.slice(0, baseline.history.records.length), baseline.history.records);
  assert.deepEqual(history.paperResults, baseline.history.paperResults);
  assert.deepEqual(history.audit.slice(0, baseline.history.audit.length), baseline.history.audit);
  assert.equal(financialAttempts, 0);
  for (const route of ['/', '/ledger']) {
    await page.goto(new URL(route, app).href);
    const summary = page.getByRole('region', { name: 'Historical wager claims summary', exact: true });
    await summary.getByText(/Saved historical archive.*11 claims/).waitFor();
    assert.match(await summary.innerText(), /Known settled-source subset:.*0\.70/);
  }
  pass('34 missing archive records saved through existing RPC path; existing records, paper states, audit and finances preserved');
  await page.goto(new URL('/imports', app).href);
  await page.reload();
  await page.locator('#historical-archive').getByText(/45 records ·/).waitFor();
  await upload();
  await page.locator('input[aria-label^="Select row "]').last().waitFor();
  assert.equal(await page.locator('input[aria-label^="Select row "]:disabled').count(), 46);
  assert.equal(saves, 1);
  pass('refresh persistence and full reimport duplicate protection verified with intercepted transport');
  await page.goto(new URL('/paper', app).href);
  await page.getByText(/34 archived selections/).waitFor();
  assert.equal(history.paperResults.length, 3);
  pass('all 34 paper sources visible without retrospective registration');
  await page.goto(new URL('/research', app).href);
  await page.getByRole('button', { name: 'Prepare Daily Research', exact: true }).click();
  const prompt = page.getByLabel('Generated research prompt', { exact: true });
  await prompt.waitFor();
  const value = await prompt.inputValue();
  for (const key of ['SAVED HISTORICAL MEMORY', 'H15', 'P18', 'd8-synthetic-11', 'unregistered_paper_proposal', 'lifetimeFundingCapCents']) assert(value.includes(key), `Daily prompt must contain ${key}`);
  for (const state of history.paperResults) assert(value.includes(state.recordId));
  pass('daily prompt includes saved historical memory, proposal classifications, methodology context and tracked papers; provider transport disabled');
  assert.equal(externalAttempts, 0); assert.deepEqual(errors, []);
  console.log(JSON.stringify({ status: 'local_mock_browser_only', checks: checks.length, mockedArchiveSaves: saves, hostedWrites: 0, financialAttempts, externalAttempts }));
} finally { await context.close(); await browser.close(); }
