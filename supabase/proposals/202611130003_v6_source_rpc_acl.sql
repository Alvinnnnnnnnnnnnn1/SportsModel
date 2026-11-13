-- PROPOSAL ONLY. Separate explicit owner approval required; never edit migration02.
-- Correct RPC ACLs after function ownership transfer under a NOINHERIT executor.
-- No source upload, capability issuance, activation, data DML or PAPER objects.
begin;
do $acl$
declare executor name:=current_user;
begin
 if to_regrole('edgelab_v6_source') is null
  or (select proowner from pg_proc where oid='public.v6_source_owner(uuid,text,jsonb)'::regprocedure)<>'edgelab_v6_source'::regrole
  or (select proowner from pg_proc where oid='public.v6_source_dispatch(uuid,text,text,jsonb)'::regprocedure)<>'edgelab_v6_source'::regrole then
  raise exception 'Expected deployed source schema required';
 end if;
 if exists(select 1 from pg_auth_members where roleid='edgelab_v6_source'::regrole
   and (member<>executor::regrole or set_option or inherit_option))
  or has_schema_privilege('edgelab_v6_source','public','CREATE') then
  raise exception 'Unexpected source role authority; stop for review';
 end if;
 if exists(select 1 from public.v6_source_pilots)
  or exists(select 1 from public.v6_source_objects)
  or exists(select 1 from public.v6_source_snapshots)
  or exists(select 1 from public.v6_source_capabilities)
  or exists(select 1 from public.v6_source_quotas)
  or exists(select 1 from public.v6_source_reservations)
  or exists(select 1 from public.v6_source_audit) then
  raise exception 'Schema-only empty source state required';
 end if;
 -- SET permission alone does not let a NOINHERIT executor revoke owner grants.
 -- Become the exact grantor, rather than relying on inherited ownership rights.
 execute format('grant edgelab_v6_source to %I with set true, inherit false',executor);
 perform set_config('role','edgelab_v6_source',true);
 revoke all on function public.v6_source_owner(uuid,text,jsonb) from public,anon;
 grant execute on function public.v6_source_owner(uuid,text,jsonb) to authenticated;
 revoke all on function public.v6_source_dispatch(uuid,text,text,jsonb) from public;
 grant execute on function public.v6_source_dispatch(uuid,text,text,jsonb) to anon,authenticated;
 perform set_config('role',executor,true);
 execute format('revoke edgelab_v6_source from %I',executor);
 if has_function_privilege('anon','public.v6_source_owner(uuid,text,jsonb)','EXECUTE')
  or not has_function_privilege('authenticated','public.v6_source_owner(uuid,text,jsonb)','EXECUTE')
  or not has_function_privilege('anon','public.v6_source_dispatch(uuid,text,text,jsonb)','EXECUTE')
  or not has_function_privilege('authenticated','public.v6_source_dispatch(uuid,text,text,jsonb)','EXECUTE')
  or exists(select 1 from pg_proc p cross join lateral aclexplode(p.proacl) a
   where p.oid in('public.v6_source_owner(uuid,text,jsonb)'::regprocedure,'public.v6_source_dispatch(uuid,text,text,jsonb)'::regprocedure)
    and a.grantee=0 and a.privilege_type='EXECUTE')
  or exists(select 1 from pg_auth_members where roleid='edgelab_v6_source'::regrole
   and (member<>executor::regrole or set_option or inherit_option))
  or pg_has_role(executor,'edgelab_v6_source','SET')
  or pg_has_role(executor,'edgelab_v6_source','USAGE') then
  raise exception 'Source RPC ACL or temporary membership cleanup failed';
 end if;
end $acl$;
commit;
