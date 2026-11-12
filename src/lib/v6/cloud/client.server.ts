import {z} from 'zod';
import {digest} from '../evidence.server';
import {sourcePilotPlanSchema} from '../source-pilot';
import {collectionReceiptSchema,controlledConfigSchema} from '../controlled-activation';
export const ORIGINAL_PLAN='c81a3f7ee8c7b441276e6459befef36da52d4855fcb237aeb392f03b5591c879';
export const ORIGINAL_RECEIPT='c5f236058560271ff86fe4c3f7c042d8a93ced970e171835adfb64c6ded55a16';
export const ORIGINAL_CONFIG='2badec1068928b44c272c7641724d6e0d7d8dc675e1f03bdb85b9c0f169f7177';
const stamp=z.string().datetime({offset:true});
export const cloudPilotSchema=z.object({id:z.string().uuid(),user_id:z.string().uuid(),history_batch_id:z.string().uuid(),namespace:z.string(),plan_hash:z.string().regex(/^[a-f0-9]{64}$/),plan_raw:z.string(),receipt_hash:z.string().regex(/^[a-f0-9]{64}$/),receipt_raw:z.string(),starts_at:stamp,expires_at:stamp,active_host:z.enum(['none','cloud']),stopped:z.boolean(),epoch:z.number().int(),revision:z.number().int(),snapshot_hash:z.string().nullable(),transfer_snapshot_hash:z.string().nullable().optional(),transfer_approval:z.unknown().optional(),lease_until:stamp.nullable(),last_attempt_at:stamp.nullable()});
export type CloudPilot=z.infer<typeof cloudPilotSchema>;
export interface SourceQuotaJournal {
 reserve(provider:'odds'|'bdl',endpoint:string,parameters:Record<string,string>,cost:number):Promise<string>;
 complete(id:string,result:{used:number|null;remaining:number|null;blockedUntil?:string|null}):Promise<void>;
}
export function originalControls(pilot:CloudPilot){
 if(pilot.plan_hash!==ORIGINAL_PLAN||pilot.receipt_hash!==ORIGINAL_RECEIPT||digest(pilot.plan_raw)!==ORIGINAL_PLAN||digest(pilot.receipt_raw)!==ORIGINAL_RECEIPT)throw new Error('Original source approval hash mismatch');
 const plan=sourcePilotPlanSchema.parse(JSON.parse(pilot.plan_raw)),receipt=collectionReceiptSchema.parse(JSON.parse(pilot.receipt_raw));
 if(Date.parse(plan.startsAt)!==Date.parse(pilot.starts_at)||Date.parse(plan.expiresAt)!==Date.parse(pilot.expires_at)||plan.historyBatchId!==pilot.history_batch_id||plan.ownerId!==pilot.namespace||receipt.ownerId!==pilot.namespace||receipt.pilot?.planHash!==ORIGINAL_PLAN||JSON.stringify(receipt.pilot.plan)!==JSON.stringify(plan))throw new Error('Source approval owner mismatch');
 const config=controlledConfigSchema.parse({version:1,ownerId:plan.ownerId,mode:'dry_run',killSwitch:false,sourcesEnabled:true,modelManifest:null,activationReceipt:'.local/v6/source-pilot/approved-receipt.json',monthlyOddsCeiling:60,sourceOnly:true,sourcePilotPlanHash:ORIGINAL_PLAN,persistence:null});
 // The original file used this property order. Schema defaults must not change its bytes.
 if(digest(JSON.stringify(config,null,2))!==ORIGINAL_CONFIG)throw new Error('Source config drift');
 return {plan,controls:{config,manifest:null,receipt}};
}
export function cloudSourceClient(options:{url:string;publishableKey:string;pilotId:string;capability:string;fetcher?:typeof fetch}){
 const url=new URL(options.url);if(url.origin!=='https://ilgoswfckkzpoktabbfi.supabase.co'||url.pathname!=='/'||url.search||url.hash||url.username||url.password)throw new Error('Intended Supabase project required');
 let publicKey=options.publishableKey?.startsWith('sb_publishable_');if(!publicKey)try{publicKey=JSON.parse(Buffer.from(options.publishableKey.split('.')[1],'base64url').toString()).role==='anon';}catch{/* reject */}
 z.string().uuid().parse(options.pilotId);if(!publicKey||!/^[a-f0-9]{64}$/.test(options.capability)||options.publishableKey.startsWith('sb_secret_'))throw new Error('Narrow source-only capability and public key required');
 return {async call<T=unknown>(action:string,payload:Record<string,unknown>={}):Promise<T>{
  let response:Response;try{response=await(options.fetcher??fetch)(new URL('/rest/v1/rpc/v6_source_dispatch',url),{method:'POST',headers:{apikey:options.publishableKey,'Content-Type':'application/json'},body:JSON.stringify({p_id:options.pilotId,p_token:options.capability,p_action:action,p:payload}),redirect:'error',cache:'no-store',signal:AbortSignal.timeout(30000)});}catch{throw new Error('Cloud research transport unavailable; no implicit retry');}
  if(!response.ok)throw new Error('Cloud source operation rejected; inspect private database audit');
  return await response.json() as T;
 }};
}
export function validateHostTransfer(raw:unknown,pilot:CloudPilot,now:string){
 const transfer=z.object({format:z.literal('edgelab.v6-source-host-transfer'),version:z.literal(1),approved:z.literal(true),approvedAt:stamp,approvalReference:z.string().min(12),planHash:z.literal(ORIGINAL_PLAN),snapshotHash:z.string().regex(/^[a-f0-9]{64}$/),target:z.literal('github_actions'),localStopped:z.literal(true),localInFlight:z.literal(false),paperRegistrations:z.literal(false),paperSettlements:z.literal(false),codeRevision:z.string().regex(/^[a-f0-9]{40}$/)}).strict().parse(raw);
 if(transfer.snapshotHash!==pilot.transfer_snapshot_hash||Date.parse(transfer.approvedAt)>Date.parse(now)||Date.parse(now)>=Date.parse(pilot.expires_at))throw new Error('Transfer approval mismatch or expired');return transfer;
}
