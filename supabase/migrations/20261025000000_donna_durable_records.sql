-- DON-02: durable, authenticated Donna records (single owner, synthetic data only).
--
-- Apply to a DEDICATED Supabase project: the sign-up guard below applies to
-- every user of the project. Rules enforced here, in the database:
--   * only allow-listed emails can ever become users (server-side, not UI);
--   * rows are owned (owner_id = auth.uid()) and isolated by row-level security;
--   * donna_events is append-only (no update, delete or truncate, for anyone);
--   * writes go only through donna_upsert_call / donna_record_event, which
--     validate type, payload, call reference, time and outcome consistency;
--   * one outcome per call (unique index), with a retry (same event_id and
--     content) distinguished from a conflicting second outcome;
--   * client ids are pseudonymous (cl-...), so real names are not storable there.

-- ---------------------------------------------------------------- allowlist
create table public.donna_allowed_emails (
  email text primary key check (email = lower(email) and email ~ '^[^@[:space:]]+@[^@[:space:]]+$')
);
alter table public.donna_allowed_emails enable row level security;
revoke all on public.donna_allowed_emails from public, anon, authenticated;

create function public.donna_block_unlisted_user() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from public.donna_allowed_emails a where a.email = lower(coalesce(new.email, ''))) then
    raise exception using errcode = 'P0001', message = 'DONNA_SIGNUP_NOT_ALLOWED';
  end if;
  return new;
end $$;
revoke all on function public.donna_block_unlisted_user() from public, anon, authenticated;

create trigger donna_block_unlisted_signup before insert on auth.users
  for each row execute function public.donna_block_unlisted_user();
create trigger donna_block_unlisted_email_change before update of email on auth.users
  for each row when (new.email is distinct from old.email)
  execute function public.donna_block_unlisted_user();

create function public.donna_is_allowed() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from auth.users u
    join public.donna_allowed_emails a on a.email = lower(u.email)
    where u.id = auth.uid()
  );
$$;
revoke all on function public.donna_is_allowed() from public, anon;
grant execute on function public.donna_is_allowed() to authenticated;

-- ------------------------------------------------------------------- tables
create table public.donna_calls (
  owner_id   uuid not null references auth.users (id) on delete restrict,
  id         text not null check (id ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  client_id  text not null check (client_id ~ '^cl-[a-z0-9-]{1,40}$'),
  due_at     timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (owner_id, id)
);

create table public.donna_events (
  seq              bigint generated always as identity unique,
  owner_id         uuid not null references auth.users (id) on delete restrict,
  event_id         uuid not null,
  call_id          text not null,
  type             text not null,
  at               timestamptz not null,
  until            timestamptz,
  outcome          text,
  original_input   text,
  next_action_kind text,
  follow_up_date   date,
  appointment_at   timestamptz,
  client_confirmed boolean,
  created_at       timestamptz not null default now(),
  constraint donna_events_pkey primary key (owner_id, event_id),
  constraint donna_events_call_fk foreign key (owner_id, call_id)
    references public.donna_calls (owner_id, id) on delete restrict,
  constraint donna_events_type_valid check
    (type in ('QUESTION_DISMISSED', 'TASK_MARKED_DONE', 'SNOOZED', 'OUTCOME_RECORDED')),
  constraint donna_events_snooze_shape check
    ((type = 'SNOOZED') = (until is not null)),
  -- coalesce(..., false): a CHECK passes on NULL, so make unknown fail closed.
  constraint donna_events_outcome_shape check (coalesce(
    case when type = 'OUTCOME_RECORDED' then
      outcome in ('SPOKE', 'NO_ANSWER', 'DID_NOT_CALL', 'CANCELLED')
      and original_input is not null and char_length(original_input) <= 2000
      and (
        (next_action_kind is null and follow_up_date is null and appointment_at is null and client_confirmed is null)
        or (next_action_kind = 'INTERNAL_FOLLOW_UP' and follow_up_date is not null
            and appointment_at is null and client_confirmed is null and outcome <> 'CANCELLED')
        or (next_action_kind = 'CLIENT_CONFIRMED_APPOINTMENT' and appointment_at is not null
            and appointment_at > at and client_confirmed is true and follow_up_date is null
            and outcome = 'SPOKE')
      )
    else
      outcome is null and original_input is null and next_action_kind is null
      and follow_up_date is null and appointment_at is null and client_confirmed is null
    end, false))
);
-- Exactly one outcome per call, enforced by the database.
create unique index donna_events_one_outcome_per_call
  on public.donna_events (owner_id, call_id) where type = 'OUTCOME_RECORDED';
create index donna_events_owner_seq on public.donna_events (owner_id, seq);

-- ----------------------------------------------------- rules (single source)
create function public.donna_validate_event() returns trigger
language plpgsql set search_path = public, pg_temp as $$
declare
  v_due timestamptz;
begin
  select c.due_at into v_due from public.donna_calls c
   where c.owner_id = new.owner_id and c.id = new.call_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'DONNA_UNKNOWN_CALL';
  end if;
  -- Future evidence is excluded (1 minute of clock skew tolerated).
  if new.at > clock_timestamp() + interval '1 minute' then
    raise exception using errcode = 'P0001', message = 'DONNA_FUTURE_EVENT';
  end if;
  if new.type <> 'TASK_MARKED_DONE' and new.at < v_due then
    raise exception using errcode = 'P0001', message = 'DONNA_NOT_YET_DUE';
  end if;
  if exists (select 1 from public.donna_events e
              where e.owner_id = new.owner_id and e.call_id = new.call_id
                and e.type = 'OUTCOME_RECORDED') then
    raise exception using errcode = 'P0001', message = 'DONNA_ALREADY_RESOLVED';
  end if;

  if new.type = 'SNOOZED' then
    if new.until is null then
      raise exception using errcode = 'P0001', message = 'DONNA_INVALID_PAYLOAD';
    end if;
    if new.until <= new.at then
      raise exception using errcode = 'P0001', message = 'DONNA_SNOOZE_NOT_IN_FUTURE';
    end if;
    if new.until > new.at + interval '366 days' then
      raise exception using errcode = 'P0001', message = 'DONNA_INVALID_PAYLOAD';
    end if;
  elsif new.type = 'OUTCOME_RECORDED' then
    if new.next_action_kind is not null and new.outcome = 'CANCELLED' then
      raise exception using errcode = 'P0001', message = 'DONNA_NEXT_ACTION_NOT_ALLOWED_FOR_OUTCOME';
    end if;
    if new.next_action_kind = 'CLIENT_CONFIRMED_APPOINTMENT' then
      if new.outcome is distinct from 'SPOKE' then
        raise exception using errcode = 'P0001', message = 'DONNA_APPOINTMENT_REQUIRES_SPOKE';
      end if;
      if new.client_confirmed is distinct from true then
        raise exception using errcode = 'P0001', message = 'DONNA_APPOINTMENT_NOT_CONFIRMED';
      end if;
      if new.appointment_at is null then
        raise exception using errcode = 'P0001', message = 'DONNA_INVALID_INSTANT';
      end if;
      if new.appointment_at <= new.at then
        raise exception using errcode = 'P0001', message = 'DONNA_APPOINTMENT_NOT_IN_FUTURE';
      end if;
      if new.appointment_at > new.at + interval '732 days' then
        raise exception using errcode = 'P0001', message = 'DONNA_INVALID_PAYLOAD';
      end if;
    elsif new.next_action_kind = 'INTERNAL_FOLLOW_UP' then
      if new.follow_up_date is null then
        raise exception using errcode = 'P0001', message = 'DONNA_FOLLOW_UP_DATE_INVALID';
      end if;
      -- The owner's time zone is Africa/Cairo; the browser applies the exact
      -- local-date rule, the database only rejects clearly past or absurd dates.
      if new.follow_up_date < (new.at at time zone 'UTC')::date - 1 then
        raise exception using errcode = 'P0001', message = 'DONNA_FOLLOW_UP_DATE_IN_PAST';
      end if;
      if new.follow_up_date > (new.at at time zone 'UTC')::date + 366 then
        raise exception using errcode = 'P0001', message = 'DONNA_INVALID_PAYLOAD';
      end if;
    elsif new.next_action_kind is not null then
      raise exception using errcode = 'P0001', message = 'DONNA_INVALID_PAYLOAD';
    end if;
  end if;
  return new;
end $$;

create trigger donna_events_validate before insert on public.donna_events
  for each row execute function public.donna_validate_event();

create function public.donna_reject_change() returns trigger
language plpgsql as $$
begin
  raise exception using errcode = 'P0001', message = 'DONNA_APPEND_ONLY';
end $$;

create trigger donna_events_append_only before update or delete on public.donna_events
  for each row execute function public.donna_reject_change();
create trigger donna_events_no_truncate before truncate on public.donna_events
  for each statement execute function public.donna_reject_change();
create trigger donna_calls_immutable before update or delete on public.donna_calls
  for each row execute function public.donna_reject_change();
create trigger donna_calls_no_truncate before truncate on public.donna_calls
  for each statement execute function public.donna_reject_change();

-- ------------------------------------------------- row-level security (read)
alter table public.donna_calls enable row level security;
alter table public.donna_events enable row level security;
revoke all on public.donna_calls, public.donna_events from public, anon, authenticated;
grant select on public.donna_calls, public.donna_events to authenticated;

create policy donna_calls_owner_read on public.donna_calls for select to authenticated
  using (owner_id = auth.uid() and public.donna_is_allowed());
create policy donna_events_owner_read on public.donna_events for select to authenticated
  using (owner_id = auth.uid() and public.donna_is_allowed());

-- ----------------------------------------------------------- JSON helpers
create function public.donna_json_text(p jsonb, k text) returns text
language plpgsql immutable set search_path = public, pg_temp as $$
begin
  if p -> k is null or jsonb_typeof(p -> k) = 'null' then return null; end if;
  if jsonb_typeof(p -> k) <> 'string' then
    raise exception using errcode = 'P0001', message = 'DONNA_INVALID_PAYLOAD';
  end if;
  return p ->> k;
end $$;

create function public.donna_json_instant(p jsonb, k text) returns timestamptz
language plpgsql stable set search_path = public, pg_temp as $$
declare v text := public.donna_json_text(p, k);
begin
  if v is null then return null; end if;
  -- An explicit offset is mandatory: no session-time-zone guessing.
  if v !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$' then
    raise exception using errcode = 'P0001', message = 'DONNA_INVALID_INSTANT';
  end if;
  return v::timestamptz;
exception when data_exception then
  raise exception using errcode = 'P0001', message = 'DONNA_INVALID_INSTANT';
end $$;

create function public.donna_json_date(p jsonb, k text) returns date
language plpgsql immutable set search_path = public, pg_temp as $$
declare v text := public.donna_json_text(p, k);
begin
  if v is null then return null; end if;
  if v !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception using errcode = 'P0001', message = 'DONNA_FOLLOW_UP_DATE_INVALID';
  end if;
  return v::date;
exception when data_exception then
  raise exception using errcode = 'P0001', message = 'DONNA_FOLLOW_UP_DATE_INVALID';
end $$;

create function public.donna_require_keys(p jsonb, allowed text[], required text[]) returns void
language plpgsql immutable set search_path = public, pg_temp as $$
declare k text;
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    raise exception using errcode = 'P0001', message = 'DONNA_INVALID_PAYLOAD';
  end if;
  for k in select jsonb_object_keys(p) loop
    if not (k = any (allowed)) then
      raise exception using errcode = 'P0001', message = 'DONNA_INVALID_PAYLOAD';
    end if;
  end loop;
  foreach k in array required loop
    if not (p ? k) or jsonb_typeof(p -> k) = 'null' then
      raise exception using errcode = 'P0001', message = 'DONNA_INVALID_PAYLOAD';
    end if;
  end loop;
end $$;

create function public.donna_caller() returns uuid
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v uuid := auth.uid();
begin
  if v is null then
    raise exception using errcode = 'P0001', message = 'DONNA_NOT_SIGNED_IN';
  end if;
  if not public.donna_is_allowed() then
    raise exception using errcode = 'P0001', message = 'DONNA_NOT_ALLOWED';
  end if;
  return v;
end $$;

-- ------------------------------------------------------------------- writes
create function public.donna_upsert_call(p_call jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_owner uuid := public.donna_caller();
  v_id text; v_client text; v_due timestamptz;
  v_existing public.donna_calls;
begin
  perform public.donna_require_keys(p_call, array['id', 'client_id', 'due_at'], array['id', 'client_id', 'due_at']);
  v_id := public.donna_json_text(p_call, 'id');
  v_client := public.donna_json_text(p_call, 'client_id');
  v_due := public.donna_json_instant(p_call, 'due_at');
  begin
    insert into public.donna_calls (owner_id, id, client_id, due_at)
    values (v_owner, v_id, v_client, v_due)
    on conflict (owner_id, id) do nothing;
  exception when check_violation then
    raise exception using errcode = 'P0001', message = 'DONNA_INVALID_PAYLOAD';
  end;
  if found then return jsonb_build_object('status', 'CREATED'); end if;
  select * into v_existing from public.donna_calls where owner_id = v_owner and id = v_id;
  if v_existing.client_id = v_client and v_existing.due_at = v_due then
    return jsonb_build_object('status', 'DUPLICATE');
  end if;
  raise exception using errcode = 'P0001', message = 'DONNA_CALL_CONFLICT';
end $$;

create function public.donna_record_event(p_event jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_owner uuid := public.donna_caller();
  v_event_id uuid; v_call text; v_type text; v_at timestamptz; v_until timestamptz;
  v_outcome text; v_input text; v_kind text; v_date date; v_appt timestamptz; v_confirmed boolean;
  v_existing public.donna_events;
  v_constraint text;
begin
  perform public.donna_require_keys(
    p_event,
    array['event_id', 'call_id', 'type', 'at', 'until', 'outcome', 'original_input',
          'next_action_kind', 'follow_up_date', 'appointment_at', 'client_confirmed'],
    array['event_id', 'call_id', 'type', 'at']);

  begin
    v_event_id := public.donna_json_text(p_event, 'event_id')::uuid;
  exception when data_exception then
    raise exception using errcode = 'P0001', message = 'DONNA_INVALID_PAYLOAD';
  end;
  v_call := public.donna_json_text(p_event, 'call_id');
  v_type := public.donna_json_text(p_event, 'type');
  v_at := public.donna_json_instant(p_event, 'at');
  v_until := public.donna_json_instant(p_event, 'until');
  v_outcome := public.donna_json_text(p_event, 'outcome');
  v_input := public.donna_json_text(p_event, 'original_input');
  v_kind := public.donna_json_text(p_event, 'next_action_kind');
  v_date := public.donna_json_date(p_event, 'follow_up_date');
  v_appt := public.donna_json_instant(p_event, 'appointment_at');
  if p_event ? 'client_confirmed' and jsonb_typeof(p_event -> 'client_confirmed') <> 'null' then
    if jsonb_typeof(p_event -> 'client_confirmed') <> 'boolean' then
      raise exception using errcode = 'P0001', message = 'DONNA_INVALID_PAYLOAD';
    end if;
    v_confirmed := (p_event ->> 'client_confirmed')::boolean;
  end if;

  -- Retry of an event we already hold: same content is a duplicate, anything
  -- else under the same event_id is a conflict.
  select * into v_existing from public.donna_events where owner_id = v_owner and event_id = v_event_id;
  if found then
    return public.donna_compare_existing(v_existing, v_call, v_type, v_at, v_until, v_outcome, v_input,
                                         v_kind, v_date, v_appt, v_confirmed);
  end if;

  begin
    insert into public.donna_events
      (owner_id, event_id, call_id, type, at, until, outcome, original_input,
       next_action_kind, follow_up_date, appointment_at, client_confirmed)
    values
      (v_owner, v_event_id, v_call, v_type, v_at, v_until, v_outcome, v_input,
       v_kind, v_date, v_appt, v_confirmed)
    returning * into v_existing;
  exception
    when check_violation then
      raise exception using errcode = 'P0001', message = 'DONNA_INVALID_PAYLOAD';
    when foreign_key_violation then
      raise exception using errcode = 'P0001', message = 'DONNA_UNKNOWN_CALL';
    when raise_exception then
      -- A concurrent identical retry may have committed between our lookup and
      -- the validation trigger: recognise it by event_id before reporting a conflict.
      if sqlerrm = 'DONNA_ALREADY_RESOLVED' then
        select * into v_existing from public.donna_events where owner_id = v_owner and event_id = v_event_id;
        if found then
          return public.donna_compare_existing(v_existing, v_call, v_type, v_at, v_until, v_outcome, v_input,
                                               v_kind, v_date, v_appt, v_confirmed);
        end if;
      end if;
      raise;
    when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'donna_events_one_outcome_per_call' then
        -- A different event_id tried to record a second outcome for this call.
        raise exception using errcode = 'P0001', message = 'DONNA_ALREADY_RESOLVED';
      end if;
      -- A concurrent retry with the same event_id won the race.
      select * into v_existing from public.donna_events where owner_id = v_owner and event_id = v_event_id;
      return public.donna_compare_existing(v_existing, v_call, v_type, v_at, v_until, v_outcome, v_input,
                                           v_kind, v_date, v_appt, v_confirmed);
  end;
  return jsonb_build_object('status', 'CREATED', 'seq', v_existing.seq);
end $$;

create function public.donna_compare_existing(
  e public.donna_events, p_call text, p_type text, p_at timestamptz, p_until timestamptz,
  p_outcome text, p_input text, p_kind text, p_date date, p_appt timestamptz, p_confirmed boolean
) returns jsonb
language plpgsql immutable set search_path = public, pg_temp as $$
begin
  if e.call_id is not distinct from p_call and e.type is not distinct from p_type
     and e.at is not distinct from p_at and e.until is not distinct from p_until
     and e.outcome is not distinct from p_outcome and e.original_input is not distinct from p_input
     and e.next_action_kind is not distinct from p_kind and e.follow_up_date is not distinct from p_date
     and e.appointment_at is not distinct from p_appt and e.client_confirmed is not distinct from p_confirmed then
    return jsonb_build_object('status', 'DUPLICATE', 'seq', e.seq);
  end if;
  raise exception using errcode = 'P0001', message = 'DONNA_EVENT_ID_REUSED';
end $$;

revoke all on function
  public.donna_json_text(jsonb, text), public.donna_json_instant(jsonb, text),
  public.donna_json_date(jsonb, text), public.donna_require_keys(jsonb, text[], text[]),
  public.donna_caller(), public.donna_upsert_call(jsonb), public.donna_record_event(jsonb),
  public.donna_compare_existing(public.donna_events, text, text, timestamptz, timestamptz, text, text, text, date, timestamptz, boolean),
  public.donna_validate_event(), public.donna_reject_change()
  from public, anon, authenticated;
grant execute on function public.donna_upsert_call(jsonb), public.donna_record_event(jsonb) to authenticated;
