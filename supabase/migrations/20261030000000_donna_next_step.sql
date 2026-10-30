-- DON-02 follow-up: store the operator's "Next step" in its own column.
--
-- Why: `original_input` must stay byte-for-byte what the operator typed. Any
-- encoding of a second field inside it can collide with a legacy note, so the
-- next step gets a real, nullable column and its own RPC key instead.
--
-- Backward compatible and safe to apply once:
--   * adds ONE nullable column (existing rows keep NULL = "no next step");
--   * `original_input` and every other column and rule are unchanged;
--   * donna_record_event accepts an OPTIONAL `next_step` key; callers that do
--     not send it behave exactly as before;
--   * the append-only, one-outcome-per-call, RLS and grant rules are untouched
--     (the existing table-level SELECT grant covers the new column).
-- Apply AFTER 20261025000000_donna_durable_records.sql. Do not run twice.

begin;

alter table public.donna_events add column next_step text;

alter table public.donna_events drop constraint donna_events_outcome_shape;
alter table public.donna_events
  add constraint donna_events_outcome_shape check (coalesce(
    case when type = 'OUTCOME_RECORDED' then
      outcome in ('SPOKE', 'NO_ANSWER', 'DID_NOT_CALL', 'CANCELLED')
      and original_input is not null and char_length(original_input) <= 2000
      and (next_step is null or (char_length(next_step) <= 2000 and outcome <> 'CANCELLED'))
      and (
        (next_action_kind is null and follow_up_date is null and appointment_at is null and client_confirmed is null)
        or (next_action_kind = 'INTERNAL_FOLLOW_UP' and follow_up_date is not null
            and appointment_at is null and client_confirmed is null and outcome <> 'CANCELLED')
        or (next_action_kind = 'CLIENT_CONFIRMED_APPOINTMENT' and appointment_at is not null
            and appointment_at > at and client_confirmed is true and follow_up_date is null
            and outcome = 'SPOKE')
      )
    else
      outcome is null and original_input is null and next_step is null and next_action_kind is null
      and follow_up_date is null and appointment_at is null and client_confirmed is null
    end, false));

create function public.donna_compare_existing(
  e public.donna_events, p_call text, p_type text, p_at timestamptz, p_until timestamptz,
  p_outcome text, p_input text, p_kind text, p_date date, p_appt timestamptz, p_confirmed boolean, p_next_step text
) returns jsonb
language plpgsql immutable set search_path = public, pg_temp as $$
begin
  if e.call_id is not distinct from p_call and e.type is not distinct from p_type
     and e.at is not distinct from p_at and e.until is not distinct from p_until
     and e.outcome is not distinct from p_outcome and e.original_input is not distinct from p_input
     and e.next_action_kind is not distinct from p_kind and e.follow_up_date is not distinct from p_date
     and e.appointment_at is not distinct from p_appt and e.client_confirmed is not distinct from p_confirmed
     and e.next_step is not distinct from p_next_step then
    return jsonb_build_object('status', 'DUPLICATE', 'seq', e.seq);
  end if;
  raise exception using errcode = 'P0001', message = 'DONNA_EVENT_ID_REUSED';
end $$;

create or replace function public.donna_record_event(p_event jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_owner uuid := public.donna_caller();
  v_event_id uuid; v_call text; v_type text; v_at timestamptz; v_until timestamptz;
  v_outcome text; v_input text; v_next_step text; v_kind text; v_date date; v_appt timestamptz; v_confirmed boolean;
  v_existing public.donna_events;
  v_constraint text;
begin
  perform public.donna_require_keys(
    p_event,
    array['event_id', 'call_id', 'type', 'at', 'until', 'outcome', 'original_input',
          'next_action_kind', 'follow_up_date', 'appointment_at', 'client_confirmed', 'next_step'],
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
  v_next_step := public.donna_json_text(p_event, 'next_step');
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
                                         v_kind, v_date, v_appt, v_confirmed, v_next_step);
  end if;

  begin
    insert into public.donna_events
      (owner_id, event_id, call_id, type, at, until, outcome, original_input,
       next_action_kind, follow_up_date, appointment_at, client_confirmed, next_step)
    values
      (v_owner, v_event_id, v_call, v_type, v_at, v_until, v_outcome, v_input,
       v_kind, v_date, v_appt, v_confirmed, v_next_step)
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
                                               v_kind, v_date, v_appt, v_confirmed, v_next_step);
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
                                           v_kind, v_date, v_appt, v_confirmed, v_next_step);
  end;
  return jsonb_build_object('status', 'CREATED', 'seq', v_existing.seq);
end $$;

drop function public.donna_compare_existing(
  public.donna_events, text, text, timestamptz, timestamptz, text, text, text, date, timestamptz, boolean);

revoke all on function
  public.donna_compare_existing(public.donna_events, text, text, timestamptz, timestamptz, text, text, text, date, timestamptz, boolean, text),
  public.donna_record_event(jsonb)
  from public, anon, authenticated;
grant execute on function public.donna_record_event(jsonb) to authenticated;

commit;
