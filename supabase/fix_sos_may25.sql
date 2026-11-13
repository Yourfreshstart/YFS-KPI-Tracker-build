-- SOS Pads, May 25, 2026: the spreadsheet showed a shelf count of 0.5 boxes,
-- which made that week look like 5.5 boxes used (a typo, per Teather).
-- Set the count to 5.75 so that week shows about a normal week's use
-- (0.25 box; SOS Pads average about 0.17 a week).
-- Run once in Supabase: Project -> SQL Editor -> New query -> paste -> Run.

update inventory_counts
set on_shelf = 5.75, updated_at = now()
where count_date = '2026-05-25'
  and supply_id = (select id from inventory_supplies where name = 'SOS Pads');
