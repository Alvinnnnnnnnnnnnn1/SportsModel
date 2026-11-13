import {applyLocalMigration} from './lib/local-migration.mjs';
import { createRequire } from "node:module";
import path from "node:path";
const runtimeFlag = process.argv.indexOf("--runtime");
if (runtimeFlag < 0 || !process.argv[runtimeFlag + 1]) {
  throw new Error(
    "Usage: node scripts/check-database.mjs --runtime /absolute/path/to/temp/npm-prefix",
  );
}
const runtime = createRequire(
  path.resolve(process.argv[runtimeFlag + 1], "package.json"),
);
const { PGlite } = runtime("@electric-sql/pglite");
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const db = new PGlite();
const migrationDirectory = new URL("../supabase/migrations/", import.meta.url);
await db.exec(
  `create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid stable language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`,
);
const migrationFiles = (await fs.readdir(migrationDirectory)).filter(name => /^\d+_.+\.sql$/.test(name)).sort();
for (const migrationName of migrationFiles) {
  const migration = await fs.readFile(new URL(migrationName, migrationDirectory), "utf8");
  await applyLocalMigration(db, migrationName, migration.replace("create extension if not exists pgcrypto;", "-- builtin gen_random_uuid() available"));
}
let checks = 0;
const pass = (label) => {
  checks++;
  console.log(`PASS ${label}`);
};
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const owner = uid(1),
  other = uid(2),
  stamp = "2026-11-03T10:00:00.000Z";
await db.query("insert into auth.users(id) values($1),($2)", [owner, other]);
const login = async (id) => {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec("set role authenticated");
};
const load = async () =>
  (await db.query("select public.edgelab_load_workspace() as result")).rows[0]
    .result;
const save = async (data, rev) =>
  (
    await db.query(
      "select public.edgelab_save_workspace($1::jsonb,$2::bigint) as result",
      [JSON.stringify(data), rev],
    )
  ).rows[0].result;
const rejected = async (fn, regex, label) => {
  await assert.rejects(fn, regex);
  pass(label);
};
const workspace = {
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
await login(owner);
assert.deepEqual(await load(), { revision: 0, workspace: null });
pass("new user starts empty");
workspace.transactions.push({
  id: uid(10),
  kind: "deposit",
  amountCents: 25000,
  createdAt: stamp,
  note: "Test funding",
});
const leg = {
  id: uid(21),
  sport: "NBA",
  event: "Test home v Test away",
  participant: "Test home",
  market: "Moneyline",
  selection: "Test home to win",
  line: "N/A",
  odds: 1.9,
  outcome: "pending",
};
workspace.bets.push({
  id: uid(20),
  placedAt: stamp,
  bookmaker: "Manual test",
  stakeCents: 500,
  stakeType: "cash",
  odds: 1.9,
  outcome: "pending",
  strategy: "A",
  legs: [leg],
  notes: "SQL test fixture",
  confirmedAt: stamp,
});
assert.equal(await save(workspace, 0), 1);
pass("manual bet and deposit transaction save");
assert.deepEqual((await load()).workspace, workspace);
pass("typed workspace round trip");
const columns = (
  await db.query("select stake,decimal_odds,outcome from public.bets")
).rows[0];
assert.equal(Number(columns.stake), 5);
assert.equal(Number(columns.decimal_odds), 1.9);
pass("normalized NUMERIC monetary columns");
workspace.bets[0].stakeCents = 600;
assert.equal(await save(workspace, 1), 2);
assert.equal(
  (await db.query("select count(*)::integer as n from public.audit_history"))
    .rows[0].n,
  1,
);
pass("bet edit writes server audit");
await rejected(
  () => save(workspace, 1),
  /revision conflict/i,
  "stale browser revision rejected",
);
const provenance = {
  source: "Test source",
  timestamp: stamp,
  method: "Fixed test input",
  modelVersion: "test-v1",
  simulated: false,
};
const candidate = {
  id: uid(30),
  sport: "ATP",
  event: "Test A v Test B",
  participant: "Test A",
  market: "Total games",
  selection: "Over",
  line: "21.5",
  bookmaker: "Test book",
  odds: 2,
  probability: 0.6,
  strategy: "B",
  rationale: "Test fixture only",
  uncertainty: "high",
  startsAt: stamp,
  registeredAt: stamp,
  oddsProvenance: provenance,
  probabilityProvenance: provenance,
};
workspace.candidates.push(candidate);
workspace.paperPredictions.push({
  id: uid(31),
  candidate: structuredClone(candidate),
  registeredAt: stamp,
  hypotheticalStakeCents: 500,
  outcome: "pending",
});
assert.equal(await save(workspace, 2), 3);
pass("forecast and exact paper snapshot register");
workspace.candidates[0].probability = 0.7;
await rejected(
  () => save(workspace, 3),
  /immutable/i,
  "registered forecast cannot be rewritten",
);
workspace.candidates[0].probability = 0.6;
await rejected(
  () =>
    db.query(
      "update public.research_candidates set payload=jsonb_set(payload,'{probability}','0.7') where id=$1",
      [candidate.id],
    ),
  /immutable/i,
  "direct API forecast update forbidden",
);
workspace.paperPredictions[0].hypotheticalStakeCents = 600;
await rejected(
  () => save(workspace, 3),
  /immutable/i,
  "paper registration stake immutable",
);
workspace.paperPredictions[0].hypotheticalStakeCents = 500;
workspace.paperPredictions[0].outcome = "won";
workspace.paperPredictions[0].settledAt = stamp;
assert.equal(await save(workspace, 3), 4);
pass("paper settlement allowed without rewriting forecast");
const simulated = {
  ...structuredClone(candidate),
  id: uid(40),
  oddsProvenance: { ...provenance, simulated: true },
};
workspace.candidates.push(simulated);
await rejected(
  () => save(workspace, 4),
  /Simulated research/i,
  "simulated research blocked from production",
);
workspace.candidates.pop();
const invalid = structuredClone(workspace);
invalid.bets.push({
  ...structuredClone(workspace.bets[0]),
  id: uid(50),
  legs: [{ ...leg, id: uid(51) }],
});
invalid.transactions.push({
  id: uid(52),
  kind: "wrong",
  amountCents: 100,
  createdAt: stamp,
  note: "",
});
await rejected(
  () => save(invalid, 4),
  /check constraint/i,
  "invalid later transaction rejects atomic save",
);
assert.equal(
  (
    await db.query(
      "select count(*)::integer as n from public.bets where id=$1",
      [uid(50)],
    )
  ).rows[0].n,
  0,
);
pass("failed transaction rolls back earlier bet inserts");
await rejected(
  () => db.query("update public.audit_history set action='tampered'"),
  /immutable/i,
  "append-only audit cannot be updated",
);
await rejected(
  () => db.query("delete from public.bets"),
  /permission denied/i,
  "ledger history cannot be deleted",
);
await login(other);
assert.deepEqual(await load(), { revision: 0, workspace: null });
assert.equal(
  (await db.query("select count(*)::integer as n from public.bets")).rows[0].n,
  0,
);
pass("second user cannot see first user ledger");
assert.equal(
  (
    await db.query(
      "update public.bets set payload=payload where id=$1 returning id",
      [uid(20)],
    )
  ).rows.length,
  0,
);
pass("second user cannot update first user UUID");
await rejected(
  () =>
    db.query(
      "insert into public.notifications(id,user_id,payload,created_at) values($1,$2,$3::jsonb,$4)",
      [
        uid(60),
        owner,
        JSON.stringify({ id: uid(60), simulated: false }),
        stamp,
      ],
    ),
  /row-level security/i,
  "cross-user insert blocked by RLS",
);
await db.exec("reset role");
await db.query("select set_config('request.jwt.claim.sub','',false)");
await db.exec("set role authenticated");
await rejected(
  () => load(),
  /Authentication required/i,
  "RPC requires authenticated identity",
);
await db.exec("reset role; set role anon");
await rejected(
  () => load(),
  /permission denied/i,
  "anonymous RPC execution denied",
);
await login(owner);
workspace.bets[0].legs.push({
  ...leg,
  id: uid(22),
  event: "Second test event",
});
assert.equal(await save(workspace, 4), 5);
workspace.bets[0].legs.pop();
assert.equal(await save(workspace, 5), 6);
assert.equal(
  (await db.query("select active from public.bet_legs where id=$1", [uid(22)]))
    .rows[0].active,
  false,
);
pass("removed parlay leg retained as inactive audit history");
assert.equal((await load()).workspace.bets[0].legs.length, 1);
pass("current bet snapshot excludes removed leg");

// Additional malformed-input checks exercise direct SQL API integrity as well as RPCs.
for (const field of ["source", "method", "timestamp", "modelVersion"]) {
  const partial = { ...provenance };
  delete partial[field];
  assert.equal(
    (
      await db.query(
        "select public.edgelab_valid_private_provenance($1::jsonb) as valid",
        [JSON.stringify(partial)],
      )
    ).rows[0].valid,
    false,
  );
  pass(`partial provenance missing ${field} rejected`);
}
const missingProvenance = {
  ...structuredClone(workspace.bets[0]),
  id: uid(80),
  probability: 0,
};
await rejected(
  () => save({ ...workspace, bets: [...workspace.bets, missingProvenance] }, 6),
  /check constraint/i,
  "zero probability also requires complete provenance",
);
const fractionalBet = {
  ...structuredClone(workspace.bets[0]),
  id: uid(81),
  stakeCents: 500.5,
};
await rejected(
  () => save({ ...workspace, bets: [...workspace.bets, fractionalBet] }, 6),
  /check constraint/i,
  "fractional stake cents rejected",
);
const fractionalTransaction = {
  id: uid(82),
  kind: "deposit",
  amountCents: 100.5,
  createdAt: stamp,
  note: "",
};
await rejected(
  () =>
    save(
      {
        ...workspace,
        transactions: [...workspace.transactions, fractionalTransaction],
      },
      6,
    ),
  /check constraint/i,
  "fractional funding cents rejected",
);
const mismatched = {
  ...structuredClone(workspace.bets[0]),
  id: uid(83),
  candidateId: candidate.id,
};
await rejected(
  () =>
    db.query(
      "insert into public.bets(id,user_id,payload,placed_at,confirmed_at) values($1,$2,$3::jsonb,$4,$4)",
      [mismatched.id, owner, JSON.stringify(mismatched), stamp],
    ),
  /check constraint/i,
  "payload candidate UUID must match typed foreign key",
);
await rejected(
  () =>
    db.query("update public.bets set placed_at=$1 where id=$2", [
      "2026-11-02T10:00:00Z",
      uid(20),
    ]),
  /check constraint/i,
  "typed timestamps cannot disagree with the snapshot",
);
const earlySettlement = {
  ...structuredClone(workspace.bets[0]),
  id: uid(84),
  outcome: "lost",
  settledAt: "2026-11-02T10:00:00Z",
};
await rejected(
  () => save({ ...workspace, bets: [...workspace.bets, earlySettlement] }, 6),
  /check constraint/i,
  "settlement before placement rejected",
);
const incompleteCandidate = {
  ...structuredClone(candidate),
  id: uid(85),
  oddsProvenance: { ...provenance, source: undefined },
};
await rejected(
  () =>
    save(
      {
        ...workspace,
        candidates: [...workspace.candidates, incompleteCandidate],
      },
      6,
    ),
  /check constraint/i,
  "missing candidate source cannot bypass a nullable CHECK",
);

// Additive integrity/concurrency regressions. All writes remain in isolated
// in-memory PostgreSQL; no hosted Supabase project or privileged RLS bypass.
for (const [field, value] of [
  ['fundingCapCents', 0], ['defaultStakeCents', 500.5],
  ['fundingCapCents', 'NaN'], ['defaultStakeCents', -100],
  ['fundingCapCents', 100000001],
]) {
  await rejected(() => save({...workspace,settings:{...workspace.settings,[field]:value}},6), /positive integer cents/i, `invalid setting ${field}=${value} rejected without rounding`);
}
for (const [label, update] of [
  ['extra precision odds', {odds:1.912345}],
  ['string NaN odds', {odds:'NaN'}],
  ['string NaN stake', {stakeCents:'NaN'}],
  ['numeric string stake', {stakeCents:'500'}],
  ['out-of-range odds', {odds:10001}],
]) {
  await rejected(() => save({...workspace,bets:[{...workspace.bets[0],...update}]},6),/check constraint/i,`${label} rejected at SQL boundary`);
}
const noLegs = structuredClone(workspace.bets[0]); delete noLegs.legs;
await rejected(() => save({...workspace,bets:[noLegs]},6),/check constraint/i,'missing leg array cannot null-bypass SQL checks');
await rejected(() => save({...workspace,bets:[{...workspace.bets[0],outcome:'won',settledAt:stamp,legs:[{...leg,outcome:'lost'}]}]},6),/check constraint/i,'aggregate win cannot contain a lost leg');
await rejected(() => save({...workspace,bets:[{...workspace.bets[0],legs:[{...leg,line:''}]}]},6),/check constraint/i,'empty exact line rejected by SQL');
await rejected(() => save({...workspace,bets:[{...workspace.bets[0],legs:[leg,leg]}]},6),/check constraint/i,'duplicate parlay leg identities rejected');
await rejected(() => save({...workspace,notifications:[{id:uid(90),createdAt:stamp,simulated:false}]},6),/check constraint/i,'incomplete notification cannot poison workspace round trip');
await rejected(() => save({...workspace,researchRuns:[{id:uid(91),startedAt:stamp,status:'completed',simulated:false}]},6),/check constraint/i,'missing research-run count rejected');
await rejected(() => db.query("update public.bet_legs set payload=jsonb_set(payload,'{statistic}',to_jsonb('unmatched direct change'::text)) where id=$1",[leg.id]),/normalized projection/i,'direct leg-only edits cannot diverge from bet snapshot');
assert.equal((await db.query("select payload->>'statistic' as statistic from public.bet_legs where id=$1",[leg.id])).rows[0].statistic,null);
pass('failed deferred projection check rolls back leg change');
await rejected(() => db.query("update public.bets set payload=jsonb_set(payload,'{legs,0,statistic}',to_jsonb('unmatched parent change'::text)) where id=$1",[workspace.bets[0].id]),/normalized projection/i,'direct parent-only leg edits must update normalized legs atomically');
const oldRevision=(await load()).revision;
await db.query("update public.bets set payload=jsonb_set(payload,'{notes}',to_jsonb('authenticated direct correction'::text)) where id=$1",[workspace.bets[0].id]);
const afterDirect=await load();
assert.ok(afterDirect.revision > oldRevision);
pass('direct authenticated edit advances workspace revision');
await rejected(() => save(workspace,oldRevision),/revision conflict/i,'stale RPC cannot overwrite an intervening direct edit');
assert.equal(await save(afterDirect.workspace,afterDirect.revision),afterDirect.revision+1);
assert.equal((await load()).revision,afterDirect.revision+1);
pass('RPC still advances exactly one revision after fresh reload');
assert.notEqual((await db.query("select current_setting('edgelab.workspace_save',true) as marker")).rows[0].marker,owner);
pass('RPC restores direct-write revision context before returning');
const beforeRewind=(await load()).revision;
await db.query('update public.experiment_settings set revision=0 where user_id=$1',[owner]);
assert.equal((await load()).revision,beforeRewind+1);
pass('direct clients cannot rewind the revision counter');
assert.equal((await db.query("select count(*)::int as n from pg_tables where schemaname='public' and has_table_privilege('authenticated',schemaname||'.'||tablename,'DELETE')")).rows[0].n,0);
pass('authenticated DELETE restricted across every application table');
assert.equal((await db.query("select count(*)::int as n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('edgelab_save_workspace','edgelab_load_workspace','edgelab_bump_direct_revision','edgelab_guard_settings_revision') and p.prosecdef")).rows[0].n,0);
pass('workspace RPC and concurrency triggers remain SECURITY INVOKER');
await db.exec('reset role; set role anon');
await rejected(() => db.query("select public.edgelab_valid_json_cents('500'::jsonb)"),/permission denied/i,'anonymous validation-helper RPC execution restricted');
await login(other);
await db.query("select set_config('edgelab.workspace_save',$1,true)",[owner]);
assert.equal((await db.query('select count(*)::int as n from public.bets')).rows[0].n,0);
assert.equal((await db.query('update public.bets set payload=payload where id=$1 returning id',[workspace.bets[0].id])).rows.length,0);
pass('revision coordination flag does not bypass ownership RLS');
await login(owner);

await rejected(() => db.query("update public.bets set payload=jsonb_set(payload,'{odds}','\"NaN\"'::jsonb) where id=$1",[workspace.bets[0].id]),/check constraint/i,'direct table writes also reject nonfinite odds strings');
await rejected(() => db.query("update public.experiment_settings set default_stake='NaN'::numeric where user_id=$1",[owner]),/check constraint/i,'direct numeric settings cannot store NaN');
await rejected(() => db.query('update public.experiment_settings set funding_cap=0 where user_id=$1',[owner]),/check constraint/i,'direct zero funding cap cannot poison client validation');

const currentWorkspace=await load();
const secondBet={...structuredClone(currentWorkspace.workspace.bets[0]),id:uid(110),legs:[{...leg,id:uid(111),event:'Different own event'}]};
await save({...currentWorkspace.workspace,bets:[...currentWorkspace.workspace.bets,secondBet]},currentWorkspace.revision);
await db.exec('begin');
try {
  await db.query("update public.bets set payload=jsonb_set(payload,'{legs}',jsonb_build_array($2::jsonb)) where id=$1",[secondBet.id,JSON.stringify(currentWorkspace.workspace.bets[0].legs[0])]);
  await db.query('update public.bet_legs set active=false where id=$1',[uid(111)]);
  await rejected(() => db.query('update public.bet_legs set bet_id=$1 where id=$2',[secondBet.id,leg.id]),/parent bet are immutable/i,'leg cannot move to another same-user bet and orphan old projection');
} finally { await db.exec('rollback'); }
assert.equal((await db.query('select bet_id from public.bet_legs where id=$1',[leg.id])).rows[0].bet_id,workspace.bets[0].id);
pass('failed same-user leg reassignment rolls back both parent snapshots');
const alternateEvent=(await db.query('select event_id from public.bet_legs where id=$1',[uid(111)])).rows[0].event_id;
await rejected(() => db.query('update public.bet_legs set event_id=$1 where id=$2',[alternateEvent,leg.id]),/event and sport must match/i,'typed event reference cannot disagree with leg snapshot');

// Upgrade preservation check: install v1, retain deliberately malformed legacy
// records, apply the additive migration, and verify no rows were rewritten.
const legacyDb = new PGlite();
await legacyDb.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid stable language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
const baseMigration=await fs.readFile(new URL(migrationFiles[0],migrationDirectory),'utf8');
await legacyDb.exec(baseMigration.replace('create extension if not exists pgcrypto;','-- builtin gen_random_uuid() available'));
await legacyDb.query('insert into auth.users(id) values($1)',[owner]);
await legacyDb.query('insert into public.experiment_settings(user_id,funding_cap) values($1,0)',[owner]);
const legacySnapshot={...workspace.bets[0],legs:undefined,odds:1.912345};
await legacyDb.query('insert into public.bets(id,user_id,payload,placed_at,confirmed_at) values($1,$2,$3::jsonb,$4,$4)',[legacySnapshot.id,owner,JSON.stringify(legacySnapshot),stamp]);
for(const migrationName of migrationFiles.slice(1)) await applyLocalMigration(legacyDb,migrationName,await fs.readFile(new URL(migrationName,migrationDirectory),'utf8'));
assert.equal(Number((await legacyDb.query('select funding_cap from public.experiment_settings')).rows[0].funding_cap),0);
assert.deepEqual((await legacyDb.query('select payload from public.bets')).rows[0].payload,JSON.parse(JSON.stringify(legacySnapshot)));
pass('additive migration retains existing settings and ledger payloads unchanged');
assert.equal((await legacyDb.query("select count(*)::int as n from pg_constraint where conname like 'edgelab_%' and contype='c' and not convalidated")).rows[0].n,9);
pass('new constraints remain NOT VALID for explicit existing-data review');
await legacyDb.close();

console.log(`${checks} database checks passed`);
await db.close();
