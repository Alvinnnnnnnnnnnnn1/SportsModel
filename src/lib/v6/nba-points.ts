import { z } from 'zod';
import { sha256 } from '@/lib/imports/duplicates';
const stamp=z.string().datetime({offset:true});
export const nbaGameLogSchema=z.object({
  playerId:z.string().min(1),teamId:z.string().min(1),gameId:z.string().min(1),season:z.number().int(),stage:z.number().int(),
  startsAt:stamp,completedAt:stamp.nullable(),finalObservedAt:stamp,minutes:z.number().min(0).max(75).nullable(),
  points:z.number().int().nonnegative().nullable(),participated:z.boolean().nullable(),final:z.boolean(),
  sourceHashes:z.array(z.string().regex(/^[a-f0-9]{64}$/)).min(1),
}).strict();
export type NbaGameLog=z.infer<typeof nbaGameLogSchema>;
export const NBA_POINTS_MODEL=Object.freeze({id:'nba-points-shrunk-gamma-poisson',version:'experimental-1',recentGames:10,priorMinutes:60,minutesShrinkageGames:10,minGames:20,maxHistoryAgeDays:45,maximumPoints:250});

function uniqueLogs(logs:NbaGameLog[]) {
  const unique=new Map<string,NbaGameLog>();
  for(const input of logs){const row=nbaGameLogSchema.parse(input),key=`${row.playerId}:${row.gameId}`,previous=unique.get(key);if(previous&&JSON.stringify(previous)!==JSON.stringify(row))throw new Error('Conflicting player-game evidence');unique.set(key,row);}
  return [...unique.values()].sort((a,b)=>a.startsAt.localeCompare(b.startsAt));
}
/** No data fitting at future/event time. Retrospective mode is explicitly for
 * chronological research evaluation; it does not prove historical publication times.
 */
export async function nbaPointsForecast(logs:NbaGameLog[],input:{playerId:string;eventStartsAt:string;cutoff:string;retrospective?:boolean;calculatedAt?:string}) {
  stamp.parse(input.eventStartsAt);stamp.parse(input.cutoff);
  const calculatedAt=stamp.parse(input.calculatedAt??new Date().toISOString());
  if(Date.parse(input.cutoff)>=Date.parse(input.eventStartsAt))throw new Error('Forecast cutoff must precede the event');
  const cutoff=Date.parse(input.cutoff);
  const eligible=uniqueLogs(logs).filter(g=>g.stage===2&&g.playerId===input.playerId&&g.final&&g.participated===true&&g.minutes!==null&&g.minutes>0&&g.points!==null
    &&Date.parse(g.startsAt)<cutoff&&(g.completedAt===null||Date.parse(g.completedAt)<=cutoff)&&(input.retrospective||Date.parse(g.finalObservedAt)<=cutoff))
    .map(g=>({...g,minutes:g.minutes!,points:g.points!}));
  const fail=(reason:string)=>({status:'insufficient' as const,reason,model:NBA_POINTS_MODEL,probability:null,expectedValue:null,forecast:null});
  if(!input.retrospective&&(Date.parse(calculatedAt)>=Date.parse(input.eventStartsAt)||Date.parse(input.cutoff)>Date.parse(calculatedAt)))return fail('forecast_not_created_pre_event');
  if(eligible.length<NBA_POINTS_MODEL.minGames)return fail('insufficient_completed_pre_cutoff_player_games');
  if(cutoff-Date.parse(eligible.at(-1)!.startsAt)>NBA_POINTS_MODEL.maxHistoryAgeDays*86400000)return fail('historical_features_too_old');
  const recent=eligible.slice(-NBA_POINTS_MODEL.recentGames),prior=eligible.slice(0,-NBA_POINTS_MODEL.recentGames);
  const priorExposure=prior.reduce((n,g)=>n+g.minutes,0),priorPoints=prior.reduce((n,g)=>n+g.points,0);
  if(priorExposure<=0||priorPoints===0)return fail('insufficient_rate_prior');
  const priorRate=priorPoints/priorExposure,alpha=priorRate*NBA_POINTS_MODEL.priorMinutes+recent.reduce((n,g)=>n+g.points,0),beta=NBA_POINTS_MODEL.priorMinutes+recent.reduce((n,g)=>n+g.minutes,0);
  const priorMeanMinutes=priorExposure/prior.length,weight=recent.length/(recent.length+NBA_POINTS_MODEL.minutesShrinkageGames);
  const minutesComponents=recent.map(g=>weight*g.minutes+(1-weight)*priorMeanMinutes);
  const expectedMinutes=minutesComponents.reduce((a,b)=>a+b,0)/minutesComponents.length;
  const distribution=Array.from({length:NBA_POINTS_MODEL.maximumPoints+1},()=>0);
  for(const minutes of minutesComponents){let mass=(beta/(beta+minutes))**alpha;distribution[0]+=mass/minutesComponents.length;
    for(let k=1;k<distribution.length;k++){mass*=((k-1+alpha)/k)*(minutes/(beta+minutes));distribution[k]+=mass/minutesComponents.length;}}
  const tailProbability=Math.max(0,1-distribution.reduce((a,b)=>a+b,0));
  if(tailProbability>1e-8)return fail('distribution_tail_unresolved');
  const frozenInputs={model:NBA_POINTS_MODEL,playerId:input.playerId,eventStartsAt:input.eventStartsAt,cutoff:input.cutoff,
    sourceHashes:[...new Set(eligible.flatMap(g=>g.sourceHashes))].sort(),logs:eligible,retrospective:input.retrospective??false,
    asOfAvailabilityVerified:!(input.retrospective??false),priorRate,alpha,beta,minutesComponents};
  const forecast={validation:'experimental' as const,generatedAt:calculatedAt,inputCutoff:input.cutoff,model:NBA_POINTS_MODEL,
    sampleSize:eligible.length,uniqueGames:eligible.length,expectedMinutes,minutesSD:Math.sqrt(minutesComponents.reduce((n,x)=>n+(x-expectedMinutes)**2,0)/minutesComponents.length),
    rateMean:alpha/beta,rateSD:Math.sqrt(alpha)/beta,distribution,tailProbability,frozenInputs,inputsHash:await sha256(JSON.stringify(frozenInputs))};
  return {status:'experimental' as const,reason:null,model:NBA_POINTS_MODEL,probability:null,expectedValue:null,forecast};
}
export function pointsThreshold(distribution:number[],line:number,side:'Over'|'Under') {
  if(!Number.isFinite(line)||line<0||line>100||distribution.some(p=>!Number.isFinite(p)||p<0)||Math.abs(distribution.reduce((a,b)=>a+b,0)-1)>1e-8)throw new Error('Unsupported/incomplete points distribution');
  return {winProbability:distribution.reduce((n,p,k)=>n+((side==='Over'?k>line:k<line)?p:0),0),pushProbability:Number.isInteger(line)?distribution[line]??0:0};
}
/** Retrospective walk-forward evaluation: all thresholds share one game cluster.
 * This is not a prospective result or proof of a calibrated betting advantage.
 */
export async function evaluateNbaPoints(logs:NbaGameLog[]) {
  const rows=uniqueLogs(logs),scores:{gameId:string;playerId:string;line:number;model:number;benchmark:number;y:number;inputsHash:string;featureCutoff:string;calculatedAt:string}[]=[];
  for(const target of rows){
    if(target.stage!==2||!target.final||target.points===null||target.participated!==true)continue;
    const cutoff=new Date(Date.parse(target.startsAt)-1).toISOString();
    const fitted=await nbaPointsForecast(rows,{playerId:target.playerId,eventStartsAt:target.startsAt,cutoff,retrospective:true});
    if(!fitted.forecast)continue;
    const history=rows.filter(g=>g.stage===2&&g.playerId===target.playerId&&g.final&&g.participated===true&&g.points!==null&&g.minutes!==null&&g.minutes>0&&Date.parse(g.startsAt)<Date.parse(cutoff)&&(g.completedAt===null||Date.parse(g.completedAt)<=Date.parse(cutoff)));
    for(const line of [5.5,10.5,15.5,20.5,25.5])scores.push({gameId:target.gameId,playerId:target.playerId,line,model:pointsThreshold(fitted.forecast.distribution,line,'Over').winProbability,benchmark:(history.filter(g=>g.points!>line).length+1)/(history.length+2),y:Number(target.points>line),inputsHash:fitted.forecast.inputsHash,featureCutoff:cutoff,calculatedAt:fitted.forecast.generatedAt});
  }
  const metrics=(key:'model'|'benchmark')=>scores.length?{brier:scores.reduce((n,s)=>n+(s[key]-s.y)**2,0)/scores.length,logLoss:scores.reduce((n,s)=>{const p=Math.max(1e-12,Math.min(1-1e-12,s[key]));return n-s.y*Math.log(p)-(1-s.y)*Math.log(1-p);},0)/scores.length}:null;
  return {status:'retrospective_chronological_experimental',modelDefinition:NBA_POINTS_MODEL,archivedPublicationTimesVerified:false,thresholdsPredeclared:[5.5,10.5,15.5,20.5,25.5],uniquePlayerGames:new Set(scores.map(s=>s.playerId+':'+s.gameId)).size,thresholdObservations:scores.length,model:metrics('model'),benchmark:metrics('benchmark'),scores};
}
