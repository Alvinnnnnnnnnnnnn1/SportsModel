import {forecastJournal,type DailyForecast} from './forecast-journal.server';
import {scoreFrozenForecast} from './daily-forecasts.server';
import {probabilityMetrics} from './prediction/statistics';
import type {V6Selection} from './dashboard';
import fs from 'node:fs/promises';import path from 'node:path';
import {digest} from './evidence.server';
import {restoreScoreArtifact,forecastScoreLine} from './score-distribution';
import {forecastTeamGame,ELO_ONLY_DEFINITION} from './team-model';
import {teamGames} from './team-games';

export async function dailyForecastView(root:string,ownerId:string,at:string){
 const state=await forecastJournal(root,ownerId).read();
 const inputs=new Map<string,unknown>(),validatedInputs=new Set<string>(),fixtureCache=new Map<string,Awaited<ReturnType<typeof teamGames>>[number]>(),eloCache=new Map<string,number|undefined>();
 for(const f of state.forecasts){
  if(f.probability===null)continue;
  const read=async(relative:string)=>{const file=await fs.realpath(path.join(root,relative)),base=await fs.realpath(root);if(!file.startsWith(base+path.sep)||(await fs.stat(file)).size>64000000)throw new Error('Forecast evidence escaped private root');return JSON.parse(await fs.readFile(file,'utf8'));};
  if(!inputs.has(f.inputHash))inputs.set(f.inputHash,await read('forecast-inputs/'+f.inputHash+'.json'));
  const snapshot=inputs.get(f.inputHash) as {history:Parameters<typeof forecastTeamGame>[0];historyHash:string;scoreArtifact:Parameters<typeof restoreScoreArtifact>[0]|null;eloDefinition:typeof ELO_ONLY_DEFINITION};
  // The initial genuine checkpoint used the history hash as its input filename.
  // Preserve and validate that exact legacy file; new inputs hash the whole snapshot.
  if(!validatedInputs.has(f.inputHash+f.inputCutoff)){if(digest(JSON.stringify(snapshot))!==f.inputHash&&snapshot.historyHash!==f.inputHash||digest(JSON.stringify(snapshot.history))!==snapshot.historyHash||snapshot.history.some(g=>Date.parse(g.retrievedAt)>Date.parse(f.inputCutoff)||!g.startsAt||g.startsAt.slice(0,10)>=f.inputCutoff.slice(0,10)))throw new Error('Forecast input provenance changed');validatedInputs.add(f.inputHash+f.inputCutoff);}
  const fixtureKey=f.fixtureReceipt+f.fixtureId;
  if(!fixtureCache.has(fixtureKey)){const source=await read('evidence-receipts/'+f.fixtureReceipt+'.json'),fixture=(await teamGames(source)).find(g=>'balldontlie:'+g.sourceGameId===f.fixtureId);if(!fixture||source.hash!==f.fixtureSourceHash||Date.parse(source.retrievedAt)>Date.parse(f.generatedAt)||fixture.home.name!==f.home||fixture.away.name!==f.away||!fixture.startsAt||Math.abs(Date.parse(fixture.startsAt)-Date.parse(f.startsAt))>15*60000)throw new Error('Original forecast fixture source mismatch');fixtureCache.set(fixtureKey,fixture);}
  let probability:number|undefined,push=0;
  if(f.family==='moneyline'){
   if(digest(JSON.stringify(snapshot.eloDefinition))!==digest(JSON.stringify(ELO_ONLY_DEFINITION))||f.artifactHash!==digest(JSON.stringify({definition:ELO_ONLY_DEFINITION,historyHash:snapshot.historyHash})))throw new Error('Elo artifact mismatch');
   const fixture=fixtureCache.get(fixtureKey)!;if(fixture.season===null)throw new Error('Original forecast season missing');
   const key=f.fixtureId+f.inputHash;if(!eloCache.has(key)){const computed=await forecastTeamGame(snapshot.history,{home:f.home,away:f.away,season:fixture.season,startsAt:f.startsAt,at:f.inputCutoff,completeRegularSeasons:[fixture.season]});eloCache.set(key,computed.forecast?.eloOnlyHome);}const home=eloCache.get(key);probability=home===undefined?undefined:f.side==='home'?home:1-home;
  }else{if(!snapshot.scoreArtifact||snapshot.scoreArtifact.artifactHash!==f.artifactHash)throw new Error('Score artifact mismatch');const model=restoreScoreArtifact(snapshot.scoreArtifact),p=forecastScoreLine(model,f.home,f.away,f.family,f.line!,f.side);probability=p?.probability;push=p?.pushProbability??0;}
  if(probability===undefined||Math.abs(probability-f.probability)>1e-10||Math.abs(push-f.pushProbability!)>1e-10)throw new Error('Unreproducible prospective forecast');
 }
 const primary=new Map<string,DailyForecast>();
 for(const f of state.forecasts){const key=JSON.stringify([f.fixtureId,f.family,f.side,f.line,f.modelId,f.version,f.lineSource]);if(!primary.has(key)||primary.get(key)!.probability===null&&f.probability!==null)primary.set(key,f);}
 const rows=[...primary.values()],day=(t:string)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Melbourne',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(t));
 const result=(id:string)=>state.results.filter(r=>r.fixtureId===id).at(-1);
 const metrics=(['moneyline','spread','total'] as const).flatMap(family=>(['fixed_analysis','sportsbet'] as const).map(lineSource=>{
  const sample=rows.filter(f=>f.family===family&&f.lineSource===lineSource&&['home','over'].includes(f.side)&&f.probability!==null).flatMap(f=>{const r=result(f.fixtureId),score=r?scoreFrozenForecast(f,r):null;return score?[{f,r:r!,score}]:[];});
  const n=sample.length,avg=(value:(s:typeof sample[number])=>number)=>n?sample.reduce((sum,s)=>sum+value(s),0)/n:null;
  // Calibration is conditional on a decisive outcome; push scoring remains the
  // proper three-category score. Threshold rows never become fixture counts.
  const binary=sample.filter(s=>s.score.outcome!=='push').map(({f,score})=>({p:f.probability!/(1-f.pushProbability!),y:Number(score.outcome==='won'),date:f.startsAt.slice(0,10),season:Number(f.startsAt.slice(0,4))}));
  return {family,lineSource,modelId:family==='moneyline'?'nba-team-elo-only':'team-score-distribution',fixtures:new Set(sample.map(s=>s.f.fixtureId)).size,thresholdObservations:n,brier:avg(s=>s.score.brier),logLoss:avg(s=>s.score.logLoss),baselineBrier:sample.every(s=>s.score.baseline)?avg(s=>s.score.baseline!.brier):null,baselineLogLoss:sample.every(s=>s.score.baseline)?avg(s=>s.score.baseline!.logLoss):null,calibration:probabilityMetrics(binary)?.calibration??[],uncertainty:'Unavailable until sufficient independent fixture/date clusters',bookmaker:sample.length&&sample.every(s=>s.f.quote?.deVigProbability!==null&&s.f.quote?.deVigProbability!==undefined)?{brier:avg(s=>(s.f.quote!.deVigProbability!-Number(s.score.outcome==='won'))**2),logLoss:avg(s=>-Math.log(Math.max(1e-12,s.score.outcome==='won'?s.f.quote!.deVigProbability!:1-s.f.quote!.deVigProbability!)))}:null};
 }));
 const summary={revision:state.revision,headHash:state.headHash,lastFreezeAt:state.lastFreezeAt,forecasts:rows.filter(f=>f.probability!==null).length,fixtures:new Set(rows.filter(f=>f.probability!==null).map(f=>f.fixtureId)).size,generatedToday:rows.filter(f=>f.probability!==null&&day(f.generatedAt)===day(at)).length,awaitingResults:new Set(rows.filter(f=>f.probability!==null&&result(f.fixtureId)?.status!=='verified').map(f=>f.fixtureId)).size,verifiedFixtures:new Set(state.results.filter(r=>r.status==='verified'&&rows.some(f=>f.fixtureId===r.fixtureId&&f.probability!==null)&&result(r.fixtureId)===r).map(r=>r.fixtureId)).size,excluded:rows.filter(f=>f.probability===null).length,unresolvedFixtureSources:state.excludedFixtures.map(f=>({fixtureId:f.fixtureId,reason:f.reason})),metrics,paperRegistration:'not_authorised' as const};
 const selections:V6Selection[]=rows.map(f=>{const r=result(f.fixtureId),score=r?scoreFrozenForecast(f,r):null;return {key:f.id,eventId:f.fixtureId,statsEventId:f.fixtureId.split(':')[1],sport:'NBA',fixture:`${f.away} at ${f.home}`,selection:f.family==='moneyline'?f.side==='home'?f.home:f.away:`${f.side} ${f.line}`,market:`${f.family} · ${f.lineSource}${f.line===null?'':' '+f.line} · ${f.quote?'Sportsbet original quote':'no offered price'}`,marketFamily:f.family,odds:f.quote?.odds??null,breakEven:f.quote?1/f.quote.odds:null,probability:f.probability,eloProbability:f.family==='moneyline'?f.probability:null,ev:f.quote&&f.probability!==null?f.probability*f.quote.odds-1+(f.pushProbability??0):null,startsAt:f.startsAt,quoteAt:f.quote?.quoteAt??null,capturedAt:f.generatedAt,forecastAt:f.generatedAt,inputCutoff:f.inputCutoff,frozenAt:f.generatedAt,pass1:f.exclusions,pass2:['separate_paper_authority_required',...(!f.quote?['analysis_line_has_no_price']:[])],limitations:[...f.limitations,`Model ${f.modelId}/${f.version}; artifact ${f.artifactHash??'unavailable'}`,`Predicted home margin ${f.predictedMargin??'unavailable'}; total ${f.predictedTotal??'unavailable'}`,`Push probability ${f.pushProbability??'unavailable'}; sensitivity ${f.sensitivity?.join('–')??'unavailable'}`],outcome:score?.outcome??'unresolved',homeScore:r?.homeScore??null,awayScore:r?.awayScore??null,decision:r?.status==='verified'?'final_result_verified':f.probability===null?'excluded':f.quote?'forecast_only_priced':'forecast_only_awaiting_price',sourceClass:'prospective_forecast_ledger',verification:r?.status??'awaiting_independent_result'};});
 return {summary,selections};
}
export type DailyForecastSummary=Awaited<ReturnType<typeof dailyForecastView>>['summary'];
