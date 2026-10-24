#!/usr/bin/env bash
# DON-02 database tests: applies the migration to a THROWAWAY local PostgreSQL
# (with a stubbed `auth` schema, NOT Supabase) and runs the SQL assertions plus
# parallel race tests (concurrent identical retries, concurrent conflicting
# outcomes). It proves the database rules; it does not prove the hosted
# Supabase project, PostgREST or the browser flow (see docs/engineering/DON-02-SETUP.md).
#
#   scripts/donna-db-test.sh                       # starts and removes a scratch cluster
#   DONNA_TEST_DATABASE_URL=postgres://.../x_donna_test scripts/donna-db-test.sh
#       # uses an existing empty database whose name ends in _donna_test
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MIGRATION="$ROOT/supabase/migrations/20261025000000_donna_durable_records.sql"
TESTS="$ROOT/supabase/tests"
PGBIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1 || true)"
SCRATCH=""
CLEANUP=()

cleanup() {
  for c in "${CLEANUP[@]:-}"; do [ -n "$c" ] && eval "$c" || true; done
}
trap cleanup EXIT

if [ -n "${DONNA_TEST_DATABASE_URL:-}" ]; then
  case "${DONNA_TEST_DATABASE_URL##*/}" in
    *_donna_test) ;;
    *) echo "Refusing: the database name must end in _donna_test" >&2; exit 2 ;;
  esac
  PSQL=(psql -X -v ON_ERROR_STOP=1 "$DONNA_TEST_DATABASE_URL")
else
  [ -x "$PGBIN/initdb" ] || { echo "PostgreSQL server binaries not found; set DONNA_TEST_DATABASE_URL" >&2; exit 2; }
  SCRATCH="/var/tmp/donna-pg-$$"
  RUN=()
  if [ "$(id -u)" = "0" ]; then RUN=(runuser -u postgres --); fi
  mkdir -p "$SCRATCH" && chmod 777 "$SCRATCH"
  "${RUN[@]}" "$PGBIN/initdb" -D "$SCRATCH/data" -A trust -U postgres >/dev/null
  "${RUN[@]}" "$PGBIN/pg_ctl" -D "$SCRATCH/data" -o "-c listen_addresses='' -k $SCRATCH -p 54329" -l "$SCRATCH/log" -w start >/dev/null
  CLEANUP+=("${RUN[*]:-} $PGBIN/pg_ctl -D $SCRATCH/data -m immediate stop >/dev/null 2>&1; rm -rf $SCRATCH")
  "${RUN[@]}" "$PGBIN/createdb" -h "$SCRATCH" -p 54329 -U postgres x_donna_test
  PSQL=(psql -X -v ON_ERROR_STOP=1 -h "$SCRATCH" -p 54329 -U postgres -d x_donna_test)
fi

run_sql() { "${PSQL[@]}" -q "$@"; }

echo "== applying stub auth, migration, helpers"
run_sql -f "$TESTS/stub_auth.sql" >/dev/null
run_sql -f "$MIGRATION" >/dev/null
run_sql -f "$TESTS/helpers.sql" >/dev/null

echo "== SQL assertions"
run_sql -At -f "$TESTS/donna.test.sql" | grep -v '^$' | tee /dev/stderr | grep -q 'SQL assertions passed'

echo "== concurrency: 12 parallel sessions, each recording a DIFFERENT outcome for one call"
UID_C='33333333-3333-3333-3333-333333333333'
run_sql -At <<SQL >/dev/null
select t.reset();
insert into public.donna_allowed_emails values ('race@example.test');
insert into auth.users (id, email) values ('$UID_C', 'race@example.test');
select t.become('$UID_C', 'race@example.test');
select public.donna_upsert_call('{"id":"race-1","client_id":"cl-race","due_at":"2026-01-01T00:00:00Z"}'::jsonb);
select public.donna_upsert_call('{"id":"race-2","client_id":"cl-race","due_at":"2026-01-01T00:00:00Z"}'::jsonb);
select t.reset();
SQL

gate() { "${PSQL[@]}" -q -At -c "select pg_advisory_lock(777), pg_sleep(2.5)" >/dev/null; }
worker() { # $1 = payload json
  "${PSQL[@]}" -q -At <<SQL
select pg_advisory_lock_shared(777) \\gset
select t.become('$UID_C', 'race@example.test') \\gset
select t.try_record('$1'::jsonb);
SQL
}

OUT="$(mktemp)"
gate & GATE=$!
sleep 0.5
for i in $(seq 1 12); do
  at="$(date -u -d '-1 minute' +%Y-%m-%dT%H:%M:%SZ)"
  worker "{\"event_id\":\"$(cat /proc/sys/kernel/random/uuid)\",\"call_id\":\"race-1\",\"type\":\"OUTCOME_RECORDED\",\"at\":\"$at\",\"outcome\":\"SPOKE\",\"original_input\":\"racer $i\"}" >>"$OUT" &
done
wait
CREATED=$(grep -c '^CREATED$' "$OUT" || true)
RESOLVED=$(grep -c 'DONNA_ALREADY_RESOLVED' "$OUT" || true)
echo "   CREATED=$CREATED ALREADY_RESOLVED=$RESOLVED"
[ "$CREATED" = "1" ] && [ "$RESOLVED" = "11" ] || { echo "FAIL: expected 1 CREATED and 11 ALREADY_RESOLVED"; cat "$OUT"; exit 1; }
ROWS=$(run_sql -At -c "select count(*) from public.donna_events where call_id='race-1' and type='OUTCOME_RECORDED'")
[ "$ROWS" = "1" ] || { echo "FAIL: $ROWS outcome rows for race-1"; exit 1; }

echo "== concurrency: 12 parallel RETRIES of the same event (same event_id, same content)"
: >"$OUT"
EV="$(cat /proc/sys/kernel/random/uuid)"; AT="$(date -u -d '-1 minute' +%Y-%m-%dT%H:%M:%SZ)"
PAYLOAD="{\"event_id\":\"$EV\",\"call_id\":\"race-2\",\"type\":\"OUTCOME_RECORDED\",\"at\":\"$AT\",\"outcome\":\"NO_ANSWER\",\"original_input\":\"retry\"}"
gate & GATE=$!
sleep 0.5
for i in $(seq 1 12); do worker "$PAYLOAD" >>"$OUT" & done
wait
CREATED=$(grep -c '^CREATED$' "$OUT" || true)
DUP=$(grep -c '^DUPLICATE$' "$OUT" || true)
echo "   CREATED=$CREATED DUPLICATE=$DUP"
[ "$CREATED" = "1" ] && [ "$DUP" = "11" ] || { echo "FAIL: expected 1 CREATED and 11 DUPLICATE"; cat "$OUT"; exit 1; }
ROWS=$(run_sql -At -c "select count(*) from public.donna_events where call_id='race-2'")
[ "$ROWS" = "1" ] || { echo "FAIL: $ROWS rows for race-2"; exit 1; }
rm -f "$OUT"
echo "PASS: DON-02 database tests"
