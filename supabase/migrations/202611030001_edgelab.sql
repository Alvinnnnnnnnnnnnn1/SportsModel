-- EdgeLab MVP. Apply once to a new Supabase project using the SQL editor.
-- All browser-visible rows are private to auth.uid(). No service-role key required.
begin;
create extension if not exists pgcrypto;

-- NULL or partial JSON provenance must fail CHECK rather than evaluating UNKNOWN.
create function public.edgelab_valid_private_provenance(value jsonb) returns boolean
language sql stable set search_path = '' as $$
  select coalesce(
    jsonb_typeof(value) = 'object'
    and length(btrim(value->>'source')) > 0
    and length(btrim(value->>'method')) > 0
    and length(btrim(value->>'modelVersion')) > 0
    and value->'simulated' = 'false'::jsonb
    and value->>'timestamp' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$'
    and (value->>'timestamp')::timestamptz is not null,
    false
  )
$$;


create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now()
);
create table public.experiment_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  funding_cap numeric(14,2) not null default 500 check (funding_cap >= 0),
  default_stake numeric(14,2) not null default 5 check (default_stake > 0),
  currency text not null default 'AUD' check (currency = 'AUD'),
  timezone text not null default 'Australia/Melbourne' check (timezone = 'Australia/Melbourne'),
  revision bigint not null default 0 check (revision >= 0),
  updated_at timestamptz not null default now()
);
create table public.sports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null check (code in ('NBA','NBL','ATP','WTA')),
  unique(user_id, id), unique(user_id, code)
);
create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sport_id uuid not null,
  name text not null check (length(name) > 0),
  starts_at timestamptz,
  created_at timestamptz not null default now(),
  unique(user_id,id), unique(user_id,sport_id,name),
  foreign key(user_id,sport_id) references public.sports(user_id,id)
);
create table public.model_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  method text not null,
  created_at timestamptz not null default now(),
  unique(user_id,id), unique(user_id,name,method)
);
-- JSON payloads preserve the validated TypeScript snapshot; generated NUMERIC columns
-- provide typed financial/probability data without two independently editable values.
create table public.research_candidates (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null,
  model_version_id uuid,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  decimal_odds numeric(12,4) generated always as ((payload->>'odds')::numeric) stored not null check (decimal_odds > 1),
  probability numeric generated always as ((payload->>'probability')::numeric) stored check (probability between 0 and 1),
  strategy text generated always as (payload->>'strategy') stored not null check (strategy in ('A','B','C')),
  registered_at timestamptz not null,
  unique(user_id,id),
  foreign key(user_id,event_id) references public.events(user_id,id),
  foreign key(user_id,model_version_id) references public.model_versions(user_id,id),
  check ((payload->>'id')::uuid is not distinct from id),
  check (public.edgelab_valid_private_provenance(payload->'oddsProvenance')),
  check (payload->'probabilityProvenance' is null or public.edgelab_valid_private_provenance(payload->'probabilityProvenance')),
  check (probability is null or public.edgelab_valid_private_provenance(payload->'probabilityProvenance')),
  check ((payload->>'registeredAt')::timestamptz is not distinct from registered_at)
);
create table public.bets (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  candidate_id uuid,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  stake numeric(14,2) generated always as ((payload->>'stakeCents')::numeric / 100) stored not null check (stake > 0),
  stake_type text generated always as (payload->>'stakeType') stored not null check (stake_type in ('cash','bonus')),
  decimal_odds numeric(12,4) generated always as ((payload->>'odds')::numeric) stored not null check (decimal_odds > 1),
  outcome text generated always as (payload->>'outcome') stored not null check (outcome in ('pending','won','lost','void')),
  strategy text generated always as (payload->>'strategy') stored not null check (strategy in ('A','B','C')),
  probability numeric generated always as ((payload->>'probability')::numeric) stored check (probability between 0 and 1),
  bookmaker text generated always as (payload->>'bookmaker') stored not null,
  placed_at timestamptz not null,
  confirmed_at timestamptz not null,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  unique(user_id,id),
  foreign key(user_id,candidate_id) references public.research_candidates(user_id,id),
  check ((payload->>'id')::uuid is not distinct from id),
  check (jsonb_array_length(payload->'legs') > 0),
  check (payload->'oddsProvenance' is null or public.edgelab_valid_private_provenance(payload->'oddsProvenance')),
  check (payload->'probabilityProvenance' is null or public.edgelab_valid_private_provenance(payload->'probabilityProvenance')),
  check (probability is null or public.edgelab_valid_private_provenance(payload->'probabilityProvenance')),
  check ((payload->>'stakeCents')::numeric = trunc((payload->>'stakeCents')::numeric)),
  check ((payload->>'candidateId')::uuid is not distinct from candidate_id),
  check ((payload->>'placedAt')::timestamptz is not distinct from placed_at),
  check ((payload->>'confirmedAt')::timestamptz is not distinct from confirmed_at),
  check ((payload->>'settledAt')::timestamptz is not distinct from settled_at),
  check (settled_at is null or settled_at >= placed_at),
  check ((outcome = 'pending' and settled_at is null) or (outcome <> 'pending' and settled_at is not null))
);
create table public.bet_legs (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  bet_id uuid not null,
  event_id uuid not null,
  payload jsonb not null,
  active boolean not null default true,
  market text generated always as (payload->>'market') stored not null,
  selection text generated always as (payload->>'selection') stored not null,
  threshold text generated always as (payload->>'line') stored not null,
  decimal_odds numeric(12,4) generated always as ((payload->>'odds')::numeric) stored not null check (decimal_odds > 1),
  outcome text generated always as (payload->>'outcome') stored not null check (outcome in ('pending','won','lost','void')),
  unique(user_id,id),
  foreign key(user_id,bet_id) references public.bets(user_id,id),
  foreign key(user_id,event_id) references public.events(user_id,id),
  check ((payload->>'id')::uuid is not distinct from id)
);
create table public.financial_transactions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null,
  kind text generated always as (payload->>'kind') stored not null check (kind in ('deposit','withdrawal')),
  amount numeric(14,2) generated always as ((payload->>'amountCents')::numeric / 100) stored not null check (amount > 0),
  created_at timestamptz not null,
  unique(user_id,id), check ((payload->>'id')::uuid is not distinct from id),
  check ((payload->>'createdAt')::timestamptz is not distinct from created_at),
  check ((payload->>'amountCents')::numeric = trunc((payload->>'amountCents')::numeric))
);
create table public.paper_predictions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  candidate_id uuid not null,
  payload jsonb not null,
  hypothetical_stake numeric(14,2) generated always as ((payload->>'hypotheticalStakeCents')::numeric / 100) stored not null check (hypothetical_stake > 0),
  outcome text generated always as (payload->>'outcome') stored not null check (outcome in ('pending','won','lost','void')),
  registered_at timestamptz not null,
  settled_at timestamptz,
  unique(user_id,id), unique(user_id,candidate_id),
  foreign key(user_id,candidate_id) references public.research_candidates(user_id,id),
  check ((payload->>'id')::uuid is not distinct from id),
  check ((payload#>>'{candidate,id}')::uuid is not distinct from candidate_id),
  check (public.edgelab_valid_private_provenance(payload#>'{candidate,oddsProvenance}')),
  check ((payload->>'registeredAt')::timestamptz is not distinct from registered_at),
  check ((payload->>'settledAt')::timestamptz is not distinct from settled_at),
  check ((payload->>'hypotheticalStakeCents')::numeric = trunc((payload->>'hypotheticalStakeCents')::numeric)),
  check (settled_at is null or settled_at >= registered_at),
  check ((outcome = 'pending' and settled_at is null) or (outcome <> 'pending' and settled_at is not null))
);
create table public.odds_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  candidate_id uuid not null,
  decimal_odds numeric(12,4) not null check (decimal_odds > 1),
  source text not null,
  captured_at timestamptz not null,
  provenance jsonb not null,
  unique(user_id,id), unique(user_id,candidate_id),
  foreign key(user_id,candidate_id) references public.research_candidates(user_id,id),
  check (public.edgelab_valid_private_provenance(provenance)),
  check (source is not distinct from provenance->>'source'),
  check (captured_at is not distinct from (provenance->>'timestamp')::timestamptz)
);
create table public.notifications (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  candidate_id uuid,
  payload jsonb not null,
  created_at timestamptz not null,
  unique(user_id,id),
  foreign key(user_id,candidate_id) references public.research_candidates(user_id,id),
  check ((payload->>'id')::uuid is not distinct from id),
  check ((payload->>'candidateId')::uuid is not distinct from candidate_id),
  check ((payload->>'createdAt')::timestamptz is not distinct from created_at),
  check (payload->'simulated' is not distinct from 'false'::jsonb)
);
create table public.research_runs (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null,
  status text generated always as (payload->>'status') stored not null check (status in ('running','completed','failed')),
  started_at timestamptz not null,
  unique(user_id,id),
  check ((payload->>'id')::uuid is not distinct from id),
  check ((payload->>'startedAt')::timestamptz is not distinct from started_at),
  check (payload->'simulated' is not distinct from 'false'::jsonb)
);
create table public.audit_history (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null check (entity_type in ('bet','paper','settings','transaction')),
  entity_id text not null,
  action text not null,
  payload jsonb not null,
  created_at timestamptz not null,
  unique(user_id,id), check ((payload->>'id')::uuid is not distinct from id),
  check (payload->>'entityType' is not distinct from entity_type),
  check (payload->>'entityId' is not distinct from entity_id),
  check (payload->>'action' is not distinct from action),
  check ((payload->>'timestamp')::timestamptz is not distinct from created_at)
);

create index bets_owner_date on public.bets(user_id,placed_at desc);
create index bets_owner_outcome on public.bets(user_id,outcome);
create index legs_owner_bet on public.bet_legs(user_id,bet_id);
create index events_owner_sport on public.events(user_id,sport_id);
create index candidates_owner_date on public.research_candidates(user_id,registered_at desc);
create index papers_owner_outcome on public.paper_predictions(user_id,outcome);
create index transactions_owner_date on public.financial_transactions(user_id,created_at);
create index notifications_owner_date on public.notifications(user_id,created_at desc);
create index runs_owner_date on public.research_runs(user_id,started_at desc);
create index audit_owner_entity on public.audit_history(user_id,entity_type,entity_id,created_at desc);
create index snapshots_owner_date on public.odds_snapshots(user_id,captured_at desc);

-- Every table, including reference data, is private. No anonymous policies or grants.
alter table public.user_profiles enable row level security;
create policy profile_owner on public.user_profiles for all to authenticated using (id = auth.uid()) with check (id = auth.uid());
revoke all on public.user_profiles from authenticated;
grant select,insert,update on public.user_profiles to authenticated;
do $$
declare table_name text;
begin
  foreach table_name in array array['experiment_settings','sports','events','model_versions','research_candidates','bets','bet_legs','financial_transactions','paper_predictions','odds_snapshots','notifications','research_runs','audit_history'] loop
    execute format('alter table public.%I enable row level security',table_name);
    execute format('create policy owner_access on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())',table_name);
    execute format('revoke all on public.%I from anon,authenticated',table_name);
    execute format('grant select,insert,update on public.%I to authenticated',table_name);
  end loop;
end $$;
revoke all on public.user_profiles from anon;
-- Deliberately no DELETE grants: financial/audit/research history is retained.

create function public.edgelab_deny_rewrite() returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception '% records are immutable; append a new record instead',TG_TABLE_NAME;
end $$;
create trigger immutable_candidates before update on public.research_candidates for each row execute function public.edgelab_deny_rewrite();
create trigger immutable_transactions before update on public.financial_transactions for each row execute function public.edgelab_deny_rewrite();
create trigger immutable_odds before update on public.odds_snapshots for each row execute function public.edgelab_deny_rewrite();
create trigger immutable_models before update on public.model_versions for each row execute function public.edgelab_deny_rewrite();
create trigger immutable_audit before update on public.audit_history for each row execute function public.edgelab_deny_rewrite();

create function public.edgelab_guard_prediction() returns trigger language plpgsql set search_path = '' as $$
begin
  if TG_TABLE_NAME = 'paper_predictions' then
    if not exists (select 1 from public.research_candidates c where c.user_id=NEW.user_id and c.id=NEW.candidate_id and c.payload=NEW.payload->'candidate') then
      raise exception 'Paper snapshot must match the original registered candidate';
    end if;
    if TG_OP = 'UPDATE' and (OLD.payload - array['outcome','settledAt','statistic']) is distinct from (NEW.payload - array['outcome','settledAt','statistic']) then
      raise exception 'Registered paper predictions are immutable; only settlement may change';
    end if;
  else
    if OLD.payload->'probability' is distinct from NEW.payload->'probability' or OLD.payload->'probabilityProvenance' is distinct from NEW.payload->'probabilityProvenance' or OLD.payload->'oddsProvenance' is distinct from NEW.payload->'oddsProvenance' or OLD.candidate_id is distinct from NEW.candidate_id then
      raise exception 'Registered probability and prediction provenance are immutable';
    end if;
  end if;
  return NEW;
end $$;
create trigger paper_snapshot_guard before insert or update on public.paper_predictions for each row execute function public.edgelab_guard_prediction();
create trigger bet_probability_guard before update on public.bets for each row execute function public.edgelab_guard_prediction();

-- Server-written audit entry for every changed bet, including direct SQL API updates.
create function public.edgelab_audit_bet() returns trigger language plpgsql set search_path = '' as $$
declare audit_id uuid := gen_random_uuid(); stamp timestamptz := now();
begin
  if NEW.payload is distinct from OLD.payload then
    insert into public.audit_history(id,user_id,entity_type,entity_id,action,created_at,payload)
    values(audit_id,NEW.user_id,'bet',NEW.id::text,'database update',stamp,
      jsonb_build_object('id',audit_id,'entityType','bet','entityId',NEW.id,'action','database update','timestamp',stamp,'before',OLD.payload,'after',NEW.payload));
  end if;
  return NEW;
end $$;
create trigger bet_update_audit after update on public.bets for each row execute function public.edgelab_audit_bet();

create function public.edgelab_load_workspace() returns jsonb language plpgsql security invoker set search_path = '' as $$
declare owner_id uuid := auth.uid(); settings_row public.experiment_settings%rowtype; result jsonb;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  select * into settings_row from public.experiment_settings where user_id = owner_id;
  if not found then return jsonb_build_object('revision',0,'workspace',null); end if;
  result := jsonb_build_object(
    'version',1,
    'settings',jsonb_build_object('fundingCapCents',(settings_row.funding_cap*100)::bigint,'defaultStakeCents',(settings_row.default_stake*100)::bigint,'currency',settings_row.currency,'timezone',settings_row.timezone),
    'bets',coalesce((select jsonb_agg(payload order by placed_at desc,id) from public.bets where user_id=owner_id),'[]'::jsonb),
    'transactions',coalesce((select jsonb_agg(payload order by created_at,id) from public.financial_transactions where user_id=owner_id),'[]'::jsonb),
    'candidates',coalesce((select jsonb_agg(payload order by registered_at desc,id) from public.research_candidates where user_id=owner_id),'[]'::jsonb),
    'paperPredictions',coalesce((select jsonb_agg(payload order by registered_at desc,id) from public.paper_predictions where user_id=owner_id),'[]'::jsonb),
    'notifications',coalesce((select jsonb_agg(payload order by created_at desc,id) from public.notifications where user_id=owner_id),'[]'::jsonb),
    'researchRuns',coalesce((select jsonb_agg(payload order by started_at desc,id) from public.research_runs where user_id=owner_id),'[]'::jsonb),
    'audit',coalesce((select jsonb_agg(payload order by created_at desc,id) from public.audit_history where user_id=owner_id),'[]'::jsonb)
  );
  return jsonb_build_object('revision',settings_row.revision,'workspace',result);
end $$;

create function public.edgelab_save_workspace(workspace jsonb, expected_revision bigint) returns bigint language plpgsql security invoker set search_path = '' as $$
declare
  owner_id uuid := auth.uid(); current_revision bigint; entry jsonb; leg jsonb;
  sport_key uuid; event_key uuid; model_key uuid; candidate_key uuid;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  if workspace->>'version' is distinct from '1' then raise exception 'Unsupported workspace version'; end if;
  if jsonb_typeof(workspace->'settings') is distinct from 'object' then raise exception 'Settings required'; end if;
  if workspace#>>'{settings,currency}' is distinct from 'AUD' or workspace#>>'{settings,timezone}' is distinct from 'Australia/Melbourne' then raise exception 'Unsupported currency or timezone'; end if;
  -- New accounts have no fixture records and require a separately confirmed manual ledger.
  insert into public.user_profiles(id) values(owner_id) on conflict(id) do nothing;
  insert into public.experiment_settings(user_id) values(owner_id) on conflict(user_id) do nothing;
  select revision into current_revision from public.experiment_settings where user_id=owner_id for update;
  if expected_revision is null or current_revision <> expected_revision then raise exception 'Workspace revision conflict; reload before saving'; end if;
  -- Financial/forecast IDs cannot be removed by uploading a smaller snapshot.
  if exists(select 1 from public.bets b where b.user_id=owner_id and not exists(select 1 from jsonb_array_elements(workspace->'bets') j where (j->>'id')::uuid=b.id))
    or exists(select 1 from public.financial_transactions t where t.user_id=owner_id and not exists(select 1 from jsonb_array_elements(workspace->'transactions') j where (j->>'id')::uuid=t.id))
    or exists(select 1 from public.research_candidates c where c.user_id=owner_id and not exists(select 1 from jsonb_array_elements(workspace->'candidates') j where (j->>'id')::uuid=c.id))
    or exists(select 1 from public.paper_predictions p where p.user_id=owner_id and not exists(select 1 from jsonb_array_elements(workspace->'paperPredictions') j where (j->>'id')::uuid=p.id)) then
    raise exception 'History cannot be deleted from a workspace';
  end if;

  for entry in select value from jsonb_array_elements(workspace->'candidates') loop
    if entry#>>'{oddsProvenance,simulated}' is distinct from 'false' or coalesce(entry#>>'{probabilityProvenance,simulated}','false') <> 'false' then raise exception 'Simulated research belongs only in Demo mode'; end if;
    insert into public.sports(user_id,code) values(owner_id,entry->>'sport') on conflict(user_id,code) do nothing;
    select id into sport_key from public.sports where user_id=owner_id and code=entry->>'sport';
    insert into public.events(user_id,sport_id,name,starts_at) values(owner_id,sport_key,entry->>'event',(entry->>'startsAt')::timestamptz) on conflict(user_id,sport_id,name) do nothing;
    select id into event_key from public.events where user_id=owner_id and sport_id=sport_key and name=entry->>'event';
    model_key := null;
    if entry->'probabilityProvenance' is not null then
      insert into public.model_versions(user_id,name,method) values(owner_id,entry#>>'{probabilityProvenance,modelVersion}',entry#>>'{probabilityProvenance,method}') on conflict(user_id,name,method) do nothing;
      select id into model_key from public.model_versions where user_id=owner_id and name=entry#>>'{probabilityProvenance,modelVersion}' and method=entry#>>'{probabilityProvenance,method}';
    end if;
    insert into public.research_candidates(id,user_id,event_id,model_version_id,payload,registered_at) values((entry->>'id')::uuid,owner_id,event_key,model_key,entry,(entry->>'registeredAt')::timestamptz) on conflict(id) do nothing;
    if not exists(select 1 from public.research_candidates where id=(entry->>'id')::uuid and user_id=owner_id and payload=entry) then raise exception 'Research candidate is immutable'; end if;
    insert into public.odds_snapshots(user_id,candidate_id,decimal_odds,source,captured_at,provenance) values(owner_id,(entry->>'id')::uuid,(entry->>'odds')::numeric,entry#>>'{oddsProvenance,source}',(entry#>>'{oddsProvenance,timestamp}')::timestamptz,entry->'oddsProvenance') on conflict(user_id,candidate_id) do nothing;
  end loop;

  for entry in select value from jsonb_array_elements(workspace->'bets') loop
    candidate_key := (entry->>'candidateId')::uuid;
    insert into public.bets(id,user_id,candidate_id,payload,placed_at,confirmed_at,settled_at)
      values((entry->>'id')::uuid,owner_id,candidate_key,entry,(entry->>'placedAt')::timestamptz,(entry->>'confirmedAt')::timestamptz,(entry->>'settledAt')::timestamptz)
      on conflict(id) do update set payload=excluded.payload,candidate_id=excluded.candidate_id,placed_at=excluded.placed_at,confirmed_at=excluded.confirmed_at,settled_at=excluded.settled_at where public.bets.user_id=owner_id;
    if not exists(select 1 from public.bets where id=(entry->>'id')::uuid and user_id=owner_id) then raise exception 'Bet ownership mismatch'; end if;
    -- Removed legs retain history but leave the current normalized projection.
    update public.bet_legs set active=false where user_id=owner_id and bet_id=(entry->>'id')::uuid;
    for leg in select value from jsonb_array_elements(entry->'legs') loop
      insert into public.sports(user_id,code) values(owner_id,leg->>'sport') on conflict(user_id,code) do nothing;
      select id into sport_key from public.sports where user_id=owner_id and code=leg->>'sport';
      insert into public.events(user_id,sport_id,name) values(owner_id,sport_key,leg->>'event') on conflict(user_id,sport_id,name) do nothing;
      select id into event_key from public.events where user_id=owner_id and sport_id=sport_key and name=leg->>'event';
      insert into public.bet_legs(id,user_id,bet_id,event_id,payload) values((leg->>'id')::uuid,owner_id,(entry->>'id')::uuid,event_key,leg)
        on conflict(id) do update set payload=excluded.payload,event_id=excluded.event_id,active=true where public.bet_legs.user_id=owner_id and public.bet_legs.bet_id=excluded.bet_id;
      if not exists(select 1 from public.bet_legs where id=(leg->>'id')::uuid and user_id=owner_id and bet_id=(entry->>'id')::uuid) then raise exception 'Leg ownership mismatch'; end if;
    end loop;
  end loop;

  for entry in select value from jsonb_array_elements(workspace->'transactions') loop
    insert into public.financial_transactions(id,user_id,payload,created_at) values((entry->>'id')::uuid,owner_id,entry,(entry->>'createdAt')::timestamptz) on conflict(id) do nothing;
    if not exists(select 1 from public.financial_transactions where id=(entry->>'id')::uuid and user_id=owner_id and payload=entry) then raise exception 'Financial transactions are immutable'; end if;
  end loop;
  for entry in select value from jsonb_array_elements(workspace->'paperPredictions') loop
    candidate_key := (entry#>>'{candidate,id}')::uuid;
    if not exists(select 1 from public.research_candidates where id=candidate_key and user_id=owner_id and payload=entry->'candidate') then raise exception 'Paper prediction must preserve its registered candidate snapshot'; end if;
    insert into public.paper_predictions(id,user_id,candidate_id,payload,registered_at,settled_at) values((entry->>'id')::uuid,owner_id,candidate_key,entry,(entry->>'registeredAt')::timestamptz,(entry->>'settledAt')::timestamptz)
      on conflict(id) do update set payload=excluded.payload,settled_at=excluded.settled_at where public.paper_predictions.user_id=owner_id;
    if not exists(select 1 from public.paper_predictions where id=(entry->>'id')::uuid and user_id=owner_id) then raise exception 'Paper ownership mismatch'; end if;
  end loop;
  for entry in select value from jsonb_array_elements(workspace->'notifications') loop
    insert into public.notifications(id,user_id,candidate_id,payload,created_at) values((entry->>'id')::uuid,owner_id,(entry->>'candidateId')::uuid,entry,(entry->>'createdAt')::timestamptz)
      on conflict(id) do update set payload=excluded.payload where public.notifications.user_id=owner_id;
  end loop;
  for entry in select value from jsonb_array_elements(workspace->'researchRuns') loop
    insert into public.research_runs(id,user_id,payload,started_at) values((entry->>'id')::uuid,owner_id,entry,(entry->>'startedAt')::timestamptz)
      on conflict(id) do update set payload=excluded.payload where public.research_runs.user_id=owner_id;
  end loop;
  for entry in select value from jsonb_array_elements(workspace->'audit') loop
    insert into public.audit_history(id,user_id,entity_type,entity_id,action,payload,created_at) values((entry->>'id')::uuid,owner_id,entry->>'entityType',entry->>'entityId',entry->>'action',entry,(entry->>'timestamp')::timestamptz) on conflict(id) do nothing;
    if not exists(select 1 from public.audit_history where id=(entry->>'id')::uuid and user_id=owner_id and payload=entry) then raise exception 'Audit history is append only'; end if;
  end loop;
  update public.experiment_settings set funding_cap=(workspace#>>'{settings,fundingCapCents}')::numeric/100,default_stake=(workspace#>>'{settings,defaultStakeCents}')::numeric/100,revision=current_revision+1,updated_at=now() where user_id=owner_id;
  return current_revision+1;
end $$;

revoke all on function public.edgelab_load_workspace() from public,anon;
revoke all on function public.edgelab_save_workspace(jsonb,bigint) from public,anon;
grant execute on function public.edgelab_load_workspace() to authenticated;
grant execute on function public.edgelab_save_workspace(jsonb,bigint) to authenticated;
commit;
