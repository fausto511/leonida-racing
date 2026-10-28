alter table public.video_channels add column if not exists cars_only boolean not null default false;
comment on column public.video_channels.cars_only is 'Only post videos whose title mentions a car/racing term (combined with gta_only = GTA + cars).';
