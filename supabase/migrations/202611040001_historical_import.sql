-- EdgeLab historical research archive. PREPARED LOCALLY; requires explicit approval
-- before hosted application. Deployed migrations 202611030001/2 are unchanged.
-- No existing records are rewritten, no seed is loaded, no ledger is funded.
begin;

create function public.edgelab_history_object(value jsonb, keys text[]) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(jsonb_typeof(value)='object' and value ?& keys and value-keys='{}'::jsonb,false)
$$;
create function public.edgelab_history_text(value jsonb, maximum integer) returns boolean
language sql immutable set search_path = '' as $$
  select value='null'::jsonb or (public.edgelab_valid_json_text(value,1,maximum)
    and value#>>'{}'=btrim(value#>>'{}',chr(9)||chr(10)||chr(11)||chr(12)||chr(13)||chr(32)||chr(160)||chr(5760)||chr(8192)||chr(8193)||chr(8194)||chr(8195)||chr(8196)||chr(8197)||chr(8198)||chr(8199)||chr(8200)||chr(8201)||chr(8202)||chr(8232)||chr(8233)||chr(8239)||chr(8287)||chr(12288)||chr(65279)))
$$;
create function public.edgelab_history_time(value jsonb) returns boolean
language sql stable set search_path = '' as $$
  select value='null'::jsonb or public.edgelab_valid_json_timestamp(value)
$$;
create function public.edgelab_history_cents(value jsonb, minimum integer default 0) returns boolean
language sql immutable set search_path = '' as $$
  select case when value='null'::jsonb then true when jsonb_typeof(value)='number' then
    (value#>>'{}')::numeric between minimum and 100000000 and (value#>>'{}')::numeric=trunc((value#>>'{}')::numeric)
  else false end
$$;
create function public.edgelab_history_leg(value jsonb) returns boolean
language sql stable set search_path = '' as $$
  select coalesce(public.edgelab_history_object(value,array['id','sport','eventId','event','participant','marketId','market','selection','line','odds','outcome','statistic'])
    and public.edgelab_valid_json_uuid(value->'id')
    and (value->'sport'='null'::jsonb or value->>'sport' in ('NBA','NBL','ATP','WTA'))
    and public.edgelab_history_text(value->'eventId',500)
    and public.edgelab_history_text(value->'event',500)
    and public.edgelab_history_text(value->'participant',500)
    and public.edgelab_history_text(value->'marketId',500)
    and public.edgelab_history_text(value->'market',500)
    and public.edgelab_history_text(value->'selection',500)
    and public.edgelab_history_text(value->'line',100)
    and (value->'odds'='null'::jsonb or public.edgelab_valid_json_odds(value->'odds'))
    and (value->'outcome'='null'::jsonb or value->>'outcome' in ('pending','won','lost','void'))
    and (value->'statistic'='null'::jsonb or public.edgelab_valid_json_text(value->'statistic',0,500,false)),false)
$$;
create function public.edgelab_history_snapshot(value jsonb) returns boolean
language plpgsql stable set search_path = '' as $$
declare field_name text; item jsonb; identifiers uuid[] := '{}'; expected_payout numeric;
begin
  if not public.edgelab_history_object(value,array['externalId','eventId','marketId','kind','sport','event','participant','market','selection','line','bookmaker','odds','predictionAt','placedAt','settledAt','probability','probabilitySource','probabilityMethod','modelVersion','strategy','sourceReference','stakeCents','stakeType','payoutCents','outcome','verification','notes','legs']) then return false; end if;
  if value->'kind'<>'null'::jsonb and value->>'kind' not in ('actual','paper') then return false; end if;
  if value->'sport'<>'null'::jsonb and value->>'sport' not in ('NBA','NBL','ATP','WTA') then return false; end if;
  if value->'strategy'<>'null'::jsonb and value->>'strategy' not in ('A','B','C') then return false; end if;
  if value->'stakeType'<>'null'::jsonb and value->>'stakeType' not in ('cash','bonus') then return false; end if;
  if value->'outcome'<>'null'::jsonb and value->>'outcome' not in ('pending','won','lost','void') then return false; end if;
  if coalesce(value->>'verification','') not in ('unverified','user_confirmed') then return false; end if;
  if not public.edgelab_history_text(value->'sourceReference',2000) then return false; end if;
  foreach field_name in array array['externalId','eventId','marketId','probabilitySource'] loop
    if not public.edgelab_history_text(value->field_name,500) then return false; end if;
  end loop;
  foreach field_name in array array['event','participant','market','selection','bookmaker','probabilityMethod','modelVersion'] loop
    if not public.edgelab_history_text(value->field_name,500) then return false; end if;
  end loop;
  if not public.edgelab_history_text(value->'line',100) then return false; end if;
  if value->'notes'<>'null'::jsonb and not public.edgelab_valid_json_text(value->'notes',0,5000,false) then return false; end if;
  foreach field_name in array array['predictionAt','placedAt','settledAt'] loop
    if not public.edgelab_history_time(value->field_name) then return false; end if;
  end loop;
  if value->'odds'<>'null'::jsonb and not public.edgelab_valid_json_odds(value->'odds') then return false; end if;
  if value->'probability'<>'null'::jsonb and not public.edgelab_valid_json_probability(value->'probability') then return false; end if;
  if not public.edgelab_history_cents(value->'stakeCents',0) or not public.edgelab_history_cents(value->'payoutCents',0) then return false; end if;
  if value->>'kind'='actual' and value->'stakeCents'='0'::jsonb then return false; end if;
  if value->>'outcome' in ('pending','lost') and value->'payoutCents'<>'null'::jsonb and value->'payoutCents'<>'0'::jsonb then return false; end if;
  if value->'stakeCents'<>'null'::jsonb and value->'odds'<>'null'::jsonb and value->'stakeType'<>'null'::jsonb and value->>'outcome' in ('won','lost','void') and value->'payoutCents'<>'null'::jsonb
    and not (value->>'outcome'='won' and jsonb_typeof(value->'legs')='array' and exists(select 1 from jsonb_array_elements(value->'legs') l where l->>'outcome'='void')) then
    expected_payout:=case when value->>'outcome'='lost' then 0
      when value->>'outcome'='void' then case when value->>'stakeType'='cash' then (value->>'stakeCents')::numeric else 0 end
      else round((value->>'stakeCents')::numeric*((value->>'odds')::numeric-case when value->>'stakeType'='bonus' then 1 else 0 end)) end;
    if (value->>'payoutCents')::numeric<>expected_payout then return false; end if;
  end if;
  if value->>'outcome'='pending' and value->'settledAt'<>'null'::jsonb then return false; end if;
  if value->'settledAt'<>'null'::jsonb and value->'predictionAt'<>'null'::jsonb and (value->>'settledAt')::timestamptz<(value->>'predictionAt')::timestamptz then return false; end if;
  if value->'settledAt'<>'null'::jsonb and value->'placedAt'<>'null'::jsonb and (value->>'settledAt')::timestamptz<(value->>'placedAt')::timestamptz then return false; end if;
  if jsonb_typeof(value->'legs') is distinct from 'array' or jsonb_array_length(value->'legs')>20 then return false; end if;
  for item in select x from jsonb_array_elements(value->'legs') x loop
    if not public.edgelab_history_leg(item) or (item->>'id')::uuid=any(identifiers) then return false; end if;
    if value->>'outcome'='won' and item->>'outcome' in ('lost','pending') then return false; end if;
    if value->>'outcome'='void' and item->'outcome'<>'null'::jsonb and item->>'outcome'<>'void' then return false; end if;
    identifiers:=array_append(identifiers,(item->>'id')::uuid);
  end loop;
  if value->>'outcome'='lost' and jsonb_array_length(value->'legs')>0
    and not exists(select 1 from jsonb_array_elements(value->'legs') l where l->'outcome'='null'::jsonb or l->>'outcome' in ('lost','pending')) then return false; end if;
  if value->>'outcome'='won' and jsonb_array_length(value->'legs')>0
    and not exists(select 1 from jsonb_array_elements(value->'legs') l where l->>'outcome' is distinct from 'void') then return false; end if;
  return true;
end $$;
create function public.edgelab_history_batch(value jsonb) returns boolean
language plpgsql stable set search_path = '' as $$
declare summary jsonb; field_name text; n numeric;
begin
  if not public.edgelab_history_object(value,array['id','createdAt','sourceName','format','rawSource','sourceHash','verification','summary']) then return false; end if;
  if not public.edgelab_valid_json_uuid(value->'id') or not public.edgelab_valid_json_timestamp(value->'createdAt') or not public.edgelab_valid_json_text(value->'sourceName',1,255) then return false; end if;
  if coalesce(value->>'format','') not in ('csv','json','manual') or coalesce(value->>'verification','') not in ('unverified','user_confirmed') then return false; end if;
  if jsonb_typeof(value->'rawSource') is distinct from 'string' or octet_length(convert_to(value->>'rawSource','UTF8'))>1048576 then return false; end if;
  if value->>'sourceHash' !~ '^[0-9a-f]{64}$' or value->>'sourceHash' is distinct from encode(sha256(convert_to(value->>'rawSource','UTF8')),'hex') then return false; end if;
  summary:=value->'summary';
  if not public.edgelab_history_object(summary,array['parsed','imported','skipped','warnings','actual','paper']) then return false; end if;
  foreach field_name in array array['parsed','imported','skipped','warnings','actual','paper'] loop
    if jsonb_typeof(summary->field_name) is distinct from 'number' then return false; end if;
    n:=(summary->>field_name)::numeric;
    if n<0 or n<>trunc(n) or n>100000 then return false; end if;
  end loop;
  return (summary->>'parsed')::int between 1 and 500 and (summary->>'imported')::int between 1 and 500
    and (summary->>'parsed')::int=(summary->>'imported')::int+(summary->>'skipped')::int
    and (summary->>'actual')::int+(summary->>'paper')::int<=(summary->>'imported')::int;
end $$;
create function public.edgelab_history_record(value jsonb) returns boolean
language plpgsql stable set search_path = '' as $$
declare item jsonb; has_warning boolean := false;
begin
  if not public.edgelab_history_object(value,array['id','batchId','rowNumber','importedAt','raw','fingerprint','snapshot','issues','transformations','probableDuplicateConfirmed','incompleteConfirmed']) then return false; end if;
  if not public.edgelab_valid_json_uuid(value->'id') or not public.edgelab_valid_json_uuid(value->'batchId') or not public.edgelab_valid_json_timestamp(value->'importedAt') then return false; end if;
  if jsonb_typeof(value->'rowNumber') is distinct from 'number' or (value->>'rowNumber')::numeric not between 1 and 500 or (value->>'rowNumber')::numeric<>trunc((value->>'rowNumber')::numeric) then return false; end if;
  -- JSONB adds formatting whitespace to compact JSON. Preserve the original
  -- 1 MiB source limit while allowing that representation overhead per raw row.
  if jsonb_typeof(value->'raw') is distinct from 'object' or octet_length((value->'raw')::text)>2097152 then return false; end if;
  if jsonb_typeof(value->'fingerprint') is distinct from 'string' or value->>'fingerprint' !~ '^[0-9a-f]{64}$' then return false; end if;
  if not public.edgelab_history_snapshot(value->'snapshot') then return false; end if;
  if jsonb_typeof(value->'probableDuplicateConfirmed') is distinct from 'boolean' or jsonb_typeof(value->'incompleteConfirmed') is distinct from 'boolean' then return false; end if;
  if jsonb_typeof(value->'issues') is distinct from 'array' or jsonb_array_length(value->'issues')>500 then return false; end if;
  for item in select x from jsonb_array_elements(value->'issues') x loop
    if not public.edgelab_history_object(item,array['field','severity','code','message'])
      or not public.edgelab_valid_json_text(item->'field',0,500,false)
      or not public.edgelab_valid_json_text(item->'code',0,100,false)
      or not public.edgelab_valid_json_text(item->'message',0,1000,false)
      or item->>'severity' is distinct from 'warning' then return false; end if;
    has_warning:=true;
  end loop;
  if has_warning and value->'incompleteConfirmed'<>'true'::jsonb then return false; end if;
  if value#>>'{snapshot,outcome}'='won' and exists(select 1 from jsonb_array_elements(value#>'{snapshot,legs}') l where l->>'outcome'='void')
    and not exists(select 1 from jsonb_array_elements(value->'issues') i where i->>'code'='partial_void_requires_reconciliation') then return false; end if;
  if jsonb_typeof(value->'transformations') is distinct from 'array' or jsonb_array_length(value->'transformations')>2000 then return false; end if;
  for item in select x from jsonb_array_elements(value->'transformations') x loop
    if not public.edgelab_history_object(item,array['field','original','normalized','rule'])
      or not public.edgelab_valid_json_text(item->'field',0,500,false)
      or not public.edgelab_valid_json_text(item->'rule',0,500,false) then return false; end if;
  end loop;
  return true;
end $$;
create function public.edgelab_history_paper(value jsonb) returns boolean
language plpgsql stable set search_path = '' as $$
declare item jsonb; identifiers uuid[] := '{}';
begin
  if not public.edgelab_history_object(value,array['recordId','outcome','settledAt','statistic','legs','updatedAt']) then return false; end if;
  if not public.edgelab_valid_json_uuid(value->'recordId') or not public.edgelab_valid_json_timestamp(value->'updatedAt') or not public.edgelab_history_time(value->'settledAt') then return false; end if;
  if coalesce(value->>'outcome','') not in ('pending','won','lost','void') then return false; end if;
  if value->>'outcome'='pending' and value->'settledAt'<>'null'::jsonb then return false; end if;
  if value->'statistic'<>'null'::jsonb and not public.edgelab_valid_json_text(value->'statistic',0,500,false) then return false; end if;
  if jsonb_typeof(value->'legs') is distinct from 'array' or jsonb_array_length(value->'legs')>20 then return false; end if;
  for item in select x from jsonb_array_elements(value->'legs') x loop
    if not public.edgelab_history_object(item,array['legId','outcome','statistic']) or not public.edgelab_valid_json_uuid(item->'legId') or coalesce(item->>'outcome','') not in ('pending','won','lost','void') then return false; end if;
    if item->'statistic'<>'null'::jsonb and not public.edgelab_valid_json_text(item->'statistic',0,500,false) then return false; end if;
    if (item->>'legId')::uuid=any(identifiers) then return false; end if;
    identifiers:=array_append(identifiers,(item->>'legId')::uuid);
  end loop;
  return true;
end $$;
create function public.edgelab_history_notification(value jsonb) returns boolean
language sql stable set search_path = '' as $$
  select coalesce(public.edgelab_history_object(value,array['id','recordId','dedupeKey','title','message','createdAt','readAt','dismissedAt'])
    and public.edgelab_valid_json_uuid(value->'id') and public.edgelab_valid_json_uuid(value->'recordId')
    and public.edgelab_valid_json_text(value->'dedupeKey',1,200)
    and value->>'dedupeKey'='historical-research:'||(value->>'recordId')
    and public.edgelab_valid_json_text(value->'title',1,500)
    and public.edgelab_valid_json_text(value->'message',0,5000,false)
    and public.edgelab_valid_json_timestamp(value->'createdAt')
    and public.edgelab_history_time(value->'readAt') and public.edgelab_history_time(value->'dismissedAt')
    and (value->'dismissedAt'='null'::jsonb or value->'readAt'<>'null'::jsonb)
    and (value->'readAt'='null'::jsonb or (value->>'readAt')::timestamptz>=(value->>'createdAt')::timestamptz)
    and (value->'dismissedAt'='null'::jsonb or (value->>'dismissedAt')::timestamptz>=(value->>'createdAt')::timestamptz),false)
$$;
create function public.edgelab_history_audit(value jsonb) returns boolean
language sql stable set search_path = '' as $$
  select coalesce(public.edgelab_history_object(value,array['id','recordId','batchId','action','timestamp','before','after'])
    and public.edgelab_valid_json_uuid(value->'id')
    and (value->'recordId'='null'::jsonb or public.edgelab_valid_json_uuid(value->'recordId'))
    and (value->'batchId'='null'::jsonb or public.edgelab_valid_json_uuid(value->'batchId'))
    and value->>'action' in ('import_confirmed','paper_registered','paper_result_recorded','notification_created','notification_read','notification_dismissed')
    and public.edgelab_valid_json_timestamp(value->'timestamp'),false)
$$;

create table public.historical_workspace_revisions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 0 check(revision>=0),
  updated_at timestamptz not null default now()
);
create table public.historical_import_batches (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null check(public.edgelab_history_batch(payload)),
  source_hash text generated always as (payload->>'sourceHash') stored not null,
  created_at timestamptz not null,
  unique(user_id,id),
  check((payload->>'id')::uuid is not distinct from id),
  check((payload->>'createdAt')::timestamptz is not distinct from created_at)
);
create table public.historical_research_records (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  batch_id uuid not null,
  row_number integer not null check(row_number between 1 and 500),
  payload jsonb not null check(public.edgelab_history_record(payload)),
  fingerprint text generated always as (payload->>'fingerprint') stored not null,
  external_id text generated always as (payload#>>'{snapshot,externalId}') stored,
  source_reference text generated always as (payload#>>'{snapshot,sourceReference}') stored,
  kind text generated always as (payload#>>'{snapshot,kind}') stored,
  sport text generated always as (payload#>>'{snapshot,sport}') stored,
  stake numeric(14,2) generated always as ((payload#>>'{snapshot,stakeCents}')::numeric/100) stored,
  reported_payout numeric(14,2) generated always as ((payload#>>'{snapshot,payoutCents}')::numeric/100) stored,
  decimal_odds numeric(12,4) generated always as ((payload#>>'{snapshot,odds}')::numeric) stored,
  probability numeric generated always as ((payload#>>'{snapshot,probability}')::numeric) stored,
  imported_at timestamptz not null,
  unique(user_id,id), unique(user_id,fingerprint), unique(user_id,batch_id,row_number),
  foreign key(user_id,batch_id) references public.historical_import_batches(user_id,id),
  check((payload->>'id')::uuid is not distinct from id),
  check((payload->>'batchId')::uuid is not distinct from batch_id),
  check((payload->>'rowNumber')::integer is not distinct from row_number),
  check((payload->>'importedAt')::timestamptz is not distinct from imported_at)
);
-- Explicit UTF-8 makes this conversion independent of database/session encoding.
-- A length prefix prevents ambiguous pairs even if a source includes delimiters.
create function public.edgelab_history_reference_key(external_id text, source_reference text) returns text
language sql immutable strict set search_path='' as $$
  select encode(sha256(convert_to(length(external_id)::text||':'||external_id||source_reference,'UTF8')),'hex')
$$;
-- Hash the complete reference pair to keep large UTF-8 source URLs within index limits.
create unique index historical_external_reference on public.historical_research_records
  (user_id,public.edgelab_history_reference_key(external_id,source_reference))
  where external_id is not null and source_reference is not null;
create table public.historical_paper_results (
  record_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null check(public.edgelab_history_paper(payload)),
  updated_at timestamptz not null,
  unique(user_id,record_id),
  foreign key(user_id,record_id) references public.historical_research_records(user_id,id),
  check((payload->>'recordId')::uuid is not distinct from record_id),
  check((payload->>'updatedAt')::timestamptz is not distinct from updated_at)
);
create table public.historical_notifications (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  record_id uuid not null,
  payload jsonb not null check(public.edgelab_history_notification(payload)),
  dedupe_key text generated always as (payload->>'dedupeKey') stored not null,
  created_at timestamptz not null,
  unique(user_id,id), unique(user_id,dedupe_key), unique(user_id,record_id),
  foreign key(user_id,record_id) references public.historical_research_records(user_id,id),
  check((payload->>'id')::uuid is not distinct from id),
  check((payload->>'recordId')::uuid is not distinct from record_id),
  check((payload->>'createdAt')::timestamptz is not distinct from created_at)
);
create table public.historical_audit_history (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  record_id uuid,
  batch_id uuid,
  payload jsonb not null check(public.edgelab_history_audit(payload)),
  created_at timestamptz not null,
  unique(user_id,id),
  foreign key(user_id,record_id) references public.historical_research_records(user_id,id),
  foreign key(user_id,batch_id) references public.historical_import_batches(user_id,id),
  check((payload->>'id')::uuid is not distinct from id),
  check((payload->>'recordId')::uuid is not distinct from record_id),
  check((payload->>'batchId')::uuid is not distinct from batch_id),
  check((payload->>'timestamp')::timestamptz is not distinct from created_at)
);
create index historical_batches_owner_date on public.historical_import_batches(user_id,created_at desc);
create index historical_batches_owner_source on public.historical_import_batches(user_id,source_hash);
create index historical_records_owner_date on public.historical_research_records(user_id,imported_at desc);
create index historical_records_owner_batch on public.historical_research_records(user_id,batch_id);
create index historical_records_owner_kind on public.historical_research_records(user_id,kind,sport);
create index historical_notifications_owner_date on public.historical_notifications(user_id,created_at desc);
create index historical_notifications_owner_record on public.historical_notifications(user_id,record_id);
create index historical_audits_owner_date on public.historical_audit_history(user_id,created_at desc);
create index historical_audits_owner_record on public.historical_audit_history(user_id,record_id);
create index historical_audits_owner_batch on public.historical_audit_history(user_id,batch_id);

-- Both access predicates bind ownership to the real authenticated JWT identity.
do $$
declare table_name text;
begin
  foreach table_name in array array['historical_workspace_revisions','historical_import_batches','historical_research_records','historical_paper_results','historical_notifications','historical_audit_history'] loop
    execute format('alter table public.%I enable row level security',table_name);
    execute format('create policy historical_owner on public.%I for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid())',table_name);
    execute format('revoke all on public.%I from public,anon,authenticated',table_name);
    execute format('grant select,insert,update on public.%I to authenticated',table_name);
  end loop;
end $$;
create trigger historical_batch_immutable before update on public.historical_import_batches for each row execute function public.edgelab_deny_rewrite();
create trigger historical_record_immutable before update on public.historical_research_records for each row execute function public.edgelab_deny_rewrite();
create trigger historical_audit_immutable before update on public.historical_audit_history for each row execute function public.edgelab_deny_rewrite();

create function public.edgelab_history_guard_record() returns trigger language plpgsql security invoker set search_path='' as $$
declare batch jsonb;
begin
  select payload into batch from public.historical_import_batches where user_id=NEW.user_id and id=NEW.batch_id;
  if not found or batch->>'verification' is distinct from NEW.payload#>>'{snapshot,verification}' then raise exception 'Historical record must preserve its batch verification classification'; end if;
  if NEW.row_number>(batch#>>'{summary,parsed}')::integer then raise exception 'Historical row number is outside the original source'; end if;
  return NEW;
end $$;
create trigger historical_record_batch_guard before insert on public.historical_research_records for each row execute function public.edgelab_history_guard_record();

-- A source batch and its approved rows are one atomic import. Deferred checks also
-- prevent direct-table clients from appending rows to an already frozen batch.
create function public.edgelab_history_guard_batch_totals() returns trigger language plpgsql security invoker set search_path='' as $$
declare batch_key uuid; batch jsonb; imported_count bigint; actual_count bigint; paper_count bigint; warning_count bigint;
begin
  if TG_TABLE_NAME='historical_import_batches' then batch_key:=NEW.id; else batch_key:=NEW.batch_id; end if;
  select payload into batch from public.historical_import_batches where user_id=NEW.user_id and id=batch_key;
  select count(*),count(*) filter(where kind='actual'),count(*) filter(where kind='paper'),coalesce(sum(jsonb_array_length(payload->'issues')),0)
    into imported_count,actual_count,paper_count,warning_count from public.historical_research_records where user_id=NEW.user_id and batch_id=batch_key;
  if not found or imported_count<>(batch#>>'{summary,imported}')::bigint or actual_count<>(batch#>>'{summary,actual}')::bigint
    or paper_count<>(batch#>>'{summary,paper}')::bigint or warning_count<>(batch#>>'{summary,warnings}')::bigint then raise exception 'Import audit summary must match every approved record and warning'; end if;
  return NEW;
end $$;
create constraint trigger historical_batch_complete after insert on public.historical_import_batches deferrable initially deferred for each row execute function public.edgelab_history_guard_batch_totals();
create constraint trigger historical_records_complete after insert on public.historical_research_records deferrable initially deferred for each row execute function public.edgelab_history_guard_batch_totals();

create function public.edgelab_history_guard_audit() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if NEW.record_id is not null and (NEW.batch_id is null or not exists(select 1 from public.historical_research_records where user_id=NEW.user_id and id=NEW.record_id and batch_id=NEW.batch_id)) then raise exception 'Historical audit must reference its original source batch'; end if;
  return NEW;
end $$;
create trigger historical_audit_source_guard before insert on public.historical_audit_history for each row execute function public.edgelab_history_guard_audit();

create function public.edgelab_history_guard_paper() returns trigger language plpgsql security invoker set search_path='' as $$
declare original jsonb; item jsonb; has_won boolean := false; has_lost boolean := false; has_pending boolean := false; all_void boolean := true;
begin
  if TG_OP='UPDATE' and (NEW.record_id is distinct from OLD.record_id or NEW.user_id is distinct from OLD.user_id or NEW.updated_at<OLD.updated_at) then raise exception 'Paper identity and update chronology are immutable'; end if;
  select payload->'snapshot' into original from public.historical_research_records where user_id=NEW.user_id and id=NEW.record_id;
  if not found or coalesce(original->>'kind','') not in ('','paper') then raise exception 'Actual records cannot be converted into paper tracking'; end if;
  if NEW.payload->'settledAt'<>'null'::jsonb and original->'predictionAt'<>'null'::jsonb and (NEW.payload->>'settledAt')::timestamptz<(original->>'predictionAt')::timestamptz then raise exception 'Paper settlement cannot precede original forecast'; end if;
  if jsonb_array_length(NEW.payload->'legs')<>jsonb_array_length(original->'legs') then raise exception 'Paper results must retain every original leg identity'; end if;
  for item in select x from jsonb_array_elements(NEW.payload->'legs') x loop
    if not exists(select 1 from jsonb_array_elements(original->'legs') l where l->>'id'=item->>'legId') then raise exception 'Paper result references an unknown original leg'; end if;
    has_won:=has_won or item->>'outcome'='won'; has_lost:=has_lost or item->>'outcome'='lost'; has_pending:=has_pending or item->>'outcome'='pending'; all_void:=all_void and item->>'outcome'='void';
  end loop;
  if NEW.payload->>'outcome'='won' and (not has_won or has_lost or has_pending) then raise exception 'Won paper result needs won or void legs'; end if;
  if NEW.payload->>'outcome'='lost' and not has_lost then raise exception 'Lost paper result needs a lost leg'; end if;
  if NEW.payload->>'outcome'='void' and (jsonb_array_length(original->'legs')=0 or not all_void) then raise exception 'Void paper result needs every original leg void'; end if;
  return NEW;
end $$;
create trigger historical_paper_guard before insert or update on public.historical_paper_results for each row execute function public.edgelab_history_guard_paper();
create function public.edgelab_history_guard_notification() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if TG_OP='INSERT' then
    if not exists(select 1 from public.historical_notifications where user_id=NEW.user_id and id=NEW.id) and (NEW.payload->'readAt'<>'null'::jsonb or NEW.payload->'dismissedAt'<>'null'::jsonb) then raise exception 'New historical notifications must start unread'; end if;
    return NEW;
  end if;
  if NEW.id is distinct from OLD.id or NEW.user_id is distinct from OLD.user_id or NEW.record_id is distinct from OLD.record_id or NEW.created_at is distinct from OLD.created_at
    or (NEW.payload-array['readAt','dismissedAt']) is distinct from (OLD.payload-array['readAt','dismissedAt']) then raise exception 'Historical notification source and detail snapshot are immutable'; end if;
  if OLD.payload->'readAt'<>'null'::jsonb and NEW.payload->'readAt' is distinct from OLD.payload->'readAt' then raise exception 'Notification read state cannot be rewritten'; end if;
  if OLD.payload->'dismissedAt'<>'null'::jsonb and NEW.payload->'dismissedAt' is distinct from OLD.payload->'dismissedAt' then raise exception 'Notification dismissal cannot be rewritten'; end if;
  return NEW;
end $$;
create trigger historical_notification_guard before insert or update on public.historical_notifications for each row execute function public.edgelab_history_guard_notification();

-- Auto-audit mutable lifecycle writes even if a client uses the direct table API.
create function public.edgelab_history_audit_lifecycle() returns trigger language plpgsql security invoker set search_path='' as $$
declare audit_id uuid:=gen_random_uuid(); stamp timestamptz:=now(); original jsonb; action_name text; record_key uuid; batch_key uuid;
begin
  if TG_OP='UPDATE' and NEW.payload is not distinct from OLD.payload then return NEW; end if;
  original:=case when TG_OP='UPDATE' then OLD.payload else 'null'::jsonb end;
  if TG_TABLE_NAME='historical_import_batches' then action_name:='import_confirmed'; record_key:=null; batch_key:=NEW.id;
  elsif TG_TABLE_NAME='historical_paper_results' then action_name:=case when TG_OP='INSERT' then 'paper_registered' else 'paper_result_recorded' end; record_key:=NEW.record_id;
  elsif TG_OP='INSERT' then action_name:='notification_created'; record_key:=NEW.record_id;
  elsif NEW.payload->'dismissedAt' is distinct from OLD.payload->'dismissedAt' then action_name:='notification_dismissed'; record_key:=NEW.record_id;
  else action_name:='notification_read'; record_key:=NEW.record_id; end if;
  if record_key is not null then select batch_id into batch_key from public.historical_research_records where user_id=NEW.user_id and id=record_key; end if;
  insert into public.historical_audit_history(id,user_id,record_id,batch_id,payload,created_at)
  values(audit_id,NEW.user_id,record_key,batch_key,jsonb_build_object('id',audit_id,'recordId',record_key,'batchId',batch_key,'action',action_name,'timestamp',stamp,'before',original,'after',NEW.payload),stamp);
  return NEW;
end $$;
create trigger historical_batch_audit after insert on public.historical_import_batches for each row execute function public.edgelab_history_audit_lifecycle();
create trigger historical_paper_audit after insert or update on public.historical_paper_results for each row execute function public.edgelab_history_audit_lifecycle();
create trigger historical_notification_audit after insert or update on public.historical_notifications for each row execute function public.edgelab_history_audit_lifecycle();

create function public.edgelab_history_guard_revision() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if current_setting('edgelab.history_save',true) is distinct from NEW.user_id::text then NEW.revision:=case when TG_OP='INSERT' then 1 else OLD.revision+1 end; end if;
  NEW.updated_at:=now(); return NEW;
end $$;
create trigger historical_revision_guard before insert or update on public.historical_workspace_revisions for each row execute function public.edgelab_history_guard_revision();
create function public.edgelab_history_bump_revision() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if current_setting('edgelab.history_save',true) is distinct from NEW.user_id::text then
    insert into public.historical_workspace_revisions(user_id,revision) values(NEW.user_id,1)
      on conflict(user_id) do update set revision=public.historical_workspace_revisions.revision+1;
  end if;
  return NEW;
end $$;
do $$
declare table_name text;
begin
  foreach table_name in array array['historical_import_batches','historical_research_records','historical_paper_results','historical_notifications','historical_audit_history'] loop
    execute format('create trigger historical_direct_revision after insert or update on public.%I for each row execute function public.edgelab_history_bump_revision()',table_name);
  end loop;
end $$;

create function public.edgelab_load_history(expected_owner_id uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare owner_id uuid:=auth.uid(); current_revision bigint;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  if owner_id is distinct from expected_owner_id then raise exception 'Authenticated historical owner changed; reload before accessing history'; end if;
  select revision into current_revision from public.historical_workspace_revisions where user_id=owner_id;
  return jsonb_build_object(
    'revision',coalesce(current_revision,0),
    'batches',coalesce((select jsonb_agg(payload order by created_at,id) from public.historical_import_batches where user_id=owner_id),'[]'::jsonb),
    'records',coalesce((select jsonb_agg(payload order by imported_at,id) from public.historical_research_records where user_id=owner_id),'[]'::jsonb),
    'paperResults',coalesce((select jsonb_agg(payload order by updated_at,record_id) from public.historical_paper_results where user_id=owner_id),'[]'::jsonb),
    'notifications',coalesce((select jsonb_agg(payload order by created_at,id) from public.historical_notifications where user_id=owner_id),'[]'::jsonb),
    'audit',coalesce((select jsonb_agg(payload order by created_at,id) from public.historical_audit_history where user_id=owner_id),'[]'::jsonb)
  );
end $$;
create function public.edgelab_save_history(workspace jsonb, expected_revision bigint, expected_owner_id uuid) returns bigint language plpgsql security invoker set search_path='' as $$
declare owner_id uuid:=auth.uid(); current_revision bigint; previous_context text:=current_setting('edgelab.history_save',true); item jsonb; array_name text; id_key text; record_count integer; actual_count integer; paper_count integer;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  if owner_id is distinct from expected_owner_id then raise exception 'Authenticated historical owner changed; reload before accessing history'; end if;
  if not public.edgelab_history_object(workspace,array['revision','batches','records','paperResults','notifications','audit']) then raise exception 'Historical workspace is invalid'; end if;
  if expected_revision is null or expected_revision<0 or expected_revision>=9007199254740991 or jsonb_typeof(workspace->'revision') is distinct from 'number' or (workspace->>'revision')::numeric<>expected_revision+1 then raise exception 'Historical workspace revision conflict; reload before saving'; end if;
  if octet_length(workspace::text)>33554432 then raise exception 'Historical workspace exceeds the current archive size limit'; end if;
  foreach array_name in array array['batches','records','paperResults','notifications','audit'] loop
    if jsonb_typeof(workspace->array_name) is distinct from 'array' then raise exception 'Historical workspace arrays are required'; end if;
    id_key:=case when array_name='paperResults' then 'recordId' else 'id' end;
    if exists(select 1 from jsonb_array_elements(workspace->array_name) j group by j->>id_key having count(*)>1) then raise exception 'Historical workspace contains duplicate identifiers'; end if;
  end loop;
  for item in select x from jsonb_array_elements(workspace->'batches') x loop
    if not public.edgelab_history_batch(item) then raise exception 'Historical batch source/hash or confirmation summary is invalid; synthetic data stays in Demo'; end if;
  end loop;
  for item in select x from jsonb_array_elements(workspace->'records') x loop
    if not public.edgelab_history_record(item) then raise exception 'Historical record validation failed; unknown values must remain null and invalid rows cannot be committed'; end if;
  end loop;
  for item in select x from jsonb_array_elements(workspace->'paperResults') x loop
    if not public.edgelab_history_paper(item) then raise exception 'Historical paper result validation failed'; end if;
  end loop;
  for item in select x from jsonb_array_elements(workspace->'notifications') x loop
    if not public.edgelab_history_notification(item) then raise exception 'Historical notification validation failed'; end if;
  end loop;
  for item in select x from jsonb_array_elements(workspace->'audit') x loop
    if not public.edgelab_history_audit(item) then raise exception 'Historical audit validation failed'; end if;
  end loop;
  perform set_config('edgelab.history_save',owner_id::text,true);
  insert into public.historical_workspace_revisions(user_id,revision) values(owner_id,0) on conflict(user_id) do nothing;
  select revision into current_revision from public.historical_workspace_revisions where user_id=owner_id for update;
  if current_revision<>expected_revision then raise exception 'Historical workspace revision conflict; reload before saving'; end if;
  if exists(select 1 from public.historical_import_batches b where user_id=owner_id and not exists(select 1 from jsonb_array_elements(workspace->'batches') j where (j->>'id')::uuid=b.id))
    or exists(select 1 from public.historical_research_records r where user_id=owner_id and not exists(select 1 from jsonb_array_elements(workspace->'records') j where (j->>'id')::uuid=r.id))
    or exists(select 1 from public.historical_paper_results p where user_id=owner_id and not exists(select 1 from jsonb_array_elements(workspace->'paperResults') j where (j->>'recordId')::uuid=p.record_id))
    or exists(select 1 from public.historical_notifications n where user_id=owner_id and not exists(select 1 from jsonb_array_elements(workspace->'notifications') j where (j->>'id')::uuid=n.id)) then raise exception 'Historical source and lifecycle history cannot be deleted'; end if;

  for item in select x from jsonb_array_elements(workspace->'batches') x loop
    insert into public.historical_import_batches(id,user_id,payload,created_at) values((item->>'id')::uuid,owner_id,item,(item->>'createdAt')::timestamptz) on conflict(id) do nothing;
    if not exists(select 1 from public.historical_import_batches where id=(item->>'id')::uuid and user_id=owner_id and payload=item) then raise exception 'Historical batch source and summary are immutable'; end if;
  end loop;
  for item in select x from jsonb_array_elements(workspace->'records') x loop
    insert into public.historical_research_records(id,user_id,batch_id,row_number,payload,imported_at)
      values((item->>'id')::uuid,owner_id,(item->>'batchId')::uuid,(item->>'rowNumber')::integer,item,(item->>'importedAt')::timestamptz) on conflict(id) do nothing;
    if not exists(select 1 from public.historical_research_records where id=(item->>'id')::uuid and user_id=owner_id and payload=item) then raise exception 'Original historical forecast, source and transformations are immutable'; end if;
  end loop;
  for item in select x from jsonb_array_elements(workspace->'batches') x loop
    select count(*),count(*) filter(where kind='actual'),count(*) filter(where kind='paper') into record_count,actual_count,paper_count
      from public.historical_research_records where user_id=owner_id and batch_id=(item->>'id')::uuid;
    if record_count<>(item#>>'{summary,imported}')::integer or actual_count<>(item#>>'{summary,actual}')::integer or paper_count<>(item#>>'{summary,paper}')::integer then raise exception 'Import audit summary must match confirmed records'; end if;
  end loop;
  for item in select x from jsonb_array_elements(workspace->'paperResults') x loop
    insert into public.historical_paper_results(record_id,user_id,payload,updated_at) values((item->>'recordId')::uuid,owner_id,item,(item->>'updatedAt')::timestamptz)
      on conflict(record_id) do update set payload=excluded.payload,updated_at=excluded.updated_at where public.historical_paper_results.user_id=owner_id;
    if not exists(select 1 from public.historical_paper_results where record_id=(item->>'recordId')::uuid and user_id=owner_id) then raise exception 'Historical paper ownership mismatch'; end if;
  end loop;
  for item in select x from jsonb_array_elements(workspace->'notifications') x loop
    insert into public.historical_notifications(id,user_id,record_id,payload,created_at) values((item->>'id')::uuid,owner_id,(item->>'recordId')::uuid,item,(item->>'createdAt')::timestamptz)
      on conflict(id) do update set payload=excluded.payload where public.historical_notifications.user_id=owner_id;
    if not exists(select 1 from public.historical_notifications where id=(item->>'id')::uuid and user_id=owner_id) then raise exception 'Historical notification ownership mismatch'; end if;
  end loop;
  for item in select x from jsonb_array_elements(workspace->'audit') x loop
    insert into public.historical_audit_history(id,user_id,record_id,batch_id,payload,created_at) values((item->>'id')::uuid,owner_id,(item->>'recordId')::uuid,(item->>'batchId')::uuid,item,(item->>'timestamp')::timestamptz) on conflict(id) do nothing;
    if not exists(select 1 from public.historical_audit_history where id=(item->>'id')::uuid and user_id=owner_id and payload=item) then raise exception 'Historical audit is append only'; end if;
  end loop;
  update public.historical_workspace_revisions set revision=current_revision+1 where user_id=owner_id;
  perform set_config('edgelab.history_save',coalesce(previous_context,''),true);
  return current_revision+1;
end $$;

do $$
declare signature text;
begin
  for signature in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname like 'edgelab_history_%' or p.proname in ('edgelab_load_history','edgelab_save_history')) loop
    execute format('revoke all on function %s from public,anon',signature);
    execute format('grant execute on function %s to authenticated',signature);
  end loop;
end $$;
commit;
