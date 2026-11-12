import { z } from 'zod';
import { digest } from './evidence.server';
import { v6StateSchema } from './types';
import type { V6Repository } from './repository.server';

interface WorkerStorageOptions {
 projectUrl:string;projectRef:string;publishableKey:string;ownerId:string;
 /** Provisioned outside this process. Never accept a personal/service-role token. */
 accessToken():Promise<string>;rawSource(hash:string):Promise<string>;fetcher?:typeof fetch;clock?:()=>number;
}
/** Claim parsing is a rejection preflight, NOT signature verification. Every
 * access also requires PostgREST's signed-JWT verification and scoped-role RPC. */
export function workerTokenPreflight(token:string,ownerId:string,issuer:string,at:number){
 if(!Number.isFinite(at))throw new Error('Invalid worker auth clock');
 let c:Record<string,unknown>;try{if(token.split('.').length!==3)throw new Error();c=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString());}catch{throw new Error('Invalid scoped worker token');}
 if(c.sub!==ownerId||c.role!=='edgelab_v6_worker'||c.iss!==issuer||!(c.aud==='authenticated'||Array.isArray(c.aud)&&c.aud.includes('authenticated'))
  ||typeof c.exp!=='number'||!Number.isFinite(c.exp)||c.exp*1000<=at+60000||c.nbf!==undefined&&(typeof c.nbf!=='number'||c.nbf*1000>at)||c.iat!==undefined&&(typeof c.iat!=='number'||c.iat*1000>at+30000))throw new Error('Scoped worker token owner, role, issuer or expiry rejected');
}
export function supabaseV6Repository(options:WorkerStorageOptions):V6Repository {
 z.string().uuid().parse(options.ownerId);if(!/^[a-z0-9]{20}$/.test(options.projectRef)||options.projectUrl!==`https://${options.projectRef}.supabase.co`)throw new Error('Exact Supabase project required');
 let publicKey=options.publishableKey.startsWith('sb_publishable_');
 if(!publicKey)try{publicKey=JSON.parse(Buffer.from(options.publishableKey.split('.')[1],'base64url').toString()).role==='anon';}catch{/* reject */}
 if(!publicKey)throw new Error('Public Supabase API key required');
 const fetcher=options.fetcher??fetch,clock=options.clock??Date.now;
 const request=async(name:string,args:unknown,token:string)=>{
  const response=await fetcher(`${options.projectUrl}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:options.publishableKey,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(30000),redirect:'error'});
  if(!response.ok)throw new Error(`V6 ${name} rejected (HTTP ${response.status}); reread before retry`);
  const text=await response.text();if(Buffer.byteLength(text)>16000000)throw new Error('V6 worker response too large');return JSON.parse(text) as unknown;
 };
 const authorize=async()=>{
  const token=await options.accessToken();workerTokenPreflight(token,options.ownerId,options.projectUrl+'/auth/v1',clock());
  const identity=z.object({ownerId:z.string().uuid(),role:z.literal('edgelab_v6_worker'),cohort:z.literal('v6-prospective')}).strict().parse(await request('v6_worker_identity',{expected_owner:options.ownerId},token));
  if(identity.ownerId!==options.ownerId)throw new Error('Server worker owner mismatch');return token;
 };
 const parse=(value:unknown)=>{const state=v6StateSchema.parse(value);if(state.ownerId!==options.ownerId||state.cohort!=='v6-prospective')throw new Error('V6 hosted owner/cohort mismatch');return state;};
 const read=async()=>parse(await request('v6_load_worker_state',{expected_owner:options.ownerId},await authorize()));
 return {read,async transact(change){
  const before=await read(),next=parse(await change(structuredClone(before)));
  if(JSON.stringify(before)===JSON.stringify(next))return before;
  if(next.revision!==before.revision+1||next.runs.length!==before.runs.length+1)throw new Error('One atomic hosted worker run required');
  for(const key of ['positions','grades','runs'] as const)for(const old of before[key])if(!next[key].some(v=>v.id===old.id&&JSON.stringify(v)===JSON.stringify(old)))throw new Error('Hosted original evidence is append-only');
  const run=next.runs.find(r=>!before.runs.some(old=>old.id===r.id))!,raws:Record<string,string>={};
  for(const o of run.observations){if(!(o.rawHash in raws)){const raw=await options.rawSource(o.rawHash);if(digest(raw)!==o.rawHash)throw new Error('Hosted raw source hash mismatch');raws[o.rawHash]=raw;}}
  const positions=next.positions.filter(p=>!before.positions.some(old=>old.id===p.id)).map(position=>({position,originalInputs:JSON.stringify(position.forecast!.inputs)}));
  const grades=next.grades.filter(g=>!before.grades.some(old=>old.id===g.id)).map(grade=>({grade,originalPosition:JSON.stringify(before.positions.find(p=>p.id===grade.positionId)??next.positions.find(p=>p.id===grade.positionId))}));
  const saved=parse(await request('v6_commit_worker_run',{expected_owner:options.ownerId,expected_revision:before.revision,run_snapshot:run,raw_sources:raws,position_rows:positions,grade_rows:grades},await authorize()));
  if(!saved.runs.some(r=>r.id===run.id))throw new Error('Hosted run failed read-back consistency');return saved;
 }};
}
