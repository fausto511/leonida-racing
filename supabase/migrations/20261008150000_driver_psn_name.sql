-- Optional PSN name in the driver profile (Fausto 08.10.2026, DEC-0112).
-- Entered by the driver in My Account > Settings, never required. Used only where it
-- helps others play with you: pre-filled as host PSN when creating an event, shown on
-- LFG posts in our Discord (once built). Not in any public view.
alter table public.drivers add column if not exists psn_name text
  check (psn_name is null or psn_name ~ '^[A-Za-z][A-Za-z0-9_-]{2,15}$');   -- same rule as hub_events.host_name

-- Account deletion clears it (anonymize_driver_account sets deleted_at).
create or replace function public.drivers_clear_psn_on_delete() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then new.psn_name := null; end if;
  return new;
end $$;
create trigger drivers_clear_psn_on_delete before update of deleted_at on public.drivers
  for each row execute function public.drivers_clear_psn_on_delete();

-- Security fix found on the way: signed-in drivers could update every column of their
-- own row (incl. discord_user_id, deleted_at). The site only ever changes display_name.
revoke update on public.drivers from authenticated;
grant update (display_name, psn_name) on public.drivers to authenticated;
