import { sha256 } from '@/lib/imports/duplicates';
import { poissonCountProbability, poissonPushProbability } from '@/lib/v6/models';
import { positionHash } from '@/lib/v6/engine';
import type { Observation, Forecast, PaperPosition, Grade } from '@/lib/v6/types';
export const now='2026-11-11T00:00:00.000Z';
export function observation(index=1):Observation {
  return {id:crypto.randomUUID(),sourceClass:'synthetic',provider:'SYNTHETIC LOCAL ONLY',permissionReference:'https://example.invalid/local-test',bookmaker:'SYNTHETIC LOCAL BOOK',
    market:{sport:'NBA',eventId:'SYNTHETIC-LOCAL-event',subjectId:`SYNTHETIC-LOCAL-player-${index}`,statistic:'points',operator:'gte',threshold:21,period:'full_game',periodNumber:null,overtime:'included',termsVersion:'SYNTHETIC-terms-1'},
    eventStartsAt:'2026-11-11T01:00:00.000Z',odds:1.9,observedAt:now,retrievedAt:now,sourceUpdatedAt:now,sourceUrl:'https://example.invalid/local-quote',rawHash:'a'.repeat(64),status:'prematch_open'};
}
export async function forecast(o:Observation):Promise<Forecast> {
  const inputs={minutes:30,ratePerMinute:1,surface:null,rating:null,opponentRating:null,sampleSize:200,sourceObservedAt:'2026-11-10T23:00:00.000Z',sourceUrl:'https://example.invalid/local-model-inputs'};
  return {market:structuredClone(o.market),probability:poissonCountProbability(o.market,30,1),pushProbability:poissonPushProbability(o.market,30,1),modelId:'SYNTHETIC-LOCAL-model',version:'test-v1',method:'poisson_minutes_rate',validation:'out_of_sample_validated',generatedAt:now,inputCutoff:now,inputsHash:await sha256(JSON.stringify(inputs)),evidenceUrls:['https://example.invalid/local-input'],inputs};
}
export async function grade(p:PaperPosition,outcome:Grade['outcome']='won'):Promise<Grade> {
  return {id:crypto.randomUUID(),positionId:p.id,positionHash:await positionHash(p),revision:1,previousGradeId:null,recordedAt:'2026-11-11T04:00:00.000Z',outcome,sourceClass:'synthetic',sourceUrl:'https://example.invalid/local-final',sourceHash:'b'.repeat(64),eventId:p.observation.market.eventId,subjectId:p.observation.market.subjectId,termsVersion:p.observation.market.termsVersion,market:structuredClone(p.observation.market),winnerId:null,final:true,publishedAt:'2026-11-11T03:00:00.000Z',observedValue:outcome==='won'?25:outcome==='lost'?10:null,exception:'none'};
}
