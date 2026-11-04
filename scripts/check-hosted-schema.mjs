#!/usr/bin/env node
/**
 * Build a SELECT-only hosted-catalog verification query from the local migrations.
 * The temporary PGlite runtime is optional tooling, never an app dependency.
 * No network access, environment credentials, or hosted database writes occur.
 *
 * node scripts/check-hosted-schema.mjs --runtime /tmp/edgelab-db-test
 * node scripts/check-hosted-schema.mjs --runtime /tmp/edgelab-db-test --write-sql scripts/check-hosted-schema.sql
 */
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const option = name => {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
};
const runtime = option('--runtime');
if (!runtime) throw new Error('Pass --runtime <temporary npm prefix containing @electric-sql/pglite>.');
const { PGlite } = createRequire(path.resolve(runtime, 'package.json'))('@electric-sql/pglite');
const db = new PGlite();
const directory = new URL('../supabase/migrations/', import.meta.url);
const migrationNames = (await fs.readdir(directory)).filter(name => /^\d+_.+\.sql$/.test(name)).sort();
const expectedFiles = {};
await db.exec("create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid stable language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;");
// Hosted catalog inspection confirmed postgres-owned PUBLIC-schema default
// function grants to anon/authenticated, without grant option. Model that
// platform baseline before migrations, which explicitly revoke it from RPCs
// and validators. This does not change or relax any verification comparison.
await db.exec('alter default privileges in schema public grant execute on functions to anon,authenticated');
for (const name of migrationNames) {
  const contents = await fs.readFile(new URL(name, directory), 'utf8');
  expectedFiles[name] = createHash('sha256').update(contents).digest('hex');
  await db.exec(contents.replace('create extension if not exists pgcrypto;', '-- PostgreSQL builtin UUID generation in the local test runtime'));
}
const tableNames = [
  'audit_history','bet_legs','bets','events','experiment_settings','financial_transactions','model_versions',
  'notifications','odds_snapshots','paper_predictions','research_candidates','research_runs','sports','user_profiles',
];
const tablesLiteral = JSON.stringify(tableNames).replaceAll("'", "''");
// The expression normalization only removes schema qualification and repeated
// whitespace in catalog-rendered SQL. Function bodies are hashed exactly.
const normalize = expression => `regexp_replace(replace(${expression},'public.',''),'[[:space:]]+',' ','g')`;
const snapshotSql = `
with app_tables as (
  select c.oid,c.relname,c.relrowsecurity,c.relforcerowsecurity,c.relkind
  from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname in (select jsonb_array_elements_text('${tablesLiteral}'::jsonb))
), app_functions as (
  select p.*,l.lanname from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace join pg_catalog.pg_language l on l.oid=p.prolang
  where n.nspname='public' and p.proname like 'edgelab_%'
)
select jsonb_build_object(
 'tables',coalesce((select jsonb_object_agg(relname,jsonb_build_object('kind',relkind,'rls',relrowsecurity,'forceRls',relforcerowsecurity,'ownerIsPrivileged',pg_get_userbyid((select relowner from pg_catalog.pg_class where oid=app_tables.oid)) not in ('anon','authenticated'))) from app_tables),'{}'::jsonb),
 'columns',coalesce((select jsonb_object_agg(t.relname||'.'||a.attname,jsonb_build_object('position',a.attnum,'type',format_type(a.atttypid,a.atttypmod),'notNull',a.attnotnull,'identity',a.attidentity,'generated',a.attgenerated,'expression',${normalize('pg_get_expr(d.adbin,d.adrelid,false)')})) from app_tables t join pg_catalog.pg_attribute a on a.attrelid=t.oid and a.attnum>0 and not a.attisdropped left join pg_catalog.pg_attrdef d on d.adrelid=t.oid and d.adnum=a.attnum),'{}'::jsonb),
 'constraints',coalesce((select jsonb_object_agg(t.relname||'.'||c.conname,jsonb_build_object('type',c.contype,'validated',c.convalidated,'deferrable',c.condeferrable,'deferred',c.condeferred,'definition',${normalize('pg_get_constraintdef(c.oid,false)')})) from app_tables t join pg_catalog.pg_constraint c on c.conrelid=t.oid where c.contype<>'n' and c.contype<>'t'),'{}'::jsonb),
 'indexes',coalesce((select jsonb_object_agg(t.relname||'.'||c.relname,jsonb_build_object('unique',i.indisunique,'primary',i.indisprimary,'valid',i.indisvalid,'ready',i.indisready,'definition',${normalize('pg_get_indexdef(i.indexrelid,0,false)')})) from app_tables t join pg_catalog.pg_index i on i.indrelid=t.oid join pg_catalog.pg_class c on c.oid=i.indexrelid),'{}'::jsonb),
 'policies',coalesce((select jsonb_object_agg(t.relname||'.'||p.polname,jsonb_build_object('command',p.polcmd,'permissive',p.polpermissive,'roles',(select jsonb_agg(case when r=0 then 'public' else pg_get_userbyid(r) end order by case when r=0 then 'public' else pg_get_userbyid(r) end) from unnest(p.polroles) r),'using',${normalize('pg_get_expr(p.polqual,p.polrelid,false)')},'check',${normalize('pg_get_expr(p.polwithcheck,p.polrelid,false)')})) from app_tables t join pg_catalog.pg_policy p on p.polrelid=t.oid),'{}'::jsonb),
 'functions',coalesce((select jsonb_object_agg(p.proname||'('||pg_get_function_identity_arguments(p.oid)||')',jsonb_build_object('language',p.lanname,'returns',format_type(p.prorettype,null),'securityDefiner',p.prosecdef,'volatility',p.provolatile,'strict',p.proisstrict,'configuration',p.proconfig,'defaults',pg_get_expr(p.proargdefaults,0,false),'bodySha256',encode(sha256(convert_to(p.prosrc,'UTF8')),'hex'))) from app_functions p),'{}'::jsonb),
 'triggers',coalesce((select jsonb_object_agg(t.relname||'.'||g.tgname,jsonb_build_object('function',p.proname||'('||pg_get_function_identity_arguments(p.oid)||')','type',g.tgtype,'enabled',g.tgenabled,'deferrable',g.tgdeferrable,'initiallyDeferred',g.tginitdeferred,'when',${normalize('pg_get_expr(g.tgqual,g.tgrelid,false)')},'arguments',encode(g.tgargs,'hex'))) from app_tables t join pg_catalog.pg_trigger g on g.tgrelid=t.oid and not g.tgisinternal join pg_catalog.pg_proc p on p.oid=g.tgfoid),'{}'::jsonb),
 'tableGrants',coalesce((select jsonb_object_agg(t.relname||'.'||r.role||'.'||v.privilege,has_table_privilege(r.role,t.oid,v.privilege)) from app_tables t cross join (values ('anon'),('authenticated')) r(role) cross join (values ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) v(privilege)),'{}'::jsonb),
 'columnGrants',coalesce((select jsonb_object_agg(t.relname||'.'||r.role||'.'||v.privilege,has_any_column_privilege(r.role,t.oid,v.privilege)) from app_tables t cross join (values ('anon'),('authenticated')) r(role) cross join (values ('SELECT'),('INSERT'),('UPDATE'),('REFERENCES')) v(privilege)),'{}'::jsonb),
 'roles',coalesce((select jsonb_object_agg(rolname,jsonb_build_object('superuser',rolsuper,'bypassRls',rolbypassrls,'canLogin',rolcanlogin)) from pg_catalog.pg_roles where rolname in ('anon','authenticated')),'{}'::jsonb),
 'explicitTableGrants',coalesce((select jsonb_object_agg(t.relname||'.'||case when a.grantee=0 then 'public' else pg_get_userbyid(a.grantee) end||'.'||a.privilege_type,a.is_grantable) from app_tables t join pg_catalog.pg_class c on c.oid=t.oid cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a where a.grantee=0 or pg_get_userbyid(a.grantee) in ('anon','authenticated')),'{}'::jsonb),
 'explicitColumnGrants',coalesce((select jsonb_object_agg(t.relname||'.'||c.attname||'.'||case when a.grantee=0 then 'public' else pg_get_userbyid(a.grantee) end||'.'||a.privilege_type,a.is_grantable) from app_tables t join pg_catalog.pg_attribute c on c.attrelid=t.oid and c.attnum>0 and not c.attisdropped cross join lateral aclexplode(c.attacl) a where a.grantee=0 or pg_get_userbyid(a.grantee) in ('anon','authenticated')),'{}'::jsonb),
 'explicitFunctionGrants',coalesce((select jsonb_object_agg(p.proname||'('||pg_get_function_identity_arguments(p.oid)||').' ||case when a.grantee=0 then 'public' else pg_get_userbyid(a.grantee) end||'.'||a.privilege_type,a.is_grantable) from app_functions p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where a.grantee=0 or pg_get_userbyid(a.grantee) in ('anon','authenticated')),'{}'::jsonb),
 'functionGrants',coalesce((select jsonb_object_agg(p.proname||'('||pg_get_function_identity_arguments(p.oid)||').' ||r.role,has_function_privilege(r.role,p.oid,'EXECUTE')) from app_functions p cross join (values ('anon'),('authenticated')) r(role)),'{}'::jsonb)
) as catalog_snapshot
`;
const expected = (await db.query(snapshotSql)).rows[0].catalog_snapshot;
assert.equal(Object.keys(expected.tables).length,14);
assert.equal(Object.keys(expected.policies).length,14);
assert.equal(Object.keys(expected.functions).length,24);
assert.equal(Object.keys(expected.triggers).length,24);
assert.equal(Object.keys(expected.explicitFunctionGrants).length,38);
const invalidChecks = Object.entries(expected.constraints).filter(([,value]) => value.type==='c' && !value.validated);
assert.equal(invalidChecks.length,9);
const manifestLiteral = JSON.stringify(expected,null,2).replaceAll('$edgelab_catalog$', '$edgelab_catalog_escaped$');
const verificationSql = `-- EdgeLab hosted schema verifier. SELECT ONLY: reads PostgreSQL catalogs,
-- never application records. This proves catalog configuration, not Auth/JWT
-- behavior or normal-user RLS enforcement. Run real-account tests separately.
-- Expected migration SHA-256 files (local provenance, not a remote history hash):
${Object.entries(expectedFiles).map(([name,hash]) => `-- ${name}: ${hash}`).join('\n')}
-- Compare function bodies exactly by SHA-256; structural metadata compares exact
-- object names and definitions. Every raw ACL difference remains a failure.
-- Expected ACLs model verified Supabase PUBLIC-schema default function grants
-- to anon/authenticated (without grant option), followed by migration revokes.
-- This verifier never modifies hosted permissions.
with expected as (select $edgelab_catalog$${manifestLiteral}$edgelab_catalog$::jsonb as value),
actual as (${snapshotSql.replace(/;\s*$/, '')}),
expected_items as (select category.key as category,item.key as object_name,item.value from expected cross join lateral jsonb_each(expected.value) category cross join lateral jsonb_each(category.value) item),
actual_items as (select category.key as category,item.key as object_name,item.value from actual cross join lateral jsonb_each(actual.catalog_snapshot) category cross join lateral jsonb_each(category.value) item),
differences as (
 select coalesce(e.category,a.category) as category,coalesce(e.object_name,a.object_name) as object_name,e.value as expected,a.value as actual
 from expected_items e full join actual_items a on a.category=e.category and a.object_name=e.object_name
 where e.value is distinct from a.value
)
select jsonb_build_object(
 'passed',not exists(select 1 from differences),
 'scope','Schema catalogs only; no application data, Auth/JWT checks or privileged RLS test claims',
 'functionBodiesVerified',(select count(*) from actual_items where category='functions'),
 'objectCounts',(select jsonb_object_agg(category.key,jsonb_object_length_compat.count) from actual cross join lateral jsonb_each(actual.catalog_snapshot) category cross join lateral (select count(*) from jsonb_object_keys(category.value)) jsonb_object_length_compat),
 'unvalidatedChecks',(select count(*) from actual_items where category='constraints' and value->>'type'='c' and value->>'validated'='false'),
 'differences',coalesce((select jsonb_agg(jsonb_build_object('category',category,'object',object_name,'expected',expected,'actual',actual) order by category,object_name) from differences),'[]'::jsonb),
 'rawDifferences',coalesce((select jsonb_agg(jsonb_build_object('category',category,'object',object_name,'expected',expected,'actual',actual) order by category,object_name) from differences),'[]'::jsonb),
 'platformBaseline','Verified Supabase PUBLIC-schema default function grants to anon/authenticated without grant option; approved migrations revoke them on workspace RPCs and validators. Trigger-only functions retain their existing PUBLIC execution privileges.'
) as edgelab_schema_verification;
`;
const verify = async () => (await db.query(verificationSql)).rows[0].edgelab_schema_verification;
const baseline = await verify();
assert.equal(baseline.passed,true);
console.log(JSON.stringify({baseline:baseline.objectCounts,unvalidatedChecks:baseline.unvalidatedChecks}));
const detect = async (label,change,category) => {
  await db.exec('begin');
  try {
    await db.exec(change);
    const result = await verify();
    assert.equal(result.passed,false,label);
    assert.ok(result.differences.some(diff => diff.category===category),label);
    assert.deepEqual(result.rawDifferences,result.differences,label+' must retain all ACL/catalog differences');
    console.log('PASS detects '+label);
  } finally { await db.exec('rollback'); }
};
await detect('SECURITY DEFINER drift','alter function public.edgelab_load_workspace() security definer','functions');
await detect('permissive policy addition','create policy unsafe_catalog_test on public.bets for select to authenticated using (true)','policies');
await detect('authenticated DELETE grant','grant delete on public.bets to authenticated','tableGrants');
await detect('disabled immutable trigger','alter table public.research_candidates disable trigger immutable_candidates','triggers');
await detect('missing performance index','drop index public.bets_owner_date','indexes');
await detect('new anonymous load RPC EXECUTE','grant execute on function public.edgelab_load_workspace() to anon','functionGrants');
await detect('new anonymous save RPC EXECUTE','grant execute on function public.edgelab_save_workspace(jsonb,bigint) to anon','functionGrants');
await detect('new anonymous validator EXECUTE','grant execute on function public.edgelab_valid_json_cents(jsonb) to anon','functionGrants');
await detect('trigger EXECUTE grant option expansion','grant execute on function public.edgelab_deny_rewrite() to anon with grant option','explicitFunctionGrants');
assert.equal((await verify()).passed,true);
assert.equal((await verify()).rawDifferences.length,0);
console.log('PASS final catalog restored after local drift checks');
if (option('--write-sql')) {
  await fs.writeFile(path.resolve(option('--write-sql')),verificationSql);
  console.log('Wrote SELECT-only verifier to '+path.resolve(option('--write-sql')));
}
await db.close();
