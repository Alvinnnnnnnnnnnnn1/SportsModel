import { z } from 'zod';
import {pilotReceiptExtension} from './source-pilot';
import { sha256 } from '@/lib/imports/duplicates';
import { V6_POLICY } from './policy';
import { TEAM_RESEARCH_POLICY } from './team-research-policy';
import { TEAM_FIXTURE_MATCH,TEAM_TERMS } from './team-pilot';
import { ELO_ONLY_DEFINITION } from './team-model';
import { EVENT_RECONCILIATION_POLICY } from './team-reconciliation';
import { TEAM_CATALOGUE_POLICY } from './team-catalogue';
import type { V6IndependentModel,V6ReadProvider } from './worker';
import { runV6Worker,v6PolicyHash } from './worker';
import type { V6Repository } from './repository.server';
const hash=z.string().regex(/^[a-f0-9]{64}$/),stamp=z.string().datetime({offset:true});
export const CONTROLLED_POLICY=Object.freeze({id:'nba-controlled-paper-1',version:1,cohort:'v6-prospective',modelId:'nba-team-elo-only',modelVersion:'candidate-1',
 method:'nba_team_elo_only',minimumChronologicalGames:500,minimumVerifiedProspectiveFixtures:30,scope:'NBA full-game two-way Sportsbet moneyline only',
 evidenceTier:'team_results_only; explicit owner acceptance required',exploratoryPositionsEnabled:false,externalMessaging:false});
export const MODEL_READINESS_POLICY=Object.freeze({id:'nba-baseline-readiness-1',version:1,minimumChronologicalSeasons:2,minimumProspectiveSlates:5,
 minimumProspectiveFixtures:30,sampleCountAloneIsInsufficient:true,scope:'limited_paper_baseline_not_proven_sportsbook_edge',
 requires:['frozen_definition','chronological_holdout','bookmaker_comparison','calibration_review','fixture_and_slate_uncertainty','injury_roster_limitations','explicit_owner_model_review']});
export const COLLECTION_POLICY=Object.freeze({id:'v6-read-only-source-1',version:1,maximumApprovalDays:31,maximumMonthlyCredits:400,mode:'dry_run',registersPositions:false,settlesPositions:false});
export const EXPERIMENTAL_MODEL_POLICY=Object.freeze({id:'nba-experimental-paper-1',version:1,modelId:'nba-team-elo-only',modelVersion:'candidate-1',minimumChronologicalGames:500,minimumChronologicalSeasons:2,
 priorProspectiveWinsRequired:false,profitabilityClaim:false,calibrationClaim:false,tier1Claim:false,qualificationPolicy:TEAM_RESEARCH_POLICY.id});
export const experimentalReviewSchema=z.object({policyId:z.literal('nba-experimental-paper-1'),reportHash:hash,trainingEvidenceHash:hash,featureCutoffPolicyHash:hash,
 chronologicalSeasons:z.number().int().min(2),inputsReproducible:z.literal(true),chronologicalEvaluationReviewed:z.literal(true),historicalPublicationGapsDisclosed:z.literal(true),
 uncertaintyAndInjuryLimitationsAccepted:z.literal(true),conclusion:z.literal('experimental_research_only_no_profitability_or_calibration_claim')}).strict();
export const readinessReviewSchema=z.object({policyId:z.literal('nba-baseline-readiness-1'),scope:z.literal('limited_paper_baseline_not_proven_sportsbook_edge'),
 reportHash:hash,chronologicalSeasons:z.number().int().min(2),prospectiveSlates:z.number().int().min(5),
 historicalPublicationGapsDisclosed:z.literal(true),calibrationReviewed:z.literal(true),bookmakerComparisonReviewed:z.literal(true),
 uncertaintyMethod:z.literal('fixture_and_slate_cluster'),injuryRosterLimitationsAccepted:z.literal(true),
 reviewConclusion:z.literal('owner_accepted_limited_baseline_no_edge_claim')}).strict();
export const modelManifestSchema=z.object({
 format:z.literal('edgelab.v6-model-manifest'),version:z.literal(1),modelId:z.literal('nba-team-elo-only'),modelVersion:z.literal('candidate-1'),method:z.literal('nba_team_elo_only'),
 ownerId:z.string().min(1),status:z.enum(['draft','approved']),approvedAt:stamp.nullable(),approvalReference:z.string().nullable(),
 chronologicalGames:z.number().int().nonnegative(),verifiedProspectiveFixtures:z.number().int().nonnegative(),
 evaluationHash:hash,definitionHash:hash,limitations:z.array(z.string()).min(1),teamResultsOnlyAccepted:z.boolean(),
 readinessReview:readinessReviewSchema.nullable().default(null),
 researchPurpose:z.enum(['strongly_supported','experimental']).default('strongly_supported'),experimentalReview:experimentalReviewSchema.nullable().default(null),
}).strict();
export type ModelManifest=z.infer<typeof modelManifestSchema>;
export const modelManifestHash=(input:unknown)=>sha256(JSON.stringify(modelManifestSchema.parse(input)));
export const activationReceiptSchema=z.object({
 format:z.literal('edgelab.v6-standing-activation'),version:z.literal(1),id:z.string().uuid(),ownerId:z.string().min(1),
 approvedAt:stamp,approvalReference:z.string().min(1),policyBundleHash:hash,modelManifestHash:hash,
 scope:z.literal('prospective_model_supported_paper_only'),sourceRightsConfirmed:z.literal(true),
}).strict();
export type ActivationReceipt=z.infer<typeof activationReceiptSchema>;
/** Separate source-only approval avoids requiring model promotion to collect
 * the prospective evidence needed for model review. It can never arm positions. */
export const collectionReceiptSchema=z.object({format:z.literal('edgelab.v6-shadow-collection'),version:z.literal(1),ownerId:z.string().min(1),
 approvedAt:stamp,expiresAt:stamp,approvalReference:z.string().min(1),policyBundleHash:hash,scope:z.literal('zero_cost_read_only_shadow'),
 sourceRightsConfirmed:z.literal(true),monthlyOddsCeiling:z.number().int().min(1).max(400),pilot:pilotReceiptExtension.optional()}).strict();
export const controlledConfigSchema=z.object({
 version:z.literal(1),ownerId:z.string().min(1),mode:z.enum(['disabled','dry_run','armed']),killSwitch:z.boolean(),sourcesEnabled:z.boolean(),
 modelManifest:z.string().nullable(),activationReceipt:z.string().nullable(),
 monthlyOddsCeiling:z.number().int().min(1).max(400).default(300),
 sourceOnly:z.boolean().optional(),sourcePilotPlanHash:hash.optional(),
 persistence:z.discriminatedUnion('kind',[z.object({kind:z.literal('supabase'),projectRef:z.string().regex(/^[a-z0-9]{20}$/),workerTokenFile:z.string().min(1)}).strict(),z.object({kind:z.literal('supabase_capability'),projectRef:z.string().regex(/^[a-z0-9]{20}$/),workerCredentialFile:z.string().min(1)}).strict()]).nullable().default(null),
}).strict();
export type ControlledConfig=z.infer<typeof controlledConfigSchema>;
export const policyBundleHash=()=>sha256(JSON.stringify({financial:V6_POLICY,selection:TEAM_RESEARCH_POLICY,control:CONTROLLED_POLICY,modelReadiness:MODEL_READINESS_POLICY,experimentalModel:EXPERIMENTAL_MODEL_POLICY,collection:COLLECTION_POLICY,identity:TEAM_FIXTURE_MATCH,reconciliation:EVENT_RECONCILIATION_POLICY,catalogue:TEAM_CATALOGUE_POLICY,terms:TEAM_TERMS}));
export async function collectionApprovalReasons(config:ControlledConfig,input:unknown,at:string){
 stamp.parse(at);
 const r=collectionReceiptSchema.safeParse(input);if(!r.success)return ['read_only_collection_approval_missing'];
 if(config.modelManifest!==null||config.persistence!==null)return ['source_only_disallows_model_and_hosted_credentials'];
 if((config.sourceOnly||config.sourcePilotPlanHash)&&!r.data.pilot)return ['exact_bounded_source_pilot_receipt_required'];
 if(r.data.pilot){const p=r.data.pilot;if(p.approvalStatus!=='approved'||!config.sourceOnly||config.sourcePilotPlanHash!==p.planHash||p.planHash!==await sha256(JSON.stringify(p.plan))||p.plan.ownerId!==config.ownerId||p.plan.monthlyOddsCeiling!==config.monthlyOddsCeiling||p.plan.period!==at.slice(0,7)||Date.parse(at)<Date.parse(p.plan.startsAt)||Date.parse(at)>=Date.parse(p.plan.expiresAt)||r.data.expiresAt!==p.plan.expiresAt)return ['pilot_pending_owner_hash_window_or_quota_mismatch'];}
 if(config.mode!=='dry_run'||config.killSwitch||!config.sourcesEnabled||r.data.ownerId!==config.ownerId||r.data.policyBundleHash!==await policyBundleHash()
  ||r.data.monthlyOddsCeiling!==config.monthlyOddsCeiling||Date.parse(r.data.approvedAt)>Date.parse(at)||Date.parse(r.data.expiresAt)<=Date.parse(at)
  ||Date.parse(r.data.expiresAt)-Date.parse(r.data.approvedAt)>31*86400000)return ['read_only_collection_owner_scope_budget_or_expiry_mismatch'];return [];
}
export async function activationReasons(config:ControlledConfig,manifestInput:unknown,receiptInput:unknown,at:string){
 stamp.parse(at);if(config.sourceOnly)return ['source_only_cannot_arm_or_activate_models'];const reasons:string[]=[],m=modelManifestSchema.safeParse(manifestInput),r=activationReceiptSchema.safeParse(receiptInput);
 if(config.killSwitch||config.mode==='disabled')reasons.push('emergency_stop_or_disabled');
 if(!config.sourcesEnabled)reasons.push('sources_not_enabled');
 if(!m.success)return [...reasons,'model_manifest_missing_or_invalid'];
 if(m.data.ownerId!==config.ownerId||m.data.status!=='approved'||!m.data.approvedAt||Date.parse(m.data.approvedAt)>Date.parse(at)||!m.data.approvalReference)reasons.push('model_not_owner_approved');
 if(m.data.chronologicalGames<CONTROLLED_POLICY.minimumChronologicalGames)reasons.push('insufficient_chronological_sample');
 if(m.data.definitionHash!==await sha256(JSON.stringify(ELO_ONLY_DEFINITION)))reasons.push('model_definition_hash_mismatch');
 if(m.data.researchPurpose==='strongly_supported'&&m.data.verifiedProspectiveFixtures<CONTROLLED_POLICY.minimumVerifiedProspectiveFixtures)reasons.push('insufficient_verified_prospective_sample');
 if(!m.data.teamResultsOnlyAccepted)reasons.push('limited_matchup_evidence_not_accepted');
 if(m.data.researchPurpose==='strongly_supported'&&!m.data.readinessReview)reasons.push('multidimensional_baseline_review_missing');
 if(m.data.researchPurpose==='experimental'&&!m.data.experimentalReview)reasons.push('experimental_reproducibility_review_missing');
 if(!r.success)return [...reasons,'standing_activation_missing_or_invalid'];
 if(r.data.ownerId!==config.ownerId||Date.parse(r.data.approvedAt)>Date.parse(at)||m.data.approvedAt&&Date.parse(r.data.approvedAt)<Date.parse(m.data.approvedAt)||r.data.policyBundleHash!==await policyBundleHash()||r.data.modelManifestHash!==await modelManifestHash(m.data))reasons.push('activation_owner_hash_or_clock_mismatch');
 return reasons;
}
/** Entry point for a registered worker. A typed JSON validation flag alone is
 * insufficient: exact approved model + policy bundle + owner receipts are required.
 */
export async function runControlledWorker(repository:V6Repository,provider:V6ReadProvider,model:V6IndependentModel|null,config:ControlledConfig,manifest:unknown,receipt:unknown,options:{runId:string;now:string;clock?:()=>string;readControl:()=>Promise<{config:ControlledConfig;manifest:unknown;receipt:unknown}>}){
 const initial=await repository.read();if(initial.ownerId!==config.ownerId||initial.cohort!=='v6-prospective')throw new Error('Controlled worker owner or cohort changed');
 if(config.sourceOnly&&(initial.positions.length||initial.grades.length))throw new Error('Source-only repository must contain no paper positions or grades');
 const reasons=await activationReasons(config,manifest,receipt,options.now);
 if(config.mode==='disabled'||config.killSwitch)return {status:'disabled' as const,reasons,state:initial};
 if(config.mode==='armed'&&reasons.length)return {status:'activation_blocked' as const,reasons,state:initial};
 if(config.mode==='dry_run'&&reasons.length&&(await collectionApprovalReasons(config,receipt,options.now)).length)return {status:'collection_approval_blocked' as const,reasons:['read_only_collection_approval_missing_or_invalid'],state:initial};
 if(!model||model.modelId!==CONTROLLED_POLICY.modelId||model.version!==CONTROLLED_POLICY.modelVersion)return {status:'model_unavailable' as const,reasons:['registered_baseline_port_missing'],state:initial};
 const m=modelManifestSchema.safeParse(manifest);
 if(config.mode==='armed'&&(!m.success||model.validationManifestHash!==await sha256(JSON.stringify(m.data))))return {status:'activation_blocked' as const,reasons:['model_manifest_port_hash_mismatch'],state:initial};
 const expected=await sha256(JSON.stringify({config,manifest,receipt}));
 const latched=async()=>{
  const latest=await options.readControl();
  if(await sha256(JSON.stringify(latest))!==expected)return false;
  const at=options.clock?.()??new Date().toISOString();return (await activationReasons(latest.config,latest.manifest,latest.receipt,at)).length===0
   ||config.mode==='dry_run'&&(await collectionApprovalReasons(latest.config,latest.receipt,at)).length===0;
 };
 const boundModel:V6IndependentModel={...model,forecast:async(o,at)=>{const f=await model.forecast(o,at);return f&&m.success&&(f.researchTier??'strongly_supported')!==m.data.researchPurpose?null:f;}};
 const result=await runV6Worker(repository,provider,boundModel,{runId:options.runId,now:options.now,clock:options.clock,mode:config.mode,killSwitch:config.killSwitch,
  activation:config.mode==='armed'?{ownerId:config.ownerId,policyHash:await v6PolicyHash(),activatedAt:activationReceiptSchema.parse(receipt).approvedAt}:null,canCommit:latched});
 return {...result,reasons};
}
