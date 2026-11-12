import type {SupabaseClient} from '@supabase/supabase-js';
import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {digest} from '../evidence.server';
import {cloudPilotSchema} from './client.server';
import {CloudEvidenceNotConnected} from './errors';
import {restoreSnapshot,validateSnapshot} from './snapshot.server';
import {loadV6Dashboard} from '../dashboard.server';
/** Normal owner JWT/RLS SELECT only. Temporary files are a disposable projection,
 * never the durable store. No worker credential, provider key or service role. */
export async function loadCloudDashboard(client:SupabaseClient,owner:string,batchId:string){
 const {data,error}=await client.from('v6_source_pilots').select('*').eq('user_id',owner).eq('history_batch_id',batchId).order('created_at',{ascending:false}).limit(1).maybeSingle();
 if(error){if(['42P01','PGRST205'].includes(error.code))throw new CloudEvidenceNotConnected();throw new Error('Cloud research lookup unavailable');}if(!data)throw new CloudEvidenceNotConnected();
 const pilot=cloudPilotSchema.parse(data);if(digest(pilot.plan_raw)!==pilot.plan_hash||digest(pilot.receipt_raw)!==pilot.receipt_hash)throw new Error('Cloud approval integrity');if(pilot.user_id!==owner||pilot.history_batch_id!==batchId)throw new Error('Cloud owner mismatch');
 const {data:snapshot,error:snapshotError}=await client.from('v6_source_snapshots').select('manifest_raw,hash').eq('user_id',owner).eq('pilot_id',pilot.id).eq('revision',pilot.revision).maybeSingle();
 if(snapshotError)throw new Error('Cloud snapshot lookup unavailable');if(!snapshot)throw new CloudEvidenceNotConnected();
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'edgelab-v6-view-'));
 try{
  if(digest(snapshot.manifest_raw)!==pilot.snapshot_hash||snapshot.hash!==pilot.snapshot_hash)throw new Error('Cloud manifest integrity');
  const manifest=validateSnapshot(JSON.parse(snapshot.manifest_raw));
  // Dashboard projections never download the large raw datasets or source bodies.
  const viewManifest={...manifest,files:manifest.files.filter(f=>/^(team-shadow\/|team-shadow-reconciliations\/[^/]+\/evaluations\/|team-reports\/|model-development\/(reports|slates|results)\/|controlled\/[a-f0-9]{64}\/(scheduler|health)\.json$|odds-shared-budget\.json$|balldontlie-team-budget\.json$)/.test(f.path))};
  await restoreSnapshot(root,viewManifest,async hash=>{const {data,error}=await client.from('v6_source_objects').select('body').eq('user_id',owner).eq('pilot_id',pilot.id).eq('hash',hash).single();if(error||typeof data?.body!=='string')throw new Error('Cloud object unavailable');return data.body;});
  const view=await loadV6Dashboard(root,owner,new Date().toISOString(),pilot.namespace);
  // This source-only store has no registered PAPER domain, irrespective of file content.
  view.ledger={available:false,registered:0,pendingCents:0,profitCents:0,equityCents:500000,roi:null,positions:[]};
  view.storage='cloud';view.health.mode='source_only';view.health.killSwitch=pilot.stopped;
  view.health.credential='Source-only opaque capability · value never inspected by dashboard';
  view.health.cloud={activeHost:pilot.active_host,lastAttempt:pilot.last_attempt_at,leaseUntil:pilot.lease_until,pilotExpiresAt:pilot.expires_at,snapshotRevision:pilot.revision,localHost:'Not observable from cloud · requires retained handover evidence',status:pilot.stopped?'stopped':Date.parse(pilot.expires_at)<=Date.now()?'expired':'Configured; success requires retained completed job and source evidence'};
  for(const source of view.sources)if(source.status==='available')source.reason='Private content-verified cloud evidence; no provider request';
  const {data:quotas,error:quotaError}=await client.from('v6_source_quotas').select('provider,period,reserved,used,remaining,last_request_at,uncertain').eq('user_id',owner).eq('pilot_id',pilot.id);
  if(!quotaError&&quotas)view.health.quota=quotas.map(q=>({provider:q.provider==='odds'?`The Odds API · ${q.period} · ${q.reserved}/60 reserved${q.uncertain?' · uncertain':''}`:`BALLDONTLIE · ${q.period}`,used:q.used??q.reserved,remaining:q.remaining,asOf:q.last_request_at}));
  return view;
 }finally{await fs.rm(root,{recursive:true,force:true});}
}
