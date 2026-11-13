import {createRequire} from 'node:module';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
export interface V6TestDB{exec(sql:string):Promise<unknown>;query<T extends Record<string,unknown>=Record<string,unknown>>(sql:string,args?:unknown[]):Promise<{rows:T[]}>;close():Promise<void>;}
// Migration-specific rollback tests need the deployed V5 baseline before source DDL.
export async function v6TestDatabase(options:{beforeSourceMigration?:boolean}={}){
 const {PGlite}=createRequire(path.resolve(process.env.EDGELAB_POSTGRES_RUNTIME!,'package.json'))('@electric-sql/pglite') as {PGlite:new()=>V6TestDB},db=new PGlite();
 await db.exec("create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid stable language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;");
 for(const file of(await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')&&(!options.beforeSourceMigration||f<'202611130002')).sort())await db.exec((await readFile('supabase/migrations/'+file,'utf8')).replace('create extension if not exists pgcrypto;','-- UUID/hash builtins'));
 return db;
}
export async function v6Login(db:V6TestDB,id:string,role='authenticated'){
 await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[id,JSON.stringify({sub:id||null,role})]);
 if(!['authenticated','anon','edgelab_v6_worker'].includes(role))throw new Error('Test role not permitted');await db.exec('set role '+role);
}
