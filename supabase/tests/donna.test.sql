\set ON_ERROR_STOP on
\set QUIET on
-- Fixed ids for the two synthetic accounts.
\set uid_a '11111111-1111-1111-1111-111111111111'
\set uid_b '22222222-2222-2222-2222-222222222222'

select t.reset();
insert into public.donna_allowed_emails values ('owner-a@example.test'), ('owner-b@example.test');

-- 1. Server-side allowlist ----------------------------------------------------
select t.raises($q$insert into auth.users (id, email) values (gen_random_uuid(), 'stranger@example.test')$q$,
  'DONNA_SIGNUP_NOT_ALLOWED', 'signup of an unlisted email is rejected by the database');
select t.raises($q$insert into auth.users (id, email) values (gen_random_uuid(), null)$q$,
  'DONNA_SIGNUP_NOT_ALLOWED', 'signup without an email is rejected');
insert into auth.users (id, email) values (:'uid_a', 'Owner-A@Example.test');   -- case-insensitive match
insert into auth.users (id, email) values (:'uid_b', 'owner-b@example.test');
select t.ok(true, 'allow-listed emails (any case) can be created');
select t.raises($q$update auth.users set email = 'stranger@example.test' where id = '11111111-1111-1111-1111-111111111111'$q$,
  'DONNA_SIGNUP_NOT_ALLOWED', 'changing a user email to an unlisted one is rejected');

-- 2. Roles that must not reach the data ------------------------------------------
select t.become_anon();
select t.raises('select * from public.donna_calls', 'permission denied', 'anon cannot read calls');
select t.raises('select * from public.donna_events', 'permission denied', 'anon cannot read events');
select t.raises($q$select public.donna_record_event('{}'::jsonb)$q$, 'permission denied', 'anon cannot call the write function');
select t.raises('select * from public.donna_allowed_emails', 'permission denied', 'anon cannot read the allowlist');
select t.become_signed_out();
select t.raises($q$select public.donna_upsert_call('{"id":"x","client_id":"cl-x","due_at":"2026-01-01T00:00:00Z"}'::jsonb)$q$,
  'DONNA_NOT_SIGNED_IN', 'a token without a user cannot write');
select t.reset();

-- 3. Calls: ownership, idempotency, conflicts, pseudonymous client ids -----------
select t.become(:'uid_a', 'owner-a@example.test');
select t.raises('select * from public.donna_allowed_emails', 'permission denied', 'authenticated users cannot read the allowlist');
do $$
declare v_due text := t.iso('-2 hours'); r jsonb;
begin
  perform set_config('t.due', v_due, false);
  r := public.donna_upsert_call(jsonb_build_object('id', 'call-1', 'client_id', 'cl-alpha', 'due_at', v_due));
  perform t.eq(r ->> 'status', 'CREATED', 'call is created');
  r := public.donna_upsert_call(jsonb_build_object('id', 'call-1', 'client_id', 'cl-alpha', 'due_at', v_due));
  perform t.eq(r ->> 'status', 'DUPLICATE', 'repeating the same call is a duplicate, not a second task');
  perform t.raises(format($q$select public.donna_upsert_call('{"id":"call-1","client_id":"cl-alpha","due_at":"%s"}'::jsonb)$q$, t.iso('-1 hour')),
    'DONNA_CALL_CONFLICT', 'same call id with different content is a conflict');
  perform t.raises($q$select public.donna_upsert_call('{"id":"call-9","client_id":"Ahmed Hassan","due_at":"2026-01-01T00:00:00Z"}'::jsonb)$q$,
    'DONNA_INVALID_PAYLOAD', 'a real-looking client name is not storable (pseudonymous ids only)');
  perform t.raises($q$select public.donna_upsert_call('{"id":"Bad Id!","client_id":"cl-x","due_at":"2026-01-01T00:00:00Z"}'::jsonb)$q$,
    'DONNA_INVALID_PAYLOAD', 'invalid call id is rejected');
  perform t.raises($q$select public.donna_upsert_call('{"id":"call-9","client_id":"cl-x","due_at":"2026-01-01T00:00:00"}'::jsonb)$q$,
    'DONNA_INVALID_INSTANT', 'a timestamp without an offset is rejected');
  perform t.raises($q$select public.donna_upsert_call('{"id":"call-9","client_id":"cl-x","due_at":"2026-01-01T00:00:00Z","owner_id":"22222222-2222-2222-2222-222222222222"}'::jsonb)$q$,
    'DONNA_INVALID_PAYLOAD', 'a caller cannot supply an owner_id');
  perform t.raises($q$select public.donna_upsert_call('{"id":"call-9"}'::jsonb)$q$, 'DONNA_INVALID_PAYLOAD', 'missing keys are rejected');
  r := public.donna_upsert_call(jsonb_build_object('id', 'call-future', 'client_id', 'cl-beta', 'due_at', t.iso('+3 hours')));
  perform t.eq(r ->> 'status', 'CREATED', 'a future planned call can be created');
end $$;
select t.raises($q$insert into public.donna_calls (owner_id, id, client_id, due_at) values ('11111111-1111-1111-1111-111111111111', 'direct', 'cl-x', now())$q$,
  'permission denied', 'direct inserts into calls are denied');

-- 4. Invalid events are rejected by the database ----------------------------------
do $$
declare
  due text := current_setting('t.due');
  at_ok text := t.iso('-1 hour');
  ev uuid := gen_random_uuid();
  function_call text := 'select public.donna_record_event(%L::jsonb)';
  base jsonb;
begin
  base := jsonb_build_object('event_id', ev, 'call_id', 'call-1', 'at', at_ok);
  perform t.raises(format(function_call, (base || '{"type":"BOGUS"}')::text), 'DONNA_INVALID_PAYLOAD', 'unknown event type');
  perform t.raises(format(function_call, (base || '{"type":"SNOOZED","until":"2999-01-01T00:00:00Z","extra":1}')::text), 'DONNA_INVALID_PAYLOAD', 'unknown payload key');
  perform t.raises(format(function_call, '{"call_id":"call-1","type":"QUESTION_DISMISSED","at":"2026-01-01T00:00:00Z"}'), 'DONNA_INVALID_PAYLOAD', 'missing event_id');
  perform t.raises(format(function_call, '{"event_id":"not-a-uuid","call_id":"call-1","type":"QUESTION_DISMISSED","at":"2026-01-01T00:00:00Z"}'), 'DONNA_INVALID_PAYLOAD', 'bad event_id');
  perform t.raises(format(function_call, '[]'), 'DONNA_INVALID_PAYLOAD', 'payload must be an object');
  perform t.raises(format(function_call, (base || '{"type":"QUESTION_DISMISSED","call_id":"nope"}')::text), 'DONNA_UNKNOWN_CALL', 'event for a call that does not exist');
  perform t.raises(format(function_call, (jsonb_build_object('event_id', gen_random_uuid(), 'call_id', 'call-1', 'type', 'QUESTION_DISMISSED', 'at', t.iso('+10 minutes')))::text), 'DONNA_FUTURE_EVENT', 'future-dated event');
  perform t.raises(format(function_call, (jsonb_build_object('event_id', gen_random_uuid(), 'call_id', 'call-future', 'type', 'QUESTION_DISMISSED', 'at', t.iso('-1 minute')))::text), 'DONNA_NOT_YET_DUE', 'dismissal before the call is due');
  perform t.raises(format(function_call, (jsonb_build_object('event_id', gen_random_uuid(), 'call_id', 'call-1', 'type', 'QUESTION_DISMISSED', 'at', t.iso('-3 hours')))::text), 'DONNA_NOT_YET_DUE', 'event dated before the due time');
  perform t.raises(format(function_call, (base || jsonb_build_object('event_id', gen_random_uuid(), 'type', 'QUESTION_DISMISSED', 'outcome', 'SPOKE'))::text), 'DONNA_INVALID_PAYLOAD', 'a dismissal cannot carry outcome fields');
  perform t.raises(format(function_call, (base || jsonb_build_object('event_id', gen_random_uuid(), 'type', 'SNOOZED'))::text), 'DONNA_INVALID_PAYLOAD', 'snooze without until');
  perform t.raises(format(function_call, (base || jsonb_build_object('event_id', gen_random_uuid(), 'type', 'SNOOZED', 'until', at_ok))::text), 'DONNA_SNOOZE_NOT_IN_FUTURE', 'snooze that does not end after it starts');
  perform t.raises(format(function_call, (base || jsonb_build_object('event_id', gen_random_uuid(), 'type', 'SNOOZED', 'until', t.iso('+400 days')))::text), 'DONNA_INVALID_PAYLOAD', 'absurdly long snooze');
  perform t.raises(format(function_call, (base || jsonb_build_object('event_id', gen_random_uuid(), 'type', 'QUESTION_DISMISSED', 'until', t.iso('+1 hour')))::text), 'DONNA_INVALID_PAYLOAD', 'until only allowed on snooze');
  -- Outcome payloads
  perform t.raises(format(function_call, (base || jsonb_build_object('event_id', gen_random_uuid(), 'type', 'OUTCOME_RECORDED', 'outcome', 'MAYBE', 'original_input', ''))::text), 'DONNA_INVALID_PAYLOAD', 'unknown outcome value');
  perform t.raises(format(function_call, (base || jsonb_build_object('event_id', gen_random_uuid(), 'type', 'OUTCOME_RECORDED', 'original_input', ''))::text), 'DONNA_INVALID_PAYLOAD', 'outcome type without an outcome');
  perform t.raises(format(function_call, (base || jsonb_build_object('event_id', gen_random_uuid(), 'type', 'OUTCOME_RECORDED', 'outcome', 'SPOKE'))::text), 'DONNA_INVALID_PAYLOAD', 'outcome without original_input');
  perform t.raises(format(function_call, (base || jsonb_build_object('event_id', gen_random_uuid(), 'type', 'OUTCOME_RECORDED', 'outcome', 'SPOKE', 'original_input', repeat('x', 2001)))::text), 'DONNA_INVALID_PAYLOAD', 'oversized original_input');
  perform t.raises(format(function_call, (base || jsonb_build_object('event_id', gen_random_uuid(), 'type', 'OUTCOME_RECORDED', 'outcome', 'SPOKE', 'original_input', 5))::text), 'DONNA_INVALID_PAYLOAD', 'original_input must be a string');
  perform t.raises(format(function_call, (base || jsonb_build_object('event_id', gen_random_uuid(), 'type', 'OUTCOME_RECORDED', 'outcome', 'NO_ANSWER', 'original_input', '', 'next_action_kind', 'CLIENT_CONFIRMED_APPOINTMENT', 'appointment_at', t.iso('+2 days'), 'client_confirmed', true))::text), 'DONNA_APPOINTMENT_REQUIRES_SPOKE', 'appointment after no answer');
  perform t.raises(format(function_call, (base || jsonb_build_object('event_id', gen_random_uuid(), 'type', 'OUTCOME_RECORDED', 'outcome', 'DID_NOT_CALL', 'original_input', '', 'next_action_kind', 'CLIENT_CONFIRMED_APPOINTMENT', 'appointment_at', t.iso('+2 days'), 'client_confirmed', true))::text), 'DONNA_APPOINTMENT_REQUIRES_SPOKE', 'appointment after did-not-call');
  perform t.raises(format(function_call, (base || jsonb_build_object('event_id', gen_random_uuid(), 'type', 'OUTCOME_RECORDED', 'outcome', 'SPOKE', 'original_input', '', 'next_action_kind', 'CLIENT_CONFIRMED_APPOINTMENT', 'appointment_at', t.iso('+2 days'), 'client_confirmed', false))::text), 'DONNA_APPOINTMENT_NOT_CONFIRMED', 'appointment without client confirmation');
  perform t.raises(format(function_call, (base || jsonb_build_object('event_id', gen_random_uuid(), 'type', 'OUTCOME_RECORDED', 'outcome', 'SPOKE', 'original_input', '', 'next_action_kind', 'CLIENT_CONFIRMED_APPOINTMENT', 'appointment_at', t.iso('+2 days')))::text), 'DONNA_APPOINTMENT_NOT_CONFIRMED', 'appointment with client_confirmed absent');
  perform t.raises(format(function_call, (base || jsonb_build_object('event_id', gen_random_uuid(), 'type', 'OUTCOME_RECORDED', 'outcome', 'SPOKE', 'original_input', '', 'next_action_kind', 'CLIENT_CONFIRMED_APPOINTMENT', 'appointment_at', at_ok, 'client_confirmed', true))::text), 'DONNA_APPOINTMENT_NOT_IN_FUTURE', 'appointment not after the event');
  perform t.raises(format(function_call, (base || jsonb_build_object('event_id', gen_random_uuid(), 'type', 'OUTCOME_RECORDED', 'outcome', 'SPOKE', 'original_input', '', 'next_action_kind', 'CLIENT_CONFIRMED_APPOINTMENT', 'client_confirmed', true))::text), 'DONNA_INVALID_INSTANT', 'appointment without a time');
  perform t.raises(format(function_call, (base || jsonb_build_object('event_id', gen_random_uuid(), 'type', 'OUTCOME_RECORDED', 'outcome', 'SPOKE', 'original_input', '', 'next_action_kind', 'CLIENT_CONFIRMED_APPOINTMENT', 'appointment_at', t.iso('+2 days'), 'client_confirmed', true, 'follow_up_date', '2999-01-01'))::text), 'DONNA_INVALID_PAYLOAD', 'appointment mixed with a follow-up date');
  perform t.raises(format(function_call, (base || jsonb_build_object('event_id', gen_random_uuid(), 'type', 'OUTCOME_RECORDED', 'outcome', 'CANCELLED', 'original_input', '', 'next_action_kind', 'INTERNAL_FOLLOW_UP', 'follow_up_date', to_char(now() + interval '2 days', 'YYYY-MM-DD')))::text), 'DONNA_NEXT_ACTION_NOT_ALLOWED_FOR_OUTCOME', 'next action on a cancelled call');
  perform t.raises(format(function_call, (base || jsonb_build_object('event_id', gen_random_uuid(), 'type', 'OUTCOME_RECORDED', 'outcome', 'SPOKE', 'original_input', '', 'next_action_kind', 'INTERNAL_FOLLOW_UP'))::text), 'DONNA_FOLLOW_UP_DATE_INVALID', 'follow-up without a date');
  perform t.raises(format(function_call, (base || jsonb_build_object('event_id', gen_random_uuid(), 'type', 'OUTCOME_RECORDED', 'outcome', 'SPOKE', 'original_input', '', 'next_action_kind', 'INTERNAL_FOLLOW_UP', 'follow_up_date', '2026-02-31'))::text), 'DONNA_FOLLOW_UP_DATE_INVALID', 'impossible follow-up date');
  perform t.raises(format(function_call, (base || jsonb_build_object('event_id', gen_random_uuid(), 'type', 'OUTCOME_RECORDED', 'outcome', 'SPOKE', 'original_input', '', 'next_action_kind', 'INTERNAL_FOLLOW_UP', 'follow_up_date', to_char(now() - interval '10 days', 'YYYY-MM-DD')))::text), 'DONNA_FOLLOW_UP_DATE_IN_PAST', 'follow-up date in the past');
  perform t.raises(format(function_call, (base || jsonb_build_object('event_id', gen_random_uuid(), 'type', 'OUTCOME_RECORDED', 'outcome', 'SPOKE', 'original_input', '', 'next_action_kind', 'INTERNAL_FOLLOW_UP', 'follow_up_date', to_char(now() + interval '400 days', 'YYYY-MM-DD')))::text), 'DONNA_INVALID_PAYLOAD', 'follow-up date absurdly far away');
  perform t.raises(format(function_call, (base || jsonb_build_object('event_id', gen_random_uuid(), 'type', 'OUTCOME_RECORDED', 'outcome', 'SPOKE', 'original_input', '', 'next_action_kind', 'MAGIC'))::text), 'DONNA_INVALID_PAYLOAD', 'unknown next-action kind');
  perform t.raises(format(function_call, (base || jsonb_build_object('event_id', gen_random_uuid(), 'type', 'OUTCOME_RECORDED', 'outcome', 'SPOKE', 'original_input', '', 'follow_up_date', to_char(now() + interval '2 days', 'YYYY-MM-DD')))::text), 'DONNA_INVALID_PAYLOAD', 'follow-up date without a kind');
  perform t.ok((select count(*) from public.donna_events) = 0, 'no rejected event left a row behind');
end $$;

-- 5. Valid non-outcome events ---------------------------------------------------------
do $$
declare r jsonb; s1 uuid := gen_random_uuid();
begin
  r := public.donna_record_event(jsonb_build_object('event_id', gen_random_uuid(), 'call_id', 'call-future', 'type', 'TASK_MARKED_DONE', 'at', t.iso('-1 minute')));
  perform t.eq(r ->> 'status', 'CREATED', 'task-done may be recorded before the call is due');
  r := public.donna_record_event(jsonb_build_object('event_id', gen_random_uuid(), 'call_id', 'call-1', 'type', 'QUESTION_DISMISSED', 'at', t.iso('-90 minutes')));
  perform t.eq(r ->> 'status', 'CREATED', 'dismissal is recorded');
  r := public.donna_record_event(jsonb_build_object('event_id', s1, 'call_id', 'call-1', 'type', 'SNOOZED', 'at', t.iso('-80 minutes'), 'until', t.iso('+1 day')));
  perform t.eq(r ->> 'status', 'CREATED', 'snooze is recorded');
  perform t.ok((select count(*) from public.donna_events where call_id = 'call-1' and type = 'OUTCOME_RECORDED') = 0, 'snooze and dismissal never create an outcome');
end $$;

-- 6. One outcome per call; retry vs conflict ----------------------------------------------
do $$
declare
  ev uuid := gen_random_uuid();
  at_ts text := t.iso('-30 minutes');
  p jsonb; r jsonb; seq1 text;
begin
  p := jsonb_build_object('event_id', ev, 'call_id', 'call-1', 'type', 'OUTCOME_RECORDED', 'at', at_ts,
        'outcome', 'SPOKE', 'original_input', 'Synthetic note', 'next_action_kind', 'INTERNAL_FOLLOW_UP',
        'follow_up_date', to_char(now() + interval '2 days', 'YYYY-MM-DD'));
  r := public.donna_record_event(p);
  perform t.eq(r ->> 'status', 'CREATED', 'first outcome is created');
  seq1 := r ->> 'seq';
  r := public.donna_record_event(p);
  perform t.eq(r ->> 'status', 'DUPLICATE', 'identical retry (same event_id, same content) is a duplicate');
  perform t.eq(r ->> 'seq', seq1, 'a duplicate retry returns the original sequence number');
  perform t.raises(format('select public.donna_record_event(%L::jsonb)', (p || '{"original_input":"edited"}')::text),
    'DONNA_EVENT_ID_REUSED', 'same event_id with different content is rejected as reuse');
  perform t.raises(format('select public.donna_record_event(%L::jsonb)', (p || jsonb_build_object('event_id', gen_random_uuid()))::text),
    'DONNA_ALREADY_RESOLVED', 'a new event_id with identical content is a second outcome, not a retry');
  perform t.raises(format('select public.donna_record_event(%L::jsonb)',
      jsonb_build_object('event_id', gen_random_uuid(), 'call_id', 'call-1', 'type', 'OUTCOME_RECORDED', 'at', at_ts, 'outcome', 'NO_ANSWER', 'original_input', '')::text),
    'DONNA_ALREADY_RESOLVED', 'a conflicting second outcome is rejected');
  perform t.raises(format('select public.donna_record_event(%L::jsonb)',
      jsonb_build_object('event_id', gen_random_uuid(), 'call_id', 'call-1', 'type', 'SNOOZED', 'at', at_ts, 'until', t.iso('+1 day'))::text),
    'DONNA_ALREADY_RESOLVED', 'no snooze after an outcome');
  perform t.raises(format('select public.donna_record_event(%L::jsonb)',
      jsonb_build_object('event_id', gen_random_uuid(), 'call_id', 'call-1', 'type', 'TASK_MARKED_DONE', 'at', at_ts)::text),
    'DONNA_ALREADY_RESOLVED', 'no task-done after an outcome');
  perform t.ok((select count(*) from public.donna_events where call_id = 'call-1' and type = 'OUTCOME_RECORDED') = 1, 'exactly one outcome row exists');
  -- appointment accepted for SPOKE with explicit confirmation
  r := public.donna_upsert_call(jsonb_build_object('id', 'call-appt', 'client_id', 'cl-gamma', 'due_at', t.iso('-2 hours')));
  r := public.donna_record_event(jsonb_build_object('event_id', gen_random_uuid(), 'call_id', 'call-appt', 'type', 'OUTCOME_RECORDED', 'at', t.iso('-10 minutes'),
        'outcome', 'SPOKE', 'original_input', 'x', 'next_action_kind', 'CLIENT_CONFIRMED_APPOINTMENT', 'appointment_at', t.iso('+2 days'), 'client_confirmed', true));
  perform t.eq(r ->> 'status', 'CREATED', 'client-confirmed appointment is accepted after a conversation');
end $$;

-- 7. Append-only and direct-write denial ----------------------------------------------------
select t.raises($q$update public.donna_events set original_input = 'tampered'$q$, 'permission denied', 'owner cannot update events');
select t.raises($q$delete from public.donna_events$q$, 'permission denied', 'owner cannot delete events');
select t.raises($q$truncate public.donna_events$q$, 'permission denied', 'owner cannot truncate events');
select t.raises($q$update public.donna_calls set due_at = now()$q$, 'permission denied', 'owner cannot update calls');
select t.raises($q$delete from public.donna_calls$q$, 'permission denied', 'owner cannot delete calls');
select t.raises($q$insert into public.donna_events (owner_id, event_id, call_id, type, at) values ('11111111-1111-1111-1111-111111111111', gen_random_uuid(), 'call-1', 'QUESTION_DISMISSED', now())$q$,
  'permission denied', 'direct inserts into events are denied (writes only via the validated function)');
select t.reset();
select t.raises($q$update public.donna_events set original_input = 'tampered'$q$, 'DONNA_APPEND_ONLY', 'even the table owner cannot update events');
select t.raises($q$delete from public.donna_events$q$, 'DONNA_APPEND_ONLY', 'even the table owner cannot delete events');
select t.raises($q$truncate public.donna_events$q$, 'DONNA_APPEND_ONLY', 'even the table owner cannot truncate events');
select t.raises($q$update public.donna_calls set due_at = now()$q$, 'DONNA_APPEND_ONLY', 'even the table owner cannot update calls');
select t.raises($q$delete from public.donna_calls$q$, 'DONNA_APPEND_ONLY', 'even the table owner cannot delete calls');
select t.raises($q$delete from auth.users where id = '11111111-1111-1111-1111-111111111111'$q$, 'violates foreign key', 'a user with recorded history cannot be deleted');

-- 8. A different account cannot reach the records ---------------------------------------------------
select t.become(:'uid_b', 'owner-b@example.test');
do $$
declare r jsonb;
begin
  perform t.ok((select count(*) from public.donna_calls) = 0, 'account B sees none of account A calls');
  perform t.ok((select count(*) from public.donna_events) = 0, 'account B sees none of account A events');
  perform t.raises($q$select public.donna_record_event('{"event_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","call_id":"call-1","type":"QUESTION_DISMISSED","at":"2026-01-01T00:00:00Z"}'::jsonb)$q$,
    'DONNA_UNKNOWN_CALL', 'account B cannot write events against account A calls');
  -- Same ids in B's own namespace are independent of A (no cross-account leak of existence).
  r := public.donna_upsert_call(jsonb_build_object('id', 'call-1', 'client_id', 'cl-other', 'due_at', t.iso('-2 hours')));
  perform t.eq(r ->> 'status', 'CREATED', 'account B can create its own call-1 (separate namespace)');
  perform t.ok((select count(*) from public.donna_calls) = 1, 'account B sees only its own call');
end $$;
select t.reset();
select t.ok((select count(*) from public.donna_events where type = 'OUTCOME_RECORDED') = 2, 'account B activity did not touch account A outcomes');

-- 9. A signed-in user who is not (or no longer) allow-listed gets nothing --------------------------
delete from public.donna_allowed_emails where email = 'owner-b@example.test';
select t.become(:'uid_b', 'owner-b@example.test');
select t.ok((select count(*) from public.donna_calls) = 0, 'a removed owner sees no rows');
select t.raises($q$select public.donna_upsert_call('{"id":"x","client_id":"cl-x","due_at":"2026-01-01T00:00:00Z"}'::jsonb)$q$,
  'DONNA_NOT_ALLOWED', 'a removed owner cannot write');
select t.reset();

-- 10. Account A still sees exactly its own, consistent records -----------------------------------------
select t.become(:'uid_a', 'owner-a@example.test');
select t.ok((select count(*) from public.donna_calls) = 3, 'account A sees its three calls');
select t.ok((select count(distinct call_id) from public.donna_events where type = 'OUTCOME_RECORDED') = 2, 'account A sees its two recorded outcomes');
select t.reset();

\set QUIET off
select count(*) || ' SQL assertions passed' as result from t.results;
