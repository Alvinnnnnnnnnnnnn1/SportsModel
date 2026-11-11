import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { atomicPrivateJson,digest,exclusive,retainEvidence,type RawEvidence } from './evidence.server';

const budgetSchema=z.object({period:z.string(),reserved:z.number().int().nonnegative(),remaining:z.number().int().nonnegative().nullable(),used:z.number().int().nonnegative().nullable(),lastRequest:z.number().nonnegative(),uncertain:z.boolean(),freeConfirmed:z.boolean().default(false)}).strict();
export interface FreeSourceOptions { root:string;oddsKey?:string;nbaKey?:string;fetcher?:typeof fetch;clock?:()=>number; }
/** Explicit read-only transport. Every V6 collector/worker shares this on-disk quota.
 * Uncertain reservations are never silently refunded after transport failure.
 */
export function freeSources(options:FreeSourceOptions) {
  const fetcher=options.fetcher??fetch,clock=options.clock??Date.now;
  return { async read(provider:RawEvidence['provider'],endpoint:string,parameters:Record<string,string>={},oddsCost=0):Promise<RawEvidence> {
    if(!['api-nba','api-basketball','the-odds-api.com'].includes(provider))throw new Error('Unapproved source provider');
    if(Object.keys(parameters).some(k=>/key|token|secret|password/i.test(k)))throw new Error('Credentials are transport configuration only');
    const odds=provider==='the-odds-api.com',basketball=provider==='api-basketball',secret=odds?options.oddsKey:options.nbaKey;
    if(!secret)throw new Error('Optional server-only source key is not configured');
    if(odds ? !/^\/v4\/sports(?:\/basketball_nba\/(?:events(?:\/[a-zA-Z0-9_-]+\/odds)?|odds|participants))?$/.test(endpoint)
      : !(basketball?['/status','/leagues','/seasons','/games','/games/statistics/players','/players','/teams']:['/status','/games','/players','/players/statistics','/teams']).includes(endpoint))throw new Error('Unapproved read endpoint');
    const expectedCost=odds&&endpoint.endsWith('/odds')?1:0;
    if(oddsCost!==expectedCost)throw new Error('Unexpected credit cost; only one-market NBA reads are supported');
    if(odds&&expectedCost&&(parameters.markets!=='player_points'&&parameters.markets!=='h2h'||parameters.bookmakers!=='sportsbet'))throw new Error('Only one Sportsbet market per request is permitted');
    const url=new URL(endpoint,odds?'https://api.the-odds-api.com':basketball?'https://v1.basketball.api-sports.io':'https://v2.nba.api-sports.io');
    for(const [key,value]of Object.entries(parameters))url.searchParams.set(key,value);
    const sourceUrl=url.toString(),file=path.join(options.root,odds?'odds-shared-budget.json':basketball?'basketball-pilot-budget.json':'nba-pilot-budget.json');
    return exclusive(file+'.lock',async()=>{
      const now=clock(),period=new Date(now).toISOString().slice(0,odds?7:10);
      let budget={period,reserved:0,remaining:null as number|null,used:null as number|null,lastRequest:0,uncertain:false,freeConfirmed:false};
      try {const saved=budgetSchema.parse(JSON.parse(await fs.readFile(file,'utf8')));if(saved.period===period)budget=saved;}
      catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
      if(odds&&budget.reserved===0) {
        try{const previous=z.object({period:z.string(),reservations:z.number().int().nonnegative()}).parse(JSON.parse(await fs.readFile(path.join(options.root,'odds-pilot-budget.json'),'utf8')));if(previous.period===period)budget.reserved=previous.reservations;}
        catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
      }
      const cost=odds?oddsCost:endpoint==='/status'?0:1;
      // New task authorises a bounded two-credit extension to the previous four.
      // This is an acquisition budget, never a paper count/exposure limit.
      const ceiling=odds?6:10;
      if(budget.uncertain&&cost)throw new Error('Source quota is uncertain; successful free status/catalogue read required');
      if(cost&&!budget.freeConfirmed)throw new Error('Verify the free plan through a status/catalogue read first');
      if(budget.reserved+cost>ceiling||budget.remaining!==null&&budget.remaining-cost<(odds?100:20))throw new Error('Free-source reserve/bounded pilot allowance reached');
      const spacing=odds?1000:16000;
      if(budget.lastRequest&&now-budget.lastRequest<spacing)throw new Error('Source cooldown; no request was sent');
      budget.reserved+=cost;budget.lastRequest=now;budget.uncertain=true;
      await atomicPrivateJson(file,budget);
      const headers:Record<string,string>={Accept:'application/json'};
      if(odds)url.searchParams.set('apiKey',secret);else headers['x-apisports-key']=secret;
      let response:Response;
      try{response=await fetcher(url,{method:'GET',headers,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(12000)});}catch{throw new Error('Source transport failed; reservation retained, no retry');}
      const numberHeader=(key:string)=>{const n=response.headers.get(key);return n!==null&&/^\d+$/.test(n)&&Number.isSafeInteger(Number(n))?Number(n):null;};
      const remaining=numberHeader(odds?'x-requests-remaining':'x-ratelimit-requests-remaining');
      const used=numberHeader('x-requests-used');
      budget.remaining=remaining;budget.used=used;
      const chunks:Uint8Array[]=[];let size=0;
      if(!response.body)throw new Error('Empty source body');
      const reader=response.body.getReader();
      try{while(true){const next=await reader.read();if(next.done)break;size+=next.value.byteLength;if(size>8000000){await reader.cancel();throw new Error('Source response exceeds 8 MiB');}chunks.push(next.value);}}finally{reader.releaseLock();}
      const raw=Buffer.concat(chunks).toString('utf8');
      // Never persist a response that echoes a private key.
      if(raw.includes(secret))throw new Error('Source echoed credentials; body discarded');
      let value:Record<string,unknown>;try{value=JSON.parse(raw);}catch{throw new Error('Malformed source JSON; reservation retained');}
      const quotaKnown=odds?remaining!==null&&used!==null&&remaining+used===500:remaining!==null;
      await atomicPrivateJson(path.join(options.root,'source-quota-receipts',crypto.randomUUID()+'.json'),{
        provider,sourceUrl,status:response.status,observedAt:new Date(clock()).toISOString(),requestedCost:cost,remaining,used,
        lastCost:numberHeader('x-requests-last'),quotaKnown});
      budget.uncertain=!quotaKnown;if(odds)budget.freeConfirmed=quotaKnown;else if(endpoint==='/status')budget.freeConfirmed=false;await atomicPrivateJson(file,budget);
      if(!odds&&endpoint==='/status') {
        if(!response.ok||!quotaKnown)throw new Error('Free status/quota could not be established');
        const safe=z.object({response:z.object({subscription:z.object({active:z.boolean(),plan:z.string()}),requests:z.object({limit_day:z.number(),current:z.number().int().nonnegative().optional()})})}).parse(value);
        if(!safe.response.subscription.active||safe.response.subscription.plan!=='Free'||safe.response.requests.limit_day!==100)throw new Error('An active free NBA subscription was not established');
        budget.freeConfirmed=true;await atomicPrivateJson(file,budget);
        // Status includes personal account fields. Return/store only subscription evidence.
        const sanitized=JSON.stringify(safe);const e:RawEvidence={id:crypto.randomUUID(),provider,sourceUrl,retrievedAt:new Date(clock()).toISOString(),sourceUpdatedAt:null,raw:sanitized,hash:digest(sanitized)};
        return retainEvidence(options.root,e);
      }
      const evidence:RawEvidence={id:crypto.randomUUID(),provider,sourceUrl,retrievedAt:new Date(clock()).toISOString(),sourceUpdatedAt:null,raw,hash:digest(raw)};
      await retainEvidence(options.root,evidence);
      if(!response.ok)throw new Error(`Source HTTP ${response.status}; retained evidence ${evidence.hash}; no retry or upgrade`);
      if(!odds&&value.errors&&Object.keys(value.errors).length)throw new Error(`${basketball?'Basketball':'NBA'} scope rejected; retained evidence ${evidence.hash}`);
      if(!quotaKnown)throw new Error(`Free quota could not be established; retained evidence ${evidence.hash}`);
      return evidence;
    });
  }};
}
