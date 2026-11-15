import fs from 'node:fs/promises';import path from 'node:path';import {z} from 'zod';
import {digest,atomicPrivateJson,type RawEvidence} from './evidence.server';
import {journalV6Repository} from './journal-repository.server';
import {observationSchema,forecastSchema,type Observation,type Forecast} from './types';
import {registerPaper,appendGrade,paperAccounting} from './engine';
import {TEAM_RESEARCH_POLICY} from './team-research-policy';
import {ELO_ONLY_DEFINITION} from './team-model';
import {TEAM_TERMS,type TeamFixtureProof} from './team-pilot';
import {teamGames} from './team-games';
import {resolveTeamLabel,type TeamRegistry} from './team-identity';
import {gradeReconciledTeamPosition} from './reconciled-grading';

export const DAILY_PAPER_POLICY=Object.freeze({id:'v63-bounded-elo-moneyline-1',sport:'NBA',markets:['moneyline'],bookmaker:'sportsbet',model:ELO_ONLY_DEFINITION,research:TEAM_RESEARCH_POLICY,openingCents:500000,stakeCents:5000,positionCap:null,exposureCap:null,retrospectiveRegistration:false,eventStartsWithinPermit:true,spreadTotalRegistration:false,hosted:false});
const hash=z.string().regex(/^[a-f0-9]{64}$/),stamp=z.string().datetime({offset:true});
export const dailyPaperApprovalSchema=z.object({format:z.literal('edgelab.v63-paper-approval'),version:z.literal(1),approved:z.literal(true),ownerId:z.string(),approvalReference:z.string().min(1),recordedAt:stamp,startsAt:stamp,expiresAt:stamp,policyHash:hash,codeHash:hash,sourceReceiptHash:hash}).strict();
export const PAPER_PILOT_CODE=['src/lib/v6/daily-paper-pilot.server.ts','src/lib/v6/engine.ts','src/lib/v6/journal-repository.server.ts','src/lib/v6/reconciled-grading.ts','src/lib/v6/team-reconciliation.ts','src/lib/v6/controlled-team-runtime.server.ts','src/lib/v6/types.ts','scripts/run-v6-controlled.mjs','src/lib/v6/models.ts','src/lib/v6/policy.ts','src/lib/v6/team-research-policy.ts','src/lib/v6/team-model.ts','src/lib/v6/team-pilot.ts','src/lib/v6/evidence.server.ts','src/lib/v6/team-games.ts','src/lib/v6/team-identity.ts'].sort();
export async function dailyPaperCodeHash(){const rows=[];for(const file of PAPER_PILOT_CODE)rows.push({file,hash:digest(await fs.readFile(file,'utf8'))});return digest(JSON.stringify(rows));}
export interface DailyPaperProof {proof:TeamFixtureProof;registry:TeamRegistry;originalFixtures:RawEvidence;rawSource:RawEvidence;observation:Observation;forecast:Forecast;}
/** A separate disabled boundary. Source-only config cannot activate this: only
 * a fresh, exact, future-dated PAPER receipt can. No source transport exists. */
export async function consumeDailyPaper(root:string,input:{ownerId:string;sourceReceiptHash:string;proofs:DailyPaperProof[];receipts:RawEvidence[];clock:()=>string;expectedCodeHash?:string}){
 const file=path.join(root,'local-paper/daily-pilot/approval.json');let raw:string;try{raw=await fs.readFile(file,'utf8');}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return {status:'paper_not_authorised',registered:0,settled:0,providerRequests:0};throw e;}
 const approval=dailyPaperApprovalSchema.parse(JSON.parse(raw)),at=input.clock(),binding=digest(raw);
 if(approval.ownerId!==input.ownerId||approval.sourceReceiptHash!==input.sourceReceiptHash||approval.policyHash!==digest(JSON.stringify(DAILY_PAPER_POLICY))||approval.codeHash!==(input.expectedCodeHash??await dailyPaperCodeHash())||Date.parse(approval.recordedAt)>=Date.parse(approval.startsAt)||Date.parse(approval.expiresAt)<=Date.parse(approval.startsAt)||Date.parse(approval.recordedAt)>Date.parse(at))throw new Error('Exact bounded PAPER approval required');
 const assertControl=async()=>{if(digest(await fs.readFile(file,'utf8'))!==binding)throw new Error('PAPER receipt changed');for(const stop of ['source-pilot/STOP','local-paper/daily-pilot/STOP'])try{await fs.access(path.join(root,stop));throw new Error('PAPER emergency stop');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}};
 await assertControl();
 const base=path.join(root,'local-paper/daily-pilot'),repo=journalV6Repository(path.join(base,'ledger'),input.ownerId,'v6-prospective',input.clock);let registered=0,settled=0;
 const rejections:{observationId:string;reasons:string[]}[]=[];
 for(const candidate of input.proofs){
  const o=observationSchema.parse(candidate.observation),original=forecastSchema.parse(candidate.forecast),p=candidate.proof;
  const now=input.clock();if(Date.parse(now)<Date.parse(approval.startsAt)||Date.parse(now)>=Date.parse(approval.expiresAt)||Date.parse(original.generatedAt)<Date.parse(approval.startsAt)||Date.parse(original.generatedAt)<Date.parse(approval.recordedAt)||Date.parse(o.eventStartsAt)>=Date.parse(approval.expiresAt)){rejections.push({observationId:o.id,reasons:['outside_fresh_paper_authority']});continue;}
  if(o.sourceClass!=='prospective'||o.market.statistic!=='moneyline'||o.market.sport!=='NBA'||original.method!=='nba_team_elo_only'||o.market.termsVersion!==TEAM_TERMS.version||o.rawHash!==candidate.rawSource.hash||digest(candidate.rawSource.raw)!==o.rawHash||candidate.rawSource.provider!=='the-odds-api.com'||o.sourceUrl!==candidate.rawSource.sourceUrl||o.retrievedAt!==candidate.rawSource.retrievedAt)throw new Error('PAPER original source/model mismatch');
  const events=JSON.parse(candidate.rawSource.raw),event=events.find((e:{id:string})=>e.id===p.eventId),market=event?.bookmakers.filter((b:{key:string})=>b.key==='sportsbet').flatMap((b:{markets:{key:string}[]})=>b.markets).find((m:{key:string})=>m.key==='h2h');
  const {hash:registryHash,...registryBody}=candidate.registry,fixtures=await teamGames(candidate.originalFixtures),g=fixtures.filter(g=>g.sourceGameId===p.statsGameId);
  if(candidate.originalFixtures.provider!=='balldontlie'||registryHash!==digest(JSON.stringify(registryBody))||registryHash!==p.registryHash||g.length!==1||!g[0].startsAt||g[0].home.name!==p.statsHomeName||g[0].away.name!==p.statsAwayName||original.inputs.team?.registryHash!==registryHash||resolveTeamLabel(candidate.registry,event?.home_team)?.canonicalId!==p.homeId||resolveTeamLabel(candidate.registry,event?.away_team)?.canonicalId!==p.awayId||p.startsAt!==event.commence_time||o.eventStartsAt!==p.startsAt||Date.parse(p.earliestStartsAt)!==Math.min(Date.parse(g[0].startsAt),Date.parse(p.startsAt))||Math.abs(Date.parse(g[0].startsAt)-Date.parse(p.startsAt))>15*60000||o.market.eventId!=='the-odds-api.com:'+p.eventId||![p.homeId,p.awayId].includes(o.market.subjectId)||o.sourceUpdatedAt!==market?.last_update||!market?.outcomes.some((q:{name:string;price:number})=>q.name===(o.market.subjectId===p.homeId?p.homeName:p.awayName)&&q.price===o.odds))throw new Error('PAPER exact immutable fixture/quote evidence failed');
  // This research tier is applied only to NEW forecasts made after an approved
  // policy starts; old observations are never upgraded or rewritten.
  const f={...original,researchTier:'experimental' as const,validation:'chronologically_evaluated' as const};
  const proofFile=path.join(base,'proofs',o.id+'.json');let stored;try{stored=await fs.readFile(proofFile,'utf8');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
  if(stored&&stored!==JSON.stringify(candidate))throw new Error('PAPER proof mutation');
  await fs.mkdir(path.dirname(proofFile),{recursive:true,mode:0o700});if(!stored)await fs.writeFile(proofFile,JSON.stringify(candidate),{flag:'wx',mode:0o600});
  await repo.transact(async state=>{await assertControl();if(Date.parse(input.clock())>=Date.parse(approval.expiresAt))throw new Error('PAPER authority expired at commit');const r=await registerPaper(state,o,f,'pre_event_once',input.clock());if(r.reasons.length)rejections.push({observationId:o.id,reasons:r.reasons});else registered++;return r.state;});
 }
 const state=await repo.read();
 const finals: {receipt:RawEvidence;games:Awaited<ReturnType<typeof teamGames>>}[]=[];
 for(const receipt of input.receipts){const u=new URL(receipt.sourceUrl);if(receipt.provider==='the-odds-api.com'&&u.pathname.endsWith('/scores')||receipt.provider==='balldontlie'&&/^\/v1\/games(?:\/\d+)?$/.test(u.pathname))finals.push({receipt,games:await teamGames(receipt)});}
 for(const position of state.positions){
  if(Date.parse(position.observation.eventStartsAt)>Date.parse(input.clock()))continue;
  const proof:DailyPaperProof=JSON.parse(await fs.readFile(path.join(base,'proofs',position.observation.id+'.json'),'utf8'));
  const source=(provider:string,id:string)=>finals.filter(r=>r.receipt.provider===provider&&Date.parse(r.receipt.retrievedAt)<=Date.parse(input.clock())&&r.games.some(g=>g.sourceGameId===id)).sort((a,b)=>b.receipt.retrievedAt.localeCompare(a.receipt.retrievedAt))[0]?.receipt;
  const scores=source('the-odds-api.com',proof.proof.eventId),secondary=source('balldontlie',proof.proof.statsGameId!);if(!scores||!secondary)continue;
  await repo.transact(async current=>{await assertControl();const previous=current.grades.filter(g=>g.positionId===position.id).at(-1)??null,result=await gradeReconciledTeamPosition(position,{proof:proof.proof,registry:proof.registry,originalFixtures:proof.originalFixtures,originalOdds:proof.rawSource,scores,secondary,at:input.clock()},previous);if(!result.grade)return current;settled++;return appendGrade(current,result.grade);});
 }
 const final=await repo.read();await atomicPrivateJson(path.join(base,'health.json'),{at:input.clock(),registered,settled,rejections,providerRequests:0,accounting:paperAccounting(final)});
 return {status:Date.parse(at)>=Date.parse(approval.expiresAt)?'registration_expired_retained_settlement_only':'bounded_local_paper',registered,settled,rejections,providerRequests:0,accounting:paperAccounting(final)};
}

export async function runDailyPaperFromRetained(root:string,ownerId:string,sourceReceiptHash:string,clock=()=>new Date().toISOString()){
 try{await fs.access(path.join(root,'local-paper/daily-pilot/approval.json'));}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return {status:'paper_not_authorised',registered:0,settled:0,providerRequests:0};throw e;}
 const readFiles=async(directory:string)=>{try{return Promise.all((await fs.readdir(directory)).filter(n=>/^[a-f0-9-]{36}\.json$/.test(n)).map(async n=>JSON.parse(await fs.readFile(path.join(directory,n),'utf8'))));}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return [];throw e;}};
 return consumeDailyPaper(root,{ownerId,sourceReceiptHash,clock,proofs:await readFiles(path.join(root,'controlled/proofs')),receipts:await readFiles(path.join(root,'evidence-receipts'))});
}
