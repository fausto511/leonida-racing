-- DEC-0256 (Fausto 25.11.2026): standouts are normal vehicles rows + base model, set, location.
create table public.standout_sets (
  name text primary key,
  verified boolean not null default false,  -- true once seen in-game (panel / Progress menu)
  note text
);
alter table public.standout_sets enable row level security;
create policy standout_sets_public_read on public.standout_sets for select using (true);

insert into public.standout_sets (name, note) values
 ('Leonida Man',null),('Ultra-Luxe',null),('Blinged Up',null),('Girlypop',null),('Retro',null),
 ('Ripped & Shredded','also written "Ripped and Shredded"'),('All-Terrain',null),('Street Racer',null),('Patriot',null),
 ('Swamp Style',null),('Fine Art',null),('Hot Rods',null),('Clout Chaser',null),('Chopper',null),
 ('DriveShaft Famous',null),('Race Bikes',null),('Demolition Derby',null),('Pedal Power',null),('Donks',null),
 ('Lowriders',null),('Stock Car',null),('Topper',null),('Mudder',null),('Throwback',null),('Law & Order',null);

alter table public.vehicles
  add column base_vehicle_id text references public.vehicles(vehicle_id) on update cascade,
  add column standout_set text references public.standout_sets(name) on update cascade,
  add column location_text text,
  add column location_video_url text,
  add constraint vehicles_standout_not_self check (base_vehicle_id is null or base_vehicle_id <> vehicle_id);

comment on column public.vehicles.base_vehicle_id is 'Standout: base model (DEC-0256). Set only when unambiguous.';
comment on column public.vehicles.standout_set is 'Standout set from Map > Progress > Vehicles > Standout (DEC-0256).';
comment on column public.vehicles.location_text is 'Standout: where to find it, own description. Map image: images/standouts/<id>-map.webp';
create index vehicles_base_vehicle_id_idx on public.vehicles(base_vehicle_id) where base_vehicle_id is not null;
