/** Synthetic local controls/approval receipts. No actual owner approval or live call. */
import {describe,it,expect} from 'vitest';
import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {controlledConfigSchema,modelManifestSchema,activationReasons,collectionApprovalReasons,policyBundleHash,runControlledWorker,type ModelManifest,type ActivationReceipt} from '@/lib/v6/controlled-activation';
import {ELO_ONLY_DEFINITION} from '@/lib/v6/team-model';
import {teamEloOnlyProbability} from '@/lib/v6/models';
import {localV6Repository} from '@/lib/v6/repository.server';
import {planControlledJobs,runControlledTick,type ScheduledJob} from '@/lib/v6/controlled-scheduler.server';
import {digest} from '@/lib/v6/evidence.server';
import {paperAccounting,paperResearchCohorts,qualification} from '@/lib/v6/engine';
import {type Forecast,type Observation} from '@/lib/v6/types';
import {gradeReconciledTeamPosition} from '@/lib/v6/reconciled-grading';
import {reconciliationFixture,freeze,after} from './fixtures/v6-reconciliation';
const at='2026-11-12T06:00:00.000Z',start='2026-11-13T00:00:00.000Z';
async function controls(){
 const config=controlledConfigSchema.parse({version:1,ownerId:'LOCAL TEST OWNER',mode:'armed',killSwitch:false,sourcesEnabled:true,modelManifest:null,activationReceipt:null,monthlyOddsCeiling:300});
 const manifest:ModelManifest=modelManifestSchema.parse({format:'edgelab.v6-model-manifest',version:1,modelId:'nba-team-elo-only',modelVersion:'candidate-1',method:'nba_team_elo_only',ownerId:config.ownerId,status:'approved',
  approvedAt:'2026-11-11T00:00:00Z',approvalReference:'INVENTED TEST CONTROL ONLY',chronologicalGames:500,verifiedProspectiveFixtures:30,
  definitionHash:digest(JSON.stringify(ELO_ONLY_DEFINITION)),evaluationHash:'a'.repeat(64),limitations:['SYNTHETIC TEST manifest; no real model approval'],teamResultsOnlyAccepted:true,
  readinessReview:{policyId:'nba-baseline-readiness-1',scope:'limited_paper_baseline_not_proven_sportsbook_edge',reportHash:'a'.repeat(64),chronologicalSeasons:2,prospectiveSlates:5,historicalPublicationGapsDisclosed:true,calibrationReviewed:true,bookmakerComparisonReviewed:true,uncertaintyMethod:'fixture_and_slate_cluster',injuryRosterLimitationsAccepted:true,reviewConclusion:'owner_accepted_limited_baseline_no_edge_claim'}});
 const receipt:ActivationReceipt={format:'edgelab.v6-standing-activation',version:1,id:crypto.randomUUID(),ownerId:config.ownerId,approvedAt:at,approvalReference:'INVENTED TEST CONTROL ONLY',
  policyBundleHash:await policyBundleHash(),modelManifestHash:digest(JSON.stringify(manifest)),scope:'prospective_model_supported_paper_only',sourceRightsConfirmed:true};
 return {config,manifest,receipt};
}
async function source(){
 const o:Observation={id:crypto.randomUUID(),sourceClass:'prospective',provider:'the-odds-api.com',permissionReference:'https://the-odds-api.com/terms-and-conditions.html',bookmaker:'sportsbet',
 market:{sport:'NBA',eventId:'LOCAL-TEST-EVENT',subjectId:'LOCAL-H',statistic:'moneyline',operator:'win',threshold:null,period:'full_game',periodNumber:null,overtime:'included',termsVersion:'LOCAL-TEST-TERMS'},eventStartsAt:start,odds:1.8,observedAt:at,retrievedAt:at,sourceUpdatedAt:at,sourceUrl:'https://example.invalid/LOCAL-SYNTHETIC-TEST',rawHash:'a'.repeat(64),status:'prematch_open'};
 const inputs={minutes:null,ratePerMinute:null,surface:null,rating:null,opponentRating:null,sampleSize:500,sourceObservedAt:at,sourceUrl:'https://example.invalid/LOCAL-SYNTHETIC-TEST',
  team:{homeId:'LOCAL-H',awayId:'LOCAL-A',homeRating:1550,awayRating:1500,homeCourt:60 as const,formAdjustment:0,restAdjustment:0,shrinkage:0 as const,historyHash:'a'.repeat(64),registryHash:'b'.repeat(64),safeEventStartsAt:start,researchPolicyId:'nba-moneyline-two-pass-1',homeOdds:1.8,awayOdds:2.5}};
 const f:Forecast={market:o.market,probability:teamEloOnlyProbability(o.market,inputs.team),pushProbability:0,modelId:'nba-team-elo-only',version:'candidate-1',method:'nba_team_elo_only',validation:'out_of_sample_validated',generatedAt:at,inputCutoff:at,inputs,inputsHash:digest(JSON.stringify(inputs)),evidenceUrls:['https://example.invalid/LOCAL-SYNTHETIC-TEST']};
 return {o,f};
}
async function temp(work:(root:string)=>Promise<void>){const root=await fs.mkdtemp(path.join(os.tmpdir(),'v6-controls-'));try{await work(root);}finally{await fs.rm(root,{recursive:true,force:true});}}
describe('controlled paper activation and durable registered-worker scheduling',()=>{
 it('binds explicit owner approvals to financial, selection, identity and model definitions',async()=>{
  const c=await controls();expect(await activationReasons(c.config,c.manifest,c.receipt,at)).toEqual([]);
  expect(await activationReasons(c.config,{...c.manifest,status:'draft'},c.receipt,at)).toContain('model_not_owner_approved');
  expect(await activationReasons(c.config,{...c.manifest,verifiedProspectiveFixtures:1},c.receipt,at)).toContain('insufficient_verified_prospective_sample');
  expect(await activationReasons(c.config,c.manifest,{...c.receipt,ownerId:'OTHER'},at)).toContain('activation_owner_hash_or_clock_mismatch');
  expect(await activationReasons(c.config,{...c.manifest,definitionHash:'0'.repeat(64)},c.receipt,at)).toContain('model_definition_hash_mismatch');
  expect(await activationReasons(c.config,{...c.manifest,readinessReview:null},c.receipt,at)).toContain('multidimensional_baseline_review_missing');
 });
 it('does not call source ports when activation is absent or emergency stop is active',()=>temp(async root=>{
  const c=await controls(),repo=localV6Repository(root,c.config.ownerId);let reads=0;
  const provider={collectionPermitted:true,collect:async()=>{reads++;return [];},grade:async()=>null};
  const result=await runControlledWorker(repo,provider,null,c.config,c.manifest,null,{runId:'LOCAL',now:at,clock:()=>at,readControl:async()=>c});
  expect(result.status).toBe('activation_blocked');expect(reads).toBe(0);
  expect((await runControlledWorker(repo,provider,null,{...c.config,killSwitch:true},c.manifest,c.receipt,{runId:'LOCAL',now:at,readControl:async()=>c})).status).toBe('disabled');
 }));
 it('separates explicitly approved experimental paper from stronger evidence without prior-profit claims',()=>temp(async root=>{
  const c=await controls(),base=await source();
  const manifest=modelManifestSchema.parse({...c.manifest,researchPurpose:'experimental',verifiedProspectiveFixtures:0,readinessReview:null,experimentalReview:{policyId:'nba-experimental-paper-1',reportHash:'a'.repeat(64),trainingEvidenceHash:'b'.repeat(64),featureCutoffPolicyHash:'c'.repeat(64),chronologicalSeasons:2,inputsReproducible:true,chronologicalEvaluationReviewed:true,historicalPublicationGapsDisclosed:true,uncertaintyAndInjuryLimitationsAccepted:true,conclusion:'experimental_research_only_no_profitability_or_calibration_claim'}});
  const receipt={...c.receipt,modelManifestHash:digest(JSON.stringify(manifest))};expect(await activationReasons(c.config,manifest,receipt,at)).toEqual([]);
  expect(await activationReasons(c.config,{...manifest,experimentalReview:null},receipt,at)).toContain('experimental_reproducibility_review_missing');
  const model={modelId:manifest.modelId,version:manifest.modelVersion,validationManifestHash:digest(JSON.stringify(manifest)),forecast:async()=>({...base.f,researchTier:'experimental' as const,validation:'chronologically_evaluated' as const})};
  const repo=localV6Repository(root,c.config.ownerId),readControl=async()=>({config:c.config,manifest,receipt});
  const result=await runControlledWorker(repo,{collectionPermitted:true,collect:async()=>[base.o],grade:async()=>null},model,c.config,manifest,receipt,{runId:'LOCAL-EXPERIMENTAL',now:at,clock:()=>at,readControl});
  expect(result.state.positions[0].researchTier).toBe('experimental');expect(paperResearchCohorts(result.state).find(c=>c.tier==='strongly_supported')?.positions).toBe(0);
  expect(paperResearchCohorts(result.state).find(c=>c.tier==='experimental')?.positions).toBe(1);expect(paperAccounting(result.state).openingReferenceCents).toBe(500000);
  const overpricedValue={...base.o,odds:4},experimental=await model.forecast();experimental.inputs={...experimental.inputs,team:{...experimental.inputs.team!,homeOdds:4}};
  expect(qualification(overpricedValue,experimental,at,'v6-prospective')).toContain('large_market_disagreement_requires_review');
  const mismatched={...model,forecast:async()=>base.f};const rejected=await runControlledWorker(repo,{collectionPermitted:true,collect:async()=>[{...base.o,id:crypto.randomUUID(),market:{...base.o.market,eventId:'LOCAL-OTHER'}}],grade:async()=>null},mismatched,c.config,manifest,receipt,{runId:'LOCAL-TIER-MISMATCH',now:at,clock:()=>at,readControl});expect(rejected.state.positions).toHaveLength(1);
 }));
 it('authorizes expiring shadow collection separately and never treats it as paper activation',async()=>{
  const c=await controls(),config={...c.config,mode:'dry_run' as const};
  const receipt={format:'edgelab.v6-shadow-collection',version:1,ownerId:config.ownerId,approvedAt:at,expiresAt:'2026-11-30T00:00:00Z',approvalReference:'SYNTHETIC TEST ONLY',policyBundleHash:await policyBundleHash(),scope:'zero_cost_read_only_shadow',sourceRightsConfirmed:true,monthlyOddsCeiling:300};
  expect(await collectionApprovalReasons(config,receipt,at)).toEqual([]);
  expect(await collectionApprovalReasons(c.config,receipt,at)).not.toEqual([]);
  expect(await collectionApprovalReasons(config,{...receipt,expiresAt:at},at)).not.toEqual([]);
  expect(await collectionApprovalReasons(config,{...receipt,ownerId:'OTHER'},at)).not.toEqual([]);
  expect(await activationReasons(c.config,c.manifest,receipt,at)).toContain('standing_activation_missing_or_invalid');
 });
 it('stops an expired shadow approval before source preparation and rechecks expiry at commit',()=>temp(async root=>{
  const c=await controls(),config={...c.config,mode:'dry_run' as const},expiresAt='2026-11-12T07:00:00Z',receipt={format:'edgelab.v6-shadow-collection',version:1,ownerId:config.ownerId,approvedAt:at,expiresAt,approvalReference:'SYNTHETIC TEST ONLY',policyBundleHash:await policyBundleHash(),scope:'zero_cost_read_only_shadow',sourceRightsConfirmed:true,monthlyOddsCeiling:300};
  const readControl=async()=>({config,manifest:null,receipt}),repo=localV6Repository(root,config.ownerId);let prepared=0;
  expect((await runControlledTick(root,{repository:repo,clock:()=>expiresAt,readControl,prepare:async()=>{prepared++;throw new Error('Must not prepare');}},[])).status).toBe('collection_approval_blocked');expect(prepared).toBe(0);
  const base=await source(),model={modelId:c.manifest.modelId,version:c.manifest.modelVersion,validationManifestHash:'a'.repeat(64),forecast:async()=>base.f};
  await expect(runControlledWorker(repo,{collectionPermitted:true,collect:async()=>[base.o],grade:async()=>null},model,config,null,receipt,{runId:'LOCAL-EXPIRY',now:at,clock:()=>expiresAt,readControl})).rejects.toThrow(/stop/);
  expect((await repo.read()).runs).toHaveLength(0);expect((await repo.read()).positions).toHaveLength(0);
 }));
 it('registers every distinct eligible baseline position without count/exposure caps and preserves replay',()=>temp(async root=>{
  const c=await controls(),base=await source(),repo=localV6Repository(root,c.config.ownerId),observations=Array.from({length:102},(_,i)=>({...base.o,id:crypto.randomUUID(),market:{...base.o.market,eventId:'LOCAL-'+i}}));
  const provider={collectionPermitted:true,collect:async()=>observations,grade:async()=>null};
  const model={modelId:c.manifest.modelId,version:c.manifest.modelVersion,validationManifestHash:digest(JSON.stringify(c.manifest)),forecast:async(o:Observation)=>({...base.f,market:o.market})};
  const opts={runId:'LOCAL-UNCAPPED',now:at,clock:()=>at,readControl:async()=>c};
  const result=await runControlledWorker(repo,provider,model,c.config,c.manifest,c.receipt,opts);
  expect(result.state.positions).toHaveLength(102);expect(paperAccounting(result.state)).toMatchObject({pendingCents:510000,availableCents:-10000,virtualExcessExposureCents:10000});
  expect((await runControlledWorker(localV6Repository(root,c.config.ownerId),provider,model,c.config,c.manifest,c.receipt,opts)).status).toBe('already_processed');
  await expect(runControlledWorker(localV6Repository(root,'OTHER'),provider,model,c.config,c.manifest,c.receipt,opts)).rejects.toThrow(/owner/);
 }));
 it('rechecks emergency stop during source/model work and rolls back the entire registered batch',()=>temp(async root=>{
  const c=await controls(),base=await source(),repo=localV6Repository(root,c.config.ownerId);
  const provider={collectionPermitted:true,collect:async()=>[base.o],grade:async()=>null};
  const model={modelId:c.manifest.modelId,version:c.manifest.modelVersion,validationManifestHash:digest(JSON.stringify(c.manifest)),forecast:async()=>base.f};
  await expect(runControlledWorker(repo,provider,model,c.config,c.manifest,c.receipt,{runId:'STOPPED',now:at,clock:()=>at,readControl:async()=>({...c,config:{...c.config,killSwitch:true}})})).rejects.toThrow(/stop/);
  expect((await repo.read()).positions).toHaveLength(0);
 }));
 it('plans Melbourne wall-clock discovery/results and groups acquisition windows across DST',()=>{
  const winter=planControlledJobs([],'2027-07-01T01:00:00Z'),summer=planControlledJobs([],'2027-01-01T01:00:00Z');
  expect(winter.find(j=>j.kind==='discovery')?.dueAt).toContain('09:00:00');expect(summer.find(j=>j.kind==='discovery')?.dueAt).toContain('08:00:00');
  const jobs=planControlledJobs([{id:'A',startsAt:start},{id:'B',startsAt:start}],at);expect(jobs.filter(j=>j.kind==='pre_start')).toHaveLength(1);
 });
 it('scheduler invokes the actual registered worker, checkpoints replay and recovers expired leases',()=>temp(async root=>{
  const c=await controls(),base=await source(),repo=localV6Repository(path.join(root,'state'),c.config.ownerId);let prepares=0;
  const job:ScheduledJob={id:'LOCAL-DUE',kind:'pre_start',dueAt:at,deadline:start,status:'pending',attempts:0,nextAt:at,leaseUntil:null,lastError:null,controlHash:null};
  const provider={collectionPermitted:true,collect:async()=>[base.o],grade:async()=>null},model={modelId:c.manifest.modelId,version:c.manifest.modelVersion,validationManifestHash:digest(JSON.stringify(c.manifest)),forecast:async()=>base.f};
  const ports={repository:repo,clock:()=>at,readControl:async()=>c,prepare:async()=>{prepares++;return {provider,model};}};
  expect((await runControlledTick(root,ports,[job])).workerInvoked).toBe(true);expect((await repo.read()).positions).toHaveLength(1);
  expect((await runControlledTick(root,ports,[job])).status).toBe('idle');expect(prepares).toBe(1);
  const file=path.join(root,'scheduler.json'),state=JSON.parse(await fs.readFile(file,'utf8'));state.jobs[0].status='running';state.jobs[0].leaseUntil='2026-11-12T05:00:00Z';await fs.writeFile(file,JSON.stringify(state));
  expect((await runControlledTick(root,ports,[job])).detail).toBe('already_processed');expect((await repo.read()).positions).toHaveLength(1);
 }));
 it('persists transient failures/backoff and marks missed deadlines without late registration',()=>temp(async root=>{
  const c=await controls(),repo=localV6Repository(path.join(root,'state'),c.config.ownerId);
  const job:ScheduledJob={id:'LOCAL-FAIL',kind:'pre_start',dueAt:at,deadline:start,status:'pending',attempts:0,nextAt:at,leaseUntil:null,lastError:null,controlHash:null};
  let now=at;const ports={repository:repo,clock:()=>now,readControl:async()=>c,prepare:async()=>{throw new Error('LOCAL TEST source failure');}};
  expect((await runControlledTick(root,ports,[job])).status).toBe('failed');
  const saved=JSON.parse(await fs.readFile(path.join(root,'scheduler.json'),'utf8'));expect(saved.jobs[0].nextAt).toBe('2026-11-12T06:02:00.000Z');
  expect(await fs.readdir(path.join(root,'alerts'))).toHaveLength(1);now=start;expect((await runControlledTick(root,ports,[])).status).toBe('idle');
  expect(JSON.parse(await fs.readFile(path.join(root,'scheduler.json'),'utf8')).jobs[0].status).toBe('missed');expect((await repo.read()).positions).toHaveLength(0);
 }));
 it('completes scheduled discovery → frozen A$50 registration → reconciled final → idempotent P/L after restart',()=>temp(async root=>{
  // Fake source responses and approvals, never genuine positions or hosted writes.
  const c=await controls(),base=await source(),e=reconciliationFixture();let now=freeze;
  const o:Observation={...base.o,rawHash:e.originalOdds.hash,eventStartsAt:e.proof.startsAt,observedAt:freeze,retrievedAt:freeze,sourceUpdatedAt:freeze,sourceUrl:e.originalOdds.sourceUrl,
   market:{...base.o.market,eventId:'the-odds-api.com:LOCAL',subjectId:e.proof.homeId,termsVersion:e.proof.termsVersion}};
  const inputs={...base.f.inputs,sourceObservedAt:freeze,team:{...base.f.inputs.team!,homeId:e.proof.homeId,awayId:e.proof.awayId,registryHash:e.registry.hash,safeEventStartsAt:e.proof.earliestStartsAt}};
  const f:Forecast={...base.f,market:o.market,generatedAt:freeze,inputCutoff:freeze,inputs,inputsHash:digest(JSON.stringify(inputs)),probability:teamEloOnlyProbability(o.market,inputs.team)};
  const repo=()=>localV6Repository(path.join(root,'state'),c.config.ownerId),model={modelId:f.modelId,version:f.version,validationManifestHash:digest(JSON.stringify(c.manifest)),forecast:async()=>f};
  let collects=0;const makeJob=(id:string,kind:ScheduledJob['kind'],at:string):ScheduledJob=>({id,kind,dueAt:at,deadline:new Date(Date.parse(at)+3600000).toISOString(),status:'pending',attempts:0,nextAt:at,leaseUntil:null,lastError:null,controlHash:null});
  const tick=(job:ScheduledJob)=>runControlledTick(root,{repository:repo(),clock:()=>now,readControl:async()=>c,prepare:async j=>({model,provider:{collectionPermitted:true,collect:async()=>{collects++;return j.kind==='results'?[]:[o];},grade:async p=>j.kind==='results'?(await gradeReconciledTeamPosition(p,{...e,at:now},(await repo().read()).grades.at(-1)??null)).grade:null}})},[job]);
  const discovery=makeJob('LOCAL-SCHEDULE-DISCOVERY','discovery',now);expect((await tick(discovery)).workerInvoked).toBe(true);
  const saved=(await repo().read()).positions[0];expect(saved).toMatchObject({stakeCents:5000,observation:{odds:1.8},forecast:{probability:f.probability}});
  const hash=digest(JSON.stringify(saved));expect((await tick(discovery)).status).toBe('idle');expect(collects).toBe(1);
  now=after;expect((await tick(makeJob('LOCAL-SCHEDULE-RESULT','results',now))).status).toBe('completed');
  const settled=await repo().read();expect(settled.grades).toHaveLength(1);expect(settled.grades[0].outcome).toBe('won');expect(paperAccounting(settled)).toMatchObject({profitCents:4000,equityCents:504000,pendingCents:0});
  expect(digest(JSON.stringify(settled.positions[0]))).toBe(hash);
  await tick(makeJob('LOCAL-SCHEDULE-RESULT-RETRY','results',now));expect((await repo().read()).grades).toHaveLength(1);expect(paperAccounting(await repo().read()).profitCents).toBe(4000);
 }));
});
