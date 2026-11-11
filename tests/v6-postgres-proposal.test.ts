/** Proposal-only embedded PostgreSQL. No hosted schema/user/records are touched. */
import { createRequire } from 'node:module';
import { readFile,readdir } from 'node:fs/promises';
import path from 'node:path';
import { describe,it,expect } from 'vitest';
import { sha256 } from '@/lib/imports/duplicates';
import { registerPaper,positionHash } from '@/lib/v6/engine';
import { emptyV6State,positionSchema,type PaperPosition } from '@/lib/v6/types';
import { V6_POLICY } from '@/lib/v6/policy';
import { observation,forecast,grade } from './fixtures/v6';
interface DB{exec(s:string):Promise<unknown>;query<T extends Record<string,unknown>=Record<string,unknown>>(s:string,a?:unknown[]):Promise<{rows:T[]}>;close():Promise<void>;}
const runtime=process.env.EDGELAB_POSTGRES_RUNTIME;
describe.skipIf(!runtime)('V6 isolated SQL proposal',()=>{
 it('enforces policy/model activation, unlimited distinct positions, paper-only grades, ownership, immutable evidence and scoped worker access',async()=>{
  const {PGlite}=createRequire(path.resolve(runtime!,'package.json'))('@electric-sql/pglite') as {PGlite:new()=>DB};const db=new PGlite();
  const owner='94000000-0000-4000-8000-000000000001',other='94000000-0000-4000-8000-000000000002';
  const login=async(id:string,role='authenticated')=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role '+role);};
  try{
   await db.exec("create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid stable language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;");
   for(const f of(await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort())await db.exec((await readFile('supabase/migrations/'+f,'utf8')).replace('create extension if not exists pgcrypto;','-- builtin UUIDs'));
   await db.exec(await readFile('supabase/proposals/202611110001_v6_paper.sql','utf8'));
   await db.query('insert into auth.users(id) values($1),($2)',[owner,other]);await login(owner);
   const at=new Date().toISOString(),activated=new Date(Date.now()-10000).toISOString(),raw='SYNTHETIC LOCAL SQL TEST ONLY; no actual quote or empirical model validation';
   const o=observation();o.sourceClass='prospective';o.provider='the-odds-api.com';o.permissionReference='https://the-odds-api.com/terms-and-conditions.html';o.rawHash=await sha256(raw);o.observedAt=at;o.retrievedAt=at;o.sourceUpdatedAt=at;o.eventStartsAt=new Date(Date.now()+10000).toISOString();
   const f=await forecast(o);
   const prepared=await registerPaper(emptyV6State(owner),o,f,'pre_event_once',at);expect(prepared.reasons).toEqual([]);const p=prepared.position!;
   const insertObservation=(value:typeof o)=>db.query('insert into public.v6_observations(user_id,id,raw_source,payload) values($1,$2,$3,$4::jsonb)',[owner,value.id,raw,JSON.stringify(value)]);
   await insertObservation(o);
   const register=async(value:PaperPosition)=>(await db.query<{result:unknown}>('select public.v6_register_paper($1::uuid,$2::jsonb,$3::text) result',[owner,JSON.stringify(value),JSON.stringify(value.forecast!.inputs)])).rows[0].result;
   await expect(register(p)).rejects.toThrow(/inactive/);
   await db.query('insert into public.v6_policies values($1,$2,$3,500000,5000,$4,$5::jsonb)',[owner,V6_POLICY.id,await sha256(JSON.stringify(V6_POLICY)),activated,JSON.stringify(V6_POLICY)]);
   await db.query('insert into public.v6_controls(user_id,policy_id,enabled,kill_switch) values($1,$2,true,false)',[owner,V6_POLICY.id]);
   await expect(register(p)).rejects.toThrow(/model/);
   await db.query('insert into public.v6_models values($1,$2,$3,$4,$5,$6,$7,$8::jsonb)',[owner,f.modelId,f.version,f.method,'a'.repeat(64),'out_of_sample_validated',activated,JSON.stringify({notice:raw})]);
   const saved=positionSchema.parse(await register(p));expect(saved.id).toBe(p.id);
   await expect(insertObservation({...o,id:crypto.randomUUID(),sourceClass:'synthetic'})).rejects.toThrow();
   await expect(insertObservation({...o,id:crypto.randomUUID(),sourceUrl:'https://user:secret@example.invalid/'})).rejects.toThrow();
   const malformed=structuredClone(p);malformed.id=crypto.randomUUID();malformed.observation.id=crypto.randomUUID();malformed.observation.market.threshold=23;malformed.forecast=await forecast(malformed.observation);malformed.forecast.probability=2;
   await insertObservation(malformed.observation);await expect(register(malformed)).rejects.toThrow(/forecast/);
   expect(positionSchema.parse(await register({...p,id:crypto.randomUUID()})).id).toBe(p.id);
   await expect(db.query("update public.v6_positions set payload='{}'::jsonb where user_id=$1",[owner])).rejects.toThrow();
   await expect(db.query('delete from public.v6_positions where user_id=$1',[owner])).rejects.toThrow(/permission denied/);
   for(let i=0;i<101;i++){
    const nextO=structuredClone(o);nextO.id=crypto.randomUUID();nextO.market.subjectId='LOCAL-TEST-player-'+i;nextO.market.eventId='LOCAL-future-event';nextO.eventStartsAt=new Date(Date.now()+3600000).toISOString();await insertObservation(nextO);
    const nextF=await forecast(nextO);const next=(await registerPaper(emptyV6State(owner),nextO,nextF,'pre_event_once',at)).position!;await register(next);
   }
   const summary=async(id=owner)=>(await db.query<{result:Record<string,unknown>}>('select public.v6_paper_summary($1::uuid) result',[id])).rows[0].result;
   expect(await summary()).toMatchObject({pendingCents:510000,availableCents:-10000,virtualExcessExposureCents:10000,roi:null});
   await login(other);expect((await db.query('select count(*)::int n from public.v6_positions')).rows[0].n).toBe(0);await expect(summary(owner)).rejects.toThrow(/owner changed/);
   await expect(db.query('insert into public.v6_observations(user_id,id,raw_source,payload) values($1,$2,$3,$4::jsonb)',[owner,crypto.randomUUID(),raw,JSON.stringify(o)])).rejects.toThrow();
   await login(owner,'edgelab_v6_worker');await expect(db.query('select * from public.bets')).rejects.toThrow(/permission denied/);await expect(db.query('select public.edgelab_load_workspace()')).rejects.toThrow(/permission denied/);
   expect((await db.query('select public.v6_reserve_quota($1::uuid,4) n',[owner])).rows[0].n).toBe(4);
   await expect(db.query('update public.v6_provider_quotas set reserved=0')).rejects.toThrow(/rewound/);
   await expect(db.query('select public.v6_reserve_quota($1::uuid,397)',[owner])).rejects.toThrow();
   expect((await db.query('select reserved from public.v6_provider_quotas')).rows[0].reserved).toBe(4);
   await expect(db.query('update public.v6_positions set registered_at=clock_timestamp()')).rejects.toThrow(/append-only/);
   await expect(db.query('update public.v6_controls set enabled=true')).rejects.toThrow(/permission denied/);await expect(db.query('insert into public.v6_models values($1,$2,$3,$4,$5,$6,$7,$8::jsonb)',[owner,'not-authorised','v1',f.method,'a'.repeat(64),'out_of_sample_validated',activated,'{}'])).rejects.toThrow(/permission denied/);
   const next=structuredClone(saved);next.id=crypto.randomUUID();next.observation=structuredClone(o);next.observation.id=crypto.randomUUID();next.observation.market.threshold=22;next.forecast=await forecast(next.observation);await insertObservation(next.observation);await register(next);
   await login('','anon');await expect(summary()).rejects.toThrow(/permission denied/);
   await login(owner);expect((await db.query('select count(*)::int n from public.bets')).rows[0].n).toBe(0);expect((await db.query('select count(*)::int n from public.financial_transactions')).rows[0].n).toBe(0);
   // Let the short local fixture reach its real clock boundary. No trigger or
   // original source is bypassed/rewritten; final results below are invented test evidence.
   await new Promise(resolve=>setTimeout(resolve,Math.max(0,Date.parse(saved.observation.eventStartsAt)-Date.now()+25)));
   const g=await grade(saved);g.sourceClass='prospective';g.recordedAt=new Date().toISOString();g.publishedAt=g.recordedAt;g.positionHash=await positionHash(saved);
   const append=async(value:typeof g)=>db.query('select public.v6_append_grade($1::uuid,$2::jsonb,$3::text)',[owner,JSON.stringify(value),JSON.stringify(saved)]);
   await append(g);await append(g);expect((await summary()).profitCents).toBe(4500);
   const correction={...g,id:crypto.randomUUID(),revision:2,previousGradeId:g.id,outcome:'lost' as const,observedValue:10};await append(correction);expect((await summary()).profitCents).toBe(-5000);
   await expect(append({...correction,id:crypto.randomUUID()})).rejects.toThrow(/revision/);
  }finally{await db.close();}
 },30000);
});
