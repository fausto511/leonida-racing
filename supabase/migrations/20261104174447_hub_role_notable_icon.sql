-- DEC-0215 (Fausto 04.11.2026): role for well-known people of the GTA racing scene
-- (creators, hosts, insiders). Internal key 'notable', shown as "ICON" on the site and
-- "Icon" on Discord -- the label can change without touching the data.
-- Granted and revoked only by moderators (existing hub_roles policies).
alter table public.hub_roles drop constraint hub_roles_role_check;
alter table public.hub_roles add constraint hub_roles_role_check
  check (role = any (array['crew_leader'::text, 'crew_commissioner'::text, 'event_host'::text, 'creator'::text, 'notable'::text]));

-- Public list of ICON drivers (driver_id only; names come from the views that already show them).
-- Same owner-rights pattern as public_drivers / public_crew_roster.
create view public.public_icons as
  select r.driver_id
    from public.hub_roles r
    join public.drivers d on d.driver_id = r.driver_id
   where r.role = 'notable' and d.deleted_at is null;
comment on view public.public_icons is 'Drivers with the ICON role (hub_roles.role = notable, DEC-0215). Public: driver_id only.';
grant select on public.public_icons to anon, authenticated;
