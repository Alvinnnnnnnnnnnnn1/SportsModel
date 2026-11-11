import type { RawEvidence } from './evidence.server';
import type { IdentityRevision } from './identity-registry.server';
import type { PaperPosition,Grade } from './types';
import { gradeCount,positionHash } from './engine';
import { nbaPlayerLogs } from './nba-source';
import { sha256 } from '@/lib/imports/duplicates';

export interface NbaRules {version:string;hash:string;approvedAt:string;fullGameOvertime:true;dnpVoid:boolean;}
/** Official-provider results become a grade only after exact identity and supported terms.
 * No source-issued publication clock is invented from game completion/retrieval.
 */
export async function nbaGradeProposal(p:PaperPosition,m:IdentityRevision,games:RawEvidence,box:RawEvidence,rules:NbaRules,at:string,previous:Grade|null=null) {
  const fail=(reason:string)=>({status:'unresolved' as const,reason,grade:null});
  if(m.status!=='verified'||m.internalFixtureId!==p.observation.market.eventId||m.internalPlayerId!==p.observation.market.subjectId
    ||Date.parse(m.eventStartsAt)!==Date.parse(p.observation.eventStartsAt)||m.line!==p.observation.market.threshold
    ||(m.side==='Over'?p.observation.market.operator!=='gt':p.observation.market.operator!=='lt')
    ||m.termsHash!==rules.hash||p.observation.market.termsVersion!==rules.version||Date.parse(rules.approvedAt)>Date.parse(p.registeredAt))return fail('exact_identity_or_rules_unverified');
  if(p.observation.market.sport!=='NBA'||p.observation.market.statistic!=='points'||p.observation.market.period!=='full_game'||p.observation.market.overtime!=='included')return fail('unsupported_exact_market');
  if(Date.parse(games.retrievedAt)>Date.parse(at)||Date.parse(box.retrievedAt)>Date.parse(at))return fail('result_observation_from_future');
  const {logs}=await nbaPlayerLogs(games,box),row=logs.find(g=>g.gameId===m.statsGameId&&g.playerId===m.statsPlayerId);
  if(!row||!row.final||Date.parse(row.startsAt)!==Date.parse(p.observation.eventStartsAt))return fail('exact_final_fixture_player_missing');
  if(row.participated===null||row.participated&&row.points===null)return fail('participation_or_points_unknown');
  if(!row.participated&&(!rules.dnpVoid||rules.version!==`nba-points-ot-dnp-void-v1:${rules.hash}`))return fail('unsupported_dnp_rule');
  const outcome=row.participated?gradeCount(p.observation.market,row.points!):'void';
  // Identical provider bytes do not become a new settlement just because a
  // retry has a later receipt timestamp. Observation clocks remain in Grade.
  const rawEvidence=JSON.stringify({gamesSource:games.sourceUrl,gamesRaw:games.raw,boxSource:box.sourceUrl,boxRaw:box.raw}),sourceHash=await sha256(rawEvidence);
  if(previous?.sourceHash===sourceHash&&previous.outcome===outcome)return {status:'unchanged' as const,reason:null,grade:null};
  const observedAt=[games.retrievedAt,box.retrievedAt].sort((a,b)=>Date.parse(a)-Date.parse(b)).at(-1)!;
  const grade:Grade={id:crypto.randomUUID(),positionId:p.id,revision:(previous?.revision??0)+1,previousGradeId:previous?.id??null,positionHash:await positionHash(p),recordedAt:at,
    outcome,sourceClass:p.observation.sourceClass,sourceUrl:box.sourceUrl,sourceHash,eventId:p.observation.market.eventId,subjectId:p.observation.market.subjectId,termsVersion:rules.version,
    market:structuredClone(p.observation.market),winnerId:null,final:true,publishedAt:null,observedAt,rawEvidence,observedValue:row.participated?row.points:null,exception:row.participated?'none':'dnp'};
  return {status:'grade_proposed' as const,reason:null,grade};
}
