-- Jan has left the company; Rachael has replaced her. Deactivate Jan's
-- team_members row (keeps her name intact on any past daily_entries /
-- payroll history rather than deleting it -- same pattern verify_pin and
-- set_pin already use, both check is_active = true) and add Rachael as
-- a new active team member with a starter PIN of 2468 -- change it any
-- time in Lists/Admin (the Team PINs section) once Rachael has one she
-- wants to use.
-- Run once in Supabase: Project -> SQL Editor -> New query -> paste -> Run.

update team_members set is_active = false where name = 'Jan';

insert into team_members (name, role, pin_hash)
values ('Rachael', 'staff', crypt('2468', gen_salt('bf')));
