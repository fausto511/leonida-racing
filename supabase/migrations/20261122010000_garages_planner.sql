-- RS-0088 Garage planner (Fausto 22.11.2026)
-- My cars stays unlimited. In addition a driver marks the garages he owns in the game
-- and sorts his cars into them. Each garage has a fixed number of spaces (strict).
-- Garage list and spaces: GTA VI guides, checked 22.11.2026 (Power Up Gaming, gta6guide.fr,
-- PowerPyx; GTABase for the list). Spelling (Mitchel/Mitchell) and the three bonus garages
-- (1 space, single source) still to be confirmed in game by Fausto. Prices: regular and
-- BuckMe Gold price (Power Up Gaming; Gold price matches GTABase, PowerPyx, gta6guide.fr).

create table if not exists public.garages (
  garage_id text primary key,
  name text not null,
  area text,
  kind text not null check (kind in ('purchase', 'story', 'bonus')),
  capacity int not null check (capacity between 1 and 20),
  price_gtad int check (price_gtad is null or price_gtad >= 0),
  price_gold_gtad int check (price_gold_gtad is null or price_gold_gtad >= 0),
  unlock text,
  sort int not null default 100,
  created_at timestamptz not null default now()
);
alter table public.garages enable row level security;
drop policy if exists garages_select on public.garages;
create policy garages_select on public.garages for select to anon, authenticated using (true);
grant select on public.garages to anon, authenticated;

insert into public.garages (garage_id, name, area, kind, capacity, price_gtad, price_gold_gtad, unlock, sort) values
  ('mitchel-auto-center',          'Mitchel Auto Center',          'Kelly County',                 'purchase', 1,  5000,  4000, 'Vice City Real Estate app, after "Daily Driver" (Chapter 2)', 10),
  ('persistence-road-garage',      'Persistence Road Garage',      'Belville',                     'purchase', 1,  9500,  7600, 'Vice City Real Estate app, after "Daily Driver" (Chapter 2)', 20),
  ('7th-avenue-garage',            '7th Avenue Garage',            'Salton, Vice City',            'purchase', 1, 15000, 12000, 'Vice City Real Estate app, after "Daily Driver" (Chapter 2)', 30),
  ('store-n-bolt',                 'Store n'' Bolt',               'Ambrosia',                     'purchase', 1, 21000, 16800, 'Vice City Real Estate app, after "Daily Driver" (Chapter 2)', 40),
  ('wyatt-motors',                 'Wyatt Motors',                 'Allied Crystal, Ambrosia',     'purchase', 1, 27000, 21600, 'Vice City Real Estate app, after "Daily Driver" (Chapter 2)', 50),
  ('vela-rota-drive-garage',       'Vela Rota Drive Garage',       'Capri',                        'purchase', 1, 30000, 24000, 'Vice City Real Estate app, after "Daily Driver" (Chapter 2)', 60),
  ('bonita-court-garage',          'Bonita Court Garage',          'Vice Beach',                   'purchase', 1, 42500, 34000, 'Vice City Real Estate app, after "Daily Driver" (Chapter 2)', 70),
  ('atlantic-court-garage',        'Atlantic Court Garage',        'Ocean Beach',                  'purchase', 1, 50000, 40000, 'Vice City Real Estate app, after "Daily Driver" (Chapter 2)', 80),
  ('port-gellhorn-station-garage', 'Port Gellhorn Station Garage', 'Port Gellhorn',                'story',    1, null,  null,  'Story: "Daily Driver" (Chapter 2)', 110),
  ('thompson-court-garage',        'Thompson Court Garage',        'Ocean Beach',                  'story',    2, null,  null,  'Story: "Company Cars" (Chapter 4)', 120),
  ('ne-15th-street-garage',        'NE 15th Street Garage',        'Stockyard, Vice City',         'story',    2, null,  null,  'Story: "Operation Savage Glory" (Chapter 5)', 130),
  ('pegassi-residences-garage',    'Pegassi Residences Garage',    'Tequesta Retreat, Vice City',  'story',    3, null,  null,  'Story: "Operation Savage Glory" (Chapter 5)', 140),
  ('shore-court-garage',           'Shore Court Garage',           'Ocean Beach',                  'bonus',    1, null,  null,  'Pre-order bonus (Vintage Vice City Pack)', 210),
  ('paradise-garage',              'Paradise Garage',              'Watson Bay',                   'bonus',    1, null,  null,  'Ultimate Edition', 220),
  ('gta-plus-crosstown-garage',    'GTA+ Crosstown Garage',        'Crosstown, Vice City',         'bonus',    1, null,  null,  'GTA+ membership, from Chapter 3', 230)
on conflict (garage_id) do nothing;

-- Garages a driver owns (each garage once per driver; no split between Jason and Lucia for now)
create table if not exists public.driver_garages (
  driver_id uuid not null references public.drivers(driver_id) on delete cascade,
  garage_id text not null references public.garages(garage_id) on update cascade,
  created_at timestamptz not null default now(),
  primary key (driver_id, garage_id)
);
alter table public.driver_garages enable row level security;
drop policy if exists driver_garages_select on public.driver_garages;
drop policy if exists driver_garages_insert on public.driver_garages;
drop policy if exists driver_garages_delete on public.driver_garages;
create policy driver_garages_select on public.driver_garages for select to authenticated using (driver_id = public.current_driver_id());
create policy driver_garages_insert on public.driver_garages for insert to authenticated with check (driver_id = public.current_driver_id());
create policy driver_garages_delete on public.driver_garages for delete to authenticated using (driver_id = public.current_driver_id());
grant select, insert, delete on public.driver_garages to authenticated;

-- Which garage a car stands in (optional). Removing a garage puts its cars back to "not in a garage".
alter table public.owned_vehicles add column if not exists garage_id text;
alter table public.owned_vehicles drop constraint if exists owned_vehicles_garage_fkey;
alter table public.owned_vehicles add constraint owned_vehicles_garage_fkey
  foreign key (driver_id, garage_id) references public.driver_garages(driver_id, garage_id)
  on update cascade on delete set null (garage_id);
create index if not exists owned_vehicles_garage_idx on public.owned_vehicles (driver_id, garage_id) where garage_id is not null;

-- Strict spaces: a garage never holds more cars than it has spaces.
-- The driver's garage row is locked, so two parallel moves cannot both take the last space.
create or replace function public.owned_vehicle_garage_capacity()
returns trigger language plpgsql security definer set search_path = public as $$
declare cap int; used int;
begin
  if new.garage_id is null then return new; end if;
  if tg_op = 'UPDATE' and new.garage_id is not distinct from old.garage_id then return new; end if;
  perform 1 from public.driver_garages where driver_id = new.driver_id and garage_id = new.garage_id for update;
  select capacity into cap from public.garages where garage_id = new.garage_id;
  select count(*) into used from public.owned_vehicles
    where driver_id = new.driver_id and garage_id = new.garage_id and vehicle_id <> new.vehicle_id;
  if used >= cap then
    raise exception 'garage_full' using errcode = 'P0001', detail = format('%s has %s spaces', new.garage_id, cap);
  end if;
  return new;
end $$;
drop trigger if exists owned_vehicle_garage_capacity on public.owned_vehicles;
create trigger owned_vehicle_garage_capacity before insert or update of garage_id on public.owned_vehicles
  for each row execute function public.owned_vehicle_garage_capacity();

-- Drivers may only change the garage of their own cars (no other column).
drop policy if exists owned_vehicles_update on public.owned_vehicles;
create policy owned_vehicles_update on public.owned_vehicles for update to authenticated
  using (driver_id = public.current_driver_id()) with check (driver_id = public.current_driver_id());
grant update (garage_id) on public.owned_vehicles to authenticated;
