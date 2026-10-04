-- RS-0067 package 3 (DEC-0098): Discord event cards via outbox + dispatcher.
--
-- 1) Test events: hub_events.is_test. Only moderators (or SQL as postgres /
--    service role) can set it. Test events never show on the website for
--    the public and only reach Discord servers listed in
--    discord_bot_state 'test_guild_ids'.
alter table public.hub_events add column if not exists is_test boolean not null default false;

create or replace function public.hub_events_protect_test() returns trigger
language plpgsql set search_path = public as $$
begin
  if coalesce(auth.role(), '') in ('authenticated', 'anon') and not public.is_moderator() then
    new.is_test := case when tg_op = 'UPDATE' then old.is_test else false end;
  end if;
  return new;
end $$;
create trigger hub_events_protect_test before insert or update on public.hub_events
  for each row execute function public.hub_events_protect_test();

alter policy hub_events_public_read on public.hub_events
  using ((is_published and not is_test) or public.is_moderator() or created_by = public.current_driver_id());

create or replace view public.public_event_rsvps as
  select r.event_id,
         case when d.deleted_at is not null then null::text else d.display_name end as display_name,
         r.created_at
    from hub_event_rsvps r
    join hub_events e on e.event_id = r.event_id and e.is_published and not e.is_test
    join drivers d on d.driver_id = r.driver_id;

-- 2) Outbox: one pending row per event (deduplicated), plus backfill rows
--    when a feed is added (posts the feed's upcoming events right away).
create table public.discord_outbox (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('event', 'backfill')),
  event_id uuid,                       -- no FK: deleted events must still be processed
  feed_id uuid references public.discord_feeds(feed_id) on delete cascade,
  created_at timestamptz not null default now(),
  not_before timestamptz not null default now(),
  processed_at timestamptz,
  attempts integer not null default 0,
  last_error text,
  check ((kind = 'event') = (event_id is not null)),
  check ((kind = 'backfill') = (feed_id is not null))
);
create index discord_outbox_pending on public.discord_outbox (not_before, id) where processed_at is null;
alter table public.discord_outbox enable row level security;
revoke all on public.discord_outbox from anon, authenticated;

create or replace function public.discord_enqueue_event() returns trigger
language plpgsql security definer set search_path = public as $$
declare eid uuid;
begin
  if tg_op = 'DELETE' then eid := old.event_id; else eid := new.event_id; end if;
  if not exists (select 1 from public.discord_outbox where kind = 'event' and event_id = eid and processed_at is null) then
    insert into public.discord_outbox (kind, event_id) values ('event', eid);
  end if;
  return null;
end $$;
create trigger hub_events_discord after insert or update or delete on public.hub_events
  for each row execute function public.discord_enqueue_event();
create trigger hub_event_rsvps_discord after insert or delete on public.hub_event_rsvps
  for each row execute function public.discord_enqueue_event();

create or replace function public.discord_enqueue_backfill() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.discord_outbox (kind, feed_id) values ('backfill', new.feed_id);
  return null;
end $$;
create trigger discord_feeds_backfill after insert on public.discord_feeds
  for each row execute function public.discord_enqueue_backfill();

-- Claim pending rows atomically (parallel dispatcher runs never get the same row).
create or replace function public.discord_claim_outbox(p_limit integer default 50)
returns setof public.discord_outbox language sql security definer set search_path = public as $$
  update public.discord_outbox o set processed_at = now(), attempts = o.attempts + 1
   where o.id in (select id from public.discord_outbox
                   where processed_at is null and not_before <= now()
                   order by id limit p_limit for update skip locked)
  returning o.*;
$$;
revoke all on function public.discord_claim_outbox(integer) from public, anon, authenticated;

-- 3) Message references: which card / native event belongs to which feed + event.
create table public.discord_messages (
  feed_id uuid not null references public.discord_feeds(feed_id) on delete cascade,
  event_id uuid not null,
  channel_id text not null,
  message_id text,                     -- null while the post is in flight
  scheduled_event_id text,
  state text not null default 'live' check (state in ('live', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (feed_id, event_id)
);
create index discord_messages_event on public.discord_messages (event_id);
alter table public.discord_messages enable row level security;
revoke all on public.discord_messages from anon, authenticated;

-- 4) Job token + schedule: every minute, but only calls the function when
--    something is pending (no idle invocations).
insert into private.job_tokens (name, token)
  values ('discord-dispatch', encode(extensions.gen_random_bytes(24), 'hex'))
  on conflict do nothing;
select cron.schedule('discord-dispatch', '* * * * *', $cron$
  select net.http_post(
    url := 'https://pprzkexqltudeuqjnsqa.supabase.co/functions/v1/discord-dispatch',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-job-token', (select token from private.job_tokens where name = 'discord-dispatch')),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000)
  where exists (select 1 from public.discord_outbox where processed_at is null and not_before <= now());
$cron$);

-- Switching "add_to_server_events" on/off re-syncs the feed (creates or removes native events).
create trigger discord_feeds_backfill_on_change after update of native_events on public.discord_feeds
  for each row when (old.native_events is distinct from new.native_events)
  execute function public.discord_enqueue_backfill();
