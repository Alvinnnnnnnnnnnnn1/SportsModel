/** Disposable local PostgreSQL only; invented source fixtures, never hosted research. */
import { createRequire } from 'node:module';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { archiveDailyCycle, savedDailyCycles } from '@/lib/daily-cycle/archive';
import { emptyHistoricalWorkspace, type HistoricalWorkspace } from '@/lib/imports/types';
import { localCycle } from './fixtures/daily-cycle';
interface DB { exec(sql:string):Promise<unknown>; query<T extends Record<string,unknown> = Record<string,unknown>>(sql:string,args?:unknown[]):Promise<{rows:T[]}>; close():Promise<void>; }
const runtime = process.env.EDGELAB_POSTGRES_RUNTIME;
describe.skipIf(!runtime)('private Daily Cycle / existing PostgreSQL transaction',()=>{
  it('persists source facts privately, rolls back late failure and rejects stale, cross-owner and anonymous writes',async()=>{
    const {PGlite}=createRequire(path.resolve(runtime!,'package.json'))('@electric-sql/pglite') as {PGlite:new()=>DB}; const db=new PGlite();
    const owner='93000000-0000-4000-8000-000000000001',other='93000000-0000-4000-8000-000000000002';
    const login=async(id:string,role='authenticated')=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role '+role);};
    const load=async(id=owner)=>(await db.query<{result:HistoricalWorkspace}>('select public.edgelab_load_history($1::uuid) result',[id])).rows[0].result;
    const save=(h:HistoricalWorkspace,revision:number,id=owner)=>db.query('select public.edgelab_save_history($1::jsonb,$2::bigint,$3::uuid)',[JSON.stringify(h),revision,id]);
    try {
      await db.exec("create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid stable language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;");
      for(const file of(await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort())await db.exec((await readFile('supabase/migrations/'+file,'utf8')).replace('create extension if not exists pgcrypto;','-- builtin UUIDs'));
      await db.query('insert into auth.users(id) values($1),($2)',[owner,other]);await login(owner);
      const cycle=localCycle(),text=JSON.stringify(cycle),prepared=await archiveDailyCycle(emptyHistoricalWorkspace(),text,'supabase');
      const invalid=structuredClone(prepared.history); invalid.notifications.push({id:crypto.randomUUID(),recordId:crypto.randomUUID(),dedupeKey:'invalid',title:'LOCAL TEST',message:'LOCAL TEST',createdAt:new Date().toISOString(),readAt:null,dismissedAt:null});
      await expect(save(invalid,0)).rejects.toThrow();expect((await load()).records).toHaveLength(0);
      await save(prepared.history,0);let h=await load();
      expect(h.batches[0].rawSource).toBe(text);expect(h.records).toHaveLength(2);expect(savedDailyCycles(h)[0].cycle).toEqual(cycle);
      expect(h.records.find(r=>r.snapshot.kind==='paper')?.snapshot).toMatchObject({odds:1.91,probability:null,stakeCents:null,predictionAt:'2026-11-10T23:59:00.000Z'});
      expect((await archiveDailyCycle(h,text,'supabase')).history).toBe(h);
      await expect(save(prepared.history,0)).rejects.toThrow(/revision conflict/i);
      await expect(db.query("update public.historical_research_records set payload=jsonb_set(payload,'{snapshot,odds}','2.0'::jsonb) where id=$1",[h.records[0].id])).rejects.toThrow();
      expect((await db.query('select count(*)::int n from public.bets')).rows[0].n).toBe(0);expect((await db.query('select count(*)::int n from public.financial_transactions')).rows[0].n).toBe(0);expect(h.paperResults).toHaveLength(0);
      await login(other);expect((await load(other)).records).toHaveLength(0);await expect(load(owner)).rejects.toThrow(/owner changed/i);await expect(save(prepared.history,0)).rejects.toThrow(/owner changed/i);
      await login('','anon');await expect(load()).rejects.toThrow(/permission denied/i);
      await login(owner); h=await load();expect(savedDailyCycles(h)).toHaveLength(1);
    } finally {await db.close();}
  },30000);
});
