create schema t;
grant usage on schema t to anon, authenticated;
create table t.results (label text);
grant insert on t.results to anon, authenticated;

create function t.become(p_uid uuid, p_email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', p_uid, 'email', p_email, 'role', 'authenticated')::text, false);
  perform set_config('role', 'authenticated', false);
end $$;
create function t.become_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', false);
  perform set_config('role', 'anon', false);
end $$;
create function t.become_signed_out() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', false);
  perform set_config('role', 'authenticated', false);
end $$;
create function t.reset() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', false);
  perform set_config('role', 'postgres', false);
end $$;
create function t.iso(p interval) returns text language sql stable as
  $$ select to_char((now() + p) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') $$;
create function t.ok(p boolean, p_label text) returns void language plpgsql as $$
begin
  if p is not true then raise exception 'FAIL - %', p_label; end if;
  insert into t.results values (p_label);
end $$;
create function t.eq(p_actual text, p_expected text, p_label text) returns void language plpgsql as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'FAIL - %: expected %, got %', p_label, p_expected, p_actual;
  end if;
  insert into t.results values (p_label);
end $$;
-- Run statement; it must raise an error whose message contains p_msg.
create function t.raises(p_sql text, p_msg text, p_label text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm like '%' || p_msg || '%' then
      insert into t.results values (p_label);
      return;
    end if;
    raise exception 'FAIL - %: expected error containing %, got: %', p_label, p_msg, sqlerrm;
  end;
  raise exception 'FAIL - %: expected error containing %, but statement succeeded', p_label, p_msg;
end $$;
-- Race helper: returns the status or the error message, never raises.
create function t.try_record(p jsonb) returns text language plpgsql as $$
begin
  return (public.donna_record_event(p) ->> 'status');
exception when others then
  return 'ERR:' || sqlerrm;
end $$;
