-- Additive EdgeLab integrity and concurrency hardening.
-- Existing records are retained. NOT VALID checks protect new/changed rows without
-- silently repairing or rewriting any historical record.
begin;

create function public.edgelab_valid_json_text(value jsonb, minimum integer, maximum integer, trimmed boolean default true)
returns boolean language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(value) = 'string' then
    length(value #>> '{}') between minimum and maximum
    and (not trimmed or value #>> '{}' = btrim(value #>> '{}'))
  else false end
$$;
create function public.edgelab_valid_json_uuid(value jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(jsonb_typeof(value) = 'string' and value #>> '{}' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',false)
$$;
create function public.edgelab_valid_json_timestamp(value jsonb)
returns boolean language sql stable set search_path = '' as $$
  select case when jsonb_typeof(value) = 'string' and value #>> '{}' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$'
    then (value #>> '{}')::timestamptz is not null else false end
$$;
create function public.edgelab_valid_json_cents(value jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(value) = 'number' then
    (value #>> '{}')::numeric between 1 and 100000000
    and (value #>> '{}')::numeric = trunc((value #>> '{}')::numeric)
  else false end
$$;
create function public.edgelab_valid_json_odds(value jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(value) = 'number' then
    (value #>> '{}')::numeric between 1.0001 and 10000
    and (value #>> '{}')::numeric * 10000 = trunc((value #>> '{}')::numeric * 10000)
  else false end
$$;
create function public.edgelab_valid_json_probability(value jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(value) = 'number' then (value #>> '{}')::numeric between 0 and 1 else false end
$$;
create or replace function public.edgelab_valid_private_provenance(value jsonb)
returns boolean language sql stable set search_path = '' as $$
  select coalesce(jsonb_typeof(value) = 'object'
    and (value - array['source','timestamp','method','modelVersion','simulated']) = '{}'::jsonb
    and public.edgelab_valid_json_text(value->'source',1,500)
    and public.edgelab_valid_json_text(value->'method',1,500)
    and public.edgelab_valid_json_text(value->'modelVersion',1,500)
    and public.edgelab_valid_json_timestamp(value->'timestamp')
    and value->'simulated' = 'false'::jsonb,false)
$$;
create function public.edgelab_valid_leg_snapshot(value jsonb)
returns boolean language sql stable set search_path = '' as $$
  select coalesce(jsonb_typeof(value) = 'object'
    and (value - array['id','sport','event','participant','market','selection','line','odds','outcome','statistic']) = '{}'::jsonb
    and public.edgelab_valid_json_uuid(value->'id')
    and value->>'sport' in ('NBA','NBL','ATP','WTA')
    and public.edgelab_valid_json_text(value->'event',1,500)
    and public.edgelab_valid_json_text(value->'participant',1,500)
    and public.edgelab_valid_json_text(value->'market',1,500)
    and public.edgelab_valid_json_text(value->'selection',1,500)
    and public.edgelab_valid_json_text(value->'line',1,100)
    and public.edgelab_valid_json_odds(value->'odds')
    and value->>'outcome' in ('pending','won','lost','void')
    and (value->'statistic' is null or public.edgelab_valid_json_text(value->'statistic',0,500,false)),false)
$$;
create function public.edgelab_valid_bet_snapshot(value jsonb)
returns boolean language plpgsql stable set search_path = '' as $$
declare leg jsonb; has_won boolean := false; has_lost boolean := false; has_pending boolean := false; all_void boolean := true; ids uuid[] := '{}';
begin
  if jsonb_typeof(value) is distinct from 'object'
    or (value - array['id','placedAt','settledAt','bookmaker','stakeCents','stakeType','odds','outcome','strategy','legs','notes','confirmedAt','probability','candidateId','oddsProvenance','probabilityProvenance']) <> '{}'::jsonb
    or not public.edgelab_valid_json_uuid(value->'id')
    or not public.edgelab_valid_json_timestamp(value->'placedAt')
    or not public.edgelab_valid_json_timestamp(value->'confirmedAt')
    or not public.edgelab_valid_json_text(value->'bookmaker',1,500)
    or not public.edgelab_valid_json_cents(value->'stakeCents')
    or not public.edgelab_valid_json_odds(value->'odds')
    or coalesce(value->>'stakeType','') not in ('cash','bonus')
    or coalesce(value->>'outcome','') not in ('pending','won','lost','void')
    or coalesce(value->>'strategy','') not in ('A','B','C')
    or not public.edgelab_valid_json_text(value->'notes',0,5000,false)
    or jsonb_typeof(value->'legs') is distinct from 'array' then return false; end if;
  if jsonb_array_length(value->'legs') not between 1 and 20 then return false; end if;
  if value->'settledAt' is not null and not public.edgelab_valid_json_timestamp(value->'settledAt') then return false; end if;
  if value->'candidateId' is not null and not public.edgelab_valid_json_uuid(value->'candidateId') then return false; end if;
  if value->'oddsProvenance' is not null and not public.edgelab_valid_private_provenance(value->'oddsProvenance') then return false; end if;
  if value->'probabilityProvenance' is not null and not public.edgelab_valid_private_provenance(value->'probabilityProvenance') then return false; end if;
  if value->'probability' is not null and (not public.edgelab_valid_json_probability(value->'probability') or not public.edgelab_valid_private_provenance(value->'probabilityProvenance')) then return false; end if;
  for leg in select item from jsonb_array_elements(value->'legs') as x(item) loop
    if not public.edgelab_valid_leg_snapshot(leg) then return false; end if;
    if (leg->>'id')::uuid = any(ids) then return false; end if;
    ids := array_append(ids,(leg->>'id')::uuid);
    has_won := has_won or leg->>'outcome' = 'won'; has_lost := has_lost or leg->>'outcome' = 'lost'; has_pending := has_pending or leg->>'outcome' = 'pending'; all_void := all_void and leg->>'outcome' = 'void';
  end loop;
  return case value->>'outcome'
    when 'won' then has_won and not has_lost and not has_pending
    when 'lost' then has_lost
    when 'void' then all_void
    else true end;
end $$;
create function public.edgelab_valid_candidate_snapshot(value jsonb)
returns boolean language sql stable set search_path = '' as $$
  select coalesce(jsonb_typeof(value) = 'object'
    and (value - array['id','sport','event','participant','market','selection','line','bookmaker','odds','probability','strategy','rationale','uncertainty','startsAt','registeredAt','oddsProvenance','probabilityProvenance']) = '{}'::jsonb
    and public.edgelab_valid_json_uuid(value->'id')
    and value->>'sport' in ('NBA','NBL','ATP','WTA')
    and public.edgelab_valid_json_text(value->'event',1,500)
    and public.edgelab_valid_json_text(value->'participant',1,500)
    and public.edgelab_valid_json_text(value->'market',1,500)
    and public.edgelab_valid_json_text(value->'selection',1,500)
    and public.edgelab_valid_json_text(value->'line',1,100)
    and public.edgelab_valid_json_text(value->'bookmaker',1,500)
    and public.edgelab_valid_json_odds(value->'odds')
    and (value->'probability' is null or public.edgelab_valid_json_probability(value->'probability'))
    and value->>'strategy' in ('A','B','C')
    and public.edgelab_valid_json_text(value->'rationale',1,5000,false)
    and value->>'uncertainty' in ('illustrative','high','medium')
    and public.edgelab_valid_json_timestamp(value->'startsAt')
    and public.edgelab_valid_json_timestamp(value->'registeredAt')
    and public.edgelab_valid_private_provenance(value->'oddsProvenance')
    and (value->'probabilityProvenance' is null or public.edgelab_valid_private_provenance(value->'probabilityProvenance'))
    and (value->'probability' is null or public.edgelab_valid_private_provenance(value->'probabilityProvenance')),false)
$$;
create function public.edgelab_valid_paper_snapshot(value jsonb)
returns boolean language sql stable set search_path = '' as $$
  select coalesce(jsonb_typeof(value) = 'object'
    and (value - array['id','candidate','registeredAt','hypotheticalStakeCents','outcome','settledAt','statistic']) = '{}'::jsonb
    and public.edgelab_valid_json_uuid(value->'id')
    and public.edgelab_valid_candidate_snapshot(value->'candidate')
    and public.edgelab_valid_json_timestamp(value->'registeredAt')
    and public.edgelab_valid_json_cents(value->'hypotheticalStakeCents')
    and value->>'outcome' in ('pending','won','lost','void')
    and (value->'settledAt' is null or public.edgelab_valid_json_timestamp(value->'settledAt'))
    and (value->'statistic' is null or public.edgelab_valid_json_text(value->'statistic',0,500,false)),false)
$$;
create function public.edgelab_valid_transaction_snapshot(value jsonb)
returns boolean language sql stable set search_path = '' as $$
  select coalesce(jsonb_typeof(value) = 'object'
    and (value - array['id','kind','amountCents','createdAt','note']) = '{}'::jsonb
    and public.edgelab_valid_json_uuid(value->'id')
    and value->>'kind' in ('deposit','withdrawal')
    and public.edgelab_valid_json_cents(value->'amountCents')
    and public.edgelab_valid_json_timestamp(value->'createdAt')
    and public.edgelab_valid_json_text(value->'note',0,1000,false),false)
$$;
create function public.edgelab_valid_notification_snapshot(value jsonb)
returns boolean language sql stable set search_path = '' as $$
  select coalesce(jsonb_typeof(value) = 'object'
    and (value - array['id','candidateId','title','message','createdAt','readAt','dismissedAt','simulated']) = '{}'::jsonb
    and public.edgelab_valid_json_uuid(value->'id')
    and (value->'candidateId' is null or public.edgelab_valid_json_uuid(value->'candidateId'))
    and public.edgelab_valid_json_text(value->'title',1,500)
    and public.edgelab_valid_json_text(value->'message',0,5000,false)
    and public.edgelab_valid_json_timestamp(value->'createdAt')
    and (value->'readAt' is null or public.edgelab_valid_json_timestamp(value->'readAt'))
    and (value->'dismissedAt' is null or public.edgelab_valid_json_timestamp(value->'dismissedAt'))
    and value->'simulated' = 'false'::jsonb,false)
$$;
create function public.edgelab_valid_run_snapshot(value jsonb)
returns boolean language sql stable set search_path = '' as $$
  select coalesce(jsonb_typeof(value) = 'object'
    and (value - array['id','startedAt','completedAt','status','candidateCount','simulated','error']) = '{}'::jsonb
    and public.edgelab_valid_json_uuid(value->'id')
    and public.edgelab_valid_json_timestamp(value->'startedAt')
    and (value->'completedAt' is null or public.edgelab_valid_json_timestamp(value->'completedAt'))
    and value->>'status' in ('running','completed','failed')
    and case when jsonb_typeof(value->'candidateCount') = 'number' then (value->>'candidateCount')::numeric >= 0 and (value->>'candidateCount')::numeric = trunc((value->>'candidateCount')::numeric) else false end
    and (value->'error' is null or jsonb_typeof(value->'error') = 'string')
    and value->'simulated' = 'false'::jsonb,false)
$$;
create function public.edgelab_valid_audit_snapshot(value jsonb)
returns boolean language sql stable set search_path = '' as $$
  select coalesce(jsonb_typeof(value) = 'object'
    and (value - array['id','entityType','entityId','action','timestamp','before','after']) = '{}'::jsonb
    and public.edgelab_valid_json_uuid(value->'id')
    and value->>'entityType' in ('bet','paper','settings','transaction')
    and public.edgelab_valid_json_text(value->'entityId',1,500)
    and public.edgelab_valid_json_text(value->'action',1,500)
    and public.edgelab_valid_json_timestamp(value->'timestamp'),false)
$$;

alter table public.experiment_settings add constraint edgelab_settings_currency_precision
  check (funding_cap > 0 and funding_cap <= 1000000 and default_stake > 0 and default_stake <= 1000000 and funding_cap <> 'NaN'::numeric and default_stake <> 'NaN'::numeric) not valid;
alter table public.bets add constraint edgelab_bet_snapshot_valid check (public.edgelab_valid_bet_snapshot(payload)) not valid;
alter table public.bet_legs add constraint edgelab_leg_snapshot_valid check (public.edgelab_valid_leg_snapshot(payload)) not valid;
alter table public.research_candidates add constraint edgelab_candidate_snapshot_valid check (public.edgelab_valid_candidate_snapshot(payload)) not valid;
alter table public.paper_predictions add constraint edgelab_paper_snapshot_valid check (public.edgelab_valid_paper_snapshot(payload)) not valid;
alter table public.financial_transactions add constraint edgelab_transaction_snapshot_valid check (public.edgelab_valid_transaction_snapshot(payload)) not valid;
alter table public.notifications add constraint edgelab_notification_snapshot_valid check (public.edgelab_valid_notification_snapshot(payload)) not valid;
alter table public.research_runs add constraint edgelab_run_snapshot_valid check (public.edgelab_valid_run_snapshot(payload)) not valid;
alter table public.audit_history add constraint edgelab_audit_snapshot_valid check (public.edgelab_valid_audit_snapshot(payload)) not valid;

-- A leg UUID belongs permanently to its original bet. Removed legs remain
-- inactive history; callers append a new UUID when adding a different leg.
create function public.edgelab_guard_leg_identity() returns trigger language plpgsql security invoker set search_path = '' as $$
declare event_name text; sport_code text;
begin
  if TG_OP = 'UPDATE' then
    if NEW.id is distinct from OLD.id or NEW.user_id is distinct from OLD.user_id or NEW.bet_id is distinct from OLD.bet_id then
      raise exception 'Leg identity and parent bet are immutable; append a new leg instead';
    end if;
  end if;
  if NEW.active then
    select e.name,s.code into event_name,sport_code from public.events e join public.sports s on s.user_id=e.user_id and s.id=e.sport_id where e.user_id=NEW.user_id and e.id=NEW.event_id;
    if not found or event_name is distinct from NEW.payload->>'event' or sport_code is distinct from NEW.payload->>'sport' then
      raise exception 'Normalized leg event and sport must match its original snapshot';
    end if;
  end if;
  return NEW;
end $$;
create trigger edgelab_leg_identity before insert or update on public.bet_legs for each row execute function public.edgelab_guard_leg_identity();

-- Queryable normalized legs and their authoritative bet snapshot must agree at
-- transaction commit. Deferral permits the existing parent-then-legs RPC order.
create function public.edgelab_check_leg_projection() returns trigger language plpgsql security invoker set search_path = '' as $$
declare owner_id uuid := NEW.user_id; bet_key uuid; snapshot jsonb; normalized jsonb; expected jsonb;
begin
  bet_key := (to_jsonb(NEW)->>case when TG_TABLE_NAME = 'bets' then 'id' else 'bet_id' end)::uuid;
  select payload into snapshot from public.bets where user_id=owner_id and id=bet_key;
  if not found then return NEW; end if;
  select coalesce(jsonb_agg(payload order by id),'[]'::jsonb) into normalized from public.bet_legs where user_id=owner_id and bet_id=bet_key and active;
  select coalesce(jsonb_agg(item order by (item->>'id')::uuid),'[]'::jsonb) into expected from jsonb_array_elements(snapshot->'legs') as x(item);
  if normalized is distinct from expected then raise exception 'Bet legs must match the active normalized projection'; end if;
  return NEW;
end $$;
create constraint trigger edgelab_bet_projection after insert or update on public.bets deferrable initially deferred for each row execute function public.edgelab_check_leg_projection();
create constraint trigger edgelab_leg_projection after insert or update on public.bet_legs deferrable initially deferred for each row execute function public.edgelab_check_leg_projection();

-- These flags coordinate revisions, not authorization. Every function remains
-- SECURITY INVOKER and every table keeps its original ownership RLS policy.
create function public.edgelab_guard_settings_revision() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if current_setting('edgelab.workspace_save',true) is distinct from NEW.user_id::text then
    NEW.revision := case when TG_OP = 'INSERT' then 1 else OLD.revision + 1 end;
    NEW.updated_at := now();
  end if;
  return NEW;
end $$;
create trigger edgelab_settings_revision before insert or update on public.experiment_settings for each row execute function public.edgelab_guard_settings_revision();
create function public.edgelab_bump_direct_revision() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if current_setting('edgelab.workspace_save',true) is distinct from NEW.user_id::text then
    insert into public.experiment_settings(user_id,revision,updated_at) values(NEW.user_id,1,now())
      on conflict(user_id) do update set revision=public.experiment_settings.revision+1,updated_at=now();
  end if;
  return NEW;
end $$;
do $$
declare table_name text;
begin
  foreach table_name in array array['sports','events','model_versions','research_candidates','bets','bet_legs','financial_transactions','paper_predictions','odds_snapshots','notifications','research_runs','audit_history'] loop
    execute format('create trigger edgelab_direct_write_revision after insert or update on public.%I for each row execute function public.edgelab_bump_direct_revision()',table_name);
  end loop;
end $$;

create or replace function public.edgelab_save_workspace(workspace jsonb, expected_revision bigint) returns bigint language plpgsql security invoker set search_path = '' as $$
declare
  owner_id uuid := auth.uid(); current_revision bigint; entry jsonb; leg jsonb;
  sport_key uuid; event_key uuid; model_key uuid; candidate_key uuid; previous_context text := current_setting('edgelab.workspace_save',true); array_name text; item jsonb;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  if workspace->>'version' is distinct from '1' then raise exception 'Unsupported workspace version'; end if;
  if jsonb_typeof(workspace->'settings') is distinct from 'object' then raise exception 'Settings required'; end if;
  if workspace#>>'{settings,currency}' is distinct from 'AUD' or workspace#>>'{settings,timezone}' is distinct from 'Australia/Melbourne' then raise exception 'Unsupported currency or timezone'; end if;
  if workspace->'version' is distinct from '1'::jsonb then raise exception 'Unsupported workspace version'; end if;
  if not public.edgelab_valid_json_cents(workspace#>'{settings,fundingCapCents}') or not public.edgelab_valid_json_cents(workspace#>'{settings,defaultStakeCents}') then
    raise exception 'Financial settings must be positive integer cents within supported precision';
  end if;
  foreach array_name in array array['bets','transactions','candidates','paperPredictions','notifications','researchRuns','audit'] loop
    if jsonb_typeof(workspace->array_name) is distinct from 'array' then raise exception 'Workspace % must be an array',array_name; end if;
  end loop;
  -- Validate before inserting derived rows; SQL callers get the same boundaries
  -- as the application's Zod parser, including JSON numeric types and odds scale.
  for item in select value from jsonb_array_elements(workspace->'bets') loop if not public.edgelab_valid_bet_snapshot(item) then raise exception 'Bet snapshot violates check constraint'; end if; end loop;
  for item in select value from jsonb_array_elements(workspace->'transactions') loop if not public.edgelab_valid_transaction_snapshot(item) then raise exception 'Financial transaction snapshot violates check constraint'; end if; end loop;
  for item in select value from jsonb_array_elements(workspace->'candidates') loop if not public.edgelab_valid_candidate_snapshot(item) then raise exception 'Research candidate violates check constraint (invalid or simulated research)'; end if; end loop;
  for item in select value from jsonb_array_elements(workspace->'paperPredictions') loop if not public.edgelab_valid_paper_snapshot(item) then raise exception 'Paper snapshot violates check constraint'; end if; end loop;
  for item in select value from jsonb_array_elements(workspace->'notifications') loop if not public.edgelab_valid_notification_snapshot(item) then raise exception 'Notification snapshot violates check constraint'; end if; end loop;
  for item in select value from jsonb_array_elements(workspace->'researchRuns') loop if not public.edgelab_valid_run_snapshot(item) then raise exception 'Research run snapshot violates check constraint'; end if; end loop;
  for item in select value from jsonb_array_elements(workspace->'audit') loop if not public.edgelab_valid_audit_snapshot(item) then raise exception 'Audit snapshot violates check constraint'; end if; end loop;
  perform set_config('edgelab.workspace_save',owner_id::text,true);
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
  perform set_config('edgelab.workspace_save',coalesce(previous_context,''),true);
  return current_revision+1;
end $$;


-- Pure validation helpers expose no user data, but only authenticated callers
-- need them to satisfy CHECK constraints and invoke the workspace RPC.
do $$
declare function_name text;
begin
  for function_name in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'edgelab_valid_%' loop
    execute format('revoke all on function %s from public,anon',function_name);
    execute format('grant execute on function %s to authenticated',function_name);
  end loop;
end $$;
revoke all on function public.edgelab_save_workspace(jsonb,bigint) from public,anon;
grant execute on function public.edgelab_save_workspace(jsonb,bigint) to authenticated;
commit;
