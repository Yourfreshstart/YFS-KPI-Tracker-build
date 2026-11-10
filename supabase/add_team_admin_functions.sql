-- People management from Lists/Admin: a function that creates a new team
-- member with a hashed PIN (the screen calls it through the server). Only the
-- server's secret key can run it -- the public key is not given access.
-- Run once in Supabase: Project -> SQL Editor -> New query -> paste -> Run.

create or replace function add_team_member(input_name text, input_pin text, input_role text default 'staff')
returns void as $$
  insert into team_members (name, role, pin_hash)
  values (input_name, input_role, crypt(input_pin, gen_salt('bf')));
$$ language sql security definer;

revoke execute on function add_team_member(text, text, text) from public, anon, authenticated;
grant execute on function add_team_member(text, text, text) to service_role;
