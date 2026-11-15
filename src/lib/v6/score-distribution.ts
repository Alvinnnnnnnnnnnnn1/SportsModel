import {digest} from './evidence.server';
import {probabilityMetrics,type ProbabilityRow} from './prediction/statistics';
export interface ScoreGame {id:string;sport:'NBA'|'NBL';startsAt:string;observedAt:string;home:string;away:string;homeScore:number;awayScore:number;sourceHash:string;}
export const SCORE_PROTOCOL=Object.freeze({id:'team-score-distribution',version:'research-1',minimumGames:200,maximumGames:900,shrinkageGames:30,iterations:12,tailMixture:.1,wideScale:2,spreadLines:[-7.5,0,7.5],totalLines:[200.5,220.5,240.5],evaluationUnit:'one fixture per market family; average correlated line errors within fixture',training:'strictly earlier UTC dates; rolling 900 games; no test tuning',historicalPublicationVerified:false,registrationAllowed:false});
const average=(n:number[])=>n.reduce((a,b)=>a+b,0)/n.length;
function unique(games:ScoreGame[]){const map=new Map<string,ScoreGame>();for(const g of games){if(!Number.isFinite(Date.parse(g.startsAt))||!Number.isFinite(Date.parse(g.observedAt))||!g.home||g.home===g.away||g.homeScore===g.awayScore||![g.homeScore,g.awayScore].every(n=>Number.isInteger(n)&&n>=0&&n<=400)||!/^[a-f0-9]{64}$/.test(g.sourceHash))throw new Error('Invalid score source');const key=g.sport+':'+g.id;if(map.has(key)&&JSON.stringify(map.get(key))!==JSON.stringify(g))throw new Error('Conflicting score fixture');map.set(key,g);}return [...map.values()].sort((a,b)=>a.startsAt.localeCompare(b.startsAt)||a.id.localeCompare(b.id));}
export function fitScoreModel(input:ScoreGame[],sport:ScoreGame['sport'],cutoff:string,retrospective=false){
 if(!Number.isFinite(Date.parse(cutoff)))throw new Error('Invalid score cutoff');
 const rows=unique(input).filter(g=>g.sport===sport&&g.startsAt.slice(0,10)<cutoff.slice(0,10)&&(retrospective||Date.parse(g.observedAt)<=Date.parse(cutoff))).slice(-SCORE_PROTOCOL.maximumGames);
 if(rows.length<SCORE_PROTOCOL.minimumGames)return null;
 const homeMean=average(rows.map(g=>g.homeScore)),awayMean=average(rows.map(g=>g.awayScore)),league=(homeMean+awayMean)/2,homeEffect=(homeMean-awayMean)/2,teams=[...new Set(rows.flatMap(g=>[g.home,g.away]))].sort(),off:Record<string,number>={},def:Record<string,number>={};for(const t of teams){off[t]=0;def[t]=0;}
 // Ridge coordinate updates use BOTH venues and the opponent's current rating.
 // Home effect is estimated from training only. No pace/injury proxy is invented.
 const histories=Object.fromEntries(teams.map(t=>[t,rows.filter(g=>g.home===t||g.away===t)]));
 for(let iteration=0;iteration<SCORE_PROTOCOL.iterations;iteration++){
  for(const t of teams){const scored=histories[t].flatMap(g=>g.home===t?[g.homeScore-league-homeEffect-def[g.away]]:g.away===t?[g.awayScore-league+homeEffect-def[g.home]]:[]);off[t]=scored.reduce((a,b)=>a+b,0)/(scored.length+SCORE_PROTOCOL.shrinkageGames);}
  const centre=average(Object.values(off));for(const t of teams)off[t]-=centre;
  for(const t of teams){const allowed=histories[t].flatMap(g=>g.home===t?[g.awayScore-league+homeEffect-off[g.away]]:g.away===t?[g.homeScore-league-homeEffect-off[g.home]]:[]);def[t]=allowed.reduce((a,b)=>a+b,0)/(allowed.length+SCORE_PROTOCOL.shrinkageGames);}
  const centreD=average(Object.values(def));for(const t of teams)def[t]-=centreD;
 }
 const predict=(h:string,a:string,baseline=false)=>({home:league+homeEffect+(baseline?0:(off[h]??0)+(def[a]??0)),away:league-homeEffect+(baseline?0:(off[a]??0)+(def[h]??0))});
 const residuals=(baseline:boolean,family:'spread'|'total')=>rows.map(g=>{const p=predict(g.home,g.away,baseline);return family==='spread'?g.homeScore-g.awayScore-(p.home-p.away):g.homeScore+g.awayScore-p.home-p.away;});
 const sd=(r:number[])=>Math.sqrt(Math.max(16,r.reduce((n,x)=>n+x*x,0)/Math.max(1,r.length-teams.length)));
 const scales={spread:sd(residuals(false,'spread')),total:sd(residuals(false,'total')),baselineSpread:sd(residuals(true,'spread')),baselineTotal:sd(residuals(true,'total'))};
 const sourceHash=digest(JSON.stringify(rows)),artifactHash=digest(JSON.stringify({protocol:SCORE_PROTOCOL,sport,cutoff,sourceHash,league,homeEffect,off,def,scales}));
 return {model:SCORE_PROTOCOL,league,homeEffect,sport,cutoff,sample:rows.length,from:rows[0].startsAt,to:rows.at(-1)!.startsAt,sourceHash,artifactHash,off,def,scales,predict,retrospective,limitations:['Experimental score-only scale mixture; no possession/pace data','Recent role/injury/rotation and complete rest schedule unavailable','Variance/tails are assumptions to test, not validated market probabilities',...(retrospective?['Historical source publication times not proven; previously inspected history']:[])]};
}
export function scoreArtifact(model:NonNullable<ReturnType<typeof fitScoreModel>>){const {predict,...artifact}=model;void predict;return structuredClone(artifact);}
export function restoreScoreArtifact(artifact:ReturnType<typeof scoreArtifact>):NonNullable<ReturnType<typeof fitScoreModel>>{
 if(digest(JSON.stringify(artifact.model))!==digest(JSON.stringify(SCORE_PROTOCOL))||![artifact.league,artifact.homeEffect,...Object.values(artifact.off),...Object.values(artifact.def),...Object.values(artifact.scales)].every(Number.isFinite)||!Number.isFinite(Date.parse(artifact.cutoff)))throw new Error('Invalid score artifact');
 const hash=digest(JSON.stringify({protocol:SCORE_PROTOCOL,sport:artifact.sport,cutoff:artifact.cutoff,sourceHash:artifact.sourceHash,league:artifact.league,homeEffect:artifact.homeEffect,off:artifact.off,def:artifact.def,scales:artifact.scales}));if(hash!==artifact.artifactHash)throw new Error('Score artifact hash mismatch');
 return {...structuredClone(artifact),predict:(h,a,baseline=false)=>({home:artifact.league+artifact.homeEffect+(baseline?0:(artifact.off[h]??0)+(artifact.def[a]??0)),away:artifact.league-artifact.homeEffect+(baseline?0:(artifact.off[a]??0)+(artifact.def[h]??0))})};
}
// Deterministic normal CDF approximation; discrete continuity correction is
// applied before the two-scale tail mixture. This is NOT Elo probability reuse.
const cdf=(z:number)=>{const a=Math.abs(z),t=1/(1+.2316419*a),d=.3989422804014327*Math.exp(-a*a/2),p=1-d*t*(.319381530+t*(-.356563782+t*(1.781477937+t*(-1.821255978+t*1.330274429))));return z<0?1-p:p;};
export function scoreLineProbability(mean:number,sd:number,threshold:number,side:'over'|'under'){
 if(![mean,sd,threshold].every(Number.isFinite)||sd<=0)throw new Error('Invalid score distribution');
 const distribution=(x:number)=>.9*cdf((x-mean)/sd)+.1*cdf((x-mean)/(sd*2)),push=Number.isInteger(threshold)?Math.max(0,distribution(threshold+.5)-distribution(threshold-.5)):0;
 const over=Math.max(0,Math.min(1,1-distribution(Math.floor(threshold)+.5))),under=Math.max(0,1-over-push);
 return {probability:side==='over'?over:under,pushProbability:push};
}
export function forecastScoreLine(model:NonNullable<ReturnType<typeof fitScoreModel>>,home:string,away:string,family:'spread'|'total',line:number,side:'home'|'away'|'over'|'under',baseline=false){
 if(!model.off[home]&&model.off[home]!==0||!model.off[away]&&model.off[away]!==0)return null;
 if(family==='spread'&&!['home','away'].includes(side)||family==='total'&&!['over','under'].includes(side))throw new Error('Market side mismatch');
 const p=model.predict(home,away,baseline),mean=family==='spread'?(side==='home'?p.home-p.away:p.away-p.home):p.home+p.away,sd=family==='spread'?(baseline?model.scales.baselineSpread:model.scales.spread):(baseline?model.scales.baselineTotal:model.scales.total),threshold=family==='spread'?-line:line;
 const calculate=(mu:number,sigma:number)=>{const p=scoreLineProbability(mu,sigma,threshold,side==='under'?'under':'over');if(family!=='spread')return p;const tie=scoreLineProbability(mu,sigma,0,'over').pushProbability;return {probability:(p.probability-(threshold<0?tie:0))/(1-tie),pushProbability:threshold===0?0:p.pushProbability/(1-tie)};};
 const result=calculate(mean,sd);
 const sensitivity=[calculate(mean-sd*.25,sd*1.15).probability,calculate(mean+sd*.25,sd*1.15).probability].sort((a,b)=>a-b);
 return {...result,sensitivity,artifactHash:model.artifactHash,inputCutoff:model.cutoff,registrationAllowed:false as const};
}
export function evaluateScoreModels(input:ScoreGame[]){
 const games=unique(input),scores:{fixtureId:string;date:string;season:number;family:'spread'|'total';line:number;probability:number;baseline:number;y:number;push:boolean;artifactHash:string;cutoff:string}[]=[];let model:ReturnType<typeof fitScoreModel>=null,day='',sport='';
 for(const g of games){if(g.startsAt.slice(0,10)!==day||g.sport!==sport){day=g.startsAt.slice(0,10);sport=g.sport;model=fitScoreModel(games,g.sport,day+'T00:00:00.000Z',true);}if(!model)continue;
  for(const family of ['spread','total'] as const)for(const line of family==='spread'?SCORE_PROTOCOL.spreadLines:SCORE_PROTOCOL.totalLines){const p=forecastScoreLine(model,g.home,g.away,family,line,family==='spread'?'home':'over'),b=forecastScoreLine(model,g.home,g.away,family,line,family==='spread'?'home':'over',true);if(!p||!b)continue;const value=family==='spread'?g.homeScore-g.awayScore+line:g.homeScore+g.awayScore-line;const push=value===0;scores.push({fixtureId:g.sport+':'+g.id,date:day,season:Number(day.slice(0,4)),family,line,probability:p.probability,baseline:b.probability,y:Number(value>0),push,artifactHash:model.artifactHash,cutoff:model.cutoff});}
 }
 const periods=[{name:'2023 development',from:2023,to:2023},{name:'2024 validation',from:2024,to:2024},{name:'2025 later test',from:2025,to:2025},{name:'2026 monitoring',from:2026,to:2026}];
 const summaries=periods.flatMap(period=>(['spread','total'] as const).map(family=>{const rows=scores.filter(r=>r.family===family&&r.season>=period.from&&r.season<=period.to&&!r.push),fixtureIds=[...new Set(rows.map(r=>r.fixtureId))];const metric=(key:'probability'|'baseline')=>{const values:ProbabilityRow[]=rows.map(r=>({p:r[key],y:r.y,date:r.date,season:r.season})),m=probabilityMetrics(values);if(!m)return null;return {...m,games:fixtureIds.length,thresholdObservations:rows.length,calibration:m.calibration.map(b=>({...b,sparse:true})),sampleWarning:'Correlated analysis lines; bucket counts are threshold observations, not independent games'};};return {period:period.name,family,fixtures:fixtureIds.length,eventDates:new Set(rows.map(r=>r.date)).size,pushes:scores.filter(r=>r.family===family&&r.season>=period.from&&r.season<=period.to&&r.push).length,model:metric('probability'),baseline:metric('baseline'),bookmaker:null};}));
 return {protocol:SCORE_PROTOCOL,uniqueEvents:new Set(scores.map(r=>r.fixtureId)).size,summaries,scores,registrationAllowed:false,limitations:['Retrospective chronological research on previously inspected history; no promotion','Predeclared analysis lines are NOT retained Sportsbet prices/markets','Pushes excluded from binary scoring, retained separately; no historical odds/EV/CLV','No validated NBL/player/tennis coverage is inferred']};
}
