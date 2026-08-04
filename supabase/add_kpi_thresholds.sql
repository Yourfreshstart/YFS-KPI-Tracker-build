-- Adds the real numeric thresholds that drive CEO Dashboard status colors.
-- Until now, Lists/Admin's Good/Watch/Critical text was just descriptive —
-- the actual green/yellow/red logic was hardcoded in the app. This makes
-- the numbers below the single source of truth, editable from Lists/Admin.

alter table kpi_config
  add column if not exists critical_below numeric,
  add column if not exists warning_below numeric,
  add column if not exists warning_above numeric,
  add column if not exists critical_above numeric;

-- Seed with the exact numbers already in use, so nothing changes on the
-- dashboard today — only future edits from Lists/Admin will move these.
update kpi_config set critical_below = 16500, warning_below = 17500 where kpi_key = 'gross_revenue';
update kpi_config set critical_below = 45, warning_below = 48, warning_above = 52, critical_above = 55 where kpi_key = 'payroll_pct';
update kpi_config set critical_below = 1300, warning_below = 1400 where kpi_key = 'avg_rev_per_rge';
update kpi_config set critical_below = 0, warning_below = 3 where kpi_key = 'net_recurring_growth';
update kpi_config set warning_above = 3, critical_above = 3.75 where kpi_key = 'attrition_rate';
update kpi_config set critical_below = 44, warning_below = 50 where kpi_key = 'initial_to_recurring';
update kpi_config set critical_below = 44, warning_below = 50 where kpi_key = 'contact_rate';
update kpi_config set critical_below = 21, warning_below = 25 where kpi_key = 'lead_to_booking';
update kpi_config set critical_below = 40.1, warning_below = 45, warning_above = 70 where kpi_key = 'contact_to_booking';
update kpi_config set critical_below = 40, warning_below = 45 where kpi_key = 'interview_show_up';
update kpi_config set critical_below = 30, critical_above = 59.9 where kpi_key = 'rges_tier3_pct';
update kpi_config set critical_below = 8, warning_below = 12 where kpi_key = 'hire_conversion';
-- total_recurring_clients is intentionally left with no thresholds — its
-- status compares this month's count to last month's (growing/flat/declining),
-- not to a fixed number, so there's nothing to edit for it.
