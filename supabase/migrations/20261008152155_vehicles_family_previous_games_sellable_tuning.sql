-- Fausto 2026-10-08: model families, New vs Returning (earlier GTA titles), sellable, tuning state per measured value.
alter table public.vehicles
  add column if not exists family text,
  add column if not exists previous_games text[],
  add column if not exists sellable text;

alter table public.vehicles add constraint vehicles_family_check
  check (family is null or (family ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(family) <= 40));
-- previous_games: NULL = not researched yet; '{}' = new in GTA VI; otherwise earlier titles (same model name).
alter table public.vehicles add constraint vehicles_previous_games_check
  check (previous_games is null or previous_games <@ array['gta1','gta-london-1969','gta-london-1961','gta2','gta3','gta-vc','gta-sa','gta-advance','gta-lcs','gta-vcs','gta4','gta4-tlad','gta4-tbogt','gta-ctw','gta5','gta-online']);
-- sellable: NULL = unknown
alter table public.vehicles add constraint vehicles_sellable_check
  check (sellable is null or sellable in ('yes','no'));

alter table public.vehicle_values
  add column if not exists tuning text not null default 'stock';
alter table public.vehicle_values add constraint vehicle_values_tuning_check
  check (tuning in ('stock','tuned'));

create or replace function public.vehicle_values_supersede()
 returns trigger language plpgsql security definer set search_path to 'public'
as $function$
begin
  if new.status = 'current' then
    update public.vehicle_values set status = 'superseded'
    where vehicle_id = new.vehicle_id and metric = new.metric and tuning = new.tuning
      and status = 'current' and value_id <> new.value_id;
  end if;
  return new;
end; $function$;
