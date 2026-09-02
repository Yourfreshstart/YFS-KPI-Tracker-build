-- Trainer milestone bonuses: $50 once a trainee's first day was 14+
-- calendar days ago, $175 once it was 90+. Adds the tracking rge_roster
-- needs -- first_seen_date (set once, automatically, by the Payroll tool
-- the first time a name appears in any run) and a resolved/pending status
-- per milestone so a flag keeps showing up every payroll run until
-- Teather confirms it (added to the trainer's check automatically) or
-- denies it. Run once in Supabase: Project -> SQL Editor -> New query ->
-- paste -> Run.

alter table rge_roster
  add column if not exists first_seen_date date,
  add column if not exists milestone14_status text,
  add column if not exists milestone90_status text;

-- Anyone already in rge_roster from before this feature existed has no
-- real "first day" on record. Best available estimate: their most recent
-- payroll appearance so far -- not their true hire date, so it may
-- understate how long they've actually been training. Only matters for
-- people still marked "trainee" in the Payroll tool's roster; harmless
-- for everyone else.
update rge_roster set first_seen_date = last_seen_date where first_seen_date is null;
