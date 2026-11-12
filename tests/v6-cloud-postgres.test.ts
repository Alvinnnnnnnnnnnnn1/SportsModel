/** Disposable synthetic PostgreSQL only; no hosted changes or real source import. */
import {describe,it,expect} from 'vitest';
import {createRequire} from 'node:module';import path from 'node:path';import fs from 'node:fs/promises';
import {digest} from '@/lib/v6/evidence.server';
import type {V6TestDB} from './fixtures/v6-postgres';
const runtime=process.env.EDGELAB_POSTGRES_RUNTIME;
describe.skipIf(!runtime)('V6 source-only cloud SQL acceptance',()=>{
 it('enforces RLS, immutable state, capability expiry, fenced leases, atomic quotas, replay and stopped controls',async()=>{
  const {PGlite}=createRequire(path.resolve(runtime!,'package.json'))('@electric-sql/pglite') as {PGlite:new()=>V6TestDB};const db=new PGlite();
  const owner=crypto.randomUUID(),other=crypto.randomUUID(),anchor=crypto.randomUUID(),pilot=crypto.randomUUID(),token='a'.repeat(64),leaseId=crypto.randomUUID();let epoch=0;
  const login=async(id:string,role='authenticated')=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role '+role);};
  const call=async(action:string,p:Record<string,unknown>={},secret:string|null=token)=>{const r=await db.query<{v:unknown}>('select public.v6_source_dispatch($1,$2,$3,$4::jsonb) v',[pilot,secret,action,JSON.stringify(p)]);return r.rows[0].v as Record<string,unknown>;};
  const control=(action:string,p:Record<string,unknown>={})=>db.query('select public.v6_source_owner($1,$2,$3::jsonb)',[pilot,action,JSON.stringify(p)]);
  try{
   await db.exec("create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;create table public.historical_import_batches(user_id uuid,id uuid,primary key(user_id,id));alter table public.historical_import_batches enable row level security;create policy owner_read on public.historical_import_batches using(user_id=auth.uid());grant select on public.historical_import_batches to authenticated;");
   await db.exec(await fs.readFile('supabase/proposals/202611130001_v6_source_cloud.sql','utf8'));
   await db.query('insert into auth.users values($1),($2)',[owner,other]);await db.query('insert into public.historical_import_batches values($1,$2)',[owner,anchor]);
   // Administrator fixture setup is explicitly synthetic. Worker assertions below run anon with a scoped token.
   const now=Date.now(),start=new Date(now-60000).toISOString(),end=new Date(now-60000+14*86400000).toISOString(),period=new Date(now).toISOString().slice(0,7);
   const plan=JSON.stringify({format:'SYNTHETIC_SQL_TEST_ONLY',period}),receipt=JSON.stringify({synthetic:true});
   await db.query('insert into public.v6_source_pilots(user_id,id,history_batch_id,namespace,plan_hash,plan_raw,receipt_hash,receipt_raw,starts_at,expires_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[owner,pilot,anchor,'source-only:'+digest('synthetic'),digest(plan),plan,digest(receipt),receipt,start,end]);
   await login(other);expect((await db.query('select * from public.v6_source_pilots')).rows).toHaveLength(0);await expect(call('load',{},null)).rejects.toThrow();await expect(control('stop')).rejects.toThrow();
   await login('','anon');await expect(db.query('select * from public.v6_source_objects')).rejects.toThrow();await expect(call('load')).rejects.toThrow(/capability/);
   await login(owner);expect((await db.query('select * from public.v6_source_pilots')).rows).toHaveLength(1);await expect(db.query('update public.v6_source_pilots set stopped=false')).rejects.toThrow();await expect(db.query('delete from public.v6_source_pilots')).rejects.toThrow();
   await control('issue',{tokenHash:digest(token),expiresAt:new Date(now+3600000).toISOString()});await expect(db.query('select * from public.v6_source_capabilities')).rejects.toThrow();
   const body=JSON.stringify({odds:1.72,sourceUpdatedAt:null,originalForecast:.62}),hash=digest(body);
   await call('put',{body,hash},null);await expect(call('put',{body:body+' ',hash},null)).rejects.toThrow();
   const manifest={format:'edgelab.v6-source-snapshot',version:1,files:[{path:'model-development/artifacts/'+hash+'.json',hash,bytes:Buffer.byteLength(body)}]};const manifestRaw=JSON.stringify(manifest);
   expect(await call('commit',{expectedRevision:0,hash:digest(manifestRaw),manifestRaw},null)).toMatchObject({revision:1});
   expect(await call('get',{hash})).toMatchObject({body});
   await expect(call('commit',{expectedRevision:0,hash:digest(manifestRaw),manifestRaw},null)).rejects.toThrow(/revision/);
   await expect(call('claim',{leaseId})).rejects.toThrow(/disabled/);
   await control('seed_quota',{reserved:10,used:10,remaining:490,uncertain:false,freeConfirmed:true,lastRequestAt:new Date(now-20000).toISOString(),bdlDay:new Date(now).toISOString().slice(0,10),bdlRequests:11,bdlLastAt:new Date(now-20000).toISOString()});
   await expect(control('transfer',{snapshotHash:'wrong'})).rejects.toThrow();
   await control('transfer',{format:'edgelab.v6-source-host-transfer',version:1,approved:true,target:'github_actions',paperRegistrations:false,paperSettlements:false,codeRevision:'b'.repeat(40),snapshotHash:digest(manifestRaw),planHash:digest(plan),localStopped:true,localInFlight:false,approvedAt:new Date(now-1000).toISOString(),approvalReference:'SYNTHETIC TEST OWNER APPROVAL'});
   await login('','anon');epoch=Number((await call('claim',{leaseId})).epoch);const lease=()=>({leaseId,epoch});
   await expect(call('claim',{leaseId:crypto.randomUUID()})).rejects.toThrow(/busy/);
   await expect(call('renew',{leaseId,epoch:epoch-1})).rejects.toThrow(/lost/);
   await expect(call('reserve',{...lease(),id:crypto.randomUUID(),provider:'odds',endpoint:'/v4/sports/basketball_nba/odds',parameters:{bookmakers:'sportsbet',markets:'player_points'},cost:1})).rejects.toThrow(/Unapproved/);
   const id=crypto.randomUUID(),request={...lease(),id,provider:'odds',endpoint:'/v4/sports/basketball_nba/odds',parameters:{bookmakers:'sportsbet',markets:'h2h'},cost:1};
   await call('reserve',request);await call('reserve',request);await expect(call('reserve',{...request,cost:2})).rejects.toThrow();
   const state=await call('load');expect((state.quotas as {provider:string;reserved:number}[]).find(q=>q.provider==='odds')?.reserved).toBe(11);
   await expect(call('reserve',{...request,id:crypto.randomUUID()})).rejects.toThrow(/quota/);
   await call('complete_quota',{...lease(),id,result:{used:11,remaining:489}});await call('complete_quota',{...lease(),id,result:{used:11,remaining:489}});
   await expect(call('complete_quota',{...lease(),id,result:{used:10,remaining:490}})).rejects.toThrow(/conflict/);
   // A changed immutable path and an invalid manifest roll the entire publication back.
   const changed=body+' ',changedHash=digest(changed);await call('put',{...lease(),body:changed,hash:changedHash});
   const bad=JSON.stringify({...manifest,files:[{...manifest.files[0],hash:changedHash,bytes:Buffer.byteLength(changed)}]});
   await expect(call('commit',{...lease(),expectedRevision:1,hash:digest(bad),manifestRaw:bad})).rejects.toThrow(/Immutable/);
   const badPath=JSON.stringify({...manifest,files:[{...manifest.files[0],path:'../worker-credential.json'}]});await expect(call('commit',{...lease(),expectedRevision:1,hash:digest(badPath),manifestRaw:badPath})).rejects.toThrow(/Invalid source/);
   const noFiles=JSON.stringify({...manifest,files:[]});await expect(call('commit',{...lease(),expectedRevision:1,hash:digest(noFiles),manifestRaw:noFiles})).rejects.toThrow(/discard/);
   expect((await call('load')).pilot).toMatchObject({revision:1});
   await call('release',lease());const next=crypto.randomUUID();epoch=Number((await call('claim',{leaseId:next})).epoch);await expect(call('renew',{leaseId,epoch})).rejects.toThrow(/lost/);
   // Root changes test counters/expiry only; the real worker cannot grant itself budget or time.
   await db.exec('reset role');await db.query("update public.v6_source_quotas set reserved=60,last_request_at=now()-interval '2 seconds' where provider='odds'");await login('','anon');
   await expect(call('reserve',{...request,leaseId:next,epoch,id:crypto.randomUUID()})).rejects.toThrow(/quota/);
   await login(other);expect((await db.query('select * from public.v6_source_objects')).rows).toHaveLength(0);expect((await db.query('select * from public.v6_source_audit')).rows).toHaveLength(0);
   await login(owner);expect((await db.query('select * from public.v6_source_objects')).rows).toHaveLength(2);expect((await db.query('select * from public.v6_source_audit')).rows.length).toBeGreaterThan(5);await control('stop');await login('','anon');await expect(call('renew',{leaseId:next,epoch})).rejects.toThrow(/disabled/);
   await db.exec('reset role');await db.query("update public.v6_source_capabilities set expires_at=now()-interval '1 second'");await login('','anon');await expect(call('load')).rejects.toThrow(/capability/);
   await db.exec('reset role');expect((await db.query("select count(*)::int n from pg_tables where schemaname='public' and tablename like 'v6_source_%' and rowsecurity")).rows[0].n).toBe(7);expect((await db.query("select rolbypassrls,rolcanlogin from pg_roles where rolname='edgelab_v6_source'")).rows[0]).toMatchObject({rolbypassrls:false,rolcanlogin:false});
  }finally{await db.close();}
 },30000);
});
