#!/usr/bin/env bash
# Runs each SQL test file against its own throwaway Postgres database with all
# migrations applied. Files named *seed*.sql also get supabase/seed.sql loaded.
# Usage: scripts/db-test.sh            (needs psql + a reachable server; PG* env vars honoured)
set -euo pipefail
cd "$(dirname "$0")/.."
PSQL=(psql -X -q -t -A -v ON_ERROR_STOP=1 --no-psqlrc)
dbs=()
trap 'for d in "${dbs[@]}"; do dropdb --if-exists "$d" >/dev/null 2>&1 || true; done' EXIT

fresh_db() {
  local db="atlas_test_$$_$1"
  dbs+=("$db")
  createdb "$db"
  "${PSQL[@]}" -d "$db" -f supabase/tests/00_supabase_stub.sql
  for f in supabase/migrations/*.sql; do "${PSQL[@]}" -d "$db" -f "$f"; done
  "${PSQL[@]}" -d "$db" -f supabase/tests/01_helpers.sql
  echo "$db"
}

status=0
n=0
for f in supabase/tests/[1-9][0-9]_*.sql; do
  n=$((n + 1))
  db=$(fresh_db "$n")
  echo "test     $(basename "$f")"
  if [[ "$f" == *seed* ]]; then "${PSQL[@]}" -d "$db" -f supabase/seed.sql; fi
  out=$("${PSQL[@]}" -d "$db" -f "$f" 2>&1) || { echo "$out"; status=1; continue; }
  echo "$out" | grep -E 'PASS|FAIL' | sed 's/^.*NOTICE:  /  /'
  if echo "$out" | grep -q 'FAIL'; then status=1; fi
done
exit $status
