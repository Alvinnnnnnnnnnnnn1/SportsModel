import { z } from 'zod';
import { sha256 } from '@/lib/imports/duplicates';
import { V6_POLICY } from './policy';
import { TEAM_RESEARCH_POLICY } from './team-research-policy';
import { TEAM_FIXTURE_MATCH,TEAM_TERMS } from './team-pilot';
import { ELO_ONLY_DEFINITION } from './team-model';
import type { V6IndependentModel,V6ReadProvider } from './worker';
import { runV6Worker,v6PolicyHash } from './worker';
import type { V6Repository } from './repository.server';
const hash=z.string().regex(/^[a-f0-9]{64}$/),stamp=z.string().datetime({offset:true});
export const CONTROLLED_POLICY=Object.freeze({id:'nba-controlled-paper-1',version:1,cohort:'v6-prospective',modelId:'nba-team-elo-only',modelVersion:'candidate-1',
 method:'nba_team_elo_only',minimumChronologicalGames:500,minimumVerifiedProspectiveFixtures:30,scope:'NBA full-game two-way Sportsbet moneyline only',
 evidenceTier:'team_results_only; explicit owner acceptance required',exploratoryPositionsEnabled:false,externalMessaging:false});
export const modelManifestSchema=z.object({
 format:z.literal('edgelab.v6-model-manifest'),version:z.literal(1),modelId:z.literal('nba-team-elo-only'),modelVersion:z.literal('candidate-1'),method:z.literal('nba_team_elo_only'),
 ownerId:z.string().min(1),status:z.enum(['draft','approved']),approvedAt:stamp.nullable(),approvalReference:z.string().nullable(),
 chronologicalGames:z.number().int().nonnegative(),verifiedProspectiveFixtures:z.number().int().nonnegative(),
 evaluationHash:hash,definitionHash:hash,limitations:z.array(z.string()).min(1),teamResultsOnlyAccepted:z.boolean(),
}).strict();
export type ModelManifest=z.infer<typeof modelManifestSchema>;
export const modelManifestHash=(input:unknown)=>sha256(JSON.stringify(modelManifestSchema.parse(input)));
export const activationReceiptSchema=z.object({
 format:z.literal('edgelab.v6-standing-activation'),version:z.literal(1),id:z.string().uuid(),ownerId:z.string().min(1),
 approvedAt:stamp,approvalReference:z.string().min(1),policyBundleHash:hash,modelManifestHash:hash,
 scope:z.literal('prospective_model_supported_paper_only'),sourceRightsConfirmed:z.literal(true),
}).strict();
export type ActivationReceipt=z.infer<typeof activationReceiptSchema>;
export const controlledConfigSchema=z.object({
 version:z.literal(1),ownerId:z.string().min(1),mode:z.enum(['disabled','dry_run','armed']),killSwitch:z.boolean(),sourcesEnabled:z.boolean(),
 modelManifest:z.string().nullable(),activationReceipt:z.string().nullable(),
 monthlyOddsCeiling:z.number().int().min(1).max(400).default(300),
}).strict();
export type ControlledConfig=z.infer<typeof controlledConfigSchema>;
export const policyBundleHash=()=>sha256(JSON.stringify({financial:V6_POLICY,selection:TEAM_RESEARCH_POLICY,control:CONTROLLED_POLICY,identity:TEAM_FIXTURE_MATCH,terms:TEAM_TERMS}));
export async function activationReasons(config:ControlledConfig,manifestInput:unknown,receiptInput:unknown,at:string){
 stamp.parse(at);const reasons:string[]=[],m=modelManifestSchema.safeParse(manifestInput),r=activationReceiptSchema.safeParse(receiptInput);
 if(config.killSwitch||config.mode==='disabled')reasons.push('emergency_stop_or_disabled');
 if(!config.sourcesEnabled)reasons.push('sources_not_enabled');
 if(!m.success)return [...reasons,'model_manifest_missing_or_invalid'];
 if(m.data.ownerId!==config.ownerId||m.data.status!=='approved'||!m.data.approvedAt||Date.parse(m.data.approvedAt)>Date.parse(at)||!m.data.approvalReference)reasons.push('model_not_owner_approved');
 if(m.data.chronologicalGames<CONTROLLED_POLICY.minimumChronologicalGames)reasons.push('insufficient_chronological_sample');
 if(m.data.definitionHash!==await sha256(JSON.stringify(ELO_ONLY_DEFINITION)))reasons.push('model_definition_hash_mismatch');
 if(m.data.verifiedProspectiveFixtures<CONTROLLED_POLICY.minimumVerifiedProspectiveFixtures)reasons.push('insufficient_verified_prospective_sample');
 if(!m.data.teamResultsOnlyAccepted)reasons.push('limited_matchup_evidence_not_accepted');
 if(!r.success)return [...reasons,'standing_activation_missing_or_invalid'];
 if(r.data.ownerId!==config.ownerId||Date.parse(r.data.approvedAt)>Date.parse(at)||m.data.approvedAt&&Date.parse(r.data.approvedAt)<Date.parse(m.data.approvedAt)||r.data.policyBundleHash!==await policyBundleHash()||r.data.modelManifestHash!==await modelManifestHash(m.data))reasons.push('activation_owner_hash_or_clock_mismatch');
 return reasons;
}
/** Entry point for a registered worker. A typed JSON validation flag alone is
 * insufficient: exact approved model + policy bundle + owner receipts are required.
 */
export async function runControlledWorker(repository:V6Repository,provider:V6ReadProvider,model:V6IndependentModel|null,config:ControlledConfig,manifest:unknown,receipt:unknown,options:{runId:string;now:string;clock?:()=>string;readControl:()=>Promise<{config:ControlledConfig;manifest:unknown;receipt:unknown}>}){
 const initial=await repository.read();if(initial.ownerId!==config.ownerId||initial.cohort!=='v6-prospective')throw new Error('Controlled worker owner or cohort changed');
 const reasons=await activationReasons(config,manifest,receipt,options.now);
 if(config.mode==='disabled'||config.killSwitch)return {status:'disabled' as const,reasons,state:initial};
 if(config.mode==='armed'&&reasons.length)return {status:'activation_blocked' as const,reasons,state:initial};
 if(!model||model.modelId!==CONTROLLED_POLICY.modelId||model.version!==CONTROLLED_POLICY.modelVersion)return {status:'model_unavailable' as const,reasons:['registered_baseline_port_missing'],state:initial};
 const m=modelManifestSchema.safeParse(manifest);
 if(config.mode==='armed'&&(!m.success||model.validationManifestHash!==await sha256(JSON.stringify(m.data))))return {status:'activation_blocked' as const,reasons:['model_manifest_port_hash_mismatch'],state:initial};
 const expected=await sha256(JSON.stringify({config,manifest,receipt}));
 const latched=async()=>{
  const latest=await options.readControl();
  if(await sha256(JSON.stringify(latest))!==expected)return false;
  return config.mode==='dry_run'||(await activationReasons(latest.config,latest.manifest,latest.receipt,options.clock?.()??new Date().toISOString())).length===0;
 };
 const result=await runV6Worker(repository,provider,model,{runId:options.runId,now:options.now,clock:options.clock,mode:config.mode,killSwitch:config.killSwitch,
  activation:config.mode==='armed'?{ownerId:config.ownerId,policyHash:await v6PolicyHash(),activatedAt:activationReceiptSchema.parse(receipt).approvedAt}:null,canCommit:latched});
 return {...result,reasons};
}
