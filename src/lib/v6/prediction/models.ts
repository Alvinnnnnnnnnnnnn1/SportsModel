import type { TeamGame } from '../team-games';
import { usableTeamGames,fixtureKey } from '../team-games';
import { clamp,dot,sigmoid } from './statistics';
export interface MarginParameters {k:number;homeCourt:number;seasonRetention:number;}
export const MARGIN_GRID:MarginParameters[]=[12,20,28].flatMap(k=>[40,60,80].flatMap(homeCourt=>[.5,.75].map(seasonRetention=>({k,homeCourt,seasonRetention}))));
export const FEATURE_NAMES=['intercept','marginEloDifference','opponentAdjustedLast5','opponentAdjustedLast10','shrunkSeasonStrength','shrunkVenueStrength','longerTerm60'] as const;
export const FEATURE_LAMBDAS=[.001,.01,.1,1];
export interface ResearchFeatures {key:string;season:number;startsAt:string;home:string;away:string;y:number; marginProbability:number;x:number[];lastInputDate:string|null;}
interface Team {rating:number;played:number;season:number|null;seasonMargins:number[];recent:number[];home:number[];away:number[];lastInputDate:string|null;}
const initial=():Team=>({rating:1500,played:0,season:null,seasonMargins:[],recent:[],home:[],away:[],lastInputDate:null});
const mean=(a:number[])=>a.length?a.reduce((n,v)=>n+v,0)/a.length:0;
const shrink=(a:number[],prior:number,weight:number)=>(a.reduce((n,v)=>n+v,0)+weight*prior)/(a.length+weight);
export const marginProbability=(home:number,away:number,homeCourt:number)=>1/(1+10**(-(home-away+homeCourt)/400));
/** EdgeLab's bounded MOV multiplier, not a claim to reproduce another publisher's model. */
export function marginMultiplier(margin:number,winnerAdvantage:number){
 if(!Number.isFinite(margin)||margin<=0||!Number.isFinite(winnerAdvantage))throw new Error('Invalid final margin');
 return clamp(Math.log1p(Math.min(margin,40))/Math.log(11)*2.2/(2.2+.001*clamp(winnerAdvantage,-600,600)),.5,2.5);
}
function regress(t:Team,season:number,p:MarginParameters){if(t.season!==season){if(t.season!==null)t.rating=1500+(t.rating-1500)*p.seasonRetention;t.season=season;t.seasonMargins=[];}}
function features(h:Team,a:Team){
 const longH=mean(h.recent),longA=mean(a.recent);
 return [1,(h.rating-a.rating)/400,(mean(h.recent.slice(-5))-mean(a.recent.slice(-5)))/20,(mean(h.recent.slice(-10))-mean(a.recent.slice(-10)))/20,
 (shrink(h.seasonMargins,longH,20)-shrink(a.seasonMargins,longA,20))/20,(shrink(h.home,longH,10)-shrink(a.away,longA,10))/20,(longH-longA)/20].map((n,i)=>i===0?n:clamp(n,-4,4));
}
function update(h:Team,a:Team,g:TeamGame,p:MarginParameters,homeRating:number,awayRating:number){
 const margin=g.homeScore!-g.awayScore!,y=Number(margin>0),advantage=homeRating-awayRating+p.homeCourt;
 const delta=p.k*marginMultiplier(Math.abs(margin),y?advantage:-advantage)*(y-marginProbability(homeRating,awayRating,p.homeCourt));h.rating+=delta;a.rating-=delta;
 // Each opponent's strength is the rating BEFORE this date block, never the updated winner.
 const homeMargin=clamp(margin,-40,40)-p.homeCourt/25+(awayRating-1500)/25,awayMargin=clamp(-margin,-40,40)+p.homeCourt/25+(homeRating-1500)/25;
 for(const [t,m,venue]of [[h,homeMargin,'home'],[a,awayMargin,'away']] as const){t.played++;t.seasonMargins.push(m);t.recent=[...t.recent,m].slice(-60);t[venue]=[...t[venue],m].slice(-30);t.lastInputDate=g.startsAt!.slice(0,10);}
}
export function marginFeatureReplay(rows:TeamGame[],parameters:MarginParameters){
 if(!MARGIN_GRID.some(p=>JSON.stringify(p)===JSON.stringify(parameters)))throw new Error('Unreviewed margin parameters');
 const usable=usableTeamGames(rows,'9999-01-01T00:00:00Z',true);if(usable.conflicts.length)throw new Error('Conflicting final results');
 const teams=new Map<string,Team>(),scores:ResearchFeatures[]=[];
 for(const block of Map.groupBy(usable.games,g=>g.startsAt!.slice(0,10)).values()){
  for(const g of block)for(const name of [g.home.name,g.away.name]){const t=teams.get(name)??initial();regress(t,g.season!,parameters);teams.set(name,t);}
  const before=new Map([...teams].map(([name,t])=>[name,t.rating]));
  for(const g of block){const h=teams.get(g.home.name)!,a=teams.get(g.away.name)!;if(h.played>=20&&a.played>=20)scores.push({key:fixtureKey(g)!,season:g.season!,startsAt:g.startsAt!,home:g.home.name,away:g.away.name,y:Number(g.homeScore!>g.awayScore!),marginProbability:marginProbability(h.rating,a.rating,parameters.homeCourt),x:features(h,a),lastInputDate:[h.lastInputDate,a.lastInputDate].filter((x):x is string=>x!==null).sort().at(-1)??null});}
  for(const g of block)update(teams.get(g.home.name)!,teams.get(g.away.name)!,g,parameters,before.get(g.home.name)!,before.get(g.away.name)!);
 }
 return {scores,teams,featureSnapshot:(home:string,away:string,season:number)=>{const h=teams.get(home),a=teams.get(away);if(!h||!a||h.played<20||a.played<20)return null;regress(h,season,parameters);regress(a,season,parameters);return {x:features(h,a),marginProbability:marginProbability(h.rating,a.rating,parameters.homeCourt),lastInputDate:[h.lastInputDate,a.lastInputDate].filter((x):x is string=>x!==null).sort().at(-1)??null};}};
}
export const featureProbability=(x:number[],weights:number[])=>clamp(sigmoid(dot(x,weights)),.01,.99);
