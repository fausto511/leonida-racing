-- Video & stream feed (Fausto 28.10.2026): moderators keep a list of YouTube / Twitch channels;
-- discord-dispatch checks them every 10 minutes and posts new videos / go-live notices to every
-- Discord feed with source 'videos'.
alter table public.discord_feeds drop constraint discord_feeds_source_check;
alter table public.discord_feeds add constraint discord_feeds_source_check
  check (source = any (array['crew', 'host', 'public', 'vehicles', 'videos']));

create table public.video_channels (
  channel_id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('youtube', 'twitch')),
  input text not null check (length(input) between 2 and 300),   -- what the moderator entered (URL, @handle, login)
  external_id text,                                               -- YouTube UC... id / Twitch login, filled by the bot
  display_name text not null check (length(display_name) between 1 and 80),
  gta_only boolean not null default true,                         -- only post titles that mention GTA / Vice City / Leonida
  is_active boolean not null default true,
  primed boolean not null default false,                          -- first check done: existing videos recorded, not posted
  last_checked_at timestamptz,
  last_error text,
  created_by uuid references public.drivers(driver_id) on delete set null,
  created_at timestamptz not null default now(),
  unique (platform, external_id)
);
alter table public.video_channels enable row level security;
create policy video_channels_moderator_all on public.video_channels
  for all to authenticated using (public.is_moderator()) with check (public.is_moderator());

create table public.video_items (
  platform text not null,
  item_id text not null,                                          -- YouTube video id / Twitch stream id
  channel_id uuid not null references public.video_channels(channel_id) on delete cascade,
  title text,
  url text not null,
  published_at timestamptz,
  posted_at timestamptz,                                          -- null = recorded but not posted (backlog / filter)
  skipped_reason text,
  created_at timestamptz not null default now(),
  primary key (platform, item_id)
);
alter table public.video_items enable row level security;
create policy video_items_moderator_read on public.video_items
  for select to authenticated using (public.is_moderator());

create or replace function public.video_channels_active() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.video_channels where is_active)
     and exists (select 1 from public.discord_feeds where source = 'videos');
$$;
revoke all on function public.video_channels_active() from public, anon, authenticated;

select cron.schedule('discord-videos', '*/10 * * * *', $cmd$
  select net.http_post(
    url := 'https://pprzkexqltudeuqjnsqa.supabase.co/functions/v1/discord-dispatch',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-job-token', (select token from private.job_tokens where name = 'discord-dispatch')),
    body := '{"videos": true}'::jsonb,
    timeout_milliseconds := 55000)
  where public.video_channels_active();
$cmd$);
