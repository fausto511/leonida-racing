-- RS-0067 package 2 (DEC-0098): Discord server feeds.
-- A Discord server (guild) subscribes a channel to a source: a crew's events,
-- a host's own events, or the public calendar (platform filter mandatory).
-- Only the discord-interactions / discord-dispatch edge functions touch this
-- table (service role). RLS on, no policies -> no access via the public API.
create table public.discord_feeds (
  feed_id uuid primary key default gen_random_uuid(),
  guild_id text not null check (guild_id ~ '^[0-9]{5,25}$'),
  channel_id text not null check (channel_id ~ '^[0-9]{5,25}$'),
  source text not null check (source in ('crew', 'host', 'public')),
  crew_id uuid references public.crews(crew_id) on delete cascade,
  host_driver_id uuid references public.drivers(driver_id) on delete cascade,
  event_types text[] check (event_types is null or event_types <@ array['race','time-attack','league','car-meet','cruise','other']),
  platforms text[] check (platforms is null or platforms <@ array['ps5','xbox']),
  native_events boolean not null default false,
  reminders text not null default 'off' check (reminders in ('off', '24h', '1h', 'both')),
  mention_attendees boolean not null default false,
  created_by_discord_id text not null,
  created_by_driver_id uuid references public.drivers(driver_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_error text,
  last_error_at timestamptz,
  check ((source = 'crew') = (crew_id is not null)),
  check ((source = 'host') = (host_driver_id is not null)),
  check (source <> 'public' or cardinality(platforms) = 1),
  constraint discord_feeds_unique unique nulls not distinct (guild_id, channel_id, source, crew_id, host_driver_id, event_types, platforms)
);
create index discord_feeds_guild on public.discord_feeds (guild_id);
create index discord_feeds_crew on public.discord_feeds (crew_id) where crew_id is not null;
create index discord_feeds_host on public.discord_feeds (host_driver_id) where host_driver_id is not null;
alter table public.discord_feeds enable row level security;
revoke all on public.discord_feeds from anon, authenticated;

-- Small key/value store for the bot (e.g. which command-list version is registered at Discord).
create table public.discord_bot_state (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.discord_bot_state enable row level security;
revoke all on public.discord_bot_state from anon, authenticated;
