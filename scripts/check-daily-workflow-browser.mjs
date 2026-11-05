#!/usr/bin/env node
/** Complete local synthetic daily workflow. Fresh Demo browser and blocked
 * external transport only; no personal session, hosted record or live source. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';

const option = name => { const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1]; };
const runtime = option('--runtime'); if (!runtime) throw new Error('Pass an existing Playwright --runtime.');
const app = new URL(option('--url') ?? 'http://localhost:3000');
if (app.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(app.hostname)) throw new Error('Only a local HTTP application is supported.');
const { chromium } = createRequire(path.resolve(runtime, 'package.json'))('playwright');
const base = Date.now(), hour = 3600000;
const iso = offset => new Date(base + offset).toISOString();
const localDate = value => new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Melbourne', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
const localInput = value => { const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Melbourne', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value)); const part = name => parts.find(value => value.type === name)?.value; return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`; };
const candidate = (id, price) => ({ id, sport: 'NBA', eventId: `SYNTHETIC-${id}-event`, event: `SYNTHETIC daily fixture ${id}`, startsAt: iso(2 * hour), participant: `SYNTHETIC player ${id}`, marketId: `SYNTHETIC-${id}-points`, market: 'Player points', selection: 'Over 18.5 points', line: '18.5', bookmaker: 'SYNTHETIC BOOK', originalOdds: price, oddsTimestamp: iso(-10 * 60000), oddsSource: 'SYNTHETIC original research quote; never an available real price', oddsSourceUrl: 'https://example.invalid/synthetic-quote', predictionTimestamp: iso(-5 * 60000), probability: { value: null, origin: null, source: null, method: null, modelVersion: null, timestamp: null }, strategy: 'C', evidence: [{ claim: 'SYNTHETIC local workflow fixture only.', sourceUrl: 'https://example.invalid/synthetic-evidence', observedAt: iso(-12 * 60000), verification: 'unverified' }], sourceUrls: [], confidence: 'unknown', uncertainty: 'Entirely fictional test input; no live sports source or advantage is established.', decision: 'paper', proposedStatus: 'paper_only', rationale: 'SYNTHETIC manual workflow verification.', passReasons: [], hypotheticalStakeCents: 500, hypotheticalStakeType: 'cash', estimatedEv: null });
const source = { format: 'edgelab.research-response', version: 1, id: 'SYNTHETIC-daily-source-session', createdAt: iso(0), researchDate: localDate(base), researchDay: 6, dayStatus: 'draft', source: 'SYNTHETIC browser source', researchMethod: 'SYNTHETIC fixed test values only; no real event, odds or model.', sourceUrls: [], rulesSourceReference: 'SYNTHETIC-owner-methodology', candidates: [candidate('SYNTHETIC-placed', 2.04), candidate('SYNTHETIC-paper', 1.9)], passes: [{ id: 'SYNTHETIC-NO-BET', sport: 'WTA', event: null, reason: 'SYNTHETIC NO BET: no documented value established.', sourceUrls: [] }] };
const file = (name, value) => ({ name, mimeType: 'application/json', buffer: Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)) });

const loader = await createServer({ configFile: false, resolve: { alias: { '@': `${process.cwd()}/src` } }, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
let baseline, empty;
try {
  const imports = await loader.ssrLoadModule('/src/lib/imports/index.ts');
  const { prepareWagerClaimsReview } = await loader.ssrLoadModule('/src/lib/imports/wager-claims.ts');
  const { prepareExperimentContextV2Preview, PROPOSED_EXPERIMENT_METHODOLOGY } = await loader.ssrLoadModule('/src/lib/handoff/methodology.ts');
  const { createEmptyData } = await loader.ssrLoadModule('/src/lib/domain/fixtures.ts');
  empty = createEmptyData();
  const claims = { format: 'edgelab.historical-wager-claims', version: 1, sourceClass: 'synthetic', sourceId: 'SYNTHETIC-existing-eight-history', sourceReference: 'SYNTHETIC existing owner reports', sourceText: 'SYNTHETIC eight historical claims. No actual betting history.', checkpoint: null, records: Array.from({ length: 8 }, (_, i) => ({ reference: `SYNTHETIC-OLD-${i}`, sport: 'NBA', eventId: null, event: `SYNTHETIC old event ${i}`, participant: `SYNTHETIC old player ${i}`, marketId: null, market: 'Player points', selection: 'Over 10.5 points', line: '10.5', bookmaker: 'SYNTHETIC BOOK', reportedStakeCents: 500, stakeType: 'cash', reportedOdds: 1.9, reportedOddsKind: 'owner_reported', acceptedOdds: null, acceptedOddsSource: null, placedAt: null, settledAt: null, ticketId: null, reportedOutcome: 'pending', reportedCashPayoutCents: null, strategy: null, sourceReferences: [`SYNTHETIC source ${i}`], evidenceNotes: ['SYNTHETIC unverified historical claim only.'], legs: [] })) };
  const mapped = await prepareWagerClaimsReview({ text: JSON.stringify(claims), sourceName: 'synthetic-existing-eight.json', mode: 'demo' });
  const approve = preview => preview.rows.map(row => ({ rowNumber: row.rowNumber, include: true, acknowledgeIncomplete: true, allowProbableDuplicate: false }));
  baseline = imports.commitHistoricalImport(imports.emptyHistoricalWorkspace(), imports.prepareImportCommit(mapped.preview, approve(mapped.preview), 'synthetic'));
  const paper = await imports.parseHistoricalSource({ text: JSON.stringify([{ externalId: 'SYNTHETIC-old-paper', kind: 'paper', sport: 'NBA', event: 'SYNTHETIC old paper event', participant: 'SYNTHETIC old archive player', market: 'Player points', selection: '25+ points', line: '25', odds: 1.72, outcome: 'won', sourceReference: 'SYNTHETIC old summary', notes: 'SYNTHETIC historical secondary summary; original pre-registration unavailable.' }]), sourceName: 'synthetic-old-paper.json', format: 'json', verification: 'synthetic' });
  baseline = imports.commitHistoricalImport(baseline, imports.prepareImportCommit(paper, approve(paper), 'synthetic', baseline.records));
  const paperId = baseline.records.at(-1).id;
  baseline = imports.registerHistoricalPaper(baseline, paperId);
  baseline = imports.createHistoricalNotification(baseline, paperId);
  baseline = imports.markHistoricalNotificationRead(baseline, baseline.notifications[0].id);
  baseline = imports.dismissHistoricalNotification(baseline, baseline.notifications[0].id);
  const policy = await prepareExperimentContextV2Preview({ ownerReportedDay: 6, sourceConfirmedCompletedDay: null, sourceConfirmedDayReference: null, researchCreationDate: localDate(base), eventDate: null, methodology: { ...structuredClone(PROPOSED_EXPERIMENT_METHODOLOGY), title: 'SYNTHETIC already approved methodology', sourceReferences: ['SYNTHETIC local-only policy fixture'] }, methodologyApprovalConfirmed: true, rulesCompleteConfirmed: false, sourceReference: 'SYNTHETIC owner-reported active day 6; not complete', verification: 'synthetic', confirmed: true });
  baseline = imports.commitHistoricalImport(baseline, imports.prepareImportCommit(policy, approve(policy), 'synthetic', baseline.records));
} finally { await loader.close(); }

const browser = await chromium.launch({ headless: true, executablePath: option('--browser') ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, timezoneId: 'Australia/Melbourne', reducedMotion: 'reduce' });
const network = [], errors = [], checks = [];
await context.route('**/*', route => { if (new URL(route.request().url()).origin === app.origin) return route.continue(); network.push(new URL(route.request().url()).origin); return route.abort('blockedbyclient'); });
await context.addInitScript(({ actual, history }) => { if (!localStorage.getItem('SYNTHETIC-daily-browser-initialized')) { localStorage.setItem('edgelab:demo:v1', JSON.stringify(actual)); localStorage.setItem('edgelab:history:demo:v1', JSON.stringify(history)); localStorage.setItem('edgelab:workspace', 'demo'); localStorage.setItem('SYNTHETIC-daily-browser-initialized', 'yes'); } }, { actual: empty, history: baseline });
const page = await context.newPage(); page.setDefaultTimeout(15000);
page.on('pageerror', error => errors.push(error.message));
await page.clock.install({ time: new Date(base) });
const data = () => page.evaluate(() => JSON.parse(localStorage.getItem('edgelab:demo:v1')));
const history = () => page.evaluate(() => JSON.parse(localStorage.getItem('edgelab:history:demo:v1')));
const daily = () => page.getByRole('region', { name: 'Daily research workspace', exact: true });
const results = () => page.getByRole('region', { name: 'Results workspace', exact: true });
const sourceRecords = async () => (await history()).records.filter(record => record.raw?.id === 'SYNTHETIC-placed' || record.raw?.id === 'SYNTHETIC-paper');
async function preserved() { const saved = await history(); assert.deepEqual(saved.records.slice(0, baseline.records.length), baseline.records); assert.deepEqual(saved.audit.slice(0, baseline.audit.length), baseline.audit); assert.deepEqual(saved.paperResults.find(row => row.recordId === baseline.paperResults[0].recordId), baseline.paperResults[0]); assert.deepEqual(saved.notifications.find(row => row.id === baseline.notifications[0].id), baseline.notifications[0]); assert.deepEqual((await data()).transactions, []); }
async function check(name, fn) { try { await fn(); checks.push({ name, passed: true }); process.stdout.write(`PASS ${name}\n`); } catch (cause) { checks.push({ name, passed: false, error: cause.message }); process.stdout.write(`FAIL ${name}: ${cause.message}\n`); throw cause; } }
let actualId, paperId, originalResearch, fullResponse;
try {
  await check('existing synthetic archive is preserved and is not financially backfilled', async () => { await page.goto(new URL('/research', app).href); await daily().getByRole('button', { name: 'Import research JSON', exact: true }).waitFor(); await preserved(); assert.equal((await data()).bets.length, 0); });
  await check('research JSON imports to actionable sources without automatic actual or paper positions', async () => {
    await daily().getByRole('button', { name: 'Import research JSON', exact: true }).click();
    const modal = page.getByRole('dialog', { name: 'Import daily research', exact: true });
    await modal.getByLabel('Upload research response JSON', { exact: true }).setInputFiles(file('synthetic-daily-research.json', source));
    await modal.getByRole('button', { name: 'Select eligible research candidates', exact: true }).click();
    await modal.getByLabel('Approve selected research and warnings', { exact: true }).check();
    await modal.getByRole('button', { name: 'Import research candidates', exact: true }).click();
    await modal.waitFor({ state: 'hidden' });
    await daily().getByRole('article', { name: 'Daily selection SYNTHETIC-placed', exact: true }).waitFor();
    originalResearch = structuredClone(await sourceRecords()); assert.equal(originalResearch.length, 2); assert.equal((await data()).bets.length, 0); assert.equal((await history()).paperResults.length, 1); await preserved();
  });
  await check('one-time placed confirmation prefills selection but requires distinct accepted odds and time', async () => {
    const card = daily().getByRole('article', { name: 'Daily selection SYNTHETIC-placed', exact: true });
    await card.getByRole('button', { name: 'Confirm Placed', exact: true }).click();
    const modal = page.getByRole('dialog');
    assert.equal(await modal.getByLabel('Accepted decimal odds', { exact: true }).inputValue(), '');
    assert.equal(await modal.getByLabel('Placed at · Melbourne', { exact: true }).inputValue(), '');
    assert.equal(await modal.getByLabel('Participant / team', { exact: true }).inputValue(), source.candidates[0].participant);
    await modal.getByLabel('Accepted decimal odds', { exact: true }).fill('2.00');
    await modal.getByLabel('Placed at · Melbourne', { exact: true }).fill(localInput(base));
    await modal.getByLabel('Sportsbook ticket reference · optional', { exact: true }).fill('SYNTHETIC-DAILY-TICKET');
    await modal.getByRole('button', { name: 'Review financial registration', exact: true }).click();
    assert.equal((await data()).bets.length, 0);
    await modal.getByRole('checkbox', { name: /^I confirm this is a synthetic ledger test/ }).check();
    await modal.getByRole('button', { name: 'Confirm financial registration', exact: true }).click(); await modal.waitFor({ state: 'hidden' });
    actualId = (await data()).bets[0].id; assert.equal((await data()).bets[0].odds, 2); assert.equal((await history()).paperResults.length, 1);
    assert(await card.getByRole('button', { name: 'Confirm Placed', exact: true }).isDisabled());
    assert(await card.getByRole('button', { name: 'Track as Paper', exact: true }).isDisabled());
    assert.deepEqual(await sourceRecords(), originalResearch); await preserved();
  });
  await check('paper approval is separate and keeps the original forecast immutable', async () => {
    const card = daily().getByRole('article', { name: 'Daily selection SYNTHETIC-paper', exact: true });
    await card.getByRole('button', { name: 'Track as Paper', exact: true }).click();
    const modal = page.getByRole('dialog', { name: 'Approve pre-event paper tracking', exact: true });
    assert.equal((await history()).paperResults.length, 1);
    await modal.getByRole('button', { name: 'Track as Paper', exact: true }).click(); await modal.waitFor({ state: 'hidden' });
    paperId = (await sourceRecords()).find(record => record.raw.id === 'SYNTHETIC-paper').id;
    assert.equal((await history()).paperResults.length, 2); assert.equal((await data()).bets.length, 1); assert.deepEqual(await sourceRecords(), originalResearch); await preserved();
  });
  await check('results check is honest about manual coverage and excludes legacy claims', async () => {
    await page.clock.fastForward(3 * hour); await daily().getByRole('button', { name: 'Results and settlements', exact: true }).click();
    await results().getByRole('article', { name: `Result position ${actualId}`, exact: true }).waitFor();
    await results().getByRole('button', { name: 'Check Results', exact: true }).click();
    await results().getByText(/Outstanding records refreshed/).waitFor();
    assert((await results().innerText()).includes('no result is automatically saved'));
    assert.equal(await results().getByRole('article').count(), 2); await preserved();
  });
  await check('results prompt contains exact unresolved IDs and a separate versioned response contract', async () => {
    await results().getByRole('button', { name: 'Generate Results Check Prompt', exact: true }).click();
    const prompt = await results().getByLabel('Results check prompt', { exact: true }).inputValue();
    assert(prompt.includes(actualId) && prompt.includes(paperId)); assert(prompt.includes('edgelab.settlement-response')); assert(prompt.includes('SYNTHETIC-daily-source-session')); assert(!prompt.includes('SYNTHETIC-OLD-0'));
  });
  await check('manual results are entered together with explicit evidence, terms and actual payout', async () => {
    for (const id of [actualId, paperId]) {
      const card = results().getByRole('article', { name: `Result position ${id}`, exact: true });
      await card.getByLabel(`Result ${id}`, { exact: true }).selectOption('won');
      await card.getByLabel(`Settlement time ${id}`, { exact: true }).fill(localInput(base + 3 * hour));
      if (id === actualId) await card.getByLabel(`Cash payout ${id}`, { exact: true }).fill('10.00');
      await card.getByLabel(`Settlement terms ${id}`, { exact: true }).fill('SYNTHETIC owner-checked player points including overtime; no exceptional case.');
      await card.getByLabel(`Event completed ${id}`, { exact: true }).check();
      await card.getByLabel(`Terms confirmed ${id}`, { exact: true }).check();
      await card.getByLabel(`Owner attestation ${id}`, { exact: true }).check();
    }
    await results().getByRole('button', { name: 'Select all ready outcomes', exact: true }).waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll('section[aria-label="Results workspace"] input[aria-label^="Select result"]')].filter(input => !input.disabled).length === 2);
    assert.equal((await data()).bets[0].outcome, 'pending'); assert.equal((await history()).paperResults.find(row => row.recordId === paperId).outcome, 'pending');
  });
  await check('batch cancellation and final authorization prevent premature financial writes', async () => {
    await results().getByRole('button', { name: 'Select all ready outcomes', exact: true }).click();
    await results().getByRole('button', { name: 'Review selected settlements', exact: true }).click();
    const modal = page.getByRole('dialog', { name: 'Confirm reviewed settlement batch', exact: true });
    assert(await modal.getByRole('button', { name: 'Confirm selected settlements', exact: true }).isDisabled());
    await modal.getByRole('button', { name: 'Cancel batch review', exact: true }).click();
    assert.equal((await data()).bets[0].outcome, 'pending'); assert.equal((await history()).paperResults.find(row => row.recordId === paperId).outcome, 'pending');
    await results().getByRole('button', { name: 'Review selected settlements', exact: true }).click();
    await modal.getByLabel('Authorize reviewed settlement batch', { exact: true }).check(); await modal.getByRole('button', { name: 'Confirm selected settlements', exact: true }).click(); await modal.waitFor({ state: 'hidden' });
    await results().getByText(/2 reviewed results persisted/).waitFor();
    assert.equal((await data()).bets[0].outcome, 'won'); assert.equal((await history()).paperResults.find(row => row.recordId === paperId).outcome, 'won');
    fullResponse = (await data()).audit.find(audit => audit.after?.sourceResponse)?.after.sourceResponse; assert(fullResponse); assert.deepEqual(await sourceRecords(), originalResearch); await preserved();
  });
  await check('replaying the exact results response performs no second settlement', async () => {
    const oldData = await data(), oldHistory = await history();
    await results().getByLabel('Settlement response JSON', { exact: true }).fill(JSON.stringify(fullResponse));
    await results().getByRole('button', { name: 'Validate imported results', exact: true }).click();
    await page.waitForTimeout(400);
    assert(await results().getByRole('button', { name: 'Select all ready outcomes', exact: true }).isDisabled());
    assert(await results().getByRole('button', { name: 'Review selected settlements', exact: true }).isDisabled());
    assert.deepEqual(await data(), oldData); assert.deepEqual(await history(), oldHistory);
  });
  await check('invalid result identities remain blocked without changing authoritative records', async () => {
    const invalid = structuredClone(fullResponse); invalid.id = 'SYNTHETIC-invalid-record-response'; invalid.observations[0].recordId = '90000000-0000-4000-8000-000000000099';
    await results().getByLabel('Settlement response JSON', { exact: true }).fill(JSON.stringify(invalid));
    await results().getByRole('button', { name: 'Validate imported results', exact: true }).click();
    await results().getByRole('heading', { name: 'Unmatched imported records', exact: true }).waitFor();
    assert(await results().getByRole('button', { name: 'Review selected settlements', exact: true }).isDisabled()); await preserved();
  });
  await check('analytics update from persisted actual and paper results without manufactured funding', async () => {
    await page.goto(new URL('/analytics', app).href); await page.getByRole('heading', { level: 1 }).waitFor();
    const current = await data(); assert.equal(current.bets.length, 1); assert.equal(current.bets[0].stakeCents, 500); assert.equal(current.bets[0].odds, 2); assert.equal(current.bets[0].outcome, 'won'); assert.deepEqual(current.transactions, []); assert.equal(current.settings.fundingCapCents, 50000);
    assert((await page.locator('main').innerText()).includes('5.00')); await preserved();
  });
  await check('paper evaluation exports qualifying results and labels synthetic historical exclusions', async () => {
    const panel = page.getByRole('region', { name: 'Paper evaluation laboratory', exact: true });
    await panel.getByText(/Hit rate: 100\.0%/).waitFor(); await panel.getByText(/Hypothetical ROI: 90\.0%/).waitFor();
    const download = page.waitForEvent('download'); await panel.getByRole('button', { name: 'Export evaluation dataset', exact: true }).click();
    const file = await download; const exported = JSON.parse(await readFile(await file.path(), 'utf8'));
    assert.equal(exported.format, 'edgelab.paper-evaluation'); assert.equal(exported.containsSynthetic, true);
    assert.equal(exported.evaluation.settledCount, 1); assert.equal(exported.evaluation.scoredCount, 0); assert.equal(exported.evaluation.hypotheticalProfitCents, 450);
    assert(exported.rows.some(row => !row.eligible)); assert(exported.rows.every(row => row.sourceClass === 'synthetic')); await preserved();
  });
  await check('sports proxy rejects anonymous and cross-origin reads without spending provider quota', async () => {
    const anonymous = await context.request.post(new URL('/api/sports', app).href, { data: { provider: 'api-nba', operation: 'status', parameters: {} } }); assert.equal(anonymous.status(), 401); assert.equal(anonymous.headers()['cache-control'], 'no-store');
    const foreign = await context.request.post(new URL('/api/sports', app).href, { headers: { Origin: 'https://example.invalid' }, data: {} }); assert.equal(foreign.status(), 403);
  });
  await check('the next handoff includes persisted results without completing or advancing Day 6', async () => {
    await page.goto(new URL('/research', app).href); const handoff = page.getByRole('region', { name: 'Research Handoff', exact: true });
    await handoff.getByRole('button', { name: '1 · Research prompt', exact: true }).click(); await handoff.getByRole('button', { name: 'Run Daily Research', exact: true }).click();
    const prompt = await handoff.getByLabel('Generated research prompt', { exact: true }).inputValue();
    assert(prompt.includes('owner_approved')); assert(prompt.includes('"latestSourceConfirmedCompletedDay": null')); assert(prompt.includes('"proposedResearchDay": 6')); assert(prompt.includes('SYNTHETIC')); await preserved();
  });
  await check('browser reload and mobile daily workspace preserve source history and saved positions', async () => {
    await page.reload(); await daily().getByRole('button', { name: 'Results and settlements', exact: true }).click(); await results().getByText('Already settled (2)', { exact: true }).waitFor(); await page.setViewportSize({ width: 390, height: 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); await preserved(); assert.deepEqual(network, []); assert.deepEqual(errors, []);
  });
} catch { process.exitCode = 1; }
finally {
  const output = option('--report') ?? '/private/tmp/edgelab-daily-workflow-browser.json'; await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify({ scope: 'Synthetic local daily workflow; no hosted requests or personal browser context', createdAt: new Date().toISOString(), hostedVerification: false, checksPassed: checks.filter(check => check.passed).length, checksFailed: checks.filter(check => !check.passed).length, results: checks, externalRequests: network, runtimeErrors: errors }, null, 2));
  await browser.close();
}
