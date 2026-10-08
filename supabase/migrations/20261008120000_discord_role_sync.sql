-- Discord role sync, website -> official Discord server only (Fausto 07./08.10.2026).
-- Roles: Registered Driver (every account), Crew Leader, Event Host, Creator
-- (hub_roles). Discord changes never flow back. A role a Discord admin removed
-- is not re-added by the daily check, only when that role changes on the website.
-- Worked off by discord-dispatch (same cron job, same job token).

create table if not exists public.discord_role_jobs (
  id              bigint generated always as identity primary key,
  discord_user_id text not null,
  reset_role      text,            -- role key changed on the website -> re-grant even if an admin removed it
  created_at      timestamptz not null default now(),
  not_before      timestamptz not null default now(),
  processed_at    timestamptz,
  attempts        int not null default 0,
  last_error      text
);
create index if not exists discord_role_jobs_pending on public.discord_role_jobs (id) where processed_at is null;
alter table public.discord_role_jobs enable row level security;   -- service role only, no policies

-- What the bot granted. suppressed = a Discord admin removed it -> leave it off.
create table if not exists public.discord_role_state (
  discord_user_id text not null,
  role_key        text not null check (role_key in ('member', 'crew_leader', 'event_host', 'creator')),
  granted_at      timestamptz not null default now(),
  suppressed      boolean not null default false,
  primary key (discord_user_id, role_key)
);
alter table public.discord_role_state enable row level security;  -- service role only

create or replace function public.discord_role_enqueue(p_discord_id text, p_reset text default null) returns void
language sql security definer set search_path = public as $$
  insert into public.discord_role_jobs (discord_user_id, reset_role)
  select p_discord_id, p_reset
   where p_discord_id is not null
     and not exists (select 1 from public.discord_role_jobs j where j.discord_user_id = p_discord_id
                       and j.processed_at is null and j.reset_role is not distinct from p_reset);
$$;

create or replace function public.discord_role_on_hub_roles() returns trigger
language plpgsql security definer set search_path = public as $$
declare d uuid; r text;
begin
  if tg_op = 'DELETE' then d := old.driver_id; r := old.role; else d := new.driver_id; r := new.role; end if;
  perform public.discord_role_enqueue((select discord_user_id from public.drivers where driver_id = d), r);
  return null;
end $$;
create trigger hub_roles_discord_roles after insert or delete on public.hub_roles
  for each row execute function public.discord_role_on_hub_roles();

create or replace function public.discord_role_on_drivers() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.discord_role_enqueue(new.discord_user_id);
  else
    if old.discord_user_id is distinct from new.discord_user_id then perform public.discord_role_enqueue(old.discord_user_id); end if;
    perform public.discord_role_enqueue(new.discord_user_id);   -- also covers deleted_at changes
  end if;
  return null;
end $$;
create trigger drivers_discord_roles after insert or update of discord_user_id, deleted_at on public.drivers
  for each row execute function public.discord_role_on_drivers();

create or replace function public.discord_claim_role_jobs(p_limit int default 20) returns setof public.discord_role_jobs
language sql security definer set search_path = public as $$
  update public.discord_role_jobs j set processed_at = now(), attempts = j.attempts + 1
   where j.id in (select id from public.discord_role_jobs where processed_at is null and not_before <= now()
                   order by id limit p_limit for update skip locked)
  returning j.*;
$$;
revoke all on function public.discord_claim_role_jobs(int) from public, anon, authenticated;
revoke all on function public.discord_role_enqueue(text, text) from public, anon, authenticated;

-- Daily check: everyone with a linked account plus everyone we granted something.
create or replace function public.discord_role_reconcile() returns int
language plpgsql security definer set search_path = public as $$
declare n int := 0; x text;
begin
  for x in select discord_user_id from public.drivers where discord_user_id is not null and deleted_at is null
           union select discord_user_id from public.discord_role_state loop
    perform public.discord_role_enqueue(x); n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.discord_role_reconcile() from public, anon, authenticated;
revoke all on function public.discord_role_on_hub_roles() from public, anon, authenticated;
revoke all on function public.discord_role_on_drivers() from public, anon, authenticated;
-- Applied 08.10.2026 via MCP in parts (a DELETE inside a function body made the tool wait for a
-- confirmation and time out, so old processed jobs are not cleaned up here yet -> see TASKS RS-0067).

-- Cron: dispatcher also runs when role jobs wait; daily reconcile with the housekeeping job.
select cron.alter_job((select jobid from cron.job where jobname = 'discord-dispatch'), command := $c$
  select net.http_post(
    url := 'https://pprzkexqltudeuqjnsqa.supabase.co/functions/v1/discord-dispatch',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-job-token', (select token from private.job_tokens where name = 'discord-dispatch')),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000)
  where exists (select 1 from public.discord_outbox where processed_at is null and not_before <= now())
     or exists (select 1 from public.discord_role_jobs where processed_at is null and not_before <= now());
$c$);
select cron.alter_job((select jobid from cron.job where jobname = 'discord-housekeeping'), command := $c$
  select public.discord_housekeeping();
  select public.discord_role_reconcile();
  select net.http_post(
    url := 'https://pprzkexqltudeuqjnsqa.supabase.co/functions/v1/discord-dispatch',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-job-token', (select token from private.job_tokens where name = 'discord-dispatch')),
    body := '{"housekeeping": true}'::jsonb,
    timeout_milliseconds := 55000);
$c$);
