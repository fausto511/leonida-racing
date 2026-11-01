-- DEC-0205 (Fausto 01.11.2026): events for crew members only.
-- Only leaders/commissioners (host crew rule, DEC-0204) can create them; every active member of
-- the crew sees them and only active members can sign up (website and Discord button). Not in the
-- public calendar. Losing the crew never makes them public: they go back to draft.
-- Also fixes: sign-ups via the Discord button ignored event kicks/bans (no website user there).

alter table public.hub_events
  add column if not exists members_only boolean not null default false;
alter table public.hub_events
  add constraint hub_events_members_only_needs_crew check (not members_only or host_crew_id is not null);

alter table public.hub_events drop constraint if exists hub_events_host_notice_check;
alter table public.hub_events add constraint hub_events_host_notice_check
  check (host_notice in ('crew_removed', 'crew_removed_hidden', 'crew_removed_private'));

-- Visible: published + (public, or I'm an active member of the host crew); host and moderators always.
alter policy hub_events_public_read on public.hub_events
  using (
    (is_published and not is_test and (not members_only or public.is_active_member(host_crew_id)))
    or public.is_moderator() or created_by = public.current_driver_id()
  );

-- Sign-up check for an explicit driver (the Discord bot has no website user).
create or replace function public.hub_event_rsvp_allowed(p_event uuid, p_driver uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_driver is not null and exists (
    select 1 from public.hub_events e
    where e.event_id = p_event and e.is_published and e.status = 'scheduled'
      and e.registration = 'open'
      and coalesce(e.ends_at, e.starts_at + interval '3 hours') > now()
      and (e.max_participants is null
           or (select count(*) from public.hub_event_rsvps r where r.event_id = e.event_id) < e.max_participants)
      and (not e.members_only or exists (
            select 1 from public.crew_memberships m
            where m.crew_id = e.host_crew_id and m.driver_id = p_driver and m.status = 'active'))
      and not exists (select 1 from public.hub_event_kicks k where k.event_id = e.event_id and k.driver_id = p_driver)
      and not exists (select 1 from public.hub_event_bans b where b.host_driver_id = e.created_by and b.driver_id = p_driver)
  );
$$;

create or replace function public.hub_event_open_for_rsvp(p_event uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.hub_event_rsvp_allowed(p_event, public.current_driver_id());
$$;

create or replace function public.discord_rsvp(p_event uuid, p_discord_id text, p_going boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_driver uuid;
  v_e record;
  v_status text;
  v_count int;
begin
  select driver_id into v_driver from drivers where discord_user_id = p_discord_id and deleted_at is null;
  if v_driver is null then return jsonb_build_object('status', 'no_profile'); end if;

  perform pg_advisory_xact_lock(hashtextextended('rsvp:' || p_event::text, 0));
  select e.*, c.discord_url as crew_discord_url into v_e
    from hub_events e left join crews c on c.crew_id = e.host_crew_id
   where e.event_id = p_event;
  if not found or not v_e.is_published then return jsonb_build_object('status', 'not_found'); end if;

  if p_going then
    if exists (select 1 from hub_event_rsvps where event_id = p_event and driver_id = v_driver) then
      v_status := 'already';
    elsif public.hub_event_rsvp_allowed(p_event, v_driver) then
      insert into hub_event_rsvps (event_id, driver_id) values (p_event, v_driver);
      v_status := 'in';
    elsif v_e.status = 'cancelled' then v_status := 'cancelled';
    elsif coalesce(v_e.ends_at, v_e.starts_at + interval '3 hours') <= now() then v_status := 'past';
    elsif v_e.registration <> 'open' then v_status := 'closed';
    elsif v_e.members_only and not exists (select 1 from crew_memberships m
            where m.crew_id = v_e.host_crew_id and m.driver_id = v_driver and m.status = 'active') then v_status := 'members_only';
    elsif exists (select 1 from hub_event_kicks k where k.event_id = p_event and k.driver_id = v_driver)
       or exists (select 1 from hub_event_bans b where b.host_driver_id = v_e.created_by and b.driver_id = v_driver) then v_status := 'blocked';
    else v_status := 'full';
    end if;
  else
    delete from hub_event_rsvps where event_id = p_event and driver_id = v_driver;
    v_status := case when found then 'out' else 'not_in' end;
  end if;

  select count(*) into v_count from hub_event_rsvps where event_id = p_event;
  return jsonb_build_object(
    'status', v_status, 'going', v_count, 'max', v_e.max_participants,
    'title', v_e.title, 'host_name', v_e.host_name,
    'discord_url', coalesce(v_e.discord_url, v_e.crew_discord_url));
end $$;

-- Names of sign-ups: crew-only events only for those who can see the event.
create or replace view public.public_event_rsvps as
 select r.event_id,
        case when d.deleted_at is not null then null::text else d.display_name end as display_name,
        r.created_at
   from hub_event_rsvps r
   join hub_events e on e.event_id = r.event_id and e.is_published and not e.is_test
        and (not e.members_only or public.is_active_member(e.host_crew_id)
             or e.created_by = public.current_driver_id() or public.is_moderator())
   join drivers d on d.driver_id = r.driver_id;

-- Membership ends -> sign-ups for upcoming crew-only events of that crew are removed.
create or replace function public.crew_memberships_drop_private_rsvps()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'active' and (tg_op = 'DELETE' or new.status <> 'active') then
    delete from public.hub_event_rsvps r
     using public.hub_events e
     where r.event_id = e.event_id and r.driver_id = old.driver_id
       and e.members_only and e.host_crew_id = old.crew_id and e.starts_at > now();
  end if;
  return null;
end $$;

drop trigger if exists crew_memberships_drop_private_rsvps on public.crew_memberships;
create trigger crew_memberships_drop_private_rsvps
  after delete or update of status on public.crew_memberships
  for each row execute function public.crew_memberships_drop_private_rsvps();

-- DEC-0204 cleanup: crew-only events never turn public; they go back to draft.
create or replace function public.events_drop_crew(p_crew uuid, p_driver uuid)
returns void language plpgsql security definer set search_path = public as $$
declare crew_code text; prev text := current_setting('lr.event_sync', true);
begin
  perform set_config('lr.event_sync', 'on', true);
  select public.discord_invite_code(discord_url) into crew_code from public.crews where crew_id = p_crew;
  with c as (
    select e.event_id, e.created_by, e.host_name, e.members_only,
           case when crew_code is not null and public.discord_invite_code(e.discord_url) = crew_code
                then null else e.discord_url end as new_discord
      from public.hub_events e
     where e.host_crew_id = p_crew and e.starts_at > now()
       and (p_driver is null or e.created_by = p_driver)
  )
  update public.hub_events e
     set host_crew_id = null,
         members_only = false,
         discord_url = c.new_discord,
         is_published = case when c.members_only or (c.new_discord is null and c.host_name is null)
                             then false else e.is_published end,
         host_notice = case when c.created_by is null then null
                            when c.members_only then 'crew_removed_private'
                            when c.new_discord is null and c.host_name is null then 'crew_removed_hidden'
                            else 'crew_removed' end,
         host_notice_at = now()
    from c
   where e.event_id = c.event_id;
  perform set_config('lr.event_sync', coalesce(prev, ''), true);
end $$;

revoke all on function public.events_drop_crew(uuid, uuid) from public, anon, authenticated;

-- Crew deleted: past crew-only events lose the flag before the foreign key clears the crew.
create or replace function public.crews_drop_events()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.events_drop_crew(old.crew_id, null);
  perform set_config('lr.event_sync', 'on', true);
  update public.hub_events set members_only = false, is_published = false
   where host_crew_id = old.crew_id and members_only;
  return old;
end $$;

-- Republish a system draft only with a contact; both draft notices behave the same.
create or replace function public.hub_events_protect_moderation_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('lr.event_sync', true), '') = 'on' then return new; end if;
  if not public.is_moderator() then
    new.moderation_note := old.moderation_note;
    new.is_published := old.is_published;
    if old.host_notice in ('crew_removed_hidden', 'crew_removed_private') and not old.is_published then
      if new.host_name is not null or new.discord_url is not null or exists (
           select 1 from public.crews c where c.crew_id = new.host_crew_id and c.discord_url is not null) then
        new.is_published := true;
      else
        new.host_notice := old.host_notice;
        new.host_notice_at := old.host_notice_at;
      end if;
    end if;
  end if;
  return new;
end $$;

-- Switched to crew-only (or crew changed): sign-ups of non-members are removed.
create or replace function public.hub_events_drop_nonmember_rsvps()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.members_only and (not old.members_only or new.host_crew_id is distinct from old.host_crew_id) then
    delete from public.hub_event_rsvps r
     where r.event_id = new.event_id
       and not exists (select 1 from public.crew_memberships m
                       where m.crew_id = new.host_crew_id and m.driver_id = r.driver_id and m.status = 'active');
  end if;
  return null;
end $$;

drop trigger if exists hub_events_drop_nonmember_rsvps on public.hub_events;
create trigger hub_events_drop_nonmember_rsvps
  after update of members_only, host_crew_id on public.hub_events
  for each row execute function public.hub_events_drop_nonmember_rsvps();
