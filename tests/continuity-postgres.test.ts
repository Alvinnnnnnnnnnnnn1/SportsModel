/** Optional ephemeral PostgreSQL only; synthetic identities and owner attestations, never hosted data or .env. */
import {describe,it,expect} from 'vitest';import {createRequire} from 'node:module';import {readFile,readdir} from 'node:fs/promises';import path from 'node:path';
import {prepareExperimentContextV2Preview,PROPOSED_EXPERIMENT_METHODOLOGY,buildResearchHandoff} from '@/lib/handoff';
import {prepareImportCommit,commitHistoricalImport,emptyHistoricalWorkspace,validateHistoricalWorkspace} from '@/lib/imports';import type {HistoricalWorkspace} from '@/lib/imports/types';import {createEmptyData} from '@/lib/domain/fixtures';
interface DB{exec(s:string):Promise<unknown>;query<T extends Record<string,unknown>=Record<string,unknown>>(s:string,p?:unknown[]):Promise<{rows:T[]}>;close():Promise<void>;}
const runtime=process.env.EDGELAB_POSTGRES_RUNTIME;
describe.skipIf(!runtime)('versioned methodology / existing PostgreSQL compatibility',()=>{
 it('preserves owner-reported days, approval, policy and ownership without a migration or financial writes',async()=>{
 const {PGlite}=createRequire(path.resolve(runtime!,'package.json'))('@electric-sql/pglite') as {PGlite:new()=>DB};const db=new PGlite();const owner='80000000-0000-4000-8000-000000000001',other='80000000-0000-4000-8000-000000000002';
 const login=async(id:string,role='authenticated')=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role '+role);};
 const load=async(expected=owner)=>validateHistoricalWorkspace((await db.query<{result:HistoricalWorkspace}>('select public.edgelab_load_history($1::uuid) result',[expected])).rows[0].result);
 const save=async(h:HistoricalWorkspace)=>{await db.query('select public.edgelab_save_history($1::jsonb,$2::bigint,$3::uuid)',[JSON.stringify(h),h.revision-1,owner]);return load();};
 try{
 await db.exec("create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid stable language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;");
 for(const name of(await readdir('supabase/migrations')).filter(n=>n.endsWith('.sql')).sort())await db.exec((await readFile('supabase/migrations/'+name,'utf8')).replace('create extension if not exists pgcrypto;','-- builtin UUIDs'));
 await db.query('insert into auth.users(id) values($1),($2)',[owner,other]);await login(owner);
 const policy={...structuredClone(PROPOSED_EXPERIMENT_METHODOLOGY),title:'SYNTHETIC TEST methodology',sourceReferences:['SYNTHETIC LOCAL ONLY test attestation; never a hosted approval']};
 const p=await prepareExperimentContextV2Preview({ownerReportedDay:6,sourceConfirmedCompletedDay:null,sourceConfirmedDayReference:null,researchCreationDate:'2026-11-05',eventDate:null,methodology:policy,methodologyApprovalConfirmed:true,sourceReference:'SYNTHETIC LOCAL context',verification:'user_confirmed',confirmed:true});
 let h=await save(commitHistoricalImport(emptyHistoricalWorkspace(),prepareImportCommit(p,[{rowNumber:1,include:true,acknowledgeIncomplete:true,allowProbableDuplicate:false}],'user_confirmed')));
 const old=structuredClone(h.records[0]);let output=buildResearchHandoff({appData:createEmptyData(),history:h,mode:'supabase',now:new Date('2026-11-05T00:00:00Z')});expect(output.context).toMatchObject({latestOwnerReportedDay:6,latestSourceConfirmedCompletedDay:null,proposedResearchDay:6,fullOriginalRulesAvailable:false,methodology:{status:'owner_approved'}});
 const q=await prepareExperimentContextV2Preview({ownerReportedDay:7,sourceConfirmedCompletedDay:null,sourceConfirmedDayReference:null,researchCreationDate:null,eventDate:null,methodology:null,sourceReference:'SYNTHETIC LOCAL later day report',verification:'user_confirmed',confirmed:true});h=await save(commitHistoricalImport(h,prepareImportCommit(q,[{rowNumber:1,include:true,acknowledgeIncomplete:true,allowProbableDuplicate:false}],'user_confirmed',h.records)));expect(h.records[0]).toEqual(old);
 output=buildResearchHandoff({appData:createEmptyData(),history:h,mode:'supabase',now:new Date('2026-11-05T00:00:00Z')});expect(output.context.proposedResearchDay).toBe(7);expect(output.context.methodology.document.text).toBe(policy.text);expect((await db.query('select count(*)::int n from public.bets')).rows[0].n).toBe(0);expect((await db.query('select count(*)::int n from public.financial_transactions')).rows[0].n).toBe(0);
 await expect(db.query("update public.historical_research_records set payload=jsonb_set(payload,'{raw,methodology,text}',to_jsonb('changed'::text)) where id=$1",[old.id])).rejects.toThrow();
 await login(other);expect((await load(other)).records).toHaveLength(0);await expect(load(owner)).rejects.toThrow(/owner changed/i);await login('', 'anon');await expect(load()).rejects.toThrow(/permission denied/i);
 }finally{await db.close();}
 },30000);
});
