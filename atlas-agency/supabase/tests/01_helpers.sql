-- Shared assertion helpers (loaded by scripts/db-test.sh before every suite).
-- ---------------------------------------------------------------------------
-- Test helpers
-- ---------------------------------------------------------------------------
create schema test;
grant usage on schema test to authenticated, anon;

create function test.eq(label text, actual bigint, expected bigint) returns void
language plpgsql as $$ begin
  if actual is not distinct from expected then raise notice 'PASS %', label;
  else raise notice 'FAIL % (expected %, got %)', label, expected, actual; end if;
end $$;

create function test.throws(label text, stmt text, sqlstate_prefix text default '') returns void
language plpgsql as $$ begin
  begin
    execute stmt;
  exception when others then
    if sqlstate like sqlstate_prefix || '%' then raise notice 'PASS %', label;
    else raise notice 'FAIL % (wrong error % %)', label, sqlstate, sqlerrm; end if;
    return;
  end;
  raise notice 'FAIL % (no error raised)', label;
end $$;

create function test.ok(label text, stmt text) returns void
language plpgsql as $$ begin
  execute stmt;
  raise notice 'PASS %', label;
exception when others then
  raise notice 'FAIL % (% %)', label, sqlstate, sqlerrm;
end $$;

create function test.affected(label text, stmt text, expected bigint) returns void
language plpgsql as $$ declare n bigint; begin
  execute stmt;
  get diagnostics n = row_count;
  perform test.eq(label, n, expected);
exception when others then
  raise notice 'FAIL % (% %)', label, sqlstate, sqlerrm;
end $$;

create function test.login(p_uid uuid) returns void
language sql as $$ select set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), false) $$;

grant execute on all functions in schema test to authenticated, anon;

