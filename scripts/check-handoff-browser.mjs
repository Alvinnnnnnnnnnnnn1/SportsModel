#!/usr/bin/env node
// Optional local browser regression. Fresh synthetic storage, fixed test clock,
// no credentials, no hosted traffic, no server launch or application dependencies.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const option = name => { const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1]; };
const runtime = option('--runtime');
if (!runtime) throw new Error('Pass --runtime with an existing optional Playwright installation.');
const { chromium } = createRequire(path.resolve(runtime, 'package.json'))('playwright');
const app = new URL(option('--url') ?? 'http://localhost:3000');
if (app.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(app.hostname)) throw new Error('This synthetic harness only supports a local HTTP application.');
const artifacts = path.resolve(option('--artifacts') ?? '/private/tmp/edgelab-handoff-browser');
await mkdir(artifacts, { recursive: true });

const baseInstant = Date.now();
const hour = 3_600_000;
const iso = offset => new Date(baseInstant + offset).toISOString();
const researchDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Melbourne', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(baseInstant));
const response = {
  format: 'edgelab.research-response', version: 1, id: 'SYNTHETIC-browser-research-day-6',
  researchDate, researchDay: 6, dayStatus: 'completed', source: 'SYNTHETIC local browser contract fixture',
  researchMethod: 'SYNTHETIC fixed input values only. No AI call, live bookmaker price, actual event or wager.',
  sourceUrls: ['https://example.invalid/synthetic-browser-research'], rulesSourceReference: 'synthetic:browser:rules',
  candidates: [{
    id: 'SYNTHETIC-browser-candidate-1', sport: 'NBA', eventId: 'SYNTHETIC-browser-event-1',
    event: 'SYNTHETIC browser continuation fixture event', startsAt: iso(24 * hour),
    participant: 'SYNTHETIC research handoff player', marketId: 'SYNTHETIC-points-market', market: 'Player points',
    selection: 'Over 18.5 points', line: '18.5', bookmaker: 'SYNTHETIC BROWSER BOOK', originalOdds: 1.9,
    oddsTimestamp: iso(-10 * 60_000), oddsSource: 'SYNTHETIC fixed fixture; no available price is claimed',
    oddsSourceUrl: 'https://example.invalid/synthetic-browser-odds', predictionTimestamp: iso(-5 * 60_000),
    probability: { value: 0.6, origin: 'deterministic_model', source: 'SYNTHETIC frequency input',
      method: 'Six fictional successes divided by ten fictional trials; no actual player observations.',
      modelVersion: 'synthetic-browser-frequency-v1', timestamp: iso(-10 * 60_000) },
    strategy: 'B', evidence: [{ claim: 'SYNTHETIC supporting evidence only; no real statistics.',
      sourceUrl: 'https://example.invalid/synthetic-browser-evidence', observedAt: iso(-12 * 60_000), verification: 'unverified' }],
    sourceUrls: ['https://example.invalid/synthetic-browser-source'], confidence: 'unknown',
    uncertainty: 'Entirely synthetic fixture. Available odds, event information and predictive advantage are not established.',
    decision: 'paper', proposedStatus: 'actual_requires_manual_confirmation',
    rationale: 'SYNTHETIC manual review and paper lifecycle verification only.', passReasons: [], hypotheticalStakeCents: 500, hypotheticalStakeType: 'cash', estimatedEv: 0.14,
  }],
  passes: [{ id: 'SYNTHETIC-browser-pass-1', sport: 'WTA', event: null,
    reason: 'SYNTHETIC pass: source-supported current odds are unavailable. No opportunity is inferred.', sourceUrls: [] }],
};
const originalMessage = 'SYNTHETIC historical mapping fixture only. Record one fictional cash win and one fictional paper loss from the explicit structured fields provided by this test. No real experiment history.';
const conversation = {
  id: 'SYNTHETIC-browser-experiment-conversation', title: 'SYNTHETIC Sports Betting Experiment source',
  create_time: (baseInstant - 96 * hour) / 1000, update_time: (baseInstant - 72 * hour) / 1000, current_node: 'synthetic-answer',
  mapping: {
    'synthetic-root': { id: 'synthetic-root', parent: null, children: ['synthetic-question'], message: null },
    'synthetic-question': { id: 'synthetic-question', parent: 'synthetic-root', children: ['synthetic-answer', 'synthetic-alternative'], message: {
      id: 'SYNTHETIC-message-question', author: { role: 'user' }, create_time: (baseInstant - 96 * hour) / 1000,
      content: { content_type: 'text', parts: ['SYNTHETIC experiment fixture question; not a real conversation.'] },
    } },
    'synthetic-answer': { id: 'synthetic-answer', parent: 'synthetic-question', children: [], message: {
      id: 'SYNTHETIC-message-answer', author: { role: 'assistant' }, create_time: (baseInstant - 95 * hour) / 1000,
      content: { content_type: 'text', parts: [originalMessage] },
    } },
    'synthetic-alternative': { id: 'synthetic-alternative', parent: 'synthetic-question', children: [], message: {
      id: 'SYNTHETIC-message-alternative', author: { role: 'assistant' }, create_time: (baseInstant - 94 * hour) / 1000,
      content: { content_type: 'text', parts: ['SYNTHETIC alternative branch preserved as original source metadata.'] },
    } },
  },
};
const mappedRecords = [
  { externalId: 'SYNTHETIC-browser-history-actual-1', kind: 'actual', sport: 'NBA', event: 'SYNTHETIC historical cash event',
    participant: 'SYNTHETIC historical cash team', market: 'Match winner', selection: 'SYNTHETIC historical cash team to win', line: 'Moneyline',
    bookmaker: 'SYNTHETIC BROWSER BOOK', odds: 2, predictionAt: iso(-96 * hour), placedAt: iso(-95 * hour), settledAt: iso(-94 * hour),
    probability: null, strategy: 'A', stakeCents: 500, stakeType: 'cash', payoutCents: 1000, outcome: 'won', legs: [],
    notes: 'SYNTHETIC historical cash fixture; no real bet or funding.' },
  { externalId: 'SYNTHETIC-browser-history-paper-1', kind: 'paper', sport: 'ATP', event: 'SYNTHETIC historical paper event',
    participant: 'SYNTHETIC historical paper player', market: 'Match winner', selection: 'SYNTHETIC historical paper player to win', line: 'Moneyline',
    bookmaker: 'SYNTHETIC BROWSER BOOK', odds: 1.8, predictionAt: iso(-72 * hour), settledAt: iso(-70 * hour),
    probability: null, strategy: 'C', stakeCents: 500, stakeType: 'cash', payoutCents: 0, outcome: 'lost', legs: [],
    notes: 'SYNTHETIC paper loss, separate from cash bankroll.' },
];

const browser = await chromium.launch({ headless: true, executablePath: option('--browser') ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, timezoneId: 'Australia/Melbourne', reducedMotion: 'reduce' });
await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: app.origin });
const externalRequests = []; const runtimeErrors = []; const results = []; const skippedChecks = [];
await context.route('**/*', route => {
  const url = new URL(route.request().url());
  if (url.origin === app.origin) return route.continue();
  externalRequests.push({ origin: url.origin, path: url.pathname }); return route.abort('blockedbyclient');
});
const page = await context.newPage();
page.on('pageerror', error => runtimeErrors.push(error.message));
await page.clock.install({ time: new Date(baseInstant) });
const history = () => page.evaluate(() => JSON.parse(localStorage.getItem('edgelab:history:demo:v1') ?? 'null'));
const appData = () => page.evaluate(() => JSON.parse(localStorage.getItem('edgelab:demo:v1') ?? 'null'));
const financial = async () => { const data = await appData(); return { bets: data.bets, transactions: data.transactions }; };
const same = (left, right, message) => assert(JSON.stringify(left) === JSON.stringify(right), message);
async function route(target) {
  await page.goto(new URL(target, app).href);
  await page.getByRole('heading', { level: 1 }).waitFor();
  await page.getByText('Loading historical workspace…', { exact: true }).waitFor({ state: 'hidden' });
}
async function test(name, work) {
  try { await work(); results.push({ name, passed: true }); console.log('PASS ' + name); }
  catch (error) {
    results.push({ name, passed: false, error: error.message }); console.log('FAIL ' + name + ': ' + error.message);
    await page.screenshot({ path: path.join(artifacts, `failure-${results.length}.png`), fullPage: true }).catch(() => {});
    throw error;
  }
}
async function approveArchive() {
  const wizard = page.getByRole('heading', { name: 'Controlled source import', exact: true }).locator('..').locator('..');
  await wizard.getByRole('button', { name: 'Select valid rows', exact: true }).click();
  for (const checkbox of await wizard.getByRole('checkbox', { name: 'I reviewed the missing/unverified information.', exact: true }).all()) await checkbox.check();
  await wizard.getByRole('button', { name: 'Review final confirmation', exact: true }).click();
  await wizard.getByRole('checkbox', { name: /^I reviewed the proposed records, classifications/ }).check();
  await wizard.getByRole('button', { name: 'Save approved archive records', exact: true }).click();
  await wizard.getByRole('button', { name: 'Save approved archive records', exact: true }).waitFor({ state: 'hidden' });
}
function handoff() { return page.getByRole('region', { name: 'Research Handoff', exact: true }); }
function reviewRegion() { return page.getByRole('region', { name: 'Research response review', exact: true }); }
async function reviewResponse(value) {
  await handoff().getByRole('button', { name: '2 · Response review', exact: true }).click();
  const editor = reviewRegion().getByRole('textbox', { name: /^Research response JSON/ });
  assert((await editor.boundingBox())?.height >= 300, 'The desktop research JSON editor must provide usable editing space.');
  await editor.fill(typeof value === 'string' ? value : JSON.stringify(value));
  await reviewRegion().getByRole('button', { name: 'Validate research response', exact: true }).click();
}
async function backToResponse() { await reviewRegion().getByRole('button', { name: 'Back to research JSON', exact: true }).click(); }
let initialFinancial; let registeredFinancial; let paperId; let originalPaperSnapshot;
try {
  await test('fresh local workspace has no imported experiment history', async () => {
    await route('/imports'); assert.equal(await history(), null); initialFinancial = await financial();
    await page.getByRole('region', { name: 'Selected conversation intake', exact: true }).getByRole('heading', { name: 'Prepare a supplied conversation source', exact: true }).waitFor();
  });
  await test('explicitly selected synthetic conversation maps multiple records without saving', async () => {
    const intake = page.getByRole('region', { name: 'Selected conversation intake', exact: true });
    const unrelated = { ...conversation, id: 'SYNTHETIC-unrelated-conversation', title: 'UNRELATED PRIVATE CONVERSATION MUST NOT BE RETAINED' };
    await intake.getByLabel('Select conversation export JSON', { exact: true }).setInputFiles({ name: 'synthetic-conversations.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify([conversation, unrelated])) });
    await intake.getByLabel('Choose export conversation', { exact: true }).selectOption(conversation.id);
    await intake.getByRole('button', { name: 'Review selected conversation', exact: true }).click();
    await intake.getByRole('checkbox', { name: 'Map source message 2', exact: true }).check();
    await intake.getByLabel('Mapped fields for source message 2', { exact: true }).fill(JSON.stringify(mappedRecords, null, 2));
    await intake.getByRole('checkbox', { name: /^I selected only the relevant experiment conversation/ }).check();
    await intake.getByRole('button', { name: 'Prepare mapped records for review', exact: true }).click();
    await page.getByLabel('Mapped research records').waitFor();
    const source = JSON.parse(await page.getByLabel('Mapped research records').inputValue());
    assert.equal(source.records.length, 2); assert.equal(source.records[0].sourceExcerpt.messageId, 'SYNTHETIC-message-answer');
    assert.equal(source.records[0].sourceExcerpt.text, originalMessage);
    assert(!JSON.stringify(source).includes('UNRELATED PRIVATE CONVERSATION MUST NOT BE RETAINED'));
    assert(source.provenance.originalSelectedConversation.mapping['synthetic-alternative']);
    assert.equal(await history(), null); same(await financial(), initialFinancial, 'Preparing a source must not change synthetic financial records.');
  });
  await test('historical archive requires explicit review and retains selected source provenance', async () => {
    await page.getByRole('button', { name: 'Validate mapped JSON', exact: true }).click();
    await page.getByRole('button', { name: 'Select valid rows', exact: true }).waitFor();
    assert.equal(await history(), null); await approveArchive();
    const saved = await history(); assert.equal(saved.records.length, 2);
    assert(saved.batches[0].rawSource.includes('SYNTHETIC-message-answer'));
    assert(!saved.batches[0].rawSource.includes('UNRELATED PRIVATE CONVERSATION MUST NOT BE RETAINED'));
    assert(saved.records.every(record => record.snapshot.verification === 'synthetic'));
    same(await financial(), initialFinancial, 'Archiving actual-source records must not register a bet or funding.');
  });
  await test('actual historical entry reaches ledger only through separate manual financial confirmation', async () => {
    const record = (await history()).records.find(item => item.snapshot.kind === 'actual');
    const row = page.getByRole('row').filter({ hasText: 'SYNTHETIC historical cash team' });
    await row.getByRole('button', { name: 'Review source', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Review actual-ledger registration', exact: true }).click();
    const dialog = page.getByRole('dialog'); const button = dialog.getByRole('button', { name: 'Confirm financial registration', exact: true });
    assert(await button.isDisabled()); await dialog.getByRole('checkbox').check(); await button.click();
    await page.getByRole('dialog').getByRole('button', { name: 'Already in actual ledger', exact: true }).waitFor();
    registeredFinancial = await financial(); assert.equal(registeredFinancial.bets.length, initialFinancial.bets.length + 1);
    same(registeredFinancial.transactions, initialFinancial.transactions, 'No funding can be inferred from an imported actual bet.');
    const bet = registeredFinancial.bets.find(item => item.id === record.id); assert.equal(bet.stakeCents, 500); assert.equal(bet.outcome, 'won'); assert.equal(bet.odds, 2);
    await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click(); await page.reload();
    same(await financial(), registeredFinancial, 'Confirmed synthetic ledger entry must survive reload.');
  });
  await test('owner-attested context is append-only and distinct from the unverified Day 5 checkpoint', async () => {
    await route('/research'); await handoff().getByRole('button', { name: 'Experiment context', exact: true }).click();
    const journal = page.getByRole('region', { name: 'Experiment context journal', exact: true });
    await journal.getByLabel('Source-confirmed completed day', { exact: true }).fill('5');
    await journal.getByLabel('Experiment context source reference', { exact: true }).fill('synthetic:browser:owner-attested-rules');
    await journal.getByLabel('Complete original experiment rules', { exact: true }).fill('SYNTHETIC test-only rules. Scope NBA/NBL/ATP/WTA; Sportsbet context only; lifetime AUD 500 funding cap; generally AUD 5 experimental stakes; Track A High Probability, B Potential Value, C Alternative Markets. Separate cash, bonus, funding and paper. No bookmaker login or wager execution.');
    for (const checkbox of await journal.getByRole('checkbox').all()) await checkbox.check();
    await journal.getByRole('button', { name: 'Review context journal', exact: true }).click();
    await journal.getByRole('checkbox', { name: /^I reviewed this source and explicitly confirm/ }).check();
    await journal.getByRole('button', { name: 'Confirm context journal', exact: true }).click();
    await journal.getByRole('button', { name: 'Review context journal', exact: true }).waitFor();
    const saved = await history(); assert.equal(saved.records.length, 3);
    const entry = saved.records.find(record => record.raw?.format === 'edgelab.experiment-context');
    assert(entry); assert.equal(entry.raw.completedDay, 5); assert.equal(entry.snapshot.kind, null);
    same(await financial(), registeredFinancial, 'A context journal must not change any financial or funding records.');
  });
  await test('Run Daily Research produces and copies a self-contained prompt without research or financial writes', async () => {
    const before = await history(); await handoff().getByRole('button', { name: 'Run Daily Research', exact: true }).click();
    const promptBox = handoff().getByRole('textbox', { name: /^Generated research prompt/ });
    const prompt = await promptBox.inputValue();
    assert((await promptBox.boundingBox())?.height >= 300, 'The generated desktop prompt must be large enough to inspect before copying.');
    assert(prompt.includes('NO API')); assert(prompt.includes('"latestConfirmedCompletedDay": 5')); assert(prompt.includes('"proposedResearchDay": 6'));
    for (const token of ['NBA', 'NBL', 'ATP', 'WTA', 'High Probability', 'Potential Value', 'Alternative Markets', 'unverified', 'SYNTHETIC']) assert(prompt.includes(token));
    await handoff().getByRole('button', { name: 'Copy Research Prompt', exact: true }).click();
    const copied = await page.evaluate(() => navigator.clipboard.readText()); assert(copied === prompt, 'Browser clipboard content did not match the generated synthetic prompt.');
    same(await history(), before, 'Generating/copying a prompt must not manufacture research records.');
    same(await financial(), registeredFinancial, 'Generating a prompt must not change bankroll.');
  });
  await test('malformed research JSON and LLM probabilities are blocked before registration', async () => {
    const before = await history(); await reviewResponse('{broken');
    await reviewRegion().getByRole('alert').filter({ hasText: 'Malformed research JSON' }).waitFor();
    const llm = structuredClone(response); llm.id = 'SYNTHETIC-invalid-llm-response'; llm.candidates[0].probability.origin = 'llm';
    await reviewResponse(llm); await reviewRegion().getByText(/LLM-generated numerical betting probabilities cannot be registered/).waitFor();
    assert(await reviewRegion().getByRole('checkbox', { name: 'Approve research row 1', exact: true }).isDisabled());
    same(await history(), before, 'Invalid research must not create a registered prediction.'); await backToResponse();
  });
  await test('missing bookmaker prices remain null and require explicit review rather than invented odds', async () => {
    const missing = structuredClone(response); missing.id = 'SYNTHETIC-missing-price-response'; missing.candidates[0].originalOdds = null; missing.candidates[0].estimatedEv = null;
    await reviewResponse(missing); await reviewRegion().locator('article').first().getByText('Price unavailable', { exact: false }).waitFor();
    await reviewRegion().getByText(/originalOdds: Missing source information remains null/).waitFor();
    assert(!(await reviewRegion().getByRole('checkbox', { name: 'Approve research row 1', exact: true }).isDisabled()));
    assert(await reviewRegion().getByRole('button', { name: 'Approve selected research', exact: true }).isDisabled());
    assert.equal((await history()).records.length, 3); await backToResponse();
  });
  await test('approved structured research atomically registers paper, pass history and an in-app alert', async () => {
    const before = await history(); await reviewResponse(response);
    for (const checkbox of await reviewRegion().getByRole('checkbox', { name: /^Approve research row/ }).all()) await checkbox.check();
    for (const checkbox of await reviewRegion().getByRole('checkbox', { name: /^I reviewed missing data, source claims/ }).all()) await checkbox.check();
    await reviewRegion().getByRole('checkbox', { name: /^I explicitly confirm Research Day 6 is complete/ }).check();
    await reviewRegion().getByRole('checkbox', { name: /^I reviewed the selected source records and approve immutable paper registration/ }).check();
    await reviewRegion().getByRole('button', { name: 'Approve selected research', exact: true }).click();
    await reviewRegion().getByRole('button', { name: 'Validate research response', exact: true }).waitFor();
    const saved = await history(); assert.equal(saved.revision, before.revision + 1); assert.equal(saved.records.length, 5);
    const record = saved.records.find(item => item.raw?.id === 'SYNTHETIC-browser-candidate-1'); assert(record);
    paperId = record.id; originalPaperSnapshot = structuredClone(record.snapshot);
    assert.equal(record.snapshot.kind, 'paper'); assert.equal(record.raw.proposedStatus, 'actual_requires_manual_confirmation');
    assert.equal(saved.paperResults.find(item => item.recordId === paperId).outcome, 'pending');
    assert.equal(saved.notifications.filter(item => item.recordId === paperId).length, 1);
    assert(saved.batches.at(-1).rawSource.includes('SYNTHETIC-browser-pass-1'));
    same(await financial(), registeredFinancial, 'Research approval must not create actual wagers or funding even when actual confirmation is proposed.');
  });
  await test('duplicate research responses are rejected without duplicate predictions or alerts', async () => {
    const before = await history(); await reviewResponse(response);
    await reviewRegion().getByText(/EXACT duplicate:/).first().waitFor();
    assert(await reviewRegion().getByRole('checkbox', { name: 'Approve research row 1', exact: true }).isDisabled());
    same(await history(), before, 'Duplicate review must not change source history or alert count.'); await backToResponse();
  });
  await test('outstanding-result reminders deduplicate and retain source navigation', async () => {
    await handoff().getByRole('button', { name: '1 · Research prompt', exact: true }).click();
    await handoff().getByRole('button', { name: 'Remind about result', exact: true }).click();
    await handoff().getByRole('button', { name: 'Remind about result', exact: true }).click();
    assert.equal((await appData()).notifications.filter(item => item.id === paperId).length, 1);
    await route('/notifications');
    const reminder = page.locator('article').filter({ hasText: `Paper result source: ${paperId}` });
    const link = reminder.getByRole('link', { name: 'Paper source details', exact: true });
    assert((await link.getAttribute('href')).includes(paperId)); await link.click();
    await page.getByRole('dialog').getByRole('heading', { name: 'SYNTHETIC research handoff player', exact: true }).waitFor();
    await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
    await route('/notifications');
    const alertRegion = page.getByRole('region', { name: 'Historical research notifications', exact: true });
    await alertRegion.getByRole('button', { name: 'Research source details', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
    assert((await history()).notifications.find(item => item.recordId === paperId).readAt);
    await reminder.getByRole('button', { name: 'Mark read', exact: true }).click();
    await reminder.getByRole('button', { name: /^Dismiss SYNTHETIC/ }).click();
    const saved = await appData(); assert(saved.notifications.find(item => item.id === paperId).readAt); assert(saved.notifications.find(item => item.id === paperId).dismissedAt);
    same(await financial(), registeredFinancial, 'A result reminder must not settle paper or change financial records.');
  });
  await test('final event and individual leg results persist without changing the frozen forecast or cash ledger', async () => {
    // Advance only the isolated browser clock, so the simulated result follows its fictional future event.
    await page.clock.setFixedTime(new Date(baseInstant + 27 * hour)); await route('/paper');
    const row = page.getByRole('row').filter({ hasText: 'SYNTHETIC research handoff player' });
    await row.getByRole('button', { name: 'Record result', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Imported paper outcome', { exact: true }).selectOption('won');
    await dialog.getByLabel('Imported result timestamp', { exact: true }).fill(iso(26 * hour));
    await dialog.getByLabel('Imported leg 1 outcome', { exact: true }).selectOption('won');
    await dialog.getByLabel('Imported leg 1 statistic', { exact: true }).fill('SYNTHETIC observed final 24 points; browser fixture source.');
    await dialog.getByRole('button', { name: 'Save paper result', exact: true }).click(); await dialog.waitFor({ state: 'hidden' });
    const saved = await history(); same(saved.records.find(record => record.id === paperId).snapshot, originalPaperSnapshot, 'Original source forecast changed during paper settlement.');
    const result = saved.paperResults.find(item => item.recordId === paperId); assert.equal(result.outcome, 'won'); assert.equal(result.legs[0].outcome, 'won');
    assert(saved.audit.some(entry => entry.recordId === paperId && entry.action === 'paper_result_recorded'));
    same(await financial(), registeredFinancial, 'Hypothetical settlement must not change actual bankroll or funding.');
    await page.reload(); await row.getByText('+$4.50', { exact: true }).waitFor();
  });
  await test('analytics and the next conversation use persisted results and confirmed day progression', async () => {
    await route('/analytics'); const imported = page.getByRole('region', { name: 'Imported paper analytics', exact: true });
    await imported.getByText('0.160', { exact: true }).waitFor(); await imported.getByText('-$0.50', { exact: true }).waitFor();
    await route('/research'); await handoff().getByRole('button', { name: 'Run Daily Research', exact: true }).click();
    const prompt = await handoff().getByRole('textbox', { name: /^Generated research prompt/ }).inputValue();
    assert(prompt.includes('"latestConfirmedCompletedDay": 6')); assert(prompt.includes('"proposedResearchDay": 7'));
    const currentContext = JSON.parse(await handoff().getByText('Inspect the source context', { exact: true }).locator('..').locator('pre').textContent());
    assert(!currentContext.outstanding.some(item => item.id === paperId));
    same(await financial(), registeredFinancial, 'Continuing into another research day must not alter financial data.');
  });
  if (await handoff().getByRole('button', { name: 'Export complete experiment', exact: true }).count()) {
    await test('complete continuity export contains both workspaces, original sources, rules and audits', async () => {
      const before = await history(); const beforeFinancial = await financial();
      const pending = page.waitForEvent('download');
      await handoff().getByRole('button', { name: 'Export complete experiment', exact: true }).click();
      const download = await pending; const stream = await download.createReadStream();
      assert(stream, 'A local continuity download must expose its contents.');
      let text = ''; for await (const chunk of stream) text += chunk.toString('utf8');
      const backup = JSON.parse(text);
      assert.equal(backup.format, 'edgelab.continuity-backup'); assert.equal(backup.version, 1); assert.equal(backup.workspaceMode, 'demo');
      same(backup.actualWorkspace, await appData(), 'Continuity export must contain the complete synthetic actual workspace.');
      same(backup.historicalWorkspace, before, 'Continuity export must include immutable sources and historical audits.');
      assert.equal(backup.handoffContext.latestConfirmedCompletedDay, 6);
      assert(backup.handoffContext.ownerProvidedRules.includes('SYNTHETIC test-only rules'));
      assert(backup.historicalWorkspace.batches[0].rawSource.includes('SYNTHETIC-message-answer'));
      assert(!Object.hasOwn(backup, 'session')); assert(!Object.hasOwn(backup, 'access_token'));
      same(await history(), before, 'Downloading a backup must not change registered sources.');
      same(await financial(), beforeFinancial, 'Downloading a backup must not change bookkeeping.');
    });
  } else skippedChecks.push({ name: 'complete continuity export', reason: 'The served application bundle does not expose the optional export control; rerun after the final build.' });
  await test('mobile handoff and conversation intake have no document overflow', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await route('/research'); assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    await page.screenshot({ path: path.join(artifacts, 'handoff-mobile.png'), fullPage: true });
    await route('/imports'); assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    await page.screenshot({ path: path.join(artifacts, 'conversation-import-mobile.png'), fullPage: true });
  });
  await test('all verification used synthetic local state without browser errors or escaped network requests', async () => {
    assert.deepEqual(runtimeErrors, []); assert.deepEqual(externalRequests, []);
  });
} catch { process.exitCode = 1; }
finally {
  await writeFile(path.join(artifacts, 'report.json'), JSON.stringify({
    syntheticOnly: true, hostedVerification: false, browserClockStartedAt: iso(0), browserClockAdvancedHours: 27,
    results, skippedChecks, runtimeErrors, externalRequests,
  }, null, 2));
  await browser.close();
}
