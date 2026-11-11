import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { nbaFixtures,nbaPlayerLogs } from './nba-source';
import { nbaGameLogSchema } from './nba-points';
import { atomicPrivateJson,digest,exclusive,retainEvidence,type RawEvidence } from './evidence.server';

const stamp=z.string().datetime({offset:true}),hash=z.string().regex(/^[a-f0-9]{64}$/);
const factsSchema=z.object({provider:z.literal('api-nba'),league:z.literal('NBA'),playerId:z.string().min(1),gameId:z.string().min(1),
  teamId:z.string().min(1),opponentId:z.string().min(1),home:z.boolean(),season:z.number().int(),stage:z.number().int(),
  startsAt:stamp,completedAt:stamp.nullable(),minutes:z.number().min(0).max(75).nullable(),points:z.number().int().nonnegative().nullable(),
  participated:z.boolean().nullable(),starter:z.boolean().nullable(),final:z.boolean()}).strict();
const revisionSchema=z.object({revision:z.number().int().positive(),previousHash:hash.nullable(),hash,
  facts:factsSchema,factsHash:hash,recordedAt:stamp,availableAt:stamp,sourcePublishedAt:stamp.nullable(),
  sourceHashes:z.array(hash).min(2),log:nbaGameLogSchema}).strict();
const storeSchema=z.object({format:z.literal('edgelab.v6-player-games'),version:z.literal(1),rows:z.record(z.string(),z.array(revisionSchema).min(1))}).strict();
export type TrainingDataset=z.infer<typeof storeSchema>;
const empty=():TrainingDataset=>({format:'edgelab.v6-player-games',version:1,rows:{}});
function checked(value:unknown){
 const store=storeSchema.parse(value);
 for(const [key,revisions]of Object.entries(store.rows))for(let i=0;i<revisions.length;i++){
  const r=revisions[i],{hash:stored,...payload}=r;
  if(stored!==digest(JSON.stringify(payload))||r.factsHash!==digest(JSON.stringify(r.facts))||r.revision!==i+1||r.previousHash!==(revisions[i-1]?.hash??null)
   ||key!==digest(JSON.stringify([r.facts.provider,r.facts.playerId,r.facts.gameId])))throw new Error('Training dataset revision integrity failed');
 }
 return store;
}
export async function loadTrainingDataset(root:string):Promise<TrainingDataset>{
 try{return checked(JSON.parse(await fs.readFile(path.join(root,'training','player-games.json'),'utf8')));}
 catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return empty();throw e;}
}
/** Source-qualified exact joins; corrections append, repeated facts do not duplicate labels.
 * availableAt is our first observation of this revision, never historical publication proof.
 */
export async function ingestNbaTraining(root:string,games:RawEvidence,box:RawEvidence,recordedAt:string){
 stamp.parse(recordedAt);
 if([games,box].some(e=>Date.parse(e.retrievedAt)>Date.parse(recordedAt)))throw new Error('Training source from future');
 const {logs,unmatchedGameIds}=await nbaPlayerLogs(games,box),fixtures=await nbaFixtures(games);
 if(unmatchedGameIds.length)throw new Error('Training rows have unknown exact fixtures');
 await retainEvidence(root,games);await retainEvidence(root,box);
 const input=JSON.parse(box.raw).response as {player:{id:number};game:{id:number};starter?:unknown}[];
 const file=path.join(root,'training','player-games.json');
 return exclusive(file+'.lock',async()=>{
  const store=await loadTrainingDataset(root);let inserted=0,revised=0,unchanged=0;
  for(const log of logs){
   if(log.final&&Date.parse(log.finalObservedAt)<Date.parse(log.startsAt)||log.completedAt!==null&&Date.parse(log.completedAt)>Date.parse(log.finalObservedAt))throw new Error('Training final result precedes availability');
   const fixture=fixtures.find(f=>f.id===log.gameId)!,raw=input.find(r=>String(r.player.id)===log.playerId&&String(r.game.id)===log.gameId)!;
   const home=fixture.teams.home.id===log.teamId;
   const facts=factsSchema.parse({provider:'api-nba',league:'NBA',playerId:log.playerId,gameId:log.gameId,teamId:log.teamId,
    opponentId:home?fixture.teams.visitors.id:fixture.teams.home.id,home,season:log.season,stage:log.stage,startsAt:log.startsAt,
    completedAt:log.completedAt,minutes:log.minutes,points:log.points,participated:log.participated,starter:typeof raw.starter==='boolean'?raw.starter:null,final:log.final});
   const key=digest(JSON.stringify([facts.provider,facts.playerId,facts.gameId])),history=store.rows[key]??[],last=history.at(-1),factsHash=digest(JSON.stringify(facts));
   if(last?.factsHash===factsHash){unchanged++;continue;}
   if(last&&Date.parse(recordedAt)<Date.parse(last.recordedAt))throw new Error('Training correction clock moved backwards');
   if(last&&Date.parse(log.finalObservedAt)<Date.parse(last.availableAt))throw new Error('Stale training evidence cannot replace a later revision');
   const payload={revision:history.length+1,previousHash:last?.hash??null,facts,factsHash,recordedAt,availableAt:log.finalObservedAt,
    sourcePublishedAt:null,sourceHashes:log.sourceHashes,log};
   const revision=revisionSchema.parse({...payload,hash:digest(JSON.stringify(payload))});
   store.rows[key]=[...history,revision];if(last)revised++;else inserted++;
  }
  checked(store);await atomicPrivateJson(file,store);return {inserted,revised,unchanged,totalPlayerGames:Object.keys(store.rows).length};
 });
}
export function trainingSummary(store:TrainingDataset){
 checked(store);const latest=Object.values(store.rows).map(r=>r.at(-1)!);
 const groups:Record<string,{rows:number;final:number;regularSeasonParticipatingGames:number;missingMinutes:number;missingPoints:number;missingStarter:number;firstGameAt:string;lastGameAt:string}>={};
 for(const {facts:f}of latest){const key=`${f.provider}:${f.playerId}:${f.season}`,g=groups[key]??={rows:0,final:0,regularSeasonParticipatingGames:0,missingMinutes:0,missingPoints:0,missingStarter:0,firstGameAt:f.startsAt,lastGameAt:f.startsAt};
  g.rows++;g.final+=Number(f.final);g.regularSeasonParticipatingGames+=Number(f.stage===2&&f.participated===true&&f.final);g.missingMinutes+=Number(f.minutes===null);g.missingPoints+=Number(f.points===null);g.missingStarter+=Number(f.starter===null);
  if(Date.parse(f.startsAt)<Date.parse(g.firstGameAt))g.firstGameAt=f.startsAt;if(Date.parse(f.startsAt)>Date.parse(g.lastGameAt))g.lastGameAt=f.startsAt;groups[key]=g;}
 return {totalPlayerGames:latest.length,players:new Set(latest.map(r=>r.facts.provider+':'+r.facts.playerId)).size,
  uniqueGames:new Set(latest.map(r=>r.facts.provider+':'+r.facts.gameId)).size,groups,archivedPublicationTimesVerified:false,
  availableAtMeaning:'actual retrieval, not original historical availability',revisions:Object.values(store.rows).reduce((n,r)=>n+r.length,0)};
}
