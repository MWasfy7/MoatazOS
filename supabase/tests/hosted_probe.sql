-- DON-02 hosted probe. Run in the DEDICATED SYNTHETIC Supabase project, in the
-- Dashboard SQL Editor, AFTER the migration. It exercises the database objects
-- themselves (not the Auth API and not the dashboard sign-up switch), so a pass
-- here proves the allowlist trigger and the privilege model independently.
--
-- Safe: every row it creates is undone (each probe runs in a sub-transaction that
-- is rolled back), and the rest only reads the catalog. If your editor rejects
-- `pg_temp`, replace `pg_temp.` with `public.` everywhere, run it, then run
-- `drop function public.donna_hosted_probe();`.
--
-- Read the result table: every row must say PASS, and the last row must say
-- OVERALL PASS. FAIL means a protection is missing. INCONCLUSIVE means the probe
-- could not run a check (read the detail) and is NOT a pass.
-- The same file is run by `npm run test:donna-db` against a local Postgres, and
-- against a deliberately broken copy to prove it can fail.

create or replace function pg_temp.donna_hosted_probe()
returns table (check_name text, result text, detail text)
language plpgsql as $$
declare
  v_unlisted text := 'probe-unlisted-' || replace(gen_random_uuid()::text, '-', '') || '@example.test';
  v_allowed  text := 'probe-allowed-'  || replace(gen_random_uuid()::text, '-', '') || '@example.test';
  v_id uuid;
  v_n int;
  v_bad text;
begin
  -- 1-2. The triggers exist and are enabled ('O' = fires normally).
  select count(*) into v_n from pg_trigger
   where tgrelid = 'auth.users'::regclass and tgname = 'donna_block_unlisted_signup' and tgenabled = 'O' and not tgisinternal;
  check_name := 'sign-up trigger exists and is enabled on auth.users';
  if v_n = 1 then result := 'PASS'; detail := ''; else result := 'FAIL'; detail := 'missing or disabled'; end if;
  return next;

  select count(*) into v_n from pg_trigger
   where tgrelid = 'auth.users'::regclass and tgname = 'donna_block_unlisted_email_change' and tgenabled = 'O' and not tgisinternal;
  check_name := 'email-change trigger exists and is enabled on auth.users';
  if v_n = 1 then result := 'PASS'; detail := ''; else result := 'FAIL'; detail := 'missing or disabled'; end if;
  return next;

  -- 3. An unlisted address is refused BY THE TRIGGER (direct insert, no Auth API involved).
  check_name := 'trigger refuses an unlisted address (direct insert into auth.users)';
  begin
    begin
      insert into auth.users (id, email) values (gen_random_uuid(), v_unlisted);
      result := 'FAIL'; detail := 'the insert SUCCEEDED (it was rolled back)';
    exception when others then
      if sqlerrm = 'DONNA_SIGNUP_NOT_ALLOWED' then result := 'PASS'; detail := 'refused with DONNA_SIGNUP_NOT_ALLOWED';
      else result := 'INCONCLUSIVE'; detail := sqlerrm; end if;
    end;
    raise exception 'DONNA_PROBE_ROLLBACK';
  exception when others then
    if sqlerrm <> 'DONNA_PROBE_ROLLBACK' then raise; end if;
  end;
  return next;

  -- 4. A user without an email (what an anonymous sign-in creates) is refused.
  check_name := 'trigger refuses a user with no email (anonymous sign-in)';
  begin
    begin
      insert into auth.users (id, email) values (gen_random_uuid(), null);
      result := 'FAIL'; detail := 'the insert SUCCEEDED (it was rolled back)';
    exception when others then
      if sqlerrm = 'DONNA_SIGNUP_NOT_ALLOWED' then result := 'PASS'; detail := 'refused with DONNA_SIGNUP_NOT_ALLOWED';
      else result := 'INCONCLUSIVE'; detail := sqlerrm; end if;
    end;
    raise exception 'DONNA_PROBE_ROLLBACK';
  exception when others then
    if sqlerrm <> 'DONNA_PROBE_ROLLBACK' then raise; end if;
  end;
  return next;

  -- 5. An allow-listed address is accepted (so the refusals above are not just "everything fails").
  check_name := 'trigger accepts an allow-listed address';
  begin
    begin
      insert into public.donna_allowed_emails (email) values (v_allowed);
      insert into auth.users (id, email) values (gen_random_uuid(), upper(v_allowed));
      result := 'PASS'; detail := 'accepted (case-insensitive); rolled back';
    exception when others then
      if sqlerrm = 'DONNA_SIGNUP_NOT_ALLOWED' then result := 'FAIL'; detail := 'an allow-listed address was refused';
      else result := 'INCONCLUSIVE'; detail := sqlerrm; end if;
    end;
    raise exception 'DONNA_PROBE_ROLLBACK';
  exception when others then
    if sqlerrm <> 'DONNA_PROBE_ROLLBACK' then raise; end if;
  end;
  return next;

  -- 6. Changing an existing user's email to an unlisted one is refused.
  check_name := 'trigger refuses changing an email to an unlisted address';
  begin
    begin
      insert into public.donna_allowed_emails (email) values (v_allowed);
      v_id := gen_random_uuid();
      insert into auth.users (id, email) values (v_id, v_allowed);
      begin
        update auth.users set email = v_unlisted where id = v_id;
        result := 'FAIL'; detail := 'the update SUCCEEDED (it was rolled back)';
      exception when others then
        if sqlerrm = 'DONNA_SIGNUP_NOT_ALLOWED' then result := 'PASS'; detail := 'refused with DONNA_SIGNUP_NOT_ALLOWED';
        else result := 'INCONCLUSIVE'; detail := sqlerrm; end if;
      end;
    exception when others then
      result := 'INCONCLUSIVE'; detail := 'setup failed: ' || sqlerrm;
    end;
    raise exception 'DONNA_PROBE_ROLLBACK';
  exception when others then
    if sqlerrm <> 'DONNA_PROBE_ROLLBACK' then raise; end if;
  end;
  return next;

  -- 7. History protections are present and enabled.
  select string_agg(want, ', ') into v_bad from (values
      ('public.donna_events', 'donna_events_validate'), ('public.donna_events', 'donna_events_append_only'),
      ('public.donna_events', 'donna_events_no_truncate'), ('public.donna_calls', 'donna_calls_immutable'),
      ('public.donna_calls', 'donna_calls_no_truncate')) as w(tbl, want)
    where not exists (select 1 from pg_trigger t where t.tgrelid = w.tbl::regclass and t.tgname = w.want and t.tgenabled = 'O');
  check_name := 'validation, append-only and no-truncate triggers are present and enabled';
  if v_bad is null then result := 'PASS'; detail := ''; else result := 'FAIL'; detail := 'missing: ' || v_bad; end if;
  return next;

  select count(*) into v_n from pg_indexes where schemaname = 'public' and indexname = 'donna_events_one_outcome_per_call';
  check_name := 'one-outcome-per-call unique index exists';
  if v_n = 1 then result := 'PASS'; detail := ''; else result := 'FAIL'; detail := 'missing'; end if;
  return next;

  -- 8. Row-level security is on for every Donna table.
  select string_agg(c.relname, ', ') into v_bad from pg_class c
   where c.relnamespace = 'public'::regnamespace and c.relname in ('donna_calls', 'donna_events', 'donna_allowed_emails') and not c.relrowsecurity;
  check_name := 'row-level security is enabled on all Donna tables';
  if v_bad is null then result := 'PASS'; detail := ''; else result := 'FAIL'; detail := 'not enabled: ' || v_bad; end if;
  return next;

  -- 9. Table privileges: the platform's default grants must not have survived the revokes.
  select string_agg(format('%s %s %s', rl, tbl, pr), '; ') into v_bad from (
      select rl, tbl, pr from (values ('anon'), ('authenticated')) as roles(rl)
      cross join (values ('public.donna_calls'), ('public.donna_events'), ('public.donna_allowed_emails')) as tbls(tbl)
      cross join (values ('insert'), ('update'), ('delete'), ('truncate'), ('references'), ('trigger')) as privs(pr)
      where has_table_privilege(rl, tbl, pr)
      union all
      select 'anon', tbl, 'select' from (values ('public.donna_calls'), ('public.donna_events'), ('public.donna_allowed_emails')) as t(tbl)
       where has_table_privilege('anon', tbl, 'select')
      union all
      select 'authenticated', 'public.donna_allowed_emails', 'select' where has_table_privilege('authenticated', 'public.donna_allowed_emails', 'select')
    ) x;
  check_name := 'anon and authenticated hold no write privilege; anon cannot read; the allowlist is unreadable';
  if v_bad is null then result := 'PASS'; detail := ''; else result := 'FAIL'; detail := v_bad; end if;
  return next;

  select count(*) into v_n from (values ('public.donna_calls'), ('public.donna_events')) as t(tbl)
   where not has_table_privilege('authenticated', tbl, 'select');
  check_name := 'authenticated can read the owner tables (row-level security narrows it)';
  if v_n = 0 then result := 'PASS'; detail := ''; else result := 'FAIL'; detail := 'select missing'; end if;
  return next;

  -- 10. Function privileges: only the validated write functions (and the RLS helper) are callable.
  select string_agg(format('%s can execute %s', rl, p.proname), '; ') into v_bad
    from pg_proc p
    cross join (values ('anon'), ('authenticated')) as roles(rl)
   where p.pronamespace = 'public'::regnamespace and p.proname like 'donna\_%'
     and has_function_privilege(rl, p.oid, 'execute')
     and not (rl = 'authenticated' and p.proname in ('donna_record_event', 'donna_upsert_call', 'donna_is_allowed'));
  check_name := 'only donna_record_event, donna_upsert_call and donna_is_allowed are callable (anon: none)';
  if v_bad is null then result := 'PASS'; detail := ''; else result := 'FAIL'; detail := v_bad; end if;
  return next;

  select count(*) into v_n from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname in ('donna_record_event', 'donna_upsert_call')
     and not has_function_privilege('authenticated', p.oid, 'execute');
  check_name := 'authenticated can call the two write functions';
  if v_n = 0 then result := 'PASS'; detail := ''; else result := 'FAIL'; detail := 'execute missing'; end if;
  return next;
end $$;

-- The last statement's rows are what the editor shows. The OVERALL line is computed here from the rows above.
with probe as (select * from pg_temp.donna_hosted_probe())
select check_name, result, detail from probe
union all
select 'OVERALL',
       case when exists (select 1 from probe where result = 'FAIL') then 'OVERALL FAIL'
            when exists (select 1 from probe where result = 'INCONCLUSIVE') then 'OVERALL INCONCLUSIVE'
            else 'OVERALL PASS' end,
       (select count(*) filter (where result = 'PASS') || ' pass, ' || count(*) filter (where result = 'FAIL') || ' fail, ' || count(*) filter (where result = 'INCONCLUSIVE') || ' inconclusive' from probe);
