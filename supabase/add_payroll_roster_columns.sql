-- Stores the Payroll tool's Active/Trainee choice (and which trainer) in the
-- database instead of only in one browser, so it's the same on every
-- computer. null = never set (treated as Active).
-- Run once in Supabase: Project -> SQL Editor -> New query -> paste -> Run.

alter table rge_roster
  add column if not exists payroll_status text check (payroll_status in ('active', 'trainee')),
  add column if not exists payroll_trainer text;
