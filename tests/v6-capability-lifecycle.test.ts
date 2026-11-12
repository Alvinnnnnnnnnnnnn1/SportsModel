/** All users, credentials, approvals and sporting records here are synthetic
 * and live only inside disposable local PostgreSQL. No hosted requests. */
import {describe,it,expect} from 'vitest';
import {readFile} from 'node:fs/promises';
import {v6TestDatabase,v6Login,type V6TestDB} from './fixtures/v6-postgres';
import {workerCredentialSchema,type WorkerCredential} from '@/lib/v6/worker-credentials';
import {supabaseV6Repository} from '@/lib/v6/supabase-repository.server';
import {modelManifestSchema,controlledConfigSchema,policyBundleHash} from '@/lib/v6/controlled-activation';
import {runControlledTick,type ScheduledJob} from '@/lib/v6/controlled-scheduler.server';
import {teamEloOnlyProbability} from '@/lib/v6/models';
import {ELO_ONLY_DEFINITION} from '@/lib/v6/team-model';
import {gradeReconciledTeamPosition} from '@/lib/v6/reconciled-grading';
import {paperAccounting,paperResearchCohorts} from '@/lib/v6/engine';
import {digest} from '@/lib/v6/evidence.server';
import {reconciliationFixture,changed} from './fixtures/v6-reconciliation';
import type {Forecast,Observation} from '@/lib/v6/types';
import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
const runtime=process.env.EDGELAB_POSTGRES_RUNTIME,owner='97000000-0000-4000-8000-000000000001',other='97000000-0000-4000-8000-000000000002';
async function setup(){const db=await v6TestDatabase();await db.exec(await readFile('supabase/proposals/202611110001_v6_paper.sql','utf8'));await db.query('insert into auth.users values($1),($2)',[owner,other]);return db;}
async function issue(db:V6TestDB,id=owner,scope='research_only',rotate:string|null=null){await v6Login(db,id);return workerCredentialSchema.parse((await db.query('select public.v6_issue_worker_credential($1::uuid,$2::text,720,$3::uuid) value',[id,scope,rotate])).rows[0].value);}
async function access(db:V6TestDB,c:WorkerCredential,operation='load',request:unknown={},expected=owner){await v6Login(db,'','anon');return (await db.query('select public.v6_worker_access($1::uuid,$2::text,$3::text,$4::jsonb) value',[expected,c.credential,operation,JSON.stringify(request)])).rows[0].value;}
describe.skipIf(!runtime)('revocable owner-scoped capability and actual worker against isolated PostgreSQL',()=>{
 it('enforces scope, owner, expiry, rotation, revocation, restored context and zero V5 privilege',async()=>{
  const db=await setup();try{
   const a=await issue(db),b=await issue(db,other);expect((await access(db,a) as {ownerId:string}).ownerId).toBe(owner);
   expect((await db.query("select current_user role,current_setting('request.jwt.claim.sub') sub")).rows[0]).toEqual({role:'anon',sub:''});
   await expect(access(db,a,'load',{},other)).rejects.toThrow(/credential rejected/);
   await expect(access(db,{...a,credential:'edgelab_v6_'+'0'.repeat(64)})).rejects.toThrow(/credential rejected/);
   await expect(db.query("select public.v6_worker_access($1::uuid,null,'load')",[owner])).rejects.toThrow(/credential rejected/);
   await expect(access(db,a,'commit',{run_snapshot:{mode:'armed'},position_rows:[],grade_rows:[]})).rejects.toThrow(/read-only/);
   await expect(access(db,a,'v5_cash_write')).rejects.toThrow(/operation rejected/);
   const paper=await issue(db,owner,'paper_worker');await expect(access(db,paper,'commit',{})).rejects.toThrow();
   expect((await db.query("select current_user role,current_setting('request.jwt.claim.sub') sub")).rows[0]).toEqual({role:'anon',sub:''});
   await expect(db.query('select * from public.v6_worker_credentials')).rejects.toThrow(/permission denied/);
   await expect(db.query('select public.v6_issue_worker_credential($1::uuid)',[owner])).rejects.toThrow(/permission denied/);
   await v6Login(db,other);await expect(db.query('select public.v6_revoke_worker_credential($1::uuid,$2::uuid)',[owner,a.credentialId])).rejects.toThrow(/authenticated owner/);
   expect((await access(db,b,'load',{},other) as {ownerId:string}).ownerId).toBe(other);
   const rotated=await issue(db,owner,'research_only',a.credentialId);await expect(access(db,a)).rejects.toThrow(/credential rejected/);await access(db,rotated);
   await v6Login(db,owner);const metadata=(await db.query('select public.v6_list_worker_credentials($1::uuid) value',[owner])).rows[0].value;
   expect(JSON.stringify(metadata).includes(rotated.credential)).toBe(false);expect(JSON.stringify(metadata).includes('secret_hash')).toBe(false);
   expect((await db.query('select public.v6_revoke_worker_credential($1::uuid,$2::uuid) ok',[owner,rotated.credentialId])).rows[0].ok).toBe(true);
   await expect(access(db,rotated)).rejects.toThrow(/credential rejected/);
   // Expired credential is a deliberately old fixture inserted by local test
   // setup, without disabling its real trigger. Client issuance cannot backdate.
   await v6Login(db,owner);await db.exec('reset role');const expired='edgelab_v6_'+'e'.repeat(64);
   await db.query("insert into public.v6_worker_credentials(user_id,secret_hash,scope,created_at,expires_at) values($1,$2,'research_only',clock_timestamp()-interval '2 hours',clock_timestamp()-interval '1 hour')",[owner,digest(expired)]);
   await expect(access(db,{...a,credential:expired})).rejects.toThrow(/credential rejected/);
   await v6Login(db,owner,'edgelab_v6_worker');await expect(db.query('insert into public.financial_transactions default values')).rejects.toThrow(/permission denied/);
   await expect(db.exec('alter table public.audit_history disable trigger all')).rejects.toThrow(/owner|permission denied/);
   await expect(db.query('select public.edgelab_load_workspace()')).rejects.toThrow(/permission denied/);
   await expect(db.query('select public.v6_issue_worker_credential($1::uuid)',[owner])).rejects.toThrow(/authenticated owner/);
   await db.exec('reset role');const audit=JSON.stringify((await db.query('select payload from public.v6_audit')).rows);expect(audit.includes(a.credential)||audit.includes(rotated.credential)||audit.includes(expired)).toBe(false);
   expect((await db.query("select has_function_privilege('service_role','public.v6_worker_access(uuid,text,text,jsonb)','EXECUTE') allowed")).rows[0].allowed).toBe(false);
  }finally{await db.close();}
 },30000);
 it('runs scheduled experimental registration and real-clock synthetic settlement through capability HTTP, rotation and restart',async()=>{
  const db=await setup(),root=await fs.mkdtemp(path.join(os.tmpdir(),'v6-capability-'));try{
   let session=await issue(db,owner,'paper_worker');const at=new Date().toISOString(),start=new Date(Date.now()+70000).toISOString(),e=reconciliationFixture();
   e.frozenAt=at;e.at=at;e.registry.recordedAt=at;const {hash:discarded,...registryData}=e.registry;void discarded;e.registry.hash=digest(JSON.stringify(registryData));
   e.proof={...e.proof,startsAt:start,statsStartsAt:start,earliestStartsAt:start,registryHash:e.registry.hash};
   e.originalOdds={...changed(e.originalOdds,b=>{b[0].commence_time=start;b[0].bookmakers[0].markets[0].last_update=at;}),retrievedAt:at};
   e.originalFixtures={...changed(e.originalFixtures,b=>{b.data[0].datetime=start;}),retrievedAt:at};
   const o:Observation={id:crypto.randomUUID(),provider:'the-odds-api.com',permissionReference:'https://the-odds-api.com/terms-and-conditions.html',sourceClass:'prospective',bookmaker:'sportsbet',market:{sport:'NBA',eventId:'the-odds-api.com:LOCAL',subjectId:e.proof.homeId,statistic:'moneyline',operator:'win',threshold:null,period:'full_game',periodNumber:null,overtime:'included',termsVersion:e.proof.termsVersion},eventStartsAt:start,odds:1.8,observedAt:at,retrievedAt:at,sourceUpdatedAt:at,sourceUrl:e.originalOdds.sourceUrl,rawHash:e.originalOdds.hash,status:'prematch_open'};
   const inputs={minutes:null,ratePerMinute:null,surface:null,rating:null,opponentRating:null,sampleSize:500,sourceObservedAt:at,sourceUrl:e.originalFixtures.sourceUrl,team:{homeId:e.proof.homeId,awayId:e.proof.awayId,homeRating:1550,awayRating:1500,homeCourt:60 as const,formAdjustment:0,restAdjustment:0,shrinkage:0 as const,historyHash:'a'.repeat(64),registryHash:e.registry.hash,safeEventStartsAt:start,researchPolicyId:'nba-moneyline-two-pass-1',homeOdds:1.8,awayOdds:2.5}};
   const f:Forecast={market:o.market,probability:teamEloOnlyProbability(o.market,inputs.team),pushProbability:0,modelId:'nba-team-elo-only',version:'candidate-1',method:'nba_team_elo_only',researchTier:'experimental',validation:'chronologically_evaluated',generatedAt:at,inputCutoff:at,inputs,inputsHash:digest(JSON.stringify(inputs)),evidenceUrls:[e.originalFixtures.sourceUrl]};
   const manifest=modelManifestSchema.parse({format:'edgelab.v6-model-manifest',version:1,ownerId:owner,modelId:f.modelId,modelVersion:f.version,method:f.method,status:'approved',approvedAt:at,approvalReference:'SYNTHETIC LOCAL APPROVAL ONLY',researchPurpose:'experimental',chronologicalGames:500,verifiedProspectiveFixtures:0,definitionHash:digest(JSON.stringify(ELO_ONLY_DEFINITION)),evaluationHash:'a'.repeat(64),limitations:['All source records and approvals are invented local fixtures'],teamResultsOnlyAccepted:true,experimentalReview:{policyId:'nba-experimental-paper-1',reportHash:'a'.repeat(64),trainingEvidenceHash:'a'.repeat(64),featureCutoffPolicyHash:'a'.repeat(64),chronologicalSeasons:2,inputsReproducible:true,chronologicalEvaluationReviewed:true,historicalPublicationGapsDisclosed:true,uncertaintyAndInjuryLimitationsAccepted:true,conclusion:'experimental_research_only_no_profitability_or_calibration_claim'}});
   const config=controlledConfigSchema.parse({version:1,ownerId:owner,mode:'armed',killSwitch:false,sourcesEnabled:true,modelManifest:null,activationReceipt:null});
   const {V6_POLICY}=await import('@/lib/v6/policy');await v6Login(db,owner);
   await db.query('insert into public.v6_policies values($1,$2,$3,500000,5000,$4,$5::jsonb)',[owner,V6_POLICY.id,digest(JSON.stringify(V6_POLICY)),at,JSON.stringify(V6_POLICY)]);
   await db.query('insert into public.v6_controls(user_id,policy_id,enabled,kill_switch) values($1,$2,true,false)',[owner,V6_POLICY.id]);
   await db.query('insert into public.v6_models values($1,$2,$3,$4,$5,$6,$7,$8::jsonb)',[owner,f.modelId,f.version,f.method,digest(JSON.stringify(manifest)),f.validation,at,JSON.stringify({...manifest,reviewStatus:'owner_approved'})]);
   const receipt={format:'edgelab.v6-standing-activation',version:1,id:crypto.randomUUID(),ownerId:owner,approvedAt:at,approvalReference:'SYNTHETIC LOCAL APPROVAL ONLY',policyBundleHash:await policyBundleHash(),modelManifestHash:digest(JSON.stringify(manifest)),scope:'prospective_model_supported_paper_only',sourceRightsConfirmed:true};
   const fetcher:typeof fetch=async(input,init)=>{expect(new URL(String(input)).pathname).toBe('/rest/v1/rpc/v6_worker_access');const b=JSON.parse(init!.body as string);await v6Login(db,'','anon');try{return Response.json((await db.query('select public.v6_worker_access($1::uuid,$2::text,$3::text,$4::jsonb) value',[b.expected_owner,b.credential,b.operation,JSON.stringify(b.request)])).rows[0].value);}catch{return Response.json({message:'Scoped V6 request rejected'},{status:400});}};
   const repo=()=>supabaseV6Repository({projectUrl:'https://ilgoswfckkzpoktabbfi.supabase.co',projectRef:'ilgoswfckkzpoktabbfi',publishableKey:'sb_publishable_SYNTHETIC',ownerId:owner,capability:async()=>session,rawSource:async()=>e.originalOdds.raw,fetcher});
   let resultMode=false;const model={modelId:f.modelId,version:f.version,validationManifestHash:digest(JSON.stringify(manifest)),forecast:async()=>f};
   const job=(id:string):ScheduledJob=>({id,kind:resultMode?'results':'discovery',dueAt:new Date().toISOString(),deadline:new Date(Date.now()+3600000).toISOString(),status:'pending',attempts:0,nextAt:new Date().toISOString(),leaseUntil:null,lastError:null,controlHash:null});
   const tick=(j:ScheduledJob)=>runControlledTick(root,{repository:repo(),clock:()=>new Date().toISOString(),readControl:async()=>({config,manifest,receipt}),prepare:async()=>({model,provider:{collectionPermitted:true,collect:async()=>resultMode?[]:[o],grade:async p=>resultMode?(await gradeReconciledTeamPosition(p,{...e,at:new Date().toISOString()},(await repo().read()).grades.at(-1)??null)).grade:null}})},[j]);
   // nextAt is bounded to a known already-due instant rather than the few
   // milliseconds between fixture construction and scheduler clock capture.
   const first=job('LOCAL-CAPABILITY-REGISTER');first.nextAt=at;expect((await tick(first)).status).toBe('completed');
   const saved=await repo().read();expect(saved.positions).toHaveLength(1);expect(saved.positions[0].researchTier).toBe('experimental');const frozenHash=digest(JSON.stringify(saved.positions[0]));
   expect(paperAccounting(saved)).toMatchObject({openingReferenceCents:500000,pendingCents:5000,availableCents:495000});
   const old=session;session=await issue(db,owner,'paper_worker',session.credentialId);await expect(access(db,old)).rejects.toThrow(/credential rejected/);await repo().read();
   // Exercise the exact server clocks without backdating a source or disabling
   // guards. The sporting facts remain explicitly synthetic, not a real game.
   while(Date.parse(start)+1500>Date.now())await new Promise(resolve=>setTimeout(resolve,Math.min(30000,Date.parse(start)+1500-Date.now())));
   const finalAt=new Date().toISOString();e.scores={...changed(e.scores,b=>{b[0].commence_time=new Date(Date.parse(start)+1000).toISOString();b[0].last_update=finalAt;}),retrievedAt:finalAt};e.secondary={...changed(e.secondary,b=>{b.data.datetime=start;}),retrievedAt:finalAt};
   resultMode=true;const results=job('LOCAL-CAPABILITY-SETTLE');results.nextAt=finalAt;expect((await tick(results)).status).toBe('completed');
   const settled=await repo().read();expect(settled.grades).toHaveLength(1);expect(digest(JSON.stringify(settled.positions[0]))).toBe(frozenHash);expect(paperAccounting(settled)).toMatchObject({profitCents:4000,equityCents:504000,pendingCents:0});
   expect(paperResearchCohorts(settled).find(c=>c.tier==='strongly_supported')?.positions).toBe(0);expect((await tick(results)).status).toBe('idle');
   const next=job('LOCAL-CAPABILITY-RECHECK');next.nextAt=finalAt;await tick(next);expect((await repo().read()).grades).toHaveLength(1);
   const beforeBadGrade=await repo().read(),firstGrade=beforeBadGrade.grades[0];
   const invalidWinner={...firstGrade,id:crypto.randomUUID(),revision:2,previousGradeId:firstGrade.id,winnerId:'NBA:NOT-IN-THIS-FIXTURE',outcome:'lost'};
   await expect(access(db,session,'commit',{expected_revision:beforeBadGrade.revision,run_snapshot:{id:'LOCAL-BAD-WINNER',at:new Date().toISOString(),mode:'armed',screened:0,registered:0,observations:[],rejections:[]},raw_sources:{},position_rows:[],grade_rows:[{grade:invalidWinner,originalPosition:JSON.stringify(beforeBadGrade.positions[0])}]})).rejects.toThrow(/winner outside exact fixture/);
   expect((await repo().read()).revision).toBe(beforeBadGrade.revision);expect(paperAccounting(await repo().read()).profitCents).toBe(4000);
   const revisionBeforeStop=(await repo().read()).revision;await v6Login(db,owner);await db.query('update public.v6_controls set kill_switch=true where user_id=$1',[owner]);
   const serverStop=job('LOCAL-CAPABILITY-SERVER-STOP');serverStop.nextAt=finalAt;expect((await tick(serverStop)).status).toBe('failed');expect((await repo().read()).revision).toBe(revisionBeforeStop);
   config.killSwitch=true;expect((await tick(job('LOCAL-CAPABILITY-STOP'))).status).toBe('disabled');config.killSwitch=false;
   await v6Login(db,owner);await db.query('select public.v6_revoke_worker_credential($1::uuid,$2::uuid)',[owner,session.credentialId]);await expect(repo().read()).rejects.toThrow('HTTP 400');
   await db.exec('reset role');expect((await db.query('select count(*)::int n from public.financial_transactions')).rows[0].n).toBe(0);expect((await db.query('select count(*)::int n from public.bets')).rows[0].n).toBe(0);
   expect((await db.query('select (select count(*)::int from public.v6_positions) positions,(select count(*)::int from public.v6_grade_revisions) grades')).rows[0]).toEqual({positions:1,grades:1});
  }finally{await db.close();await fs.rm(root,{recursive:true,force:true});}
 },130000);
});
