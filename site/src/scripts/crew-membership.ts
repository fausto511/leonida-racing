// Crew membership UI ("Request to join"), shared by The Hub > Crews and the
// Hub overview (2026-10-02). Up to 5 crews per driver incl. open requests,
// one active crew is the primary crew (DEC-0093). All rules are enforced by
// the DB (RLS + triggers on crew_memberships); this is only the UI.
// Sample crews (no live data yet): demo requests stored in this browser.
// COPY STATUS: approved (Codex 2026-10-02, Fausto), except the invite pill
// texts (RS-0063: "Invited", "Accept in My Account"). "Request Invite" and
// "Active Crew" follow the Rockstar Social Club wording (Fausto, 2026-10-02).
import { crewTagHtml, esc, type HubCrew } from '../data/hub';
import { backendConfigured, getSupabase } from './supabase-client';

export const CREW_LIMIT = 5;
type Mine = { membership_id: string; crew_id: string; status: 'invited' | 'pending' | 'active'; is_primary?: boolean };
const SAMPLE_KEY = 'lr-sample-crew-requests';

function readSample(): string[] { try { return JSON.parse(localStorage.getItem(SAMPLE_KEY) || '[]'); } catch { return []; } }
function writeSample(ids: string[]) { try { localStorage.setItem(SAMPLE_KEY, JSON.stringify(ids)); } catch { /* storage blocked */ } }

export type CrewMine = Mine;
/** onRender: called after every render with the driver's memberships (Crews page "Your crews" tile). */
export function createCrewMembership(root: HTMLElement, meEl: HTMLElement | null, onRender?: (mine: Mine[], crews: HubCrew[], live: boolean) => void) {
  let crews: HubCrew[] = [];
  let live = false;
  let session: any = null;
  let ownDriverId: string | null = null;
  let mine: Mine[] = [];
  let busy = false;
  const base = import.meta.env.BASE_URL;

  const crewById = (id: string) => crews.find((c) => (live ? c.crew_id : c.slug) === id);

  function render(message = '', isError = false) {
    // Invites don't count towards the limit until accepted (DEC-0094)
    const used = mine.filter((x) => x.status !== 'invited').length;
    const full = used >= CREW_LIMIT;
    root.querySelectorAll<HTMLElement>('.crew-card[data-crew-id]').forEach((card) => {
      const slot = card.querySelector<HTMLElement>('.crew-join-slot');
      if (!slot) return;
      const id = card.dataset.crewId!;
      const m = mine.find((x) => x.crew_id === id);
      if (m?.status === 'invited') slot.innerHTML = `<span class="crew-pill">Invited</span><a class="crew-link" href="${base}account/crew/">Accept in My Account</a>`;
      else if (m?.status === 'active') slot.innerHTML = `<span class="crew-pill">${m.is_primary ? 'Active Crew' : 'Crew Member'}</span>`;
      else if (m) slot.innerHTML = `<span class="crew-pill is-pending">Request Sent</span><button type="button" class="crew-link crew-withdraw" data-withdraw="${esc(id)}">Withdraw</button>`;
      else if (full) slot.innerHTML = `<span class="crew-pill is-pending" title="You can be in up to ${CREW_LIMIT} crews, open requests included">${CREW_LIMIT}-Crew Limit Reached</span>`;
      else slot.innerHTML = `<button type="button" class="crew-link crew-join-btn" data-join="${esc(id)}">Request Invite</button>`;
    });
    onRender?.(mine, crews, live);
    if (!meEl) return;
    const active = mine.filter((m) => m.status === 'active');
    const pending = mine.filter((m) => m.status === 'pending');
    const invited = mine.filter((m) => m.status === 'invited');
    const tags = active.map((m) => { const c = crewById(m.crew_id); return c ? crewTagHtml(c.tag, c.color, 'sm') : ''; }).join(' ');
    const parts: string[] = [];
    if (mine.length) {
      parts.push(`<span class="crew-me-text">${active.length ? `Your crews: ${tags}` : ''}${active.length && pending.length ? ' · ' : ''}${pending.length ? `${pending.length} request${pending.length === 1 ? '' : 's'} pending` : ''}${invited.length ? `${active.length || pending.length ? ' · ' : ''}${invited.length} invite${invited.length === 1 ? '' : 's'} waiting` : ''} <span class="crew-me-count">(${used}/${CREW_LIMIT})</span></span>`);
      parts.push(live ? `<a class="crew-link" href="${base}account/crew/">Manage in My Account</a>` : '<span class="crew-me-msg">Sample crews — requests stay in this browser.</span>');
    }
    if (message) parts.push(`<span class="crew-me-msg${isError ? ' is-error' : ''}">${esc(message)}</span>`);
    meEl.hidden = parts.length === 0;
    meEl.innerHTML = parts.join('');
  }

  async function loadMine() {
    mine = [];
    if (!live) { mine = readSample().map((id) => ({ membership_id: id, crew_id: id, status: 'pending' as const })); return; }
    ownDriverId = null;
    if (!session) return;
    const sb = getSupabase();
    const own = await sb.from('drivers').select('driver_id').eq('auth_user_id', session.user.id).maybeSingle();
    ownDriverId = own.data?.driver_id ?? null;
    if (!ownDriverId) return;
    let res: any = await sb.from('crew_memberships').select('membership_id, crew_id, status, is_primary').eq('driver_id', ownDriverId);
    if (res.error) res = await sb.from('crew_memberships').select('membership_id, crew_id, status').eq('driver_id', ownDriverId);
    mine = (res.data ?? []) as Mine[];
  }

  async function requestJoin(id: string) {
    if (busy) return;
    if (!live) {
      const ids = readSample();
      if (ids.length >= CREW_LIMIT) { render(`You can be in up to ${CREW_LIMIT} crews.`, true); return; }
      writeSample([...new Set([...ids, id])]);
      await loadMine();
      render('Request saved for this sample crew. Nothing was sent.');
      return;
    }
    if (!session) {
      const url = new URL(window.location.href);
      url.hash = '';
      url.searchParams.set('join', id);
      getSupabase().auth.signInWithOAuth({ provider: 'discord', options: { redirectTo: url.toString(), scopes: 'identify email guilds.join' } });
      return;
    }
    if (!ownDriverId) { render('Your driver profile is not ready yet — reload the page in a moment.', true); return; }
    busy = true;
    const { error } = await getSupabase().from('crew_memberships').insert({ crew_id: id, driver_id: ownDriverId });
    busy = false;
    await loadMine();
    if (error) { render(/crew_limit/.test(error.message) ? `You can be in up to ${CREW_LIMIT} crews, open requests included.` : 'Could not send the request. Please try again.', true); return; }
    render('Request sent. The crew leader will see it in My Account.');
  }

  async function withdraw(id: string) {
    if (busy) return;
    if (!live) { writeSample(readSample().filter((x) => x !== id)); await loadMine(); render('Request withdrawn.'); return; }
    const m = mine.find((x) => x.crew_id === id);
    if (!m) return;
    busy = true;
    const { error } = await getSupabase().from('crew_memberships').delete().eq('membership_id', m.membership_id);
    busy = false;
    await loadMine();
    render(error ? 'That did not work. Please try again.' : 'Request withdrawn.', Boolean(error));
  }

  root.addEventListener('click', (ev) => {
    const t = ev.target as HTMLElement;
    const j = t.closest<HTMLButtonElement>('[data-join]');
    const w = t.closest<HTMLButtonElement>('[data-withdraw]');
    if (j) { j.disabled = true; requestJoin(j.dataset.join!).finally(() => { j.disabled = false; }); }
    if (w) { w.disabled = true; withdraw(w.dataset.withdraw!).finally(() => { w.disabled = false; }); }
  });

  return {
    /** Call after (re)rendering the cards. */
    render,
    async setCrews(list: HubCrew[], isLive: boolean) {
      crews = list;
      live = isLive;
      if (live && backendConfigured) session = (await getSupabase().auth.getSession()).data?.session ?? null;
      await loadMine();
      render();
      if (!live) return;
      const url = new URL(window.location.href);
      const pending = url.searchParams.get('join');
      if (pending) {
        url.searchParams.delete('join');
        history.replaceState(null, '', url.pathname + url.search + url.hash);
        if (session && !mine.some((m) => m.crew_id === pending) && crewById(pending)) requestJoin(pending);
      }
      if (backendConfigured) getSupabase().auth.onAuthStateChange(async (event, s) => {
        if (event !== 'SIGNED_IN' && event !== 'SIGNED_OUT') return;
        if ((s?.user?.id ?? null) === (session?.user?.id ?? null)) return;
        session = s; await loadMine(); render();
      });
    },
    reload: async () => { await loadMine(); render(); },
  };
}
