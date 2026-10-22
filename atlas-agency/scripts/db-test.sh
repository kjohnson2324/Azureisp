#!/usr/bin/env bash
# Applies all migrations to a throwaway Postgres database and runs the RLS suite.
# Usage: scripts/db-test.sh            (needs psql + a reachable server; PG* env vars honoured)
set -euo pipefail
cd "$(dirname "$0")/.."
DB="atlas_test_$$"
PSQL=(psql -X -q -t -A -v ON_ERROR_STOP=1 --no-psqlrc)
createdb "$DB"
trap 'dropdb --if-exists "$DB" >/dev/null 2>&1 || true' EXIT

"${PSQL[@]}" -d "$DB" -f supabase/tests/00_supabase_stub.sql
for f in supabase/migrations/*.sql; do
  echo "migrate  $(basename "$f")"
  "${PSQL[@]}" -d "$DB" -f "$f"
done

status=0
for f in supabase/tests/[1-9]*.sql; do
  echo "test     $(basename "$f")"
  out=$("${PSQL[@]}" -d "$DB" -f "$f" 2>&1) || { echo "$out"; status=1; continue; }
  echo "$out" | grep -E 'PASS|FAIL' | sed 's/^.*NOTICE:  /  /'
  if echo "$out" | grep -q 'FAIL'; then status=1; fi
done
exit $status
