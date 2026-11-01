-- DEC-0204 follow-up: a system draft (crew_removed_hidden) only goes live again when the event
-- has a contact after the save; otherwise it stays hidden and keeps its notice (a title-only
-- update does not fire hub_events_require_contact).
create or replace function public.hub_events_protect_moderation_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('lr.event_sync', true), '') = 'on' then return new; end if;
  if not public.is_moderator() then
    new.moderation_note := old.moderation_note;
    new.is_published := old.is_published;
    if old.host_notice = 'crew_removed_hidden' and not old.is_published then
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
