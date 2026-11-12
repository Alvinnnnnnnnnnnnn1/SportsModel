-- Approval S compatibility metadata only. Invoke with db query --remote --read-only.
-- No private rows, tokens, DDL, grants, settings changes or source requests.
select jsonb_build_object(
 'database',current_database(),
 'postgres_version',current_setting('server_version'),
 'database_bytes',pg_database_size(current_database()),
 'session_role',session_user,'effective_role',current_user,
 'migration_role',(select jsonb_build_object('superuser',rolsuper,'create_role',rolcreaterole,'bypass_rls',rolbypassrls) from pg_roles where rolname=current_user),
 'createrole_self_grant',current_setting('createrole_self_grant',true),
 'postgres_role',(select jsonb_build_object('superuser',rolsuper,'create_role',rolcreaterole,'bypass_rls',rolbypassrls) from pg_roles where rolname='postgres'),
 'postgres_public_create',has_schema_privilege('postgres','public','CREATE'),
 'auth_uid_owner',(select pg_get_userbyid(proowner) from pg_proc where oid='auth.uid()'::regprocedure),
 'auth_schema_acl',(select nspacl::text from pg_namespace where nspname='auth'),
 'auth_uid_acl',(select proacl::text from pg_proc where oid='auth.uid()'::regprocedure),
 'auth_uid_public_execute',exists(select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid='auth.uid()'::regprocedure and a.grantee=0 and a.privilege_type='EXECUTE'),
 'postgres_auth_uid_grant_option',has_function_privilege('postgres','auth.uid()','EXECUTE WITH GRANT OPTION'),
 'postgres_auth_users_reference',has_table_privilege('postgres','auth.users','REFERENCES'),
 'public_schema',(select jsonb_build_object('owner',pg_get_userbyid(nspowner),'acl',nspacl::text,'can_create',has_schema_privilege(current_user,oid,'CREATE'),'can_use',has_schema_privilege(current_user,oid,'USAGE')) from pg_namespace where nspname='public'),
 'auth_schema_usage',has_schema_privilege(current_user,'auth','USAGE'),
 'source_role_exists',exists(select 1 from pg_roles where rolname='edgelab_v6_source'),
 'paper_role_exists',exists(select 1 from pg_roles where rolname='edgelab_v6_worker'),
 'source_tables',(select coalesce(jsonb_agg(jsonb_build_object('table',c.relname,'owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'forced',c.relforcerowsecurity)),'[]'::jsonb) from pg_class c where c.relnamespace='public'::regnamespace and c.relkind='r' and c.relname like 'v6_source_%'),
 'source_functions',(select coalesce(jsonb_agg(p.proname),'[]'::jsonb) from pg_proc p where p.pronamespace='public'::regnamespace and p.proname like 'v6_source_%'),
 'anchor_table',(select jsonb_build_object('owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'constraints',(select jsonb_agg(pg_get_constraintdef(oid)) from pg_constraint where conrelid=c.oid),'policies',(select jsonb_agg(jsonb_build_object('name',policyname,'roles',roles,'command',cmd,'using',qual)) from pg_policies where schemaname='public' and tablename=c.relname)) from pg_class c where c.oid=to_regclass('public.historical_import_batches')),
 'auth_uid_available',to_regprocedure('auth.uid()') is not null,
 'uuid_available',to_regprocedure('pg_catalog.gen_random_uuid()') is not null,
 'sha256_available',to_regprocedure('pg_catalog.sha256(bytea)') is not null,
 'default_table_acls',(select coalesce(jsonb_agg(jsonb_build_object('role',pg_get_userbyid(defaclrole),'schema',case when defaclnamespace=0 then null else defaclnamespace::regnamespace::text end,'acl',defaclacl::text)),'[]'::jsonb) from pg_default_acl where defaclobjtype='r' and (defaclnamespace=0 or defaclnamespace='public'::regnamespace))
) as approval_s_read_only;
