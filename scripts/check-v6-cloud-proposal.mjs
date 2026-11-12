/** Full-schema compatibility under local superuser DDL; no env/network.
 * This DOES NOT prove hosted migration-role compatibility. See the separate
 * check-v6-source-role-compatibility.mjs reproducer and Approval S blocker. */
import {createRequire} from 'node:module';import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const i=process.argv.indexOf('--runtime');if(i<0)throw new Error('Supply existing --runtime path');const {PGlite}=createRequire(path.resolve(process.argv[i+1],'package.json'))('@electric-sql/pglite'),db=new PGlite();let checks=0;
const check=(name,condition)=>{assert.ok(condition,name);checks++;console.log('PASS '+name);};
try{
 await db.exec("create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid stable language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;");
 for(const file of(await fs.readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort())await db.exec((await fs.readFile('supabase/migrations/'+file,'utf8')).replace('create extension if not exists pgcrypto;','-- builtin UUID/hash'));
 check('all deployed-schema migrations apply locally',true);
 const paper=await fs.readFile('supabase/proposals/202611110001_v6_paper.sql','utf8');check('PAPER proposal hash unchanged',createHash('sha256').update(paper).digest('hex')==='c3a0d368ddbda1b50f3dab13aeec7cb3a939e423bce894aa1d55cfe9f13a3dff');
 check('original source proposal hash unchanged',createHash('sha256').update(await fs.readFile('supabase/proposals/202611130001_v6_source_cloud.sql')).digest('hex')==='7a03d765f78b5c1939900d1ddb50809238987104e5399ed772cb900692caf451');
 await db.exec(paper);await db.exec(await fs.readFile('supabase/proposals/202611130002_v6_source_cloud_compatible.sql','utf8'));check('corrected source proposal coexists with deployed schema and local PAPER proposal',true);
 const rows=async sql=>(await db.query(sql)).rows;
 check('seven source tables have enabled and forced RLS',(await rows("select count(*)::int n from pg_class where relnamespace='public'::regnamespace and relname like 'v6_source_%' and relkind='r' and relrowsecurity and relforcerowsecurity"))[0].n===7);
 check('thirteen source-table RLS policies are present',(await rows("select count(*)::int n from pg_policies where schemaname='public' and tablename like 'v6_source_%'"))[0].n===13);
 const functions=await rows("select p.proname,p.prosecdef,r.rolname,p.proconfig from pg_proc p join pg_roles r on p.proowner=r.oid where p.proname in('v6_source_owner','v6_source_dispatch')");check('both definer RPCs use narrow role and fixed empty search path',functions.length===2&&functions.every(f=>f.prosecdef&&f.rolname==='edgelab_v6_source'&&f.proconfig.includes('search_path=""')));
 const role=(await rows("select * from pg_roles where rolname='edgelab_v6_source'"))[0];check('source role cannot log in, bypass RLS or administer roles',!role.rolcanlogin&&!role.rolbypassrls&&!role.rolsuper&&!role.rolcreaterole);
 check('source role has no externally assumable membership',(await rows("select * from pg_auth_members where roleid='edgelab_v6_source'::regrole")).length===0);
 check('source role has no V5 table grants except owned historical anchor SELECT',(await rows("select * from information_schema.role_table_grants where grantee='edgelab_v6_source' and table_schema='public' and table_name not like 'v6_source_%' and not(table_name='historical_import_batches' and privilege_type='SELECT')")).length===0);
 check('authenticated direct source grants are SELECT only on six tables',(await rows("select count(*)::int n from information_schema.role_table_grants where grantee='authenticated' and table_schema='public' and table_name like 'v6_source_%' and privilege_type='SELECT'"))[0].n===6&&(await rows("select * from information_schema.role_table_grants where grantee in('authenticated','anon') and table_name like 'v6_source_%' and privilege_type<>'SELECT'")).length===0);
 console.log(checks+' source-cloud compatibility checks passed (local only; zero hosted writes)');
}finally{await db.close();}
