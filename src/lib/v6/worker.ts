import { sha256 } from '@/lib/imports/duplicates';
import { V6_POLICY } from './policy';
import { appendGrade, qualification, registerPaper } from './engine';
import { observationSchema, type Forecast, type Grade, type Observation, type V6State } from './types';
import type { V6Repository } from './repository.server';
export interface V6ReadProvider {
  collectionPermitted:boolean;
  collect():Promise<Observation[]>;
  /** Unmapped source rows must be journalled without invented canonical IDs. */
  screeningExclusions?():Promise<{sourceHash:string;sourceIdentity:string;reasons:string[]}[]>;
  grade(position:V6State['positions'][number],now:string):Promise<Grade|null>;
}
export interface V6IndependentModel {
  /** Authoritative activated registry identity, not a field supplied by an LLM response. */
  modelId:string;version:string;validationManifestHash:string;
  forecast(observation:Observation,now:string):Promise<Forecast|null>;
}
export const v6PolicyHash=()=>sha256(JSON.stringify(V6_POLICY));
export async function runV6Worker(repository:V6Repository,provider:V6ReadProvider,model:V6IndependentModel|null,options:{runId:string;now:string;clock?:()=>string;canCommit?:()=>Promise<boolean>;mode:'disabled'|'dry_run'|'armed';killSwitch:boolean;activation:{ownerId:string;policyHash:string;activatedAt:string}|null}) {
  const current=await repository.read();
  if(options.killSwitch||options.mode==='disabled')return {state:current,status:'disabled' as const};
  if(!provider.collectionPermitted)return {state:current,status:'source_permission_blocked' as const};
  if(options.mode==='armed'&&(!options.activation||options.activation.ownerId!==current.ownerId||options.activation.policyHash!==await v6PolicyHash()||!Number.isFinite(Date.parse(options.activation.activatedAt))||Date.parse(options.activation.activatedAt)>Date.parse(options.now)))throw new Error('Activate the exact V6 standing policy before arming.');
  if(options.mode==='armed'&&current.cohort==='v6-prospective'&&!options.canCommit)throw new Error('Prospective armed worker requires an operational commit latch');
  if(current.runs.some(run=>run.id===options.runId))return {state:current,status:'already_processed' as const};
  const observations=(await provider.collect()).map(o=>observationSchema.parse(o));
  const preflightExclusions=provider.screeningExclusions?await provider.screeningExclusions():[];
  const forecasts=await Promise.all(observations.map(async o=>{
    const f=model?await model.forecast(o,options.now):null;
    return f&&model&&/^[a-f0-9]{64}$/.test(model.validationManifestHash)&&f.modelId===model.modelId&&f.version===model.version?f:null;
  }));
  // Network and model work happen before the short commit lock. The current
  // state is re-read under the lock; every observation is requalified there.
  const grades=(await Promise.all(current.positions.map(p=>provider.grade(p,options.now)))).filter((g):g is Grade=>g!==null);
  const state=await repository.transact(async before=>{
    if(before.runs.some(run=>run.id===options.runId))return before;
    const commitAt=options.clock?.()??new Date().toISOString();
    if(!provider.collectionPermitted||options.canCommit&&!await options.canCommit()
      ||options.mode==='armed'&&options.activation&&Date.parse(options.activation.activatedAt)>Date.parse(commitAt))throw new Error('V6 operational stop or activation gate changed before commit');
    let draft=before;let registered=0;
    const rejections:{observationId:string;reasons:string[]}[]=[];
    for(const [i,o] of observations.entries()){
      const f=forecasts[i],reasons=qualification(o,f,commitAt,before.cohort);
      if(reasons.length){rejections.push({observationId:o.id,reasons});continue;}
      if(options.mode==='armed'){
        const result=await registerPaper(draft,o,f,'pre_event_once',commitAt);
        if(result.state!==draft)registered++;draft=result.state;
        if(result.reasons.length)rejections.push({observationId:o.id,reasons:result.reasons});
      }
    }
    if(options.mode==='armed')for(const g of grades){
      if(Date.parse(g.recordedAt)>Date.parse(commitAt)||Date.parse(g.publishedAt??g.observedAt??'')>Date.parse(commitAt))throw new Error('V6 final evidence is future-dated');
      draft=await appendGrade(draft,g);
    }
    return {...draft,revision:before.revision+1,runs:[...before.runs,{id:options.runId,at:commitAt,mode:options.mode,screened:observations.length+preflightExclusions.length,registered,observations:structuredClone(observations),preflightExclusions:structuredClone(preflightExclusions),rejections}]};
  });
  return {state,status:options.mode==='armed'?'paper_run_completed' as const:'dry_run_completed' as const};
}
