/** Fresh disposable runners and synthetic RPC/provider ports. No live network. */
import {it,expect,vi} from 'vitest';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {runCloudSourceTick,type CloudRPC} from '@/lib/v6/cloud/runner.server';
import {ORIGINAL_PLAN,ORIGINAL_RECEIPT} from '@/lib/v6/cloud/client.server';
import {snapshotDirectory} from '@/lib/v6/cloud/snapshot.server';
import {digest} from '@/lib/v6/evidence.server';
import {controlledConfigSchema,collectionReceiptSchema,policyBundleHash} from '@/lib/v6/controlled-activation';
import {sourcePilotPlanSchema} from '@/lib/v6/source-pilot';
import {model2Fixture} from './fixtures/v6-prediction';
it('persists the actual worker journal across fresh runners, suppresses replay I/O and refuses broken evidence',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'v6-cloud-runner-test-'));
 try{
  const {artifactHash}=await model2Fixture(root),ownerId='synthetic-owner';
  const plan=sourcePilotPlanSchema.parse({format:'edgelab.v6-source-pilot',version:1,ownerId,historyBatchId:crypto.randomUUID(),startsAt:'2026-11-13T13:00:00.000Z',expiresAt:'2026-11-27T13:00:00.000Z',period:'2026-11',baselineReserved:10,baselineUsed:10,additionalOddsCredits:50,monthlyOddsCeiling:60,providerReserve:100,artifactHash,scope:'NBA_Sportsbet_full_game_moneyline_observations_only',cadence:{discoveryHourMelbourne:19,resultsHourMelbourne:18,finalResultsHourMelbourne:21,lastEventHoursBeforeEnd:8,captureDays:13,resultTailDays:1,preStartJobs:false,catchupMinutes:120,tickSeconds:60},paperRegistrations:false,paperSettlements:false,modelActivation:false,hostedAccess:false,externalMessaging:false});
  const config=controlledConfigSchema.parse({version:1,ownerId,mode:'dry_run',killSwitch:false,sourcesEnabled:true,modelManifest:null,activationReceipt:null,monthlyOddsCeiling:60,sourceOnly:true,sourcePilotPlanHash:digest(JSON.stringify(plan))});
  const receipt=collectionReceiptSchema.parse({format:'edgelab.v6-shadow-collection',version:1,ownerId,approvedAt:'2026-11-12T13:00:00Z',expiresAt:plan.expiresAt,approvalReference:'SYNTHETIC TEST APPROVAL ONLY',policyBundleHash:await policyBundleHash(),scope:'zero_cost_read_only_shadow',sourceRightsConfirmed:true,monthlyOddsCeiling:60,pilot:{plan,planHash:digest(JSON.stringify(plan)),approvalStatus:'approved'}});
  const {manifest,objects}=await snapshotDirectory(root);let snapshotRaw=JSON.stringify(manifest),snapshot:unknown=manifest,revision=1,epoch=0,leased=false,stop=false,breakRead=false,changeOnClaim=false,failAfterClaim=false,corruptRead=false;
  const pilotId=crypto.randomUUID(),userId=crypto.randomUUID();
  const transferHash=digest(snapshotRaw),transfer={format:'edgelab.v6-source-host-transfer',version:1,approved:true,approvedAt:'2026-11-12T13:00:00Z',approvalReference:'SYNTHETIC TEST APPROVAL ONLY',planHash:ORIGINAL_PLAN,snapshotHash:transferHash,target:'github_actions',localStopped:true,localInFlight:false,paperRegistrations:false,paperSettlements:false,codeRevision:'b'.repeat(40)};
  const calls:string[]=[],rpc:CloudRPC={async call<T>(action:string,p:Record<string,unknown>={}){calls.push(action);let result:unknown;
   if(action==='load'&&leased&&failAfterClaim)throw new Error('Failed post-claim load');
   if(action==='load')result={pilot:{id:pilotId,user_id:userId,history_batch_id:plan.historyBatchId,namespace:ownerId,plan_hash:ORIGINAL_PLAN,plan_raw:'SYNTHETIC TEST',receipt_hash:ORIGINAL_RECEIPT,receipt_raw:'SYNTHETIC TEST',starts_at:plan.startsAt,expires_at:plan.expiresAt,active_host:'cloud',stopped:stop,epoch,revision,snapshot_hash:digest(snapshotRaw),transfer_snapshot_hash:transferHash,transfer_approval:transfer,lease_until:null,last_attempt_at:null},snapshot,snapshotRaw,quotas:[]};
   else if(action==='claim'){if(changeOnClaim)transfer.codeRevision='c'.repeat(40);if(leased)throw new Error('busy');leased=true;epoch++;result={epoch};}
   else if(action==='get'){if(breakRead)throw new Error('Synthetic network failure');result={body:corruptRead?'{}':objects.get(String(p.hash))};}
   else if(action==='put'){expect(digest(String(p.body))).toBe(p.hash);objects.set(String(p.hash),String(p.body));result={};}
   else if(action==='commit'){expect(p.expectedRevision).toBe(revision);snapshotRaw=String(p.manifestRaw);snapshot=JSON.parse(snapshotRaw);revision++;result={revision};}
   else if(action==='release'){leased=false;result={};}
   else if(action==='renew'){if(stop)throw new Error('stopped');result={};}
   else throw new Error('Unexpected cloud operation '+action);return result as T;
  }};
  const collect=vi.fn(async()=>[]),prepare=vi.fn(async()=>({provider:{collectionPermitted:true,collect,grade:async()=>null},model:{modelId:'nba-team-elo-only',version:'candidate-1',validationManifestHash:'a'.repeat(64),forecast:async()=>null}})),resolveControls=()=>({plan,controls:{config,manifest:null,receipt}}),options={enabled:true,reviewedCodeRevision:'b'.repeat(40),clock:()=> '2026-11-14T08:00:00Z',prepare,resolveControls};
  expect(await runCloudSourceTick(rpc,options)).toMatchObject({status:'completed',paperRegistrations:0});expect(collect).toHaveBeenCalledTimes(1);expect(leased).toBe(false);expect(calls).toContain('commit');
  // A fresh runner executes the other due job (results at 18h, discovery at 19h).
  await runCloudSourceTick(rpc,options);expect(collect).toHaveBeenCalledTimes(2);
  // A third fresh runner must not recollect either completed job.
  await runCloudSourceTick(rpc,options);expect(collect).toHaveBeenCalledTimes(2);expect(prepare).toHaveBeenCalledTimes(2);
  corruptRead=true;await expect(runCloudSourceTick(rpc,options)).rejects.toThrow('Cloud scheduler hash mismatch');expect(leased).toBe(false);corruptRead=false;
  await expect(runCloudSourceTick(rpc,{...options,reviewedCodeRevision:'c'.repeat(40)})).rejects.toThrow('Cloud code revision');
  failAfterClaim=true;await expect(runCloudSourceTick(rpc,options)).rejects.toThrow('Failed post-claim load');expect(leased).toBe(false);failAfterClaim=false;
  changeOnClaim=true;await expect(runCloudSourceTick(rpc,options)).rejects.toThrow('Cloud authority changed');expect(leased).toBe(false);changeOnClaim=false;transfer.codeRevision='b'.repeat(40);
  stop=true;expect(await runCloudSourceTick(rpc,options)).toMatchObject({status:'emergency_stopped',providerRequests:0});stop=false;
  const later={...options,clock:()=> '2026-11-15T08:00:00Z'};breakRead=true;await expect(runCloudSourceTick(rpc,later)).rejects.toThrow('Synthetic network failure');expect(leased).toBe(false);expect(collect).toHaveBeenCalledTimes(2);
  expect(await runCloudSourceTick(rpc,{...options,clock:()=>plan.expiresAt})).toMatchObject({status:'window_expired',paperRegistrations:0});
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
