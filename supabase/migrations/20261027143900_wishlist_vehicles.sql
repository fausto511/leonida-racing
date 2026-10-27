-- RS-0087 (2026-10-27): Wishlist -- cars a driver wants next (Fausto).
-- Private like My Garage (owned_vehicles, RS-0032): only the driver sees his own list.
-- Marking a car as owned takes it off the wishlist (trigger below), so the two lists never overlap.

create table public.wishlist_vehicles (
  driver_id  uuid not null references public.drivers (driver_id) on delete cascade,
  vehicle_id text not null references public.vehicles (vehicle_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (driver_id, vehicle_id)
);
create index wishlist_vehicles_vehicle_idx on public.wishlist_vehicles (vehicle_id);
comment on table public.wishlist_vehicles is 'Vehicles a driver wants (self-declared, private). RS-0087.';

alter table public.wishlist_vehicles enable row level security;
create policy wishlist_vehicles_select on public.wishlist_vehicles
  for select using (driver_id = public.current_driver_id());
create policy wishlist_vehicles_insert on public.wishlist_vehicles
  for insert with check (driver_id = public.current_driver_id());
create policy wishlist_vehicles_delete on public.wishlist_vehicles
  for delete using (driver_id = public.current_driver_id());
revoke all on public.wishlist_vehicles from anon, authenticated;
grant select, insert, delete on public.wishlist_vehicles to authenticated;

-- Owning a car removes it from the wishlist (runs as the inserting driver; RLS allows deleting own rows).
create or replace function public.owned_vehicle_clears_wishlist()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  delete from public.wishlist_vehicles
   where driver_id = new.driver_id and vehicle_id = new.vehicle_id;
  return new;
end $$;
revoke all on function public.owned_vehicle_clears_wishlist() from public, anon, authenticated;

create trigger owned_vehicle_clears_wishlist
  after insert on public.owned_vehicles
  for each row execute function public.owned_vehicle_clears_wishlist();

-- Account deletion (DEC-0079): also remove the wishlist. Body unchanged apart from the one new line.
create or replace function public.anonymize_driver_account(p_driver uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not exists (select 1 from public.drivers where driver_id = p_driver and deleted_at is null) then
    raise exception 'no active driver %', p_driver;
  end if;

  delete from public.hub_event_rsvps     where driver_id = p_driver;
  delete from public.owned_vehicles      where driver_id = p_driver;
  delete from public.wishlist_vehicles   where driver_id = p_driver;
  delete from public.vehicle_ratings     where driver_id = p_driver;
  delete from public.run_reports         where reporter_driver_id = p_driver;
  delete from public.content_reports     where reporter_driver_id = p_driver;
  delete from public.hub_events          where created_by = p_driver;
  delete from public.community_tracks    where created_by = p_driver;
  delete from public.hub_role_requests   where driver_id = p_driver;
  delete from public.hub_roles           where driver_id = p_driver;
  delete from public.crew_memberships    where driver_id = p_driver;
  delete from public.crew_membership_history where driver_id = p_driver;
  delete from public.moderators          where driver_id = p_driver;

  -- crew and event restrictions (DEC-0144, Codex privacy review 20.10.)
  delete from public.crew_bans       where driver_id = p_driver;
  update public.crew_bans       set banned_by = null where banned_by = p_driver;
  delete from public.hub_event_kicks where driver_id = p_driver;
  update public.hub_event_kicks set kicked_by = null where kicked_by = p_driver;
  delete from public.hub_event_bans  where driver_id = p_driver or host_driver_id = p_driver;

  update public.discord_feeds
     set created_by_discord_id = null, created_by_driver_id = null
   where created_by_driver_id = p_driver
      or created_by_discord_id = (select discord_user_id from public.drivers where driver_id = p_driver);

  delete from public.runs
   where driver_id = p_driver
     and review_status in ('draft', 'submitted', 'under_review', 'needs_correction');

  update public.evidence e set storage_reference = null, retention_state = 'deleted', delete_after = now()
    from public.runs r
   where r.run_id = e.run_id and r.driver_id = p_driver and e.type = 'screenshot';
  delete from public.evidence e using public.runs r
   where r.run_id = e.run_id and r.driver_id = p_driver and e.type = 'video_link';

  update public.drivers
     set display_name = 'Deleted driver', discord_user_id = null, auth_user_id = null,
         deleted_at = now()
   where driver_id = p_driver;
  delete from public.driver_name_history where driver_id = p_driver;
end $function$;
