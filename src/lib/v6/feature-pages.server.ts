import fs from 'node:fs/promises';import path from 'node:path';
import {atomicPrivateJson,digest,type RawEvidence} from './evidence.server';
/** Checkpoint each successful page before attempting the next one. No hidden
 * retry, refunded reservation, historical-job replay or invented completeness. */
export async function collectFeaturePages(root:string,query:Record<string,string>,read:(parameters:Record<string,string>)=>Promise<RawEvidence>,clock:()=>string){
 const key=digest(JSON.stringify({query,window:Math.floor(Date.parse(clock())/14400000)})),file=path.join(root,'controlled/feature-pages',key+'.json');
 let receipts:RawEvidence[]=[];
 try{const value=JSON.parse(await fs.readFile(file,'utf8'));if(value.version!==1||value.key!==key)throw new Error('Feature checkpoint mismatch');receipts=value.receipts;}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
 const seen=new Set<number>();let cursor:number|null=null,complete=false;
 const accept=(r:RawEvidence)=>{if(r.provider!=='balldontlie'||digest(r.raw)!==r.hash||Date.parse(r.retrievedAt)>Date.parse(clock())||Date.parse(clock())-Date.parse(r.retrievedAt)>14400000)throw new Error('Feature checkpoint receipt mismatch');const u=new URL(r.sourceUrl),expected=new URL('/v1/games','https://api.balldontlie.io');for(const[k,v]of Object.entries({...query,...(cursor===null?{}:{cursor:String(cursor)})}))expected.searchParams.set(k,v);if(u.toString()!==expected.toString())throw new Error('Feature checkpoint query mismatch');const body=JSON.parse(r.raw);if(!Array.isArray(body.data))throw new Error('Current feature data invalid');const next=body.meta?.next_cursor;complete=next===null||next===undefined&&body.meta?.per_page===100&&body.data.length<100;if(!complete){if(!Number.isSafeInteger(next)||seen.has(next))throw new Error('Current feature pagination invalid');seen.add(next);cursor=next;}};
 for(const r of receipts){if(complete)throw new Error('Feature pages after completion');accept(r);}
 while(!complete){if(receipts.length>=16)throw new Error('Current feature scope incomplete');const r=await read({...query,...(cursor===null?{}:{cursor:String(cursor)})});receipts.push(r);await atomicPrivateJson(file,{version:1,key,receipts});accept(r);}
 return receipts;
}
