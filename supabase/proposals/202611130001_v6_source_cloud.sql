-- PROPOSAL ONLY. Owner approval required. Independent of the unchanged V6 PAPER proposal.
-- Source-only PostgreSQL storage; no Storage bucket, V5 writes or PAPER operations.
begin;
do $$begin
 if exists(select 1 from pg_roles where rolname='edgelab_v6_source') then raise exception 'Source role already exists; review collision';end if;
 create role edgelab_v6_source nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
end$$;
grant usage on schema public,auth to edgelab_v6_source;
grant execute on function auth.uid() to edgelab_v6_source;

create table public.v6_source_pilots(
 user_id uuid not null references auth.users(id), id uuid not null,
 history_batch_id uuid not null, namespace text not null,
 plan_hash text not null check(plan_hash ~ '^[a-f0-9]{64}$'), plan_raw text not null,
 receipt_hash text not null check(receipt_hash ~ '^[a-f0-9]{64}$'), receipt_raw text not null,
 starts_at timestamptz not null, expires_at timestamptz not null,
 active_host text not null default 'none' check(active_host in('none','cloud')),
 stopped boolean not null default true, epoch bigint not null default 0,
 revision bigint not null default 0, snapshot_hash text,
 lease_id uuid, lease_until timestamptz, last_attempt_at timestamptz,
 transfer_approval jsonb,transfer_snapshot_hash text, created_at timestamptz not null default now(),
 primary key(user_id,id),unique(user_id,plan_hash),
 foreign key(user_id,history_batch_id) references public.historical_import_batches(user_id,id),
 check(expires_at=starts_at+interval '14 days'),
 check(plan_hash=encode(sha256(convert_to(plan_raw,'UTF8')),'hex')),
 check(receipt_hash=encode(sha256(convert_to(receipt_raw,'UTF8')),'hex')),
 check(namespace ~ '^source-only:[a-f0-9]{64}$')
);
create table public.v6_source_objects(
 user_id uuid not null, pilot_id uuid not null, hash text not null,
 body text not null check(octet_length(body) between 1 and 16777216),
 created_at timestamptz not null default now(), primary key(user_id,pilot_id,hash),
 foreign key(user_id,pilot_id) references public.v6_source_pilots(user_id,id),
 check(hash=encode(sha256(convert_to(body,'UTF8')),'hex'))
);
create table public.v6_source_snapshots(
 user_id uuid not null,pilot_id uuid not null,revision bigint not null,hash text not null,
 manifest jsonb not null,manifest_raw text not null,
 check(hash=encode(sha256(convert_to(manifest_raw,'UTF8')),'hex') and manifest=manifest_raw::jsonb), created_at timestamptz not null default now(),
 primary key(user_id,pilot_id,revision),unique(user_id,pilot_id,hash),
 foreign key(user_id,pilot_id) references public.v6_source_pilots(user_id,id)
);
create table public.v6_source_capabilities(
 user_id uuid not null,pilot_id uuid not null,id uuid not null default gen_random_uuid(),
 token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),
 expires_at timestamptz not null,revoked_at timestamptz,created_at timestamptz not null default now(),
 primary key(user_id,id),foreign key(user_id,pilot_id) references public.v6_source_pilots(user_id,id)
);
create table public.v6_source_quotas(
 user_id uuid not null,pilot_id uuid not null,provider text not null check(provider in('odds','bdl')),
 period text not null,reserved integer not null check(reserved>=0),used integer check(used>=0),remaining integer check(remaining>=0),
 uncertain boolean not null default false,free_confirmed boolean not null default false,
 last_request_at timestamptz,blocked_until timestamptz,
 primary key(user_id,pilot_id,provider,period),foreign key(user_id,pilot_id) references public.v6_source_pilots(user_id,id)
);
create table public.v6_source_reservations(
 user_id uuid not null,pilot_id uuid not null,id uuid not null,provider text not null,period text not null,
 request_hash text not null,cost integer not null check(cost between 0 and 2),
 completed boolean not null default false,completion jsonb,created_at timestamptz not null default now(),
 primary key(user_id,pilot_id,id),
 foreign key(user_id,pilot_id,provider,period) references public.v6_source_quotas(user_id,pilot_id,provider,period)
);
create table public.v6_source_audit(
 id bigint generated always as identity primary key,user_id uuid not null,pilot_id uuid not null,
 action text not null,at timestamptz not null default now(),detail jsonb not null,
 foreign key(user_id,pilot_id) references public.v6_source_pilots(user_id,id)
);
create index v6_source_snapshot_latest on public.v6_source_snapshots(user_id,pilot_id,revision desc);
create index v6_source_reservation_rate on public.v6_source_reservations(user_id,pilot_id,provider,created_at desc);
create index v6_source_audit_owner on public.v6_source_audit(user_id,pilot_id,at desc);

-- No public direct writes, no deletion grants, no role membership. Worker can only use bounded dispatch.
do $$declare t text;begin
 foreach t in array array['pilots','objects','snapshots','capabilities','quotas','reservations','audit'] loop
  execute format('alter table public.v6_source_%I enable row level security',t);
  execute format('alter table public.v6_source_%I force row level security',t);
  execute format('revoke all on public.v6_source_%I from public,anon,authenticated',t);
  if t<>'capabilities' then
   execute format('grant select on public.v6_source_%I to authenticated',t);
   execute format('create policy owner_read on public.v6_source_%I for select to authenticated using(user_id=auth.uid())',t);
  end if;
  execute format('grant select,insert,update on public.v6_source_%I to edgelab_v6_source',t);
  execute format('create policy source_internal on public.v6_source_%I to edgelab_v6_source using(true) with check(true)',t);
 end loop;
end$$;
grant usage,select on sequence public.v6_source_audit_id_seq to edgelab_v6_source;
grant select on public.historical_import_batches to edgelab_v6_source;
create policy v6_source_anchor on public.historical_import_batches for select to edgelab_v6_source using(user_id=auth.uid());

create function public.v6_source_immutable() returns trigger language plpgsql set search_path='' as $$begin raise exception 'Source evidence is append only';end$$;
create trigger immutable_source_objects before update or delete on public.v6_source_objects for each row execute function public.v6_source_immutable();
create trigger immutable_source_snapshots before update or delete on public.v6_source_snapshots for each row execute function public.v6_source_immutable();
create trigger immutable_source_audit before update or delete on public.v6_source_audit for each row execute function public.v6_source_immutable();

-- Fixed path allowlist. Mirrors snapshot.server.ts. No secrets, personal workspaces or PAPER state.
create function public.v6_source_path_ok(p text) returns boolean language sql immutable set search_path='' as $$
 select p !~ '(\.\.|\\)' and p ~ '^(evidence/[a-f0-9]{64}|evidence-receipts/[a-f0-9-]{36}|source-quota-receipts/[a-f0-9-]{36}|team-games/dataset|team-games/snapshots/[a-f0-9]{64}|team-registry/[a-f0-9]{64}|team-reports/[a-f0-9]{64}|team-shadow/[a-f0-9-]{36}|team-shadow-reconciliations/[a-f0-9-]{36}/(decisions|evaluations)/[a-f0-9]{64}|observations/[a-f0-9-]{36}|model-development/(artifacts|reports|protocols|histories)/[a-f0-9]{64}|model-development/slates/[a-f0-9-]{36}|model-development/results/[a-f0-9-]{36}/[a-f0-9]{64}|model-development/shadow-config|controlled/(discovered-fixtures|features)|controlled/(histories)/[a-f0-9]{64}|controlled/(screens|proofs)/[a-f0-9-]{36}|controlled/[a-f0-9]{64}/(scheduler|health)|controlled/[a-f0-9]{64}/source-only-state/[a-f0-9]{64}|controlled/[a-f0-9]{64}/alerts/[a-f0-9]{64}|odds-shared-budget|balldontlie-team-budget)\.json$'
$$;

-- Owner-only setup/control RPC. Calling this is a separately approved hosted action.
-- Token generated by owner in a private runtime; only its SHA-256 enters this DB.
create function public.v6_source_owner(p_id uuid,p_action text,p jsonb) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();s public.v6_source_pilots; plan jsonb; receipt jsonb; result jsonb; exp timestamptz;credential_id uuid;
begin
 if u is null then raise exception 'Authentication required';end if;
 if p_action='provision' then
  plan:=(p->>'planRaw')::jsonb;receipt:=(p->>'receiptRaw')::jsonb;
  if not exists(select 1 from public.historical_import_batches where user_id=u and id=(plan->>'historyBatchId')::uuid) then raise exception 'Owner anchor required';end if;
  if coalesce((plan->>'format'<>'edgelab.v6-source-pilot' or plan->>'scope'<>'NBA_Sportsbet_full_game_moneyline_observations_only'
   or plan->>'paperRegistrations'<>'false' or plan->>'paperSettlements'<>'false' or plan->>'hostedAccess'<>'false'
   or (plan->>'monthlyOddsCeiling')::int<>60 or (plan->>'additionalOddsCredits')::int<>50
   or (plan->>'providerReserve')::int<>100 or (plan->>'baselineUsed')::int<>10 or (plan->>'baselineReserved')::int<>10
   or p->>'planHash'<>'c81a3f7ee8c7b441276e6459befef36da52d4855fcb237aeb392f03b5591c879'
   or p->>'receiptHash'<>'c5f236058560271ff86fe4c3f7c042d8a93ced970e171835adfb64c6ded55a16'
   or receipt#>>'{pilot,approvalStatus}'<>'approved'),true) then raise exception 'Exact original source-only approval required';end if;
  insert into public.v6_source_pilots(user_id,id,history_batch_id,namespace,plan_hash,plan_raw,receipt_hash,receipt_raw,starts_at,expires_at)
   values(u,p_id,(plan->>'historyBatchId')::uuid,plan->>'ownerId',p->>'planHash',p->>'planRaw',p->>'receiptHash',p->>'receiptRaw',(plan->>'startsAt')::timestamptz,(plan->>'expiresAt')::timestamptz);
  result:=jsonb_build_object('status','provisioned_stopped');
 else
  select * into strict s from public.v6_source_pilots where user_id=u and id=p_id for update;
  if p_action='issue' then
   exp:=(p->>'expiresAt')::timestamptz;
   if coalesce(((p->>'tokenHash') !~ '^[a-f0-9]{64}$' or exp<=clock_timestamp() or exp>s.expires_at or exp>clock_timestamp()+interval '30 days'),true) then raise exception 'Invalid source credential';end if;
   insert into public.v6_source_capabilities(user_id,pilot_id,token_hash,expires_at) values(u,p_id,p->>'tokenHash',exp) returning id into credential_id;
   result:=jsonb_build_object('status','issued','credentialId',credential_id);
  elsif p_action='revoke' then
   update public.v6_source_capabilities set revoked_at=clock_timestamp() where user_id=u and pilot_id=p_id and id=(p->>'credentialId')::uuid;
   result:=jsonb_build_object('status','revoked');
  elsif p_action='stop' then
   update public.v6_source_pilots set stopped=true,active_host='none',epoch=epoch+1,lease_id=null,lease_until=null where user_id=u and id=p_id;
   result:=jsonb_build_object('status','stopped');
  elsif p_action='transfer' then
   if coalesce((p->>'format'<>'edgelab.v6-source-host-transfer' or p->>'version'<>'1' or p->>'approved'<>'true' or p->>'target'<>'github_actions' or p->>'paperRegistrations'<>'false' or p->>'paperSettlements'<>'false' or (p->>'codeRevision') !~ '^[a-f0-9]{40}$' or s.snapshot_hash is null or p->>'snapshotHash'<>s.snapshot_hash or p->>'planHash'<>s.plan_hash
    or p->>'localStopped'<>'true' or p->>'localInFlight'<>'false' or length(p->>'approvalReference')<12
    or (p->>'approvedAt')::timestamptz>clock_timestamp() or (p->>'approvedAt')::timestamptz<clock_timestamp()-interval '1 day'
    or clock_timestamp()>=s.expires_at or coalesce(s.lease_until>clock_timestamp(),false)),true) then raise exception 'Fresh explicit host transfer approval and stopped local evidence required';end if;
   update public.v6_source_pilots set stopped=false,active_host='cloud',epoch=epoch+1,transfer_approval=p,transfer_snapshot_hash=s.snapshot_hash where user_id=u and id=p_id;
   result:=jsonb_build_object('status','cloud_source_only');
  elsif p_action='seed_quota' then
   if s.active_host<>'none' or not s.stopped or s.epoch<>0 then raise exception 'Seed only during stopped initial handover';end if;
   if coalesce(((p->>'reserved')::int<10 or (p->>'used')::int<10 or (p->>'remaining')::int+(p->>'used')::int<>500),true) then raise exception 'Preserve original quota';end if;
   insert into public.v6_source_quotas(user_id,pilot_id,provider,period,reserved,used,remaining,uncertain,free_confirmed,last_request_at)
    values(u,p_id,'odds',s.plan_raw::jsonb->>'period',(p->>'reserved')::int,(p->>'used')::int,(p->>'remaining')::int,coalesce((p->>'uncertain')::boolean,true),coalesce((p->>'freeConfirmed')::boolean,false),(p->>'lastRequestAt')::timestamptz)
   on conflict(user_id,pilot_id,provider,period) do update set reserved=greatest(v6_source_quotas.reserved,excluded.reserved),used=greatest(v6_source_quotas.used,excluded.used),remaining=least(v6_source_quotas.remaining,excluded.remaining),uncertain=excluded.uncertain,free_confirmed=excluded.free_confirmed,last_request_at=greatest(v6_source_quotas.last_request_at,excluded.last_request_at);
   insert into public.v6_source_quotas(user_id,pilot_id,provider,period,reserved,last_request_at,blocked_until)
    values(u,p_id,'bdl',p->>'bdlDay',(p->>'bdlRequests')::int,(p->>'bdlLastAt')::timestamptz,(p->>'bdlBlockedUntil')::timestamptz)
   on conflict(user_id,pilot_id,provider,period) do update set reserved=greatest(v6_source_quotas.reserved,excluded.reserved),last_request_at=greatest(v6_source_quotas.last_request_at,excluded.last_request_at),blocked_until=greatest(v6_source_quotas.blocked_until,excluded.blocked_until);
   result:=jsonb_build_object('status','quota_preserved');
  else raise exception 'Unsupported owner action';end if;
 end if;
 insert into public.v6_source_audit(user_id,pilot_id,action,detail) values(u,p_id,p_action,result);
 return result;
end$$;
alter function public.v6_source_owner(uuid,text,jsonb) owner to edgelab_v6_source;
revoke all on function public.v6_source_owner(uuid,text,jsonb) from public,anon;
grant execute on function public.v6_source_owner(uuid,text,jsonb) to authenticated;

-- Worker and stopped owner bootstrap dispatcher. All mutations lock one pilot first.
create function public.v6_source_dispatch(p_id uuid,p_token text,p_action text,p jsonb) returns jsonb
 language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare u uuid; s public.v6_source_pilots;c public.v6_source_capabilities;q public.v6_source_quotas;
 r public.v6_source_reservations; owner_bootstrap boolean:=false;result jsonb;f jsonb;old_file jsonb;body text;period_key text;cost int;provider text;endpoint text;h text;known boolean;at_time timestamptz:=clock_timestamp();total bigint;
begin
 if p_token is null then u:=auth.uid();owner_bootstrap:=true;
 else
  if length(p_token)<>64 or p_token !~ '^[a-f0-9]{64}$' then raise exception 'Invalid source capability';end if;
  select * into c from public.v6_source_capabilities where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') and pilot_id=p_id;
  if c.id is null or c.revoked_at is not null or c.expires_at<=at_time then raise exception 'Invalid source capability';end if;u:=c.user_id;
 end if;
 if u is null then raise exception 'Authentication required';end if;
 select * into strict s from public.v6_source_pilots where user_id=u and id=p_id for update;
 if p_action='load' then
  return jsonb_build_object('pilot',to_jsonb(s),'snapshot',(select manifest from public.v6_source_snapshots where user_id=u and pilot_id=p_id and revision=s.revision),'snapshotRaw',(select manifest_raw from public.v6_source_snapshots where user_id=u and pilot_id=p_id and revision=s.revision),'quotas',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from public.v6_source_quotas x where user_id=u and pilot_id=p_id));
 elsif p_action='get' then
  select o.body into strict body from public.v6_source_objects o where o.user_id=u and o.pilot_id=p_id and o.hash=p->>'hash';return jsonb_build_object('body',body);
 end if;
 if owner_bootstrap then
  if not s.stopped or s.active_host<>'none' or s.lease_until>at_time or p_action not in('put','commit') then raise exception 'Stopped owner bootstrap only';end if;
 else
  if s.active_host<>'cloud' or s.stopped or at_time<s.starts_at or at_time>=s.expires_at then raise exception 'Cloud source worker disabled or expired';end if;
  if p_action='claim' then
   if s.lease_until>at_time then raise exception 'Source worker lease busy';end if;
   update public.v6_source_pilots set lease_id=(p->>'leaseId')::uuid,lease_until=least(at_time+interval '10 minutes',expires_at),epoch=epoch+1,last_attempt_at=at_time where user_id=u and id=p_id;
   return jsonb_build_object('epoch',s.epoch+1);
  end if;
  if s.lease_id is distinct from (p->>'leaseId')::uuid or s.epoch is distinct from (p->>'epoch')::bigint or s.lease_until<=at_time then raise exception 'Source lease lost';end if;
 end if;
 if p_action='renew' then
  update public.v6_source_pilots set lease_until=least(at_time+interval '10 minutes',expires_at) where user_id=u and id=p_id;return jsonb_build_object('status','renewed');
 elsif p_action='release' then
  update public.v6_source_pilots set lease_id=null,lease_until=null where user_id=u and id=p_id;result:=jsonb_build_object('status','released');
 elsif p_action='reserve' then
  provider:=p->>'provider';endpoint:=p->>'endpoint';cost:=(p->>'cost')::int;
  if coalesce(((provider='odds' and not ((endpoint='/v4/sports' and cost=0) or (endpoint='/v4/sports/basketball_nba/odds' and cost=1 and p#>>'{parameters,bookmakers}'='sportsbet' and p#>>'{parameters,markets}'='h2h') or (endpoint='/v4/sports/basketball_nba/scores' and cost=2 and p#>>'{parameters,daysFrom}' in('1','2','3'))))
   or (provider='bdl' and (endpoint !~ '^/v1/(teams|games)(/[0-9]+)?$' or cost<>1)) or provider not in('odds','bdl')),true) then raise exception 'Unapproved source request';end if;
  period_key:=case when provider='odds' then to_char(at_time at time zone 'UTC','YYYY-MM') else to_char(at_time at time zone 'UTC','YYYY-MM-DD') end;
  if provider='odds' and period_key<>s.plan_raw::jsonb->>'period' then raise exception 'Quota month mismatch';end if;
  insert into public.v6_source_quotas(user_id,pilot_id,provider,period,reserved) values(u,p_id,provider,period_key,0) on conflict do nothing;
  select * into strict q from public.v6_source_quotas x where x.user_id=u and x.pilot_id=p_id and x.provider=provider and x.period=period_key for update;
  h:=encode(sha256(convert_to((p-'leaseId'-'epoch'-'id')::text,'UTF8')),'hex');
  select * into r from public.v6_source_reservations where user_id=u and pilot_id=p_id and id=(p->>'id')::uuid;
  if r.id is not null then if r.request_hash<>h then raise exception 'Reservation replay conflict';end if;return jsonb_build_object('status','reserved');end if;
  if provider='odds' and ((cost>0 and (q.uncertain or not q.free_confirmed)) or greatest(q.reserved,coalesce(q.used,0))+cost>60 or (q.remaining is not null and q.remaining-cost<100)) then raise exception 'Source quota or reserve blocked';end if;
  if provider='bdl' and (q.reserved>=60 or q.blocked_until>at_time or (select count(*) from public.v6_source_reservations x where x.user_id=u and x.pilot_id=p_id and x.provider='bdl' and x.created_at>at_time-interval '1 minute')>=5) then raise exception 'Free source rate blocked';end if;
  if q.last_request_at>at_time-(case when provider='odds' then interval '1 second' else interval '12.5 seconds' end) then raise exception 'Source cooldown';end if;
  update public.v6_source_quotas x set reserved=q.reserved+cost,last_request_at=at_time,uncertain=case when provider='odds' then true else q.uncertain end where x.user_id=u and x.pilot_id=p_id and x.provider=provider and x.period=period_key;
  insert into public.v6_source_reservations(user_id,pilot_id,id,provider,period,request_hash,cost) values(u,p_id,(p->>'id')::uuid,provider,period_key,h,cost);
  result:=jsonb_build_object('status','reserved');
 elsif p_action='complete_quota' then
  select * into strict r from public.v6_source_reservations where user_id=u and pilot_id=p_id and id=(p->>'id')::uuid for update;
  if r.completed then if r.completion is distinct from p->'result' then raise exception 'Quota completion conflict';end if;return jsonb_build_object('status','completed');end if;
  if r.provider='odds' then
   known:=(p#>>'{result,used}') ~ '^[0-9]+$' and (p#>>'{result,remaining}') ~ '^[0-9]+$' and (p#>>'{result,used}')::int+(p#>>'{result,remaining}')::int=500;
   update public.v6_source_quotas x set used=greatest(x.used,(p#>>'{result,used}')::int),remaining=(p#>>'{result,remaining}')::int,uncertain=not coalesce(known,false),free_confirmed=coalesce(known,false) where x.user_id=u and x.pilot_id=p_id and x.provider=r.provider and x.period=r.period;
  else
   update public.v6_source_quotas x set blocked_until=case when p#>>'{result,blockedUntil}' is null then x.blocked_until else greatest(x.blocked_until,least(at_time+interval '1 day',(p#>>'{result,blockedUntil}')::timestamptz)) end where x.user_id=u and x.pilot_id=p_id and x.provider=r.provider and x.period=r.period;
  end if;
  update public.v6_source_reservations set completed=true,completion=p->'result' where user_id=u and pilot_id=p_id and id=r.id;result:=jsonb_build_object('status','completed');
 elsif p_action='put' then
  body:=p->>'body';h:=p->>'hash';perform body::jsonb;
  if h is null or body is null or h<>encode(sha256(convert_to(body,'UTF8')),'hex') then raise exception 'Source object hash mismatch';end if;
  if not exists(select 1 from public.v6_source_objects where user_id=u and pilot_id=p_id and hash=h) then
   select coalesce(sum(octet_length(o.body)),0)+octet_length(body) into total from public.v6_source_objects o where o.user_id=u and o.pilot_id=p_id;
   if total>100663296 then raise exception 'Free research storage guard';end if;
   insert into public.v6_source_objects(user_id,pilot_id,hash,body) values(u,p_id,h,body);
  end if;return jsonb_build_object('status','retained');
 elsif p_action='commit' then
  if (p->>'expectedRevision')::bigint is distinct from s.revision then raise exception 'Source snapshot revision conflict';end if;
  h:=p->>'hash';body:=p->>'manifestRaw';
  if coalesce((h=encode(sha256(convert_to(body,'UTF8')),'hex') and body::jsonb->>'format'='edgelab.v6-source-snapshot' and body::jsonb->>'version'='1' and jsonb_typeof(body::jsonb->'files')='array' and jsonb_array_length(body::jsonb->'files')<=2000),false) is not true then raise exception 'Snapshot integrity';end if;
  if (select count(*) from jsonb_array_elements(body::jsonb->'files'))<>(select count(distinct x->>'path') from jsonb_array_elements(body::jsonb->'files') x) then raise exception 'Duplicate snapshot paths';end if;
  for f in select value from jsonb_array_elements(body::jsonb->'files') loop
   if coalesce((not public.v6_source_path_ok(f->>'path') or not exists(select 1 from public.v6_source_objects o where o.user_id=u and o.pilot_id=p_id and o.hash=f->>'hash' and octet_length(o.body)=(f->>'bytes')::bigint)),true) then raise exception 'Invalid source object reference';end if;
   select x into old_file from public.v6_source_snapshots ss,jsonb_array_elements(ss.manifest->'files') x where ss.user_id=u and ss.pilot_id=p_id and ss.revision=s.revision and x->>'path'=f->>'path';
   if old_file is not null and old_file->>'hash'<>f->>'hash' and f->>'path' !~ '^(controlled/([a-f0-9]{64}/(scheduler|health|source-only-state/[a-f0-9]{64})|features|discovered-fixtures)|odds-shared-budget|balldontlie-team-budget)\.json$' then raise exception 'Immutable original source path';end if;
   if f->>'path' ~ '^controlled/[a-f0-9]{64}/source-only-state/' then
    select o.body::jsonb into strict result from public.v6_source_objects o where o.user_id=u and o.pilot_id=p_id and o.hash=f->>'hash';
    if coalesce((jsonb_array_length(result->'positions')=0 and jsonb_array_length(result->'grades')=0 and result->>'ownerId'=s.namespace),false) is not true then raise exception 'Source worker state cannot contain PAPER positions or grades';end if;
   end if;
   if not owner_bootstrap and old_file is null and f->>'path' ~ '^model-development/slates/' then
    select o.body::jsonb into strict result from public.v6_source_objects o where o.user_id=u and o.pilot_id=p_id and o.hash=f->>'hash';
    if coalesce(((result#>>'{record,positionsRegistered}')::int=0 and (result#>>'{record,financialWrites}')::int=0 and result#>>'{record,ownerId}'=s.namespace and jsonb_typeof(result#>'{record,fixtures}')='array'),false) is not true then raise exception 'Source-only slate required';end if;
    if exists(select 1 from jsonb_array_elements(result#>'{record,fixtures}') x where x->'homeProbabilities'<>'null'::jsonb and coalesce((x#>>'{proof,earliestStartsAt}')::timestamptz>clock_timestamp()+interval '60 seconds',false) is not true) then raise exception 'Cloud forecast commit is no longer pre-event';end if;
   end if;
  end loop;
  if s.revision>0 and exists(select 1 from public.v6_source_snapshots ss,jsonb_array_elements(ss.manifest->'files') x where ss.user_id=u and ss.pilot_id=p_id and ss.revision=s.revision and not exists(select 1 from jsonb_array_elements(body::jsonb->'files') y where y->>'path'=x->>'path')) then raise exception 'Snapshot cannot discard retained evidence';end if;
  if h=s.snapshot_hash then return jsonb_build_object('revision',s.revision,'hash',h);end if;
  insert into public.v6_source_snapshots(user_id,pilot_id,revision,hash,manifest,manifest_raw) values(u,p_id,s.revision+1,h,body::jsonb,body);
  update public.v6_source_pilots set revision=s.revision+1,snapshot_hash=h where user_id=u and id=p_id;result:=jsonb_build_object('revision',s.revision+1,'hash',h);
 else raise exception 'Unsupported source-only operation';end if;
 insert into public.v6_source_audit(user_id,pilot_id,action,detail) values(u,p_id,p_action,result);return result;
end$$;
alter function public.v6_source_dispatch(uuid,text,text,jsonb) owner to edgelab_v6_source;
revoke all on function public.v6_source_dispatch(uuid,text,text,jsonb) from public;
grant execute on function public.v6_source_dispatch(uuid,text,text,jsonb) to anon,authenticated;
revoke all on function public.v6_source_immutable(),public.v6_source_path_ok(text) from public;
grant execute on function public.v6_source_path_ok(text) to edgelab_v6_source;
commit;
