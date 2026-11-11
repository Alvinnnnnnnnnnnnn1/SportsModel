import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { screenNbaShadow } from './shadow';
import type { NbaGameLog } from './nba-points';
import { identityRevisionSchema,identityReasons,type IdentityRevision } from './identity-registry.server';
import { nbaPlayerLogs } from './nba-source';
import { atomicPrivateJson,digest,exclusive,retainEvidence,type RawEvidence } from './evidence.server';
const uuid=z.string().uuid(),hash=z.string().regex(/^[a-f0-9]{64}$/),stamp=z.string().datetime({offset:true});
type Screen=Awaited<ReturnType<typeof screenNbaShadow>>;
export interface ObservationBatch {
 format:'edgelab.v6-observational-batch';version:1;id:string;recordedAt:string;
 classification:'pre_event_observation'|'retrospective_source_review';
 source:RawEvidence;screen:Screen;
 identities:{selectionKey:string;fixtureId:string|null;playerId:string|null;statsGameId:string|null;statsPlayerId:string|null;mapping:IdentityRevision|null}[];
 financialPosition:false;trainingCluster:string;
}
async function readBatch(root:string,id:string){
 uuid.parse(id);const item=JSON.parse(await fs.readFile(path.join(root,'observations',id+'.json'),'utf8')) as {hash:string;record:ObservationBatch};
 if(item.record.id!==id||digest(JSON.stringify(item.record))!==item.hash)throw new Error('Observational batch integrity failed');return item;
}
/** Every screened outcome is frozen, including null/blocked identities. No financial
 * repository/registration capability; repeated lines retain a shared game cluster.
 */
export async function preserveNbaScreen(root:string,source:RawEvidence,logs:NbaGameLog[],mappings:IdentityRevision[],at:string){
 uuid.parse(source.id);stamp.parse(at);
 if(Date.parse(source.retrievedAt)>Date.parse(at))throw new Error('Observation source from future');
 const file=path.join(root,'observations',source.id+'.json');
 return exclusive(file+'.lock',async()=>{
  try{const saved=await readBatch(root,source.id);
   if(JSON.stringify(saved.record.source)!==JSON.stringify(source))throw new Error('Observation receipt replay changed');return {status:'already_recorded' as const,...saved};
  }catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
  for(const input of mappings){
   const m=identityRevisionSchema.parse(input);if(m.status!=='verified')continue;
   const journal=JSON.parse(await fs.readFile(path.join(root,'identity-registry',digest(m.mappingKey)+'.json'),'utf8')) as {hash:string;record:IdentityRevision}[];
   const approved=journal.find(r=>r.record.id===m.id&&r.hash===digest(JSON.stringify(m)));
   if(!approved)throw new Error('Verified mapping not in immutable registry');
   const sources=await Promise.all(m.sourceHashes.map(async h=>JSON.parse(await fs.readFile(path.join(root,'evidence',h+'.json'),'utf8')) as RawEvidence));
   if(m.fixtureAuthority)for(const id of [m.fixtureAuthority.gamesReceiptId,m.fixtureAuthority.rosterReceiptId])sources.push(JSON.parse(await fs.readFile(path.join(root,'evidence-receipts',id+'.json'),'utf8')) as RawEvidence);
   if(!m.sourceHashes.includes(source.hash)||identityReasons(m,sources).length)throw new Error('Verified mapping source authority invalid');
  }
  const screen=await screenNbaShadow(source,logs,mappings,at);if(!screen.candidates.length)throw new Error('No supported source-backed markets to archive');
  if(mappings.some(m=>Date.parse(m.recordedAt)>Date.parse(at)))throw new Error('Mapping learned after screening');
  await retainEvidence(root,source);
  const identities=screen.candidates.map(c=>{const m=mappings.find(m=>m.oddsEventId===c.eventId&&m.playerLabel===c.player&&m.side===c.selection&&m.line===c.threshold)??null;
   const verified=m?.status==='verified';return {selectionKey:c.key,fixtureId:verified?m.internalFixtureId:null,playerId:verified?m.internalPlayerId:null,
    statsGameId:verified?m.statsGameId:null,statsPlayerId:verified?m.statsPlayerId:null,mapping:m};});
  const record:ObservationBatch={format:'edgelab.v6-observational-batch',version:1,id:source.id,recordedAt:at,
   classification:screen.candidates.every(c=>Date.parse(c.eventStartsAt)>Date.parse(at))?'pre_event_observation':'retrospective_source_review',
   source,screen,identities,financialPosition:false,trainingCluster:screen.candidates[0].eventId};
  const saved={hash:digest(JSON.stringify(record)),record};await atomicPrivateJson(file,saved);return {status:'recorded' as const,...saved};
 });
}
/** Append-only statistical outcome evidence for an already mapped observation.
 * It never settles paper money or upgrades the original eligibility/registration.
 */
export async function observeNbaOutcome(root:string,batchId:string,selectionKey:string,games:RawEvidence,box:RawEvidence,at:string){
 hash.parse(selectionKey);stamp.parse(at);
 const batch=await readBatch(root,batchId),identity=batch.record.identities.find(i=>i.selectionKey===selectionKey),c=batch.record.screen.candidates.find(c=>c.key===selectionKey);
 if(!identity?.mapping||identity.mapping.status!=='verified'||!identity.statsGameId||!identity.statsPlayerId||!c)throw new Error('Frozen exact observation mapping unavailable');
 if(Date.parse(at)<Date.parse(batch.record.recordedAt)||[games,box].some(s=>Date.parse(s.retrievedAt)>Date.parse(at)))throw new Error('Invalid outcome observation clock');
 const {logs}=await nbaPlayerLogs(games,box),row=logs.find(l=>l.gameId===identity.statsGameId&&l.playerId===identity.statsPlayerId);
 if(!row||!row.final||Date.parse(row.startsAt)!==Date.parse(c.eventStartsAt)||row.participated!==true||row.points===null||Date.parse(row.finalObservedAt)<Date.parse(row.startsAt))throw new Error('Exact final player result unresolved');
 await retainEvidence(root,games);await retainEvidence(root,box);
 const payload={batchHash:batch.hash,selectionKey,statsGameId:row.gameId,statsPlayerId:row.playerId,points:row.points,participated:row.participated,
  sourceHashes:[games.hash,box.hash],sourcePublishedAt:null,observedAt:row.finalObservedAt,recordedAt:at,financialSettlement:false};
 const factsHash=digest(JSON.stringify({batchHash:batch.hash,selectionKey,game:row.gameId,player:row.playerId,points:row.points,sourceHashes:payload.sourceHashes}));
 const file=path.join(root,'observation-results',batchId,selectionKey+'.json');
 return exclusive(file+'.lock',async()=>{
  let history:{hash:string;factsHash:string;previousHash:string|null;revision:number;record:typeof payload}[]=[];
  try{history=JSON.parse(await fs.readFile(file,'utf8'));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
  for(let i=0;i<history.length;i++){const {hash:stored,...data}=history[i];if(digest(JSON.stringify(data))!==stored||data.previousHash!==(history[i-1]?.hash??null)||data.revision!==i+1)throw new Error('Outcome history changed');}
  const last=history.at(-1);if(last?.factsHash===factsHash)return {status:'unchanged',record:last};
  if(last&&Date.parse(at)<Date.parse(last.record.recordedAt))throw new Error('Outcome correction clock moved backwards');
  const data={factsHash,previousHash:last?.hash??null,revision:history.length+1,record:payload},entry={...data,hash:digest(JSON.stringify(data))};
  await atomicPrivateJson(file,[...history,entry]);return {status:'observed',record:entry};
 });
}
