/** Synthetic local storage controls only; no hosted users, tokens or records. */
import {it,expect} from 'vitest';import {readFile} from 'node:fs/promises';
import {sourceSqlTestDatabase,SOURCE_MIGRATOR} from './fixtures/v6-source-sql';
import {digest} from '@/lib/v6/evidence.server';
import {acceptStoppedSource} from '@/lib/v6/cloud/acceptance.server';
import {provisionStoppedSnapshot,verifyStoppedSnapshot,type OwnerBootstrapPort,StoppedProvisioningError} from '@/lib/v6/cloud/provisioning.server';

it.skipIf(!process.env.EDGELAB_POSTGRES_RUNTIME)('replays approved storage logic across owner contexts, immutable/CAS failures and partial publication without activation',async()=>{
 const db=await sourceSqlTestDatabase(),owner=crypto.randomUUID(),other=crypto.randomUUID(),pilot=crypto.randomUUID(),anchor=crypto.randomUUID(),now=Date.now();
 try{
  await db.exec(`set role ${SOURCE_MIGRATOR}`);await db.exec(await readFile('supabase/migrations/202611130003_v6_source_rpc_acl.sql','utf8'));await db.exec('reset role');
  await db.query('insert into auth.users values($1),($2)',[owner,other]);await db.query('insert into public.historical_import_batches values($1,$2)',[owner,anchor]);
  const plan=JSON.stringify({period:new Date().toISOString().slice(0,7),synthetic:'LOCAL STORAGE TEST ONLY'});
  await db.query('insert into public.v6_source_pilots(user_id,id,history_batch_id,namespace,plan_hash,plan_raw,receipt_hash,receipt_raw,starts_at,expires_at) values($1,$2,$3,$4,$5,$6,$5,$6,$7,$8)',[owner,pilot,anchor,'source-only:'+digest('SYNTHETIC'),digest(plan),plan,new Date(now-1000).toISOString(),new Date(now-1000+14*86400000).toISOString()]);
  const login=async(id:string,role='authenticated')=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role '+role);};
  const actions:string[]=[];const port=(id:string):OwnerBootstrapPort=>({control:async(action,p)=>{actions.push(action);await login(id);return (await db.query('select public.v6_source_owner($1,$2,$3::jsonb) r',[pilot,action,JSON.stringify(p)])).rows[0].r;},dispatch:async(action,p)=>{actions.push(action);await login(id);return (await db.query('select public.v6_source_dispatch($1,null,$2,$3::jsonb) r',[pilot,action,JSON.stringify(p)])).rows[0].r;}});
  const body=JSON.stringify({synthetic:true,note:'LOCAL STORAGE ONLY; not sporting evidence'}),hash=digest(body),objects=new Map([[hash,body]]),manifestRaw=JSON.stringify({format:'edgelab.v6-source-snapshot',version:1,files:[{path:'evidence/'+hash+'.json',hash,bytes:Buffer.byteLength(body)}]});
  const existing={id:pilot,user_id:owner,revision:0,stopped:true,active_host:'none',snapshot_hash:null};
  const input={ownerId:owner,pilotId:pilot,manifestRaw,objects,provision:{},quotaSeed:{reserved:10,used:10,remaining:490,uncertain:true,freeConfirmed:false,lastRequestAt:new Date(now).toISOString(),bdlDay:new Date().toISOString().slice(0,10),bdlRequests:0,bdlLastAt:new Date(now).toISOString(),bdlBlockedUntil:null}};
  expect(await provisionStoppedSnapshot(port(owner),input,existing)).toMatchObject({revision:1,stopped:true,activeHost:'none'});
  expect(await verifyStoppedSnapshot(port(owner),input)).toMatchObject({revision:1,objects:1}); // fresh port/JWT context, same isolated database
  actions.length=0;expect((await provisionStoppedSnapshot(port(owner),input,{...existing,revision:1,snapshot_hash:digest(manifestRaw)})).status).toBe('already_provisioned_read_back');expect(actions).toEqual(['load','get']);
  await expect(port(other).dispatch('load',{})).rejects.toThrow();await expect(port(other).dispatch('get',{hash})).rejects.toThrow();
  await login(other);for(const t of ['pilots','objects','snapshots','quotas','reservations','audit'])expect((await db.query('select * from public.v6_source_'+t)).rows).toHaveLength(0);
  await expect(db.query('select * from public.v6_source_capabilities')).rejects.toThrow(/permission denied/);
  await expect(port(owner).dispatch('put',{hash,body:body+' '})).rejects.toThrow(/hash mismatch/);
  await expect(port(owner).dispatch('commit',{expectedRevision:0,manifestRaw,hash:digest(manifestRaw)})).rejects.toThrow(/revision/);
  const nextBody=JSON.stringify({synthetic:true,second:true}),nextHash=digest(nextBody),nextRaw=JSON.stringify({...JSON.parse(manifestRaw),files:[...JSON.parse(manifestRaw).files,{path:'evidence/'+nextHash+'.json',hash:nextHash,bytes:Buffer.byteLength(nextBody)}]});
  const stale=provisionStoppedSnapshot(port(owner),{...input,manifestRaw:nextRaw,objects:new Map([...objects,[nextHash,nextBody]])},existing);await expect(stale).rejects.toMatchObject({stage:'publish',uploadedObjects:2});
  expect(await verifyStoppedSnapshot(port(owner),input)).toMatchObject({revision:1}); // failed CAS retained the original published manifest
  const third=JSON.stringify({synthetic:true,third:true}),thirdHash=digest(third),real=port(owner);let puts=0;
  const failing:OwnerBootstrapPort={control:real.control,dispatch:async(a,p)=>{if(a==='put'&&++puts===2)throw new Error('LOCAL interrupted upload');return real.dispatch(a,p);}};
  const bad=provisionStoppedSnapshot(failing,{...input,manifestRaw:nextRaw,objects:new Map([...objects,[nextHash,nextBody]])},{...existing,revision:1});await expect(bad).rejects.toBeInstanceOf(StoppedProvisioningError);
  const invalid={...input,manifestRaw:JSON.stringify({...JSON.parse(manifestRaw),files:[{path:'evidence/'+thirdHash+'.json',hash:thirdHash,bytes:1}]}),objects:new Map([[thirdHash,third]])};actions.length=0;await expect(provisionStoppedSnapshot(port(owner),invalid,existing)).rejects.toThrow('integrity');expect(actions).toEqual([]);
  const context=(id:string,role='authenticated')=>({userId:id||null,port:port(id),read:async(table:string)=>{if(!['pilots','objects','snapshots','quotas','reservations','audit','capabilities'].includes(table))throw new Error('Test table allowlist');await login(id,role);return (await db.query('select * from public.v6_source_'+table)).rows;},ownerControlProbe:async()=>{await login(id,role);return db.query("select public.v6_source_owner($1,'load','{}')",[pilot]);}});
  const acceptance=await acceptStoppedSource(input,{owner:context(owner),freshOwner:context(owner),other:context(other),anonymous:context('','anon')});expect(acceptance.checks).toHaveLength(16);expect(acceptance.cloudActivated).toBe(false);
  const disconnected=context(other);disconnected.port={...disconnected.port,dispatch:async()=>{throw new Error('LOCAL network unavailable');}};await expect(acceptStoppedSource(input,{owner:context(owner),freshOwner:context(owner),other:disconnected,anonymous:context('','anon')})).rejects.toThrow('unexpected error');
  await login('','anon');await expect(db.query("select public.v6_source_owner($1,'load','{}')",[pilot])).rejects.toThrow(/permission denied/);
  await db.exec('reset role');expect((await db.query('select active_host,stopped,lease_id from public.v6_source_pilots')).rows[0]).toEqual({active_host:'none',stopped:true,lease_id:null});expect((await db.query('select count(*)::int n from public.v6_source_capabilities')).rows[0].n).toBe(0);
 }finally{await db.close();}
},30000);
