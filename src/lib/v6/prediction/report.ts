import {z} from 'zod';
import type {ModelDevelopmentReport} from './evaluation';
const stamp=z.string().datetime({offset:true}).nullable(),count=z.number().int().nonnegative(),hash=z.string().regex(/^[a-f0-9]{64}$/);
export const predictionMetricSchema=z.object({games:count,brier:z.number().min(0).max(1),logLoss:z.number().finite().nonnegative(),ece:z.number().min(0).max(1),calibration:z.array(z.object({lower:z.number().min(0).max(.9),count,meanProbability:z.number().min(0).max(1).nullable(),observedRate:z.number().min(0).max(1).nullable(),sparse:z.boolean()})).length(10)});
const period=z.object({games:count,from:stamp,to:stamp,uniqueDates:count});
const interval=z.object({method:z.string().max(150),replicates:count,seed:z.number().int(),brier:z.tuple([z.number().finite(),z.number().finite()]),logLoss:z.tuple([z.number().finite(),z.number().finite()]),limitations:z.string().max(250)}).nullable();
const model=z.object({key:z.enum(['eloOnly','marginElo','features','challenger','winRate','eloCalibrated','marginCalibrated','featuresCalibrated']),name:z.string().max(100),version:z.string().max(100),status:z.string().max(100),metrics:predictionMetricSchema.nullable(),deltaBrierVsElo:z.number().finite().nullable(),deltaLogLossVsElo:z.number().finite().nullable(),uncertainty:interval});
const comparison=z.object({period,models:z.array(model).max(8)});
export const modelDevelopmentSummarySchema=z.object({protocolHash:hash,artifactHash:hash,datasetGames:count,datasetHash:hash,
 periods:z.object({training:period,tuning:period,calibration:period,finalTest:period,monitoring:period}),selectedMargin:z.object({k:z.number(),homeCourt:z.number(),seasonRetention:z.number()}),selectedLambda:z.number(),marginTrialCount:count,featureTrialCount:count,
 finalTest:comparison,monitoring:comparison,perSeason:z.array(comparison.extend({season:z.number().int(),role:z.string().max(200)})).max(20),limitations:z.array(z.string().max(300)),prospectivelyTestedNewModels:z.literal(0),promoted:z.literal(false)});
export type ModelDevelopmentSummary=z.infer<typeof modelDevelopmentSummarySchema>;
export function developmentSummary(report:ModelDevelopmentReport):ModelDevelopmentSummary{
 return modelDevelopmentSummarySchema.parse({protocolHash:report.artifact.protocolHash,artifactHash:report.artifactHash,datasetGames:report.dataset.games,datasetHash:report.dataset.sourceHash,periods:report.periods,
 selectedMargin:report.selection.selectedMargin,selectedLambda:report.selection.selectedLambda,marginTrialCount:report.selection.marginTrials.length,featureTrialCount:report.selection.featureTrials.length,finalTest:report.finalTest,monitoring:report.monitoring,perSeason:report.perSeason,limitations:report.limitations,prospectivelyTestedNewModels:report.prospectivelyTestedNewModels,promoted:report.promoted});
}

export const model2ProspectiveSummarySchema=z.object({from:stamp.optional(),to:stamp.optional(),fixtures:count,slates:count,models:z.array(z.object({key:z.string().max(100),name:z.string().max(100),version:z.string().max(100),status:z.string().max(100),artifactHash:hash,metrics:predictionMetricSchema.nullable(),versusBookmaker:interval,smallSlateWarning:z.boolean()})),positions:z.literal(0)});
export type Model2ProspectiveSummary=z.infer<typeof model2ProspectiveSummarySchema>;
