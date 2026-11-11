import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { atomicPrivateJson,digest,exclusive,retainEvidence,type RawEvidence } from './evidence.server';
import { screenTeamSlate } from './team-pilot';
import type { TeamRegistry } from './team-identity';
import type { TeamGame } from './team-games';
type Screen=Awaited<ReturnType<typeof screenTeamSlate>>;
interface Frozen {format:'edgelab.v6-frozen-team-shadow';version:1;id:string;source:RawEvidence;screen:Omit<Screen,'snapshots'>;registry:TeamRegistry;positionsRegistered:0;financialWrites:0;}
export async function loadTeamShadow(root:string,id:string){
 z.string().uuid().parse(id);const saved=JSON.parse(await fs.readFile(path.join(root,'team-shadow',id+'.json'),'utf8')) as {hash:string;record:Frozen};
 if(saved.record.id!==id||digest(JSON.stringify(saved.record))!==saved.hash)throw new Error('Frozen team shadow integrity failed');return saved;
}
/** Append-only observational freezing. This cannot register or settle positions. */
export async function freezeTeamShadow(root:string,source:RawEvidence,rows:TeamGame[],registry:TeamRegistry,completeSeasons:number[],at:string){
 z.string().uuid().parse(source.id);const file=path.join(root,'team-shadow',source.id+'.json');
 return exclusive(file+'.lock',async()=>{
  try{const saved=await loadTeamShadow(root,source.id);if(JSON.stringify(saved.record.source)!==JSON.stringify(source))throw new Error('Shadow source replay changed');return {status:'already_recorded' as const,...saved};}
  catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
  if(Date.parse(registry.recordedAt)>Date.parse(at))throw new Error('Team mapping from future');
  const {snapshots,...screen}=await screenTeamSlate(source,rows,registry,completeSeasons,at);await retainEvidence(root,source);
  for(const [hash,history]of Object.entries(snapshots)){
   if(digest(JSON.stringify(history))!==hash)throw new Error('Frozen history hash mismatch');const snapshot=path.join(root,'team-games/snapshots',hash+'.json');
   try{if(await fs.readFile(snapshot,'utf8')!==JSON.stringify(history,null,2))throw new Error('Immutable history snapshot changed');}
   catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;await atomicPrivateJson(snapshot,history);}
  }
  const record:Frozen={format:'edgelab.v6-frozen-team-shadow',version:1,id:source.id,source,screen,registry,positionsRegistered:0,financialWrites:0},saved={hash:digest(JSON.stringify(record)),record};
  await atomicPrivateJson(file,saved);return {status:'recorded' as const,...saved};
 });
}
