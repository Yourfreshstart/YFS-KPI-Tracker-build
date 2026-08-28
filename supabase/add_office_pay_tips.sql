-- Adds Office Pay and Tips (Monday-only, like the rest of the payroll
-- block) so COGS can be computed correctly, and adds a new "Office
-- Payroll %" True KPI next to COGS on the CEO Dashboard.
-- Run once in Supabase: Project -> SQL Editor -> New query -> paste -> Run.

alter table daily_entries
  add column if not exists office_pay numeric,
  add column if not exists tips numeric;

-- Make room for the new KPI right after COGS (payroll_pct, sort_order 2)
-- by shifting everything from avg_rev_per_rge onward up by one.
update kpi_config set sort_order = sort_order + 1 where sort_order >= 3;

insert into kpi_config (
  kpi_key, name, group_name, sort_order, cadence,
  target_label, good_label, watch_label, critical_label,
  owner, off_track_action,
  critical_below, warning_below, warning_above, critical_above
) values (
  'office_payroll_pct', 'Office Payroll %', 'Revenue & Profitability', 3, 'weekly',
  '10–11%', '10–11%', '11–12%', '< 10% or > 12%',
  'Jennifer',
  E'Below 10%: we need to hire someone in the office, or office staff is not being paid enough.\n\nWatch (11–12%): possible office staff is being paid more than the company can afford.\n\nAbove 12%: there are too many office staff, or they are being paid more than recommended.',
  10, null, 11, 12
);

-- Rename the existing "Payroll as % of Revenue" KPI's display name to
-- COGS -- its target band (48-52%) is unchanged; this is what it always
-- should have measured, now that Workers Comp/Office Pay/Tips are folded
-- into the calculation correctly (see lib/metrics.ts).
update kpi_config set name = 'COGS' where kpi_key = 'payroll_pct';
