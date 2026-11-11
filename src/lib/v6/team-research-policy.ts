import type { Forecast,Observation } from './types';
/** Prospective research-quality rules, separate from uncapped notional accounting. */
export const TEAM_RESEARCH_POLICY=Object.freeze({id:'nba-moneyline-two-pass-1',version:1,minWinProbability:.55,minExpectedValue:.02,
 maxModelEloDisagreement:.08,maxModelMarketDisagreement:.15,sensitivityRetention:.8,minimumHeldOutGames:500,
 tracks:['high_probability','potential_value','alternative_markets','exploratory'],modelActivationRequired:true});
export function teamResearchChecks(o:Observation,f:Forecast){
 const t=f.inputs.team,reasons:string[]=[];if(!t)return ['team_research_policy_evidence_missing'];
 if(t.researchPolicyId!==TEAM_RESEARCH_POLICY.id||t.homeOdds===undefined||t.awayOdds===undefined)return ['team_research_policy_evidence_missing'];
 const selectedHome=o.market.subjectId===t.homeId,original=selectedHome?t.homeOdds:t.awayOdds;
 if(original!==o.odds)reasons.push('team_original_price_mismatch');
 const homeBase=(1/t.homeOdds)/(1/t.homeOdds+1/t.awayOdds),marketBase=selectedHome?homeBase:1-homeBase;
 const eloHome=1/(1+10**(-(t.homeRating-t.awayRating+60)/400)),elo=selectedHome?eloHome:1-eloHome;
 if(f.probability<TEAM_RESEARCH_POLICY.minWinProbability)reasons.push('win_likelihood_below_frozen_threshold');
 if(Math.abs(f.probability-elo)>TEAM_RESEARCH_POLICY.maxModelEloDisagreement)reasons.push('model_baseline_disagreement');
 if(Math.abs(f.probability-marketBase)>TEAM_RESEARCH_POLICY.maxModelMarketDisagreement)reasons.push('large_market_disagreement_requires_review');
 if((.5+(f.probability-.5)*TEAM_RESEARCH_POLICY.sensitivityRetention)*o.odds-1<TEAM_RESEARCH_POLICY.minExpectedValue)reasons.push('sensitivity_ev_failed');
 return reasons;
}
