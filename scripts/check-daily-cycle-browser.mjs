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
  const { createEmptyData } = await loader.ssrLoadModule('/src/lib/domain/fixtures.ts');
  const { emptyHistoricalWorkspace } = await loader.ssrLoadModule('/src/lib/imports/types.ts');
  const { localCycle } = await loader.ssrLoadModule('/tests/fixtures/daily-cycle.ts');
  actual = createEmptyData(); history = emptyHistoricalWorkspace(); sourceText = JSON.stringify(localCycle());
} finally { await loader.close(); }
const baseline = structuredClone({ actual, history });
const { chromium } = createRequire(path.resolve(runtime, 'package.json'))('playwright');
const browser = await chromium.launch({ headless: true, executablePath: option('--browser') ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.addInitScript(({ key, session }) => {
  localStorage.setItem('edgelab:workspace', 'supabase');
  if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(session));
}, { key, session });
let saves = 0, financialAttempts = 0, externalAttempts = 0, failNextSave = true;
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
    if (failNextSave) { failNextSave = false; return send({ code: 'P0001', message: 'LOCAL TEST injected atomic failure' }, 400); }
    assert.equal(body.expected_revision, history.revision);
    commands.validateHistoricalTransition(history, body.workspace);
    history = structuredClone(body.workspace); saves++;
    return send(history.revision);
  }
  externalAttempts++; return route.abort('blockedbyclient');
});
const page = await context.newPage(); page.setDefaultTimeout(25000);
try {
  await page.goto(new URL('/research', app).href);
  await page.getByRole('button', { name: '2 · Import GPT Results', exact: true }).click();
  await page.getByLabel('Daily-cycle JSON', { exact: true }).fill(sourceText);
  await page.getByRole('button', { name: 'Validate Daily Cycle', exact: true }).click();
  await page.getByRole('button', { name: /Review.*Apply Daily Update/ }).click();
  const dialog=page.getByRole('dialog',{name:'Save private Daily Cycle',exact:true}); await dialog.waitFor();
  assert.equal(saves,0); console.log('PASS private cycle reviewed without writes or implicit position registration');
  await dialog.getByRole('button',{name:'Confirm research-only save',exact:true}).click();
  await page.getByRole('alert').filter({hasText:/could not complete|could not be confirmed/}).waitFor();
  assert.equal(saves,0);assert.deepEqual(history,baseline.history);console.log('PASS failed save reports error and preserves source and workspace');
  await dialog.getByRole('button',{name:'Confirm research-only save',exact:true}).click();
  await page.getByText(/Private cycle saved and read back/).first().waitFor();
  assert.equal(saves,1);assert.equal(history.records.length,2);assert.deepEqual(actual,baseline.actual);assert.equal(history.paperResults.length,0);assert.equal(financialAttempts,0);
  assert.equal(await page.getByRole('button',{name:'Record Placed Bet',exact:true}).count(),0);
  console.log('PASS retry saves research source and read-back receipt only');
  await page.reload(); await page.getByRole('button',{name:'2 · Import GPT Results',exact:true}).click();
  await page.getByLabel('Daily-cycle JSON',{exact:true}).fill(sourceText);await page.getByRole('button',{name:'Validate Daily Cycle',exact:true}).click();
  await page.getByText('This cycle was already reviewed and cannot be applied again.').waitFor();
  assert(await page.getByRole('button',{name:/Review.*Apply Daily Update/}).isDisabled());assert.equal(saves,1);assert.equal(externalAttempts,0);
  console.log('PASS reload restores durable duplicate receipt; no hosted request or financial write occurred');
} finally { await context.close(); await browser.close(); }
