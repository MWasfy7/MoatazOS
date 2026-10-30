\set ON_ERROR_STOP on
\set QUIET on
-- Next step lives in its own column; original_input is byte-for-byte unchanged.
-- Run AFTER the base migration, helpers.sql and the second migration (20261030000000_donna_next_step.sql).
\set uid_n '44444444-4444-4444-4444-444444444444'

select t.reset();
insert into public.donna_allowed_emails values ('owner-n@example.test');
insert into auth.users (id, email) values (:'uid_n', 'owner-n@example.test');
select t.become(:'uid_n', 'owner-n@example.test');
select public.donna_upsert_call(jsonb_build_object('id', 'ns-1', 'client_id', 'cl-ns', 'due_at', t.iso('-3 hours')));
select public.donna_upsert_call(jsonb_build_object('id', 'ns-2', 'client_id', 'cl-ns', 'due_at', t.iso('-3 hours')));
select public.donna_upsert_call(jsonb_build_object('id', 'ns-3', 'client_id', 'cl-ns', 'due_at', t.iso('-3 hours')));
select public.donna_upsert_call(jsonb_build_object('id', 'ns-4', 'client_id', 'cl-ns', 'due_at', t.iso('-3 hours')));
select public.donna_upsert_call(jsonb_build_object('id', 'ns-5', 'client_id', 'cl-ns', 'due_at', t.iso('-3 hours')));

-- 1. A note equal to Codex's valid versioned-prefix example stays a plain note, stored exactly.
do $$
declare
  legacy text := E'⁣donna-v1⁣{"n":"x","s":"y"}';
  ev uuid := gen_random_uuid();
  r jsonb; stored public.donna_events;
begin
  r := public.donna_record_event(jsonb_build_object('event_id', ev, 'call_id', 'ns-1', 'type', 'OUTCOME_RECORDED',
         'at', t.iso('-1 hour'), 'outcome', 'SPOKE', 'original_input', legacy));
  perform t.eq(r ->> 'status', 'CREATED', 'a note that imitates the old versioned format is accepted');
  select * into stored from public.donna_events where owner_id = auth.uid() and call_id = 'ns-1' and type = 'OUTCOME_RECORDED';
  perform t.ok(stored.original_input = legacy, 'original_input is stored byte-for-byte (versioned-prefix lookalike)');
  perform t.ok(stored.next_step is null, 'no next_step was sent, so none is stored');
end $$;

-- 2. Padding, newlines, the old delimiter and Arabic survive in both columns, separately.
do $$
declare
  note text := E'  padded \n[[next-step]]\n note\t ';
  nxt text := E' next \n[[next-step]]\n step العميل ';
  ev uuid := gen_random_uuid();
  p jsonb; r jsonb; stored public.donna_events;
begin
  p := jsonb_build_object('event_id', ev, 'call_id', 'ns-2', 'type', 'OUTCOME_RECORDED', 'at', t.iso('-1 hour'),
         'outcome', 'SPOKE', 'original_input', note, 'next_step', nxt);
  r := public.donna_record_event(p);
  perform t.eq(r ->> 'status', 'CREATED', 'note plus next step is created');
  select * into stored from public.donna_events where owner_id = auth.uid() and call_id = 'ns-2' and type = 'OUTCOME_RECORDED';
  perform t.ok(stored.original_input = note, 'original_input is exactly the note');
  perform t.ok(stored.next_step = nxt, 'next_step is exactly the next step');
  perform t.eq(public.donna_record_event(p) ->> 'status', 'DUPLICATE', 'an identical retry including next_step is a duplicate');
  perform t.raises(format('select public.donna_record_event(%L::jsonb)', (p || '{"next_step":"changed"}')::text),
    'DONNA_EVENT_ID_REUSED', 'same event_id with a different next_step is rejected as reuse');
  perform t.raises(format('select public.donna_record_event(%L::jsonb)', (p - 'next_step')::text),
    'DONNA_EVENT_ID_REUSED', 'same event_id with the next_step removed is rejected as reuse');
end $$;

-- 3. Callers that never send next_step behave exactly as before.
do $$
declare r jsonb; stored public.donna_events;
begin
  r := public.donna_record_event(jsonb_build_object('event_id', gen_random_uuid(), 'call_id', 'ns-3', 'type', 'OUTCOME_RECORDED',
         'at', t.iso('-1 hour'), 'outcome', 'NO_ANSWER', 'original_input', ''));
  perform t.eq(r ->> 'status', 'CREATED', 'an outcome without next_step is still accepted');
  select * into stored from public.donna_events where owner_id = auth.uid() and call_id = 'ns-3' and type = 'OUTCOME_RECORDED';
  perform t.ok(stored.next_step is null, 'absent next_step is stored as NULL');
end $$;

-- 4. Validation.
do $$
declare base jsonb := jsonb_build_object('call_id', 'ns-4', 'at', t.iso('-1 hour'));
begin
  perform t.raises(format('select public.donna_record_event(%L::jsonb)', (base || jsonb_build_object('event_id', gen_random_uuid(), 'type', 'OUTCOME_RECORDED', 'outcome', 'SPOKE', 'original_input', '', 'next_step', repeat('x', 2001)))::text),
    'DONNA_INVALID_PAYLOAD', 'oversized next_step is rejected');
  perform t.raises(format('select public.donna_record_event(%L::jsonb)', (base || jsonb_build_object('event_id', gen_random_uuid(), 'type', 'OUTCOME_RECORDED', 'outcome', 'SPOKE', 'original_input', '', 'next_step', 5))::text),
    'DONNA_INVALID_PAYLOAD', 'next_step must be a string');
  perform t.raises(format('select public.donna_record_event(%L::jsonb)', (base || jsonb_build_object('event_id', gen_random_uuid(), 'type', 'OUTCOME_RECORDED', 'outcome', 'CANCELLED', 'original_input', '', 'next_step', 'x'))::text),
    'DONNA_INVALID_PAYLOAD', 'a cancelled call cannot carry a next step');
  perform t.raises(format('select public.donna_record_event(%L::jsonb)', (base || jsonb_build_object('event_id', gen_random_uuid(), 'type', 'QUESTION_DISMISSED', 'next_step', 'x'))::text),
    'DONNA_INVALID_PAYLOAD', 'a non-outcome event cannot carry a next step');
  perform t.ok((select count(*) from public.donna_events where call_id = 'ns-4') = 0, 'rejected writes stored nothing');
end $$;
select public.donna_record_event(jsonb_build_object('event_id', gen_random_uuid(), 'call_id', 'ns-5', 'type', 'OUTCOME_RECORDED',
  'at', t.iso('-1 hour'), 'outcome', 'SPOKE', 'original_input', repeat('n', 2000), 'next_step', repeat('x', 2000)));
select t.ok((select char_length(next_step) from public.donna_events where call_id = 'ns-5' and type = 'OUTCOME_RECORDED') = 2000, 'a 2000-character next step is stored');

-- 5. Still append-only, and the owner can read the column back through row-level security.
select t.raises($q$update public.donna_events set next_step = 'edited' where call_id = 'ns-2'$q$, 'permission denied', 'next_step cannot be edited by the signed-in user');
select t.ok((select next_step from public.donna_events where call_id = 'ns-2' and type = 'OUTCOME_RECORDED') is not null, 'the owner can read next_step');
select t.reset();
select t.raises($q$update public.donna_events set next_step = 'edited' where call_id = 'ns-2'$q$, 'DONNA_APPEND_ONLY', 'even a superuser cannot rewrite next_step');

\set QUIET off
select count(*) || ' next-step SQL assertions passed' as result from t.results;
