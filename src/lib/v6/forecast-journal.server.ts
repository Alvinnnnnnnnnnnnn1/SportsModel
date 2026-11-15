import fs from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import {z} from 'zod';
import {digest,exclusive} from './evidence.server';

const stamp=z.string().datetime({offset:true}),hash=z.string().regex(/^[a-f0-9]{64}$/),prob=z.number().min(0).max(1);
export const dailyForecastSchema=z.object({
 // Version 1 has always been NBA full-game analysis. Defaults normalize the
 // initial immutable checkpoint on read without rewriting its original bytes.
 sport:z.literal('NBA').default('NBA'),period:z.literal('full_game').default('full_game'),overtime:z.enum(['included','unknown']).default('included'),
 id:hash,fixtureId:z.string(),fixtureReceipt:z.string().uuid(),fixtureSourceHash:hash,home:z.string(),away:z.string(),
 startsAt:stamp,generatedAt:stamp,inputCutoff:stamp,correlationGroup:z.string(),
 family:z.enum(['moneyline','spread','total']),side:z.enum(['home','away','over','under']),line:z.number().finite().nullable(),
 modelId:z.string(),version:z.string(),artifactHash:hash.nullable(),inputHash:hash,
 probability:prob.nullable(),pushProbability:prob.nullable(),baselineProbability:prob.nullable(),baselinePushProbability:prob.nullable(),
 predictedMargin:z.number().finite().nullable(),predictedTotal:z.number().finite().nullable(),sensitivity:z.tuple([prob,prob]).nullable(),
 sourceHashes:z.array(hash).min(1),exclusions:z.array(z.string()),limitations:z.array(z.string()),
 lineSource:z.enum(['fixed_analysis','sportsbet']),quote:z.object({odds:z.number().min(1.0001).max(10000),quoteAt:stamp,sourceReceipt:z.string().uuid(),sourceHash:hash,providerMarket:z.string(),deVigProbability:prob.nullable()}).strict().nullable(),paperRegistration:z.literal(false),
}).strict().superRefine((f,c)=>{
 if(Date.parse(f.inputCutoff)>Date.parse(f.generatedAt)||Date.parse(f.generatedAt)>=Date.parse(f.startsAt)-60000)c.addIssue({code:'custom',message:'Forecast must precede the conservative event deadline'});
 if((f.probability===null)!==(f.pushProbability===null)||f.probability!==null&&f.probability+f.pushProbability!>1+1e-10)c.addIssue({code:'custom',message:'Invalid outcome probability mass'});
 if(f.family==='moneyline'?(f.line!==null||!['home','away'].includes(f.side)):(f.line===null||!['spread','total'].includes(f.family)))c.addIssue({code:'custom',message:'Exact market identity required'});
 if(f.probability!==null&&!f.artifactHash)c.addIssue({code:'custom',message:'Numerical model artifact required'});
 if(f.family==='spread'&&!['home','away'].includes(f.side)||f.family==='total'&&(!['over','under'].includes(f.side)||f.line===null||f.line<0))c.addIssue({code:'custom',message:'Invalid spread/total identity'});
 if(f.probability!==null&&f.overtime!=='included')c.addIssue({code:'custom',message:'Numerical forecast requires explicit full-game terms'});
});
export type DailyForecast=z.infer<typeof dailyForecastSchema>;
export const forecastResultSchema=z.object({fixtureId:z.string(),at:stamp,status:z.enum(['verified','unresolved']),reason:z.string().nullable(),homeScore:z.number().int().nonnegative().nullable(),awayScore:z.number().int().nonnegative().nullable(),sourceHashes:z.array(hash),sourceEventIds:z.array(z.string())}).strict();
export type ForecastResult=z.infer<typeof forecastResultSchema>;
const excludedFixtureSchema=z.object({fixtureId:z.string(),sourceReceipt:z.string().uuid(),sourceHash:hash,reason:z.string(),recordedAt:stamp}).strict();
const eventSchema=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('freeze'),runId:z.string(),forecasts:z.array(dailyForecastSchema)}).strict(),
 z.object({kind:z.literal('results'),results:z.array(forecastResultSchema)}).strict(),
 z.object({kind:z.literal('excluded_fixtures'),fixtures:z.array(excludedFixtureSchema)}).strict(),
]);
export interface ForecastSnapshot {revision:number;headHash:string|null;forecasts:DailyForecast[];results:ForecastResult[];excludedFixtures:z.infer<typeof excludedFixtureSchema>[];lastFreezeAt:string|null;lastCommitAt:string|null;}
/** Separate forecast-only hash chain. It has no PAPER or cash repository port.
 * Atomic linked publication + fsync; hashes detect mutation, not privileged truncation. */
export function forecastJournal(root:string,ownerId:string,clock=()=>new Date().toISOString()){
 const directory=path.join(root,'forecast-ledger',digest(ownerId));
 const load=async():Promise<ForecastSnapshot>=>{
  try{const resolved=await fs.realpath(directory),base=await fs.realpath(root);if(!resolved.startsWith(base+path.sep))throw new Error('Forecast journal escaped private root');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
  let names:string[];try{names=(await fs.readdir(directory)).filter(n=>/^\d{12}\.json$/.test(n)).sort();}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;names=[];}
  const result:ForecastSnapshot={revision:0,headHash:null,forecasts:[],results:[],excludedFixtures:[],lastFreezeAt:null,lastCommitAt:null};let lastAt=0;
  for(const [i,name] of names.entries()){
   if(name!==String(i+1).padStart(12,'0')+'.json')throw new Error('Forecast journal gap');
   const f=await fs.open(path.join(directory,name),constants.O_RDONLY|constants.O_NOFOLLOW);let raw;
   try{if(!(await f.stat()).isFile())throw new Error('Forecast journal file');raw=JSON.parse(await f.readFile('utf8'));}finally{await f.close();}
   const {hash:entryHash,...entry}=raw;
   if(entry.ownerId!==ownerId||entry.format!=='edgelab.forecast-journal'||entry.version!==1||entry.revision!==i+1||entry.previousHash!==result.headHash||digest(JSON.stringify(entry))!==entryHash||!Number.isFinite(Date.parse(entry.at))||Date.parse(entry.at)<lastAt)throw new Error('Forecast journal integrity/owner failure');
   const event=eventSchema.parse(entry.event);
   if(event.kind==='freeze'){
    for(const row of event.forecasts){if(result.forecasts.some(f=>f.id===row.id)||Date.parse(row.generatedAt)>Date.parse(entry.at)||Date.parse(entry.at)>=Date.parse(row.startsAt)-60000)throw new Error('Duplicate or retrospective forecast publication');result.forecasts.push(row);}
    result.lastFreezeAt=entry.at;
   }else if(event.kind==='results')for(const row of event.results){if(Date.parse(row.at)>Date.parse(entry.at)||!result.forecasts.some(f=>f.fixtureId===row.fixtureId&&Date.parse(f.startsAt)<Date.parse(row.at)))throw new Error('Orphan/future forecast result');result.results.push(row);}
   else result.excludedFixtures.push(...event.fixtures);
   result.revision=i+1;result.headHash=entryHash;result.lastCommitAt=entry.at;lastAt=Date.parse(entry.at);
  }
  return result;
 };
 const append=async(event:z.infer<typeof eventSchema>,beforeCommit?:()=>Promise<void>)=>exclusive(path.join(directory,'writer.lock'),async()=>{
  const previous=await load();const value=eventSchema.parse(event);
  if(value.kind==='freeze'){for(const row of value.forecasts){const old=previous.forecasts.find(f=>f.id===row.id);if(old&&JSON.stringify(old)!==JSON.stringify(row))throw new Error('Frozen forecast mutation refused');}value.forecasts=value.forecasts.filter(f=>!previous.forecasts.some(p=>p.id===f.id));if(new Set(value.forecasts.map(f=>f.id)).size!==value.forecasts.length)throw new Error('Duplicate forecast in batch');}
  else if(value.kind==='results')value.results=value.results.filter(r=>{const old=previous.results.filter(p=>p.fixtureId===r.fixtureId).at(-1);return !old||JSON.stringify({...old,at:null})!==JSON.stringify({...r,at:null});});
  else value.fixtures=value.fixtures.filter(r=>!previous.excludedFixtures.some(p=>p.fixtureId===r.fixtureId&&p.sourceHash===r.sourceHash&&p.reason===r.reason));
  if(value.kind==='freeze'?!value.forecasts.length:value.kind==='results'?!value.results.length:!value.fixtures.length)return previous;
  await beforeCommit?.();const at=stamp.parse(clock());
  if(previous.lastCommitAt&&Date.parse(at)<Date.parse(previous.lastCommitAt))throw new Error('Forecast clock moved backwards');
  if(value.kind==='freeze'&&value.forecasts.some(f=>Date.parse(f.generatedAt)>Date.parse(at)||Date.parse(at)>=Date.parse(f.startsAt)-60000))throw new Error('Forecast commit deadline elapsed');
  if(value.kind==='results'&&value.results.some(r=>Date.parse(r.at)>Date.parse(at)||!previous.forecasts.some(f=>f.fixtureId===r.fixtureId&&Date.parse(f.startsAt)<Date.parse(r.at))))throw new Error('Invalid result commit');
  const entry={format:'edgelab.forecast-journal',version:1,ownerId,revision:previous.revision+1,previousHash:previous.headHash,at,event:value},body=JSON.stringify({...entry,hash:digest(JSON.stringify(entry))});
  const temporary=path.join(directory,crypto.randomUUID()+'.tmp'),target=path.join(directory,String(entry.revision).padStart(12,'0')+'.json');
  const file=await fs.open(temporary,'wx',0o600);try{await file.writeFile(body);await file.sync();}finally{await file.close();}
  try{await fs.link(temporary,target);}finally{await fs.unlink(temporary);}
  const dir=await fs.open(directory,'r');try{await dir.sync();}finally{await dir.close();}return load();
 });
 return {read:load,freeze:(runId:string,forecasts:DailyForecast[],beforeCommit?:()=>Promise<void>)=>append({kind:'freeze',runId,forecasts},beforeCommit),results:(results:ForecastResult[],beforeCommit?:()=>Promise<void>)=>append({kind:'results',results},beforeCommit),exclude:(fixtures:z.infer<typeof excludedFixtureSchema>[],beforeCommit?:()=>Promise<void>)=>append({kind:'excluded_fixtures',fixtures},beforeCommit)};
}
