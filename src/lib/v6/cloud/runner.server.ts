import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {cloudPilotSchema,originalControls,validateHostTransfer,type SourceQuotaJournal,type CloudPilot} from './client.server';
import {snapshotDirectory,restoreSnapshot,validateSnapshot} from './snapshot.server';
import {atomicPrivateJson,digest} from '../evidence.server';
import {sourcePilotIdleState} from '../source-pilot';
import {collectionApprovalReasons} from '../controlled-activation';
import {localV6Repository} from '../repository.server';
import {planControlledJobs,runControlledTick,type ScheduledPorts} from '../controlled-scheduler.server';
import {predictionArtifactSchema} from '../prediction/forecast';
import {loadModel2ShadowConfig} from '../prediction/shadow.server';
import {prepareControlledTeamPorts} from '../controlled-team-runtime.server';
export interface CloudRPC {call<T=unknown>(action:string,payload?:Record<string,unknown>):Promise<T>;}
interface Loaded {pilot:CloudPilot;snapshot:unknown;snapshotRaw:string|null;quotas:{provider:string;period:string;reserved:number;used:number|null;remaining:number|null;uncertain:boolean;free_confirmed:boolean;last_request_at:string|null;blocked_until:string|null}[];}
/** Durable outer lease fences the existing scheduler and registered worker. Its
 * filesystem is a fresh disposable cache; all source reservations are remote. */
export async function runCloudSourceTick(rpc:CloudRPC,options:{enabled:boolean;clock?:()=>string;keys?:{oddsKey?:string;bdlKey?:string};prepare?:ScheduledPorts['prepare'];resolveControls?:typeof originalControls;reviewedCodeRevision?:string}={enabled:false}){
 if(!options.enabled)return {status:'cloud_disabled',workerInvoked:false,providerRequests:0,paperRegistrations:0};
 const clock=options.clock??(()=>new Date().toISOString());
 let loaded=await rpc.call<Loaded>('load');const pilot=cloudPilotSchema.parse(loaded.pilot),{plan,controls}=(options.resolveControls??originalControls)(pilot);
 const idle=sourcePilotIdleState(plan,clock(),pilot.stopped||pilot.active_host!=='cloud');
 if(idle)return {status:idle,workerInvoked:false,providerRequests:0,paperRegistrations:0};
 const transfer=validateHostTransfer(pilot.transfer_approval,pilot,clock());if(transfer.codeRevision!==options.reviewedCodeRevision)throw new Error('Cloud code revision does not match owner host-transfer approval');
 if((await collectionApprovalReasons(controls.config,controls.receipt,clock())).length)throw new Error('Original source approval is invalid');
 if(!loaded.snapshot)throw new Error('Approved handover snapshot missing');
 const leaseId=crypto.randomUUID(),claim=await rpc.call<{epoch:number}>('claim',{leaseId}),lease={leaseId,epoch:claim.epoch};
 loaded=await rpc.call<Loaded>('load');if(loaded.pilot.epoch!==claim.epoch)throw new Error('Cloud lease fencing mismatch');
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'edgelab-v6-source-'));let revision=loaded.pilot.revision,requests=0;
 const refresh=async()=>{await rpc.call('renew',lease);return controls;};
 try{
  if(!loaded.snapshotRaw||digest(loaded.snapshotRaw)!==loaded.pilot.snapshot_hash)throw new Error('Cloud manifest hash mismatch');
  const current=validateSnapshot(JSON.parse(loaded.snapshotRaw)),schedulerFile=current.files.find(f=>f.path===`controlled/${digest(plan.ownerId)}/scheduler.json`);
  const scheduler=schedulerFile?JSON.parse((await rpc.call<{body:string}>('get',{hash:schedulerFile.hash})).body):{jobs:[]};
  const planned=planControlledJobs([],clock(),plan),now=Date.parse(clock());
  const due=planned.some(j=>{const old=scheduler.jobs.find((s:{id:string})=>s.id===j.id);return Date.parse(j.dueAt)<=now&&(!old||!['completed','failed','missed','blocked'].includes(old.status))&&(!old?.nextAt||Date.parse(old.nextAt)<=now);});
  if(!due)return {status:'idle',workerInvoked:false,providerRequests:0,paperRegistrations:0,snapshotRevision:revision};
  await restoreSnapshot(root,current,async hash=>(await rpc.call<{body:string}>('get',{hash})).body);
  const model=await loadModel2ShadowConfig(root,plan.ownerId,clock());if(!model||model.artifactHash!==plan.artifactHash)throw new Error('Frozen model configuration mismatch');
  const artifact=predictionArtifactSchema.parse(JSON.parse(await fs.readFile(path.join(root,'model-development/artifacts',plan.artifactHash+'.json'),'utf8')));if(digest(JSON.stringify(artifact))!==plan.artifactHash)throw new Error('Frozen artifact integrity mismatch');
  // Remote reservations outrank any stale local journal from an interrupted run.
  for(const q of loaded.quotas){if(q.provider==='odds')await atomicPrivateJson(path.join(root,'odds-shared-budget.json'),{period:q.period,reserved:q.reserved,used:q.used,remaining:q.remaining,uncertain:q.uncertain,freeConfirmed:q.free_confirmed,lastRequest:q.last_request_at?Date.parse(q.last_request_at):0});
   else if(q.provider==='bdl'&&q.period===clock().slice(0,10))await atomicPrivateJson(path.join(root,'balldontlie-team-budget.json'),{day:q.period,requests:q.reserved,lastAt:q.last_request_at?Date.parse(q.last_request_at):0,blockedUntil:q.blocked_until?Date.parse(q.blocked_until):0,starts:[]});}
  const repository=localV6Repository(path.join(root,'controlled',digest(plan.ownerId),'source-only-state'),plan.ownerId);
  const existing=await repository.read();if(existing.positions.length||existing.grades.length)throw new Error('Source worker cannot load paper positions');
  const journal:SourceQuotaJournal={reserve:async(provider,endpoint,parameters,cost)=>{await refresh();const id=crypto.randomUUID();await rpc.call('reserve',{...lease,id,provider,endpoint,parameters,cost});requests++;return id;},complete:async(id,result)=>{await rpc.call('complete_quota',{...lease,id,result});}};
  const checkpoint=async()=>{await refresh();const {manifest,objects}=await snapshotDirectory(root);const retained=new Set(current.files.map(f=>f.hash));for(const [hash,body]of objects)if(!retained.has(hash))await rpc.call('put',{...lease,hash,body});const manifestRaw=JSON.stringify(manifest),hash=digest(manifestRaw);const saved=await rpc.call<{revision:number}>('commit',{...lease,expectedRevision:revision,manifestRaw,hash});revision=saved.revision;};
  const operational=path.join(root,'controlled',digest(plan.ownerId));
  let fixtures=[];try{fixtures=JSON.parse(await fs.readFile(path.join(root,'controlled/discovered-fixtures.json'),'utf8')).fixtures;}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
  const result=await runControlledTick(operational,{repository,clock,readControl:refresh,prepare:options.prepare??(async job=>prepareControlledTeamPorts(root,repository,job,controls,options.keys??{},clock,refresh,journal))},planControlledJobs(fixtures,clock(),plan));
  const final=await repository.read();if(final.positions.length||final.grades.length)throw new Error('Source-only invariant failed');
  await checkpoint();return {...result,providerRequests:requests,paperRegistrations:0,snapshotRevision:revision};
 }finally{try{await rpc.call('release',lease);}finally{await fs.rm(root,{recursive:true,force:true});}}
}
