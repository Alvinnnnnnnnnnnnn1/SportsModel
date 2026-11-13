/** Prepared owner-JWT provisioning utility. Default is OFFLINE VALIDATION ONLY.
 * No capability issuance, activation, source request, Mac control or PAPER path. */
import fs from 'node:fs/promises';import path from 'node:path';import {createServer} from 'vite';import {createClient} from '@supabase/supabase-js';
const arg=name=>{const i=process.argv.indexOf(name);return i<0?null:process.argv[i+1];};
const base=await fs.realpath(path.resolve(arg('--bundle')??'')),privateRoot=await fs.realpath('.local/v6');if(!base.startsWith(privateRoot+path.sep))throw new Error('Private staging directory required');
const loader=await createServer({configFile:false,envDir:false,appType:'custom',resolve:{alias:{'@':process.cwd()+'/src'}},server:{middlewareMode:true,hmr:false,ws:false,watch:null}});
try{
 const {validateSnapshot}=await loader.ssrLoadModule('/src/lib/v6/cloud/snapshot.server.ts'),{digest}=await loader.ssrLoadModule('/src/lib/v6/evidence.server.ts'),{ORIGINAL_PLAN,ORIGINAL_RECEIPT}=await loader.ssrLoadModule('/src/lib/v6/cloud/client.server.ts');
 const {provisionStoppedSnapshot,verifyReadinessBindings}=await loader.ssrLoadModule('/src/lib/v6/cloud/provisioning.server.ts');
 const objects=new Map();
 const staging=JSON.parse(await fs.readFile(path.join(base,'staging.json'),'utf8')),manifestRaw=await fs.readFile(path.join(base,'manifest.json'),'utf8'),manifest=validateSnapshot(JSON.parse(manifestRaw));
 const inventoryRaw=await fs.readFile(path.join(base,'retention-inventory.json'),'utf8'),inventory=JSON.parse(inventoryRaw);
 if(digest(inventoryRaw)!==staging.inventoryHash||inventory.snapshotHash!==staging.snapshotHash||inventory.files.length!==manifest.files.length||!inventory.files.every((f,i)=>f.path===manifest.files[i].path&&f.hash===manifest.files[i].hash&&f.bytes===manifest.files[i].bytes))throw new Error('Retention inventory is missing or changed');
 let retentionReviewHash=null;
 if(staging.retentionReviewHash){
  const reviewRaw=await fs.readFile(path.join(base,'retention-review.json'),'utf8'),review=JSON.parse(reviewRaw);
  retentionReviewHash=digest(reviewRaw);
  if(retentionReviewHash!==staging.retentionReviewHash||review.snapshotHash!==staging.snapshotHash||review.cloudUploadApproved!==false||manifest.files.some(f=>!review.files.some(r=>r.path===f.path&&r.hash===f.hash&&r.bytes===f.bytes&&r.decision==='include_in_preview')))throw new Error('Filtered retention review mismatch');
 }
 if(staging.projectRef!=='ilgoswfckkzpoktabbfi'||staging.planHash!==ORIGINAL_PLAN||digest(staging.planRaw)!==ORIGINAL_PLAN||staging.receiptHash!==ORIGINAL_RECEIPT||digest(staging.receiptRaw)!==ORIGINAL_RECEIPT||digest(manifestRaw)!==staging.snapshotHash)throw new Error('Staging approval/integrity mismatch');
 for(const f of manifest.files){const name=await fs.realpath(path.join(base,'objects',f.hash+'.json'));if(!name.startsWith(base+path.sep))throw new Error('Outside staging');const body=await fs.readFile(name,'utf8');if(digest(body)!==f.hash||Buffer.byteLength(body)!==f.bytes)throw new Error('Staging object integrity mismatch');objects.set(f.hash,body);}
 if(!process.argv.includes('--apply-stopped'))console.log(JSON.stringify({status:'offline_validated',files:manifest.files.length,snapshotHash:staging.snapshotHash,fullRunnerReady:staging.fullRunnerReady===true,hostedWrites:0}));
 else{
  if(!retentionReviewHash)throw new Error('A filtered source-retention review is required before hosted upload');
  verifyReadinessBindings(staging,await fs.readFile(path.join(base,'dependency-manifest.json'),'utf8'),await fs.readFile(path.join(base,'model-readiness.json'),'utf8'));
  const approval=JSON.parse(await fs.readFile(arg('--approval-file'),'utf8')),proposalHash=digest(await fs.readFile('supabase/proposals/202611130002_v6_source_cloud_compatible.sql','utf8'));
  if(approval.aclHash!==digest(await fs.readFile('supabase/migrations/202611130003_v6_source_rpc_acl.sql','utf8'))||approval.dependencyManifestHash!==staging.dependencyManifestHash||approval.modelReadinessHash!==staging.modelReadinessHash||approval.retentionReviewHash!==retentionReviewHash)throw new Error('Approval must bind the exact filtered source-retention review');
  if(approval.format!=='edgelab.v6-source-storage-approval'||approval.approved!==true||approval.projectRef!==staging.projectRef||approval.proposalHash!==proposalHash||approval.snapshotHash!==staging.snapshotHash||approval.inventoryHash!==staging.inventoryHash||approval.sourceRightsReviewed!==true||approval.storageOnly!==true||approval.cloudActivation!==false||approval.credentialIssue!==false||!approval.approvalReference||!Number.isFinite(Date.parse(approval.approvedAt))||Date.parse(approval.approvedAt)>Date.now()||Date.now()-Date.parse(approval.approvedAt)>86400000)throw new Error('Fresh explicit storage-only approval required');
  const sessionFile=await fs.realpath(arg('--owner-session-file'));if(!sessionFile.startsWith(privateRoot+path.sep)||(await fs.stat(sessionFile)).mode&0o077)throw new Error('Owner session file must be private (0600) under .local/v6');
  const {access_token:token}=JSON.parse(await fs.readFile(sessionFile,'utf8'));let claims;try{claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString());}catch{throw new Error('Normal owner session required');}
  if(claims.role!=='authenticated'||claims.iss!=='https://ilgoswfckkzpoktabbfi.supabase.co/auth/v1'||claims.exp*1000<=Date.now()+120000)throw new Error('Fresh normal owner JWT required; never service-role');
  process.loadEnvFile('.env.local');const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(url!=='https://ilgoswfckkzpoktabbfi.supabase.co'||!key?.startsWith('sb_publishable_'))throw new Error('Public intended-project configuration required');
  const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{headers:{Authorization:'Bearer '+token}}});
  const {data:auth,error:authError}=await client.auth.getUser(token);if(authError||auth.user?.id!==claims.sub)throw new Error('Owner authentication failed');
  const plan=JSON.parse(staging.planRaw),{data:anchor,error:anchorError}=await client.from('historical_import_batches').select('id').eq('user_id',auth.user.id).eq('id',plan.historyBatchId).single();if(anchorError||anchor?.id!==plan.historyBatchId)throw new Error('RLS owner anchor rejected');
  const invoke=async(name,args)=>{const {data,error}=await client.rpc(name,args);if(error)throw new Error('Source provisioning rejected; retain staging and inspect private audit before replay');return data;};
  const {data:existing,error:readError}=await client.from('v6_source_pilots').select('id,user_id,revision,active_host,stopped,plan_hash,snapshot_hash').eq('user_id',auth.user.id).eq('plan_hash',ORIGINAL_PLAN).maybeSingle();if(readError)throw new Error('Approved source schema is not available');
  if(existing&&(!existing.stopped||existing.active_host!=='none'||existing.plan_hash!==ORIGINAL_PLAN))throw new Error('Only stopped owner bootstrap is permitted');
  const q=staging.quotas,quotaSeed={reserved:q.odds.reserved,used:q.odds.used,remaining:q.odds.remaining,uncertain:q.odds.uncertain,freeConfirmed:q.odds.freeConfirmed,lastRequestAt:new Date(q.odds.lastRequest).toISOString(),bdlDay:q.bdl.day,bdlRequests:q.bdl.requests,bdlLastAt:new Date(q.bdl.lastAt).toISOString(),bdlBlockedUntil:q.bdl.blockedUntil?new Date(q.bdl.blockedUntil).toISOString():null};
  const result=await provisionStoppedSnapshot({control:(action,p)=>invoke('v6_source_owner',{p_id:staging.pilotId,p_action:action,p}),dispatch:(action,p)=>invoke('v6_source_dispatch',{p_id:staging.pilotId,p_token:null,p_action:action,p})},{ownerId:auth.user.id,pilotId:staging.pilotId,manifestRaw,objects,quotaSeed,provision:{planRaw:staging.planRaw,planHash:ORIGINAL_PLAN,receiptRaw:staging.receiptRaw,receiptHash:ORIGINAL_RECEIPT}},existing);
  console.log(JSON.stringify({...result,files:manifest.files.length,cloudActivation:false,credentialsIssued:false,paperRegistrations:0}));
 }
}catch{console.error('Source staging validation/provisioning failed. No secrets or private server errors printed. Retain staging; inspect approval and audit before any retry.');process.exitCode=1;}finally{await loader.close();}
