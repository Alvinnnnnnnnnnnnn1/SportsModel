import {digest} from '../evidence.server';
import {validateSnapshot} from './snapshot.server';

export interface StoppedPilot {id:string;user_id:string;revision:number;active_host:string;stopped:boolean;snapshot_hash:string|null;}
export interface OwnerBootstrapPort {
 control(action:'provision'|'seed_quota',payload:Record<string,unknown>):Promise<unknown>;
 dispatch(action:'put'|'commit'|'load'|'get',payload:Record<string,unknown>):Promise<unknown>;
}
export class StoppedProvisioningError extends Error {
 constructor(readonly stage:string,readonly uploadedObjects:number){super('Stopped provisioning failed at '+stage+'; retain immutable objects and inspect audit before replay');}
}
export interface StoppedBundle {ownerId:string;pilotId:string;manifestRaw:string;objects:Map<string,string>;provision:Record<string,unknown>;quotaSeed:Record<string,unknown>;}

/** A read-only acceptance function reusable by a newly authenticated session. */
export async function verifyStoppedSnapshot(port:OwnerBootstrapPort,input:Pick<StoppedBundle,'ownerId'|'pilotId'|'manifestRaw'>){
 const expected=validateSnapshot(JSON.parse(input.manifestRaw));
 const loaded=await port.dispatch('load',{}) as {pilot:StoppedPilot;snapshotRaw:string|null};
 if(loaded.pilot?.id!==input.pilotId||loaded.pilot.user_id!==input.ownerId||!loaded.pilot.stopped||loaded.pilot.active_host!=='none'||loaded.pilot.snapshot_hash!==digest(input.manifestRaw)||loaded.snapshotRaw!==input.manifestRaw||JSON.stringify(loaded).includes('token_hash'))throw new Error('Stopped owner snapshot read-back mismatch');
 const seen=new Set<string>();for(const file of expected.files){if(seen.has(file.hash))continue;seen.add(file.hash);const result=await port.dispatch('get',{hash:file.hash}) as {body:string};if(typeof result.body!=='string'||digest(result.body)!==file.hash||Buffer.byteLength(result.body)!==file.bytes)throw new Error('Stopped object read-back mismatch');}
 return {revision:loaded.pilot.revision,objects:seen.size,stopped:true,activeHost:'none'};
}

/** Normal owner session only, after separate exact-bundle approval/anchor checks.
 * RPCs are separate transactions: failed publication may leave unreferenced
 * immutable objects. Never delete them, activate, issue a token or retry here. */
export async function provisionStoppedSnapshot(port:OwnerBootstrapPort,input:StoppedBundle,existing:StoppedPilot|null){
 const manifest=validateSnapshot(JSON.parse(input.manifestRaw)),hash=digest(input.manifestRaw);
 for(const f of manifest.files){const body=input.objects.get(f.hash);if(!body||digest(body)!==f.hash||Buffer.byteLength(body)!==f.bytes)throw new Error('Object integrity failed before any hosted write');JSON.parse(body);}
 if(existing&&(existing.id!==input.pilotId||existing.user_id!==input.ownerId||!existing.stopped||existing.active_host!=='none'))throw new Error('Existing source pilot requires separate review');
 let stage='provision',uploadedObjects=0;
 try{
  if(existing?.snapshot_hash===hash)return {status:'already_provisioned_read_back',...await verifyStoppedSnapshot(port,input)};
  if(!existing)await port.control('provision',input.provision);
  stage='objects';const seen=new Set<string>();for(const f of manifest.files){if(seen.has(f.hash))continue;seen.add(f.hash);await port.dispatch('put',{hash:f.hash,body:input.objects.get(f.hash)});uploadedObjects++;}
  stage='quota_seed';await port.control('seed_quota',input.quotaSeed);
  stage='publish';await port.dispatch('commit',{expectedRevision:existing?.revision??0,manifestRaw:input.manifestRaw,hash});
  stage='read_back';return {status:'stopped_source_store_provisioned_and_read_back',...await verifyStoppedSnapshot(port,input)};
 }catch{throw new StoppedProvisioningError(stage,uploadedObjects);}
}

/** Additional bindings are required on the write path, never inferred from a
 * plausible-looking artifact or a partial source archive. */
export function verifyReadinessBindings(staging:{dependencyManifestHash?:string;modelReadinessHash?:string;bundlePurpose?:string;snapshotHash:string},dependencyRaw:string,modelRaw:string){
 const dependency=JSON.parse(dependencyRaw),model=JSON.parse(modelRaw);
 if(digest(dependencyRaw)!==staging.dependencyManifestHash||digest(modelRaw)!==staging.modelReadinessHash||dependency.snapshotHash!==staging.snapshotHash)throw new Error('Readiness/dependency binding mismatch');
 if(staging.bundlePurpose!=='full_forecasting_runner'||dependency.fullRunnerReady!==true||model.fullRunnerReady!==true||model.artifactInPermittedBundle!==true||model.independentProcessesIdentical!==true||!Array.isArray(model.modelComparisons)||!model.modelComparisons.length||model.modelComparisons.some((m:{identical?:boolean;availableWithoutExcludedArtifact?:boolean})=>m.identical!==true||m.availableWithoutExcludedArtifact!==true))throw new Error('Full forecasting provisioning blocked: dependencies or exact model reproduction unavailable');
 return {dependency,model};
}
