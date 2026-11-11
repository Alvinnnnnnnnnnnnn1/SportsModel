import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { digest,exclusive,atomicPrivateJson,type RawEvidence } from './evidence.server';
const stamp=z.string().datetime({offset:true}),hash=z.string().regex(/^[a-f0-9]{64}$/),id=z.string().min(1).max(300);
export const identityRevisionSchema=z.object({
  version:z.literal(1),id:z.string().uuid(),mappingKey:id,revision:z.number().int().positive(),previousHash:hash.nullable(),recordedAt:stamp,
  league:z.literal('NBA'),season:z.number().int().nullable(),eventStartsAt:stamp,
  internalFixtureId:id,oddsEventId:id,sportsbetEventId:id.nullable(),statsGameId:id.nullable(),
  internalPlayerId:id.nullable(),oddsPlayerId:id.nullable(),statsPlayerId:id.nullable(),playerLabel:id,
  market:z.literal('player_points'),side:z.enum(['Over','Under']),line:z.number().finite().min(0).max(100),period:z.literal('full_game'),overtime:z.literal('included'),
  termsHash:hash.nullable(),sourceHashes:z.array(hash).min(1),
  authority:z.object({namespace:z.enum(['nba_player_id','documented_provider_crosswalk']),oddsSourceHash:hash,statsSourceHash:hash,oddsPath:id,statsPath:id}).strict().nullable(),
  fixtureAuthority:z.object({gamesSourceHash:hash,rosterSourceHash:hash,gamesReceiptId:z.string().uuid(),rosterReceiptId:z.string().uuid(),statsTeamId:id}).strict().nullable().optional(),
  status:z.enum(['blocked','verified']),reasons:z.array(id),
}).strict();
export type IdentityRevision=z.infer<typeof identityRevisionSchema>;
function pointer(value:unknown,p:string):unknown {
  if(!p.startsWith('/'))return undefined;
  for(const key of p.slice(1).split('/').map(k=>k.replaceAll('~1','/').replaceAll('~0','~'))){if(!value||typeof value!=='object')return undefined;value=(value as Record<string,unknown>)[key];}
  return value;
}
/** Non-name source authority is mandatory. A surname or fabricated hash cannot approve a map. */
export function identityReasons(row:IdentityRevision,sources:RawEvidence[]) {
  const reasons:string[]=[];
  if(!row.statsGameId||row.season===null)reasons.push('exact_statistics_fixture_missing');
  if(!row.statsPlayerId||!row.internalPlayerId)reasons.push('canonical_player_missing');
  if(!row.termsHash)reasons.push('documented_settlement_terms_missing');
  const available=new Map(sources.map(e=>[e.hash,e]));
  if(sources.some(e=>digest(e.raw)!==e.hash)||row.sourceHashes.some(h=>!available.has(h)))reasons.push('immutable_source_missing_or_invalid');
  if(sources.some(e=>Date.parse(e.retrievedAt)>Date.parse(row.recordedAt)))reasons.push('mapping_source_from_future');
  const a=row.authority,odds=a?available.get(a.oddsSourceHash):null,stats=a?available.get(a.statsSourceHash):null;
  const f=row.fixtureAuthority,games=f?sources.find(s=>s.hash===f.gamesSourceHash&&s.id===f.gamesReceiptId):null,roster=f?sources.find(s=>s.hash===f.rosterSourceHash&&s.id===f.rosterReceiptId):null;
  if(!f||!games||!roster||games.provider!=='api-nba'||roster.provider!=='api-nba'||!row.sourceHashes.includes(games.hash)||!row.sourceHashes.includes(roster.hash))reasons.push('exact_fixture_and_roster_authority_missing');
  else try{
    const gameUrl=new URL(games.sourceUrl),rosterUrl=new URL(roster.sourceUrl),gameBody=JSON.parse(games.raw),rosterBody=JSON.parse(roster.raw),oddsBody=odds?JSON.parse(odds.raw):null;
    const fixture=z.array(z.object({id:z.number().int().positive(),league:z.string(),season:z.number().int(),date:z.object({start:stamp}),teams:z.object({home:z.object({id:z.number().int().positive(),name:z.string()}),visitors:z.object({id:z.number().int().positive(),name:z.string()})})})).parse(gameBody.response).filter(g=>String(g.id)===row.statsGameId);
    if(gameUrl.origin!=='https://v2.nba.api-sports.io'||gameUrl.pathname!=='/games'||Object.keys(gameBody.errors??{}).length||fixture.length!==1)reasons.push('exact_statistics_fixture_authority_invalid');
    else {const g=fixture[0];
      if(g.league!=='standard'||g.season!==row.season||Date.parse(g.date.start)!==Date.parse(row.eventStartsAt)||oddsBody?.id!==row.oddsEventId||Date.parse(oddsBody?.commence_time)!==Date.parse(row.eventStartsAt)
       ||g.teams.home.name!==oddsBody?.home_team||g.teams.visitors.name!==oddsBody?.away_team)reasons.push('fixture_date_teams_league_season_mismatch');
      if(rosterUrl.origin!=='https://v2.nba.api-sports.io'||rosterUrl.pathname!=='/players'||rosterUrl.searchParams.get('team')!==f.statsTeamId||rosterUrl.searchParams.get('season')!==String(row.season)
       ||![String(g.teams.home.id),String(g.teams.visitors.id)].includes(f.statsTeamId)||Object.keys(rosterBody.errors??{}).length
       ||!Array.isArray(rosterBody.response)||rosterBody.response.filter((p:{id:unknown})=>String(p.id)===row.statsPlayerId).length!==1)reasons.push('season_qualified_player_roster_mismatch');
    }
  }catch{reasons.push('fixture_roster_evidence_malformed');}
  if(!a||!odds||!stats||odds.provider!=='the-odds-api.com'||stats.provider!=='api-nba'||odds.hash===stats.hash)reasons.push('non_name_cross_provider_authority_missing');
  else {const left=pointer(JSON.parse(odds.raw),a.oddsPath),right=pointer(JSON.parse(stats.raw),a.statsPath);
    if(!/^\/bookmakers\/\d+\/markets\/\d+\/outcomes\/\d+\/participant_id$/.test(a.oddsPath)
      ||!/^\/response\/\d+\/(?:player\/)?id$/.test(a.statsPath))reasons.push('unrecognised_authoritative_identifier_field');
    if(left===null||left===undefined||!['string','number'].includes(typeof left)||String(left)!==String(right))reasons.push('shared_identifier_proof_mismatch');
    if(a.namespace==='nba_player_id'&&(!row.oddsPlayerId||String(left)!==row.oddsPlayerId||String(right)!==row.statsPlayerId))reasons.push('player_identifier_mismatch');
    if(a.namespace==='documented_provider_crosswalk')reasons.push('crosswalk_requires_explicit_registry_validation');
  }
  return reasons;
}
export async function appendIdentityRevision(root:string,proposal:IdentityRevision,sources:RawEvidence[]) {
  const row=identityRevisionSchema.parse(proposal),reasons=identityReasons(row,sources);
  if(row.status==='verified'&&reasons.length)throw new Error('Unverified identity authority: '+reasons.join(', '));
  const normalized={...row,reasons:reasons.length?reasons:row.status==='blocked'?['mapping_not_activated']:[]};
  const filename=path.join(root,'identity-registry',digest(row.mappingKey)+'.json');
  return exclusive(filename+'.lock',async()=>{
    let history:{hash:string;record:IdentityRevision}[]=[];
    try{history=z.array(z.object({hash,record:identityRevisionSchema}).strict()).parse(JSON.parse(await fs.readFile(filename,'utf8')));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
    for(const item of history)if(digest(JSON.stringify(item.record))!==item.hash)throw new Error('Mapping history hash changed');
    const replay=history.find(item=>item.record.id===row.id);
    if(replay){if(JSON.stringify(replay.record)!==JSON.stringify(normalized))throw new Error('Mapping replay changed');return replay;}
    const last=history.at(-1);
    if(row.revision!==(last?.record.revision??0)+1||row.previousHash!==(last?.hash??null))throw new Error('Mapping revision conflict');
    if(last&&Date.parse(row.recordedAt)<Date.parse(last.record.recordedAt))throw new Error('Mapping revision clock moved backwards');
    const item={hash:digest(JSON.stringify(normalized)),record:normalized};await atomicPrivateJson(filename,[...history,item]);return item;
  });
}
