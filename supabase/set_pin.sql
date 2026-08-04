create or replace function set_pin(input_name text, new_pin text)
returns void as $$
  update team_members
  set pin_hash = crypt(new_pin, gen_salt('bf'))
  where name = input_name and is_active = true;
$$ language sql security definer;

grant execute on function set_pin(text, text) to anon;
