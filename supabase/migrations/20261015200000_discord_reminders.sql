-- RS-0067 Paket 5 (15.10.2026): reminder posts 24 h / 1 h before an event.
-- A reminder is a reply to the event card in the feed channel (discord_messages),
-- so only feeds that actually show the event get one.
-- 24 h reminder: sent between 24 h and 20 h before the start (no late "tomorrow" posts
-- for events created shortly before). 1 h reminder: between 60 min and the start.

alter table public.discord_messages
  add column if not exists reminded_24h_at timestamptz,
  add column if not exists reminded_1h_at timestamptz;

-- true when at least one reminder is due (used by the cron job condition)
create or replace function public.discord_reminders_pending()
returns boolean
language sql stable
set search_path = public
as $$
  select exists (
    select 1
    from discord_messages m
    join discord_feeds f on f.feed_id = m.feed_id
    join hub_events e on e.event_id = m.event_id
    where f.reminders <> 'off' and m.message_id is not null
      and e.is_published and e.status <> 'cancelled'
      and (
        (f.reminders in ('24h','both') and m.reminded_24h_at is null
          and e.starts_at > now() + interval '20 hours' and e.starts_at <= now() + interval '24 hours')
        or
        (f.reminders in ('1h','both') and m.reminded_1h_at is null
          and e.starts_at > now() and e.starts_at <= now() + interval '1 hour')
      )
  );
$$;

-- claims due reminders (marks them sent) and returns them; the dispatcher resets
-- the mark if posting fails, so it is retried while the window is open
create or replace function public.discord_claim_reminders()
returns table (feed_id uuid, event_id uuid, kind text, guild_id text, channel_id text,
               message_id text, mention_attendees boolean, title text, starts_at timestamptz)
language plpgsql
set search_path = public
as $$
begin
  return query
  with due as (
    select m.feed_id, m.event_id,
      case when f.reminders in ('1h','both') and m.reminded_1h_at is null
                and e.starts_at > now() and e.starts_at <= now() + interval '1 hour' then '1h'
           else '24h' end as kind
    from discord_messages m
    join discord_feeds f on f.feed_id = m.feed_id
    join hub_events e on e.event_id = m.event_id
    where f.reminders <> 'off' and m.message_id is not null
      and e.is_published and e.status <> 'cancelled'
      and (
        (f.reminders in ('24h','both') and m.reminded_24h_at is null
          and e.starts_at > now() + interval '20 hours' and e.starts_at <= now() + interval '24 hours')
        or
        (f.reminders in ('1h','both') and m.reminded_1h_at is null
          and e.starts_at > now() and e.starts_at <= now() + interval '1 hour')
      )
    for update of m skip locked
  ), upd as (
    update discord_messages m
       set reminded_24h_at = case when d.kind = '24h' then now() else m.reminded_24h_at end,
           reminded_1h_at  = case when d.kind = '1h'  then now() else m.reminded_1h_at end
      from due d
     where m.feed_id = d.feed_id and m.event_id = d.event_id
    returning m.feed_id, m.event_id, d.kind, m.channel_id, m.message_id
  )
  select u.feed_id, u.event_id, u.kind, f.guild_id, u.channel_id, u.message_id,
         f.mention_attendees, e.title, e.starts_at
    from upd u
    join discord_feeds f on f.feed_id = u.feed_id
    join hub_events e on e.event_id = u.event_id;
end;
$$;

revoke all on function public.discord_reminders_pending() from public, anon, authenticated;
revoke all on function public.discord_claim_reminders() from public, anon, authenticated;
grant execute on function public.discord_reminders_pending() to service_role;
grant execute on function public.discord_claim_reminders() to service_role;
