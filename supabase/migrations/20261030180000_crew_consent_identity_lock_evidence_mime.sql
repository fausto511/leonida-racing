-- Security fixes 30.10.2026 (Fausto): applied via MCP apply_migration "crew_consent_identity_lock_evidence_mime".
-- 1) Only the invited driver can accept/decline an invite; only the driver chooses their main crew.
create or replace function public.crew_memberships_consent_guard()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  if auth.uid() is null or public.is_moderator() then
    return new;
  end if;
  if old.status = 'invited' and new.status is distinct from old.status
     and old.driver_id is distinct from public.current_driver_id() then
    raise exception 'invite_needs_consent: only the invited driver can accept or decline an invite'
      using errcode = '42501';
  end if;
  if pg_trigger_depth() = 1 and new.is_primary is distinct from old.is_primary
     and old.driver_id is distinct from public.current_driver_id() then
    raise exception 'primary_crew_self_only: only the driver can choose their main crew'
      using errcode = '42501';
  end if;
  return new;
end
$fn$;
revoke execute on function public.crew_memberships_consent_guard() from public, anon, authenticated;
create or replace trigger crew_memberships_consent_guard
  before update on public.crew_memberships
  for each row execute function public.crew_memberships_consent_guard();

-- 2) Crew name and tag are locked after approval (moderators only).
create or replace function public.crews_protect_identity()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  if auth.uid() is not null and not public.is_moderator()
     and (btrim(new.name) is distinct from btrim(old.name) or upper(new.tag) is distinct from upper(old.tag)) then
    raise exception 'crew_identity_locked: only a moderator can change the crew name or tag'
      using errcode = '42501';
  end if;
  return new;
end
$fn$;
revoke execute on function public.crews_protect_identity() from public, anon, authenticated;
create or replace trigger crews_protect_identity
  before update on public.crews
  for each row execute function public.crews_protect_identity();

-- 3) Lap evidence uploads: common image formats only.
update storage.buckets
   set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
 where id = 'lap-evidence';
