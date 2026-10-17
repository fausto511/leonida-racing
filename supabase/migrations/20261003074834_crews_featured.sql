-- Featured crews (Fausto, 2026-10-03): moderators mark crews; Hub overview
-- and home page show up to 3/4 (random among featured, filled with others).
-- Applied via Supabase MCP on 2026-10-03.
alter table public.crews add column if not exists is_featured boolean not null default false;

create or replace function public.crews_protect_featured()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_moderator() then
    if tg_op = 'INSERT' then
      new.is_featured := false;
    else
      new.is_featured := old.is_featured;
    end if;
  end if;
  return new;
end $$;

create trigger crews_protect_featured
  before insert or update on public.crews
  for each row execute function public.crews_protect_featured();
