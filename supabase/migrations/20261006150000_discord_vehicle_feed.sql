-- Applied outside the live migration history (SQL editor), checked live 2026-10-17 (RS-0075).
-- RS-0067 / DEC-0106 (06.10.2026): Discord feed "New vehicles" (The Garage).
-- A vehicle is announced once it is officially shown (release_id set): on
-- insert with release_id, or when release_id changes from null (leak -> official).
-- The dispatcher waits until the vehicle page is live on the website (rebuild
-- every 3 h) and groups vehicles that become ready together into one digest.

alter table public.discord_feeds drop constraint if exists discord_feeds_source_check;
alter table public.discord_feeds add constraint discord_feeds_source_check
  check (source in ('crew', 'host', 'public', 'vehicles'));

alter table public.discord_outbox add column if not exists vehicle_id text;
alter table public.discord_outbox drop constraint if exists discord_outbox_kind_check;
alter table public.discord_outbox add constraint discord_outbox_kind_check
  check (kind in ('event', 'backfill', 'vehicle'));
alter table public.discord_outbox add constraint discord_outbox_vehicle_check
  check ((kind = 'vehicle') = (vehicle_id is not null));

create or replace function public.discord_enqueue_vehicle() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.release_id is not null and (tg_op = 'INSERT' or old.release_id is null)
     and not exists (select 1 from public.discord_outbox where kind = 'vehicle' and vehicle_id = new.vehicle_id) then
    insert into public.discord_outbox (kind, vehicle_id, not_before) values ('vehicle', new.vehicle_id, now() + interval '10 minutes');
  end if;
  return null;
end $$;
drop trigger if exists vehicles_discord on public.vehicles;
create trigger vehicles_discord after insert or update of release_id on public.vehicles
  for each row execute function public.discord_enqueue_vehicle();

-- Event/backfill rows as before; vehicle rows are claimed separately (all at once, for the digest).
create or replace function public.discord_claim_outbox(p_limit integer default 50)
returns setof public.discord_outbox language sql security definer set search_path = public as $$
  update public.discord_outbox o set processed_at = now(), attempts = o.attempts + 1
   where o.id in (select id from public.discord_outbox
                   where processed_at is null and not_before <= now() and kind <> 'vehicle'
                   order by id limit p_limit for update skip locked)
  returning o.*;
$$;
create or replace function public.discord_claim_vehicles()
returns setof public.discord_outbox language sql security definer set search_path = public as $$
  update public.discord_outbox o set processed_at = now(), attempts = o.attempts + 1
   where o.id in (select id from public.discord_outbox
                   where processed_at is null and not_before <= now() and kind = 'vehicle'
                   order by id limit 200 for update skip locked)
  returning o.*;
$$;
revoke all on function public.discord_claim_outbox(integer) from public, anon, authenticated;
revoke all on function public.discord_claim_vehicles() from public, anon, authenticated;
