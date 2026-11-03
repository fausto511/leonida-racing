-- DEC-0210 (Fausto 03.11.2026): drivers can allow us to use their lap video in Leonida Racing
-- highlight and analysis videos. Opt-in when submitting, switchable later in My laps.
-- Switching off only stops new use; videos already published stay online. Every change is logged
-- (run, on/off, time) so we can show what was allowed when a video was made.

alter table public.runs
  add column if not exists video_use_ok boolean not null default false,
  add column if not exists video_use_since timestamptz,
  add column if not exists video_use_until timestamptz;

create table if not exists public.video_use_log (
  id bigint generated always as identity primary key,
  run_id uuid not null references public.runs(run_id) on delete cascade,
  allowed boolean not null,
  changed_at timestamptz not null default now()
);
alter table public.video_use_log enable row level security;
create policy video_use_log_moderator_select on public.video_use_log for select to authenticated using (public.is_moderator());
revoke all on public.video_use_log from anon;

create or replace function public.set_video_use(p_run_id uuid, p_ok boolean) returns boolean
  language plpgsql security definer set search_path = public
as $fn$
declare
  v_me uuid := public.current_driver_id();
  v_cur boolean;
begin
  if v_me is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  select video_use_ok into v_cur from public.runs where run_id = p_run_id and driver_id = v_me;
  if not found then raise exception 'not_your_lap' using errcode = '42501'; end if;
  if p_ok and not exists (select 1 from public.evidence where run_id = p_run_id and type = 'video_link') then
    raise exception 'no_video' using errcode = '22023';
  end if;
  if v_cur is not distinct from p_ok then return p_ok; end if;
  update public.runs
     set video_use_ok = p_ok,
         video_use_since = case when p_ok then now() else video_use_since end,
         video_use_until = case when p_ok then null else now() end
   where run_id = p_run_id;
  insert into public.video_use_log (run_id, allowed) values (p_run_id, p_ok);
  return p_ok;
end $fn$;
revoke execute on function public.set_video_use(uuid, boolean) from public, anon;
grant execute on function public.set_video_use(uuid, boolean) to authenticated;
