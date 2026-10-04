// Event sign-ups ("I'm in"), shared by the Event Calendar and the Hub
// overview (2026-10-02). Everyone sees who is going; logged-in drivers can
// join / cancel; rules (capacity, closed, cancelled, past) are enforced by the DB.
import { eventDiscord, esc, psnProfileUrl, type HubEvent } from '../data/hub';
import { sampleRsvps, setSampleRsvp } from './sample-rsvp';
import { backendConfigured, getSupabase } from './supabase-client';

export function createEventRsvp(root: HTMLElement) {
  let events: HubEvent[] = [];
  let live = false;

  let going = new Map<string, (string | null)[]>(); // event_id -> names (null = anonymous)
  let mine = new Set<string>();
  let session: any = null;
  let me: string | null = null;
  let note: { id: string; text: string; err?: boolean; discord?: string | null } | null = null;

  const isOver = (e: HubEvent) => new Date(e.ends_at ?? new Date(new Date(e.starts_at).getTime() + 3 * 3600e3).toISOString()) < new Date();

  // COPY STATUS: approved (Codex 2026-10-02, Fausto).
  function nextStepHtml(e: HubEvent, sample: boolean): string {
    const discord = sample ? null : eventDiscord(e);
    const psn = e.host_name ? esc(e.host_name) : '';
    // PSN profile link instead of "Copy" (Fausto 2026-10-04): copying on a PC
    // doesn't help on the console; the profile page opens in the PlayStation
    // app / browser where the friend request can be sent directly.
    const psnPart = psn ? `<span class="ev-next-psn">Host on PlayStation: <strong>${psn}</strong> <a class="ev-next-copy" href="${esc(psnProfileUrl(e.host_name!))}" target="_blank" rel="noopener nofollow">Open PSN Profile ↗</a></span>` : '';
    if (sample) {
      return `<div class="ev-next"><p class="ev-next-text"><strong>You\u2019re in.</strong> This is a sample event, so no real invite will be sent.</p></div>`;
    }
    if (discord) {
      return `<div class="ev-next"><p class="ev-next-text"><strong>You\u2019re in \u2014 one more step.</strong> Join the host\u2019s Discord so they can send your lobby invite.</p><a class="btn ev-next-dc" href="${esc(discord)}" target="_blank" rel="noopener">Join the Host\u2019s Discord</a>${psnPart}</div>`;
    }
    return `<div class="ev-next"><p class="ev-next-text"><strong>You\u2019re in \u2014 one more step.</strong> Add the host on PlayStation and message them for your lobby invite.</p>${psnPart}</div>`;
  }

  function renderRsvps() {
    root.querySelectorAll<HTMLElement>('[data-rsvp]').forEach((slot) => {
      const id = slot.dataset.rsvp!;
      const e = events.find((x) => x.event_id === id);
      if (!e) return;
      const names = live ? (going.get(id) ?? []) : [...(e.sample_going ?? []), ...(mine.has(id) ? ['You'] : [])];
      const n = names.length;
      const max = e.max_participants ?? null;
      const full = max != null && n >= max;
      const closed = e.status === 'cancelled' || isOver(e);
      const named = names.filter(Boolean).map((x) => esc(x));
      const anon = n - named.length;
      const countTxt = `${n}${max ? ' / ' + max : ''} going`;
      const list = n ? `<details class="ev-going"><summary>${countTxt}</summary><p>${named.join(', ')}${anon ? `${named.length ? ' + ' : ''}${anon} anonymous` : ''}</p></details>` : `<span class="ev-going-none">${max ? `0 / ${max} going` : 'Be the first to join'}</span>`;
      let action = '';
      if (mine.has(id)) action = `<button type="button" class="btn btn-sm ev-rsvp-btn is-in" data-leave="${esc(id)}" title="Click to cancel">Going ✓</button>`;
      else if (closed) action = '';
      else if (e.registration === 'closed') action = '<span class="ev-full">Sign-ups Closed</span>';
      else if (full) action = '<span class="ev-full">Full</span>';
      else action = `<button type="button" class="btn btn-sm btn-primary ev-rsvp-btn" data-join="${esc(id)}">I'm in</button>`;
      const msg = note && note.id === id ? `<span class="ev-rsvp-msg${note.err ? ' is-error' : ''}">${esc(note.text)}</span>` : '';
      slot.innerHTML = `${list}${action}${msg}`;
      // Next step after "I'm in" (Fausto, 2026-10-01): signing up alone is
      // not enough -- the host has to be reached to get the invite.
      const row = slot.closest('.ev-row');
      row?.querySelector('.ev-next')?.remove();
      if (row && mine.has(id) && e.status !== 'cancelled' && !isOver(e)) row.insertAdjacentHTML('beforeend', nextStepHtml(e, !live));
    });
  }

  async function loadRsvps() {
    const sb = getSupabase();
    const ids = events.map((e) => e.event_id);
    if (!ids.length) return;
    const [pub, own] = await Promise.all([
      sb.from('public_event_rsvps').select('event_id, display_name, created_at').in('event_id', ids).order('created_at'),
      me ? sb.from('hub_event_rsvps').select('event_id').eq('driver_id', me) : Promise.resolve({ data: [] as any[] }),
    ]);
    going = new Map();
    for (const r of (pub.data ?? []) as any[]) {
      if (!going.has(r.event_id)) going.set(r.event_id, []);
      going.get(r.event_id)!.push(r.display_name);
    }
    mine = new Set(((own.data ?? []) as any[]).map((r) => r.event_id));
    renderRsvps();
  }

  async function join(id: string) {
    if (!live) {
      // sample event: demo only, stored in this browser
      mine = setSampleRsvp(id, true);
      note = { id, text: session ? 'You\u2019re in — shown in My Account > Events. Sample event: it won\u2019t take place.' : 'You\u2019re in (saved in this browser). Sample event: it won\u2019t take place.' };
      renderRsvps();
      return;
    }
    if (!session) {
      const url = new URL(window.location.href); url.hash = ''; url.searchParams.set('rsvp', id);
      getSupabase().auth.signInWithOAuth({ provider: 'discord', options: { redirectTo: url.toString(), scopes: 'identify email guilds.join' } });
      return;
    }
    if (!me) return;
    const { error } = await getSupabase().from('hub_event_rsvps').insert({ event_id: id, driver_id: me });
    const ev = events.find((x) => x.event_id === id);
    note = error ? { id, text: 'Could not sign up — the event may be full or already over.', err: true } : { id, text: 'You\u2019re in!', discord: ev ? eventDiscord(ev) : null };
    await loadRsvps();
  }
  async function leave(id: string) {
    if (!live) { mine = setSampleRsvp(id, false); note = { id, text: 'Cancelled.' }; renderRsvps(); return; }
    if (!me) return;
    const { error } = await getSupabase().from('hub_event_rsvps').delete().eq('event_id', id).eq('driver_id', me);
    note = error ? { id, text: 'That did not work — please try again.', err: true } : { id, text: 'Cancelled.' };
    await loadRsvps();
  }
  root.addEventListener('click', (ev) => {
    const t = ev.target as HTMLElement;
    const c = t.closest<HTMLButtonElement>('[data-copy]');
    if (c) {
      navigator.clipboard?.writeText(c.dataset.copy!).then(() => { c.textContent = 'Copied'; setTimeout(() => { c.textContent = 'Copy'; }, 1500); }).catch(() => {});
      return;
    }
    const j = t.closest<HTMLButtonElement>('[data-join]');
    const l = t.closest<HTMLButtonElement>('[data-leave]');
    if (j) { j.disabled = true; join(j.dataset.join!); }
    if (l) { l.disabled = true; leave(l.dataset.leave!); }
  });


  mine = sampleRsvps();
  if (backendConfigured) getSupabase().auth.getSession().then(({ data }) => { if (!live) session = data?.session ?? null; });

  return {
    /** Sample events: live = false (sign-ups stored in this browser). */
    setEvents(list: HubEvent[], isLive: boolean) {
      events = list;
      if (isLive && !live) mine = new Set();
      live = isLive;
    },
    renderRsvps,
    /** After live events are loaded: session, own sign-ups, pending "I'm in" from the login redirect. */
    async connect() {
      if (!backendConfigured || !live) return;
      const sb = getSupabase();
      session = (await sb.auth.getSession()).data?.session ?? null;
      if (session) {
        const own = await sb.from('drivers').select('driver_id').eq('auth_user_id', session.user.id).maybeSingle();
        me = own.data?.driver_id ?? null;
      }
      await loadRsvps();
      const url = new URL(window.location.href);
      const pending = url.searchParams.get('rsvp');
      if (pending) {
        url.searchParams.delete('rsvp');
        history.replaceState(null, '', url.pathname + url.search + url.hash);
        if (session && !mine.has(pending) && events.some((e) => e.event_id === pending)) join(pending);
      }
    },
  };
}
