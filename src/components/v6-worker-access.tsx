"use client";
import {useState} from 'react';
import {Button} from './ui/button';
import {getSupabaseClient} from '@/lib/persistence';
import {issueWorkerCredential,listWorkerCredentials,revokeWorkerCredential,type WorkerCredential} from '@/lib/v6/worker-credentials';
/** Owner-initiated enrollment only. No automatic calls, policy activation or schedule. */
export function V6WorkerAccess({ownerId}:{ownerId:string}){
 const [rows,setRows]=useState<Awaited<ReturnType<typeof listWorkerCredentials>>>([]),[scope,setScope]=useState<WorkerCredential['scope']>('research_only'),[rotate,setRotate]=useState(''),[ack,setAck]=useState(false),[busy,setBusy]=useState(false),[status,setStatus]=useState('');
 const client=()=>{const c=getSupabaseClient();if(!c)throw new Error('Private workspace required');return c;};
 async function action(work:()=>Promise<void>){setBusy(true);setStatus('');try{await work();}catch{setStatus('Operation rejected. Confirm the approved V6 schema is deployed and your owner session is active.');}finally{setBusy(false);}}
 return <details className="rounded-xl border border-white/10 p-4"><summary className="cursor-pointer font-medium">V6 restricted worker access · advanced setup</summary>
  <p className="my-3 text-sm text-muted-foreground">Requires Approval A: deployed V6 schema. Create a credential only after reviewing worker setup. It expires in 30 days and grants access only to your V6 research. It does not activate a model, install a worker, place wagers or change your login.</p>
  <Button variant="outline" disabled={busy} onClick={()=>void action(async()=>{setRows(await listWorkerCredentials(client(),ownerId));setStatus('Credential metadata loaded. Secrets are never listed.');})}>Check worker credentials</Button>
  <div className="my-3 flex flex-wrap gap-3">
   <select aria-label="Worker credential scope" className="rounded border bg-background p-2" value={scope} onChange={e=>setScope(e.target.value as WorkerCredential['scope'])}><option value="research_only">Research only · no paper registration</option><option value="paper_worker">V6 paper operations · requires separate B and C approvals</option></select>
   <select aria-label="Credential rotation" className="rounded border bg-background p-2" value={rotate} onChange={e=>setRotate(e.target.value)}><option value="">Create new credential</option>{rows.filter(r=>!r.revokedAt).map(r=><option key={r.credentialId} value={r.credentialId}>Rotate {r.credentialId.slice(0,8)}</option>)}</select>
  </div>
  <label className="my-3 flex items-start gap-2 text-sm"><input type="checkbox" checked={ack} onChange={e=>setAck(e.target.checked)}/>I approve creating this restricted credential and will keep its one-time download private. Rotation immediately revokes the selected old credential.</label>
  <Button disabled={busy||!ack} onClick={()=>void action(async()=>{
   const credential=await issueWorkerCredential(client(),ownerId,scope,rotate||null);
   const url=URL.createObjectURL(new Blob([JSON.stringify(credential,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='edgelab-v6-worker-credential.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
   setAck(false);setRotate('');setStatus('Restricted credential created. Keep the one-time download private; move it into .local/v6 and restrict file permissions before use. If download was cancelled, revoke this credential before creating another. No worker or policy was activated.');
   try{setRows(await listWorkerCredentials(client(),ownerId));}catch{setStatus('Credential created and download attempted, but metadata refresh failed. Check credentials before retrying creation.');}
  })}>Create and download restricted credential</Button>
  <ul className="mt-3 space-y-2 text-sm">{rows.map(r=><li key={r.credentialId} className="flex flex-wrap items-center gap-3"><span>{r.credentialId.slice(0,8)} · {r.scope} · expires {new Date(r.expiresAt).toLocaleString('en-AU',{timeZone:'Australia/Melbourne'})} · {r.revokedAt?'revoked':'active'}</span>{!r.revokedAt&&<Button variant="outline" disabled={busy} onClick={()=>void action(async()=>{await revokeWorkerCredential(client(),ownerId,r.credentialId);setRows(await listWorkerCredentials(client(),ownerId));setStatus('Worker credential revoked. Your personal login and experiment records are unchanged.');})}>Revoke {r.credentialId.slice(0,8)}</Button>}</li>)}</ul>
  <p role="status" className="mt-3 text-sm">{status}</p>
 </details>;
}
