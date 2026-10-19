-- Fausto 18.10.2026: Jubilee, Windsor and Windsor Drop wear Buckingham branding in GTA VI
-- (Enus in GTA Online). Ids change to buckingham-*, old URLs redirect (site pages enus-jubilee/,
-- enus-windsor/). No runs, owned vehicles, ratings, values or observations reference the old ids
-- (checked 18.10.). Windsor Drop: first seen in Trailer 2 at 2:06, also Launch Trailer 0:48 (Fausto 19.10.); values from
-- GTA Online per DEC-0131 (Coupes, 4 seats, RWD, Rolls-Royce Dawn). No photo.
update public.vehicles set vehicle_id = 'buckingham-jubilee', make = 'Buckingham', manufacturer_logo_slug = 'buckingham' where vehicle_id = 'enus-jubilee';
-- Closed Windsor: its only sighting (Trailer 2 2:06) is the Windsor Drop with the soft top up (Fausto 19.10.).
-- Kept online as a returning GTA V model (Fausto), first-seen fields cleared instead of guessing.
update public.vehicles set vehicle_id = 'buckingham-windsor', make = 'Buckingham', manufacturer_logo_slug = 'buckingham', first_seen_in = null, first_seen_url = null, first_seen_timestamp = null where vehicle_id = 'enus-windsor';
insert into public.vehicles (vehicle_id, source_nr, make, model, manufacturer_logo_slug, release_id, first_seen_in,
  first_seen_url, first_seen_timestamp, real_life_inspiration, classes, seats, drive, has_photo, previous_games)
values ('buckingham-windsor-drop', 121, 'Buckingham', 'Windsor Drop', 'buckingham', 'base-game', 'Trailer 2',
  'https://www.youtube.com/watch?v=VQRLujxTm3c&t=126s', '2:06', 'Rolls-Royce Dawn', array['Coupes'], 4, 'RWD', false, array['gta-online'])
on conflict (vehicle_id) do nothing;
