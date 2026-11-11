import fs from 'node:fs/promises';
import path from 'node:path';
import { atomicPrivateJson,digest,exclusive,retainEvidence,type RawEvidence } from './evidence.server';
import { teamGames,teamGameSchema,type TeamGame } from './team-games';
interface Revision {revision:number;previousHash:string|null;hash:string;factsHash:string;record:TeamGame;}
type Store={format:'edgelab.v6-team-games';version:1;rows:Record<string,Revision[]>};
export async function loadTeamDataset(root:string):Promise<Store>{
 let store:Store;try{store=JSON.parse(await fs.readFile(path.join(root,'team-games/dataset.json'),'utf8'));}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return {format:'edgelab.v6-team-games',version:1,rows:{}};throw e;}
 if(store.format!=='edgelab.v6-team-games'||store.version!==1)throw new Error('Invalid team store');
 for(const [key,history]of Object.entries(store.rows))for(let i=0;i<history.length;i++){const {hash,...data}=history[i];teamGameSchema.parse(data.record);
  if(digest(JSON.stringify(data))!==hash||key!==digest(JSON.stringify([data.record.provider,data.record.sourceGameId]))||data.revision!==i+1||data.previousHash!==(history[i-1]?.hash??null))throw new Error('Team dataset integrity failed');}
 return store;
}
export async function ingestTeamGames(root:string,source:RawEvidence){
 const games=await teamGames(source);await retainEvidence(root,source);const file=path.join(root,'team-games/dataset.json');
 return exclusive(file+'.lock',async()=>{
  const store=await loadTeamDataset(root);let inserted=0,revised=0,unchanged=0;
  for(const g of games){const key=digest(JSON.stringify([g.provider,g.sourceGameId])),history=store.rows[key]??[],last=history.at(-1);
   const {retrievedAt,receiptId,rawHash,...facts}=g;void retrievedAt;void receiptId;void rawHash;const factsHash=digest(JSON.stringify(facts));
   if(last?.factsHash===factsHash){unchanged++;continue;}if(last&&Date.parse(g.retrievedAt)<Date.parse(last.record.retrievedAt))throw new Error('Stale game correction rejected');
   const data={revision:history.length+1,previousHash:last?.hash??null,factsHash,record:g};store.rows[key]=[...history,{...data,hash:digest(JSON.stringify(data))}];if(last)revised++;else inserted++;
  }
  await atomicPrivateJson(file,store);return {inserted,revised,unchanged,totalSourceGames:Object.keys(store.rows).length};
 });
}
export const latestTeamGames=(store:Store)=>Object.values(store.rows).map(rs=>rs.at(-1)!.record);
