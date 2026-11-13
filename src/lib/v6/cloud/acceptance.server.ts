import {verifyStoppedSnapshot,type OwnerBootstrapPort,type StoppedBundle} from './provisioning.server';
export interface SourceAcceptanceContext {
 /** Must come from verified getUser(), never a supplied JWT body alone. */
 userId:string|null;
 port:OwnerBootstrapPort;
 read(table:string,ownerId:string,pilotId:string):Promise<unknown[]>;
 ownerControlProbe():Promise<unknown>;
}
/** Prepare the same normal-user checks for local SQL and a later separately
 * approved hosted session. Negative mutations must reject; never seed/delete,
 * issue capabilities, change source-host state or access a financial repository. */
export async function acceptStoppedSource(input:Pick<StoppedBundle,'ownerId'|'pilotId'|'manifestRaw'>,contexts:{owner:SourceAcceptanceContext;freshOwner:SourceAcceptanceContext;other:SourceAcceptanceContext;anonymous:SourceAcceptanceContext}){
 if(contexts.owner.userId!==input.ownerId||contexts.freshOwner.userId!==input.ownerId||!contexts.other.userId||contexts.other.userId===input.ownerId||contexts.anonymous.userId!==null)throw new Error('Two distinct verified authenticated users and an anonymous context required');
 const checks:string[]=[];
 const deny=async(name:string,run:()=>Promise<unknown>,code:string)=>{let rejected=false;try{await run();}catch(e){if((e as {code?:string})?.code!==code)throw new Error('Source acceptance received an unexpected error for '+name);rejected=true;}if(!rejected)throw new Error('Source acceptance unexpectedly allowed '+name);checks.push(name);};
 const initial=await verifyStoppedSnapshot(contexts.owner.port,input);checks.push('owner exact read-after-write');
 const fresh=await verifyStoppedSnapshot(contexts.freshOwner.port,input);if(fresh.revision!==initial.revision)throw new Error('Independent owner session revision mismatch');checks.push('fresh owner session persistence');
 for(const table of ['pilots','objects','snapshots','quotas','reservations','audit']){if((await contexts.other.read(table,input.ownerId,input.pilotId)).length)throw new Error('Cross-owner source rows were visible');checks.push('cross-owner '+table+' read isolation');}
 await deny('cross-owner load',()=>contexts.other.port.dispatch('load',{}),'P0002');
 const manifest=JSON.parse(input.manifestRaw),first=manifest.files[0];
 if(first){await deny('cross-owner object access',()=>contexts.other.port.dispatch('get',{hash:first.hash}),'P0002');const original=await contexts.owner.port.dispatch('get',{hash:first.hash}) as {body:string};await deny('immutable overwrite rejected',()=>contexts.owner.port.dispatch('put',{hash:first.hash,body:original.body+' '}),'P0001');}
 await deny('stale revision rejected',()=>contexts.owner.port.dispatch('commit',{expectedRevision:initial.revision-1,manifestRaw:input.manifestRaw,hash:'0'.repeat(64)}),'P0001');
 await deny('capability hashes private',()=>contexts.owner.read('capabilities',input.ownerId,input.pilotId),'42501');
 await deny('cross-owner control rejected',contexts.other.ownerControlProbe,'P0002');
 await deny('anonymous owner control rejected',contexts.anonymous.ownerControlProbe,'42501');
 const final=await verifyStoppedSnapshot(contexts.owner.port,input);if(final.revision!==initial.revision)throw new Error('Rejected probes changed snapshot revision');checks.push('negative checks preserve published state and disabled host');
 return {checks,revision:final.revision,cloudActivated:false,credentialsIssued:false};
}
