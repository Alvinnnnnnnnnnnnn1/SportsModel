import { sha256 } from '@/lib/imports/duplicates';
import { evaluateTeamModel,ELO_ONLY_DEFINITION } from '../team-model';
import { usableTeamGames,type TeamGame } from '../team-games';
import { marginFeatureReplay,MARGIN_GRID,FEATURE_LAMBDAS,FEATURE_NAMES,featureProbability } from './models';
import { probabilityMetrics,fitLogistic,fitCalibration,calibratedProbability,pairedBlockInterval,type ProbabilityRow } from './statistics';
export const PREDICTION_PROTOCOL=Object.freeze({id:'nba-prediction-development-2',version:1,
 trainSeasons:[2022],tuningSeasons:[2023],calibrationSeasons:[2024],finalTestSeasons:[2025],monitorSeasons:[2026],
 selectionMetric:'Brier score on tuning seasons only',warmupGames:20,sameDateBlock:true,marginGrid:MARGIN_GRID,featureLambdas:FEATURE_LAMBDAS,
 calibration:'regularised monotone logistic; identity prior; slope [0.25,2]; probability [0.01,0.99]; earlier calibration season only',
 bootstrap:'400 paired seven-event-date moving blocks within season; seed20261112',
 previouslyInspectedHistory:true,prospectiveSlateUsedForTuning:false,productionActivation:false,
 unavailable:['possessions/pace/efficiency','attributable pre-event injury/roster/lineup evidence','historical publication timestamps','verified complete rest schedule in historical snapshots','historical bookmaker prices'],
});
export type PredictionModelKey='eloOnly'|'marginElo'|'features'|'challenger'|'winRate'|'eloCalibrated'|'marginCalibrated'|'featuresCalibrated';
export const PREDICTION_MODELS:{key:PredictionModelKey;name:string;version:string;status:string}[]=[
 {key:'eloOnly',name:'Frozen Elo-only',version:'candidate-1',status:'frozen reference; not activated'},
 {key:'marginElo',name:'Margin-adjusted Elo',version:'mov-1',status:'experimental'},
 {key:'features',name:'Feature-enhanced strength',version:'features-1',status:'experimental'},
 {key:'eloCalibrated',name:'Elo + logistic calibration',version:'elo-cal-1',status:'experimental calibration'},
 {key:'marginCalibrated',name:'Margin Elo + calibration',version:'mov-cal-1',status:'experimental calibration'},
 {key:'featuresCalibrated',name:'Features + calibration',version:'features-cal-1',status:'experimental calibration'},
 {key:'challenger',name:'Original form/rest challenger',version:'experimental-1',status:'not selected as baseline replacement'},
 {key:'winRate',name:'Smoothed historical win rate',version:'benchmark-1',status:'benchmark only'},
];
export interface DevelopmentScore {key:string;season:number;date:string;startsAt:string;home:string;away:string;y:number;probabilities:Record<PredictionModelKey,number>;}
const metricRows=(rows:DevelopmentScore[],key:PredictionModelKey):ProbabilityRow[]=>rows.map(r=>({p:r.probabilities[key],y:r.y,date:r.date,season:r.season}));
const scope=(rows:DevelopmentScore[])=>({games:rows.length,from:rows[0]?.startsAt??null,to:rows.at(-1)?.startsAt??null,uniqueDates:new Set(rows.map(r=>r.date)).size});
export async function evaluatePredictionDevelopment(rows:TeamGame[]){
 const data=usableTeamGames(rows,'9999-01-01T00:00:00Z',true);if(data.conflicts.length)throw new Error('Conflicting source results');
 const original=evaluateTeamModel(rows),reference=new Map(original.scores.map(r=>[r.key,r]));
 const belongs=(season:number,period:readonly number[])=>period.includes(season);
 const tune=MARGIN_GRID.map(parameters=>{const replay=marginFeatureReplay(rows,parameters);const sample=replay.scores.filter(r=>reference.has(r.key)&&belongs(r.season,PREDICTION_PROTOCOL.tuningSeasons));return {parameters,metrics:probabilityMetrics(sample.map(r=>({p:r.marginProbability,y:r.y,date:r.startsAt.slice(0,10),season:r.season})))!};});
 if(tune.some(t=>!t.metrics||t.metrics.games<500))throw new Error('Insufficient chronological tuning data');
 const selected=[...tune].sort((a,b)=>a.metrics.brier-b.metrics.brier)[0];
 const features=marginFeatureReplay(rows,selected.parameters).scores.filter(r=>reference.has(r.key));
 if(features.length!==reference.size)throw new Error('Models must evaluate identical fixtures');
 const training=features.filter(r=>belongs(r.season,PREDICTION_PROTOCOL.trainSeasons)),validation=features.filter(r=>belongs(r.season,PREDICTION_PROTOCOL.tuningSeasons));
 const trials=FEATURE_LAMBDAS.map(lambda=>{const weights=fitLogistic(training.map(r=>({x:r.x,y:r.y})),lambda);return {lambda,weights,metrics:probabilityMetrics(validation.map(r=>({p:featureProbability(r.x,weights),y:r.y,date:r.startsAt.slice(0,10),season:r.season})))!};});
 const winner=[...trials].sort((a,b)=>a.metrics.brier-b.metrics.brier)[0];
 // After tuning, refit only on train+tuning years. Calibration and final years never fit features.
 const fitting=features.filter(r=>belongs(r.season,[...PREDICTION_PROTOCOL.trainSeasons,...PREDICTION_PROTOCOL.tuningSeasons]));
 const coefficients=fitLogistic(fitting.map(r=>({x:r.x,y:r.y})),winner.lambda);
 const base=features.map(r=>{const old=reference.get(r.key)!;return {...r,date:r.startsAt.slice(0,10),eloOnly:old.eloOnly,challenger:old.challenger,winRate:old.historicalWinRate,featureP:featureProbability(r.x,coefficients)};});
 const calRows=base.filter(r=>belongs(r.season,PREDICTION_PROTOCOL.calibrationSeasons));
 const calibrators={eloOnly:fitCalibration(calRows.map(r=>({p:r.eloOnly,y:r.y,date:r.date,season:r.season}))),marginElo:fitCalibration(calRows.map(r=>({p:r.marginProbability,y:r.y,date:r.date,season:r.season}))),features:fitCalibration(calRows.map(r=>({p:r.featureP,y:r.y,date:r.date,season:r.season})))};
 const scores:DevelopmentScore[]=base.map(r=>({key:r.key,season:r.season,date:r.date,startsAt:r.startsAt,home:r.home,away:r.away,y:r.y,probabilities:{eloOnly:r.eloOnly,marginElo:r.marginProbability,features:r.featureP,challenger:r.challenger,winRate:r.winRate,eloCalibrated:calibratedProbability(r.eloOnly,calibrators.eloOnly),marginCalibrated:calibratedProbability(r.marginProbability,calibrators.marginElo),featuresCalibrated:calibratedProbability(r.featureP,calibrators.features)}}));
 const period=(seasons:readonly number[])=>scope(scores.filter(s=>belongs(s.season,seasons)));
 const summarise=(sample:DevelopmentScore[])=>({period:scope(sample),models:PREDICTION_MODELS.map(m=>{const values=metricRows(sample,m.key),metrics=probabilityMetrics(values),baseline=probabilityMetrics(metricRows(sample,'eloOnly'));return {...m,metrics,deltaBrierVsElo:metrics&&baseline?metrics.brier-baseline.brier:null,deltaLogLossVsElo:metrics&&baseline?metrics.logLoss-baseline.logLoss:null,
  uncertainty:pairedBlockInterval(values.map((v,i)=>({...v,baseline:sample[i].probabilities.eloOnly})))};})});
 const finalRows=scores.filter(r=>belongs(r.season,PREDICTION_PROTOCOL.finalTestSeasons)),monitorRows=scores.filter(r=>belongs(r.season,PREDICTION_PROTOCOL.monitorSeasons));
 const artifact={format:'edgelab.v6-prediction-artifact' as const,version:1,protocolHash:await sha256(JSON.stringify(PREDICTION_PROTOCOL)),sourceDatasetHash:await sha256(JSON.stringify(data.games)),
  baselineDefinitionHash:await sha256(JSON.stringify(ELO_ONLY_DEFINITION)),marginParameters:selected.parameters,featureNames:FEATURE_NAMES,coefficients,lambda:winner.lambda,calibrators,
  fitThrough:fitting.at(-1)!.startsAt,calibrationThrough:calRows.at(-1)!.startsAt,productionApproved:false as const};
 return {format:'edgelab.v6-model-development' as const,version:1,protocol:PREDICTION_PROTOCOL,artifact,artifactHash:await sha256(JSON.stringify(artifact)),
  dataset:{games:data.games.length,sourceHash:artifact.sourceDatasetHash,providers:[...new Set(data.games.map(g=>g.provider))],from:data.games[0]?.startsAt,to:data.games.at(-1)?.startsAt},
  periods:{training:period(PREDICTION_PROTOCOL.trainSeasons),tuning:period(PREDICTION_PROTOCOL.tuningSeasons),calibration:period(PREDICTION_PROTOCOL.calibrationSeasons),finalTest:period(PREDICTION_PROTOCOL.finalTestSeasons),monitoring:period(PREDICTION_PROTOCOL.monitorSeasons)},
  selection:{marginTrials:tune,selectedMargin:selected.parameters,featureTrials:trials,selectedLambda:winner.lambda},
  finalTest:summarise(finalRows),monitoring:summarise(monitorRows),
  perSeason:[...new Set(scores.map(r=>r.season))].sort().map(season=>({season,role:belongs(season,PREDICTION_PROTOCOL.trainSeasons)?'feature fitting; not out of sample':belongs(season,PREDICTION_PROTOCOL.tuningSeasons)?'tuning/refit; not final evaluation':belongs(season,PREDICTION_PROTOCOL.calibrationSeasons)?'calibration fitting; calibrated metrics are in sample':'later chronological evaluation; previously inspected history',...summarise(scores.filter(r=>r.season===season))})),
  scores,originalEvaluation:{games:original.heldOutGames,eloOnly:original.eloOnly,challenger:original.challenger},
  prospectivelyTestedNewModels:0,bookmakerRelativeBacktest:null,promoted:false,
  limitations:['Final/monitoring years were previously inspected by the old engine; this is not a pristine untouched holdout','Historical publication times unavailable; prior UTC-date results only, not a reconstructed live feed','No historical bookmaker odds; no historical market advantage or ROI claim','Models share outcomes/ratings; agreement is not independent evidence','No possessions, injury, roster or verified historical rest features','Calibration is fitted on 2024 only; its own fit-season scores are not validation','Multiple tuning trials increase selection uncertainty; only future frozen multi-slate evidence is genuinely new']};
}
export type ModelDevelopmentReport=Awaited<ReturnType<typeof evaluatePredictionDevelopment>>;
