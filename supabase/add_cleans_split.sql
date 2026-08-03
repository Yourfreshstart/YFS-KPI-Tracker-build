alter table daily_entries
  add column recurring_cleans integer not null default 0,
  add column one_time_cleans integer not null default 0;
