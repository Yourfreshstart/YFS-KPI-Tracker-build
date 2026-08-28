-- Employee Pulse Survey. Two new tables:
--   rge_roster       -- synced automatically from the Payroll tool every time
--                     it's run, so there's never any manual add/remove for
--                     new hires or turnover.
--   pulse_responses  -- one row per person per survey date (not anonymous).
-- Same open-RLS pattern as every other table in this app, per Teather
-- (2026-08-28) -- she reviewed and declined tightening this one specifically.
-- Run once in Supabase: Project -> SQL Editor -> New query -> paste -> Run.

create table if not exists rge_roster (
  name text primary key,
  last_seen_date date not null
);

alter table rge_roster enable row level security;
create policy "public read rge_roster" on rge_roster for select using (true);
create policy "public insert rge_roster" on rge_roster for insert with check (true);
create policy "public update rge_roster" on rge_roster for update using (true);

create table if not exists pulse_responses (
  id uuid primary key default gen_random_uuid(),
  respondent_name text not null,
  survey_date date not null default current_date,
  happiness smallint not null check (happiness between 1 and 5),
  leadership_support smallint not null check (leadership_support between 1 and 5),
  job_manageability smallint not null check (job_manageability between 1 and 5),
  likelihood_to_stay smallint not null check (likelihood_to_stay between 1 and 5),
  likelihood_to_recommend smallint not null check (likelihood_to_recommend between 0 and 10),
  feedback_text text,
  submitted_at timestamptz not null default now(),
  unique (respondent_name, survey_date)
);

alter table pulse_responses enable row level security;
create policy "public read pulse_responses" on pulse_responses for select using (true);
create policy "public insert pulse_responses" on pulse_responses for insert with check (true);
create policy "public update pulse_responses" on pulse_responses for update using (true);
-- Delete policy is for the automatic 1-year-after-departure retention
-- cleanup (app/api/cron/pulse-retention-cleanup) -- not used by either
-- app page directly.
create policy "public delete pulse_responses" on pulse_responses for delete using (true);
