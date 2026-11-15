export const MARKET_FAMILIES=['moneyline','spread','total','player_points','player_rebounds','player_assists','player_threes','PRA','PR','PA','RA','match_winner','set_handicap','set_total','game_handicap','game_total'] as const;
export type MarketFamily=typeof MARKET_FAMILIES[number];
export type ResearchSport='NBA'|'NBL'|'ATP'|'WTA';
export interface MarketCapability {sport:ResearchSport;family:MarketFamily;source:'retained'|'not_retained';retainedQuotes:number;model:'experimental'|'prototype'|'unavailable';validation:'historical_research_only'|'unavailable';grading:'independent_result_reconciliation'|'rules_only'|'exact_provider_adapter'|'unavailable';registration:'not_authorised';reasons:string[];}
/** Capability is multidimensional. Provider documentation is not evidence of
 * Sportsbet coverage, model validation or standing registration authority. */
export function marketCapabilities(counts:Partial<Record<string,number>>={}):MarketCapability[]{
 return (['NBA','NBL','ATP','WTA'] as const).flatMap(sport=>(sport==='NBA'||sport==='NBL'?MARKET_FAMILIES.slice(0,11):MARKET_FAMILIES.slice(11)).map(family=>{
  const count=counts[sport+':'+family]??0,team=['moneyline','spread','total'].includes(family),nba=sport==='NBA';
  return {sport,family,source:count?'retained' as const:'not_retained' as const,retainedQuotes:count,model:nba&&team?'experimental' as const:nba&&family==='player_points'?'prototype' as const:'unavailable' as const,validation:nba&&team?'historical_research_only' as const:'unavailable' as const,grading:nba&&family==='player_points'?'exact_provider_adapter' as const:nba&&team?'independent_result_reconciliation' as const:team?'rules_only' as const:'unavailable' as const,registration:'not_authorised' as const,reasons:[...(!count?['No retained attributable Sportsbet quote for this family']:[]),...(!nba||!team?['Current permitted features/model validation incomplete']:[]),'No active market-specific PAPER authority']};
 }));
}
