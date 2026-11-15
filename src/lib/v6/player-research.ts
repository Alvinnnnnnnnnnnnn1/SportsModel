import {nbaPointsForecast,nbaGameLogSchema,type NbaGameLog} from './nba-points';
/** Reuses the minutes-mixture/Gamma-Poisson prototype. Conditional on playing:
 * unavailable injury/DNP probabilities and role changes are never imputed. */
export async function playerResearchAudit(logs:NbaGameLog[],playerId:string,eventStartsAt:string,cutoff:string,calculatedAt=new Date().toISOString()){
 const checked=logs.map(g=>nbaGameLogSchema.parse(g)),current=checked.filter(g=>g.playerId===playerId&&Date.parse(g.startsAt)<Date.parse(cutoff)),latest=current.map(g=>g.startsAt).sort().at(-1)??null;
 const fitted=await nbaPointsForecast(checked,{playerId,eventStartsAt,cutoff,calculatedAt});
 return {model:fitted.model,status:fitted.status,latestGameAt:latest,sourcePlayerGames:current.length,usableMinutesGames:current.filter(g=>g.minutes!==null&&g.minutes>0&&g.participated===true).length,conditionalOnPlaying:true,dnpProbability:null,injuryEvidence:null,roleChangeEvidence:null,registrationAllowed:false as const,reasons:[...(fitted.reason?[fitted.reason]:[]),'No current permitted complete player-stat/injury source','BDL Free games/teams do not provide game player stats or injuries','Historical API-NBA rows are not current features','Identity, conditional-DNP/role coverage and prospective validation required'],forecast:fitted.forecast};
}
