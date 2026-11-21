-- In-game info page 1 + specialist (Fausto 21.11.2026). Applied via Supabase MCP (apply_migration) on 21.11.2026.
alter table public.vehicles
  add column if not exists specialist text,
  add column if not exists tracker text,
  add column if not exists key_cloner_required boolean;
alter table public.vehicles
  add constraint vehicles_specialist_check check (specialist is null or specialist = any (array['Luxury','Tuner','Off-Road','Muscle','Donks','Lowriders','None'])),
  add constraint vehicles_tracker_check check (tracker is null or (char_length(tracker) between 1 and 40));
comment on column public.vehicles.specialist is 'Mod shop specialist as shown in the game (info page).';
comment on column public.vehicles.tracker is 'Tracker as shown in the game (None, Advanced, ...).';
comment on column public.vehicles.key_cloner_required is 'Access shows "Key Cloner" (true). Locked/Unlocked is the state of one car, not stored.';
alter table public.vehicle_values drop constraint vehicle_values_metric_check;
alter table public.vehicle_values add constraint vehicle_values_metric_check check (metric = any (array['price_gtad','sell_price_gtad','register_cost_gtad','top_speed_mph','gellhorn_reference_lap_ms','stat_speed','stat_acceleration','stat_handling_asphalt','stat_handling_offroad','stat_strength','rating_road','rating_offroad','boost_speed','boost_acceleration']));
