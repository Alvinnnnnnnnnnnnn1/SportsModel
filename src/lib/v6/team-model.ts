import { sha256 } from '@/lib/imports/duplicates';
import { usableTeamGames,type TeamGame,fixtureKey } from './team-games';
/** Frozen before evaluation. All challengers remain experimental until a
 * separately reviewed out-of-sample manifest and standing activation exist. */
export const TEAM_MODEL=Object.freeze({id:'nba-team-elo-form-rest',version:'experimental-1',initialRating:1500,k:20,homeCourt:60,seasonRetention:.75,
 formGames:5,formEloScale:80,backToBackPenalty:20,minTeamGames:20,maxFeatureAgeDays:21,probabilityShrinkage:.05});
interface Strength {rating:number;played:number;wins:number;residuals:number[];lastStart:string|null;season:number|null;}
const initial=():Strength=>({rating:1500,played:0,wins:0,residuals:[],lastStart:null,season:null});
const logistic=(delta:number)=>1/(1+10**(-delta/400));
function regress(s:Strength,season:number){if(s.season!==null&&s.season!==season)s.rating=1500+(s.rating-1500)*TEAM_MODEL.seasonRetention;s.season=season;}
function snapshot(home:Strength,away:Strength,startsAt:string,restSupported:boolean){
 const rest=(s:Strength)=>restSupported&&s.lastStart?Math.max(0,(Date.parse(startsAt)-Date.parse(s.lastStart))/3600000):null;
 const homeRestHours=rest(home),awayRestHours=rest(away);
 const recent=(s:Strength)=>s.residuals.length?s.residuals.reduce((n,v)=>n+v,0)/s.residuals.length:0;
 const formAdjustment=TEAM_MODEL.formEloScale*(recent(home)-recent(away));
 const restAdjustment=(homeRestHours!==null&&homeRestHours<30?-TEAM_MODEL.backToBackPenalty:0)-(awayRestHours!==null&&awayRestHours<30?-TEAM_MODEL.backToBackPenalty:0);
 const delta=home.rating-away.rating+TEAM_MODEL.homeCourt;
 return {homeRating:home.rating,awayRating:away.rating,homeGames:home.played,awayGames:away.played,homeRestHours,awayRestHours,formAdjustment,restAdjustment,
  eloOnly:logistic(delta),challenger:(1-TEAM_MODEL.probabilityShrinkage)*logistic(delta+formAdjustment+restAdjustment)+TEAM_MODEL.probabilityShrinkage*.5,
  historicalWinRate:((home.wins+1)/(home.played+2)+1-(away.wins+1)/(away.played+2))/2};
}
function update(home:Strength,away:Strength,g:TeamGame,p:number){
 const y=Number(g.homeScore!>g.awayScore!),change=TEAM_MODEL.k*(y-p);home.rating+=change;away.rating-=change;
 home.played++;away.played++;home.wins+=y;away.wins+=1-y;
 home.residuals=[...home.residuals,y-p].slice(-TEAM_MODEL.formGames);away.residuals=[...away.residuals,p-y].slice(-TEAM_MODEL.formGames);home.lastStart=g.startsAt;away.lastStart=g.startsAt;
}
function build(rows:TeamGame[],cutoff:string,retrospective:boolean){
 const usable=usableTeamGames(rows,cutoff,retrospective),teams=new Map<string,Strength>();
 for(const g of usable.games){const home=teams.get(g.home.name)??initial(),away=teams.get(g.away.name)??initial();regress(home,g.season!);regress(away,g.season!);
  const p=logistic(home.rating-away.rating+TEAM_MODEL.homeCourt);update(home,away,g,p);teams.set(g.home.name,home);teams.set(g.away.name,away);}
 return {...usable,teams};
}
export async function forecastTeamGame(rows:TeamGame[],input:{home:string;away:string;season:number;startsAt:string;at:string;completeRegularSeasons:number[]}){
 if(!Number.isFinite(Date.parse(input.at))||!Number.isFinite(Date.parse(input.startsAt))||Date.parse(input.at)>=Date.parse(input.startsAt)||input.home===input.away)throw new Error('Team forecast must be created for distinct teams before start');
 const fitted=build(rows,input.at,false),home=fitted.teams.get(input.home),away=fitted.teams.get(input.away),reasons:string[]=[];
 if(fitted.conflicts.length)reasons.push('conflicting_training_results');
 if(!home||!away||home.played<TEAM_MODEL.minTeamGames||away.played<TEAM_MODEL.minTeamGames)reasons.push('insufficient_team_games');
 if([home,away].some(t=>!t?.lastStart||Date.parse(input.at)-Date.parse(t.lastStart)>TEAM_MODEL.maxFeatureAgeDays*86400000))reasons.push('team_features_stale_or_missing');
 const restSupported=input.completeRegularSeasons.includes(input.season);if(!restSupported)reasons.push('current_schedule_completeness_unverified');
 if(rows.some(g=>!g.final&&g.startsAt&&Date.parse(g.startsAt)>Date.parse(input.at)&&Date.parse(g.startsAt)<Date.parse(input.startsAt)&&[g.home.name,g.away.name].some(t=>[input.home,input.away].includes(t))))reasons.push('intervening_unfinished_fixture');
 if(reasons.length)return {status:'insufficient' as const,reasons,probability:null,forecast:null};
 regress(home!,input.season);regress(away!,input.season);
 const features=snapshot(home!,away!,input.startsAt,restSupported),historyHash=await sha256(JSON.stringify(fitted.games)),inputs={model:TEAM_MODEL,fixture:{home:input.home,away:input.away,season:input.season,startsAt:input.startsAt},cutoff:input.at,completeRegularSeasons:input.completeRegularSeasons,
  historyHash,features,injuryRosterEvidence:null};
 return {status:'experimental' as const,reasons:['injury_roster_information_unavailable','model_not_activated'],probability:features.challenger,
  historySnapshot:fitted.games,forecast:{model:TEAM_MODEL,generatedAt:input.at,inputCutoff:input.at,inputs,inputsHash:await sha256(JSON.stringify(inputs)),probabilityHome:features.challenger,probabilityAway:1-features.challenger,
   eloOnlyHome:features.eloOnly,historicalWinRateHome:features.historicalWinRate,sampleSize:fitted.games.length,evidenceTier:'team_results_only',validation:'experimental'}};
}
/** Time ordered, one binary home-win label per game; never two independent labels
 * for both market sides. Post-target games cannot update the target prediction.
 */
export function evaluateTeamModel(rows:TeamGame[]){
 const usable=usableTeamGames(rows,'9999-01-01T00:00:00.000Z',true),teams=new Map<string,Strength>();
 const scores:{key:string;season:number;startsAt:string;home:string;away:string;y:number;challenger:number;eloOnly:number;historicalWinRate:number;sourceHashes:string[]}[]=[];
 // Games on the same UTC date are evaluated as one block: without archived end
 // times, an earlier listed start does not prove its result was available later.
 const days=Map.groupBy(usable.games,g=>g.startsAt!.slice(0,10));
 for(const games of days.values()){
  for(const g of games){const h=teams.get(g.home.name)??initial(),a=teams.get(g.away.name)??initial();regress(h,g.season!);regress(a,g.season!);teams.set(g.home.name,h);teams.set(g.away.name,a);
   if(h.played>=TEAM_MODEL.minTeamGames&&a.played>=TEAM_MODEL.minTeamGames){const s=snapshot(h,a,g.startsAt!,false);scores.push({key:fixtureKey(g)!,season:g.season!,startsAt:g.startsAt!,home:g.home.name,away:g.away.name,y:Number(g.homeScore!>g.awayScore!),challenger:s.challenger,eloOnly:s.eloOnly,historicalWinRate:s.historicalWinRate,sourceHashes:[g.rawHash]});}}
  for(const g of games){const h=teams.get(g.home.name)!,a=teams.get(g.away.name)!;update(h,a,g,logistic(h.rating-a.rating+TEAM_MODEL.homeCourt));}
 }
 const metrics=(key:'challenger'|'eloOnly'|'historicalWinRate',sample=scores)=>{
  if(!sample.length)return null;
  const calibration=Array.from({length:10},(_,i)=>{const bin=sample.filter(s=>Math.min(9,Math.floor(s[key]*10))===i);return {lower:i/10,count:bin.length,meanProbability:bin.length?bin.reduce((n,s)=>n+s[key],0)/bin.length:null,observedRate:bin.length?bin.reduce((n,s)=>n+s.y,0)/bin.length:null};});
  return {brier:sample.reduce((n,s)=>n+(s[key]-s.y)**2,0)/sample.length,logLoss:sample.reduce((n,s)=>{const p=Math.min(1-1e-12,Math.max(1e-12,s[key]));return n-s.y*Math.log(p)-(1-s.y)*Math.log(1-p);},0)/sample.length,calibration};
 };
 const clusters=[...Map.groupBy(scores,s=>s.startsAt.slice(0,10)).values()],deltas:number[]=[];let seed=20261111;
 if(clusters.length>1)for(let replicate=0;replicate<250;replicate++){let delta=0,count=0;for(let i=0;i<clusters.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const selected=clusters[seed%clusters.length];for(const s of selected){delta+=(s.challenger-s.y)**2-(s.eloOnly-s.y)**2;count++;}}deltas.push(delta/count);}
 deltas.sort((a,b)=>a-b);
 return {model:TEAM_MODEL,classification:'retrospective_chronological_team_research',publicationHistoryVerified:false,restEffectsEvaluated:false,
  games:usable.games.length,teams:teams.size,conflicts:usable.conflicts,heldOutGames:scores.length,uniqueDates:days.size,challenger:metrics('challenger'),eloOnly:metrics('eloOnly'),historicalWinRate:metrics('historicalWinRate'),scores,
  seasonMetrics:[...new Set(scores.map(s=>s.season))].sort().map(season=>{const sample=scores.filter(s=>s.season===season);return {season,games:sample.length,challenger:metrics('challenger',sample),eloOnly:metrics('eloOnly',sample),historicalWinRate:metrics('historicalWinRate',sample)};}),
  uncertainty:{method:'UTC-date cluster bootstrap; same teams remain dependent across dates',replicates:250,seed:20261111,challengerMinusEloBrier95:deltas.length?[deltas[Math.floor(deltas.length*.025)],deltas[Math.floor(deltas.length*.975)]]:null},
  promoted:false,bookmakerBaseline:null,limitations:['No archived historical odds','Original result publication times unavailable','No current injury or roster evidence','Repeated teams remain dependent beyond date clusters','Rest effect not validated on incomplete historical schedule']};
}
