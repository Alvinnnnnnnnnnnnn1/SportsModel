import fs from 'node:fs/promises';import path from 'node:path';
import {digest,atomicPrivateJson,exclusive,type RawEvidence} from './evidence.server';
/** Successful request checkpoints belong to one original job. Failed requests
 * retain their reservations; stale quotes cannot inherit a fresh retrieval time. */
export async function jobSourceRead(root:string,jobId:string,provider:RawEvidence['provider'],endpoint:string,parameters:Record<string,string>,maxAgeMs:number,clock:()=>string,read:()=>Promise<RawEvidence>){
 const origin=provider==='balldontlie'?'https://api.balldontlie.io':'https://api.the-odds-api.com',url=new URL(endpoint,origin);for(const [k,v]of Object.entries(parameters))url.searchParams.set(k,v);
 const file=path.join(root,'controlled/job-captures',digest(jobId),digest(url.toString())+'.json');
 return exclusive(file+'.lock',async()=>{
  let old:RawEvidence|null=null;try{old=JSON.parse(await fs.readFile(file,'utf8'));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
  if(old){if(old.provider!==provider||old.sourceUrl!==url.toString()||digest(old.raw)!==old.hash||!Number.isFinite(Date.parse(old.retrievedAt))||Date.parse(old.retrievedAt)>Date.parse(clock()))throw new Error('Job source checkpoint integrity');if(Date.parse(clock())-Date.parse(old.retrievedAt)<=maxAgeMs)return old;}
  const value=await read();if(value.provider!==provider||value.sourceUrl!==url.toString()||digest(value.raw)!==value.hash)throw new Error('Job source capture identity');await atomicPrivateJson(file,value);return value;
 });
}
