-- KPI Interview intake -- lets Teather send a public link to another
-- cleaning business owner, have them fill it out themselves, and see every
-- submission in one place at /kpi-intake-admin (no copy/paste required).

create table kpi_leads (
  id uuid primary key default gen_random_uuid(),
  submitted_at timestamptz not null default now(),

  business_name text,

  svc_type text,
  recurring_mix text,
  team_size text,
  top_worry text,

  rev_normal text,
  rev_target text,
  rev_watch text,
  rev_critical text,
  rev_term text,
  payroll_pct text,
  rev_per_cleaner text,
  cleaner_term text,

  recurring_count text,
  growth_target text,
  attrition_target text,
  initial_conv text,

  lead_sources text,
  contact_rate text,
  lead_to_booking text,
  contact_to_booking text,

  cleans_per_week text,
  incident_tracking text,
  care_opp text,

  pay_structure text,
  interview_show text,
  hire_conv text,
  trainee_pay text,

  current_system text,
  whats_broken text,
  who_sees_it text,
  other_notes text
);

-- Same pattern as the rest of the app: no Supabase Auth, so RLS can't check
-- "who is this." Public insert so anyone with the link can submit; the
-- admin view is gated by Teather's PIN in the UI, not the database.
alter table kpi_leads enable row level security;
create policy "public insert kpi_leads" on kpi_leads for insert with check (true);
create policy "public read kpi_leads" on kpi_leads for select using (true);
