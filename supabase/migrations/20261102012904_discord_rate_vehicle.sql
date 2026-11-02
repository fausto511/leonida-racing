-- Vehicle ratings from Discord (Fausto 02.11.2026, RS-0100): the /car card and single "New in Cars"
-- posts carry a "Rate this car" select. Same table and rules as the website (one rating per account
-- and vehicle, overwrite allowed, only officially shown vehicles, only once ratings_open()).
-- The Discord ID is mapped to the driver account like the event sign-up buttons do.
create or replace function public.discord_rate_vehicle(p_discord_id text, p_vehicle text, p_stars integer)
 returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  d uuid; prev smallint; s record;
begin
  if p_stars is null or p_stars < 1 or p_stars > 5 then return jsonb_build_object('status', 'invalid'); end if;
  select driver_id into d from public.drivers where discord_user_id = p_discord_id and deleted_at is null;
  if d is null then return jsonb_build_object('status', 'no_profile'); end if;
  if not exists (select 1 from public.vehicles where vehicle_id = p_vehicle and release_id is not null) then
    return jsonb_build_object('status', 'not_found');
  end if;
  if not public.ratings_open() then return jsonb_build_object('status', 'not_open'); end if;
  select stars into prev from public.vehicle_ratings where driver_id = d and vehicle_id = p_vehicle;
  insert into public.vehicle_ratings (driver_id, vehicle_id, stars) values (d, p_vehicle, p_stars)
    on conflict (driver_id, vehicle_id) do update set stars = excluded.stars;
  select rating_avg, rating_count into s from public.public_vehicle_ratings where vehicle_id = p_vehicle;
  return jsonb_build_object('status', 'saved', 'stars', p_stars, 'prev', prev, 'avg', s.rating_avg, 'count', s.rating_count);
end $$;
revoke all on function public.discord_rate_vehicle(text, text, integer) from public, anon, authenticated;
grant execute on function public.discord_rate_vehicle(text, text, integer) to service_role;
