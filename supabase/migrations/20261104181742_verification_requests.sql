-- DEC-0217 (Fausto 04.11.2026): people can request the ICON status and crew leaders can request
-- crew verification. Proof: a personal code placed in their channel/bio/crew description
-- (proof_method 'code', link_url = where it is) or their Discord account with the channel
-- connected (proof_method 'discord'). Moderators decide in Hub > Requests.
alter table public.hub_role_requests
  add column proof_method text check (proof_method is null or proof_method in ('code', 'discord')),
  add column proof_code text;

alter table public.hub_role_requests drop constraint hub_role_requests_role_check;
alter table public.hub_role_requests add constraint hub_role_requests_role_check
  check (role = any (array['crew_leader'::text, 'event_host'::text, 'creator'::text, 'notable'::text, 'crew_verified'::text]));

alter table public.hub_role_requests drop constraint hub_role_requests_target;
alter table public.hub_role_requests add constraint hub_role_requests_target check (
  ((role = 'crew_leader') and (((crew_id is not null) and (new_crew_name is null)) or ((crew_id is null) and (new_crew_name is not null) and (new_crew_tag is not null) and (new_crew_color is not null))))
  or ((role = any (array['event_host'::text, 'creator'::text, 'notable'::text])) and (crew_id is null) and (new_crew_name is null))
  or ((role = 'crew_verified') and (crew_id is not null) and (new_crew_name is null))
);

-- Personal verification code (stable per account, so it can be placed before submitting).
create or replace function public.my_verification_code()
 returns text
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select case when public.current_driver_id() is null then null
              else 'LR-' || upper(substr(md5(public.current_driver_id()::text || ':lr-verify'), 1, 5)) end;
$function$;
grant execute on function public.my_verification_code() to authenticated;

-- Rules for the two request types (runs for inserts only; moderators decide via update).
create or replace function public.hub_role_requests_verify_guard()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if new.role not in ('notable', 'crew_verified') then return new; end if;
  if new.proof_method is null then
    raise exception 'verify_proof_method: choose how you prove it' using errcode = 'P0001';
  end if;
  if new.proof_method = 'code' and new.link_url is null then
    raise exception 'verify_proof_link: add the link where your code is' using errcode = 'P0001';
  end if;
  new.proof_code := 'LR-' || upper(substr(md5(new.driver_id::text || ':lr-verify'), 1, 5));
  if new.role = 'notable' then
    if exists (select 1 from public.hub_roles h where h.driver_id = new.driver_id and h.role = 'notable') then
      raise exception 'verify_already: you already have the ICON status' using errcode = 'P0001';
    end if;
  else
    if not public.is_crew_leader_of(new.crew_id, new.driver_id) then
      raise exception 'verify_not_leader: only the crew leader can request verification' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.crews c where c.crew_id = new.crew_id and c.is_verified) then
      raise exception 'verify_already: this crew is already verified' using errcode = 'P0001';
    end if;
  end if;
  if exists (select 1 from public.hub_role_requests r
              where r.driver_id = new.driver_id and r.role = new.role
                and r.crew_id is not distinct from new.crew_id
                and r.status = 'rejected' and r.decided_at > now() - interval '30 days') then
    raise exception 'verify_cooldown: you can request again 30 days after a declined request' using errcode = 'P0001';
  end if;
  return new;
end $function$;

create trigger hub_role_requests_verify_guard
  before insert on public.hub_role_requests
  for each row execute function public.hub_role_requests_verify_guard();

-- Approving a crew verification sets crews.is_verified instead of granting a hub role.
do $do$
declare d text; n text;
begin
  d := pg_get_functiondef('public.approve_hub_role_request'::regproc);
  n := replace(d,
    $a$  if not exists (select 1 from public.hub_roles h where h.driver_id = r.driver_id and h.role = r.role$a$,
    $b$  if r.role = 'crew_verified' then
    update public.crews set is_verified = true where crew_id = r.crew_id;
    update public.hub_role_requests
       set status = 'approved', decided_at = now(), decided_by = v_mod
     where request_id = p_request_id;
    return r.crew_id;
  end if;

  if not exists (select 1 from public.hub_roles h where h.driver_id = r.driver_id and h.role = r.role$b$);
  if n = d then raise exception 'approve_hub_role_request: anchor not found'; end if;
  execute n;

  d := pg_get_functiondef('public.discord_mod_alert_enqueue'::regproc);
  n := replace(d,
    $a$when 'creator' then 'Creator' else NEW.role end;$a$,
    $b$when 'creator' then 'Creator' when 'notable' then 'ICON' when 'crew_verified' then 'Crew verification' else NEW.role end;$b$);
  n := replace(n,
    $a$v_detail := case when NEW.new_crew_name is not null then 'new crew ' || NEW.new_crew_name || ' [' || coalesce(NEW.new_crew_tag, '') || ']' end;$a$,
    $b$v_detail := case when NEW.new_crew_name is not null then 'new crew ' || NEW.new_crew_name || ' [' || coalesce(NEW.new_crew_tag, '') || ']'
                      when NEW.role = 'crew_verified' then (select 'crew ' || c.name || ' [' || c.tag || ']' from public.crews c where c.crew_id = NEW.crew_id) end;$b$);
  if n = d then raise exception 'discord_mod_alert_enqueue: anchor not found'; end if;
  execute n;
end $do$;
