-- Removes the KPI Interview intake tool's table. The tool itself
-- (app/kpi-intake, app/kpi-intake-admin, the "Interviews" nav link) was
-- deleted from the app on 2026-08-28, per Teather -- it had zero real
-- submissions, so nothing is lost. Run once in Supabase: Project -> SQL
-- Editor -> New query -> paste -> Run.

drop table if exists kpi_leads;
