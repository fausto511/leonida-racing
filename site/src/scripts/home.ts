// Home page behaviour (Redesign Phase 3, DEC-0116).
// Never blocks: every live step falls back to what the HTML already shows.
// COPY STATUS: dashboard texts are Claude placeholders from the mockup -> Codex (DEC-0088).
import { backendConfigured, getSupabase } from './supabase-client';
import { fetchLiveCrews, fetchLiveEvents, pickFeaturedCrews } from './hub-live';
import { createEventRsvp } from './event-rsvp';
import { createCrewMembership } from './crew-membership';
import { isSelected, toggleSelected } from './compare';
import { localizeTimes, sampleCrews, sampleEventsUpcoming, eventTypeLabels, type HubEvent } from '../data/hub';
import { homeEventRow, homeOpenSpotRow, homeCrewRow, homeLbRow, type TRow } from '../data/home';
import { lapTime } from '../data/leaderboard';
import { LEADERBOARD_PLATFORM } from '../data/platforms';
import { vehicleOptions } from '../data/vehicles';

const base = import.meta.env.BASE_URL;
const TRACK = 'gellhorn-international-raceway';
const INVITE = 'https://discord.gg/hPGuBwXRqT';
const root = document.documentElement;
const $ = (id: string) => document.getElementById(id);
const shuffle = <T,>(a: T[]): T[] => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

// ---------------------------------------------------------------------------
// Rotations: fixed cards stay, two picks from the pool, order mixed per load
// (Fastest at Gellhorn: Super + Sports + 2 random classes; Guide: Racing first + 2).
// ---------------------------------------------------------------------------
function rotate(gridId: string, total: number, shuffleAll: boolean) {
  const grid = $(gridId);
  if (!grid) return;
  const cards = [...grid.children] as HTMLElement[];
  const fixed = cards.filter((c) => c.dataset.rotate === 'fixed');
  const pool = cards.filter((c) => c.dataset.rotate !== 'fixed');
  const picked = shuffle(pool).slice(0, Math.max(0, total - fixed.length));
  cards.forEach((c) => { c.dataset.rotate = 'pool'; });
  const shown = shuffleAll ? shuffle([...fixed, ...picked]) : [...fixed, ...picked];
  shown.forEach((c) => { c.dataset.rotate = 'shown'; grid.appendChild(c); });
}
rotate('fastest', 4, true);
rotate('guide-cards', 3, false);

// Compare "+" on the car cards (same storage as the Cars page).
document.querySelectorAll<HTMLButtonElement>('[data-compare]').forEach((btn) => {
  const id = btn.dataset.compare!;
  btn.setAttribute('aria-pressed', String(isSelected(id)));
  btn.addEventListener('click', (ev) => {
    ev.preventDefault();
    btn.setAttribute('aria-pressed', String(toggleSelected(id)));
  });
});

// ---------------------------------------------------------------------------
// Community: sample rows first (in the HTML), live rows when published ones exist
// ---------------------------------------------------------------------------
const evRoot = $('home-events')!;
const crewRoot = $('home-crews')!;
localizeTimes(evRoot);
const rsvp = createEventRsvp(evRoot);
rsvp.setEvents(sampleEventsUpcoming().filter((e) => e.status !== 'cancelled').slice(0, 3), false);
rsvp.renderRsvps();
const crewJoin = createCrewMembership(crewRoot, null);
crewJoin.setCrews(sampleCrews, false);

const isOver = (e: HubEvent) => new Date(e.ends_at ?? new Date(new Date(e.starts_at).getTime() + 3 * 3600e3).toISOString()).getTime() < Date.now();

fetchLiveEvents().then(async (live) => {
  const next = (live ?? []).filter((e) => e.status !== 'cancelled' && !isOver(e)).slice(0, 3);
  if (!next.length) return;
  evRoot.innerHTML = next.map(homeEventRow).join('') + Array.from({ length: 3 - next.length }, homeOpenSpotRow).join('');
  localizeTimes(evRoot);
  rsvp.setEvents(next, true);
  rsvp.renderRsvps();
  await rsvp.connect();
});

async function loadLiveCrews(ownCrewIds: Set<string>) {
  const live = await fetchLiveCrews();
  if (!live) return;
  // Eingeloggt: own crews (active or member) are left out (DEC-0116).
  const list = pickFeaturedCrews(live.filter((c) => !ownCrewIds.has(c.crew_id ?? '')), 4);
  if (!list.length) return;
  crewRoot.innerHTML = list.map((c) => homeCrewRow(c, false)).join('');
  await crewJoin.setCrews(live, true);
}

// ---------------------------------------------------------------------------
// Time Attack band
// ---------------------------------------------------------------------------
type RankRow = { scope: string; scope_key: string; rank: number; run_id: string; driver_id: string; driver: string; make: string; model: string; lap_time_ms: number; gap_to_ahead_ms: number | null; classes?: string[] };
const RANK_COLS = 'scope,scope_key,rank,run_id,driver_id,driver,make,model,lap_time_ms,gap_to_ahead_ms,classes';

async function crewTags(ids: string[]) {
  const tags = new Map<string, { tag: string; color: string }>();
  if (!ids.length) return tags;
  const { data } = await getSupabase().from('public_crew_roster').select('*').in('driver_id', ids.slice(0, 300));
  for (const r of (data ?? []) as { driver_id: string; tag: string; color: string; is_primary?: boolean }[]) {
    if (!tags.has(r.driver_id) || r.is_primary) tags.set(r.driver_id, { tag: r.tag, color: r.color });
  }
  return tags;
}
const ranks = () => getSupabase().from('public_leaderboard_ranks').select(RANK_COLS).eq('track_id', TRACK).eq('platform', LEADERBOARD_PLATFORM);

async function renderBand(rows: RankRow[], title: string, me: string | null) {
  const tags = await crewTags([...new Set(rows.map((r) => r.driver_id))]);
  let prev = 0;
  const html = rows.map((r) => {
    const row: TRow = { rank: r.rank, driver: r.driver, crew: tags.get(r.driver_id) ?? null, car: `${r.make} ${r.model}`, ms: r.lap_time_ms, me: r.driver_id === me, gapBefore: prev > 0 && r.rank > prev + 1 };
    prev = r.rank;
    return homeLbRow(row);
  }).join('');
  $('tband-rows')!.innerHTML = html;
  $('tband-title')!.textContent = title;
  $('tband-flag')!.hidden = true;
}

/** Guest / new driver: Top 5 overall. */
async function bandOverall() {
  const { data, error } = await ranks().eq('scope', 'overall').lte('rank', 5).order('rank');
  if (error || !data?.length) return;
  await renderBand(data as RankRow[], 'Top 5 · overall', null);
}

/** Active driver: Top 3 of ONE class + the driver ahead, own row, the driver behind.
 *  Class = smallest gap to the driver ahead; #1 everywhere -> smallest lead over #2
 *  (pushes class variety instead of meta cars, DEC-0116). */
async function bandPersonal(me: string, myClassRows: RankRow[]) {
  let pick: RankRow | undefined;
  const chasing = myClassRows.filter((r) => r.rank > 1 && r.gap_to_ahead_ms != null).sort((a, b) => a.gap_to_ahead_ms! - b.gap_to_ahead_ms!);
  if (chasing.length) pick = chasing[0];
  else {
    const keys = myClassRows.map((r) => r.scope_key);
    const { data } = await ranks().eq('scope', 'class').eq('rank', 2).in('scope_key', keys);
    const seconds = ((data ?? []) as RankRow[]).filter((r) => r.gap_to_ahead_ms != null).sort((a, b) => a.gap_to_ahead_ms! - b.gap_to_ahead_ms!);
    pick = seconds.length ? myClassRows.find((r) => r.scope_key === seconds[0].scope_key) : myClassRows[0];
  }
  if (!pick) return bandOverall();
  const r = pick.rank;
  // around me: one ahead, one behind; last place -> two ahead
  const { data: top } = await ranks().eq('scope', 'class').eq('scope_key', pick.scope_key).lte('rank', 3).order('rank');
  const { data: near } = await ranks().eq('scope', 'class').eq('scope_key', pick.scope_key).gte('rank', Math.max(1, r - 2)).lte('rank', r + 1).order('rank');
  const nearRows = (near ?? []) as RankRow[];
  const isLast = !nearRows.some((x) => x.rank === r + 1);
  const wanted = new Set([1, 2, 3, r - 1, r, r + 1, ...(isLast ? [r - 2] : [])]);
  const byRank = new Map<number, RankRow>();
  [...((top ?? []) as RankRow[]), ...nearRows].forEach((x) => { if (wanted.has(x.rank)) byRank.set(x.rank, x); });
  const rows = [...byRank.values()].sort((a, b) => a.rank - b.rank);
  await renderBand(rows, `Top 3 · ${pick.scope_key}`, me);
}

// ---------------------------------------------------------------------------
// Logged-in dashboard (DEC-0116 hero): four tiles with a value or an empty state
// ---------------------------------------------------------------------------
function tile(id: string, val: string, sub: string, opts: { cta?: boolean; href?: string; bar?: number } = {}) {
  const el = $(id) as HTMLAnchorElement | null;
  if (!el) return;
  el.querySelector('[data-val]')!.innerHTML = val;
  const s = el.querySelector<HTMLElement>('[data-sub]')!;
  s.textContent = sub;
  s.classList.toggle('is-cta', Boolean(opts.cta));
  if (opts.href) el.href = opts.href;
  const bar = el.querySelector<HTMLElement>('[data-bar]');
  if (bar && opts.bar != null) bar.style.width = `${Math.min(100, Math.max(0, opts.bar))}%`;
}
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const shortDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}, ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
};

async function loadDashboard(session: any) {
  const sb = getSupabase();
  const own = await sb.from('drivers').select('driver_id, display_name').eq('auth_user_id', session.user.id).maybeSingle();
  const me: string | null = own.data?.driver_id ?? null;
  const meta = session.user.user_metadata ?? {};
  const name: string = own.data?.display_name ?? meta.full_name ?? meta.name ?? 'driver';
  $('hero-guest')!.hidden = true;
  $('hero-dash')!.hidden = false;
  if (!me) { $('dash-title')!.textContent = `Welcome, ${name}`; tile('dash-lap', 'No lap yet', 'Set your first time →', { cta: true, href: `${base}time-attack/submit/` }); return { me: null, classRows: [] as RankRow[], crewIds: new Set<string>() }; }

  const now = new Date().toISOString();
  const [lapsRes, ownedRes, crewRes, rsvpRes] = await Promise.all([
    ranks().eq('driver_id', me).in('scope', ['overall', 'class']),
    sb.from('owned_vehicles').select('vehicle_id, created_at').eq('driver_id', me).order('created_at', { ascending: false }),
    sb.from('crew_membership_overview').select('crew_id, crew_name, status, is_primary').eq('driver_id', me).in('status', ['active', 'pending']),
    sb.from('hub_event_rsvps').select('event_id').eq('driver_id', me),
  ]);
  const myRanks = (lapsRes.data ?? []) as RankRow[];
  const overall = myRanks.find((r) => r.scope === 'overall');
  const classRows = myRanks.filter((r) => r.scope === 'class');
  let active = false;

  // Best lap: time + "#N in <class> · #N overall"
  if (overall) {
    active = true;
    const inClass = classRows.filter((r) => r.run_id === overall.run_id).sort((a, b) => a.rank - b.rank)[0];
    const cls = inClass?.scope_key ?? null;
    tile('dash-lap', lapTime(overall.lap_time_ms), `${inClass ? `#${inClass.rank} in ${cls} · ` : ''}#${overall.rank} overall`, { href: `${base}time-attack/gellhorn-international-raceway/` });
  } else tile('dash-lap', 'No lap yet', 'Set your first time →', { cta: true, href: `${base}time-attack/submit/` });

  // My Garage: X / N cars + bar + latest
  const owned = (ownedRes.data ?? []) as { vehicle_id: string }[];
  const N = vehicleOptions.length;
  if (owned.length) {
    active = true;
    const latest = vehicleOptions.find((v) => v.id === owned[0].vehicle_id);
    tile('dash-garage', `${owned.length} <small>/ ${N} cars</small>`, latest ? `Latest: ${latest.make} ${latest.model}` : '', { bar: (owned.length / N) * 100 });
  } else tile('dash-garage', `0 <small>/ ${N} cars</small>`, 'Mark the cars you own →', { cta: true, bar: 0, href: `${base}cars/` });

  // Crew: name + next crew event, else member count
  const crews = (crewRes.data ?? []) as { crew_id: string; crew_name: string; status: string; is_primary?: boolean }[];
  const crewIds = new Set(crews.filter((c) => c.status === 'active').map((c) => c.crew_id));
  const main = crews.filter((c) => c.status === 'active').sort((a, b) => Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary)))[0];
  if (main) {
    active = true;
    const [ev, cr] = await Promise.all([
      sb.from('hub_events').select('title, starts_at').eq('host_crew_id', main.crew_id).eq('is_published', true).gte('starts_at', now).order('starts_at').limit(1),
      sb.from('crews').select('member_count').eq('crew_id', main.crew_id).maybeSingle(),
    ]);
    const next = ev.data?.[0];
    const members = cr.data?.member_count;
    tile('dash-crew', esc(main.crew_name), next ? `Next: ${next.title} · ${shortDate(next.starts_at)}` : members != null ? `${members} ${members === 1 ? 'member' : 'members'}` : 'Crew page →');
  } else tile('dash-crew', 'No crew', 'Find a crew →', { cta: true, href: `${base}community/crews/` });

  // Events: next event I'm going to
  const evIds = ((rsvpRes.data ?? []) as { event_id: string }[]).map((r) => r.event_id);
  let nextEv: { event_id: string; title: string; event_type: string; starts_at: string } | undefined;
  if (evIds.length) {
    const { data } = await sb.from('hub_events').select('event_id, title, event_type, starts_at').in('event_id', evIds).gte('starts_at', now).order('starts_at').limit(1);
    nextEv = data?.[0];
  }
  if (nextEv) {
    active = true;
    tile('dash-events', esc(nextEv.title), `${eventTypeLabels[nextEv.event_type as keyof typeof eventTypeLabels] ?? ''} · ${shortDate(nextEv.starts_at)}`, { href: `${base}community/events/#event-${encodeURIComponent(nextEv.event_id)}` });
  } else tile('dash-events', 'No events planned', 'Host one →', { cta: true, href: `${base}account/events/` });

  $('dash-title')!.textContent = `${active ? 'Welcome back' : 'Welcome'}, ${name}`;
  return { me, classRows, crewIds };
}

// ---------------------------------------------------------------------------
// Login state
// ---------------------------------------------------------------------------
const dband = $('dband-btn') as HTMLAnchorElement;
function showGuest() {
  root.classList.remove('lr-authed');
  $('hero-guest')!.hidden = false;
  $('hero-dash')!.hidden = true;
}

if (!backendConfigured) {
  showGuest();
} else {
  const sb = getSupabase();
  sb.auth.getSession().then(async ({ data }) => {
    const session = data?.session ?? null;
    if (!session) {
      showGuest();
      // Discord band: login = automatic server join (guilds.join)
      dband.removeAttribute('target');
      dband.addEventListener('click', (e) => {
        if (root.classList.contains('lr-authed')) return;
        e.preventDefault();
        sb.auth.signInWithOAuth({ provider: 'discord', options: { redirectTo: window.location.origin + window.location.pathname, scopes: 'identify email guilds.join' } });
      });
      loadLiveCrews(new Set());
      bandOverall();
      return;
    }
    $('dband-label')!.textContent = 'Open Discord';
    dband.href = INVITE;
    try {
      const { me, classRows, crewIds } = await loadDashboard(session);
      loadLiveCrews(crewIds);
      if (me && classRows.length) await bandPersonal(me, classRows);
      else await bandOverall();
    } catch {
      loadLiveCrews(new Set());
      bandOverall();
    }
  });
  // logging out on this page -> back to the guest view
  sb.auth.onAuthStateChange((event) => { if (event === 'SIGNED_OUT') window.location.reload(); });
}
