import fs from 'node:fs/promises';import path from 'node:path';import {z} from 'zod';
import {SourcePilotBlocked} from '../source-pilot';
import {digest,atomicPrivateJson,exclusive,type RawEvidence,retainEvidence} from '../evidence.server';
import {screenTeamSlate,type TeamFixtureProof} from '../team-pilot';
import type {TeamRegistry} from '../team-identity';import type {TeamGame} from '../team-games';
import {reconcileTeamEvent} from '../team-reconciliation';
import {forecastDevelopmentModels,predictionArtifactSchema,researchTwoPass,PREDICTION_MODELS} from './forecast';
import {probabilityMetrics,pairedBlockInterval,calibratedProbability} from './statistics';
import type {PredictionModelKey} from './evaluation';
import type {CanonicalMarket} from '../types';
const stamp=z.string().datetime({offset:true}),hash=z.string().regex(/^[a-f0-9]{64}$/);
export const model2ShadowConfig=z.object({version:z.literal(1),ownerId:z.string().min(1),enabled:z.boolean(),artifactHash:hash,reviewedAt:stamp,scope:z.literal('shadow_only_no_paper_positions')}).strict();
export async function loadModel2ShadowConfig(root:string,ownerId:string,at:string){
 try{const config=model2ShadowConfig.parse(JSON.parse(await fs.readFile(path.join(root,'model-development/shadow-config.json'),'utf8')));if(!config.enabled)return null;if(config.ownerId!==ownerId||Date.parse(config.reviewedAt)>Date.parse(at))throw new Error('Model 2 shadow owner/clock mismatch');return config;}
 catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return null;throw e;}
}
interface Model2Fixture {
 eventId:string;proof:TeamFixtureProof;originalFixtureReceipt:string|null;sourceReceipt:string;generatedAt:string;artifactHash:string;historyHash:string|null;
 features:Awaited<ReturnType<typeof forecastDevelopmentModels>>['features'];homeProbabilities:Record<PredictionModelKey,number>|null;marketHomeProbability:number;limitations:string[];
 selections:{key:string;selection:string;market:CanonicalMarket|null;odds:number;sourceUpdatedAt:string|null;retrievedAt:string;forecasts:((typeof PREDICTION_MODELS)[number]&{probability:number|null;decision:ReturnType<typeof researchTwoPass>})[]}[];
 correlationGroup:string;positionsRegistered:number;
}
export interface Model2Slate {hash:string;record:{format:string;version:number;ownerId:string;sourceHash:string;sourceReceipt:string;artifactHash:string;registry:TeamRegistry;at:string;committedAt?:string;fixtures:Model2Fixture[];positionsRegistered:number;financialWrites:number};}
export async function freezeModel2Slate(root:string,input:{ownerId:string;source:RawEvidence;rows:TeamGame[];registry:TeamRegistry;completeSeasons:number[];originalFixtures:RawEvidence[];at:string;sourceCollectionApproved:boolean;clock?:()=>string;latestEventStart?:string;beforeCommit?:()=>Promise<void>}):Promise<Model2Slate|null>{
 z.string().uuid().parse(input.source.id);stamp.parse(input.at);
 const config=await loadModel2ShadowConfig(root,input.ownerId,input.at);if(!config)return null;if(!input.sourceCollectionApproved)throw new Error('Separate source-collection approval is required');
 const artifact=predictionArtifactSchema.parse(JSON.parse(await fs.readFile(path.join(root,'model-development/artifacts',config.artifactHash+'.json'),'utf8')));if(digest(JSON.stringify(artifact))!==config.artifactHash)throw new Error('Model 2 artifact hash changed');
 const destination=path.join(root,'model-development/slates',input.source.id+'.json');
 return exclusive(destination+'.lock',async()=>{
  try{const saved=await loadModel2Slate(root,input.source.id,input.ownerId);if(saved.record.sourceHash!==input.source.hash||saved.record.artifactHash!==config.artifactHash)throw new Error('Changed shadow replay');return saved;}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
  const screen=await screenTeamSlate(input.source,input.rows,input.registry,input.completeSeasons,input.at,'elo_only');
  const grouped=Map.groupBy(screen.candidates,c=>c.eventId),fixtures=[];
  for(const [eventId,candidates]of grouped){const proof=candidates[0].proof;if(!proof)continue;
   const originalFixtures=input.originalFixtures.find(e=>e.provider==='balldontlie'&&(JSON.parse(e.raw).data as {id:number}[]).some(g=>String(g.id)===proof.statsGameId));
   const season=input.rows.find(g=>g.provider==='balldontlie'&&g.sourceGameId===proof.statsGameId)?.season??null;
   const inWindow=!input.latestEventStart||Date.parse(proof.startsAt)<=Date.parse(input.latestEventStart);const future=inWindow&&Date.parse(input.at)<Date.parse(proof.earliestStartsAt)-60000;
   const modeled=future&&season!==null&&originalFixtures?await forecastDevelopmentModels(input.rows,artifact,{home:proof.statsHomeName,away:proof.statsAwayName,season,startsAt:proof.earliestStartsAt,at:input.at,completeRegularSeasons:input.completeSeasons}):null;
   const h=candidates.find(c=>c.selection===proof.homeName);if(!h)throw new Error('Missing original home selection');
   const selections=candidates.map(c=>{const isHome=c.selection===proof.homeName;const forecasts=PREDICTION_MODELS.map(model=>{const homeP=modeled?.probabilities?.[model.key]??null,p=homeP===null?null:isHome?homeP:1-homeP,base=modeled?.probabilities?.eloOnly;
    const sensitivity=modeled?.features?.sensitivity,scenarios=sensitivity?(model.key.startsWith('margin')?[sensitivity.marginHomeCourtMinus20,sensitivity.marginHomeCourtPlus20]:model.key.startsWith('features')?[sensitivity.featuresWithoutRecentForm]:[]):[];
    const calibratedScenarios=scenarios.map(p=>model.key==='marginCalibrated'?calibratedProbability(p,artifact.calibrators.marginElo):model.key==='featuresCalibrated'?calibratedProbability(p,artifact.calibrators.features):p);
    const adverse=calibratedScenarios.length?Math.min(...calibratedScenarios.map(p=>isHome?p:1-p)):undefined;
    return {...model,probability:p,decision:researchTwoPass({probability:p,odds:c.originalOdds,marketProbability:c.deVigMarketProbability,baseline:base===undefined?null:isHome?base:1-base,sourceReasons:[...c.pass1.reasons,...(!originalFixtures?['original_fixture_receipt_missing']:[]),...(!future?['not_genuinely_pre_event_or_outside_collection_window']:[])],adverseProbability:adverse})};});
    return {key:c.key,selection:c.selection,market:c.observation?.market??null,odds:c.originalOdds,sourceUpdatedAt:c.sourceUpdatedAt,retrievedAt:c.retrievedAt,forecasts};});
   if(originalFixtures)await retainEvidence(root,originalFixtures);
   const historyHash=modeled?digest(JSON.stringify(modeled.history)):null;if(modeled)await atomicPrivateJson(path.join(root,'model-development/histories',historyHash!+'.json'),modeled.history);
   fixtures.push({eventId,proof,originalFixtureReceipt:originalFixtures?.id??null,sourceReceipt:input.source.id,generatedAt:input.at,artifactHash:config.artifactHash,historyHash,features:modeled?.features??null,homeProbabilities:modeled?.probabilities??null,marketHomeProbability:h.deVigMarketProbability,limitations:modeled?.reasons??['independent_forecast_unavailable'],selections,correlationGroup:eventId,positionsRegistered:0});
  }
  await retainEvidence(root,input.source);
  await input.beforeCommit?.();
  const committedAt=input.clock?.()??new Date().toISOString();if(Date.parse(committedAt)<Date.parse(input.at)||fixtures.some(f=>f.homeProbabilities&&Date.parse(committedAt)>=Date.parse(f.proof.earliestStartsAt)-60000))throw new Error('Shadow commit missed genuine pre-event safety window');
  const record={committedAt,format:'edgelab.v6-model2-shadow',version:1,ownerId:input.ownerId,sourceHash:input.source.hash,sourceReceipt:input.source.id,artifactHash:config.artifactHash,registry:input.registry,at:input.at,fixtures,positionsRegistered:0,financialWrites:0};
  const saved={hash:digest(JSON.stringify(record)),record};await atomicPrivateJson(destination,saved);return saved;
 });
}
export async function loadModel2Slate(root:string,id:string,ownerId:string):Promise<Model2Slate>{z.string().uuid().parse(id);const saved=JSON.parse(await fs.readFile(path.join(root,'model-development/slates',id+'.json'),'utf8')) as Model2Slate;if(digest(JSON.stringify(saved.record))!==saved.hash||saved.record.ownerId!==ownerId||saved.record.positionsRegistered!==0)throw new Error('Model 2 slate integrity/owner mismatch');return saved;}
export interface Model2ResultRow {eventId:string;status:'verified'|'unresolved';reason:string|null;y:number|null;sourceHashes?:string[];decision?:Awaited<ReturnType<typeof reconcileTeamEvent>>;}
export interface Model2ResultRecord {format:string;version:number;shadowHash:string;at:string;results:Model2ResultRow[];positions:number;paperSettlements:number;revision?:number;previousHash?:string|null;factHash?:string;}
export async function latestModel2Results(root:string,slate:Model2Slate):Promise<{hash:string;record:Model2ResultRecord}|null>{
 let names:string[];try{names=await fs.readdir(path.join(root,'model-development/results',slate.record.sourceReceipt));}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return null;throw e;}
 const reports=await Promise.all(names.filter(n=>/^[a-f0-9]{64}\.json$/.test(n)).map(async n=>{const raw=JSON.parse(await fs.readFile(path.join(root,'model-development/results',slate.record.sourceReceipt,n),'utf8')) as Model2ResultRecord;
  if(digest(JSON.stringify(raw))!==n.slice(0,-5)||raw.shadowHash!==slate.hash||!Array.isArray(raw.results)||new Set(raw.results.map(r=>r.eventId)).size!==raw.results.length)throw new Error('Model 2 result integrity');return {hash:n.slice(0,-5),record:raw};}));
 reports.sort((a,b)=>b.record.at.localeCompare(a.record.at)||(b.record.revision??0)-(a.record.revision??0));return reports[0]??null;
}
export async function pendingModel2Events(root:string,slate:Model2Slate,at:string){const latest=await latestModel2Results(root,slate);return slate.record.fixtures.filter(f=>f.homeProbabilities&&Date.parse(f.proof.earliestStartsAt)<=Date.parse(at)&&Date.parse(at)-Date.parse(f.proof.earliestStartsAt)<3*86400000&&latest?.record.results.find(r=>r.eventId===f.eventId)?.status!=='verified').map(f=>f.eventId);}
export async function pendingModel2Slates(root:string,ownerId:string,at:string){
 let names:string[];try{names=await fs.readdir(path.join(root,'model-development/slates'));}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return [];throw e;}
 const records=[];for(const name of names.filter(n=>/^[a-f0-9-]{36}\.json$/.test(n))){const slate=await loadModel2Slate(root,name.slice(0,-5),ownerId);if((await pendingModel2Events(root,slate,at)).length)records.push(slate);}return records;
}
/** Genuine retained finals use the existing reconciliation policy; not a paper grade. */
export async function recordModel2Results(root:string,slate:Model2Slate,input:{scores:RawEvidence;secondary:(proof:TeamFixtureProof)=>Promise<RawEvidence>;at:string;eventIds?:string[];beforeCommit?:()=>Promise<void>}):Promise<Model2ResultRecord>{
 stamp.parse(input.at);const previous=await latestModel2Results(root,slate);const results:Model2ResultRow[]=[];
 const odds=JSON.parse(await fs.readFile(path.join(root,'evidence-receipts',slate.record.sourceReceipt+'.json'),'utf8')) as RawEvidence;
 for(const fixture of slate.record.fixtures){
  const retained=previous?.record.results.find(r=>r.eventId===fixture.eventId);if(input.eventIds&&!input.eventIds.includes(fixture.eventId)){if(retained)results.push(retained);continue;}
  if(Date.parse(fixture.proof.earliestStartsAt)>Date.parse(input.at)||Date.parse(input.at)-Date.parse(fixture.proof.earliestStartsAt)>=3*86400000||!fixture.originalFixtureReceipt){results.push({eventId:fixture.eventId,status:'unresolved',reason:'fixture_not_started_or_retention_or_evidence_missing',y:null});continue;}
  try{
  const original=JSON.parse(await fs.readFile(path.join(root,'evidence-receipts',fixture.originalFixtureReceipt+'.json'),'utf8')) as RawEvidence,secondary=await input.secondary(fixture.proof);
  const quote=fixture.selections[0];const result=await reconcileTeamEvent({proof:fixture.proof,registry:slate.record.registry,originalOdds:odds,originalFixtures:original,scores:input.scores,secondary,frozenAt:slate.record.at,at:input.at,
   quote:{selectionName:quote.selection,odds:quote.odds,sourceUpdatedAt:quote.sourceUpdatedAt,retrievedAt:quote.retrievedAt,forecastAt:fixture.generatedAt}});
  const verified=result.identity.verified&&result.result.verified&&result.quoteEligibility.eligible;
  results.push({eventId:fixture.eventId,status:verified?'verified':'unresolved',reason:verified?null:result.result.reason??'identity_or_quote_unverified',y:verified?Number(result.result.winnerId===fixture.proof.homeId):null,sourceHashes:result.sourceHashes,decision:result});
  }catch(e){if(e instanceof SourcePilotBlocked)throw e;results.push({eventId:fixture.eventId,status:'unresolved',reason:'final_source_unavailable_or_invalid',y:null});}
 }
 await input.beforeCommit?.();
 const factHash=digest(JSON.stringify(results.map(r=>({eventId:r.eventId,status:r.status,reason:r.reason,y:r.y,homeScore:r.decision?.result.homeScore??null,awayScore:r.decision?.result.awayScore??null}))));if(previous?.record.factHash===factHash)return previous.record;
 const record:Model2ResultRecord={revision:(previous?.record.revision??0)+1,previousHash:previous?.hash??null,factHash,format:'edgelab.v6-model2-results',version:1,shadowHash:slate.hash,at:input.at,results,positions:0,paperSettlements:0},hash=digest(JSON.stringify(record));await atomicPrivateJson(path.join(root,'model-development/results',slate.record.sourceReceipt,hash+'.json'),record);return record;
}
/** Earliest frozen quote per exact event+model version is primary, not every repricing/slate. */
export async function evaluateModel2Slates(root:string,ownerId:string){
 let names:string[];try{names=await fs.readdir(path.join(root,'model-development/slates'));}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return {fixtures:0,slates:0,models:[],positions:0};throw e;}
 const records=await Promise.all(names.filter(n=>/^[a-f0-9-]{36}\.json$/.test(n)).map(n=>loadModel2Slate(root,n.slice(0,-5),ownerId)));records.sort((a,b)=>a.record.at.localeCompare(b.record.at));
 const rows:{eventId:string;slate:string;date:string;startsAt:string;season:number;y:number;probabilities:Record<PredictionModelKey,number>;bookmaker:number;artifactHash:string}[]=[];const seen=new Set<string>();
 for(const slate of records){const latest=(await latestModel2Results(root,slate))?.record;
  for(const f of slate.record.fixtures){const eligible=f.homeProbabilities&&f.selections.every(s=>s.forecasts.every(m=>m.decision.pass1.length===0));if(!eligible||seen.has(f.eventId+':'+f.artifactHash))continue;seen.add(f.eventId+':'+f.artifactHash);
   const result=latest?.results.find(r=>r.eventId===f.eventId);if(result?.status!=='verified'||result.y===null)continue;
   rows.push({eventId:f.eventId,slate:slate.record.sourceReceipt,date:f.proof.startsAt.slice(0,10),startsAt:f.proof.startsAt,season:Number(f.proof.startsAt.slice(0,4)),y:result.y,probabilities:f.homeProbabilities!,bookmaker:f.marketHomeProbability,artifactHash:f.artifactHash});}
 }
 return {from:rows.map(r=>r.startsAt).sort()[0]??null,to:rows.map(r=>r.startsAt).sort().at(-1)??null,fixtures:new Set(rows.map(r=>r.eventId)).size,slates:new Set(rows.map(r=>r.date)).size,models:[...new Set(rows.map(r=>r.artifactHash))].flatMap(artifactHash=>[...PREDICTION_MODELS,{key:'bookmaker' as const,name:'Contemporaneous Sportsbet de-vig',version:'quoted-at-freeze',status:'benchmark only'}].map(model=>{const sample=rows.filter(r=>r.artifactHash===artifactHash),values=sample.map(r=>({p:model.key==='bookmaker'?r.bookmaker:r.probabilities[model.key],y:r.y,date:r.date,season:r.season}));const metrics=probabilityMetrics(values),market=probabilityMetrics(sample.map(r=>({p:r.bookmaker,y:r.y,date:r.date,season:r.season})));return {...model,artifactHash,metrics,pairedDifference:metrics&&market?{brier:metrics.brier-market.brier,logLoss:metrics.logLoss-market.logLoss}:null,versusBookmaker:pairedBlockInterval(values.map((r,i)=>({...r,baseline:sample[i].bookmaker}))),smallSlateWarning:new Set(sample.map(r=>r.date)).size<5};})),bySlate:[...new Set(rows.map(r=>r.date))].map(date=>({date,fixtures:new Set(rows.filter(r=>r.date===date).map(r=>r.eventId)).size,models:[...PREDICTION_MODELS,{key:'bookmaker' as const}].map(m=>({key:m.key,metrics:probabilityMetrics(rows.filter(r=>r.date===date).map(r=>({p:m.key==='bookmaker'?r.bookmaker:r.probabilities[m.key],y:r.y,date:r.date,season:r.season})))}))})),sourceQuality:{frozenSlates:records.length,retainedFixtures:records.reduce((n,s)=>n+s.record.fixtures.length,0),missingForecasts:records.reduce((n,s)=>n+s.record.fixtures.filter(f=>!f.homeProbabilities).length,0),firstPassExcluded:records.reduce((n,s)=>n+s.record.fixtures.filter(f=>f.selections.some(x=>x.forecasts.some(m=>m.decision.pass1.length>0))).length,0)},positions:0};
}
