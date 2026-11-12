/** Mock transport and invented JWT strings. No hosted requests or credentials. */
import {describe,it,expect} from 'vitest';
import {supabaseV6Repository,workerTokenPreflight} from '@/lib/v6/supabase-repository.server';
import {emptyV6State,type V6State} from '@/lib/v6/types';
import {runV6Worker} from '@/lib/v6/worker';
import {decodePrivateV6Json} from '@/lib/v6/worker-credentials';
const owner='95000000-0000-4000-8000-000000000001',other='95000000-0000-4000-8000-000000000002',ref='ilgoswfckkzpoktabbfi',url=`https://${ref}.supabase.co`,now=Date.parse('2026-11-12T06:00:00Z');
const token=(change:Record<string,unknown>={})=>['SYNTHETIC_HEADER',Buffer.from(JSON.stringify({sub:owner,role:'edgelab_v6_worker',iss:url+'/auth/v1',aud:'authenticated',exp:now/1000+3600,...change})).toString('base64url'),'SYNTHETIC_SIGNATURE'].join('.');
describe('owner-scoped Supabase V6 worker repository',()=>{
 it('does not echo secret-bearing malformed JSON into file-parser errors',()=>{
  const secret='edgelab_v6_'+'d'.repeat(64);try{decodePrivateV6Json('{"credential":"'+secret+'",');throw new Error('Expected rejection');}catch(e){expect((e as Error).message.includes(secret)).toBe(false);expect((e as Error).message).toContain('contents omitted');}
 });
 it.each([{role:'authenticated'},{role:'service_role'},{sub:other},{exp:now/1000},{iss:'https://wrong.invalid/auth/v1'},{nbf:now/1000+3600}])('rejects personal, privileged, wrong-owner and invalid lifetime claims before transport: %j',claims=>{
  expect(()=>workerTokenPreflight(token(claims),owner,url+'/auth/v1',now)).toThrow(/rejected/);
 });
 it('requires a server-verified restricted role and owner on every access',async()=>{
  let requests=0;const repo=supabaseV6Repository({projectUrl:url,projectRef:ref,publishableKey:'sb_publishable_SYNTHETIC',ownerId:owner,accessToken:async()=>token(),rawSource:async()=>'',clock:()=>now,
   fetcher:async()=>{requests++;return Response.json({ownerId:other,role:'edgelab_v6_worker',cohort:'v6-prospective'});}});
  await expect(repo.read()).rejects.toThrow(/owner mismatch/);expect(requests).toBe(1);
 });
 it('rejects revoked access without persisting a run or leaking a server response',async()=>{
  const repo=supabaseV6Repository({projectUrl:url,projectRef:ref,publishableKey:'sb_publishable_SYNTHETIC',ownerId:owner,accessToken:async()=>token(),rawSource:async()=>'',clock:()=>now,
   fetcher:async()=>new Response('SYNTHETIC SECRET ERROR MUST NOT BE ECHOED',{status:401})});
  await expect(repo.read()).rejects.toThrow('HTTP 401');await expect(repo.read()).rejects.not.toThrow('SYNTHETIC SECRET');
 });
 it('sends one narrow atomic run RPC and recovers an ambiguous committed response by rereading before replay',async()=>{
  let state=emptyV6State(owner),commits=0,collects=0;const paths:string[]=[];
  const fetcher:typeof fetch=async(input,init)=>{
   const endpoint=new URL(String(input)).pathname.split('/').at(-1)!;paths.push(endpoint);const args=JSON.parse(init!.body as string);expect(args.expected_owner).toBe(owner);
   if(endpoint==='v6_worker_identity')return Response.json({ownerId:owner,role:'edgelab_v6_worker',cohort:'v6-prospective'});
   if(endpoint==='v6_load_worker_state')return Response.json(state);
   if(endpoint==='v6_commit_worker_run'){commits++;expect(args.position_rows).toEqual([]);expect(args.grade_rows).toEqual([]);expect(args.raw_sources).toEqual({});state={...state,revision:state.revision+1,runs:[...state.runs,args.run_snapshot]};throw new Error('SYNTHETIC connection lost after commit');}
   throw new Error('Unexpected endpoint');
  };
  const repo=()=>supabaseV6Repository({projectUrl:url,projectRef:ref,publishableKey:'sb_publishable_SYNTHETIC',ownerId:owner,accessToken:async()=>token(),rawSource:async()=>'',fetcher,clock:()=>now});
  const provider={collectionPermitted:true,collect:async()=>{collects++;return [];},grade:async()=>null},options={runId:'LOCAL-ATOMIC-REST',now:new Date(now).toISOString(),clock:()=>new Date(now).toISOString(),mode:'dry_run' as const,killSwitch:false,activation:null};
  await expect(runV6Worker(repo(),provider,null,options)).rejects.toThrow(/connection lost/);
  expect((await repo().read()).revision).toBe(1);expect((await runV6Worker(repo(),provider,null,options)).status).toBe('already_processed');
  expect(commits).toBe(1);expect(collects).toBe(1);expect(paths.every(p=>p.startsWith('v6_'))).toBe(true);
 });
 it('rejects cross-owner or modified historical snapshots before a commit',async()=>{
  const state=emptyV6State(owner);let commits=0;
  const repo=supabaseV6Repository({projectUrl:url,projectRef:ref,publishableKey:'sb_publishable_SYNTHETIC',ownerId:owner,accessToken:async()=>token(),rawSource:async()=>'',clock:()=>now,fetcher:async input=>{
   if(String(input).endsWith('v6_worker_identity'))return Response.json({ownerId:owner,role:'edgelab_v6_worker',cohort:'v6-prospective'});
   if(String(input).endsWith('v6_load_worker_state'))return Response.json(state);commits++;return Response.json(state);
  }});
  await expect(repo.transact(async s=>({...s,ownerId:other}))).rejects.toThrow(/owner/);expect(commits).toBe(0);
  await expect(repo.transact(async s=>({...s,revision:2} as V6State))).rejects.toThrow(/atomic/);expect(commits).toBe(0);
 });
 it('uses a rotating opaque capability without a browser JWT or signing key and sanitizes revocation failures',async()=>{
  let calls=0,active='a'.repeat(64),credential='a'.repeat(64);
  const repo=supabaseV6Repository({projectUrl:url,projectRef:ref,publishableKey:'sb_publishable_SYNTHETIC',ownerId:owner,clock:()=>now,rawSource:async()=>'',capability:async()=>({ownerId:owner,credentialId:crypto.randomUUID(),credential:'edgelab_v6_'+credential,scope:'research_only',expiresAt:new Date(now+3600000).toISOString()}),fetcher:async(input,init)=>{
   calls++;expect(new URL(String(input)).pathname).toBe('/rest/v1/rpc/v6_worker_access');expect(new Headers(init?.headers).has('Authorization')).toBe(false);
   const b=JSON.parse(init!.body as string);if(b.credential!=='edgelab_v6_'+active)return new Response('not echoed',{status:400});return Response.json(b.operation==='identity'?{ownerId:owner,role:'edgelab_v6_worker',cohort:'v6-prospective'}:emptyV6State(owner));
  }});
  expect((await repo.read()).ownerId).toBe(owner);active='b'.repeat(64);await expect(repo.read()).rejects.toThrow('HTTP 400');credential=active;expect((await repo.read()).ownerId).toBe(owner);expect(calls).toBe(5);
 });
 it('recovers a lost capability commit response by reading the durable run before worker replay',async()=>{
  let state=emptyV6State(owner),commits=0,collects=0;
  const repo=()=>supabaseV6Repository({projectUrl:url,projectRef:ref,publishableKey:'sb_publishable_SYNTHETIC',ownerId:owner,clock:()=>now,rawSource:async()=>'',capability:async()=>({ownerId:owner,credentialId:crypto.randomUUID(),credential:'edgelab_v6_'+'c'.repeat(64),scope:'research_only',expiresAt:new Date(now+3600000).toISOString()}),fetcher:async(_input,init)=>{
   const b=JSON.parse(init!.body as string);if(b.operation==='identity')return Response.json({ownerId:owner,role:'edgelab_v6_worker',cohort:'v6-prospective'});
   if(b.operation==='load')return Response.json(state);commits++;state={...state,revision:state.revision+1,runs:[...state.runs,b.request.run_snapshot]};throw new Error('SYNTHETIC lost response after commit');
  }});
  const provider={collectionPermitted:true,collect:async()=>{collects++;return [];},grade:async()=>null},options={runId:'LOCAL-CAPABILITY-LOST',now:new Date(now).toISOString(),clock:()=>new Date(now).toISOString(),mode:'dry_run' as const,killSwitch:false,activation:null};
  await expect(runV6Worker(repo(),provider,null,options)).rejects.toThrow(/lost response/);
  expect((await runV6Worker(repo(),provider,null,options)).status).toBe('already_processed');expect(commits).toBe(1);expect(collects).toBe(1);
 });
});
