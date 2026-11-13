import {applyLocalMigration} from './lib/local-migration.mjs';
/** Local embedded PostgreSQL checks only. No environment files or hosted APIs are read. */
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const runtimeFlag = process.argv.indexOf('--runtime');
if (runtimeFlag < 0 || !process.argv[runtimeFlag + 1]) throw new Error('Usage: node scripts/check-import-database.mjs --runtime /absolute/path/to/temp/npm-prefix');
const runtime = createRequire(path.resolve(process.argv[runtimeFlag + 1], 'package.json'));
const { PGlite } = runtime('@electric-sql/pglite');
const db = new PGlite();
const hash = value => createHash('sha256').update(value).digest('hex');
const uid = n => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const stamp = '2026-11-04T08:00:00.000Z';
const later = '2026-11-04T10:00:00.000Z';
const owner = uid(1), other = uid(2);
let checks = 0;
let activeOwner = null;
function pass(label) { checks++; console.log(`PASS ${label}`); }
async function rejected(operation, pattern, label) { await assert.rejects(operation, pattern); pass(label); }
async function login(id, role = 'authenticated') {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.query("select set_config('edgelab.history_save','',false)");
  await db.exec(`set role ${role}`);
  activeOwner = id || null;
}
const load = async (expectedOwner = activeOwner) => (await db.query('select public.edgelab_load_history($1::uuid) result', [expectedOwner])).rows[0].result;
const save = async (workspace, revision, expectedOwner = activeOwner) => (await db.query('select public.edgelab_save_history($1::jsonb,$2::bigint,$3::uuid) result', [JSON.stringify(workspace), revision, expectedOwner])).rows[0].result;
const empty = () => ({ revision: 0, batches: [], records: [], paperResults: [], notifications: [], audit: [] });
function snapshot(overrides = {}) {
  return { externalId: null, eventId: null, marketId: null, kind: null, sport: null, event: null, participant: null, market: null, selection: null, line: null, bookmaker: null, odds: null, predictionAt: null, placedAt: null, settledAt: null, probability: null, probabilitySource: null, probabilityMethod: null, modelVersion: null, strategy: null, sourceReference: null, stakeCents: null, stakeType: null, payoutCents: null, outcome: null, verification: 'unverified', notes: 'LOCAL SYNTHETIC SQL TEST ONLY; no real research or financial ledger entry', legs: [], ...overrides };
}
function leg(n, overrides = {}) {
  return { id: uid(n), sport: 'NBA', eventId: null, event: 'LOCAL SYNTHETIC Home v Away', participant: 'LOCAL SYNTHETIC Player', marketId: null, market: 'Points', selection: 'Over', line: '18.5', odds: 1.95, outcome: null, statistic: null, ...overrides };
}
function importBatch(n, snapshots) {
  const id = uid(n);
  const rawSource = JSON.stringify({ notice: 'LOCAL SYNTHETIC TEST; never sent to hosted Supabase', records: snapshots });
  const batch = { id, createdAt: stamp, sourceName: 'LOCAL SYNTHETIC import test.json', format: 'json', rawSource, sourceHash: hash(rawSource), verification: 'unverified', summary: { parsed: snapshots.length, imported: snapshots.length, skipped: 0, warnings: 0, actual: snapshots.filter(s => s.kind === 'actual').length, paper: snapshots.filter(s => s.kind === 'paper').length } };
  const records = snapshots.map((s, index) => ({ id: uid(n + index + 1), batchId: id, rowNumber: index + 1, importedAt: stamp, raw: { sourceTestNotice: 'LOCAL SYNTHETIC SQL TEST', ...s }, fingerprint: hash(`local-fixture-${n}-${index}`), snapshot: s, issues: [], transformations: [], probableDuplicateConfirmed: false, incompleteConfirmed: true }));
  return { batch, records };
}
function addBatch(workspace, batch) { workspace.batches.push(batch.batch); workspace.records.push(...batch.records); return workspace; }
function notification(recordId, n) { return { id: uid(n), recordId, dedupeKey: `historical-research:${recordId}`, title: 'LOCAL SYNTHETIC research test', message: 'No real opportunity or wager', createdAt: stamp, readAt: null, dismissedAt: null }; }
async function next(workspace, mutate) { const value = structuredClone(workspace); mutate(value); value.revision = workspace.revision + 1; assert.equal(await save(value, workspace.revision), value.revision); return load(); }

try {
  await db.exec("create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid stable language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;");
  const directory = new URL('../supabase/migrations/', import.meta.url);
  const files = (await fs.readdir(directory)).filter(name => /^\d+_.+\.sql$/.test(name)).sort();
  for (const file of files) await applyLocalMigration(db, file, (await fs.readFile(new URL(file, directory), 'utf8')).replace('create extension if not exists pgcrypto;', '-- gen_random_uuid is built in'));
  assert.deepEqual(files, ['202611030001_edgelab.sql', '202611030002_harden_workspace_integrity.sql', '202611040001_historical_import.sql','202611130002_v6_source_cloud_compatible.sql','202611130003_v6_source_rpc_acl.sql']);
  pass('all five deployed migrations apply in order without hosted access');
  await db.query('insert into auth.users(id) values($1),($2)', [owner, other]);
  await login(owner);
  assert.equal((await db.query('select current_user role')).rows[0].role, 'authenticated');
  pass('security assertions run as nonprivileged authenticated role');
  await rejected(() => load(other), /Authenticated historical owner changed/i, 'first account cannot read using a second account expectation');
  await rejected(() => save({ ...empty(), revision: 1 }, 0, other), /Authenticated historical owner changed/i, 'first account cannot write using a second account expectation');
  await rejected(() => load(null), /Authenticated historical owner changed/i, 'required owner expectation cannot be bypassed with null');
  assert.deepEqual(await load(), empty()); pass('new historical workspace is empty without reading demo storage');
  const tableNames = ['historical_workspace_revisions', 'historical_import_batches', 'historical_research_records', 'historical_paper_results', 'historical_notifications', 'historical_audit_history'];
  const policy = await db.query("select tablename from pg_policies where schemaname='public' and policyname='historical_owner' order by tablename");
  assert.deepEqual(policy.rows.map(v => v.tablename), [...tableNames].sort()); pass('all six historical tables have owner RLS policies');
  assert.equal((await db.query("select count(*)::int n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=any($1) and c.relrowsecurity", [tableNames])).rows[0].n, 6); pass('RLS is enabled on all historical tables');
  assert.equal((await db.query("select count(*)::int n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname like 'edgelab_history_%' or p.proname in ('edgelab_load_history','edgelab_save_history')) and p.prosecdef")).rows[0].n, 0); pass('history RPCs and triggers use SECURITY INVOKER');
  const functions = await db.query("select p.oid,has_function_privilege('anon',p.oid,'EXECUTE') anon_execute,exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE') public_execute from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname like 'edgelab_history_%' or p.proname in ('edgelab_load_history','edgelab_save_history'))");
  assert.equal(functions.rows.length, 22); assert.ok(functions.rows.every(f => !f.anon_execute && !f.public_execute)); pass('all 22 new functions revoke default PUBLIC and anonymous execution');

  const source = importBatch(10, [snapshot(), snapshot({ kind: 'paper', sport: 'NBA', event: 'LOCAL SYNTHETIC test', odds: 1.95, stakeCents: 501, stakeType: 'cash', predictionAt: stamp, externalId: 'LOCAL-FORECAST-1', sourceReference: 'LOCAL synthetic export', legs: [leg(31), leg(32)] }), snapshot({ kind: 'actual', odds: 2.25, stakeCents: 501, stakeType: 'bonus', outcome: 'won', payoutCents: 626, predictionAt: stamp, placedAt: stamp, settledAt: later })]);
  let workspace = addBatch(empty(), source); workspace.revision = 1;
  assert.equal(await save(workspace, 0), 1); workspace = await load(); pass('atomic approved import saves raw source and immutable snapshots');
  assert.equal(workspace.batches[0].rawSource, source.batch.rawSource); assert.equal(workspace.records.find(r => r.id === source.records[0].id).snapshot.odds, null); pass('source bytes and unknown nullable fields survive persistence');
  assert.equal(workspace.audit.filter(a => a.action === 'import_confirmed').length, 1); pass('database appends an import confirmation audit even for direct clients');
  const amounts = (await db.query('select stake,reported_payout,decimal_odds,probability from public.historical_research_records where id=$1', [source.records[2].id])).rows[0];
  assert.equal(Number(amounts.stake), 5.01); assert.equal(Number(amounts.reported_payout), 6.26); assert.equal(Number(amounts.decimal_odds), 2.25); assert.equal(amounts.probability, null); pass('cash and bonus archive values use exact nullable NUMERIC columns');
  assert.equal((await db.query('select count(*)::int n from public.bets')).rows[0].n, 0); assert.equal((await db.query('select count(*)::int n from public.financial_transactions')).rows[0].n, 0); pass('historical actual and paper imports do not create bets or funding transactions');

  const changed = structuredClone(workspace); changed.revision++; changed.records[0].snapshot.odds = 2;
  await rejected(() => save(changed, workspace.revision), /immutable/i, 'registered original forecast cannot be rewritten through RPC');
  await rejected(() => db.query("update public.historical_research_records set payload=jsonb_set(payload,'{raw}','{}') where id=$1", [source.records[0].id]), /immutable/i, 'original raw row and transformations cannot be rewritten directly');
  await rejected(() => db.query("update public.historical_import_batches set payload=jsonb_set(payload,'{sourceName}','\"changed\"') where id=$1", [source.batch.id]), /immutable/i, 'source batch and source hash are immutable');
  await rejected(() => db.query("update public.historical_audit_history set payload=jsonb_set(payload,'{after}','null')"), /immutable/i, 'audit history is append-only');
  const omit = structuredClone(workspace); omit.revision++; omit.records.pop();
  await rejected(() => save(omit, workspace.revision), /cannot be deleted/i, 'full-snapshot omission cannot delete historical records');
  await rejected(() => save({ ...workspace, revision: workspace.revision + 1 }, 0), /revision conflict/i, 'stale saves are rejected before any import write');

  const invalidBatch = importBatch(100, [snapshot({ odds: 2 })]); invalidBatch.batch.sourceHash = '0'.repeat(64);
  await rejected(() => next(workspace, w => addBatch(w, invalidBatch)), /source\/hash/i, 'raw source SHA-256 mismatch is rejected');
  const synthetic = importBatch(110, [snapshot({ verification: 'synthetic' })]); synthetic.batch.verification = 'synthetic';
  await rejected(() => next(workspace, w => addBatch(w, synthetic)), /synthetic data stays in Demo/i, 'synthetic classifications cannot be imported into private storage');
  const nullClassification = importBatch(120, [snapshot({ verification: null })]); nullClassification.batch.verification = null;
  await rejected(() => next(workspace, w => addBatch(w, nullClassification)), /invalid/i, 'JSON null cannot bypass required provenance classification');
  for (const [label, overrides] of [['fractional cents', { stakeCents: 500.5 }], ['financial numeric strings', { stakeCents: '500' }], ['inconsistent bonus payout', { kind: 'actual', stakeCents: 500, stakeType: 'bonus', odds: 2, outcome: 'won', payoutCents: 1000 }], ['pending payout', { outcome: 'pending', payoutCents: 100 }], ['zero actual stake', { kind: 'actual', stakeCents: 0 }]]) {
    const invalid = importBatch(130, [snapshot(overrides)]);
    await rejected(() => next(workspace, w => addBatch(w, invalid)), /record validation/i, `${label} rejected at the SQL boundary`);
  }
  for (const prefix of ['\n', '\u00a0', '\ufeff']) {
    const invalid = importBatch(135, [snapshot({ event: `${prefix}Unnormalized source label` })]);
    await assert.rejects(() => next(workspace, w => addBatch(w, invalid)), /record validation/i);
  }
  pass('direct text writes cannot poison immutable snapshots through client-side Unicode trimming');
  const unacknowledged = importBatch(140, [snapshot()]); unacknowledged.records[0].issues = [{ field: 'odds', severity: 'warning', code: 'MISSING', message: 'Original odds unknown' }]; unacknowledged.records[0].incompleteConfirmed = false; unacknowledged.batch.summary.warnings = 1;
  await rejected(() => next(workspace, w => addBatch(w, unacknowledged)), /record validation/i, 'missing-field warnings require explicit confirmation');
  const partialVoid = importBatch(145, [snapshot({ kind: 'paper', stakeCents: 500, stakeType: 'cash', odds: 3.2, outcome: 'won', payoutCents: 1000, legs: [leg(146, { outcome: 'won' }), leg(147, { outcome: 'void' })] })]);
  await rejected(() => next(workspace, w => addBatch(w, partialVoid)), /record validation/i, 'partial-void payout needs an explicit unresolved reconciliation warning');
  partialVoid.records[0].issues = [{ field: 'payoutCents', severity: 'warning', code: 'partial_void_requires_reconciliation', message: 'Adjusted settlement odds are unknown; original odds cannot price partial-void returns' }];
  assert.equal((await db.query('select public.edgelab_history_record($1::jsonb) valid', [partialVoid.records[0]])).rows[0].valid, true); pass('acknowledged partial-void archive preserves source payout without fabricating adjusted odds');
  const allVoid = structuredClone(partialVoid); allVoid.records[0].snapshot.legs.forEach(l => l.outcome = 'void');
  await rejected(() => next(workspace, w => addBatch(w, allVoid)), /record validation/i, 'original won snapshots cannot contradict all-void source legs');
  const orphanAudit = { id: uid(148), recordId: source.records[0].id, batchId: null, action: 'paper_registered', timestamp: stamp, before: null, after: null };
  await rejected(() => db.query('insert into public.historical_audit_history(id,user_id,record_id,payload,created_at) values($1,$2,$3,$4,$5)', [orphanAudit.id, owner, orphanAudit.recordId, orphanAudit, stamp]), /original source batch/i, 'record audits must retain their matching original source batch');
  const duplicate = importBatch(150, [snapshot()]); duplicate.records[0].fingerprint = source.records[0].fingerprint;
  await rejected(() => next(workspace, w => addBatch(w, duplicate)), /unique constraint/i, 'exact fingerprints cannot be duplicated with a new UUID');
  const external = importBatch(160, [snapshot({ externalId: 'LOCAL-FORECAST-1', sourceReference: 'LOCAL synthetic export' })]);
  await rejected(() => next(workspace, w => addBatch(w, external)), /historical_external_reference/i, 'same source and external reference cannot be silently duplicated');
  assert.equal((await load()).batches.length, 1); pass('rejected source and duplicate imports leave no partially saved batch');
  const boundaryRaw = Object.fromEntries(Array.from({ length: 99 }, (_, index) => [`field${index}`, 0])); boundaryRaw.padding = '';
  boundaryRaw.padding = 'x'.repeat(1_048_574 - Buffer.byteLength(JSON.stringify(boundaryRaw), 'utf8'));
  const boundary = importBatch(170, [snapshot()]); boundary.batch.rawSource = JSON.stringify([boundaryRaw]); boundary.batch.sourceHash = hash(boundary.batch.rawSource); boundary.records[0].raw = boundaryRaw;
  assert.equal(Buffer.byteLength(boundary.batch.rawSource, 'utf8'), 1_048_576);
  assert.ok((await db.query('select octet_length(($1::jsonb)::text) bytes', [boundaryRaw])).rows[0].bytes > 1_048_576);
  // Exercise the full save, deferred constraints and read path, then discard this
  // large local-only fixture so subsequent checks keep a small workspace.
  await db.exec('begin');
  try {
    const value = addBatch(structuredClone(workspace), boundary); value.revision++;
    assert.equal(await save(value, workspace.revision), value.revision); await db.exec('set constraints all immediate');
    assert.deepEqual((await load()).records.find(record => record.id === boundary.records[0].id).raw, boundaryRaw);
  } finally { await db.exec('rollback'); }
  pass('exactly 1 MiB compact source survives PostgreSQL JSONB whitespace expansion');

  const paperId = source.records[1].id;
  const result = { recordId: paperId, outcome: 'pending', settledAt: null, statistic: null, legs: [31, 32].map(n => ({ legId: uid(n), outcome: 'pending', statistic: null })), updatedAt: stamp };
  workspace = await next(workspace, w => w.paperResults.push(result)); pass('paper registration retains exact original leg identities');
  const unknown = structuredClone(workspace); unknown.paperResults[0].legs[0].legId = uid(999); unknown.revision++;
  await rejected(() => save(unknown, workspace.revision), /unknown original leg/i, 'paper results cannot attach an unregistered leg');
  const mismatch = structuredClone(workspace); mismatch.paperResults[0].outcome = 'won'; mismatch.revision++;
  await rejected(() => save(mismatch, workspace.revision), /Won paper result/i, 'paper aggregate results must agree with individual leg results');
  const premature = structuredClone(workspace); premature.paperResults[0].settledAt = '2026-01-01T00:00:00Z'; premature.paperResults[0].outcome = 'won'; premature.paperResults[0].legs.forEach(l => l.outcome = 'won'); premature.revision++;
  await rejected(() => save(premature, workspace.revision), /precede original/i, 'paper settlement cannot precede original forecast');
  const convert = structuredClone(workspace); convert.paperResults.push({ ...result, recordId: source.records[2].id, legs: [] }); convert.revision++;
  await rejected(() => save(convert, workspace.revision), /Actual records cannot/i, 'actual archive records cannot be converted into paper predictions');
  workspace = await next(workspace, w => { w.paperResults[0] = { ...result, outcome: 'won', settledAt: later, updatedAt: later, legs: result.legs.map(l => ({ ...l, outcome: 'won', statistic: 'LOCAL synthetic 24 points' })) }; });
  assert.deepEqual(workspace.records.find(r => r.id === paperId).snapshot, source.records[1].snapshot); pass('paper settlement and leg statistics persist without changing original forecast');
  assert.ok(workspace.audit.some(a => a.action === 'paper_registered')); assert.ok(workspace.audit.some(a => a.action === 'paper_result_recorded')); pass('paper registration and settlement are audited automatically');
  workspace = await next(workspace, w => w.paperResults.push({ recordId: source.records[0].id, outcome: 'pending', settledAt: null, statistic: null, legs: [], updatedAt: stamp })); pass('unknown source kind may be explicitly registered for paper tracking without source relabeling');
  const incomplete = structuredClone(workspace); incomplete.paperResults[1].outcome = 'void'; incomplete.revision++;
  await rejected(() => save(incomplete, workspace.revision), /every original leg void/i, 'incomplete zero-leg records cannot claim a decisive paper result');

  const alert = notification(paperId, 200);
  workspace = await next(workspace, w => w.notifications.push(alert)); pass('historical notification generation persists a user-owned research reference');
  const duplicateAlert = structuredClone(workspace); duplicateAlert.revision++; duplicateAlert.notifications.push({ ...alert, id: uid(201) });
  await rejected(() => save(duplicateAlert, workspace.revision), /unique constraint/i, 'one stable research notification per source prevents duplicate alerts');
  const wrongKey = structuredClone(workspace); wrongKey.revision++; wrongKey.notifications[0].dedupeKey = 'arbitrary';
  await rejected(() => save(wrongKey, workspace.revision), /notification validation/i, 'notification deduplication key must identify its original record');
  workspace = await next(workspace, w => w.notifications[0].readAt = later);
  workspace = await next(workspace, w => w.notifications[0].dismissedAt = later);
  assert.equal(workspace.notifications[0].readAt, later); assert.equal(workspace.notifications[0].dismissedAt, later); pass('read and dismissal state survive reload');
  const reset = structuredClone(workspace); reset.revision++; reset.notifications[0].readAt = null; reset.notifications[0].dismissedAt = null;
  await rejected(() => save(reset, workspace.revision), /cannot be rewritten/i, 'notification read and dismissal history cannot be reset');
  const editAlert = structuredClone(workspace); editAlert.revision++; editAlert.notifications[0].message = 'changed';
  await rejected(() => save(editAlert, workspace.revision), /immutable/i, 'notification source details remain immutable');
  assert.ok(workspace.audit.some(a => a.action === 'notification_created')); assert.ok(workspace.audit.some(a => a.action === 'notification_read')); assert.ok(workspace.audit.some(a => a.action === 'notification_dismissed')); pass('notification creation, reading and dismissal retain audit history');
  const lateFailure = structuredClone(workspace); addBatch(lateFailure, importBatch(210, [snapshot()])); lateFailure.notifications.push(notification(uid(999), 220)); lateFailure.revision++;
  await rejected(() => save(lateFailure, workspace.revision), /foreign key constraint/i, 'invalid later notification rejects the entire multi-table import');
  assert.equal((await load()).batches.length, 1); assert.equal((await load()).revision, workspace.revision); pass('failed late write rolls back new source, auto-audit and revision together');

  await login(other);
  await rejected(() => load(owner), /Authenticated historical owner changed/i, 'account switch between SDK check and load cannot reveal the new account workspace');
  await rejected(() => save({ ...empty(), revision: 1 }, 0, owner), /Authenticated historical owner changed/i, 'account switch between SDK check and save cannot import into the new account');
  assert.deepEqual(await load(), empty()); pass('second authenticated account cannot load first account archive');
  for (const table of tableNames) assert.equal((await db.query(`select count(*)::int n from public.${table}`)).rows[0].n, 0);
  pass('two-account RLS isolates all six tables including audits and revisions');
  assert.equal((await db.query("update public.historical_notifications set payload=jsonb_set(payload,'{readAt}',to_jsonb($1::text)) where id=$2 returning id", [later, alert.id])).rows.length, 0); pass('cross-account modification returns no accessible rows');
  const stolen = notification(paperId, 230);
  await rejected(() => db.query('insert into public.historical_notifications(id,user_id,record_id,payload,created_at) values($1,$2,$3,$4,$5)', [stolen.id, other, paperId, stolen, stamp]), /foreign key constraint/i, 'same-user composite foreign keys prevent cross-account source attachment');
  await rejected(() => db.query('insert into public.historical_workspace_revisions(user_id,revision) values($1,1)', [owner]), /row-level security/i, 'cross-account ownership insertion is rejected');
  await db.query("select set_config('edgelab.history_save',$1,false)", [owner]);
  assert.equal((await db.query('select count(*)::int n from public.historical_research_records')).rows[0].n, 0); pass('revision coordination context cannot bypass RLS ownership');
  await login('', 'authenticated'); await rejected(load, /Authentication required/i, 'authenticated role without a JWT identity cannot call history RPC');
  await login('', 'anon'); await rejected(load, /permission denied/i, 'anonymous history RPC execution is denied');
  for (const table of tableNames) await assert.rejects(() => db.query(`select * from public.${table}`), /permission denied/i);
  pass('anonymous table requests cannot read private historical records');

  await login(owner); workspace = await load(); const beforeRevision = workspace.revision;
  await db.query("update public.historical_paper_results set payload=jsonb_set(payload,'{statistic}','\"LOCAL synthetic correction\"') where record_id=$1", [paperId]);
  const direct = await load(); assert.ok(direct.revision > beforeRevision); assert.ok(direct.audit.length > workspace.audit.length); pass('direct table settlement edits advance revision and append audit automatically');
  await rejected(() => save({ ...workspace, revision: beforeRevision + 1 }, beforeRevision), /revision conflict/i, 'stale RPC cannot overwrite an intervening direct lifecycle change');
  workspace = await next(direct, () => {}); assert.equal(workspace.revision, direct.revision + 1); pass('fresh RPC advances exactly one revision despite server-generated audits');
  assert.notEqual((await db.query("select current_setting('edgelab.history_save',true) value")).rows[0].value, owner); pass('RPC restores direct-write revision context before returning');
  const beforeDelete = (await load()).records.length;
  for (const table of tableNames) await assert.rejects(() => db.query(`delete from public.${table}`), /permission denied/i);
  assert.equal((await load()).records.length, beforeDelete); pass('authenticated DELETE is denied across all six historical tables');
  await db.query('update public.historical_workspace_revisions set revision=0 where user_id=$1', [owner]); assert.ok((await load()).revision > workspace.revision); pass('direct clients cannot rewind historical revision counter');
  const append = structuredClone(source.records[0]); append.id = uid(300); append.rowNumber = 4; append.fingerprint = hash('illicit-append');
  await rejected(() => db.query('insert into public.historical_research_records(id,user_id,batch_id,row_number,payload,imported_at) values($1,$2,$3,$4,$5,$6)', [append.id, owner, append.batchId, append.rowNumber, append, stamp]), /outside the original source/i, 'direct clients cannot append rows outside immutable source bounds');
  const orphan = importBatch(310, [snapshot()]);
  await rejected(() => db.query('insert into public.historical_import_batches(id,user_id,payload,created_at) values($1,$2,$3,$4)', [orphan.batch.id, owner, orphan.batch, stamp]), /summary must match/i, 'deferred completeness checks reject source-only direct imports');
  pass('no historical security test requires a privileged service-role client');
  console.log(`${checks} historical database checks passed (local embedded PostgreSQL; no hosted requests made)`);
} catch (error) {
  console.error(`FAIL ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally { await db.close(); }
