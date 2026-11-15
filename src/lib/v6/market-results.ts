import {teamGames} from './team-games';import type {RawEvidence} from './evidence.server';
import {normalizeResearchMarkets,settleScoreMarket,type ResearchQuote} from './market-normalization';
/** Observational grading only. Never emits a financial/paper Grade or upgrades
 * an unregistered historical forecast. Cancellation/void requires a separate
 * attributable rule/result adapter; incomplete/cancelled feeds stay unresolved. */
export async function reconcileMarketResult(q:ResearchQuote,original:RawEvidence,primary:RawEvidence,secondary:RawEvidence,checkedAt:string){
 const fail=(reason:string)=>({outcome:'unresolved' as const,reason,classification:'observational_only' as const,paperSettlement:false as const});
 if(q.sport!=='NBA'||!q.statsEventId||!q.canonicalEventId||!q.termsVersion||q.overtime!=='included'||q.period!=='full_game'||!['moneyline','spread','total'].includes(q.family??'')||q.reasons.some(r=>!['event_not_pre_event','stale_or_future_price'].includes(r)))return fail('exact_market_identity_or_terms_missing');
 if(primary.provider!=='the-odds-api.com'||secondary.provider!=='balldontlie'||!Number.isFinite(Date.parse(checkedAt))||[primary,secondary].some(r=>Date.parse(r.retrievedAt)>Date.parse(checkedAt)||Date.parse(r.retrievedAt)<Date.parse(q.startsAt)))return fail('independent_source_or_clock_missing');
 if(original.hash!==q.sourceHash||original.id!==q.sourceReceipt||!normalizeResearchMarkets(original,[],original.retrievedAt).some(r=>r.eventId===q.eventId&&r.providerMarket===q.providerMarket&&r.selection===q.selection&&r.line===q.line&&r.odds===q.odds&&r.quoteAt===q.quoteAt&&r.startsAt===q.startsAt&&r.home===q.home&&r.away===q.away))return fail('original_market_evidence_mismatch');
 const a=(await teamGames(primary)).filter(g=>g.sourceGameId===q.eventId),b=(await teamGames(secondary)).filter(g=>g.sourceGameId===q.statsEventId);
 if(a.length!==1||b.length!==1||[a[0],b[0]].some(g=>!g.final||g.home.name!==q.home||g.away.name!==q.away||!g.startsAt||Math.abs(Date.parse(g.startsAt)-Date.parse(q.startsAt))>300000))return fail('final_identity_or_completion_unresolved');
 if(a[0].homeScore===null||a[0].awayScore===null||a[0].homeScore===a[0].awayScore||a[0].homeScore!==b[0].homeScore||a[0].awayScore!==b[0].awayScore)return fail('independent_scores_disagree');
 return {outcome:settleScoreMarket(q,a[0].homeScore,a[0].awayScore),homeScore:a[0].homeScore,awayScore:a[0].awayScore,sourceHashes:[primary.hash,secondary.hash],checkedAt,reason:null,classification:'observational_only' as const,paperSettlement:false as const};
}
