-- RS-0074 (DEC-0132, 2026-10-17): prepare in-game vehicle stats and other vehicle names for the launch.
-- No values are added here; stats and ratings are entered after the launch (Moderator > Vehicles).

-- 1) In-game stats (0-10, one decimal in the game) and the two in-game ratings (road / off-road).
--    tuning keeps its meaning: 'stock' = no upgrades, 'tuned' = fully tuned (DEC-0113, DEC-0132).
alter table public.vehicle_values drop constraint vehicle_values_metric_check;
alter table public.vehicle_values add constraint vehicle_values_metric_check check (metric in (
  'price_gtad', 'sell_price_gtad', 'top_speed_mph', 'gellhorn_reference_lap_ms',
  'stat_speed', 'stat_acceleration', 'stat_handling_asphalt', 'stat_handling_offroad', 'stat_strength',
  'rating_road', 'rating_offroad'));

-- Stats may be 0 and never exceed 10; ratings may be 0 (upper bound unknown); everything else stays > 0.
alter table public.vehicle_values drop constraint vehicle_values_value_check;
alter table public.vehicle_values add constraint vehicle_values_value_check check (
  case
    when metric in ('stat_speed', 'stat_acceleration', 'stat_handling_asphalt', 'stat_handling_offroad', 'stat_strength')
      then value >= 0 and value <= 10
    when metric in ('rating_road', 'rating_offroad') then value >= 0
    else value > 0
  end);

-- 2) Other names of a vehicle: names from earlier games, unconfirmed names, other spellings.
--    Used for search and for matching names read from screenshots; the official name stays in "model".
alter table public.vehicles add column other_names text[] not null default '{}'
  constraint vehicles_other_names_max check (cardinality(other_names) <= 10);
comment on column public.vehicles.other_names is
  'Other names (earlier games, unconfirmed/leaked names, spellings). Search + screenshot matching only; official name = model. RS-0074.';
-- Table-level grants on public.vehicles already cover the new column (checked 2026-10-17).

update public.vehicles set other_names = array['Cheetah Classic', '''95 Cheetah'] where vehicle_id = 'grotti-cheetah-95';
update public.vehicles set other_names = array['''90 Elegy'] where vehicle_id = 'annis-elegy-retro-custom';
