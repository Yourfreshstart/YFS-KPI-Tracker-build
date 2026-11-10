-- SECURITY LOCKDOWN: switch off every way the public (anon) database key could
-- read or change data. After this, ONLY the app's own server (which holds the
-- secret key and checks who is signed in) can reach the data.
-- Run once in Supabase: Project -> SQL Editor -> New query -> paste -> Run.
-- If anything misbehaves afterward, run supabase/rollback_lock_down.sql.

-- 1. Remove test records left over from checking the new system.
delete from pulse_responses where respondent_name like 'Zz %';
delete from rge_roster where name like 'Zz %';
delete from app_sessions where person_name like 'Zz %';
delete from team_members where name like 'Zz %';

-- 2. Delete every open access rule on every table in the public schema.
do $$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies where schemaname = 'public' loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- 3. Make sure row-level security is ON for every table (on + no rules = nobody
--    but the server gets in).
do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', r.tablename);
  end loop;
end $$;

-- 4. Take away the public key's table permissions entirely, now and for any
--    table created later.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

-- 5. The PIN functions can no longer be called with the public key (this is
--    what let anyone check or change PINs). Only the server can.
revoke execute on function verify_pin(text, text) from public, anon, authenticated;
revoke execute on function set_pin(text, text) from public, anon, authenticated;
grant execute on function verify_pin(text, text) to service_role;
grant execute on function set_pin(text, text) to service_role;
