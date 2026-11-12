import { sha256 } from '@/lib/imports/duplicates';
import { positionHash } from './engine';
import type { Grade,PaperPosition } from './types';
import { TEAM_TERMS } from './team-pilot';
import { reconcileTeamEvent,type ReconciliationInput,EVENT_RECONCILIATION_POLICY } from './team-reconciliation';
import { teamGames } from './team-games';

/** Only actual immutable prospective registrations can reach settlement. The
 * observational reconciliation module never constructs a PaperPosition. */
export async function gradeReconciledTeamPosition(position:PaperPosition,input:Omit<ReconciliationInput,'quote'|'frozenAt'>,previous:Grade|null=null){
 const fail=(reason:string)=>({status:'unresolved' as const,reason,grade:null}),{proof:p}=input,m=position.observation.market,t=position.forecast?.inputs.team;
 if(position.observation.sourceClass!=='prospective'||!position.forecast||!t||!['nba_team_elo','nba_team_elo_only'].includes(position.forecast.method)||m.sport!=='NBA'||m.statistic!=='moneyline'||m.period!=='full_game'||m.overtime!=='included'||m.termsVersion!==TEAM_TERMS.version||p.termsVersion!==m.termsVersion
  ||m.eventId!=='the-odds-api.com:'+p.eventId||![p.homeId,p.awayId].includes(m.subjectId)||t.homeId!==p.homeId||t.awayId!==p.awayId||t.registryHash!==p.registryHash||t.safeEventStartsAt!==p.earliestStartsAt||position.observation.eventStartsAt!==p.startsAt)return fail('registered_exact_team_market_proof_mismatch');
 if(position.observation.rawHash!==input.originalOdds.hash)return fail('registered_quote_hash_mismatch');
 const decision=await reconcileTeamEvent({...input,frozenAt:position.registeredAt,quote:{selectionName:m.subjectId===p.homeId?p.homeName:p.awayName,odds:position.observation.odds,sourceUpdatedAt:position.observation.sourceUpdatedAt,retrievedAt:position.observation.retrievedAt,forecastAt:position.forecast.generatedAt}});
 if(!decision.identity.verified||!decision.result.verified||!decision.quoteEligibility.eligible)return fail([...decision.identity.reasons,...decision.quoteEligibility.reasons,decision.result.reason].filter(Boolean).join(';')||'reconciliation_unresolved');
 const winnerId=decision.result.winnerId!,outcome=winnerId===m.subjectId?'won':'lost';
 // Identical source bytes fetched again do not create another grade revision.
 const rawEvidence=JSON.stringify({policy:EVENT_RECONCILIATION_POLICY,proof:p,originalOdds:input.originalOdds.raw,originalFixtures:input.originalFixtures.raw,scores:input.scores.raw,secondary:input.secondary.raw}),sourceHash=await sha256(rawEvidence);
 if(previous?.sourceHash===sourceHash&&previous.outcome===outcome)return {status:'unchanged' as const,reason:null,grade:null};
 const final=(await teamGames(input.scores)).find(g=>g.sourceGameId===p.eventId)!;
 const grade:Grade={id:crypto.randomUUID(),positionId:position.id,revision:(previous?.revision??0)+1,previousGradeId:previous?.id??null,positionHash:await positionHash(position),recordedAt:input.at,outcome,sourceClass:'prospective',sourceUrl:input.scores.sourceUrl,sourceHash,eventId:m.eventId,subjectId:m.subjectId,termsVersion:m.termsVersion,market:structuredClone(m),winnerId,final:true,publishedAt:final.sourceUpdatedAt,observedAt:[input.scores.retrievedAt,input.secondary.retrievedAt].sort().at(-1)!,rawEvidence,observedValue:null,exception:'none'};
 return {status:'grade_proposed' as const,reason:null,grade};
}
