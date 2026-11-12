import fs from 'node:fs/promises';
import path from 'node:path';
import { atomicPrivateJson,digest,type RawEvidence } from './evidence.server';
import { freeSources } from './free-sources.server';
import { teamSources } from './team-sources.server';
import { teamGames } from './team-games';
import { loadTeamDataset,latestTeamGames } from './team-dataset.server';
import { teamRegistry,canonicalTeamRows } from './team-identity';
import { regularSeasonCoverage } from './team-coverage';
import { currentTeamCatalogue } from './team-catalogue';
import { screenTeamSlate,type TeamFixtureProof } from './team-pilot';
import { gradeReconciledTeamPosition } from './reconciled-grading';
import type { TeamRegistry } from './team-identity';
import { activationReasons,collectionApprovalReasons,modelManifestSchema,type ControlledConfig } from './controlled-activation';
import type { ScheduledJob } from './controlled-scheduler.server';
import type { V6Repository } from './repository.server';
import type { Forecast } from './types';
/** Concrete read-only ports for the registered worker. Never loads a shadow as
 * a new candidate, modifies the preserved dataset, or imports a V5 repository.
 */
export async function prepareControlledTeamPorts(root:string,repository:V6Repository,job:ScheduledJob,controls:{config:ControlledConfig;manifest:unknown;receipt:unknown},keys:{oddsKey?:string;bdlKey?:string},clock:()=>string){
 const {config,manifest,receipt}=controls,at=clock(),liveRoot=path.join(root,'controlled'),approved=(await activationReasons(config,manifest,receipt,at)).length===0;
 if(!config.sourcesEnabled||config.killSwitch||config.mode==='disabled'||config.mode==='armed'&&!approved)throw new Error('Controlled source gate is closed');
 const collectionApproved=(await collectionApprovalReasons(config,receipt,at)).length===0;
 const api=freeSources({root,clock:()=>Date.parse(clock()),oddsKey:keys.oddsKey,oddsPilot:'team-moneyline-v1',controlledQuota:approved||collectionApproved?{monthlyCeiling:config.monthlyOddsCeiling,approvalHash:digest(JSON.stringify(receipt))}:undefined});
 const secondary=teamSources({root,clock:()=>Date.parse(clock()),bdlKey:keys.bdlKey});
 let bdlQueue:Promise<unknown>=Promise.resolve();
 const readBdl=(endpoint:string,params:Record<string,string>={})=>{
  const request=bdlQueue.then(async()=>{
  let delay=0;try{const b=JSON.parse(await fs.readFile(path.join(root,'balldontlie-team-budget.json'),'utf8'));delay=Math.max(0,b.lastAt+12600-Date.parse(clock()));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
  if(delay)await new Promise(r=>setTimeout(r,delay));return secondary.read('balldontlie',endpoint,params);
  });bdlQueue=request.then(()=>undefined,()=>undefined);return request;
 };
 const readOdds=async(endpoint:string,params:Record<string,string>,cost:number)=>{
  let delay=0;try{const b=JSON.parse(await fs.readFile(path.join(root,'odds-shared-budget.json'),'utf8'));delay=Math.max(0,b.lastRequest+1100-Date.parse(clock()));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
  if(delay)await new Promise(r=>setTimeout(r,delay));return api.read('the-odds-api.com',endpoint,params,cost);
 };
 const forecasts=new Map<string,Forecast>(),current=await repository.read();
 let scorePromise:Promise<RawEvidence>|null=null;const secondaryResults=new Map<string,Promise<RawEvidence>>();
 const withinRetention=current.positions.filter(p=>Date.parse(p.observation.eventStartsAt)<=Date.parse(at)&&Date.parse(at)-Date.parse(p.observation.eventStartsAt)<3*86400000);
 const provider={collectionPermitted:true,collect:async()=>{
  if(job.kind==='results')return [];
  const cache=path.join(liveRoot,'features.json');let featureReceipts:RawEvidence[]=[];
  try{const saved=JSON.parse(await fs.readFile(cache,'utf8'));if(saved.through===clock().slice(0,10)&&Date.parse(clock())-Date.parse(saved.at)<4*3600000)featureReceipts=saved.receipts;}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
  if(!featureReceipts.length){
   const season=Number(clock().slice(0,4))-(Number(clock().slice(5,7))<7?1:0),seen=new Set<number>();let cursor:number|null=null;
   for(let page=0;page<16;page++){
    const params:Record<string,string>={'seasons[]':String(season),season_type:'regular',per_page:'100',end_date:clock().slice(0,10)};if(cursor!==null)params.cursor=String(cursor);
    const e=await readBdl('/v1/games',params);featureReceipts.push(e);const body=JSON.parse(e.raw),next=body.meta?.next_cursor;
    if(next===null||next===undefined&&body.meta?.per_page===100&&body.data.length<100)break;
    if(!Number.isSafeInteger(next)||seen.has(next))throw new Error('Current feature pagination invalid');seen.add(next);cursor=next;
    if(page===15)throw new Error('Current feature scope incomplete');
   }
   await atomicPrivateJson(cache,{at:clock(),through:clock().slice(0,10),receipts:featureReceipts});
  }
  const base=latestTeamGames(await loadTeamDataset(root)),replacement=new Map(base.map(g=>[g.provider+':'+g.sourceGameId,g]));
  for(const e of featureReceipts)for(const g of await teamGames(e))replacement.set(g.provider+':'+g.sourceGameId,g);
  const all=[...replacement.values()],receiptDir=path.join(root,'evidence-receipts');
  const retained=await Promise.all((await fs.readdir(receiptDir)).filter(f=>f.endsWith('.json')).map(async f=>JSON.parse(await fs.readFile(path.join(receiptDir,f),'utf8')) as Promise<RawEvidence>));
  const priorCatalog=retained.filter(e=>e.provider==='balldontlie'&&new URL(e.sourceUrl).pathname==='/v1/teams').sort((a,b)=>a.retrievedAt.localeCompare(b.retrievedAt)).at(-1);
  const catalog=await currentTeamCatalogue(priorCatalog,clock(),()=>readBdl('/v1/teams'));
  const registry=await teamRegistry(catalog,all),rows=canonicalTeamRows(all,registry).matched;
  const season=Number(new URL(featureReceipts[0].sourceUrl).searchParams.get('seasons[]')),coverage=await regularSeasonCoverage(featureReceipts,season,clock());
  await atomicPrivateJson(path.join(liveRoot,'discovered-fixtures.json'),{at:clock(),fixtures:rows.filter(g=>!g.final&&g.startsAt&&Date.parse(g.startsAt)>Date.parse(clock())).map(g=>({id:g.provider+':'+g.sourceGameId,startsAt:g.startsAt}))});
  await readOdds('/v4/sports',{},0);const odds=await readOdds('/v4/sports/basketball_nba/odds',{bookmakers:'sportsbet',markets:'h2h',oddsFormat:'decimal',dateFormat:'iso',includeSids:'true'},1);
  const screen=await screenTeamSlate(odds,rows,registry,coverage.complete?[season]:[],clock(),'elo_only');
  for(const [hash,history]of Object.entries(screen.snapshots))await atomicPrivateJson(path.join(liveRoot,'histories',hash+'.json'),history);
  for(const c of screen.candidates)if(c.observation&&c.forecast&&c.proof){
   const originalFixtures=featureReceipts.find(e=>(JSON.parse(e.raw).data as {id:number}[]).some(g=>String(g.id)===c.proof!.statsGameId));
   if(!originalFixtures)throw new Error('Original provider fixture proof is absent');
   const purpose=modelManifestSchema.safeParse(manifest).data?.researchPurpose??'strongly_supported';
   const f={...c.forecast,researchTier:purpose,validation:approved?(purpose==='experimental'?'chronologically_evaluated' as const:'out_of_sample_validated' as const):'experimental' as const};forecasts.set(c.observation.id,f);
   await atomicPrivateJson(path.join(liveRoot,'proofs',c.observation.id+'.json'),{proof:c.proof,registry,originalFixtures,observation:c.observation,forecast:f,manifestHash:digest(JSON.stringify(manifest)),rawSource:odds});
  }
  await atomicPrivateJson(path.join(liveRoot,'screens',odds.id+'.json'),{screen,modelApprovalApplied:approved,financialWrites:0});
  return screen.candidates.flatMap(c=>c.observation?[c.observation]:[]);
 },grade:async(position:typeof current.positions[number])=>{
  if(job.kind!=='results')return null;
  if(!withinRetention.some(p=>p.id===position.id)){
   await atomicPrivateJson(path.join(liveRoot,'grading-diagnostics',position.id+'.json'),{ownerId:config.ownerId,positionId:position.id,at:clock(),status:'unresolved_or_outside_window',reason:'not_started_or_score_retention_elapsed',financialSettlement:false});
   return null;
  }
  if(!scorePromise)scorePromise=(async()=>{await readOdds('/v4/sports',{},0);const ids=[...new Set(withinRetention.map(p=>p.observation.market.eventId.replace(/^the-odds-api\.com:/,'')))];return readOdds('/v4/sports/basketball_nba/scores',{daysFrom:'3',eventIds:ids.join(','),dateFormat:'iso'},2);})();
  const scoreSource=await scorePromise;
  let proof:TeamFixtureProof,registry:TeamRegistry,originalFixtures:RawEvidence,originalOdds:RawEvidence;try{const record=JSON.parse(await fs.readFile(path.join(liveRoot,'proofs',position.observation.id+'.json'),'utf8'));if(JSON.stringify(record.observation)!==JSON.stringify(position.observation))throw new Error('Registered source proof changed');proof=record.proof;registry=record.registry;originalFixtures=record.originalFixtures;originalOdds=record.rawSource;}
  catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return null;throw e;}
  if(!proof.statsGameId)return null;
  let box=secondaryResults.get(proof.statsGameId);if(!box){box=readBdl('/v1/games/'+proof.statsGameId);secondaryResults.set(proof.statsGameId,box);}
  const previous=current.grades.filter(g=>g.positionId===position.id).sort((a,b)=>a.revision-b.revision).at(-1)??null;
  if(!registry||!originalFixtures||!originalOdds)throw new Error('Registered original reconciliation evidence absent');
  const result=await gradeReconciledTeamPosition(position,{proof,registry,originalFixtures,originalOdds,scores:scoreSource,secondary:await box,at:clock()},previous);
  await atomicPrivateJson(path.join(liveRoot,'grading-diagnostics',position.id+'.json'),{ownerId:config.ownerId,positionId:position.id,at:clock(),status:result.status,reason:result.reason,sourceHash:scoreSource.hash,gradeProposed:result.grade!==null});
  return result.grade;
 }};
 const parsed=modelManifestSchema.safeParse(manifest);
 const model={modelId:'nba-team-elo-only',version:'candidate-1',validationManifestHash:digest(JSON.stringify(parsed.success?parsed.data:manifest)),forecast:async(o:{id:string})=>forecasts.get(o.id)??null};
 return {provider,model};
}
