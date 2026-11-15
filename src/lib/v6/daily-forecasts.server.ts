import path from 'node:path';
import fs from 'node:fs/promises';
import {digest,atomicPrivateJson,retainEvidence,type RawEvidence} from './evidence.server';
import {teamGames,usableTeamGames,type TeamGame} from './team-games';
import {forecastTeamGame,ELO_ONLY_DEFINITION} from './team-model';
import {fitScoreModel,forecastScoreLine,scoreArtifact,SCORE_PROTOCOL} from './score-distribution';
import {forecastJournal,type DailyForecast,type ForecastResult} from './forecast-journal.server';
import {canonicalTeamRows,teamRegistry,resolveTeamLabel,type TeamRegistry} from './team-identity';
import {normalizeResearchMarkets} from './market-normalization';
import {researchTeamIdentities} from './research-identity';

export async function freezeDailyForecasts(root:string,input:{ownerId:string;runId:string;rows:TeamGame[];registry:TeamRegistry;fixtureReceipts:RawEvidence[];completeSeasons:number[];at:string;latestStart:string;clock:()=>string;beforeCommit:()=>Promise<void>}){
 const {hash,...registryBody}=input.registry;
 if(digest(JSON.stringify(registryBody))!==hash||Date.parse(input.registry.recordedAt)>Date.parse(input.at))throw new Error('Forecast registry integrity');
 const repo=forecastJournal(root,input.ownerId,input.clock),existing=await repo.read();
 const excluded:Parameters<typeof repo.exclude>[0]=[];
 const fixtures=new Map<string,TeamGame>();
 for(const source of input.fixtureReceipts){
  if(source.provider!=='balldontlie'||Date.parse(source.retrievedAt)>Date.parse(input.at))throw new Error('Forecast fixture source clock/provider');
  const canonical=canonicalTeamRows(await teamGames(source),input.registry);
  for(const g of canonical.blocked.filter(g=>!g.final))excluded.push({fixtureId:'balldontlie:'+g.sourceGameId,sourceReceipt:source.id,sourceHash:source.hash,reason:'exact_team_identity_unresolved',recordedAt:input.at});
  for(const g of canonical.matched)if(!g.final){if(!g.startsAt||g.season===null)excluded.push({fixtureId:'balldontlie:'+g.sourceGameId,sourceReceipt:source.id,sourceHash:source.hash,reason:'fixture_start_or_season_missing',recordedAt:input.at});else if(Date.parse(g.startsAt)>Date.parse(input.at)+60000&&Date.parse(g.startsAt)<=Date.parse(input.latestStart))fixtures.set(g.sourceGameId,g);}
 }
 const history=usableTeamGames(input.rows,input.at).games.filter(g=>g.startsAt!.slice(0,10)<input.at.slice(0,10));
 const scores=history.map(g=>({id:g.provider+':'+g.sourceGameId,sport:'NBA' as const,startsAt:g.startsAt!,observedAt:g.retrievedAt,home:g.home.name,away:g.away.name,homeScore:g.homeScore!,awayScore:g.awayScore!,sourceHash:g.rawHash}));
 const model=fitScoreModel(scores,'NBA',input.at),artifact= model?scoreArtifact(model):null;
 const historyHash=digest(JSON.stringify(history)),eloHash=digest(JSON.stringify({definition:ELO_ONLY_DEFINITION,historyHash}));
 await input.beforeCommit();
 for(const source of input.fixtureReceipts)await retainEvidence(root,source);
 // Input snapshots and artifacts are outside the public DTO; neither original
 // models nor the protected training journal is modified.
 const inputSnapshot={history,historyHash,scoreArtifact:artifact,eloDefinition:ELO_ONLY_DEFINITION,registry:input.registry},snapshotHash=digest(JSON.stringify(inputSnapshot));
 await atomicPrivateJson(path.join(root,'forecast-inputs',snapshotHash+'.json'),inputSnapshot);
 const forecasts:DailyForecast[]=[];
 for(const g of fixtures.values()){
  const fixtureId='balldontlie:'+g.sourceGameId,startsAt=g.startsAt!;
  const elo=await forecastTeamGame([...history,...input.rows.filter(r=>!r.final)],{home:g.home.name,away:g.away.name,season:g.season!,startsAt,at:input.at,completeRegularSeasons:input.completeSeasons});
  const intervening=input.rows.some(r=>!r.final&&r.startsAt&&Date.parse(r.startsAt)>Date.parse(input.at)&&Date.parse(r.startsAt)<Date.parse(startsAt)&&[r.home.name,r.away.name].some(n=>n===g.home.name||n===g.away.name));
  const scoreValid=model&&!intervening&&Object.hasOwn(model.off,g.home.name)&&Object.hasOwn(model.off,g.away.name)&&Date.parse(input.at)-Date.parse(model.to)<=21*86400000;
  const predicted=scoreValid?model.predict(g.home.name,g.away.name):null;
  const common={sport:'NBA' as const,period:'full_game' as const,overtime:'included' as const,fixtureId,fixtureReceipt:g.receiptId,fixtureSourceHash:g.rawHash,home:g.home.name,away:g.away.name,startsAt,generatedAt:input.at,inputCutoff:input.at,correlationGroup:fixtureId,inputHash:snapshotHash,sourceHashes:[g.rawHash,hash,...new Set(history.map(h=>h.rawHash))],predictedMargin:predicted?predicted.home-predicted.away:null,predictedTotal:predicted?predicted.home+predicted.away:null,lineSource:'fixed_analysis' as const,quote:null,paperRegistration:false as const,limitations:['Experimental prospective forecast, not a qualified PAPER position','No injury/rotation/possession data; sensitivity is not a confidence interval','Analysis thresholds have no offered price, EV, CLV or hypothetical profit']};
  const add=(family:DailyForecast['family'],side:DailyForecast['side'],line:number|null,p:number|null,push:number|null,baseline:number|null,baselinePush:number|null,artifactHash:string|null,modelId:string,version:string,sensitivity:DailyForecast['sensitivity'],exclusions:string[])=>{
   // First valid forecast per model/market is primary. Daily exclusions remain
   // immutable history and can be followed by a genuinely pre-event forecast.
   if(existing.forecasts.some(f=>f.fixtureId===fixtureId&&f.family===family&&f.side===side&&f.line===line&&f.modelId===modelId&&f.version===version&&f.probability!==null))return;
   const id=digest(JSON.stringify([fixtureId,family,side,line,modelId,version,input.at.slice(0,10)]));if(existing.forecasts.some(f=>f.id===id))return;
   forecasts.push({...common,id,family,side,line,probability:p,pushProbability:push,baselineProbability:baseline,baselinePushProbability:baselinePush,artifactHash,modelId,version,sensitivity,exclusions});
  };
  for(const side of ['home','away'] as const){const p=elo.forecast?side==='home'?elo.forecast.eloOnlyHome:1-elo.forecast.eloOnlyHome:null;add('moneyline',side,null,p,p===null?null:0,p===null?null:side==='home'?elo.forecast!.historicalWinRateHome:1-elo.forecast!.historicalWinRateHome,p===null?null:0,p===null?null:eloHash,ELO_ONLY_DEFINITION.id,ELO_ONLY_DEFINITION.version,null,p===null?elo.reasons:[]);}
  for(const family of ['spread','total'] as const)for(const line of family==='spread'?SCORE_PROTOCOL.spreadLines:SCORE_PROTOCOL.totalLines)for(const side of family==='spread'?['home','away'] as const:['over','under'] as const){
   const exactLine=family==='spread'&&side==='away'?-line:line;
   const p=scoreValid?forecastScoreLine(model,g.home.name,g.away.name,family,exactLine,side):null,b=scoreValid?forecastScoreLine(model,g.home.name,g.away.name,family,exactLine,side,true):null;
   add(family,side,exactLine,p?.probability??null,p?.pushProbability??null,b?.probability??null,b?.pushProbability??null,p?model!.artifactHash:null,SCORE_PROTOCOL.id,SCORE_PROTOCOL.version,p?.sensitivity as [number,number]??null,p?[]:[intervening?'unresolved_intervening_fixture':'score_features_missing_stale_or_unknown_team']);
  }
 }
 await repo.exclude(excluded,input.beforeCommit);
 const next=await repo.freeze(input.runId,forecasts,input.beforeCommit);
 return {fixtures:fixtures.size,appended:next.forecasts.length-existing.forecasts.length,numerical:forecasts.filter(f=>f.probability!==null).length,revision:next.revision,headHash:next.headHash,providerRequests:0,paperRegistrations:0};
}

/** Reuses retained two-provider finals; never asks for an API key or silently
 * increases a results job's source allowance. Clock drift remains unresolved. */
export async function forecastIdentityMatcher(root:string,f:DailyForecast,receipts?:RawEvidence[]){
 const snapshot=JSON.parse(await fs.readFile(path.join(root,'forecast-inputs',f.inputHash+'.json'),'utf8'));
 let registry:TeamRegistry=snapshot.registry;const reconstructed=!registry;
 if(!registry){
  // Preserve the first genuine input file's bytes. Reconstruct ONLY its team
  // identity bridge from an already-retained catalogue available at generation.
  const all=receipts??await Promise.all((await fs.readdir(path.join(root,'evidence-receipts'))).filter(n=>/^[a-f0-9-]{36}\.json$/.test(n)).map(async n=>JSON.parse(await fs.readFile(path.join(root,'evidence-receipts',n),'utf8')) as RawEvidence));
  const catalog=all.filter(r=>r.provider==='balldontlie'&&new URL(r.sourceUrl).pathname==='/v1/teams'&&Date.parse(r.retrievedAt)<=Date.parse(f.generatedAt)).sort((a,b)=>b.retrievedAt.localeCompare(a.retrievedAt))[0];if(!catalog)throw new Error('Original forecast identity catalogue unavailable');
  const original:RawEvidence=JSON.parse(await fs.readFile(path.join(root,'evidence-receipts',f.fixtureReceipt+'.json'),'utf8'));registry=await teamRegistry(catalog,[...snapshot.history,...await teamGames(original)],new Date().toISOString());
 }
 const {hash,...body}=registry;if(digest(JSON.stringify(body))!==hash||!reconstructed&&Date.parse(registry.recordedAt)>Date.parse(f.generatedAt))throw new Error('Forecast identity registry changed');
 const home=resolveTeamLabel(registry,f.home),away=resolveTeamLabel(registry,f.away);if(!home||!away)throw new Error('Exact forecast team identity unavailable');
 return {catalogueHash:registry.catalogueHash,matches:(g:TeamGame)=>resolveTeamLabel(registry,g.home.name)?.canonicalId===home.canonicalId&&resolveTeamLabel(registry,g.away.name)?.canonicalId===away.canonicalId&&g.startsAt!==null&&Math.abs(Date.parse(g.startsAt)-Date.parse(f.startsAt))<=15*60000};
}
export async function reconcileDailyForecasts(root:string,ownerId:string,receipts:RawEvidence[],at:string,clock=()=>new Date().toISOString(),beforeCommit?:()=>Promise<void>){
 const repo=forecastJournal(root,ownerId,clock),state=await repo.read(),parsed:{receipt:RawEvidence;games:TeamGame[]}[]=[];
 for(const receipt of receipts){if(Date.parse(receipt.retrievedAt)>Date.parse(at))continue;const u=new URL(receipt.sourceUrl);if(receipt.provider==='balldontlie'&&/^\/v1\/games(?:\/\d+)?$/.test(u.pathname)||receipt.provider==='the-odds-api.com'&&u.pathname.endsWith('/scores'))parsed.push({receipt,games:await teamGames(receipt)});}
 const results:ForecastResult[]=[];
 for(const fixtureId of new Set(state.forecasts.map(f=>f.fixtureId))){
  const f=state.forecasts.find(f=>f.fixtureId===fixtureId)!;if(Date.parse(f.startsAt)>=Date.parse(at))continue;
  const identity=await forecastIdentityMatcher(root,f,receipts);
  const eligible=parsed.filter(p=>Date.parse(p.receipt.retrievedAt)>=Date.parse(f.startsAt));
  const b=eligible.filter(p=>p.receipt.provider==='balldontlie').sort((a,b)=>b.receipt.retrievedAt.localeCompare(a.receipt.retrievedAt)).flatMap(p=>p.games.filter(g=>'balldontlie:'+g.sourceGameId===fixtureId).map(g=>({g,r:p.receipt})))[0];
  const a=eligible.filter(p=>p.receipt.provider==='the-odds-api.com').sort((a,b)=>b.receipt.retrievedAt.localeCompare(a.receipt.retrievedAt)).map(p=>({r:p.receipt,games:p.games.filter(identity.matches)})).find(p=>p.games.length===1);
  const primary=a?.games[0],secondary=b?.g;
  const verified=primary&&secondary&&primary.startsAt&&Date.parse(f.generatedAt)<Math.min(Date.parse(primary.startsAt),Date.parse(f.startsAt))-60000&&(!primary.sourceUpdatedAt||Date.parse(primary.sourceUpdatedAt)<=Date.parse(a!.r.retrievedAt))&&primary.final&&secondary.final&&identity.matches(secondary)&&primary.homeScore!==null&&primary.awayScore!==null&&primary.homeScore!==primary.awayScore&&primary.homeScore===secondary.homeScore&&primary.awayScore===secondary.awayScore;
  results.push({fixtureId,at,status:verified?'verified':'unresolved',reason:verified?null:'independent_finals_missing_conflicting_or_identity_drift',homeScore:verified?primary.homeScore:null,awayScore:verified?primary.awayScore:null,sourceHashes:[...new Set([identity.catalogueHash,...(a?[a.r.hash]:[]),...(b?[b.r.hash]:[])])],sourceEventIds:[...(primary?['the-odds-api.com:'+primary.sourceGameId]:[]),...(secondary?[fixtureId]:[])]});
 }
 const next=await repo.results(results,beforeCommit);return {verified:results.filter(r=>r.status==='verified').length,unresolved:results.filter(r=>r.status==='unresolved').length,revision:next.revision,providerRequests:0,paperSettlements:0};
}

export function scoreFrozenForecast(f:Pick<DailyForecast,'fixtureId'|'family'|'side'|'line'|'probability'|'pushProbability'|'baselineProbability'|'baselinePushProbability'|'exclusions'>,r:ForecastResult){
 if(r.fixtureId!==f.fixtureId||r.status!=='verified'||r.homeScore===null||r.awayScore===null||f.probability===null||f.pushProbability===null||f.exclusions.length)return null;
 const margin=r.homeScore-r.awayScore,total=r.homeScore+r.awayScore,value=f.family==='moneyline'?(f.side==='home'?margin:-margin):f.family==='spread'?(f.side==='home'?margin:-margin)+f.line!:f.side==='over'?total-f.line!:f.line!-total;
 const outcome=value===0?'push':value>0?'won':'lost',p=[f.probability,f.pushProbability,Math.max(0,1-f.probability-f.pushProbability)],y=outcome==='won'?0:outcome==='push'?1:2;
 const loss=(probabilities:number[])=>({brier:probabilities.reduce((n,p,i)=>n+(p-Number(i===y))**2,0)/(f.family==='moneyline'?2:1),logLoss:-Math.log(Math.max(1e-12,probabilities[y]))});
 const baseline=f.baselineProbability===null||f.baselinePushProbability===null?null:loss([f.baselineProbability,f.baselinePushProbability,1-f.baselineProbability-f.baselinePushProbability]);
 return {outcome,actualMargin:margin,actualTotal:total,...loss(p),baseline,probabilityError:f.probability-Number(y===0),pushTreatment:'three-category win/push/loss; binary moneyline Brier',bettingProfit:null};
}

/** Retain actual offered markets alongside fixed analysis thresholds. Unknown
 * spread/total settlement terms deliberately withhold their probabilities. */
export async function freezeQuotedForecasts(root:string,ownerId:string,source:RawEvidence,rows:TeamGame[],registry:TeamRegistry,at:string,clock:()=>string,beforeCommit:()=>Promise<void>){
 const repo=forecastJournal(root,ownerId,clock),state=await repo.read(),identities=researchTeamIdentities(source,rows,registry,at),quotes=normalizeResearchMarkets(source,identities,at),forecasts:DailyForecast[]=[];
 for(const q of quotes){if(!q.canonicalEventId||q.odds===null||q.quoteAt===null||!q.family||!['moneyline','spread','total'].includes(q.family)||!q.side||Date.parse(q.safeStartsAt)<=Date.parse(at)+60000)continue;
  const base=state.forecasts.find(f=>f.fixtureId===q.canonicalEventId&&f.family===q.family&&f.side===q.side&&f.line===q.line&&f.probability!==null&&f.lineSource==='fixed_analysis');
  const template=base??state.forecasts.find(f=>f.fixtureId===q.canonicalEventId&&f.family===q.family);if(!template)continue;
  const reasons=[...q.reasons,...(!base?['exact_line_forecast_unavailable']:[])];
  const pair=quotes.filter(r=>r.eventId===q.eventId&&r.family===q.family&&r.line===q.line&&r.odds!==null&&!r.reasons.length),deVig=q.family==='moneyline'&&pair.length===2?(1/q.odds)/pair.reduce((n,r)=>n+1/r.odds!,0):null;
  const id=digest(JSON.stringify(['offered',q.key,source.id]));const old=state.forecasts.find(f=>f.id===id);if(old){if(old.quote?.sourceHash!==q.sourceHash)throw new Error('Quote source replay changed');continue;}
  forecasts.push({...template,id,overtime:q.overtime,family:q.family as DailyForecast['family'],side:q.side,line:q.line,startsAt:q.safeStartsAt,generatedAt:at,probability:reasons.length?null:base!.probability,pushProbability:reasons.length?null:base!.pushProbability,lineSource:'sportsbet',quote:{odds:q.odds,quoteAt:q.quoteAt,sourceHash:q.sourceHash,sourceReceipt:q.sourceReceipt,providerMarket:q.providerMarket,deVigProbability:deVig},exclusions:reasons,sourceHashes:[...new Set([...template.sourceHashes,q.sourceHash])],limitations:[...template.limitations,'Offered quote is research evidence; registration requires separate bounded policy']});
 }
 const next=await repo.freeze('quotes:'+source.id,forecasts,beforeCommit);return {appended:next.forecasts.length-state.forecasts.length,providerRequests:0};
}
