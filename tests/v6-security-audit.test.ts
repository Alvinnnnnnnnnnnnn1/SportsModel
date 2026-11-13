import {describe,it,expect} from 'vitest';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {digest} from '@/lib/v6/evidence.server';
import {v6TestDatabase,v6Login,type V6TestDB} from './fixtures/v6-postgres';
import {createEmptyData} from '@/lib/domain/fixtures';
const runtime=process.env.EDGELAB_POSTGRES_RUNTIME;
const reviewedHash='535df727704be74882c97f966466965d3993255bd5d9b09cc5f17257c753ec5c';
async function legacyFingerprint(db:V6TestDB){
 const tables=(await db.query<{name:string}>("select tablename name from pg_tables where schemaname='public' and tablename not like 'v6_%' order by tablename")).rows;
 const data=[];for(const {name}of tables)data.push({name,rows:(await db.query('select to_jsonb(t) row from public.'+name+' t order by to_jsonb(t)::text')).rows});
 const objects=(await db.query("select c.relname,c.relkind,c.relowner,c.relrowsecurity,c.relacl::text from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname not like 'v6_%' order by c.relname")).rows;
 const constraints=(await db.query("select c.relname,k.conname,pg_get_constraintdef(k.oid) definition from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname not like 'v6_%' order by c.relname,k.conname")).rows;
 const triggers=(await db.query("select c.relname,t.tgname,pg_get_triggerdef(t.oid) definition from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname not like 'v6_%' order by c.relname,t.tgname")).rows;
 const policies=(await db.query("select * from pg_policies where schemaname='public' and tablename not like 'v6_%' order by tablename,policyname")).rows;
 const functions=(await db.query("select p.oid::regprocedure::text signature,pg_get_functiondef(p.oid) definition,p.proacl::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname not like 'v6_%' order by signature")).rows;
 return digest(JSON.stringify({data,objects,constraints,triggers,policies,functions}));
}
async function seed(db:V6TestDB){
 const id='96000000-0000-4000-8000-000000000001';await db.query('insert into auth.users values($1)',[id]);await v6Login(db,id);
 const workspace=createEmptyData();workspace.audit.push({id:crypto.randomUUID(),entityType:'settings',entityId:'settings',action:'SYNTHETIC LOCAL LEGACY SENTINEL',timestamp:new Date().toISOString(),before:null,after:workspace.settings});
 await db.query('select public.edgelab_save_workspace($1::jsonb,0)',[JSON.stringify(workspace)]);await db.exec('reset role');
}
describe.skipIf(!runtime)('exact V6 SQL review, non-V6 preservation and transactional rollback',()=>{
 it('verifies and executes the exact reviewed migration and inventories the hardened candidate',async()=>{
  const reviewed=execFileSync('git',['show','2c94865:supabase/proposals/202611110001_v6_paper.sql'],{encoding:'utf8'});expect(digest(reviewed)).toBe(reviewedHash);
  const report:Record<string,unknown>={reviewedHash};
  for(const [label,sql]of [['reviewed',reviewed],['candidate',await readFile('supabase/proposals/202611110001_v6_paper.sql','utf8')]]){
   const db=await v6TestDatabase({beforeSourceMigration:true});try{
    await seed(db);const before=await legacyFingerprint(db);
    // Reproduce Supabase's possible permissive new-function default ACLs.
    await db.exec('alter default privileges in schema public grant execute on functions to anon,authenticated,service_role');
    await db.exec(sql);expect(await legacyFingerprint(db)).toBe(before);
    const tables=(await db.query("select tablename,rowsecurity from pg_tables where schemaname='public' and tablename like 'v6_%' order by tablename")).rows;expect(tables.length).toBe(label==='reviewed'?10:11);expect(tables.every(t=>t.rowsecurity)).toBe(true);
    const functions=(await db.query("select p.oid::regprocedure::text signature,p.prosecdef,pg_get_userbyid(p.proowner) owner,p.proconfig,p.proacl::text,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'v6_%' order by signature")).rows;
    expect(functions.every(f=>JSON.stringify(f.proconfig).includes('search_path='))).toBe(true);
    const definers=functions.filter(f=>f.prosecdef);expect(definers).toHaveLength(label==='reviewed'?0:4);expect(definers.every(f=>f.owner==='edgelab_v6_worker')).toBe(true);
    for(const f of definers){expect((await db.query('select has_function_privilege(\'anon\',$1,\'EXECUTE\') allowed',[f.signature])).rows[0].allowed).toBe(String(f.signature).startsWith('v6_worker_access('));expect((await db.query('select has_function_privilege(\'service_role\',$1,\'EXECUTE\') allowed',[f.signature])).rows[0].allowed).toBe(false);}
    const role=(await db.query("select rolcanlogin,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolreplication,rolbypassrls from pg_roles where rolname='edgelab_v6_worker'")).rows[0];expect(Object.values(role).every(v=>v===false)).toBe(true);
    expect((await db.query("select has_schema_privilege('edgelab_v6_worker','public','CREATE') allowed")).rows[0].allowed).toBe(false);
    report[label]={hash:digest(sql),tables,functions,role,legacyFingerprintUnchanged:true,policies:(await db.query("select * from pg_policies where schemaname='public' and tablename like 'v6_%' order by tablename,policyname")).rows,triggers:(await db.query("select tgname,pg_get_triggerdef(oid) definition from pg_trigger where tgname like 'v6_%' order by tgname,oid")).rows,indexes:(await db.query("select indexname,indexdef from pg_indexes where schemaname='public' and tablename like 'v6_%' order by indexname")).rows};
   }finally{await db.close();}
  }
  if(process.env.EDGELAB_SECURITY_REPORT){await mkdir('.local/v6/security-review',{recursive:true,mode:0o700});await writeFile(process.env.EDGELAB_SECURITY_REPORT,JSON.stringify(report,null,2),{mode:0o600});}
 },60000);
 it('rolls back every DDL object, role and grant on late failure, and rejects existing-role collisions without altering them',async()=>{
  const reviewed=execFileSync('git',['show','2c94865:supabase/proposals/202611110001_v6_paper.sql'],{encoding:'utf8'}),candidate=await readFile('supabase/proposals/202611110001_v6_paper.sql','utf8');
  for(const sql of [reviewed,candidate]){const db=await v6TestDatabase({beforeSourceMigration:true});try{
   await seed(db);const before=await legacyFingerprint(db);
   await expect(db.exec(sql.replace(/commit;\s*$/,'select 1/0;\ncommit;'))).rejects.toThrow();await db.exec('rollback');
   expect(await legacyFingerprint(db)).toBe(before);expect((await db.query("select count(*)::int n from pg_tables where tablename like 'v6_%'")).rows[0].n).toBe(0);
   expect((await db.query("select count(*)::int n from pg_roles where rolname='edgelab_v6_worker'")).rows[0].n).toBe(0);
   await db.exec(sql);expect(await legacyFingerprint(db)).toBe(before);expect((await db.query("select count(*)::int n from pg_tables where tablename like 'v6_%'")).rows[0].n).toBeGreaterThan(0);
  }finally{await db.close();}}
  const db=await v6TestDatabase({beforeSourceMigration:true});try{await db.exec('create role edgelab_v6_worker login');await expect(db.exec(candidate)).rejects.toThrow(/collision/);await db.exec('rollback');expect((await db.query("select rolcanlogin from pg_roles where rolname='edgelab_v6_worker'")).rows[0].rolcanlogin).toBe(true);}finally{await db.close();}
 },60000);
});
