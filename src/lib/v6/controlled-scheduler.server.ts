import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { atomicPrivateJson,digest,exclusive } from './evidence.server';
import { activationReasons,runControlledWorker,type ControlledConfig } from './controlled-activation';
import type { V6Repository } from './repository.server';
import type { V6ReadProvider,V6IndependentModel } from './worker';
const stamp=z.string().datetime({offset:true});
const jobSchema=z.object({id:z.string(),kind:z.enum(['discovery','pre_start','results']),dueAt:stamp,deadline:stamp,
 status:z.enum(['pending','running','completed','missed','blocked','failed']),attempts:z.number().int().nonnegative(),nextAt:stamp,leaseUntil:stamp.nullable(),lastError:z.string().nullable(),controlHash:z.string().nullable()}).strict();
export type ScheduledJob=z.infer<typeof jobSchema>;
const stateSchema=z.object({version:z.literal(1),jobs:z.array(jobSchema),attempts:z.array(z.object({jobId:z.string(),at:stamp,status:z.string(),detail:z.string().nullable()}).strict())}).strict();
type SchedulerState=z.infer<typeof stateSchema>;
const localParts=(at:number)=>Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Melbourne',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(at).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));
/** Wall-clock jobs at 18/19h avoid the ambiguous DST transition hour. */
function wallClock(at:number,hour:number){const p=localParts(at),target=Date.UTC(p.year,p.month-1,p.day,hour);let guess=target;
 for(let i=0;i<3;i++){const x=localParts(guess);guess+=target-Date.UTC(x.year,x.month-1,x.day,x.hour,x.minute,x.second);}return guess;}
export function planControlledJobs(fixtures:{id:string;startsAt:string}[],now:string):ScheduledJob[]{
 stamp.parse(now);const n=Date.parse(now),jobs:ScheduledJob[]=[],make=(kind:ScheduledJob['kind'],at:number,deadline:number,id:string)=>({id,kind,dueAt:new Date(at).toISOString(),deadline:new Date(deadline).toISOString(),status:'pending' as const,attempts:0,nextAt:new Date(at).toISOString(),leaseUntil:null,lastError:null,controlHash:null});
 for(const offset of [0,86400000])for(const [kind,hour]of [['discovery',19],['results',18]] as const){const due=wallClock(n+offset,hour);jobs.push(make(kind,due,due+(kind==='results'?12:24)*3600000,kind+':'+new Date(due).toISOString()));}
 const windows=new Map<number,number>();
 for(const f of fixtures){stamp.parse(f.startsAt);const start=Date.parse(f.startsAt);if(start<=n||start>n+48*3600000)continue;
  const bucket=Math.floor((start-20*60000)/(30*60000))*30*60000;windows.set(bucket,Math.min(windows.get(bucket)??Infinity,start));}
 for(const [due,deadline]of windows)jobs.push(make('pre_start',due,deadline,'pre_start:'+new Date(due).toISOString()));
 return jobs;
}
export interface ScheduledPorts {
 repository:V6Repository;
 prepare(job:ScheduledJob):Promise<{provider:V6ReadProvider;model:V6IndependentModel|null}>;
 readControl():Promise<{config:ControlledConfig;manifest:unknown;receipt:unknown}>;
 clock():string;
}
/** A tick executes the registered V6 worker, never a chat message. Source work
 * precedes the worker's atomic commit/latch. One operation can register all
 * qualifying positions; the scheduler does not impose position/exposure limits.
 */
export async function runControlledTick(root:string,ports:ScheduledPorts,planned:ScheduledJob[]){
 const controls=await ports.readControl(),at=ports.clock(),file=path.join(root,'scheduler.json'),controlHash=digest(JSON.stringify(controls));
 if(controls.config.mode==='disabled'||controls.config.killSwitch)return {status:'disabled',workerInvoked:false,job:null};
 if(!controls.config.sourcesEnabled)return {status:'blocked',workerInvoked:false,job:null,reasons:['sources_not_enabled']};
 const gates=await activationReasons(controls.config,controls.manifest,controls.receipt,at);
 if(controls.config.mode==='armed'&&gates.length)return {status:'activation_blocked',workerInvoked:false,job:null,reasons:gates};
 const load=async():Promise<SchedulerState>=>{try{return stateSchema.parse(JSON.parse(await fs.readFile(file,'utf8')));}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return {version:1,jobs:[],attempts:[]};throw e;}};
 const claimed=await exclusive(file+'.lock',async()=>{
  const state=await load(),now=Date.parse(at);
  for(const p of planned)if(!state.jobs.some(j=>j.id===p.id))state.jobs.push(jobSchema.parse(p));
  for(const j of state.jobs){
   if(['pending','running'].includes(j.status)&&Date.parse(j.deadline)<=now){j.status='missed';j.lastError='deadline_elapsed_no_backdating';}
   else if(j.status==='running'&&j.leaseUntil&&Date.parse(j.leaseUntil)<=now){j.status='pending';j.nextAt=at;j.lastError='expired_lease_recovery';}
   else if(j.status==='blocked'&&j.controlHash!==controlHash){j.status='pending';j.nextAt=at;}
  }
  const job=state.jobs.filter(j=>j.status==='pending'&&Date.parse(j.nextAt)<=now&&Date.parse(j.deadline)>now).sort((a,b)=>a.dueAt.localeCompare(b.dueAt))[0];
  if(job){job.status='running';job.attempts++;job.controlHash=controlHash;job.leaseUntil=new Date(now+15*60000).toISOString();state.attempts.push({jobId:job.id,at,status:'claimed',detail:null});}
  await atomicPrivateJson(file,state);return job?structuredClone(job):null;
 });
 if(!claimed)return {status:'idle',workerInvoked:false,job:null};
 let status='failed',detail:string|null=null,workerInvoked=false;
 try{
  const latest=await ports.readControl();if(digest(JSON.stringify(latest))!==controlHash)throw new Error('Control changed after job claim');
  const prepared=await ports.prepare(claimed);
  const result=await runControlledWorker(ports.repository,prepared.provider,prepared.model,controls.config,controls.manifest,controls.receipt,{runId:'scheduled:'+claimed.id,now:ports.clock(),clock:ports.clock,readControl:ports.readControl});
  workerInvoked=['paper_run_completed','dry_run_completed','already_processed'].includes(result.status);status=workerInvoked?'completed':'blocked';detail=result.status;
 }catch(e){detail=e instanceof Error?e.message:'Worker operation failed';}
 await exclusive(file+'.lock',async()=>{
  const state=await load(),job=state.jobs.find(j=>j.id===claimed.id);if(!job||job.status!=='running'||job.attempts!==claimed.attempts)throw new Error('Scheduler lease/revision changed');
  job.status=status==='completed'?'completed':status==='blocked'?'blocked':job.attempts>=6?'failed':'pending';job.lastError=status==='completed'?null:detail;job.leaseUntil=null;
  if(job.status==='pending'){const delay=[2,10,30,60,60,60][Math.min(5,job.attempts-1)];job.nextAt=new Date(Date.parse(ports.clock())+delay*60000).toISOString();}
  state.attempts.push({jobId:job.id,at:ports.clock(),status:job.status,detail});await atomicPrivateJson(file,state);
 });
 await atomicPrivateJson(path.join(root,'health.json'),{at:ports.clock(),status,workerInvoked,lastJobId:claimed.id,detail,externalAlerts:false});
 if(status!=='completed')await atomicPrivateJson(path.join(root,'alerts',digest(claimed.id+':'+claimed.attempts)+'.json'),{at:ports.clock(),jobId:claimed.id,detail,delivery:'local_outbox_not_delivered',sentExternally:false});
 return {status,workerInvoked,job:claimed.id,detail};
}
