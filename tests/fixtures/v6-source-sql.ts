import {createRequire} from 'node:module';
import path from 'node:path';
import {readFile} from 'node:fs/promises';
import type {V6TestDB} from './v6-postgres';

export const SOURCE_SQL='supabase/proposals/202611130002_v6_source_cloud_compatible.sql';
export const SOURCE_MIGRATOR='approval_s_migrator';

/** Local platform setup only. Migration assertions run as a non-superuser, with
 * no Auth-schema grant option, matching the observed Supabase dependency ACLs. */
export async function prepareSourceMigrationRole(db:V6TestDB){
 await db.exec(`
  reset role;
  create role approval_s_auth_admin nologin;
  create role ${SOURCE_MIGRATOR} createrole nosuperuser nobypassrls;
  do $$begin
   if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role;end if;
   if not exists(select 1 from pg_roles where rolname='authenticator') then create role authenticator;end if;
  end$$;
  alter schema auth owner to approval_s_auth_admin;
  alter function auth.uid() owner to approval_s_auth_admin;
  revoke all on schema auth from public;
  grant usage on schema auth to ${SOURCE_MIGRATOR},anon,authenticated;
  grant execute on function auth.uid() to public;
  grant references on auth.users to ${SOURCE_MIGRATOR};
  revoke create on schema public from public;
  grant usage,create on schema public to ${SOURCE_MIGRATOR} with grant option;
  alter table public.historical_import_batches owner to ${SOURCE_MIGRATOR};
  alter default privileges for role ${SOURCE_MIGRATOR} in schema public grant all on tables to anon,authenticated,service_role;
  alter default privileges for role ${SOURCE_MIGRATOR} in schema public grant all on functions to anon,authenticated,service_role;
  set role ${SOURCE_MIGRATOR};
 `);
}

export async function applySourceSql(db:V6TestDB){
 await db.exec(`set role ${SOURCE_MIGRATOR}`);
 await db.exec(await readFile(SOURCE_SQL,'utf8'));
 await db.exec('reset role');
}

export async function sourceSqlTestDatabase(){
 const runtime=process.env.EDGELAB_POSTGRES_RUNTIME!;
 const {PGlite}=createRequire(path.resolve(runtime,'package.json'))('@electric-sql/pglite') as {PGlite:new()=>V6TestDB};
 const db=new PGlite();
 try{
  await db.exec(`
   create role anon;create role authenticated;create schema auth;
   create table auth.users(id uuid primary key);
   create function auth.uid() returns uuid stable language sql as
    $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   create table public.historical_import_batches(user_id uuid,id uuid,primary key(user_id,id));
   alter table public.historical_import_batches enable row level security;
   create policy owner_read on public.historical_import_batches to authenticated using(user_id=auth.uid());
   grant select on public.historical_import_batches to authenticated;
  `);
  await prepareSourceMigrationRole(db);
  await applySourceSql(db);
  return db;
 }catch(error){await db.close();throw error;}
}
