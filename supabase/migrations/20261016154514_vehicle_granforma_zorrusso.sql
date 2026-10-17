-- RS-0073 (Fausto 16.10.2026): GranForma Zorrusso as a provisional second entry
-- next to the Pegassi Zorrusso. Same car (same sighting, same specs), only the
-- rear branding differs (Bloomberg screenshots, 14 Oct 2026). One entry will be
-- removed later with a redirect, or both stay if both exist in the game.
-- No usable logo yet: manufacturer_logo_slug 'granforma' -> transparent placeholder.
insert into public.vehicles (vehicle_id, source_nr, make, model, manufacturer_logo_slug, release_id, first_seen_in,
  first_seen_url, first_seen_timestamp, real_life_inspiration, classes, seats, drive, acquisition, has_photo,
  family, previous_games, sellable)
select 'granforma-zorrusso', 119, 'GranForma', 'Zorrusso', 'granforma', release_id, first_seen_in,
  first_seen_url, first_seen_timestamp, real_life_inspiration, classes, seats, drive, acquisition, true,
  family, previous_games, sellable
from public.vehicles where vehicle_id = 'pegassi-zorrusso'
on conflict (vehicle_id) do nothing;
