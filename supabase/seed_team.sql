-- Run this after schema.sql — sets up team PINs (hashed) and a safe way to check them

create extension if not exists pgcrypto;

insert into team_members (name, role, pin_hash) values
('Teather', 'owner', crypt('8495', gen_salt('bf'))),
('Jan', 'staff', crypt('1234', gen_salt('bf'))),
('Jennifer', 'staff', crypt('5678', gen_salt('bf')));

create or replace function verify_pin(input_name text, input_pin text)
returns table (id uuid, name text, role text) as $$
  select id, name, role
  from team_members
  where name = input_name
    and is_active = true
    and pin_hash = crypt(input_pin, pin_hash)
  limit 1;
$$ language sql security definer;

grant execute on function verify_pin(text, text) to anon;
