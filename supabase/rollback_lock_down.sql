-- UNDO for lock_down_public_access.sql: puts back the old open access for the
-- public key (the original, insecure setup). Only run this if the app stops
-- working after the lockdown and it can't be fixed another way.

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
grant execute on function verify_pin(text, text) to anon, authenticated;
grant execute on function set_pin(text, text) to anon, authenticated;

create policy "public read rge_roster" on rge_roster for select using (true);
create policy "public insert rge_roster" on rge_roster for insert with check (true);
create policy "public update rge_roster" on rge_roster for update using (true);
create policy "public read pulse_responses" on pulse_responses for select using (true);
create policy "public insert pulse_responses" on pulse_responses for insert with check (true);
create policy "public update pulse_responses" on pulse_responses for update using (true);
create policy "public delete pulse_responses" on pulse_responses for delete using (true);
create policy "public read team_members" on team_members for select using (true);
create policy "public read daily_entries" on daily_entries for select using (true);
create policy "public write daily_entries" on daily_entries for insert with check (true);
create policy "public update daily_entries" on daily_entries for update using (true);
create policy "public read kpi_config" on kpi_config for select using (true);
create policy "public update kpi_config" on kpi_config for update using (true);
