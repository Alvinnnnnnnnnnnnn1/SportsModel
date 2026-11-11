import { z } from 'zod';
import type { RawEvidence } from './evidence.server';
import type { IdentityRevision } from './identity-registry.server';
import { sha256 } from '@/lib/imports/duplicates';
import { nbaPointsForecast,pointsThreshold,type NbaGameLog } from './nba-points';
const stamp=z.string().datetime({offset:true});
const eventSchema=z.object({id:z.string(),sport_key:z.literal('basketball_nba'),commence_time:stamp,home_team:z.string(),away_team:z.string(),bookmakers:z.array(z.object({key:z.string(),sid:z.string().nullable().optional(),markets:z.array(z.object({key:z.string(),last_update:stamp.nullable().optional(),outcomes:z.array(z.object({name:z.enum(['Over','Under']),description:z.string(),point:z.number().min(0).max(100),price:z.number().min(1.0001).max(10000).refine(p=>Math.abs(p*10000-Math.round(p*10000))<.00001),sid:z.string().nullable().optional(),participant_id:z.string().nullable().optional()}))}))}))});
/** Shadow observations have no promotion method and no position repository capability. */
export async function screenNbaShadow(evidence:RawEvidence,logs:NbaGameLog[],mappings:IdentityRevision[],at:string) {
  stamp.parse(at);
  if(evidence.provider!=='the-odds-api.com'||await sha256(evidence.raw)!==evidence.hash||Date.parse(evidence.retrievedAt)>Date.parse(at))throw new Error('Invalid shadow source');
  const event=eventSchema.parse(JSON.parse(evidence.raw)),candidates=[];
  const url=new URL(evidence.sourceUrl);
  if(url.origin!=='https://api.the-odds-api.com'||url.pathname!==`/v4/sports/basketball_nba/events/${event.id}/odds`||url.username||url.password||[...url.searchParams.keys()].some(k=>/key|token|password|secret/i.test(k)))throw new Error('Exact shadow source URL invalid');
  const seen=new Set<string>();
  for(const book of event.bookmakers)if(book.key==='sportsbet')for(const market of book.markets)if(market.key==='player_points')for(const o of market.outcomes){
    const key=await sha256(JSON.stringify([event.id,book.key,market.key,o.description,o.name,o.point]));
    if(seen.has(key))throw new Error('Duplicate exact shadow selection');seen.add(key);
    const reasons:string[]=[],m=mappings.find(m=>m.oddsEventId===event.id&&m.playerLabel===o.description&&m.side===o.name&&m.line===o.point);
    if(!m||m.status!=='verified')reasons.push('verified_non_name_identity_missing');
    if(!o.participant_id)reasons.push('odds_player_identifier_missing');
    if(Date.parse(event.commence_time)<=Date.parse(at))reasons.push('post_start');
    if(!market.last_update)reasons.push('source_update_time_unknown');
    else if(Date.parse(market.last_update)>Date.parse(evidence.retrievedAt)||Date.parse(at)-Date.parse(market.last_update)>300000)reasons.push('quote_not_fresh');
    const modeled=m?.statsPlayerId&&Date.parse(at)<Date.parse(event.commence_time)?await nbaPointsForecast(logs,{playerId:m.statsPlayerId,eventStartsAt:event.commence_time,cutoff:at,calculatedAt:at}):null;
    if(!modeled?.forecast)reasons.push(modeled?.reason??'independent_player_history_unavailable');
    // An experimental distribution can be studied, but never passes the armed
    // model-supported policy's out-of-sample validation requirement.
    if(modeled?.forecast)reasons.push('model_experimental_not_activated');
    const diagnostic=m?.status==='verified'&&modeled?.forecast?pointsThreshold(modeled.forecast.distribution,o.point,o.name):null;
    candidates.push({key,eventId:event.id,sportsbetEventId:book.sid??null,player:o.description,oddsPlayerId:o.participant_id??null,selection:o.name,threshold:o.point,market:'player_points',
      bookmaker:'sportsbet',originalOdds:o.price,sourceUpdatedAt:market.last_update??null,retrievedAt:evidence.retrievedAt,eventStartsAt:event.commence_time,rawHash:evidence.hash,
      mappingHash:m?await sha256(JSON.stringify(m)):null,probability:null,expectedValue:null,diagnosticProbability:diagnostic?.winProbability??null,
      stakeCents:5000,decision:reasons.length?'blocked':'shadow_only',reasons,registrationProposal:null,
      correlationCluster:event.id,prospectiveRegistration:false});
  }
  return {format:'edgelab.v6-shadow-screen',version:1,at,sourceHash:evidence.hash,classification:'real_source_observations_only',screened:candidates.length,
    qualifiedProposals:0,registrations:0,candidates,policy:{openingReferenceCents:500000,stakeCents:5000,exposureGate:false,positionCountCap:null}};
}
