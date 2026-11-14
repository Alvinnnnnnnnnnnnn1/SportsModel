import {z} from 'zod';
import {usableTeamGames,type TeamGame} from '../team-games';
import {forecastTeamGame} from '../team-model';
import {TEAM_RESEARCH_POLICY} from '../team-research-policy';
import {PREDICTION_MODELS,PREDICTION_PROTOCOL,type PredictionModelKey} from './evaluation';
import {MARGIN_GRID,FEATURE_NAMES,marginFeatureReplay,featureProbability,marginProbability} from './models';
import {calibratedProbability} from './statistics';
const hash=z.string().regex(/^[a-f0-9]{64}$/),stamp=z.string().datetime({offset:true});
export const predictionArtifactSchema=z.object({format:z.literal('edgelab.v6-prediction-artifact'),version:z.literal(1),protocolHash:hash,sourceDatasetHash:hash,baselineDefinitionHash:hash,
 marginParameters:z.object({k:z.number(),homeCourt:z.number(),seasonRetention:z.number()}).strict().refine(p=>MARGIN_GRID.some(g=>JSON.stringify(g)===JSON.stringify(p))),
 featureNames:z.tuple([z.literal('intercept'),z.literal('marginEloDifference'),z.literal('opponentAdjustedLast5'),z.literal('opponentAdjustedLast10'),z.literal('shrunkSeasonStrength'),z.literal('shrunkVenueStrength'),z.literal('longerTerm60')]),
 coefficients:z.array(z.number().finite()).length(FEATURE_NAMES.length),lambda:z.number().positive(),
 calibrators:z.object({eloOnly:z.array(z.number().finite()).length(2),marginElo:z.array(z.number().finite()).length(2),features:z.array(z.number().finite()).length(2)}).strict(),
 fitThrough:stamp,calibrationThrough:stamp,productionApproved:z.literal(false)}).strict();
export type PredictionArtifact=z.infer<typeof predictionArtifactSchema>;
export async function forecastDevelopmentModels(rows:TeamGame[],artifact:PredictionArtifact,input:{home:string;away:string;season:number;startsAt:string;at:string;completeRegularSeasons:number[]}){
 predictionArtifactSchema.parse(artifact);stamp.parse(input.at);stamp.parse(input.startsAt);
 if(Date.parse(input.at)>=Date.parse(input.startsAt)-60000||Date.parse(artifact.calibrationThrough)>=Date.parse(input.at)||input.home===input.away)throw new Error('Model 2 requires genuine future fixtures and earlier calibration');
 // Reuse the same date-block policy as evaluation, plus actual retained availability for live use.
 const history=usableTeamGames(rows,input.at,false).games.filter(g=>g.startsAt!.slice(0,10)<input.at.slice(0,10));
 const baseline=await forecastTeamGame([...history,...rows.filter(g=>!g.final&&Date.parse(g.retrievedAt)<=Date.parse(input.at))],input);if(!baseline.forecast)return {probabilities:null,reasons:baseline.reasons,features:null,history};
 const replay=marginFeatureReplay(history,artifact.marginParameters),features=replay.featureSnapshot(input.home,input.away,input.season);
 if(!features||[input.home,input.away].some(name=>{const d=replay.teams.get(name)?.lastInputDate;return !d||Date.parse(input.at)-Date.parse(d)>21*86400000;}))return {probabilities:null,reasons:['team_inputs_stale_or_insufficient'],features:null,history};
 const eloOnly=baseline.forecast.eloOnlyHome,marginElo=features.marginProbability,featureP=featureProbability(features.x,artifact.coefficients);
 const probabilities:Record<PredictionModelKey,number>={eloOnly,marginElo,features:featureP,challenger:baseline.forecast.probabilityHome,winRate:baseline.forecast.historicalWinRateHome,
  eloCalibrated:calibratedProbability(eloOnly,artifact.calibrators.eloOnly),marginCalibrated:calibratedProbability(marginElo,artifact.calibrators.marginElo),featuresCalibrated:calibratedProbability(featureP,artifact.calibrators.features)};
 const h=replay.teams.get(input.home)!,a=replay.teams.get(input.away)!;
 const noRecent=[...features.x];noRecent[2]=0;noRecent[3]=0;
 return {probabilities,reasons:['experimental_shadow_only','injury_roster_information_unavailable','model_agreement_is_correlated'],features:{...features,homeGames:h.played,awayGames:a.played,homeRating:h.rating,awayRating:a.rating,
  sensitivity:{marginHomeCourtMinus20:marginProbability(h.rating,a.rating,artifact.marginParameters.homeCourt-20),marginHomeCourtPlus20:marginProbability(h.rating,a.rating,artifact.marginParameters.homeCourt+20),featuresWithoutRecentForm:featureProbability(noRecent,artifact.coefficients)},protocolId:PREDICTION_PROTOCOL.id,featureNames:FEATURE_NAMES},history};
}
/** Numerical pre-event RESEARCH with current available finals. Unfinished
 * fixtures remain explicit uncertainty and forbid registration. This does not
 * change the strict forecast/worker path or manufacture their future outcomes. */
export async function forecastResearchModels(rows:TeamGame[],artifact:PredictionArtifact,input:Parameters<typeof forecastDevelopmentModels>[2]){
 const pending=rows.filter(g=>!g.final&&g.startsAt&&Date.parse(g.retrievedAt)<=Date.parse(input.at)&&Date.parse(g.startsAt)<Date.parse(input.startsAt)&&[g.home.name,g.away.name].some(n=>[input.home,input.away].includes(n)));
 let result=await forecastDevelopmentModels(rows,artifact,input);
 if(!result.probabilities&&result.reasons.includes('intervening_unfinished_fixture'))result=await forecastDevelopmentModels(rows.filter(g=>g.final),artifact,input);
 return {...result,registrationAllowed:false as const,provisional:pending.length>0,pendingFixtureIds:pending.map(g=>g.sourceGameId),reasons:[...result.reasons,...(pending.length?['unresolved_intervening_fixture_research_only']:[])]};
}
/** Uses the unchanged production-quality thresholds descriptively; never authorises a position. */
export function researchTwoPass(input:{probability:number|null;odds:number;marketProbability:number;baseline:number|null;sourceReasons:string[];adverseProbability?:number}){
 z.object({probability:z.number().min(0).max(1).nullable(),odds:z.number().min(1.0001).max(10000),marketProbability:z.number().min(0).max(1),baseline:z.number().min(0).max(1).nullable(),sourceReasons:z.array(z.string()),adverseProbability:z.number().min(0).max(1).optional()}).parse(input);
 const p=input.probability,first=[...input.sourceReasons];if(p===null)first.push('independent_forecast_unavailable');
 const second:string[]=[],ev=p===null?null:p*input.odds-1,stressed=p===null?null:Math.min(.5+(p-.5)*TEAM_RESEARCH_POLICY.sensitivityRetention,input.adverseProbability??p),stressedEV=stressed===null?null:stressed*input.odds-1;
 if(p!==null&&p<TEAM_RESEARCH_POLICY.minWinProbability)second.push('win_likelihood_below_frozen_threshold');
 if(ev!==null&&ev<TEAM_RESEARCH_POLICY.minExpectedValue)second.push('insufficient_expected_value');
 if(p!==null&&Math.abs(p-input.marketProbability)>TEAM_RESEARCH_POLICY.maxModelMarketDisagreement)second.push('large_market_disagreement_requires_review');
 if(p!==null&&input.baseline!==null&&Math.abs(p-input.baseline)>TEAM_RESEARCH_POLICY.maxModelEloDisagreement)second.push('model_baseline_disagreement');
 if(stressedEV!==null&&stressedEV<TEAM_RESEARCH_POLICY.minExpectedValue)second.push('adverse_sensitivity_ev_failed');
 return {pass1:first,pass2:second,probability:p,breakEven:1/input.odds,marketProbability:input.marketProbability,estimatedEV:ev,adverseProbability:stressed,adverseEV:stressedEV,
  mostLikely:p!==null&&p>.5,potentialPriceValue:ev!==null&&ev>=.02,classification:first.length?'insufficient_evidence':'experimental_research',researchDecision:first.length||second.length?'excluded':'passes_research_screen',stronglySupported:false,registrationAllowed:false,registrationExclusions:['experimental_model_and_standing_policy_not_activated']};
}
export {PREDICTION_MODELS};
