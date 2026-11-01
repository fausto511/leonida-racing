-- DEC-0204 (Fausto 01.11.2026): only crew leaders and commissioners may host an event for
-- their crew (moderators: any crew). A crew's Discord invite can only be used together with
-- that crew as host crew. When a host loses the right, their upcoming events keep running
-- without the crew: the crew's invite is removed, the profile PSN fills in if the event has
-- none, and an event left without any contact goes back to draft. Past events keep the crew.
-- The host sees a notice in My Account (no DM).

alter table public.hub_events
  add column if not exists host_notice text
    constraint hub_events_host_notice_check check (host_notice in ('crew_removed', 'crew_removed_hidden')),
  add column if not exists host_notice_at timestamptz;

comment on column public.hub_events.host_notice is
  'Set by the system when the host lost the right to host for the crew (DEC-0204): crew_removed = still live without the crew; crew_removed_hidden = back to draft, no contact left. Cleared on the host''s next save.';

-- Leader or commissioner of the crew (roles end with the membership, see crew_memberships_leader_cleanup).
create or replace function public.is_crew_staff_of(p_crew uuid, p_driver uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.hub_roles
    where crew_id = p_crew and driver_id = p_driver and role in ('crew_leader', 'crew_commissioner')
  );
$$;

create or replace function public.can_host_for_crew(p_crew uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_moderator() or public.is_crew_staff_of(p_crew, public.current_driver_id());
$$;

-- Invite code of a discord.gg / discord.com/invite URL, lower-cased (null for anything else).
create or replace function public.discord_invite_code(p_url text)
returns text language sql immutable set search_path = public as $$
  select lower(substring(p_url from '^https://(?:discord\.gg|discord\.com/invite)/([A-Za-z0-9-]+)'));
$$;

alter policy hub_events_host_insert on public.hub_events
  with check (
    created_by = public.current_driver_id() and public.is_event_host()
    and (host_crew_id is null or public.can_host_for_crew(host_crew_id))
  );
alter policy hub_events_host_update on public.hub_events
  using (created_by = public.current_driver_id() and public.is_event_host())
  with check (
    created_by = public.current_driver_id() and public.is_event_host()
    and (host_crew_id is null or public.can_host_for_crew(host_crew_id))
  );

-- A crew's invite only together with that crew as host crew.
create or replace function public.hub_events_crew_invite_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare code text;
begin
  if coalesce(current_setting('lr.event_sync', true), '') = 'on' or public.is_moderator() then return new; end if;
  if new.discord_url is null then return new; end if;
  if tg_op = 'UPDATE' and new.discord_url is not distinct from old.discord_url
     and new.host_crew_id is not distinct from old.host_crew_id then return new; end if;
  code := public.discord_invite_code(new.discord_url);
  if code is null then return new; end if;
  if exists (select 1 from public.crews c where public.discord_invite_code(c.discord_url) = code)
     and not exists (select 1 from public.crews c where public.discord_invite_code(c.discord_url) = code
                     and c.crew_id = new.host_crew_id) then
    raise exception 'crew_invite_taken: this Discord invite belongs to a crew on Leonida Racing'
      using errcode = '23514';
  end if;
  return new;
end $$;

drop trigger if exists hub_events_crew_invite_guard on public.hub_events;
create trigger hub_events_crew_invite_guard
  before insert or update of discord_url, host_crew_id on public.hub_events
  for each row execute function public.hub_events_crew_invite_guard();

-- System updates (lr.event_sync = on) skip the contact check ...
create or replace function public.hub_events_require_contact()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('lr.event_sync', true), '') = 'on' then return new; end if;
  if new.host_name is null and new.discord_url is null and not exists (
       select 1 from public.crews c where c.crew_id = new.host_crew_id and c.discord_url is not null) then
    raise exception 'contact_required: add your PSN name or a Discord invite (or pick a host crew that has one)'
      using errcode = '23514';
  end if;
  return new;
end $$;

-- ... and the publish rules. A host's own save clears the notice.
create or replace function public.hub_events_force_public()
returns trigger language plpgsql set search_path = public as $$
begin
  if coalesce(current_setting('lr.event_sync', true), '') = 'on' then return new; end if;
  if not public.is_moderator() then
    new.is_published := true;
    new.host_notice := null;
    new.host_notice_at := null;
    if tg_op = 'UPDATE' then new.created_by := old.created_by; end if;
  end if;
  return new;
end;
$$;

-- Events get their own copy of hub_protect_moderation_fields (crews keep the shared one):
-- moderator-hidden stays hidden; a system draft (crew_removed_hidden) goes live again as soon
-- as the host saves it with a contact (hub_events_require_contact enforces the contact).
create or replace function public.hub_events_protect_moderation_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('lr.event_sync', true), '') = 'on' then return new; end if;
  if not public.is_moderator() then
    new.moderation_note := old.moderation_note;
    if old.host_notice = 'crew_removed_hidden' and not old.is_published then
      new.is_published := true;
    else
      new.is_published := old.is_published;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists hub_events_protect_moderation on public.hub_events;
create trigger hub_events_protect_moderation
  before update on public.hub_events
  for each row execute function public.hub_events_protect_moderation_fields();

-- Upcoming events of p_driver (or of every host when p_driver is null) lose crew p_crew.
create or replace function public.events_drop_crew(p_crew uuid, p_driver uuid)
returns void language plpgsql security definer set search_path = public as $$
declare crew_code text; prev text := current_setting('lr.event_sync', true);
begin
  perform set_config('lr.event_sync', 'on', true);
  select public.discord_invite_code(discord_url) into crew_code from public.crews where crew_id = p_crew;
  with c as (
    select e.event_id, e.created_by,
           case when crew_code is not null and public.discord_invite_code(e.discord_url) = crew_code
                then null else e.discord_url end as new_discord,
           coalesce(e.host_name, d.psn_name) as new_psn
      from public.hub_events e
      left join public.drivers d on d.driver_id = e.created_by and d.deleted_at is null
     where e.host_crew_id = p_crew and e.starts_at > now()
       and (p_driver is null or e.created_by = p_driver)
  )
  update public.hub_events e
     set host_crew_id = null,
         discord_url = c.new_discord,
         host_name = c.new_psn,
         is_published = case when c.new_discord is null and c.new_psn is null then false else e.is_published end,
         host_notice = case when c.created_by is null then null
                            when c.new_discord is null and c.new_psn is null then 'crew_removed_hidden'
                            else 'crew_removed' end,
         host_notice_at = now()
    from c
   where e.event_id = c.event_id;
  perform set_config('lr.event_sync', coalesce(prev, ''), true);
end $$;

revoke all on function public.events_drop_crew(uuid, uuid) from public, anon, authenticated;

-- Checked at commit, so a leadership hand-over (leader role deleted, commissioner role added in
-- the same transaction) does not count as losing the right.
create or replace function public.hub_roles_staff_lost()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.role in ('crew_leader', 'crew_commissioner') and old.crew_id is not null
     and exists (select 1 from public.crews where crew_id = old.crew_id)
     and not public.is_crew_staff_of(old.crew_id, old.driver_id) then
    perform public.events_drop_crew(old.crew_id, old.driver_id);
  end if;
  return null;
end $$;

drop trigger if exists hub_roles_staff_lost on public.hub_roles;
create constraint trigger hub_roles_staff_lost
  after delete or update of role, crew_id, driver_id on public.hub_roles
  deferrable initially deferred
  for each row execute function public.hub_roles_staff_lost();

-- Crew deleted: upcoming events lose it like above; past events lose it through the foreign key
-- (on delete set null), which must not trip the contact check.
create or replace function public.crews_drop_events()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.events_drop_crew(old.crew_id, null);
  perform set_config('lr.event_sync', 'on', true);
  return old;
end $$;

drop trigger if exists crews_drop_events on public.crews;
create trigger crews_drop_events
  before delete on public.crews
  for each row execute function public.crews_drop_events();
