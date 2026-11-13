/** Actual disposable PostgreSQL; no provider calls, env secrets or hosted writes. */
import {describe,it,expect} from 'vitest';
import {readFile} from 'node:fs/promises';
import {v6TestDatabase,v6Login,type V6TestDB} from './fixtures/v6-postgres';
import {prepareSourceMigrationRole,applySourceSql,SOURCE_SQL,SOURCE_MIGRATOR} from './fixtures/v6-source-sql';
import {archiveDailyCycle} from '@/lib/daily-cycle/archive';
import {emptyHistoricalWorkspace} from '@/lib/imports/types';
import {localCycle} from './fixtures/daily-cycle';
import {digest} from '@/lib/v6/evidence.server';

const runtime=process.env.EDGELAB_POSTGRES_RUNTIME;
async function legacySnapshot(db:V6TestDB){
 await db.exec('reset role');
 const tables=(await db.query<{name:string}>("select relname name from pg_class where relnamespace='public'::regnamespace and relkind='r' and relname not like 'v6_source_%' order by relname")).rows;
 const result:Record<string,unknown>={};
 for(const t of tables)result[t.name]=(await db.query(`select coalesce(jsonb_agg(x order by x::text),'[]') data from (select to_jsonb(t) x from public."${t.name}" t) a`)).rows[0].data;
 return result;
}
async function legacyFixture(){
 const db=await v6TestDatabase({beforeSourceMigration:true}),owner=crypto.randomUUID(),other=crypto.randomUUID();
 await db.query('insert into auth.users(id) values($1),($2)',[owner,other]);
 await v6Login(db,owner);
 const prepared=await archiveDailyCycle(emptyHistoricalWorkspace(),JSON.stringify(localCycle()),'supabase');
 await db.query('select public.edgelab_save_history($1::jsonb,0,$2::uuid)',[JSON.stringify(prepared.history),owner]);
 await prepareSourceMigrationRole(db);
 await db.exec('reset role');
 return {db,owner,other,anchor:prepared.history.batches[0].id};
}

describe.skipIf(!runtime)('Approval S corrected migration / non-superuser security',()=>{
 it('deploys alongside real legacy schema, binds Auth safely and leaves only restricted final privileges',async()=>{
  const {db,owner,other,anchor}=await legacyFixture();
  try{
   const before=await legacySnapshot(db);
   const authAcl=(await db.query("select nspacl::text acl from pg_namespace where nspname='auth'")).rows;
   await applySourceSql(db);
   expect((await db.query("select current_setting('createrole_self_grant') v")).rows[0].v).toBe('');
   expect(await legacySnapshot(db)).toEqual(before);
   expect((await db.query("select nspacl::text acl from pg_namespace where nspname='auth'")).rows).toEqual(authAcl);
   const roles=(await db.query("select rolcanlogin,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb,rolinherit from pg_roles where rolname='edgelab_v6_source'")).rows;
   expect(roles).toEqual([{rolcanlogin:false,rolsuper:false,rolbypassrls:false,rolcreaterole:false,rolcreatedb:false,rolinherit:false}]);
   expect((await db.query("select has_schema_privilege('edgelab_v6_source','public','CREATE') c,has_schema_privilege('edgelab_v6_source','auth','USAGE') a,pg_has_role('approval_s_migrator','edgelab_v6_source','SET') s,pg_has_role('approval_s_migrator','edgelab_v6_source','USAGE') i")).rows[0]).toEqual({c:false,a:false,s:false,i:false});
   const memberships=(await db.query("select member::regrole::text member,admin_option,inherit_option,set_option from pg_auth_members where roleid='edgelab_v6_source'::regrole")).rows;
   expect(memberships).toEqual([{member:SOURCE_MIGRATOR,admin_option:true,inherit_option:false,set_option:false}]);
   expect((await db.query("select count(*)::int n from pg_auth_members where member='edgelab_v6_source'::regrole")).rows[0].n).toBe(0);
   const functions=(await db.query<{proname:string;owner:string;prosecdef:boolean;proconfig:string[]}>("select proname,proowner::regrole::text owner,prosecdef,proconfig from pg_proc where pronamespace='public'::regnamespace and proname like 'v6_source_%'")).rows;
   expect(functions).toHaveLength(5);
   expect(functions.filter(f=>f.prosecdef).map(f=>f.owner)).toEqual(['edgelab_v6_source','edgelab_v6_source']);
   expect(functions.every(f=>f.proconfig.includes('search_path=""'))).toBe(true);
   expect(functions.find(f=>f.proname==='v6_source_auth_uid')).toMatchObject({prosecdef:false,owner:SOURCE_MIGRATOR});
   expect((await db.query("select count(*)::int n from pg_depend where classid='pg_proc'::regclass and objid='public.v6_source_auth_uid()'::regprocedure and refobjid='auth.uid()'::regprocedure")).rows[0].n).toBe(1);
   expect((await db.query("select count(*)::int n from pg_class where relnamespace='public'::regnamespace and relkind='r' and relname like 'v6_source_%' and relrowsecurity and relforcerowsecurity")).rows[0].n).toBe(7);
   expect((await db.query("select count(*)::int n from pg_policies where schemaname='public' and tablename like 'v6_source_%'")).rows[0].n).toBe(13);
   expect((await db.query("select table_name,privilege_type from information_schema.role_table_grants where grantee='edgelab_v6_source' and table_schema='public' and table_name not like 'v6_source_%'")).rows).toEqual([{table_name:'historical_import_batches',privilege_type:'SELECT'}]);
   for(const f of ['edgelab_save_workspace(jsonb,bigint)','edgelab_save_history(jsonb,bigint,uuid)'])expect((await db.query('select has_function_privilege($1,$2,\'EXECUTE\') allowed',['edgelab_v6_source',f])).rows[0].allowed).toBe(false);
   // An actual owner-RPC call runs through the restricted role without Auth schema USAGE.
   const pilot=crypto.randomUUID(),raw='{}',now=Date.now();
   await db.query('insert into public.v6_source_pilots(user_id,id,history_batch_id,namespace,plan_hash,plan_raw,receipt_hash,receipt_raw,starts_at,expires_at) values($1,$2,$3,$4,$5,$6,$5,$6,$7,$8)',[owner,pilot,anchor,'source-only:'+digest('LOCAL_SYNTHETIC'),digest(raw),raw,new Date(now-1000).toISOString(),new Date(now-1000+14*86400000).toISOString()]);
   await db.exec("alter table public.v6_source_audit add constraint local_runtime_identity check(current_user='edgelab_v6_source')");
   await v6Login(db,owner);
   await db.query("select public.v6_source_owner($1,'stop','{}'::jsonb)",[pilot]);
   expect((await db.query('select * from public.v6_source_pilots')).rows).toHaveLength(1);
   await expect(db.query('select * from public.v6_source_capabilities')).rejects.toThrow(/permission denied/);
   await expect(db.query('select public.v6_source_auth_uid()')).rejects.toThrow(/permission denied/);
   await v6Login(db,other);
   expect((await db.query('select * from public.v6_source_pilots')).rows).toHaveLength(0);
   await expect(db.query("select public.v6_source_owner($1,'stop','{}'::jsonb)",[pilot])).rejects.toThrow();
   await v6Login(db,'','anon');
   await expect(db.query('select * from public.v6_source_objects')).rejects.toThrow(/permission denied/);
   await expect(db.query("select public.v6_source_dispatch($1,null,'load','{}'::jsonb)",[pilot])).rejects.toThrow(/Authentication required/);
   await db.exec('reset role');
   expect(await legacySnapshot(db)).toEqual(before);
  }finally{await db.close();}
 },30000);

 it('rolls back late DDL failure including transferred functions, memberships, ACLs, policy and role',async()=>{
  const {db}=await legacyFixture();
  try{
   const before=await legacySnapshot(db),acl=(await db.query("select nspacl::text acl from pg_namespace where nspname='public'")).rows;
   const policies=(await db.query("select policyname,qual,roles from pg_policies where tablename='historical_import_batches' order by policyname")).rows;
   await db.exec(`set role ${SOURCE_MIGRATOR}`);
   const sql=(await readFile(SOURCE_SQL,'utf8')).replace(/commit;\s*$/,()=>"do $$begin raise exception 'LOCAL late DDL failure';end$$;\ncommit;");
   await expect(db.exec(sql)).rejects.toThrow('LOCAL late DDL failure');
   await db.exec('rollback;reset role');
   expect((await db.query("select count(*)::int n from pg_roles where rolname='edgelab_v6_source'")).rows[0].n).toBe(0);
   expect((await db.query("select count(*)::int n from pg_proc where pronamespace='public'::regnamespace and proname like 'v6_source_%'")).rows[0].n).toBe(0);
   expect((await db.query("select count(*)::int n from pg_class where relnamespace='public'::regnamespace and relname like 'v6_source_%'")).rows[0].n).toBe(0);
   expect((await db.query("select nspacl::text acl from pg_namespace where nspname='public'")).rows).toEqual(acl);
   expect((await db.query("select policyname,qual,roles from pg_policies where tablename='historical_import_batches' order by policyname")).rows).toEqual(policies);
   expect((await db.query("select current_setting('createrole_self_grant') v")).rows[0].v).toBe('');
   expect(await legacySnapshot(db)).toEqual(before);
  }finally{await db.close();}
 },30000);

 it('aborts cleanly when the existing Auth dependency is unavailable',async()=>{
  const {db}=await legacyFixture();
  try{
   await db.exec('revoke execute on function auth.uid() from public');
   const before=await legacySnapshot(db);
   await expect(applySourceSql(db)).rejects.toThrow(/Auth UID execution dependency unavailable/);
   await db.exec('rollback;reset role');
   expect((await db.query("select count(*)::int n from pg_roles where rolname='edgelab_v6_source'")).rows[0].n).toBe(0);
   expect(await legacySnapshot(db)).toEqual(before);
  }finally{await db.close();}
 },30000);
});
