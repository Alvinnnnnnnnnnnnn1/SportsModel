import fs from 'node:fs/promises';import path from 'node:path';
import {digest} from './evidence.server';
import {sourcePilotPlanSchema} from './source-pilot';
/** A local source-only namespace, bound to an existing RLS-private archive batch.
 * This is not an Auth identity and can never be used for hosted persistence. */
export const localSourceOwner=(batchId:string)=>'source-only:'+digest(batchId);
export async function pilotResearchOwner(root:string,batchId:string,normalOwner:string){
 try{const p=sourcePilotPlanSchema.parse(JSON.parse(await fs.readFile(path.join(root,'source-pilot/proposal/plan.json'),'utf8')));if(p.historyBatchId!==batchId||p.ownerId!==localSourceOwner(batchId))throw new Error('Pilot owner binding differs');return p.ownerId;}
 catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return normalOwner;throw e;}
}
