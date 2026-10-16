-- LFG Version 1 (DEC-0111, Fausto 15.10.2026: #lfg under COMMUNITY, end -> voice-chat, auto ping).
-- One row per running search. Discord IDs only while it runs: the row is deleted when it ends.
-- Service role only (bot functions); no RLS policies on purpose.
create table public.discord_lfg (
  lfg_id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  channel_id text not null,
  message_id text,
  voice_channel_id text,
  slot smallint not null check (slot between 1 and 9),
  host_discord_id text not null,
  activity text not null check (activity in ('race','playlist','car-meet','cruise','photo','job')),
  players text not null check (players in ('2-4','5-8','9+')),
  participants text[] not null default '{}',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '3 hours',
  closing boolean not null default false
);
create unique index discord_lfg_host_uq on public.discord_lfg (host_discord_id);
create unique index discord_lfg_slot_uq on public.discord_lfg (guild_id, slot);
alter table public.discord_lfg enable row level security;
revoke all on public.discord_lfg from public, anon, authenticated;

-- Start a search: max p_max running per server, one per host. Returns {status, lfg_id, slot}.
create or replace function public.discord_lfg_create(p_guild text, p_channel text, p_host text, p_activity text, p_players text, p_max int)
returns jsonb language plpgsql set search_path = public as $$
declare v_slot int; v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('discord_lfg:' || p_guild));
  if exists (select 1 from discord_lfg where host_discord_id = p_host) then return jsonb_build_object('status', 'own'); end if;
  if (select count(*) from discord_lfg where guild_id = p_guild) >= p_max then return jsonb_build_object('status', 'limit'); end if;
  select min(s) into v_slot from generate_series(1, p_max) s where s not in (select slot from discord_lfg where guild_id = p_guild);
  insert into discord_lfg (guild_id, channel_id, slot, host_discord_id, activity, players, participants)
  values (p_guild, p_channel, v_slot, p_host, p_activity, p_players, array[p_host]) returning lfg_id into v_id;
  return jsonb_build_object('status', 'ok', 'lfg_id', v_id, 'slot', v_slot);
end $$;

-- Join / leave. Host leaving -> next participant who doesn't host another search takes over;
-- nobody left -> the search ends (expires_at = now, the dispatcher cleans up).
create or replace function public.discord_lfg_join(p_lfg uuid, p_user text, p_join boolean)
returns jsonb language plpgsql set search_path = public as $$
declare r discord_lfg; v_status text; v_next text;
begin
  select * into r from discord_lfg where lfg_id = p_lfg for update;
  if not found or r.closing or r.expires_at <= now() then return jsonb_build_object('status', 'gone'); end if;
  if p_join then
    if p_user = any(r.participants) then v_status := 'already';
    else update discord_lfg set participants = participants || p_user where lfg_id = p_lfg returning * into r; v_status := 'joined'; end if;
  else
    if not (p_user = any(r.participants)) then v_status := 'not_in';
    else
      update discord_lfg set participants = array_remove(participants, p_user) where lfg_id = p_lfg returning * into r;
      v_status := 'left';
      if r.host_discord_id = p_user then
        select u into v_next from unnest(r.participants) with ordinality t(u, n)
         where not exists (select 1 from discord_lfg o where o.host_discord_id = t.u) order by n limit 1;
        if v_next is null then
          update discord_lfg set expires_at = now() where lfg_id = p_lfg returning * into r; v_status := 'ended';
        else
          update discord_lfg set host_discord_id = v_next where lfg_id = p_lfg returning * into r; v_status := 'new_host';
        end if;
      end if;
    end if;
  end if;
  return jsonb_build_object('status', v_status) || to_jsonb(r);
end $$;

-- Searches that are over (time up, closed, or empty), claimed once for cleanup.
create or replace function public.discord_lfg_pending() returns boolean language sql stable set search_path = public as $$
  select exists (select 1 from discord_lfg where expires_at <= now() and (not closing or created_at < now() - interval '4 hours'));
$$;
create or replace function public.discord_lfg_claim_ended() returns setof public.discord_lfg language plpgsql set search_path = public as $$
begin
  return query
  update discord_lfg l set closing = true
   where l.lfg_id in (select lfg_id from discord_lfg where expires_at <= now() and (not closing or created_at < now() - interval '4 hours') for update skip locked)
  returning l.*;
end $$;

revoke all on function public.discord_lfg_create(text, text, text, text, text, int) from public, anon, authenticated;
revoke all on function public.discord_lfg_join(uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.discord_lfg_pending() from public, anon, authenticated;
revoke all on function public.discord_lfg_claim_ended() from public, anon, authenticated;
grant execute on function public.discord_lfg_create(text, text, text, text, text, int) to service_role;
grant execute on function public.discord_lfg_join(uuid, text, boolean) to service_role;
grant execute on function public.discord_lfg_pending() to service_role;
grant execute on function public.discord_lfg_claim_ended() to service_role;
grant select, insert, update, delete on public.discord_lfg to service_role;
