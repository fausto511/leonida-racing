-- RS-0073 (Fausto 16.10.2026): Progen Emerus. Seen in the Launch Trailer at 0:46
-- (checked by Fausto and Codex). Make, class, seats and drive taken over from
-- GTA V / GTA Online like other returning cars (GTABase: Super, 2 seats, RWD).
-- No photo: the car is only partly visible in the frame (Fausto).
insert into public.vehicles (vehicle_id, source_nr, make, model, manufacturer_logo_slug, release_id, first_seen_in,
  first_seen_url, first_seen_timestamp, real_life_inspiration, classes, seats, drive, has_photo, previous_games)
values ('progen-emerus', 120, 'Progen', 'Emerus', 'progen', 'base-game', 'Launch Trailer',
  'https://www.youtube.com/watch?v=rz1B4B2yBZY&t=46s', '0:46', 'McLaren Senna', array['Super'], 2, 'RWD', false, array['gta-online'])
on conflict (vehicle_id) do nothing;
