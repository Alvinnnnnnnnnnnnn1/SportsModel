/** Disposable synthetic PostgreSQL only; no hosted changes or real source import. */
import {describe,it,expect} from 'vitest';
import {digest} from '@/lib/v6/evidence.server';
import {sourceSqlTestDatabase} from './fixtures/v6-source-sql';
const runtime=process.env.EDGELAB_POSTGRES_RUNTIME;
describe.skipIf(!runtime)('V6 source-only cloud SQL acceptance',()=>{
 it('enforces RLS, immutable state, capability expiry, fenced leases, atomic quotas, replay and stopped controls',async()=>{
  const db=await sourceSqlTestDatabase();
  const owner=crypto.randomUUID(),other=crypto.randomUUID(),anchor=crypto.randomUUID(),pilot=crypto.randomUUID(),leaseId=crypto.randomUUID();let token='a'.repeat(64),epoch=0;
  const login=async(id:string,role='authenticated')=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role '+role);};
  const call=async(action:string,p:Record<string,unknown>={},secret:string|null=token)=>{const r=await db.query<{v:unknown}>('select public.v6_source_dispatch($1,$2,$3,$4::jsonb) v',[pilot,secret,action,JSON.stringify(p)]);return r.rows[0].v as Record<string,unknown>;};
  const control=async(action:string,p:Record<string,unknown>={})=>(await db.query<{result:Record<string,unknown>}>('select public.v6_source_owner($1,$2,$3::jsonb) result',[pilot,action,JSON.stringify(p)])).rows[0].result;
  try{
   await db.query('insert into auth.users values($1),($2)',[owner,other]);await db.query('insert into public.historical_import_batches values($1,$2)',[owner,anchor]);
   // Administrator fixture setup is explicitly synthetic. Worker assertions below run anon with a scoped token.
   const now=Date.now(),start=new Date(now-60000).toISOString(),end=new Date(now-60000+14*86400000).toISOString(),period=new Date(now).toISOString().slice(0,7);
   const plan=JSON.stringify({format:'SYNTHETIC_SQL_TEST_ONLY',period}),receipt=JSON.stringify({synthetic:true});
   await db.query('insert into public.v6_source_pilots(user_id,id,history_batch_id,namespace,plan_hash,plan_raw,receipt_hash,receipt_raw,starts_at,expires_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[owner,pilot,anchor,'source-only:'+digest('synthetic'),digest(plan),plan,digest(receipt),receipt,start,end]);
   await login(other);expect((await db.query('select * from public.v6_source_pilots')).rows).toHaveLength(0);await expect(call('load',{},null)).rejects.toThrow();await expect(control('stop')).rejects.toThrow();
   await login('','anon');await expect(db.query('select * from public.v6_source_objects')).rejects.toThrow();await expect(call('load')).rejects.toThrow(/capability/);
   await login(owner);expect((await db.query('select * from public.v6_source_pilots')).rows).toHaveLength(1);await expect(db.query('update public.v6_source_pilots set stopped=false')).rejects.toThrow();await expect(db.query('delete from public.v6_source_pilots')).rejects.toThrow();
   const issued=await control('issue',{tokenHash:digest(token),expiresAt:new Date(now+3600000).toISOString()});await expect(db.query('select * from public.v6_source_capabilities')).rejects.toThrow();
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
   await login(owner);expect((await db.query('select * from public.v6_source_objects')).rows).toHaveLength(2);expect((await db.query('select * from public.v6_source_audit')).rows.length).toBeGreaterThan(5);
   await control('revoke',{credentialId:issued.credentialId});await login('','anon');
   await expect(call('commit',{leaseId:next,epoch,expectedRevision:1,hash:digest(manifestRaw),manifestRaw})).rejects.toThrow(/capability/);
   await login(owner);token='b'.repeat(64);await control('issue',{tokenHash:digest(token),expiresAt:new Date(now+3600000).toISOString()});await login('','anon');
   const forbiddenState=JSON.stringify({ownerId:'source-only:'+digest('synthetic'),positions:[{id:'SYNTHETIC_PAPER'}],grades:[]}),stateHash=digest(forbiddenState);
   await call('put',{leaseId:next,epoch,hash:stateHash,body:forbiddenState});
   const paperManifest=JSON.stringify({...manifest,files:[...manifest.files,{path:'controlled/'+digest('test-owner')+'/source-only-state/'+digest('test-state')+'.json',hash:stateHash,bytes:Buffer.byteLength(forbiddenState)}]});
   await expect(call('commit',{leaseId:next,epoch,expectedRevision:1,hash:digest(paperManifest),manifestRaw:paperManifest})).rejects.toThrow(/PAPER/);
   for(const action of ['register','settle'])await expect(call(action,{leaseId:next,epoch})).rejects.toThrow(/Unsupported source-only/);
   expect((await call('load')).pilot).toMatchObject({revision:1});
   await login(owner);await control('stop');await login('','anon');await expect(call('renew',{leaseId:next,epoch})).rejects.toThrow(/disabled/);
   await db.exec('reset role');await db.query("update public.v6_source_capabilities set expires_at=now()-interval '1 second'");await login('','anon');await expect(call('load')).rejects.toThrow(/capability/);
   const readable=['pilots','objects','snapshots','quotas','reservations','audit'];
   await login(owner);for(const table of readable)expect((await db.query('select * from public.v6_source_'+table)).rows.length).toBeGreaterThan(0);
   const ownerRead=await call('load',{},null);expect(JSON.stringify(ownerRead)).not.toContain('token_hash');expect(JSON.stringify(ownerRead)).not.toContain(token);
   await login(other);for(const table of readable)expect((await db.query('select * from public.v6_source_'+table)).rows).toHaveLength(0);
   await login('','anon');for(const table of [...readable,'capabilities'])await expect(db.query('select * from public.v6_source_'+table)).rejects.toThrow(/permission denied/);
   await db.exec('reset role;set role edgelab_v6_source');
   await expect(db.query("update public.v6_source_objects set body=body||' '")).rejects.toThrow(/append only/);
   await expect(db.query('delete from public.v6_source_objects')).rejects.toThrow(/permission denied/);
   await expect(db.query('update public.v6_source_snapshots set hash=hash')).rejects.toThrow(/append only/);
   await expect(db.query('update public.v6_source_audit set action=action')).rejects.toThrow(/append only/);
   await db.exec('reset role');expect((await db.query("select count(*)::int n from pg_tables where schemaname='public' and tablename like 'v6_source_%' and rowsecurity")).rows[0].n).toBe(7);expect((await db.query("select rolbypassrls,rolcanlogin from pg_roles where rolname='edgelab_v6_source'")).rows[0]).toMatchObject({rolbypassrls:false,rolcanlogin:false});
  }finally{await db.close();}
 },30000);
});
