/** Regression for the actual hosted NOINHERIT execution-role difference.
 * All records/roles are disposable local tests; correction SQL stays unapplied. */
import {readFile} from 'node:fs/promises';
import {describe,it,expect} from 'vitest';
import {v6TestDatabase,type V6TestDB} from './fixtures/v6-postgres';
import {prepareSourceMigrationRole,applySourceSql,SOURCE_MIGRATOR} from './fixtures/v6-source-sql';

const proposal='supabase/proposals/202611130003_v6_source_rpc_acl.sql';
const runtime=process.env.EDGELAB_POSTGRES_RUNTIME;
const acl=async(db:V6TestDB)=>(await db.query("select proname,proacl::text from pg_proc where proname in('v6_source_owner','v6_source_dispatch') order by proname")).rows;
async function fixture(){
 const db=await v6TestDatabase({beforeSourceMigration:true});
 await prepareSourceMigrationRole(db);await applySourceSql(db);return db;
}

describe.skipIf(!runtime)('source RPC ACL correction proposal under NOINHERIT',()=>{
 it('reproduces deployed broad ACLs then applies exact grantor revokes with no residual membership',async()=>{
  const db=await fixture();
  try{
   expect((await db.query("select rolinherit from pg_roles where rolname=$1",[SOURCE_MIGRATOR])).rows[0].rolinherit).toBe(false);
   // Migration02's REVOKE after ownership transfer warns without inherited
   // grant options. Its body Auth guard still rejects anonymous callers.
   expect((await db.query("select has_function_privilege('anon','public.v6_source_owner(uuid,text,jsonb)','EXECUTE') allowed")).rows[0].allowed).toBe(true);
   await db.exec(`set role ${SOURCE_MIGRATOR}`);await db.exec(await readFile(proposal,'utf8'));await db.exec('reset role');
   expect((await db.query("select has_function_privilege('anon','public.v6_source_owner(uuid,text,jsonb)','EXECUTE') allowed")).rows[0].allowed).toBe(false);
   expect((await db.query("select pg_has_role($1,'edgelab_v6_source','SET') s,pg_has_role($1,'edgelab_v6_source','USAGE') i",[SOURCE_MIGRATOR])).rows[0]).toEqual({s:false,i:false});
   expect((await db.query("select member::regrole::text member,admin_option,inherit_option,set_option from pg_auth_members where roleid='edgelab_v6_source'::regrole")).rows).toEqual([{member:SOURCE_MIGRATOR,admin_option:true,inherit_option:false,set_option:false}]);
   expect((await db.query("select count(*)::int n from pg_proc p cross join lateral aclexplode(p.proacl) a where p.proname in('v6_source_owner','v6_source_dispatch') and a.grantee=0")).rows[0].n).toBe(0);
   await db.exec('set role anon');
   await expect(db.query("select public.v6_source_owner('00000000-0000-4000-8000-000000000000','load','{}')")).rejects.toThrow(/permission denied/);
   await expect(db.query("select public.v6_source_dispatch('00000000-0000-4000-8000-000000000000',null,'load','{}')")).rejects.toThrow(/Authentication required/);
   await db.exec('reset role;set role authenticated');
   await expect(db.query("select public.v6_source_owner('00000000-0000-4000-8000-000000000000','load','{}')")).rejects.toThrow(/Authentication required/);
   await db.exec('reset role');
   expect((await db.query('select count(*)::int n from public.v6_source_audit')).rows[0].n).toBe(0);
  }finally{await db.close();}
 },30000);

 it('rolls back ACL and temporary membership if a late correction step fails',async()=>{
  const db=await fixture();
  try{
   const before=await acl(db);
   const sql=(await readFile(proposal,'utf8')).replace(/commit;\s*$/,()=>"do $$begin raise exception 'LOCAL ACL rollback';end$$;\ncommit;");
   await db.exec(`set role ${SOURCE_MIGRATOR}`);await expect(db.exec(sql)).rejects.toThrow('LOCAL ACL rollback');await db.exec('rollback;reset role');
   expect(await acl(db)).toEqual(before);
   expect((await db.query("select pg_has_role($1,'edgelab_v6_source','SET') s,pg_has_role($1,'edgelab_v6_source','USAGE') i",[SOURCE_MIGRATOR])).rows[0]).toEqual({s:false,i:false});
  }finally{await db.close();}
 },30000);
});
