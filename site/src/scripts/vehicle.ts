// Vehicle page in the browser (Redesign phase 5, DEC-0118): compare, My Garage,
// driver rating, owner count and live Gellhorn rows. Never blocks: every live
// step falls back to what the HTML already shows.
// COPY STATUS: hint and status texts are Claude placeholders -> Codex (DEC-0088).
import { backendConfigured, getSupabase } from './supabase-client';
import { currentDriverId, fetchOwned, setOwned } from './owned';
import { getSelected, toggleSelected } from './compare';
import { bubble, hideBubble } from './bubble';
import { LEADERBOARD_PLATFORM } from '../data/platforms';
import { lapTime } from '../data/leaderboard';
import { STAR_SVG } from '../data/site';
import { classRowsHtml, driverRowHtml, openRowHtml, startTileHtml, rivalsFromClass, rivalHtml, sortClass, GELLHORN_ROWS, type ClassRow } from '../data/vehicle-page';

const base = import.meta.env.BASE_URL;
const TRACK = 'gellhorn-international-raceway';
const MAX_COMPARE = 4;
// mirrors public.ratings_open() (DB decides; this only picks the hint)
const RATINGS_OPEN_AT = Date.parse('2026-11-18T10:00:00Z');

const root = document.getElementById('vp');
if (root) init(root);

function init(root: HTMLElement) {
  const $ = (id: string) => document.getElementById(id);
  const id = root.dataset.id!;
  const model = root.dataset.model!;
  const cls = root.dataset.class!;
  const classIds = (root.dataset.classIds ?? '').split(' ').filter(Boolean);
  const rateable = Boolean(root.dataset.rateable);
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
  let me: string | null = null;
  let owned = new Set<string>();
  let classRows: ClassRow[] | null = null; // live rows once real laps exist

  const login = (extra = '') => {
    const url = new URL(location.href);
    if (extra) url.searchParams.set(extra, '1');
    url.hash = '';
    getSupabase().auth.signInWithOAuth({ provider: 'discord', options: { redirectTo: url.toString(), scopes: 'identify email guilds.join' } });
  };
  const loginBtn = (what: string) => backendConfigured ? `<button type="button" class="btn btn-discord btn-sm" data-login="${what}">Log in with Discord</button>` : '';

  // ---- compare ---------------------------------------------------------------
  const cmpBtn = $('vh-cmp') as HTMLButtonElement;
  function paintCompare() {
    const sel = getSelected();
    cmpBtn.setAttribute('aria-pressed', String(sel.includes(id)));
    cmpBtn.querySelector('[data-l]')!.textContent = sel.includes(id) ? 'In compare' : 'Compare';
    document.querySelectorAll<HTMLElement>('[data-compare]').forEach((b) => b.setAttribute('aria-pressed', String(sel.includes(b.dataset.compare!))));
  }
  function toggleCompare(carId: string, anchor: HTMLElement) {
    const sel = getSelected();
    if (!sel.includes(carId) && sel.length >= MAX_COMPARE) { bubble(anchor, `You can compare up to ${MAX_COMPARE} cars. Remove one on the <a href="${base}cars/compare/">compare page</a> first.`); return; }
    const now = toggleSelected(carId);
    paintCompare();
    if (now) bubble(anchor, `Added to compare (${getSelected().length}/${MAX_COMPARE}). <a href="${base}cars/compare/">Open the comparison →</a>`);
    else hideBubble();
  }
  /** "vs →" / "Compare with the class leader": head to head on the compare page (just these two);
   *  "Pick any car": the stored selection plus this car (DEC-0128). */
  function compareWith(ids: string[], anchor: HTMLElement) {
    let list = ids;
    if (ids.length === 1) {
      const sel = getSelected();
      if (!sel.includes(ids[0]) && sel.length >= MAX_COMPARE) { bubble(anchor, `You can compare up to ${MAX_COMPARE} cars. Remove one on the <a href="${base}cars/compare/">compare page</a> first.`); return; }
      list = sel.includes(ids[0]) ? sel : [...sel, ids[0]];
    }
    location.href = `${base}cars/compare/?cars=${list.map(encodeURIComponent).join(',')}`;
  }
  cmpBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleCompare(id, cmpBtn); });
  paintCompare();
  window.addEventListener('pageshow', paintCompare);

  // ---- My Garage -------------------------------------------------------------
  const garBtn = $('vh-gar') as HTMLButtonElement;
  function paintGarage() {
    const on = owned.has(id);
    garBtn.setAttribute('aria-pressed', String(on));
    garBtn.querySelector('[data-l]')!.textContent = on ? 'In My Garage' : 'Add to My Garage';
    document.querySelectorAll<HTMLElement>('[data-garage]').forEach((b) => {
      const o = owned.has(b.dataset.garage!);
      b.setAttribute('aria-pressed', String(o));
      b.title = o ? 'In My Garage · click to remove' : 'Mark as owned · Adds the car to My Garage';
    });
  }
  async function toggleGarage(carId: string, anchor: HTMLElement, pendingKey = '') {
    if (!me) {
      bubble(anchor, `Log in to track the cars you own.${loginBtn(pendingKey || 'login')}`, 6000);
      return;
    }
    const next = !owned.has(carId);
    const btn = anchor instanceof HTMLButtonElement ? anchor : null;
    if (btn) btn.disabled = true;
    try {
      await setOwned(me, carId, next);
      next ? owned.add(carId) : owned.delete(carId);
      paintGarage();
      if (carId === id) { ownerCount = Math.max(0, ownerCount + (next ? 1 : -1)); paintOwners(); }
      if (next) {
        let seen = false;
        try { seen = localStorage.getItem('lr-garage-hint') === '1'; localStorage.setItem('lr-garage-hint', '1'); } catch { /* ignore */ }
        if (!seen) bubble(anchor, 'Added to My Garage. Your collection is under <b>My garage</b> in the account menu.', 6000);
      }
    } catch {
      bubble(anchor, 'Could not save. Please try again.');
    }
    if (btn) btn.disabled = false;
  }
  garBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleGarage(id, garBtn, 'own'); });

  // ---- owner count -------------------------------------------------------------
  let ownerCount = 0;
  function paintOwners() {
    const t = $('vs-own-t')!;
    const mine = owned.has(id);
    // V3 (Fausto 15.10.): number from the first other driver on; only you -> "It's in your garage"
    if (mine && ownerCount <= 1) t.innerHTML = `It's in <a class="vs-own-btn" href="${base}account/garage/">your garage</a>`;
    else if (ownerCount >= 1) t.innerHTML = `<b>${ownerCount}</b> ${ownerCount === 1 ? 'driver has' : 'drivers have'} it in their garage${mine ? ' (you too)' : ''}`;
    else t.innerHTML = 'Be the first to add it to <button type="button" class="vs-own-btn" data-add-garage>your garage</button>';
  }

  // ---- rating ----------------------------------------------------------------
  const stars = [...document.querySelectorAll<HTMLButtonElement>('#vr-stars .vr-star')];
  const avgEl = $('vr-avg')!;
  const sub = $('vr-sub')!;
  let avg: number | null = null, count = 0, mine: number | null = null;
  const open = () => Date.now() >= RATINGS_OPEN_AT;
  function paintRating(saved = false) {
    const shown = mine ?? (avg != null ? Math.round(avg) : 0);
    stars.forEach((s, i) => s.classList.toggle('on', i < shown));
    $('vr-stars')!.classList.toggle('is-locked', !rateable || !open());
    avgEl.hidden = avg == null;
    if (avg != null) avgEl.textContent = avg.toFixed(1);
    const base1 = avg != null ? `${count} ${count === 1 ? 'rating' : 'ratings'}` : 'Not enough ratings yet';
    let act = '';
    if (saved) act = '<span class="vr-saved">Saved</span>';
    else if (mine != null) act = `You rated it ${mine} ${STAR_SVG} · <button type="button" class="vr-act" data-rate-hint>change</button>`;
    else if (rateable && !me && backendConfigured) act = '<button type="button" class="vr-act" data-rate-hint>log in to rate</button>';
    else if (rateable) act = '<button type="button" class="vr-act" data-rate-hint>rate it</button>';
    sub.innerHTML = mine != null && !saved ? act : act ? `${base1} · ${act}` : base1;
  }
  async function rate(n: number, anchor: HTMLElement) {
    if (!rateable) { bubble(anchor, 'This car can be rated once it is officially released.'); return; }
    if (!me) { bubble(anchor, `Log in to rate this car.${loginBtn('login')}`, 6000); return; }
    if (!open()) { bubble(anchor, 'Ratings open at launch. Come back on Nov 19 and give it 1 to 5 stars.'); return; }
    const { error } = await getSupabase().from('vehicle_ratings').upsert({ driver_id: me, vehicle_id: id, stars: n, updated_at: new Date().toISOString() }, { onConflict: 'driver_id,vehicle_id' });
    if (error) { bubble(anchor, 'Could not save your rating. Please try again.'); return; }
    mine = n;
    paintRating(true);
    window.setTimeout(() => { loadRatingSummary().then(() => paintRating()); }, 1500);
  }
  stars.forEach((s) => s.addEventListener('click', (e) => { e.stopPropagation(); rate(Number(s.dataset.star), s); }));
  async function loadRatingSummary() {
    const { data } = await getSupabase().from('public_vehicle_ratings').select('rating_avg, rating_count').eq('vehicle_id', id).maybeSingle();
    const c = Number(data?.rating_count ?? 0);
    count = c;
    avg = c >= 3 && data?.rating_avg != null ? Number(data.rating_avg) : null;
  }

  // ---- clicks ----------------------------------------------------------------
  document.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const lb = t.closest<HTMLElement>('[data-login]');
    if (lb) { login(lb.dataset.login === 'own' ? 'own' : ''); return; }
    const cmp = t.closest<HTMLElement>('[data-compare]');
    if (cmp) { e.preventDefault(); e.stopPropagation(); toggleCompare(cmp.dataset.compare!, cmp); return; }
    const gar = t.closest<HTMLElement>('[data-garage]');
    if (gar) { e.preventDefault(); e.stopPropagation(); toggleGarage(gar.dataset.garage!, gar); return; }
    const add = t.closest<HTMLElement>('[data-add-garage]');
    if (add) { e.stopPropagation(); toggleGarage(id, add, 'own'); return; }
    const hint = t.closest<HTMLElement>('[data-rate-hint]');
    if (hint) {
      e.stopPropagation();
      if (!me && backendConfigured) bubble(hint, `Log in to rate this car.${loginBtn('login')}`, 6000);
      else if (!open()) bubble(hint, 'Ratings open at launch. Come back on Nov 19 and give it 1 to 5 stars.');
      else bubble(hint, 'Tap 1 to 5 stars. You can change your rating any time.');
      return;
    }
    const vs = t.closest<HTMLElement>('[data-vs]');
    if (vs) { e.preventDefault(); compareWith([id, vs.dataset.vs!], vs); return; }
    const lead = t.closest<HTMLElement>('[data-vs-leader]');
    if (lead) {
      e.preventDefault();
      const top = classRows ? sortClass(classRows).find((r) => r.ms != null) : null;
      const leaderId = top?.id ?? document.querySelector<HTMLAnchorElement>('#vg-class .vg-crow:not(.no-lap)')?.getAttribute('href')?.split('/').filter(Boolean).pop() ?? null;
      if (!leaderId) { bubble(lead, `No ${cls} has a Gellhorn lap yet.`); return; }
      if (leaderId === id) { bubble(lead, `The ${esc(model)} leads the ${esc(cls)} class.`); return; }
      compareWith([id, leaderId], lead);
      return;
    }
    const any = t.closest<HTMLElement>('[data-pick-any]');
    if (any) { e.preventDefault(); compareWith([id], any); return; }
    if (!t.closest('.lr-bubble')) hideBubble();
  });

  // ---- live Gellhorn ---------------------------------------------------------
  type RankRow = { scope_key: string; rank: number; driver_id: string; driver: string; lap_time_ms: number };
  const ranks = () => getSupabase().from('public_leaderboard_ranks').select('scope_key,rank,driver_id,driver,lap_time_ms').eq('track_id', TRACK).eq('platform', LEADERBOARD_PLATFORM).eq('scope', 'vehicle');
  async function loadGellhorn() {
    const { data: best, error } = await ranks().eq('rank', 1);
    if (error || !best?.length) return; // no real lap anywhere yet -> keep the sample
    const bestBy = new Map((best as RankRow[]).map((r) => [r.scope_key, r.lap_time_ms]));
    classRows = classIds.map((cid) => ({ id: cid, ms: bestBy.get(cid) ?? null }));
    $('vg-flag')!.hidden = true;
    $('vg-class')!.innerHTML = classRowsHtml(classRows, id, $('vg-class')!.dataset.more);
    const timed = classRows.filter((r) => r.ms != null).length;
    $('vg-csub')!.textContent = timed < classIds.length ? `${timed} of ${classIds.length} cars have a lap · tap a car to open it` : 'Best lap per car · tap a car to open it';
    // value tile
    const mineBest = bestBy.get(id) ?? null;
    const tile = $('vt-lap')!;
    const v = tile.querySelector<HTMLElement>('[data-v]')!, s = tile.querySelector<HTMLElement>('[data-s]')!;
    if (mineBest != null) {
      const rank = 1 + classRows.filter((r) => r.ms != null && r.ms < mineBest).length;
      v.textContent = lapTime(mineBest); v.classList.remove('is-tba');
      s.textContent = `#${rank} of ${classIds.length} in ${cls} ↓`;
    } else { v.textContent = 'No lap yet'; v.classList.add('is-tba'); s.textContent = 'Set the first time ↓'; }
    // rivals
    const rv = rivalsFromClass(classRows, id);
    if (rv) { $('vh2h-list') && ($('vh2h-list')!.innerHTML = rv.map((r) => rivalHtml(r.id, r.note, id)).join('')); $('vh2h-sub') && ($('vh2h-sub')!.textContent = 'Its closest rivals at Gellhorn'); }
    // drivers in this car
    const [{ data: top }, own] = await Promise.all([
      ranks().eq('scope_key', id).lte('rank', GELLHORN_ROWS).order('rank'),
      me ? ranks().eq('scope_key', id).eq('driver_id', me).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    const rows = (top ?? []) as RankRow[];
    const myRow = (own as { data: RankRow | null }).data;
    const box = $('vg-drivers')!;
    const has = rows.length > 0;
    ($('vg-dhead') as HTMLElement).hidden = !has;
    ($('vg-set') as HTMLElement).hidden = !has;
    ($('vg-lb') as HTMLElement).hidden = !has;
    ($('vg-how') as HTMLElement).hidden = has;
    if (!has) { box.innerHTML = startTileHtml(model, `${base}time-attack/submit/`); return; }
    let html = rows.map((r) => driverRowHtml({ rank: r.rank, driver: r.driver, ms: r.lap_time_ms, me: r.driver_id === me })).join('');
    if (myRow && myRow.rank > GELLHORN_ROWS) html += driverRowHtml({ rank: myRow.rank, driver: myRow.driver, ms: myRow.lap_time_ms, me: true });
    else if (!myRow) html += openRowHtml();
    box.innerHTML = html;
    $('vg-set')!.querySelector('[data-l]')!.textContent = myRow ? 'Beat your time' : 'Set a Gellhorn time';
  }

  // ---- start -----------------------------------------------------------------
  paintRating();
  if (!backendConfigured) return;
  (async () => {
    me = await currentDriverId();
    loadGellhorn().catch(() => { /* keep the sample */ });
    const url = new URL(location.href);
    const pendingOwn = url.searchParams.get('own') === '1';
    if (pendingOwn) { url.searchParams.delete('own'); history.replaceState(null, '', url.pathname + url.search + url.hash); }
    const sb = getSupabase();
    const [ownedSet, countRes, mineRes] = await Promise.all([
      me ? fetchOwned() : Promise.resolve(new Set<string>()),
      sb.from('public_vehicle_owner_counts').select('owner_count').eq('vehicle_id', id).maybeSingle(),
      me ? sb.from('vehicle_ratings').select('stars').eq('driver_id', me).eq('vehicle_id', id).maybeSingle() : Promise.resolve({ data: null }),
      loadRatingSummary(),
    ]);
    owned = ownedSet;
    ownerCount = Number((countRes as { data: { owner_count?: number } | null }).data?.owner_count ?? 0);
    mine = (mineRes as { data: { stars?: number } | null }).data?.stars ?? null;
    paintGarage();
    paintOwners();
    paintRating();
    if (pendingOwn && me && !owned.has(id)) toggleGarage(id, garBtn);
  })().catch(() => { /* keep the static page */ });
}
