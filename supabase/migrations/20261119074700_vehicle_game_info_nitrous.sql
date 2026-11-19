-- Tuning garage (2026-11-19, Fausto): in-game vehicle info + nitrous boost values.
-- Values are recorded stock first (tuning = 'stock'); tuned values follow later.
-- Applied by Fausto in the SQL editor on 2026-11-19 ~07:47 UTC (see supabase/MIGRATIONS.md, special cases).

-- 1) In-game vehicle info (null = not recorded yet)
alter table public.vehicles
  add column if not exists storage smallint
    constraint vehicles_storage_check check (storage is null or storage between 0 and 50),
  add column if not exists era text
    constraint vehicles_era_check check (era is null or char_length(era) between 1 and 40),
  add column if not exists game_type text
    constraint vehicles_game_type_check check (game_type is null or char_length(game_type) between 1 and 40),
  add column if not exists nitrous_available boolean;

comment on column public.vehicles.storage is 'Storage slots as shown in game. Null = not recorded yet.';
comment on column public.vehicles.era is 'Era as shown in game, e.g. "1970s Antique". Null = not recorded yet.';
comment on column public.vehicles.game_type is 'Vehicle type as shown in game, e.g. "Muscle". Compared with classes; game wins.';
comment on column public.vehicles.nitrous_available is 'Nitrous Boost offered in the tuning garage. Null = unknown.';

-- 2) Nitrous boost per car (blue plus in the tuning preview, 0-10)
alter table public.vehicle_values drop constraint vehicle_values_metric_check;
alter table public.vehicle_values add constraint vehicle_values_metric_check check (metric in (
  'price_gtad', 'sell_price_gtad', 'top_speed_mph', 'gellhorn_reference_lap_ms',
  'stat_speed', 'stat_acceleration', 'stat_handling_asphalt', 'stat_handling_offroad', 'stat_strength',
  'rating_road', 'rating_offroad',
  'boost_speed', 'boost_acceleration'));

alter table public.vehicle_values drop constraint vehicle_values_value_check;
alter table public.vehicle_values add constraint vehicle_values_value_check check (
  case
    when metric in ('stat_speed', 'stat_acceleration', 'stat_handling_asphalt', 'stat_handling_offroad', 'stat_strength',
                    'boost_speed', 'boost_acceleration')
      then value >= 0 and value <= 10
    when metric in ('rating_road', 'rating_offroad') then value >= 0
    else value > 0
  end);
