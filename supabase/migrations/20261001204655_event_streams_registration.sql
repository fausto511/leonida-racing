-- RS-0058: stream links for events + sign-ups open/closed (Fausto, 2026-10-01).
-- Streams live in their own table (several streams per event possible later,
-- base for a "Live & Upcoming Streams" list and a later Leonida Racing TV).

alter table public.hub_events
  add column if not exists registration text not null default 'open'
    constraint hub_events_registration_check check (registration in ('open', 'closed'));

comment on column public.hub_events.registration is
  'open = players can sign up ("I''m in"); closed = no sign-ups (full/invite-only), event still listed, e.g. to watch the stream';

create or replace function public.hub_event_open_for_rsvp(p_event uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select exists (
    select 1 from public.hub_events e
    where e.event_id = p_event and e.is_published and e.status = 'scheduled'
      and e.registration = 'open'
      and coalesce(e.ends_at, e.starts_at + interval '3 hours') > now()
      and (e.max_participants is null
           or (select count(*) from public.hub_event_rsvps r where r.event_id = e.event_id) < e.max_participants)
  );
$function$;

create table if not exists public.hub_event_streams (
  stream_id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.hub_events(event_id) on delete cascade,
  platform text not null check (platform in ('twitch', 'youtube', 'kick')),
  url text not null,
  channel_name text check (channel_name is null or char_length(channel_name) between 1 and 50),
  sort_order integer not null default 0,
  created_by uuid default public.current_driver_id(),
  created_at timestamptz not null default now(),
  constraint hub_event_streams_url_check check (
    (platform = 'twitch'  and url ~ '^https://(www\.)?twitch\.tv/[A-Za-z0-9_]{3,25}/?$')
 or (platform = 'kick'    and url ~ '^https://(www\.)?kick\.com/[A-Za-z0-9_-]{3,25}/?$')
 or (platform = 'youtube' and url ~ '^https://((www|m)\.)?(youtube\.com/(watch\?v=[A-Za-z0-9_-]{11}|live/[A-Za-z0-9_-]{11}|@[A-Za-z0-9._-]{3,30}(/live)?|channel/UC[A-Za-z0-9_-]{22}(/live)?)|youtu\.be/[A-Za-z0-9_-]{11})$')
  ),
  unique (event_id, url)
);
create index if not exists hub_event_streams_event_idx on public.hub_event_streams(event_id);

alter table public.hub_event_streams enable row level security;

-- Readable whenever the event itself is readable (hub_events RLS applies inside).
create policy hub_event_streams_read on public.hub_event_streams for select
  using (exists (select 1 from public.hub_events e where e.event_id = hub_event_streams.event_id));
create policy hub_event_streams_host_write on public.hub_event_streams for all
  using (public.is_moderator() or exists (select 1 from public.hub_events e where e.event_id = hub_event_streams.event_id and e.created_by = public.current_driver_id() and public.is_event_host()))
  with check (public.is_moderator() or exists (select 1 from public.hub_events e where e.event_id = hub_event_streams.event_id and e.created_by = public.current_driver_id() and public.is_event_host()));

grant select on public.hub_event_streams to anon, authenticated;
grant insert, update, delete on public.hub_event_streams to authenticated;
