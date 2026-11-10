-- Security lockdown, step 1: tables the server needs to keep people signed in
-- and to limit wrong-PIN guessing. RLS is on with NO policies, so the public
-- (anon) key can't read or write them at all -- only the server, using the
-- secret key, can.
-- Run once in Supabase: Project -> SQL Editor -> New query -> paste -> Run.

create table if not exists app_sessions (
  token_hash text primary key,
  person_id uuid,
  person_name text not null,
  role text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ceo_name text,
  ceo_until timestamptz
);
create index if not exists app_sessions_expires_idx on app_sessions (expires_at);

create table if not exists login_attempts (
  id bigserial primary key,
  bucket text not null,
  success boolean not null,
  at timestamptz not null default now()
);
create index if not exists login_attempts_bucket_idx on login_attempts (bucket, at desc);

alter table app_sessions enable row level security;
alter table login_attempts enable row level security;
