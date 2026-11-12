/** Reproduce Approval S's current DDL blocker locally, without env/network access.
 * Expected rejection is evidence that the ORIGINAL proposal is NOT ready to apply.
 * This does not amend the proposal, grant hosted privileges or prove hosted RLS. */
import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const i=process.argv.indexOf('--runtime');
if(i<0)throw new Error('Supply the existing test-only --runtime directory');
const {PGlite}=createRequire(path.resolve(process.argv[i+1],'package.json'))('@electric-sql/pglite');
const db=new PGlite();
try{
 await db.exec(`
  create role anon;create role authenticated;
  create role approval_s_migrator createrole nosuperuser nobypassrls;
  create schema auth;create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql as
   $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  grant usage on schema auth to approval_s_migrator with grant option;
  grant execute on function auth.uid() to approval_s_migrator with grant option;
  grant references on auth.users to approval_s_migrator;
  grant usage,create on schema public to approval_s_migrator with grant option;
  create table public.historical_import_batches(user_id uuid,id uuid,primary key(user_id,id));
  alter table public.historical_import_batches owner to approval_s_migrator;
  insert into public.historical_import_batches values
   ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002');
  set role approval_s_migrator;
 `);
 const sql=await fs.readFile('supabase/proposals/202611130001_v6_source_cloud.sql','utf8');
 assert.equal(createHash('sha256').update(sql).digest('hex'),'7a03d765f78b5c1939900d1ddb50809238987104e5399ed772cb900692caf451');
 assert.equal((await db.query("select current_setting('createrole_self_grant') v")).rows[0].v,'');
 let rejection=null;
 try{await db.exec(sql);}catch(error){rejection=error.message;}
 assert.match(rejection??'',/must be able to SET ROLE "edgelab_v6_source"/);
 await db.exec('rollback');
 assert.equal((await db.query("select count(*)::int n from pg_tables where schemaname='public' and tablename like 'v6_source_%'")).rows[0].n,0);
 assert.equal((await db.query("select count(*)::int n from pg_roles where rolname='edgelab_v6_source'")).rows[0].n,0);
 assert.equal((await db.query('select count(*)::int n from public.historical_import_batches')).rows[0].n,1);
 console.log(JSON.stringify({
  format:'edgelab.v6-source-role-preflight',transport:'disposable_local_postgres',
  checksPassed:6,originalProposalReady:false,
  blocker:'Non-superuser migration role cannot transfer function ownership to the newly created source role; new owner also needs schema CREATE during transfer.',
  rollbackVerified:true,hostedWrites:0,proposalModified:false,
 }));
}finally{await db.close();}
