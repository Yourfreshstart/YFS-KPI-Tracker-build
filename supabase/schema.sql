-- Your Fresh Start KPI Tracker — database schema
-- Run this once in Supabase: Project → SQL Editor → New query → paste → Run

-- ============================================================
-- Team members (Daily Entry sign-in + CEO Dashboard / Lists-Admin PIN)
-- ============================================================
create table team_members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null,               -- 'owner' or 'staff'
  pin_hash text not null,           -- 4-digit PIN, hashed (never stored plain)
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Daily Entry — one row per weekday. This is the ONLY place
-- numbers get typed in; every other screen is computed from this.
-- ============================================================
create table daily_entries (
  entry_date date primary key,
  entered_by uuid references team_members(id),
  last_edited_by uuid references team_members(id),
  last_edited_at timestamptz not null default now(),

  -- Revenue
  daily_revenue numeric not null default 0,

  -- Sales & Leads funnel (Leads In -> Contacted/Quoted -> Booked)
  leads_in integer not null default 0,
  contacted integer not null default 0,               -- "Quoted"
  new_lead_recurring_commitment integer not null default 0,
  one_time_booked integer not null default 0,

  -- Scheduling & Cleans
  initial_cleans integer not null default 0,
  converted_initial_to_recurring integer not null default 0,
  recurring_added integer not null default 0,
  recurring_lost integer not null default 0,
  total_recurring_clients integer not null default 0, -- manually entered daily (running count)
  cleans_completed integer not null default 0,
  skips integer not null default 0,
  route_changes integer not null default 0,

  -- Incidents (counts only — no technician names, by design)
  care_opportunities integer not null default 0,
  breakage_damage integer not null default 0,
  call_offs integer not null default 0,

  -- Staffing & Hiring
  rge_headcount integer not null default 0,
  interviews_scheduled integer not null default 0,
  actual_interviews integer not null default 0,
  new_hires integer not null default 0,

  -- Monday-only payroll block (null every other day)
  total_payroll_taxes numeric,
  workers_comp_due numeric,
  highest_paid_cleaner numeric,
  trainees_paid integer,
  total_trainee_pay numeric,
  rges_tier1 integer,
  rges_tier2 integer,
  rges_tier3 integer
);

-- ============================================================
-- KPI config — the 13 True KPIs: targets, good/watch/critical
-- bands, owner, and the off-track action text. This is what
-- Lists/Admin edits and what the CEO Dashboard reads from.
-- ============================================================
create table kpi_config (
  kpi_key text primary key,
  name text not null,
  group_name text not null,
  sort_order integer not null,
  cadence text not null,             -- 'weekly' or 'monthly'
  target_label text not null,
  good_label text,
  watch_label text,
  critical_label text,
  owner text not null default 'Jennifer',
  off_track_action text not null default ''
);

insert into kpi_config (kpi_key, name, group_name, sort_order, cadence, target_label, good_label, watch_label, critical_label, owner, off_track_action) values
('gross_revenue', 'Gross Revenue', 'Revenue & Profitability', 1, 'weekly', '$17,500/wk', '≥ $17,500', '$16,500–17,499', '< $16,500', 'Jennifer',
 'Push short-term sales: small discount offers, priority-clean emails to the list, upsell add-ons (oven, fridge, windows, etc.) on upcoming jobs.'),
('payroll_pct', 'Payroll as % of Revenue', 'Revenue & Profitability', 2, 'weekly', '48–52%', '48–52%', '45–47.9% or 52.1–55%', '< 45% or > 55%', 'Jennifer',
 E'Below 48%: technicians aren''t being paid enough — expect turnover. Get deserving techs moved up into Tier 2/3.\n\nAbove 52%: likely underhired (overload is pushing too many techs into Tier 3). Start hiring ASAP.'),
('avg_rev_per_rge', 'Average Revenue per RGE', 'Revenue & Profitability', 3, 'weekly', '$1,400/wk', '≥ $1,400', '$1,300–1,399', '< $1,300', 'Jennifer',
 E'Watch ($1,300–1,399): may mean we''re slightly overhired or the schedule isn''t optimized.\n\nCritical (< $1,300): check schedule optimization and staffing levels. If overhired, make sure top-performing techs get full hours first.'),
('total_recurring_clients', 'Total Recurring Clients', 'Growth & Retention', 4, 'monthly', 'Growing month over month', 'Growing', 'Flat (same as last month)', 'Declining (fewer than last month)', 'Jennifer',
 'Follow up after every initial clean. Check the Lead → Quote → Booking ratio and the Initial-to-Recurring ratio to find where clients are being lost. Also check Attrition Rate for the same period.'),
('net_recurring_growth', 'Net Recurring Growth', 'Growth & Retention', 5, 'monthly', '+3 or more', '+3 or more', '0 to +2', 'Negative', 'Jennifer',
 'Same as Total Recurring Clients: follow up after every initial clean, check Lead → Quote → Booking and Initial-to-Recurring ratios, and check Attrition Rate for the same period.'),
('attrition_rate', 'Attrition Rate', 'Growth & Retention', 6, 'monthly', '< 3%/month', '≤ 3%', '3–3.75%', '> 3.75%', 'Jennifer',
 E'Watch (3–3.75%): keep an eye on it, don''t let it cross 3.75%.\n\nCritical (> 3.75%): likely a quality/consistency/service issue. Are we sending the same technician? Has a quality check-in call been done? What was the client''s last interaction with the office or tech?'),
('initial_to_recurring', 'Initial-to-Recurring Conversion', 'Growth & Retention', 7, 'monthly', '≥ 50%', '≥ 50%', '44–49.9%', '< 44%', 'Jennifer',
 'Watch (44–49.9%): check Care Opportunity volume and whether Open-to-Close forms are being completed.\n\nCritical (< 44%): likely a quality or customer service issue. Follow up with technicians on what''s happening in the field, confirm Open-to-Close forms are followed, and confirm we''re calling clients about breakage or cleaning issues.'),
('contact_rate', 'Contact Rate', 'Sales Funnel', 8, 'weekly', '≥ 50%', '≥ 50%', '44–49.9%', '< 44%', 'Jennifer',
 E'Critical (< 44%): are we responding to leads fast enough? SLA is within 1 hour during business hours, within 24 hours if after-hours/weekend. Faster response = more likely to reach the lead.\n\nWatch (44–49.9%): usually the same root cause (response time), just less severe.'),
('lead_to_booking', 'Lead-to-Booking Conversion', 'Sales Funnel', 9, 'weekly', '≥ 25%', '≥ 25%', '21–24%', '< 21%', 'Jennifer',
 'Watch and Critical: check Contact Rate, Contact-to-Booking, and Initial-to-Recurring Conversion to isolate where in the funnel the drop-off is happening, then act on that specific stage.'),
('contact_to_booking', 'Contact-to-Booking', 'Sales Funnel', 10, 'weekly', '50%', '45–70%', '40–45% or > 70%', '≤ 40%', 'Jennifer',
 E'Watch, low side (40–45%): review sales calls and customer service quality — may mean pricing is too high.\n\nWatch, high side (> 70%): may mean pricing is too low — consider testing higher pricing.\n\nCritical (≤ 40%): check how quickly we''re following up with the client, and confirm the sales pitch covers real schedule availability (openings within the next 7 business days).'),
('interview_show_up', 'Interview Show-Up Rate', 'Team & Hiring', 11, 'weekly', '≥ 45%', '≥ 45%', '40–44%', '< 40%', 'Jennifer',
 'Watch (40–44%): hiring ad may not be optimized.\n\nCritical (< 40%): hiring ad needs work, and pay may not be competitive enough — consider whether prices need to rise so technician pay/commission can increase.'),
('rges_tier3_pct', '% RGEs at Tier 3', 'Team & Hiring', 12, 'weekly', '30–60%', '30–60%', null, '< 30% or ≥ 60%', 'Jennifer',
 E'Below 30%: techs will feel undervalued and the job won''t feel worth it. Move high performers into Tier 3; keep low performers at Tier 1/low Tier 2.\n\n60% or above: likely understaffed — start hiring. Also double-check tier assignments are earned correctly (high performers at Tier 3, low performers at Tier 1/2).'),
('hire_conversion', 'Hire Conversion Rate', 'Team & Hiring', 13, 'monthly', '≥ 12%', '≥ 12%', '8–11%', '< 8%', 'Jennifer',
 'Watch (8–11%): may mean we''re being too picky — review whether we''re asking the right interview questions.\n\nCritical (< 8%): we''re probably the problem — the interview questions likely need to be reworked.');

-- ============================================================
-- Row Level Security
-- MVP note: this app uses its own 4-digit PIN gate in the UI,
-- not Supabase Auth, so RLS can't check "who is this user" the
-- normal way. For now these tables are readable/writable by
-- anyone holding the app's public (anon) key — the PIN screens
-- are the real gate. Fine for an internal tool on an unlisted
-- URL; revisit if this ever needs to be locked down harder.
-- ============================================================
alter table team_members enable row level security;
alter table daily_entries enable row level security;
alter table kpi_config enable row level security;

create policy "public read team_members" on team_members for select using (true);
create policy "public read daily_entries" on daily_entries for select using (true);
create policy "public write daily_entries" on daily_entries for insert with check (true);
create policy "public update daily_entries" on daily_entries for update using (true);
create policy "public read kpi_config" on kpi_config for select using (true);
create policy "public update kpi_config" on kpi_config for update using (true);
