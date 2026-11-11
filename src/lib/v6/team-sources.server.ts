import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { atomicPrivateJson,digest,exclusive,retainEvidence,type RawEvidence } from './evidence.server';
const budgetSchema=z.object({day:z.string(),requests:z.number().int().nonnegative(),lastAt:z.number().nonnegative(),blockedUntil:z.number().nonnegative(),starts:z.array(z.number().nonnegative())}).strict();
/** Only documented permanent-free team/game paths. No player stats, trials,
 * accounts, mutable HTTP, redirects, automatic retry or implicit collection.
 */
export function teamSources(options:{root:string;bdlKey?:string;fetcher?:typeof fetch;clock?:()=>number}){
 const clock=options.clock??Date.now,fetcher=options.fetcher??fetch;
 return {async read(provider:'balldontlie'|'thesportsdb',endpoint:string,parameters:Record<string,string>={}):Promise<RawEvidence>{
  if(!['balldontlie','thesportsdb'].includes(provider)||Object.keys(parameters).some(k=>/key|token|password|secret/i.test(k)))throw new Error('Invalid free team source');
  const bdl=provider==='balldontlie';if(bdl&&!options.bdlKey?.trim())throw new Error('BALLDONTLIE_API_KEY is not configured; no request sent');
  if(bdl?!/^\/v1\/(?:teams(?:\/\d+)?|games(?:\/\d+)?)$/.test(endpoint):!/^\/api\/v1\/json\/123\/(?:search_all_leagues|eventsseason|lookupevent)\.php$/.test(endpoint))throw new Error('Only free team/game endpoints permitted');
  const allowed=bdl?['per_page','cursor','seasons[]','dates[]','start_date','end_date','season_type']:['c','s','id'];
  if(Object.keys(parameters).some(k=>!allowed.includes(k))||bdl&&parameters.per_page!==undefined&&(!/^\d+$/.test(parameters.per_page)||Number(parameters.per_page)>100))throw new Error('Invalid free source parameters');
  const url=new URL(endpoint,bdl?'https://api.balldontlie.io':'https://www.thesportsdb.com');for(const [k,v]of Object.entries(parameters))url.searchParams.set(k,v);
  const file=path.join(options.root,provider+'-team-budget.json');
  return exclusive(file+'.lock',async()=>{
   const now=clock(),day=new Date(now).toISOString().slice(0,10);let budget={day,requests:0,lastAt:0,blockedUntil:0,starts:[] as number[]};
   try{const old=budgetSchema.parse(JSON.parse(await fs.readFile(file,'utf8')));if(old.day===day)budget=old;}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
   budget.starts=budget.starts.filter(t=>now-t<60000);
   if(budget.requests>=(bdl?60:10)||now<budget.blockedUntil||budget.lastAt&&now-budget.lastAt<(bdl?12500:3000)||budget.starts.length>=(bdl?5:20))throw new Error('Free team-source quota/cooldown; no request sent');
   budget.requests++;budget.lastAt=now;budget.starts.push(now);await atomicPrivateJson(file,budget);
   const headers:Record<string,string>={Accept:'application/json'};if(bdl)headers.Authorization=options.bdlKey!;
   let response:Response;try{response=await fetcher(url,{method:'GET',headers,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000)});}catch{throw new Error('Team source transport failed; reservation retained, no retry');}
   const retry=response.headers.get('retry-after'),seconds=retry&&/^\d+$/.test(retry)?Number(retry):null;
   if(response.status===429){const date=retry?Date.parse(retry):NaN;budget.blockedUntil=Math.max(now+60000,seconds!==null?now+seconds*1000:Number.isFinite(date)?date:0);await atomicPrivateJson(file,budget);}
   if(!response.body)throw new Error('Empty team source response');const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0;
   try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>8000000){await reader.cancel();throw new Error('Team source body exceeds 8 MiB');}chunks.push(part.value);}}finally{reader.releaseLock();}
   const raw=Buffer.concat(chunks).toString('utf8');if(bdl&&raw.includes(options.bdlKey!))throw new Error('Credential echo discarded');
   const evidence:RawEvidence={id:crypto.randomUUID(),provider,sourceUrl:url.toString(),retrievedAt:new Date(clock()).toISOString(),sourceUpdatedAt:null,raw,hash:digest(raw)};
   await retainEvidence(options.root,evidence);
   await atomicPrivateJson(path.join(options.root,'source-quota-receipts',evidence.id+'.json'),{provider,sourceUrl:evidence.sourceUrl,status:response.status,at:evidence.retrievedAt,localDailyReservations:budget.requests,retryAfter:retry,providerRemaining:response.headers.get('x-ratelimit-remaining')});
   if(!response.ok)throw new Error(`Team source HTTP ${response.status}; evidence ${evidence.hash}; no upgrade or retry`);
   try{JSON.parse(raw);}catch{throw new Error(`Non-JSON team response retained ${evidence.hash}`);}return evidence;
  });
 }};
}
