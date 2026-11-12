import { createClient } from '@supabase/supabase-js';
import path from 'node:path';
import { isV6DashboardRequest } from './dashboard-origin';
import {loadCloudDashboard} from './cloud/dashboard.server';
import { loadV6Dashboard, readDashboardAccess } from './dashboard.server';
import {pilotResearchOwner} from './source-pilot.server';
import type { V6Dashboard } from './dashboard';
interface Ports {
 verifyUser(token:string):Promise<string|null>;
 ownsAnchor(token:string,userId:string,batchId:string):Promise<boolean>;
 access():Promise<{historyBatchId:string}>;
 load(userId:string,batchId:string,token?:string):Promise<V6Dashboard>;
}
function defaultPorts():Ports {
 const root=path.join(process.cwd(),'.local/v6');
 const cloud=process.env.VERCEL==='1'||process.env.V6_EVIDENCE_MODE==='cloud';
 const client=(token:string)=>{const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;if(!url||!key||key.startsWith('sb_secret_'))throw new Error('Configuration');return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{headers:{Authorization:`Bearer ${token}`},fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(10000)})}});};
 return {verifyUser:async token=>{const {data,error}=await client(token).auth.getUser(token);return error?null:data.user?.id??null;},
 ownsAnchor:async(token,userId,batchId)=>{const {data,error}=await client(token).from('historical_import_batches').select('id').eq('id',batchId).eq('user_id',userId).maybeSingle();if(error)throw new Error('Owner check unavailable');return data?.id===batchId;},
 access:async()=>{if(!cloud)return readDashboardAccess(root);const historyBatchId=process.env.V6_HISTORY_BATCH_ID;if(!historyBatchId||!/^\b[0-9a-f-]{36}$/.test(historyBatchId))throw new Error('Cloud binding missing');return {historyBatchId};},
 load:async(owner,batchId,token)=>cloud?loadCloudDashboard(client(token!),owner,batchId):loadV6Dashboard(root,owner,new Date().toISOString(),await pilotResearchOwner(root,batchId,owner))};
}
/** Existing normal authentication + an RLS-protected archived batch bind local evidence
 * to the personal owner. No service key, enrollment, V5 write or arbitrary file parameter. */
export async function handleV6DashboardRequest(request:Request,ports:Ports=defaultPorts()):Promise<Response>{
 const send=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store','Vary':'Authorization, Origin','X-Content-Type-Options':'nosniff',...(/^[a-f0-9]{40}$/.test(process.env.VERCEL_GIT_COMMIT_SHA??'')?{'X-EdgeLab-Revision':process.env.VERCEL_GIT_COMMIT_SHA!}:{}), 'X-EdgeLab-Evidence-Mode':process.env.VERCEL==='1'||process.env.V6_EVIDENCE_MODE==='cloud'?'cloud':'local'}});
 if(request.method!=='GET')return send({error:'Read-only endpoint.'},405);
 if(!isV6DashboardRequest(request))return send({error:'Trusted same-origin dashboard access required.'},403);
 if(new URL(request.url).search)return send({error:'Dashboard parameters are not supported.'},400);
 const token=request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9_.-]+)$/)?.[1];if(!token)return send({error:'Sign into your existing private workspace.'},401);
 try{
  const owner=await ports.verifyUser(token);if(!owner)return send({error:'Valid private session required.'},401);
  let access:{historyBatchId:string};try{access=await ports.access();}catch{return send({error:process.env.VERCEL==='1'||process.env.V6_EVIDENCE_MODE==='cloud'?'Cloud research data not connected. Owner binding and private evidence must be provisioned.':'Local V6 dashboard owner binding is unavailable. See docs/v6-dashboard.md.'},503);}
  if(!await ports.ownsAnchor(token,owner,access.historyBatchId))return send({error:'This local evidence belongs to a different private workspace.'},403);
  return send(await ports.load(owner,access.historyBatchId,token));
 }catch{return send({error:process.env.VERCEL==='1'||process.env.V6_EVIDENCE_MODE==='cloud'?'Cloud research data not connected or failed validation. No data or worker state was changed.':'V6 evidence is unavailable. No data or worker state was changed.'},503);}
}
