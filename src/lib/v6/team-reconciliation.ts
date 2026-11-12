import { z } from 'zod';
import { sha256 } from '@/lib/imports/duplicates';
import { teamGames } from './team-games';
import type { TeamRegistry } from './team-identity';
import type { TeamFixtureProof } from './team-pilot';
import type { RawEvidence } from './evidence.server';

/** Identity tolerance only. Never changes a frozen registration deadline. */
export const EVENT_RECONCILIATION_POLICY=Object.freeze({id:'nba-event-reconciliation-1',version:1,maximumStartDriftSeconds:300,
 persistentIdsRequired:true,independentFinalRequired:true,sameUtcDateRequired:true,originalBridgeMaximumSeconds:900,
 quoteMaximumAgeSeconds:300,quoteSafetySeconds:60,actualStartMayBeUnknown:true});
const stamp=z.string().datetime({offset:true});
export interface ReconciliationInput {
 proof:TeamFixtureProof;registry:TeamRegistry;originalOdds:RawEvidence;originalFixtures:RawEvidence;
 scores:RawEvidence;secondary:RawEvidence;frozenAt:string;at:string;
 quote:{selectionName:string;odds:number;sourceUpdatedAt:string|null;retrievedAt:string;forecastAt:string};
}
export async function reconcileTeamEvent(i:ReconciliationInput){
 stamp.parse(i.at);stamp.parse(i.frozenAt);const {proof:p,registry:r}=i;
 const reasons:string[]=[],quoteReasons:string[]=[];
 const out={policy:EVENT_RECONCILIATION_POLICY,eventId:p.eventId,statsGameId:p.statsGameId,season:null as number|null,seasonProvenance:'original and final BALLDONTLIE season; Odds API season field unavailable',
  identity:{verified:false,reasons},quoteEligibility:{eligible:false,reasons:quoteReasons,conservativeDeadline:null as string|null,actualStartedAt:null as string|null,actualStartEvidence:'not_supplied' as const},
  result:{verified:false,reason:null as string|null,winnerId:null as string|null,homeScore:null as number|null,awayScore:null as number|null},
  settlementEligibility:{eligible:false,reason:'observational_evidence_is_not_a_registered_position'},
  originalOddsStart:p.startsAt,originalStatsStart:p.statsStartsAt,finalOddsStart:null as string|null,finalStatsStart:null as string|null,
  startDriftSeconds:null as number|null,sourceSemantics:'same-ID commence_time field revision; actual-tipoff semantics not established',
  receiptIds:[i.originalOdds.id,i.originalFixtures.id,i.scores.id,i.secondary.id],sourceHashes:[i.originalOdds.hash,i.originalFixtures.hash,i.scores.hash,i.secondary.hash]};
 const fail=(reason:string)=>{reasons.push(reason);return out;};
 if(i.originalOdds.provider!=='the-odds-api.com'||i.originalFixtures.provider!=='balldontlie'||i.scores.provider!=='the-odds-api.com'||i.secondary.provider!=='balldontlie')return fail('wrong_provider_scope');
 for(const e of [i.originalOdds,i.originalFixtures,i.scores,i.secondary])if(await sha256(e.raw)!==e.hash)return fail('source_hash_mismatch');
 const {hash:registryHash,...registryData}=r;if(await sha256(JSON.stringify(registryData))!==registryHash)return fail('registry_hash_mismatch');
 const u=new URL(i.originalOdds.sourceUrl);
 if(u.origin!=='https://api.the-odds-api.com'||u.pathname!=='/v4/sports/basketball_nba/odds'||u.searchParams.get('markets')!=='h2h'||u.searchParams.get('bookmakers')!=='sportsbet')return fail('original_exact_market_scope_missing');
 if(!p.statsGameId||!p.statsStartsAt||r.hash!==p.registryHash||Date.parse(r.recordedAt)>Date.parse(i.frozenAt))return fail('frozen_bridge_missing');
 if(new URL(i.secondary.sourceUrl).pathname!=='/v1/games/'+p.statsGameId)return fail('independent_exact_game_endpoint_mismatch');
 if([i.originalOdds,i.originalFixtures].some(e=>Date.parse(e.retrievedAt)>Date.parse(i.frozenAt))||[i.scores,i.secondary].some(e=>Date.parse(e.retrievedAt)>Date.parse(i.at)||Date.parse(e.retrievedAt)<Date.parse(p.earliestStartsAt)))return fail('evidence_clock_invalid');
 const quotes=z.array(z.object({id:z.string(),sport_key:z.string(),commence_time:stamp,home_team:z.string(),away_team:z.string(),bookmakers:z.array(z.object({key:z.string(),markets:z.array(z.object({key:z.string(),last_update:stamp.nullish(),outcomes:z.array(z.object({name:z.string(),price:z.number().finite()}))}))}))})).parse(JSON.parse(i.originalOdds.raw));
 const matches=quotes.filter(q=>q.id===p.eventId);if(matches.length!==1)return fail('original_event_id_ambiguous');const original=matches[0];
 if(original.sport_key!=='basketball_nba'||original.home_team!==p.homeName||original.away_team!==p.awayName||Date.parse(original.commence_time)!==Date.parse(p.startsAt))return fail('original_event_identity_changed');
 let originalRows:Awaited<ReturnType<typeof teamGames>>,before:typeof originalRows,after:typeof originalRows,primary:typeof originalRows;
 try{originalRows=await teamGames(i.originalFixtures);before=originalRows.filter(g=>g.sourceGameId===p.statsGameId);after=(await teamGames(i.secondary)).filter(g=>g.sourceGameId===p.statsGameId);primary=(await teamGames(i.scores)).filter(g=>g.sourceGameId===p.eventId);}
 catch{return fail('malformed_or_duplicate_provider_records');}
 if(before.length!==1||after.length!==1||primary.length!==1)return fail('persistent_event_ids_missing_or_ambiguous');
 const b=before[0],f=after[0],a=primary[0];out.season=b.season;out.finalOddsStart=a.startsAt;out.finalStatsStart=f.startsAt;
 if(b.season===null||b.season!==f.season||[b,f,a].some(g=>g.league!=='NBA'))return fail('league_or_season_changed');
 if(b.final)return fail('original_fixture_already_final');
 const h=r.mappings['balldontlie:'+b.home.id],away=r.mappings['balldontlie:'+b.away.id];
 if(!h||!away||h.canonicalId!==p.homeId||away.canonicalId!==p.awayId||f.home.id!==b.home.id||f.away.id!==b.away.id
  ||h.name!==b.home.name||away.name!==b.away.name||f.home.name!==b.home.name||f.away.name!==b.away.name||a.home.name!==p.homeName||a.away.name!==p.awayName)return fail('exact_team_identifiers_changed');
 if(!b.startsAt||!f.startsAt||!a.startsAt||Date.parse(b.startsAt)!==Date.parse(p.statsStartsAt)||Math.abs(Date.parse(b.startsAt)-Date.parse(p.startsAt))>900000)return fail('original_fixture_bridge_clock_mismatch');
 const competing=originalRows.filter(g=>g.sourceGameId!==p.statsGameId&&g.home.id===b.home.id&&g.away.id===b.away.id&&g.startsAt&&Math.abs(Date.parse(g.startsAt)-Date.parse(b.startsAt!))<=900000);
 if(competing.length)return fail('ambiguous_nearby_doubleheader');
 const rawBefore=JSON.parse(i.originalFixtures.raw).data,rawAfter=JSON.parse(i.secondary.raw).data;
 const native=[...(Array.isArray(rawBefore)?rawBefore:[rawBefore]),...(Array.isArray(rawAfter)?rawAfter:[rawAfter])].filter(g=>String(g.id)===p.statsGameId);
 if(native.some(g=>g.postponed||['postponed','canceled','delayed','suspended','abandoned','unknown'].includes(g.status_state)))return fail('postponed_or_ambiguous_lifecycle');
 const delta=(Date.parse(a.startsAt)-Date.parse(p.startsAt))/1000;out.startDriftSeconds=delta;
 const utcDate=(s:string)=>new Date(s).toISOString().slice(0,10);
 if(Math.abs(delta)>300||Math.abs(Date.parse(f.startsAt)-Date.parse(p.statsStartsAt))>300000||utcDate(a.startsAt)!==utcDate(p.startsAt)||utcDate(f.startsAt)!==utcDate(p.statsStartsAt))return fail('start_drift_exceeds_identity_policy');
 out.identity.verified=true;
 const deadline=Math.min(...[p.startsAt,p.statsStartsAt,p.earliestStartsAt,a.startsAt,f.startsAt].map(Date.parse));out.quoteEligibility.conservativeDeadline=new Date(deadline).toISOString();
 const market=original.bookmakers.filter(b=>b.key==='sportsbet').flatMap(b=>b.markets).filter(m=>m.key==='h2h');
 if(market.length!==1||market[0].outcomes.length!==2||new Set(market[0].outcomes.map(o=>o.name)).size!==2||market[0].outcomes.some(o=>![p.homeName,p.awayName].includes(o.name))||!market[0].outcomes.some(o=>o.name===i.quote.selectionName&&o.price===i.quote.odds)||i.quote.odds<=1||market[0].last_update!==i.quote.sourceUpdatedAt||i.quote.retrievedAt!==i.originalOdds.retrievedAt)quoteReasons.push('original_quote_evidence_mismatch');
 if(!i.quote.sourceUpdatedAt)quoteReasons.push('quote_timestamp_missing');
 else {const update=Date.parse(stamp.parse(i.quote.sourceUpdatedAt)),capture=Date.parse(stamp.parse(i.quote.retrievedAt)),freeze=Date.parse(i.frozenAt),forecast=Date.parse(stamp.parse(i.quote.forecastAt));
  if(update>capture||capture>freeze||forecast>freeze||freeze-capture>300000||freeze-update>300000)quoteReasons.push('stale_or_future_quote');
  if(Math.max(capture,freeze,forecast,update)>=deadline-60000)quoteReasons.push('not_safely_pre_event');}
 out.quoteEligibility.eligible=quoteReasons.length===0;
 if(!a.final||!f.final||a.homeScore===null||a.awayScore===null||a.homeScore===a.awayScore||a.homeScore!==f.homeScore||a.awayScore!==f.awayScore){out.result.reason='final_scores_not_corroborated';return out;}
 if(a.sourceUpdatedAt&&Date.parse(a.sourceUpdatedAt)>Date.parse(i.scores.retrievedAt)){out.result.reason='future_source_result_timestamp';return out;}
 out.result={verified:true,reason:null,winnerId:a.homeScore>a.awayScore?p.homeId:p.awayId,homeScore:a.homeScore,awayScore:a.awayScore};
 return out;
}
