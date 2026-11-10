-- Manual Active/Inactive override for the Employee Pulse page.
-- Normally a person is Active/Inactive automatically (Inactive once they've
-- missed the last 2 weekly payroll runs -- see lib/pulse.ts). This column
-- lets anyone on the Pulse page pin someone either way, e.g. keep a person
-- on leave Active. null = automatic (the default for everyone).
-- Run once in Supabase: Project -> SQL Editor -> New query -> paste -> Run.

alter table rge_roster
  add column if not exists pulse_status_override text
  check (pulse_status_override in ('active', 'inactive'));
