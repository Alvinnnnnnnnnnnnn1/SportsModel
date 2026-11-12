-- PROPOSAL ONLY. Not in migrations/: never deploy without explicit owner approval.
-- V6-only tables and a non-login worker role. No V5 data changes or service role.
begin;
do $$begin
  if exists(select 1 from pg_roles where rolname='edgelab_v6_worker') then raise exception 'V6 worker role collision requires explicit review';end if;
  create role edgelab_v6_worker nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
end$$;
grant usage on schema public,auth to edgelab_v6_worker;
grant execute on function auth.uid() to edgelab_v6_worker;

-- Fixed UTF-8 encoding makes this deterministic; convert_to itself is marked
-- STABLE because its encoding argument is normally caller-supplied.
create function public.v6_sha256(value text) returns text
language sql immutable strict set search_path='' as $$
  select encode(sha256(convert_to(value,'UTF8')),'hex')
$$;
-- Evidence addresses are stored, never fetched by SQL. This deliberately
-- accepts credential-free HTTPS addresses and plain, non-secret query names.
create function public.v6_public_url(value text) returns boolean
language plpgsql immutable set search_path='' as $$
declare part text;query text;begin
  if value is null or value !~ '^https://[A-Za-z0-9][A-Za-z0-9.-]*(:[0-9]+)?(/[^[:space:]?#@]*)?(\?[^[:space:]#@]*)?$' then return false;end if;
  query:=split_part(value,'?',2);
  if query<>'' then foreach part in array string_to_array(query,'&') loop
    if part !~ '^[A-Za-z_][A-Za-z0-9_\[\]]*=[^[:space:]#@&]*$' or split_part(part,'=',1) ~* '(key|token|password|secret)' then return false;end if;
  end loop;end if;
  return true;
end$$;

create table public.v6_policies (
  user_id uuid not null references auth.users(id), id text not null,
  policy_hash text not null check(policy_hash ~ '^[a-f0-9]{64}$'),
  opening_reference_cents bigint not null check(opening_reference_cents=500000),
  stake_cents bigint not null check(stake_cents=5000),
  activated_at timestamptz, payload jsonb not null,
  primary key(user_id,id), check(id='v6-uncapped-paper-1')
);
create table public.v6_controls (
  user_id uuid not null, policy_id text not null, enabled boolean not null default false,
  kill_switch boolean not null default true,
  primary key(user_id,policy_id), foreign key(user_id,policy_id) references public.v6_policies(user_id,id)
);
create table public.v6_models (
  user_id uuid not null references auth.users(id), id text not null, version text not null,
  method text not null check(method in ('poisson_minutes_rate','surface_elo','nba_team_elo','nba_team_elo_only')),
  manifest_hash text not null check(manifest_hash ~ '^[a-f0-9]{64}$'),
  validation text not null check(validation in ('experimental','chronologically_evaluated','out_of_sample_validated')),
  approved_at timestamptz, payload jsonb not null,
  primary key(user_id,id,version)
);
create table public.v6_observations (
  user_id uuid not null references auth.users(id), id uuid not null,
  raw_source text not null check(octet_length(raw_source)<=2097152), payload jsonb not null,
  source_hash text generated always as (public.v6_sha256(raw_source)) stored,
  primary key(user_id,id), check(jsonb_typeof(payload)='object'),
  check(public.v6_public_url(payload->>'sourceUrl')),
  check(payload->>'sourceClass' is not distinct from 'prospective'),
  check(payload->>'provider' is not distinct from 'the-odds-api.com'),
  check(payload->>'permissionReference' is not distinct from 'https://the-odds-api.com/terms-and-conditions.html'),
  check((payload->>'id')::uuid is not distinct from id)
);
create table public.v6_positions (
  user_id uuid not null, id uuid not null, policy_id text not null,
  observation_id uuid not null, model_id text not null, model_version text not null,
  canonical_market jsonb not null, bookmaker text not null,
  registered_at timestamptz not null default clock_timestamp(),
  stake_cents bigint not null check(stake_cents=5000),
  original_odds numeric(12,4) not null check(original_odds>1 and original_odds<=10000),
  original_inputs text not null check(octet_length(original_inputs)<=65536), payload jsonb not null,
  primary key(user_id,id),
  foreign key(user_id,policy_id) references public.v6_policies(user_id,id),
  foreign key(user_id,observation_id) references public.v6_observations(user_id,id),
  foreign key(user_id,model_id,model_version) references public.v6_models(user_id,id,version),
  unique(user_id,policy_id,bookmaker,canonical_market)
);
create table public.v6_grade_revisions (
  user_id uuid not null, id uuid not null, position_id uuid not null,
  revision integer not null check(revision>0), previous_grade_id uuid,
  outcome text not null check(outcome in ('won','lost','void','push','unresolved')),
  original_odds numeric(12,4) not null check(original_odds>1 and original_odds<=10000),
  recorded_at timestamptz not null default clock_timestamp(), payload jsonb not null,
  original_position text not null check(octet_length(original_position)<=2097152),
  profit_cents bigint generated always as (case outcome when 'won' then round(5000*(original_odds-1))::bigint when 'lost' then -5000 when 'void' then 0 when 'push' then 0 else null end) stored,
  primary key(user_id,id),unique(user_id,position_id,revision),
  foreign key(user_id,position_id) references public.v6_positions(user_id,id),
  foreign key(user_id,previous_grade_id) references public.v6_grade_revisions(user_id,id)
);
create table public.v6_runs (
  user_id uuid not null references auth.users(id), id uuid not null, run_key text not null,
  created_at timestamptz not null default clock_timestamp(),payload jsonb not null,
  primary key(user_id,id),unique(user_id,run_key)
);
create table public.v6_provider_quotas (
  user_id uuid not null references auth.users(id),provider text not null check(provider='the-odds-api.com'),
  period text not null,reserved integer not null check(reserved between 0 and 400),
  primary key(user_id,provider,period)
);
create table public.v6_outbox (
  user_id uuid not null references auth.users(id),id uuid not null,
  event_key text not null,channel text not null check(channel='in_app'),payload jsonb not null,
  primary key(user_id,id),unique(user_id,event_key)
);
create table public.v6_audit (
  user_id uuid not null references auth.users(id),id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default clock_timestamp(),entity text not null,payload jsonb not null,
  primary key(user_id,id)
);
create index v6_position_event on public.v6_positions(user_id,registered_at);
create index v6_grade_position on public.v6_grade_revisions(user_id,position_id,revision desc);
create index v6_run_date on public.v6_runs(user_id,created_at);

create function public.v6_valid_market(m jsonb) returns boolean language sql immutable set search_path='' as $$
  select coalesce(jsonb_typeof(m)='object'
    and (m-array['sport','eventId','subjectId','statistic','operator','threshold','period','periodNumber','overtime','termsVersion'])='{}'::jsonb
    and m->>'sport' in ('NBA','NBL','ATP','WTA')
    and jsonb_typeof(m->'eventId')='string' and length(m->>'eventId') between 1 and 500
    and jsonb_typeof(m->'subjectId')='string' and length(m->>'subjectId') between 1 and 500
    and jsonb_typeof(m->'termsVersion')='string' and length(m->>'termsVersion') between 1 and 500
    and m->>'statistic' in ('points','rebounds','assists','threes','PRA','PR','PA','RA','moneyline','spread','total','games','sets')
    and m->>'operator' in ('gt','gte','lt','lte','eq','win')
    and ((m->>'statistic'='moneyline' and m->>'operator'='win' and m->'threshold'='null'::jsonb)
      or (m->>'statistic'<>'moneyline' and m->>'operator'<>'win' and jsonb_typeof(m->'threshold')='number'))
    and m->>'period' in ('full_game','match','set','quarter')
    and ((m->>'period' in ('full_game','match') and m->'periodNumber'='null'::jsonb)
      or (m->>'period' in ('set','quarter') and jsonb_typeof(m->'periodNumber')='number' and (m->>'periodNumber')::numeric>0 and (m->>'periodNumber')::numeric=trunc((m->>'periodNumber')::numeric)))
    and m->>'overtime' in ('included','excluded','not_applicable'),false)
$$;
alter table public.v6_positions add constraint v6_exact_market check(public.v6_valid_market(canonical_market));

do $$declare name text;begin
  foreach name in array array['v6_policies','v6_controls','v6_models','v6_observations','v6_positions','v6_grade_revisions','v6_runs','v6_provider_quotas','v6_outbox','v6_audit'] loop
    execute format('alter table public.%I enable row level security',name);
    execute format('create policy v6_owner on public.%I for all using (user_id=auth.uid()) with check (user_id=auth.uid())',name);
    execute format('revoke all on public.%I from public,anon,authenticated,edgelab_v6_worker',name);
    execute format('grant select on public.%I to authenticated,edgelab_v6_worker',name);
  end loop;
end$$;
grant insert on public.v6_policies,public.v6_models to authenticated;
grant insert,update on public.v6_controls to authenticated;
grant insert on public.v6_observations,public.v6_positions,public.v6_grade_revisions,public.v6_runs,public.v6_outbox,public.v6_audit to authenticated,edgelab_v6_worker;
-- PostgreSQL requires an UPDATE privilege for SELECT ... FOR UPDATE during
-- grade revision serialization. The unconditional v6_frozen trigger below
-- still rejects every UPDATE; this grant permits row locking only.
grant update(registered_at) on public.v6_positions to authenticated,edgelab_v6_worker;
grant insert,update on public.v6_provider_quotas to authenticated,edgelab_v6_worker;

create function public.v6_immutable() returns trigger language plpgsql security invoker set search_path='' as $$
begin raise exception 'V6 original sources and revisions are append-only';end$$;
do $$declare name text;begin
  foreach name in array array['v6_policies','v6_models','v6_observations','v6_positions','v6_grade_revisions','v6_runs','v6_outbox','v6_audit'] loop
    execute format('create trigger v6_frozen before update or delete on public.%I for each row execute function public.v6_immutable()',name);
  end loop;
end$$;

create function public.v6_check_position() returns trigger language plpgsql security invoker set search_path='' as $$
declare o jsonb;p public.v6_policies;m public.v6_models;f jsonb;t jsonb;field text;home_prob numeric;calculated numeric;market_base numeric;elo_base numeric;clock timestamptz:=clock_timestamp();quote_time timestamptz;start_time timestamptz;begin
  if NEW.user_id is distinct from auth.uid() then raise exception 'V6 owner mismatch';end if;
  select * into p from public.v6_policies where user_id=NEW.user_id and id=NEW.policy_id;
  if p.activated_at is null or p.activated_at>clock or not exists(select 1 from public.v6_controls where user_id=NEW.user_id and policy_id=NEW.policy_id and enabled and not kill_switch) then raise exception 'V6 standing policy inactive';end if;
  select * into m from public.v6_models where user_id=NEW.user_id and id=NEW.model_id and version=NEW.model_version;
  if m.approved_at is null or m.approved_at>clock or not (m.validation='out_of_sample_validated'
    or (m.validation='chronologically_evaluated' and m.method='nba_team_elo_only' and m.payload->>'researchPurpose'='experimental')) then raise exception 'V6 model not activated and validated';end if;
  select payload into o from public.v6_observations where user_id=NEW.user_id and id=NEW.observation_id;
  f:=NEW.payload->'forecast';
  if o is null or NEW.payload->'observation' is distinct from o or o->>'rawHash' is distinct from (select source_hash from public.v6_observations where user_id=NEW.user_id and id=NEW.observation_id)
    or o->>'status' is distinct from 'prematch_open' or NEW.payload->>'cohort' is distinct from 'v6-prospective'
    or NEW.payload->>'ownerId' is distinct from NEW.user_id::text or NEW.payload->>'policyId' is distinct from NEW.policy_id
    or NEW.payload->>'classification' is distinct from 'model_supported' or NEW.payload->>'decisionWindow' is distinct from 'pre_event_once'
    or NEW.payload->'observation'->'market' is distinct from NEW.canonical_market
    or f->'market' is distinct from NEW.canonical_market or o->>'bookmaker' is distinct from NEW.bookmaker
    or f->>'modelId' is distinct from m.id or f->>'version' is distinct from m.version or f->>'method' is distinct from m.method
    or f->>'validation' is distinct from m.validation
    or coalesce(f->>'researchTier','strongly_supported') not in ('experimental','strongly_supported')
    or coalesce(NEW.payload->>'researchTier','strongly_supported') is distinct from coalesce(f->>'researchTier','strongly_supported')
    or coalesce(f->>'researchTier','strongly_supported') is distinct from coalesce(m.payload->>'researchPurpose','strongly_supported')
    or jsonb_typeof(f->'probability') is distinct from 'number'
    or (f->>'probability')::numeric not between 0 and 1
    or jsonb_typeof(f->'pushProbability') is distinct from 'number'
    or (f->>'pushProbability')::numeric not between 0 and 1
    or (f->>'probability')::numeric+(f->>'pushProbability')::numeric>1.000000000001
    or jsonb_typeof(o->'odds') is distinct from 'number' or (o->>'odds')::numeric<>NEW.original_odds
    or jsonb_typeof(NEW.payload->'stakeCents') is distinct from 'number' or (NEW.payload->>'stakeCents')::numeric<>5000
    or (NEW.payload->>'id')::uuid is distinct from NEW.id
    or f->'inputs' is distinct from NEW.original_inputs::jsonb
    or f->>'inputsHash' is distinct from encode(sha256(convert_to(NEW.original_inputs,'UTF8')),'hex')
    then raise exception 'V6 immutable forecast/source identity invalid';end if;
  start_time:=(o->>'eventStartsAt')::timestamptz;quote_time:=(o->>'sourceUpdatedAt')::timestamptz;
  if start_time is null or start_time<=clock or quote_time is null or quote_time>clock or quote_time<clock-interval '300 seconds'
    or (o->>'observedAt')::timestamptz is null or (o->>'retrievedAt')::timestamptz is null
    or (o->>'observedAt')::timestamptz>clock or (o->>'retrievedAt')::timestamptz>clock
    or quote_time>(o->>'retrievedAt')::timestamptz or (o->>'observedAt')::timestamptz>(o->>'retrievedAt')::timestamptz
    or (o->>'observedAt')::timestamptz<clock-interval '300 seconds'
    or (f->>'inputCutoff')::timestamptz is null or (f->>'generatedAt')::timestamptz is null
    or (f->>'inputCutoff')::timestamptz>(f->>'generatedAt')::timestamptz or (f->>'generatedAt')::timestamptz>clock
    or (f#>>'{inputs,sourceObservedAt}')::timestamptz is null or (f#>>'{inputs,sourceObservedAt}')::timestamptz>(f->>'inputCutoff')::timestamptz
    or (f->>'probability')::numeric*NEW.original_odds+(f->>'pushProbability')::numeric-1<0.02 then raise exception 'V6 pre-event/source/model quality gate failed';end if;
  if m.method in ('nba_team_elo','nba_team_elo_only') then
    t:=f#>'{inputs,team}';
    if jsonb_typeof(t) is distinct from 'object'
      or not ((m.method='nba_team_elo' and m.id='nba-team-elo-form-rest' and m.version='experimental-1')
        or (m.method='nba_team_elo_only' and m.id='nba-team-elo-only' and m.version='candidate-1'))
      or NEW.canonical_market->>'sport' is distinct from 'NBA' or NEW.canonical_market->>'statistic' is distinct from 'moneyline'
      or NEW.canonical_market->>'operator' is distinct from 'win' or NEW.canonical_market->>'period' is distinct from 'full_game'
      or NEW.canonical_market->>'overtime' is distinct from 'included' or (f->>'pushProbability')::numeric<>0
      or nullif(t->>'homeId','') is null or nullif(t->>'awayId','') is null or t->>'homeId'=t->>'awayId'
      or NEW.canonical_market->>'subjectId' not in (t->>'homeId',t->>'awayId')
      or coalesce(t->>'historyHash','') !~ '^[a-f0-9]{64}$' or coalesce(t->>'registryHash','') !~ '^[a-f0-9]{64}$'
      then raise exception 'V6 exact NBA team model identity invalid';end if;
    foreach field in array array['homeRating','awayRating','homeCourt','formAdjustment','restAdjustment','shrinkage'] loop
      if jsonb_typeof(t->field) is distinct from 'number' then raise exception 'V6 team numerical input missing';end if;
    end loop;
    if (t->>'homeRating')::numeric not between 0 and 5000 or (t->>'awayRating')::numeric not between 0 and 5000
      or (t->>'homeCourt')::numeric<>60 or (t->>'formAdjustment')::numeric not between -160 and 160
      or (t->>'restAdjustment')::numeric not between -20 and 20
      or (t->>'shrinkage')::numeric<>(case when m.method='nba_team_elo_only' then 0 else 0.05 end)
      or (m.method='nba_team_elo_only' and ((t->>'formAdjustment')::numeric<>0 or (t->>'restAdjustment')::numeric<>0))
      or nullif(t->>'safeEventStartsAt','') is null or (t->>'safeEventStartsAt')::timestamptz>start_time
      or (t->>'safeEventStartsAt')::timestamptz<=clock or (f->>'inputCutoff')::timestamptz>=(t->>'safeEventStartsAt')::timestamptz
      then raise exception 'V6 team input/start gate failed';end if;
    home_prob:=0.95/(1+power(10::numeric,-((t->>'homeRating')::numeric-(t->>'awayRating')::numeric+60+(t->>'formAdjustment')::numeric+(t->>'restAdjustment')::numeric)/400))+0.025;
    if m.method='nba_team_elo_only' then
      if (t->>'safeEventStartsAt')::timestamptz<=clock+interval '60 seconds' then raise exception 'V6 controlled pre-event safety buffer failed';end if;
      home_prob:=1/(1+power(10::numeric,-((t->>'homeRating')::numeric-(t->>'awayRating')::numeric+60)/400));
      if m.payload->>'researchPurpose'='experimental' then
        if m.validation<>'chronologically_evaluated' or m.payload->>'reviewStatus' is distinct from 'owner_approved'
          or jsonb_typeof(m.payload->'chronologicalGames') is distinct from 'number' or (m.payload->>'chronologicalGames')::numeric<500
          or (m.payload->>'chronologicalGames')::numeric<>trunc((m.payload->>'chronologicalGames')::numeric)
          or m.payload->'teamResultsOnlyAccepted' is distinct from 'true'::jsonb
          or m.payload#>>'{experimentalReview,policyId}' is distinct from 'nba-experimental-paper-1'
          or jsonb_typeof(m.payload#>'{experimentalReview,chronologicalSeasons}') is distinct from 'number'
          or coalesce((m.payload#>>'{experimentalReview,chronologicalSeasons}')::numeric,0)<2
          or (m.payload#>>'{experimentalReview,chronologicalSeasons}')::numeric<>trunc((m.payload#>>'{experimentalReview,chronologicalSeasons}')::numeric)
          or coalesce(m.payload#>>'{experimentalReview,reportHash}','') !~ '^[a-f0-9]{64}$'
          or coalesce(m.payload#>>'{experimentalReview,trainingEvidenceHash}','') !~ '^[a-f0-9]{64}$'
          or coalesce(m.payload#>>'{experimentalReview,featureCutoffPolicyHash}','') !~ '^[a-f0-9]{64}$'
          or m.payload#>'{experimentalReview,inputsReproducible}' is distinct from 'true'::jsonb
          or m.payload#>'{experimentalReview,chronologicalEvaluationReviewed}' is distinct from 'true'::jsonb
          or m.payload#>'{experimentalReview,historicalPublicationGapsDisclosed}' is distinct from 'true'::jsonb
          or m.payload#>'{experimentalReview,uncertaintyAndInjuryLimitationsAccepted}' is distinct from 'true'::jsonb
          or m.payload#>>'{experimentalReview,conclusion}' is distinct from 'experimental_research_only_no_profitability_or_calibration_claim'
          then raise exception 'V6 experimental model reproducibility review missing';end if;
      elsif m.payload->>'reviewStatus' is distinct from 'owner_approved' or jsonb_typeof(m.payload->'chronologicalGames') is distinct from 'number'
        or jsonb_typeof(m.payload->'verifiedProspectiveFixtures') is distinct from 'number'
        or (m.payload->>'chronologicalGames')::numeric<500 or (m.payload->>'verifiedProspectiveFixtures')::numeric<30
        or (m.payload->>'chronologicalGames')::numeric<>trunc((m.payload->>'chronologicalGames')::numeric)
        or (m.payload->>'verifiedProspectiveFixtures')::numeric<>trunc((m.payload->>'verifiedProspectiveFixtures')::numeric)
        or jsonb_typeof(m.payload->'teamResultsOnlyAccepted') is distinct from 'boolean'
        or m.payload->>'teamResultsOnlyAccepted' is distinct from 'true'
        or m.payload#>>'{readinessReview,policyId}' is distinct from 'nba-baseline-readiness-1'
        or m.payload#>>'{readinessReview,scope}' is distinct from 'limited_paper_baseline_not_proven_sportsbook_edge'
        or jsonb_typeof(m.payload#>'{readinessReview,chronologicalSeasons}') is distinct from 'number'
        or jsonb_typeof(m.payload#>'{readinessReview,prospectiveSlates}') is distinct from 'number'
        or coalesce((m.payload#>>'{readinessReview,chronologicalSeasons}')::numeric,0)<2
        or coalesce((m.payload#>>'{readinessReview,prospectiveSlates}')::numeric,0)<5
        or (m.payload#>>'{readinessReview,chronologicalSeasons}')::numeric<>trunc((m.payload#>>'{readinessReview,chronologicalSeasons}')::numeric)
        or (m.payload#>>'{readinessReview,prospectiveSlates}')::numeric<>trunc((m.payload#>>'{readinessReview,prospectiveSlates}')::numeric)
        or m.payload#>>'{readinessReview,reportHash}' !~ '^[a-f0-9]{64}$'
        or m.payload#>>'{readinessReview,reportHash}' is null
        or m.payload#>'{readinessReview,historicalPublicationGapsDisclosed}' is distinct from 'true'::jsonb
        or m.payload#>'{readinessReview,calibrationReviewed}' is distinct from 'true'::jsonb
        or m.payload#>'{readinessReview,bookmakerComparisonReviewed}' is distinct from 'true'::jsonb
        or m.payload#>>'{readinessReview,uncertaintyMethod}' is distinct from 'fixture_and_slate_cluster'
        or m.payload#>'{readinessReview,injuryRosterLimitationsAccepted}' is distinct from 'true'::jsonb
        or m.payload#>>'{readinessReview,reviewConclusion}' is distinct from 'owner_accepted_limited_baseline_no_edge_claim'
        then raise exception 'V6 controlled baseline validation review missing';end if;
    end if;
    calculated:=case when NEW.canonical_market->>'subjectId'=t->>'homeId' then home_prob else 1-home_prob end;
    if abs(calculated-(f->>'probability')::numeric)>0.0000000001 then raise exception 'V6 team probability is not reproducible';end if;
    if t->>'researchPolicyId' is distinct from 'nba-moneyline-two-pass-1' or jsonb_typeof(t->'homeOdds') is distinct from 'number' or jsonb_typeof(t->'awayOdds') is distinct from 'number'
      then raise exception 'V6 team research policy evidence missing';end if;
    if (t->>'homeOdds')::numeric not between 1.0001 and 10000 or (t->>'awayOdds')::numeric not between 1.0001 and 10000
      or (t->>'homeOdds')::numeric<>round((t->>'homeOdds')::numeric,4) or (t->>'awayOdds')::numeric<>round((t->>'awayOdds')::numeric,4)
      or NEW.original_odds<>(case when NEW.canonical_market->>'subjectId'=t->>'homeId' then (t->>'homeOdds')::numeric else (t->>'awayOdds')::numeric end)
      then raise exception 'V6 team original price mismatch';end if;
    market_base:=(1/(t->>'homeOdds')::numeric)/(1/(t->>'homeOdds')::numeric+1/(t->>'awayOdds')::numeric);
    elo_base:=1/(1+power(10::numeric,-((t->>'homeRating')::numeric-(t->>'awayRating')::numeric+60)/400));
    if NEW.canonical_market->>'subjectId'<>t->>'homeId' then market_base:=1-market_base;elo_base:=1-elo_base;end if;
    if calculated<0.55 or abs(calculated-market_base)>0.15 or abs(calculated-elo_base)>0.08 or (0.5+(calculated-0.5)*0.8)*NEW.original_odds-1<0.02
      then raise exception 'V6 two-pass team research quality gate failed';end if;
  end if;
  NEW.registered_at:=clock;
  NEW.payload:=jsonb_set(NEW.payload,'{registeredAt}',to_jsonb(clock));
  return NEW;
end$$;
create trigger v6_position_guard before insert on public.v6_positions for each row execute function public.v6_check_position();

create function public.v6_register_paper(expected_owner uuid,position_snapshot jsonb,original_inputs text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare saved jsonb;begin
  if auth.uid() is null or auth.uid() is distinct from expected_owner then raise exception 'V6 authenticated owner changed';end if;
  select payload into saved from public.v6_positions where user_id=auth.uid() and policy_id=position_snapshot->>'policyId' and bookmaker=position_snapshot#>>'{observation,bookmaker}' and canonical_market=position_snapshot#>'{observation,market}';
  if saved is not null then return saved;end if;
  insert into public.v6_positions(user_id,id,policy_id,observation_id,model_id,model_version,canonical_market,bookmaker,stake_cents,original_odds,original_inputs,payload)
    values(auth.uid(),(position_snapshot->>'id')::uuid,position_snapshot->>'policyId',(position_snapshot#>>'{observation,id}')::uuid,position_snapshot#>>'{forecast,modelId}',position_snapshot#>>'{forecast,version}',position_snapshot#>'{observation,market}',position_snapshot#>>'{observation,bookmaker}',5000,(position_snapshot#>>'{observation,odds}')::numeric,original_inputs,position_snapshot)
    on conflict(user_id,policy_id,bookmaker,canonical_market) do nothing;
  select payload into saved from public.v6_positions where user_id=auth.uid() and policy_id=position_snapshot->>'policyId' and bookmaker=position_snapshot#>>'{observation,bookmaker}' and canonical_market=position_snapshot#>'{observation,market}';
  return saved;
end$$;

create function public.v6_check_grade() returns trigger language plpgsql security invoker set search_path='' as $$
declare p public.v6_positions;previous public.v6_grade_revisions;market jsonb;observed numeric;line numeric;expected text;begin
  if NEW.user_id is distinct from auth.uid() then raise exception 'V6 owner mismatch';end if;
  select * into p from public.v6_positions where user_id=NEW.user_id and id=NEW.position_id for update;
  select * into previous from public.v6_grade_revisions where user_id=NEW.user_id and position_id=NEW.position_id order by revision desc limit 1;
  market:=p.canonical_market;
  if p.id is null or NEW.revision<>coalesce(previous.revision,0)+1 or NEW.previous_grade_id is distinct from previous.id
    or (NEW.payload->>'id')::uuid is distinct from NEW.id or (NEW.payload->>'positionId')::uuid is distinct from NEW.position_id
    or jsonb_typeof(NEW.payload->'revision') is distinct from 'number' or (NEW.payload->>'revision')::numeric is distinct from NEW.revision
    or (NEW.payload->>'previousGradeId')::uuid is distinct from NEW.previous_grade_id
    or NEW.original_position::jsonb is distinct from p.payload
    or NEW.payload->>'positionHash' is distinct from encode(sha256(convert_to(NEW.original_position,'UTF8')),'hex')
    or NEW.payload->>'sourceClass' is distinct from 'prospective' or NEW.payload->'market' is distinct from market
    or NEW.payload->>'eventId' is distinct from market->>'eventId' or NEW.payload->>'subjectId' is distinct from market->>'subjectId'
    or NEW.payload->>'termsVersion' is distinct from market->>'termsVersion' or NEW.payload->>'outcome' is distinct from NEW.outcome
    or NEW.payload->'final' is distinct from 'true'::jsonb
    or not public.v6_public_url(NEW.payload->>'sourceUrl') or coalesce(NEW.payload->>'sourceHash','') !~ '^[a-f0-9]{64}$'
    or coalesce(NEW.payload->>'publishedAt',NEW.payload->>'observedAt')::timestamptz is null
    or coalesce(NEW.payload->>'publishedAt',NEW.payload->>'observedAt')::timestamptz<(p.payload#>>'{observation,eventStartsAt}')::timestamptz
    or coalesce(NEW.payload->>'publishedAt',NEW.payload->>'observedAt')::timestamptz>clock_timestamp()
    or (NEW.payload->>'publishedAt' is null and (NEW.payload->>'observedAt' is null or NEW.payload->>'rawEvidence' is null))
    or (NEW.payload->>'rawEvidence' is not null and public.v6_sha256(NEW.payload->>'rawEvidence') is distinct from NEW.payload->>'sourceHash')
    or (NEW.payload->>'rawEvidence' is not null and (jsonb_typeof(NEW.payload->'rawEvidence') is distinct from 'string' or octet_length(NEW.payload->>'rawEvidence')>8000000))
    or (NEW.payload->>'observedAt')::timestamptz>clock_timestamp()
    or (NEW.payload->>'observedAt')::timestamptz<(NEW.payload->>'publishedAt')::timestamptz
    or (NEW.payload->>'recordedAt')::timestamptz is null
    or (NEW.payload->>'recordedAt')::timestamptz<coalesce(NEW.payload->>'observedAt',NEW.payload->>'publishedAt')::timestamptz
    or (NEW.payload->>'recordedAt')::timestamptz>clock_timestamp()
    or (previous.id is not null and (NEW.payload->>'recordedAt')::timestamptz<(previous.payload->>'recordedAt')::timestamptz)
    or (NEW.payload->>'exception' is distinct from 'none' and NEW.outcome<>'unresolved'
      and not coalesce((NEW.payload->>'exception'='dnp' and NEW.outcome='void' and NEW.payload->'observedValue'='null'::jsonb
        and NEW.payload->>'rawEvidence' is not null and market->>'termsVersion' ~ '^nba-points-ot-dnp-void-v1:[a-f0-9]{64}$'),false)) then raise exception 'V6 grade identity/evidence/revision invalid';end if;
  if NEW.outcome in ('won','lost','push') then
    if market->>'operator'='win' then
      if NEW.payload->>'winnerId' is null then raise exception 'Official winner identity required';end if;
      if p.payload#>'{forecast,inputs,team}' is not null and NEW.payload->>'winnerId' not in (p.payload#>>'{forecast,inputs,team,homeId}',p.payload#>>'{forecast,inputs,team,awayId}') then raise exception 'V6 winner outside exact fixture';end if;
      expected:=case when NEW.payload->>'winnerId'=market->>'subjectId' then 'won' else 'lost' end;
    else
      if jsonb_typeof(NEW.payload->'observedValue') is distinct from 'number' then raise exception 'Missing final statistic';end if;
      observed:=(NEW.payload->>'observedValue')::numeric;line:=(market->>'threshold')::numeric;
      if market->>'statistic' in ('points','rebounds','assists','threes','PRA','PR','PA','RA','games','sets')
        and (observed<0 or observed<>trunc(observed)) then raise exception 'Invalid final count statistic';end if;
      expected:=case when observed=line and market->>'operator' in ('gt','lt') then 'push'
        when (market->>'operator'='gt' and observed>line) or (market->>'operator'='gte' and observed>=line) or (market->>'operator'='lt' and observed<line) or (market->>'operator'='lte' and observed<=line) or (market->>'operator'='eq' and observed=line) then 'won' else 'lost' end;
    end if;
    if expected is distinct from NEW.outcome then raise exception 'V6 statistic/outcome mismatch';end if;
  end if;
  NEW.original_odds:=p.original_odds;NEW.recorded_at:=clock_timestamp();return NEW;
end$$;
create trigger v6_grade_guard before insert on public.v6_grade_revisions for each row execute function public.v6_check_grade();

create function public.v6_append_grade(expected_owner uuid,grade jsonb,original_position text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare p jsonb;old jsonb;begin
  if auth.uid() is null or auth.uid() is distinct from expected_owner then raise exception 'V6 authenticated owner changed';end if;
  select payload into old from public.v6_grade_revisions where user_id=auth.uid() and id=(grade->>'id')::uuid;
  if old is not null then if old is distinct from grade then raise exception 'V6 grade replay changed';end if;return old;end if;
  select payload into p from public.v6_positions where user_id=auth.uid() and id=(grade->>'positionId')::uuid;
  if p is distinct from original_position::jsonb or grade->>'positionHash' is distinct from encode(sha256(convert_to(original_position,'UTF8')),'hex') then raise exception 'V6 original position hash mismatch';end if;
  insert into public.v6_grade_revisions(user_id,id,position_id,revision,previous_grade_id,outcome,original_odds,payload,original_position)
    values(auth.uid(),(grade->>'id')::uuid,(grade->>'positionId')::uuid,(grade->>'revision')::integer,(grade->>'previousGradeId')::uuid,grade->>'outcome',1.0001,grade,original_position);
  return grade;
end$$;

create function public.v6_audit_insert() returns trigger language plpgsql security invoker set search_path='' as $$
begin insert into public.v6_audit(user_id,entity,payload) values(NEW.user_id,TG_TABLE_NAME,to_jsonb(NEW));return NEW;end$$;
do $$declare name text;begin
  foreach name in array array['v6_policies','v6_controls','v6_models','v6_observations','v6_positions','v6_grade_revisions','v6_runs','v6_outbox'] loop
    execute format('create trigger v6_audit after insert on public.%I for each row execute function public.v6_audit_insert()',name);
  end loop;
end$$;
create trigger v6_control_audit after update on public.v6_controls for each row execute function public.v6_audit_insert();
create function public.v6_check_quota() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if NEW.user_id is distinct from auth.uid()
    or NEW.period is distinct from to_char(clock_timestamp() at time zone 'UTC','YYYY-MM') then raise exception 'V6 quota owner/UTC period invalid';end if;
  if TG_OP='UPDATE' and (NEW.user_id is distinct from OLD.user_id or NEW.provider is distinct from OLD.provider
    or NEW.period is distinct from OLD.period or NEW.reserved<OLD.reserved) then raise exception 'V6 quota reservations cannot be rewound';end if;
  return NEW;
end$$;
create trigger v6_quota_guard before insert or update on public.v6_provider_quotas for each row execute function public.v6_check_quota();
create function public.v6_reserve_quota(expected_owner uuid,credits integer) returns integer language plpgsql security invoker set search_path='' as $$
declare total integer;begin
  if auth.uid() is null or auth.uid() is distinct from expected_owner then raise exception 'V6 authenticated owner changed';end if;
  if credits is null or credits<1 or credits>400 then raise exception 'V6 quota request invalid';end if;
  insert into public.v6_provider_quotas(user_id,provider,period,reserved)
    values(auth.uid(),'the-odds-api.com',to_char(clock_timestamp() at time zone 'UTC','YYYY-MM'),credits)
    on conflict(user_id,provider,period) do update set reserved=public.v6_provider_quotas.reserved+excluded.reserved
    returning reserved into total;
  return total;
end$$;
create function public.v6_paper_summary(expected_owner uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare profit bigint;pending bigint;turnover bigint;decisive_profit bigint;begin
  if auth.uid() is null or auth.uid() is distinct from expected_owner then raise exception 'V6 authenticated owner changed';end if;
  select coalesce(sum(g.profit_cents),0),coalesce(sum(case when g.outcome is null or g.outcome='unresolved' then p.stake_cents else 0 end),0),
    coalesce(sum(case when g.outcome in ('won','lost') then p.stake_cents else 0 end),0),coalesce(sum(case when g.outcome in ('won','lost') then g.profit_cents else 0 end),0)
    into profit,pending,turnover,decisive_profit
    from public.v6_positions p left join lateral(select outcome,profit_cents from public.v6_grade_revisions where user_id=p.user_id and position_id=p.id order by revision desc limit 1) g on true where p.user_id=auth.uid();
  return jsonb_build_object('openingReferenceCents',500000,'profitCents',profit,'equityCents',500000+profit,'pendingCents',pending,'availableCents',500000+profit-pending,'virtualExcessExposureCents',greatest(0,pending-500000-profit),'roi',case when turnover=0 then null else decisive_profit::numeric/turnover end);
end$$;
revoke all on function public.v6_sha256(text),public.v6_public_url(text),public.v6_valid_market(jsonb),public.v6_paper_summary(uuid),public.v6_immutable(),public.v6_check_position(),public.v6_register_paper(uuid,jsonb,text),public.v6_check_grade(),public.v6_append_grade(uuid,jsonb,text),public.v6_audit_insert(),public.v6_check_quota(),public.v6_reserve_quota(uuid,integer) from public,anon;
grant execute on function public.v6_sha256(text),public.v6_public_url(text),public.v6_valid_market(jsonb),public.v6_paper_summary(uuid),public.v6_immutable(),public.v6_check_position(),public.v6_register_paper(uuid,jsonb,text),public.v6_check_grade(),public.v6_append_grade(uuid,jsonb,text),public.v6_audit_insert(),public.v6_check_quota(),public.v6_reserve_quota(uuid,integer) to authenticated,edgelab_v6_worker;
-- Worker RPCs remain unusable by ordinary personal/service/anonymous tokens.
-- JWT issuance and authenticator role membership require separate provisioning.
create function public.v6_worker_identity(expected_owner uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
begin
  if current_user<>'edgelab_v6_worker' or auth.uid() is null or auth.uid() is distinct from expected_owner then raise exception 'V6 scoped worker identity required';end if;
  return jsonb_build_object('ownerId',auth.uid(),'role',current_user,'cohort','v6-prospective');
end$$;
create function public.v6_load_worker_state(expected_owner uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
begin
  perform public.v6_worker_identity(expected_owner);
  return jsonb_build_object('version',1,'ownerId',auth.uid(),'cohort','v6-prospective',
    'revision',(select count(*) from public.v6_runs where user_id=auth.uid()),
    'positions',coalesce((select jsonb_agg(payload order by registered_at,id) from public.v6_positions where user_id=auth.uid()),'[]'::jsonb),
    'grades',coalesce((select jsonb_agg(payload order by recorded_at,id) from public.v6_grade_revisions where user_id=auth.uid()),'[]'::jsonb),
    'runs',coalesce((select jsonb_agg(payload->'run' order by created_at,id) from public.v6_runs where user_id=auth.uid()),'[]'::jsonb));
end$$;
-- A single PostgreSQL transaction per worker run; never a V5 workspace overwrite.
create function public.v6_commit_worker_run(expected_owner uuid,expected_revision integer,run_snapshot jsonb,raw_sources jsonb,position_rows jsonb,grade_rows jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare row jsonb;o jsonb;saved jsonb;existing jsonb;raw text;position_text text;request_hash text;begin
  perform public.v6_worker_identity(expected_owner);
  perform pg_advisory_xact_lock(hashtextextended('edgelab-v6:'||auth.uid()::text,0));
  request_hash:=public.v6_sha256(jsonb_build_object('run',run_snapshot,'raw',raw_sources,'positions',position_rows,'grades',grade_rows)::text);
  select payload into existing from public.v6_runs where user_id=auth.uid() and run_key=run_snapshot->>'id';
  if existing is not null then
    if existing->'run' is distinct from run_snapshot or existing->>'requestHash' is distinct from request_hash then raise exception 'V6 worker replay changed';end if;
    return public.v6_load_worker_state(expected_owner);
  end if;
  if expected_revision is null or expected_revision<>(select count(*) from public.v6_runs where user_id=auth.uid()) then raise exception 'V6 concurrent run revision changed';end if;
  if jsonb_typeof(run_snapshot) is distinct from 'object' or nullif(run_snapshot->>'id','') is null or coalesce(run_snapshot->>'mode','') not in ('armed','dry_run')
    or jsonb_typeof(run_snapshot->'observations') is distinct from 'array' or jsonb_typeof(position_rows) is distinct from 'array' or jsonb_typeof(grade_rows) is distinct from 'array'
    or jsonb_typeof(raw_sources) is distinct from 'object' or nullif(run_snapshot->>'at','') is null or (run_snapshot->>'at')::timestamptz>clock_timestamp()
    or jsonb_typeof(run_snapshot->'rejections') is distinct from 'array' or jsonb_typeof(run_snapshot->'screened') is distinct from 'number'
    or jsonb_typeof(run_snapshot->'registered') is distinct from 'number' or (run_snapshot->>'registered')::integer<>jsonb_array_length(position_rows)
    or (run_snapshot->>'screened')::integer<jsonb_array_length(run_snapshot->'observations')
    or (run_snapshot->>'mode'='dry_run' and (jsonb_array_length(position_rows)>0 or jsonb_array_length(grade_rows)>0)) then raise exception 'V6 worker batch invalid';end if;
  -- Controls are rechecked under the database transaction before any insert.
  if run_snapshot->>'mode'='armed' and not exists(select 1 from public.v6_controls where user_id=auth.uid() and policy_id='v6-uncapped-paper-1' and enabled and not kill_switch) then raise exception 'V6 worker emergency stop';end if;
  for o in select value from jsonb_array_elements(run_snapshot->'observations') loop
    raw:=raw_sources->>(o->>'rawHash');
    if raw is null or public.v6_sha256(raw) is distinct from o->>'rawHash' then raise exception 'V6 worker source missing or changed';end if;
    select payload into existing from public.v6_observations where user_id=auth.uid() and id=(o->>'id')::uuid;
    if existing is not null then if existing is distinct from o then raise exception 'V6 observation replay changed';end if;
    else insert into public.v6_observations(user_id,id,raw_source,payload) values(auth.uid(),(o->>'id')::uuid,raw,o);end if;
  end loop;
  for row in select value from jsonb_array_elements(position_rows) loop
    if row#>>'{position,ownerId}' is distinct from auth.uid()::text or row#>>'{position,cohort}' is distinct from 'v6-prospective'
      or not exists(select 1 from jsonb_array_elements(run_snapshot->'observations') x where x->>'id'=row#>>'{position,observation,id}') then raise exception 'V6 batch position owner/source invalid';end if;
    saved:=public.v6_register_paper(expected_owner,row->'position',row->>'originalInputs');
    if saved->>'id' is distinct from row#>>'{position,id}' then raise exception 'V6 concurrent position changed; reread';end if;
  end loop;
  for row in select value from jsonb_array_elements(grade_rows) loop
    position_text:=row->>'originalPosition';
    perform public.v6_append_grade(expected_owner,row->'grade',position_text);
  end loop;
  insert into public.v6_runs(user_id,id,run_key,payload) values(auth.uid(),gen_random_uuid(),run_snapshot->>'id',jsonb_build_object('run',run_snapshot,'requestHash',request_hash));
  return public.v6_load_worker_state(expected_owner);
end$$;
revoke all on function public.v6_worker_identity(uuid),public.v6_load_worker_state(uuid),public.v6_commit_worker_run(uuid,integer,jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.v6_worker_identity(uuid),public.v6_load_worker_state(uuid),public.v6_commit_worker_run(uuid,integer,jsonb,jsonb,jsonb,jsonb) to edgelab_v6_worker;
-- Serialize owner emergency-stop updates against an in-flight worker batch.
create function public.v6_control_serialization() returns trigger language plpgsql security invoker set search_path='' as $$
begin perform pg_advisory_xact_lock(hashtextextended('edgelab-v6:'||NEW.user_id::text,0));return NEW;end$$;
create trigger v6_control_serialization before insert or update on public.v6_controls for each row execute function public.v6_control_serialization();
revoke all on function public.v6_control_serialization() from public,anon,edgelab_v6_worker;
grant execute on function public.v6_control_serialization() to authenticated;

-- Owner-issued opaque capabilities replace the need for a project JWT signer.
-- No authenticator membership, Auth account, service key or signing key is added.
create table public.v6_worker_credentials (
 user_id uuid not null references auth.users(id),id uuid not null default gen_random_uuid(),
 secret_hash text not null unique check(secret_hash ~ '^[a-f0-9]{64}$'),
 scope text not null check(scope in ('research_only','paper_worker')),
 created_at timestamptz not null default clock_timestamp(),expires_at timestamptz not null,
 revoked_at timestamptz,primary key(user_id,id),
 check(expires_at>created_at and expires_at<=created_at+interval '90 days')
);
alter table public.v6_worker_credentials enable row level security;
revoke all on public.v6_worker_credentials from public,anon,authenticated,edgelab_v6_worker;
grant select,insert,update on public.v6_worker_credentials to edgelab_v6_worker;
create policy v6_credential_lookup on public.v6_worker_credentials for select to edgelab_v6_worker using(true);
create policy v6_credential_issue on public.v6_worker_credentials for insert to edgelab_v6_worker with check(user_id=auth.uid());
create policy v6_credential_revoke on public.v6_worker_credentials for update to edgelab_v6_worker using(user_id=auth.uid()) with check(user_id=auth.uid());
create function public.v6_credential_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null or NEW.user_id is distinct from auth.uid() or coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role','')<>'authenticated' then raise exception 'V6 credential requires authenticated owner';end if;
 if TG_OP='UPDATE' and ((to_jsonb(NEW)-'revoked_at') is distinct from (to_jsonb(OLD)-'revoked_at') or OLD.revoked_at is not null or NEW.revoked_at is null) then raise exception 'V6 credential only permits irreversible revocation';end if;
 return NEW;
end$$;
create trigger v6_credential_guard before insert or update on public.v6_worker_credentials for each row execute function public.v6_credential_guard();
create trigger v6_credential_audit after insert or update on public.v6_worker_credentials for each row execute function public.v6_audit_insert();
revoke all on function public.v6_credential_guard() from public,anon,authenticated;
grant execute on function public.v6_credential_guard() to edgelab_v6_worker;

create function public.v6_issue_worker_credential(expected_owner uuid,capability_scope text default 'research_only',valid_hours integer default 720,rotate_from uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare token text;new_id uuid:=gen_random_uuid();expiry timestamptz;begin
 if auth.uid() is null or auth.uid() is distinct from expected_owner or coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role','')<>'authenticated' then raise exception 'V6 credential requires authenticated owner';end if;
 if capability_scope not in ('research_only','paper_worker') or capability_scope is null or valid_hours is null or valid_hours<1 or valid_hours>2160 then raise exception 'Invalid V6 credential scope or lifetime';end if;
 if rotate_from is not null then
  update public.v6_worker_credentials set revoked_at=clock_timestamp() where user_id=auth.uid() and id=rotate_from and revoked_at is null;
  if not found then raise exception 'V6 credential rotation rejected';end if;
 end if;
 token:='edgelab_v6_'||replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');expiry:=clock_timestamp()+valid_hours*interval '1 hour';
 insert into public.v6_worker_credentials(user_id,id,secret_hash,scope,expires_at) values(auth.uid(),new_id,public.v6_sha256(token),capability_scope,expiry);
 return jsonb_build_object('credentialId',new_id,'ownerId',auth.uid(),'credential',token,'scope',capability_scope,'expiresAt',expiry);
end$$;
create function public.v6_revoke_worker_credential(expected_owner uuid,credential_id uuid) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or auth.uid() is distinct from expected_owner or coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role','')<>'authenticated' then raise exception 'V6 credential requires authenticated owner';end if;
 update public.v6_worker_credentials set revoked_at=clock_timestamp() where user_id=auth.uid() and id=credential_id and revoked_at is null;return found;
end$$;
create function public.v6_list_worker_credentials(expected_owner uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or auth.uid() is distinct from expected_owner then raise exception 'V6 credential requires authenticated owner';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('credentialId',id,'scope',scope,'createdAt',created_at,'expiresAt',expires_at,'revokedAt',revoked_at) order by created_at) from public.v6_worker_credentials where user_id=auth.uid()),'[]'::jsonb);
end$$;
create function public.v6_worker_access(expected_owner uuid,credential text,operation text,request jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.v6_worker_credentials;result jsonb;old_sub text:=current_setting('request.jwt.claim.sub',true);old_claims text:=current_setting('request.jwt.claims',true);begin
 if credential is null or credential !~ '^edgelab_v6_[a-f0-9]{64}$' then raise exception 'V6 worker credential rejected';end if;
 select * into c from public.v6_worker_credentials where secret_hash=public.v6_sha256(credential) and user_id=expected_owner and revoked_at is null and expires_at>clock_timestamp();
 if c.id is null then raise exception 'V6 worker credential rejected';end if;
 if operation not in ('identity','load','commit') or operation is null then raise exception 'V6 worker operation rejected';end if;
 if operation='commit' and c.scope='research_only' and (request#>>'{run_snapshot,mode}' is distinct from 'dry_run' or request->'position_rows' is distinct from '[]'::jsonb or request->'grade_rows' is distinct from '[]'::jsonb) then raise exception 'V6 read-only credential cannot register or grade';end if;
 -- RLS owner is bound by the stored capability, never a caller-supplied claim.
 perform set_config('request.jwt.claim.sub',c.user_id::text,true);
 perform set_config('request.jwt.claims',jsonb_set(coalesce(nullif(old_claims,'')::jsonb,'{}'::jsonb),'{sub}',to_jsonb(c.user_id::text))::text,true);
 -- Match the control-update lock order before taking the credential row lock.
 if operation='commit' then perform pg_advisory_xact_lock(hashtextextended('edgelab-v6:'||c.user_id::text,0));end if;
 select * into c from public.v6_worker_credentials where secret_hash=public.v6_sha256(credential) and user_id=expected_owner and revoked_at is null and expires_at>clock_timestamp() for share;
 if c.id is null then raise exception 'V6 worker credential rejected';end if;
 if operation='identity' then result:=public.v6_worker_identity(c.user_id);
 elsif operation='load' then result:=public.v6_load_worker_state(c.user_id);
 else
  result:=public.v6_commit_worker_run(c.user_id,(request->>'expected_revision')::integer,request->'run_snapshot',request->'raw_sources',request->'position_rows',request->'grade_rows');
  insert into public.v6_audit(user_id,entity,payload) values(c.user_id,'v6_worker_access',jsonb_build_object('credentialId',c.id,'runKey',request#>>'{run_snapshot,id}'));
 end if;
 if c.expires_at<=clock_timestamp() then raise exception 'V6 worker credential rejected';end if;
 perform set_config('request.jwt.claim.sub',coalesce(old_sub,''),true);perform set_config('request.jwt.claims',coalesce(old_claims,''),true);return result;
exception when others then
 perform set_config('request.jwt.claim.sub',coalesce(old_sub,''),true);perform set_config('request.jwt.claims',coalesce(old_claims,''),true);raise;
end$$;
-- A non-login, non-owner-of-tables role executes only these narrow definer APIs.
-- CREATE is needed solely for ownership transfer and is revoked before COMMIT.
grant create on schema public to edgelab_v6_worker;
alter function public.v6_issue_worker_credential(uuid,text,integer,uuid) owner to edgelab_v6_worker;
alter function public.v6_revoke_worker_credential(uuid,uuid) owner to edgelab_v6_worker;
alter function public.v6_list_worker_credentials(uuid) owner to edgelab_v6_worker;
alter function public.v6_worker_access(uuid,text,text,jsonb) owner to edgelab_v6_worker;
revoke create on schema public from edgelab_v6_worker;
revoke all on function public.v6_issue_worker_credential(uuid,text,integer,uuid),public.v6_revoke_worker_credential(uuid,uuid),public.v6_list_worker_credentials(uuid),public.v6_worker_access(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.v6_issue_worker_credential(uuid,text,integer,uuid),public.v6_revoke_worker_credential(uuid,uuid),public.v6_list_worker_credentials(uuid) to authenticated;
grant execute on function public.v6_worker_access(uuid,text,text,jsonb) to anon;
-- Supabase installations can have additional default function ACLs. Remove
-- privileged default grants on the definer surface without touching old APIs.
do $$begin if exists(select 1 from pg_roles where rolname='service_role') then
 revoke all on function public.v6_issue_worker_credential(uuid,text,integer,uuid),public.v6_revoke_worker_credential(uuid,uuid),public.v6_list_worker_credentials(uuid),public.v6_worker_access(uuid,text,text,jsonb) from service_role;
end if;end$$;
commit;
