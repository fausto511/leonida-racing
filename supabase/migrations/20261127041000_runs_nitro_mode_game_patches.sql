-- Fausto 27.11.2026 (DEC-0259): nitrous per lap, game mode (Story/Online), game patch derived from the submission date.
-- Applied 27.11.2026 ~04:10 UTC via execute_sql after apply_migration was cancelled (confirmation never reached Fausto).
-- Timestamp = time it was applied; for ordering only (see MIGRATIONS.md, Sonderfälle).

alter table public.runs add column if not exists nitro_used boolean;
comment on column public.runs.nitro_used is 'Nitrous used on this lap: true/false; null = not given (laps before 27.11.2026). Set at submission from conditions.nitro, moderators may correct it after a video check.';

alter table public.runs add column if not exists game_mode text not null default 'story';
alter table public.runs drop constraint if exists runs_game_mode_check;
alter table public.runs add constraint runs_game_mode_check check (game_mode in ('story', 'online'));
comment on column public.runs.game_mode is 'story or online. Default story until GTA Online exists; not shown on the site until then (Fausto 27.11.2026).';

create or replace function public.runs_nitro_from_conditions()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.nitro_used is null and jsonb_typeof(new.conditions -> 'nitro') = 'boolean' then
    new.nitro_used := (new.conditions ->> 'nitro')::boolean;
  end if;
  return new;
end $$;

drop trigger if exists runs_nitro_from_conditions on public.runs;
create trigger runs_nitro_from_conditions before insert on public.runs
  for each row execute function public.runs_nitro_from_conditions();

create table if not exists public.game_patches (
  version text primary key,
  released_on date not null unique,
  notes text
);
alter table public.game_patches enable row level security;
drop policy if exists game_patches_read on public.game_patches;
create policy game_patches_read on public.game_patches for select using (true);
grant select on public.game_patches to anon, authenticated;

insert into public.game_patches (version, released_on, notes) values
  ('01.002.000', '2026-11-13', 'Pre-launch update, no patch notes'),
  ('01.002.001', '2026-11-16', 'Pre-launch update, launch version (19.11.2026), no patch notes'),
  ('01.002.002', '2026-11-23', 'Fixes: crashes, weather, autosave, phone calls, wanted level, gym, loot bags. No vehicle changes.')
on conflict (version) do nothing;

-- Patch at a point in time (UTC date). On the day a patch rolls out the version is uncertain (staged rollout).
create or replace function public.game_patch_at(p_at timestamptz)
returns text language sql stable set search_path = public as $$
  select case
    when exists (select 1 from game_patches where released_on = (p_at at time zone 'UTC')::date) then 'uncertain'
    else (select version from game_patches where released_on < (p_at at time zone 'UTC')::date order by released_on desc limit 1)
  end
$$;
grant execute on function public.game_patch_at(timestamptz) to anon, authenticated;
