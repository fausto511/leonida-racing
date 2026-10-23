// Cars page (Redesign Phase 4, DEC-0117; review fixes C1–C7, Fausto 15.10.2026):
// search, filters (toolbar + detailed search with range sliders), chips, sort,
// "Show all", no-results help, compare (max 4) and My Garage. All cards are
// server-rendered; this only shows/hides/reorders them.
// COPY STATUS: messages are Claude placeholders -> Codex review (DEC-0088).
import { getSelected, toggleSelected, onCompareChange } from './compare';
import { currentDriverId, fetchOwned, setOwned } from './owned';
import { backendConfigured, getSupabase } from './supabase-client';
import { CLOSE_SVG } from '../data/site';
import { releaseById } from '../data/releases';
import { lapTime } from '../data/leaderboard';

const PAGE = 24;
const MAX_COMPARE = 4;
const $ = (id: string) => document.getElementById(id)!;
const grid = $('cars-grid');
const cards = [...grid.querySelectorAll<HTMLElement>('.vcard')];
const N = cards.length;
// page settings (CarsBrowser.astro): class/manufacturer pages sort by name and say "Sports cars"
const tools = document.getElementById('tools');
const DEFAULT_SORT = tools?.dataset.defaultSort ?? 'class';
const NOUN = tools?.dataset.noun ?? 'cars';

type Group = 'class' | 'make' | 'drive' | 'seats' | 'avail' | 'origin';
type RangeKey = 'price' | 'speed' | 'lap';
type FilterKey = Group | RangeKey | 'q' | 'own';
type Range = [number | null, number | null];
interface State { q: string; own: '' | 'owned' | 'not'; sort: string; sets: Record<Group, Set<string>>; ranges: Record<RangeKey, Range> }
const emptySets = (): Record<Group, Set<string>> => ({ class: new Set(), make: new Set(), drive: new Set(), seats: new Set(), avail: new Set(), origin: new Set() });
const emptyRanges = (): Record<RangeKey, Range> => ({ price: [null, null], speed: [null, null], lap: [null, null] });
const state: State = { q: '', own: '', sort: DEFAULT_SORT, sets: emptySets(), ranges: emptyRanges() };
let showAll = false;
let owned = new Set<string>();
let driverId: string | null = null;

// ---- data available? (C4: fields without data stay greyed out until it exists) ----
const values = (k: RangeKey) => cards.map((c) => Number(c.dataset[k])).filter((n) => n > 0);
const DOMAIN: Record<RangeKey, { min: number; max: number; has: boolean; log: boolean }> = {
  price: { ...minMax(values('price')), log: true },
  speed: { ...minMax(values('speed')), log: false },
  lap: { ...minMax(values('lap')), log: false },
};
function minMax(v: number[]) { return v.length ? { min: Math.min(...v), max: Math.max(...v), has: v.length >= 2 && Math.min(...v) < Math.max(...v) } : { min: 0, max: 0, has: false }; }

// ---- labels -----------------------------------------------------------------
const makeName = new Map<string, string>();
cards.forEach((c) => makeName.set(c.dataset.make!, c.querySelector('.vc-brand')?.textContent?.trim() ?? c.dataset.make!));
const AVAIL: Record<string, string> = { base: 'Base game', 'pre-order': 'Pre-Order bonus', 'ultimate-edition': 'Ultimate Edition', 'gta-plus': 'GTA+' };
const ORIGIN: Record<string, string> = { new: 'New in GTA VI', returning: 'Returning' };
const SEP = ' · ';
const fmtMoney = (n: number) => (n >= 1e6 ? `$${+(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${+(n / 1e3).toFixed(1)}k` : `$${Math.round(n)}`);
const FMT: Record<RangeKey, (n: number) => string> = { price: fmtMoney, speed: (n) => `${Math.round(n)} mph`, lap: (n) => lapTime(Math.round(n)) };
const RANGE_NAME: Record<RangeKey, string> = { price: 'Price', speed: 'Top speed', lap: 'Lap' };
function valueLabel(g: Group, v: string) {
  if (g === 'make') return makeName.get(v) ?? v;
  if (g === 'seats') return `${v} seats`;
  if (g === 'avail') return AVAIL[v] ?? v;
  if (g === 'origin') return ORIGIN[v] ?? v;
  return v;
}
function rangeLabel(k: RangeKey, r: Range): string {
  const [lo, hi] = r;
  if (k === 'price' && lo == null && hi != null) return `Max ${fmtMoney(hi)}`;
  if (lo != null && hi != null) return `${RANGE_NAME[k]} ${FMT[k](lo)} – ${FMT[k](hi)}`;
  if (lo != null) return `${RANGE_NAME[k]} from ${FMT[k](lo)}`;
  return `${RANGE_NAME[k]} up to ${FMT[k](hi!)}`;
}
const isRange = (k: FilterKey): k is RangeKey => k === 'price' || k === 'speed' || k === 'lap';
function filterLabel(k: FilterKey, st: State = state): string {
  if (k === 'q') return `“${st.q}”`;
  if (k === 'own') return st.own === 'owned' ? 'Owned' : 'Not owned';
  if (isRange(k)) return rangeLabel(k, st.ranges[k]);
  return [...st.sets[k]].map((v) => valueLabel(k, v)).join(' or ');
}

// ---- parsing ----------------------------------------------------------------
/** "750k", "1.5m", "$2,000,000" -> number */
export function parseMoney(s: string): number | null {
  const t = s.trim().toLowerCase().replace(/[$,\s]/g, '');
  if (!t) return null;
  const m = t.match(/^(\d+(?:\.\d+)?)(k|m|mio)?$/);
  if (!m) return null;
  const n = parseFloat(m[1]) * (m[2] === 'k' ? 1e3 : m[2] ? 1e6 : 1);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

// ---- matching ---------------------------------------------------------------
const rangeActive = (r: Range) => r[0] != null || r[1] != null;
function fails(c: HTMLElement, st: State): FilterKey[] {
  const d = c.dataset;
  const out: FilterKey[] = [];
  if (st.q) {
    const words = st.q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.every((w) => d.search!.includes(w))) out.push('q');
  }
  const s = st.sets;
  if (s.class.size && !d.classes!.split('|').some((x) => s.class.has(x))) out.push('class');
  if (s.make.size && !s.make.has(d.make!)) out.push('make');
  if (s.drive.size && !s.drive.has(d.drive!)) out.push('drive');
  if (s.seats.size && !s.seats.has(d.seats!)) out.push('seats');
  if (s.avail.size && !s.avail.has(d.avail!)) out.push('avail');
  if (s.origin.size && !s.origin.has(d.origin!)) out.push('origin');
  // A range hides cars without that value (DEC-0117: Max $ hides cars without a price)
  for (const k of ['price', 'speed', 'lap'] as RangeKey[]) {
    const [lo, hi] = st.ranges[k];
    if (lo == null && hi == null) continue;
    const v = Number(d[k]);
    if (!(v > 0) || (lo != null && v < lo) || (hi != null && v > hi)) out.push(k);
  }
  if (st.own === 'owned' && !owned.has(d.id!)) out.push('own');
  if (st.own === 'not' && owned.has(d.id!)) out.push('own');
  return out;
}
const activeKeys = (st: State): FilterKey[] => [
  ...(st.q ? ['q' as const] : []),
  ...(Object.keys(st.sets) as Group[]).filter((g) => st.sets[g].size),
  ...(['price', 'speed', 'lap'] as RangeKey[]).filter((k) => rangeActive(st.ranges[k])),
  ...(st.own ? ['own' as const] : []),
];
const countWith = (st: State) => cards.filter((c) => !fails(c, st).length).length;
const cloneState = (st: State): State => ({
  ...st,
  sets: Object.fromEntries((Object.keys(st.sets) as Group[]).map((g) => [g, new Set(st.sets[g])])) as Record<Group, Set<string>>,
  ranges: { price: [...st.ranges.price] as Range, speed: [...st.ranges.speed] as Range, lap: [...st.ranges.lap] as Range },
});
function without(st: State, k: FilterKey): State {
  const n = cloneState(st);
  if (k === 'q') n.q = '';
  else if (k === 'own') n.own = '';
  else if (isRange(k)) n.ranges[k] = [null, null];
  else n.sets[k] = new Set();
  return n;
}

// ---- sorting ----------------------------------------------------------------
const num = (v: string | undefined) => (v ? Number(v) : NaN);
const releaseTime = (id: string | undefined) => (id && releaseById[id]?.date ? Date.parse(releaseById[id].date!) : NaN);
function sortKey(a: HTMLElement, b: HTMLElement): number {
  const order = num(a.dataset.order) - num(b.dataset.order);
  const missingLast = (x: number, y: number, dir: 1 | -1) => (isNaN(x) && isNaN(y) ? order : isNaN(x) ? 1 : isNaN(y) ? -1 : (x - y) * dir || order);
  switch (state.sort) {
    case 'name': return a.dataset.name!.localeCompare(b.dataset.name!);
    case 'price': return missingLast(num(a.dataset.price), num(b.dataset.price), 1);
    case 'speed': return missingLast(num(a.dataset.speed), num(b.dataset.speed), -1);
    case 'lap': return missingLast(num(a.dataset.lap), num(b.dataset.lap), 1);
    case 'recent': return missingLast(releaseTime(a.dataset.release), releaseTime(b.dataset.release), -1);
    default: return order;
  }
}
const SORT_LABEL: Record<string, string> = { class: 'Class', name: 'Name A–Z', price: 'Price', speed: 'Top speed', lap: 'Gellhorn lap time', recent: 'Recently added' };

// ---- did you mean -------------------------------------------------------------
function lev(a: string, b: string): number {
  const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}
function didYouMean(q: string): HTMLElement | null {
  // S3: word by word, like the search itself ("mamba gr" -> Mamba GT)
  const qw = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!qw.length) return null;
  const wordDist = (w: string, x: string) => Math.min(lev(w, x), w.length >= 3 ? lev(w, x.slice(0, w.length)) : Infinity);
  let best: { c: HTMLElement; s: number } | null = null;
  for (const c of cards) {
    const words = c.dataset.name!.split(/\s+/);
    const perWord = qw.reduce((sum, w) => sum + Math.min(...words.map((x) => wordDist(w, x))), 0);
    const s = Math.min(perWord, lev(qw.join(' '), c.dataset.name!));
    // tie -> shorter name ("vapid dominatr" -> Dominator, not Dominator '67 Buggy)
    if (!best || s < best.s || (s === best.s && words.length < best.c.dataset.name!.split(/\s+/).length)) best = { c, s };
  }
  const len = qw.join('').length;
  return best && best.s > 0 && best.s <= Math.max(2, Math.floor(len / 3)) ? best.c : null;
}

// ---- range sliders (C5/C6) ------------------------------------------------------
// Slider position 0..1000 <-> value; price runs on a log scale so the many
// cheaper cars are not squeezed into the first millimetres.
const STEPS = 1000;
function toValue(k: RangeKey, pos: number): number {
  const { min, max, log } = DOMAIN[k];
  const t = pos / STEPS;
  return log ? Math.exp(Math.log(min) + t * (Math.log(max) - Math.log(min))) : min + t * (max - min);
}
function toPos(k: RangeKey, v: number | null, end: 'lo' | 'hi'): number {
  if (v == null) return end === 'lo' ? 0 : STEPS;
  const { min, max, log } = DOMAIN[k];
  const t = log ? (Math.log(v) - Math.log(min)) / (Math.log(max) - Math.log(min)) : (v - min) / (max - min);
  return Math.round(Math.min(1, Math.max(0, t)) * STEPS);
}
function niceValue(k: RangeKey, v: number): number {
  if (k === 'price') { const p = Math.pow(10, Math.floor(Math.log10(v)) - 1); return Math.round(v / p) * p; }
  if (k === 'lap') return Math.round(v / 100) * 100;
  return Math.round(v);
}
/** paint one slider block from a range */
function paintRange(el: HTMLElement, k: RangeKey, r: Range) {
  const lo = el.querySelector<HTMLInputElement>('.rng-lo');
  const hi = el.querySelector<HTMLInputElement>('.rng-hi')!;
  const pLo = toPos(k, r[0], 'lo'), pHi = toPos(k, r[1], 'hi');
  if (lo) lo.value = String(pLo);
  hi.value = String(pHi);
  const fill = el.querySelector<HTMLElement>('.rng-fill')!;
  fill.style.left = `${(lo ? pLo : 0) / STEPS * 100}%`;
  fill.style.right = `${100 - pHi / STEPS * 100}%`;
  const loEl = el.querySelector('[data-lo]'); const hiEl = el.querySelector('[data-hi]')!;
  if (loEl) loEl.textContent = r[0] != null ? FMT[k](r[0]) : 'Any';
  hiEl.textContent = r[1] != null ? FMT[k](r[1]) : 'Any';
}
/** wire a slider block; onChange gets the new range */
function wireRange(el: HTMLElement, k: RangeKey, get: () => Range, set: (r: Range) => void) {
  const on = DOMAIN[k].has;
  el.classList.toggle('is-off', !on);
  el.querySelectorAll('input').forEach((i) => { i.disabled = !on; });
  if (!on) { paintRange(el, k, [null, null]); return; }
  const lo = el.querySelector<HTMLInputElement>('.rng-lo');
  const hi = el.querySelector<HTMLInputElement>('.rng-hi')!;
  const read = () => {
    let a = lo ? Number(lo.value) : 0, b = Number(hi.value);
    if (lo && a > b) { if (document.activeElement === lo) a = b; else b = a; }
    const r: Range = [a <= 0 ? null : niceValue(k, toValue(k, a)), b >= STEPS ? null : niceValue(k, toValue(k, b))];
    set(r);
    paintRange(el, k, r);
  };
  lo?.addEventListener('input', read);
  hi.addEventListener('input', read);
  paintRange(el, k, get());
}

// ---- render -----------------------------------------------------------------
const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));
function render() {
  const keys = activeKeys(state);
  const matches = cards.filter((c) => !fails(c, state).length).sort(sortKey);
  const rest = cards.filter((c) => !matches.includes(c));
  [...matches, ...rest].forEach((c) => grid.appendChild(c));
  const limit = showAll ? Infinity : PAGE;
  matches.forEach((c, i) => c.classList.toggle('is-hidden', i >= limit));
  rest.forEach((c) => c.classList.add('is-hidden'));
  grid.classList.toggle('one-class', state.sets.class.size === 1);
  // C7: one click shows everything
  ($('show-more') as HTMLButtonElement).hidden = matches.length <= limit;
  $('show-more').textContent = `Show all ${matches.length} ${matches.length === N ? NOUN : 'cars'}`;

  const chips = $('chips');
  if (!keys.length) chips.innerHTML = `<span class="muted">Showing ${matches.length} ${matches.length === N ? NOUN : 'cars'}</span>`;
  else chips.innerHTML = `<span class="muted">${matches.length} ${matches.length === 1 ? 'car' : 'cars'}</span>`
    + keys.map((k) => `<button type="button" class="fchip" data-drop="${k}" aria-label="Remove filter ${esc(filterLabel(k))}">${esc(filterLabel(k))}<b aria-hidden="true">${CLOSE_SVG}</b></button>`).join('')
    + `<button type="button" class="clear-all" data-clear>Clear all</button>`;

  const one = (g: Group, all: string) => (state.sets[g].size === 0 ? all : state.sets[g].size === 1 ? valueLabel(g, [...state.sets[g]][0]) : `${state.sets[g].size} selected`);
  const ddc = document.querySelector('[data-dd-label="class"]'); if (ddc) ddc.textContent = one('class', 'All');
  const ddm = document.querySelector('[data-dd-label="make"]'); if (ddm) ddm.textContent = one('make', 'All');
  document.querySelectorAll<HTMLElement>('[data-pick-class]').forEach((b) => b.classList.toggle('on', b.dataset.pickClass ? state.sets.class.has(b.dataset.pickClass) : !state.sets.class.size));
  document.querySelectorAll<HTMLElement>('[data-pick-make]').forEach((b) => b.classList.toggle('on', b.dataset.pickMake ? state.sets.make.has(b.dataset.pickMake) : !state.sets.make.size));
  document.querySelectorAll<HTMLElement>('[data-sort]').forEach((b) => b.classList.toggle('on', b.dataset.sort === state.sort));
  document.querySelectorAll('[data-sort-label]').forEach((el) => { el.textContent = SORT_LABEL[state.sort]; });
  const maxInput = $('f-max') as HTMLInputElement;
  if (document.activeElement !== maxInput) maxInput.value = state.ranges.price[1] != null ? fmtMoney(state.ranges.price[1]).replace('$', '') : '';
  const single = document.querySelector<HTMLElement>('[data-range="price"][data-single]');
  if (single && DOMAIN.price.has) paintRange(single, 'price', [null, state.ranges.price[1]]);
  const qInput = $('f-q') as HTMLInputElement;
  if (document.activeElement !== qInput) qInput.value = state.q;
  const pro = (['drive', 'seats', 'avail', 'origin'] as Group[]).reduce((n, g) => n + state.sets[g].size, 0)
    + (rangeActive(state.ranges.speed) ? 1 : 0) + (rangeActive(state.ranges.lap) ? 1 : 0) + (state.ranges.price[0] != null ? 1 : 0);
  $('detail-count').hidden = !pro; $('detail-count').textContent = String(pro);
  const allF = keys.filter((k) => k !== 'q' && k !== 'own').length;
  $('filter-count').hidden = !allF; $('filter-count').textContent = String(allF);
  document.querySelectorAll<HTMLElement>('[data-own]').forEach((b) => b.classList.toggle('on', b.dataset.own === state.own));

  const empty = $('empty');
  empty.hidden = matches.length > 0;
  if (!matches.length) {
    $('empty-drops').innerHTML = keys.map((k) => {
      const n = countWith(without(state, k));
      return n ? `<button type="button" class="btn btn-s btn-md" data-drop="${k}">Without ${esc(filterLabel(k))} → ${n} ${n === 1 ? 'car' : 'cars'}</button>` : '';
    }).join('');
    // S1: only say "no car named …" when the search text alone finds nothing
    const qHits = state.q ? cards.filter((c) => !fails(c, state).includes('q')).length : 0;
    const dym = state.q && !qHits ? didYouMean(state.q) : null;
    $('empty-dym').innerHTML = !state.q
      ? 'Try removing a filter.'
      : qHits
        ? `<b>“${esc(state.q)}”</b> matches ${qHits} ${qHits === 1 ? 'car' : 'cars'}, but none with your other filters.`
        : `No car named <b>“${esc(state.q)}”</b>.${dym ? ` Did you mean <a href="#" data-dym="${esc(dym.dataset.name!)}">${esc(dym.querySelector('.vc-brand')!.textContent!.trim())} ${esc(dym.querySelector('.vc-name')!.textContent!.trim())}</a>?` : ''}`;
    const near = cards.map((c) => ({ c, f: fails(c, state) })).filter((x) => x.f.length === 1 && x.f[0] !== 'q').sort((a, b) => sortKey(a.c, b.c)).slice(0, 4);
    $('closest-wrap').hidden = !near.length;
    $('closest').innerHTML = '';
    near.forEach(({ c, f }) => {
      const cl = c.cloneNode(true) as HTMLElement;
      cl.classList.remove('is-hidden');
      cl.querySelector('.vc-name')?.insertAdjacentHTML('afterend', `<span class="miss">Not ${esc(filterLabel(f[0]))}</span>`);
      $('closest').appendChild(cl);
    });
  }
  paintOwnCounts();
  syncUrl();
}

// ---- URL --------------------------------------------------------------------
const rangeParam = (r: Range) => `${r[0] ?? ''}~${r[1] ?? ''}`;
function syncUrl() {
  const p = new URLSearchParams();
  if (state.q) p.set('q', state.q);
  if (state.sets.class.size) p.set('class', [...state.sets.class].join(','));
  if (state.sets.make.size) p.set('make', [...state.sets.make].join(','));
  const pr = state.ranges.price;
  if (pr[0] == null && pr[1] != null) p.set('max', String(pr[1]));
  else if (rangeActive(pr)) p.set('price', rangeParam(pr));
  if (rangeActive(state.ranges.speed)) p.set('speed', rangeParam(state.ranges.speed));
  if (rangeActive(state.ranges.lap)) p.set('lap', rangeParam(state.ranges.lap));
  if (state.sort !== DEFAULT_SORT) p.set('sort', state.sort);
  const qs = p.toString();
  history.replaceState(null, '', location.pathname + (qs ? `?${qs}` : '') + location.hash);
}
function readUrl() {
  const p = new URLSearchParams(location.search);
  state.q = p.get('q') ?? '';
  p.get('class')?.split(',').filter(Boolean).forEach((c) => state.sets.class.add(c));
  p.get('make')?.split(',').filter(Boolean).forEach((m) => state.sets.make.add(m));
  const parseR = (v: string | null): Range => { if (!v) return [null, null]; const [a, b] = v.split('~'); return [a ? Number(a) : null, b ? Number(b) : null]; };
  if (DOMAIN.price.has) {
    const m = p.get('max'); if (m) state.ranges.price = [null, parseMoney(m)];
    if (p.get('price')) state.ranges.price = parseR(p.get('price'));
  }
  if (DOMAIN.speed.has) state.ranges.speed = parseR(p.get('speed'));
  if (DOMAIN.lap.has) state.ranges.lap = parseR(p.get('lap'));
  const s = p.get('sort');
  if (s && SORT_LABEL[s] && !(['price', 'speed', 'lap'].includes(s) && !DOMAIN[s as RangeKey].has)) state.sort = s;
}

// ---- hint bubble at the clicked control (C1) -------------------------------------
let bubbleTimer = 0;
let bubbleAnchor: HTMLElement | null = null;
function hideBubble() { $('toast').hidden = true; bubbleAnchor = null; }
function bubble(anchor: HTMLElement, html: string, ms = 4500) {
  const t = $('toast');
  t.innerHTML = html;
  t.hidden = false;
  bubbleAnchor = anchor;
  const a = anchor.getBoundingClientRect();
  const w = t.offsetWidth, h = t.offsetHeight;
  const below = a.top - h - 14 < 8; // not enough room above -> show below
  t.classList.toggle('below', below);
  const cx = a.left + a.width / 2;
  const left = Math.min(Math.max(12, cx - w / 2), window.innerWidth - w - 12);
  t.style.left = `${left}px`;
  t.style.top = `${below ? a.bottom + 12 : a.top - h - 12}px`;
  t.style.setProperty('--arrow-x', `${Math.min(w - 14, Math.max(14, cx - left))}px`);
  clearTimeout(bubbleTimer);
  bubbleTimer = window.setTimeout(hideBubble, ms);
}
window.addEventListener('scroll', () => { if (bubbleAnchor) hideBubble(); }, { passive: true });
window.addEventListener('resize', () => { if (bubbleAnchor) hideBubble(); });
const login = () => getSupabase().auth.signInWithOAuth({ provider: 'discord', options: { redirectTo: location.origin + location.pathname + location.search, scopes: 'identify email guilds.join' } });

// ---- compare ----------------------------------------------------------------
function renderCompare() {
  const sel = getSelected();
  document.querySelectorAll<HTMLElement>('[data-compare]').forEach((b) => b.setAttribute('aria-pressed', String(sel.includes(b.dataset.compare!))));
  $('cmp-btn').classList.toggle('on', sel.length > 0);
  $('cmp-n').textContent = sel.length ? String(sel.length) : `0 / ${MAX_COMPARE}`;
}

// ---- my garage --------------------------------------------------------------
function renderOwned() {
  document.querySelectorAll<HTMLElement>('[data-garage]').forEach((b) => {
    const on = owned.has(b.dataset.garage!);
    b.setAttribute('aria-pressed', String(on));
    b.title = on ? 'In My Garage · click to remove' : 'Mark as owned · Adds the car to My Garage';
  });
  paintOwnCounts();
  if (driverId) {
    // count only the cars on this page (class / manufacturer pages show "3 / 29")
    const here = cards.filter((c) => owned.has(c.dataset.id!)).length;
    $('gt-owned').textContent = String(here);
    ($('gt-bar') as HTMLElement).style.width = `${(here / N) * 100}%`;
    const tile = $('garage-tile');
    if (tile.dataset.glance != null) { $('gt-cta').textContent = `${here} / ${N}`; $('gt-cta').classList.add('is-count'); }
    else $('gt-cta').textContent = 'Open →';
  }
}
// G2: Owned / Not owned count within the current search + filters (not the whole list)
function paintOwnCounts() {
  if (!driverId) return;
  let o = 0, n = 0;
  for (const c of cards) {
    if (fails(c, state).some((k) => k !== 'own')) continue;
    owned.has(c.dataset.id!) ? o++ : n++;
  }
  $('own-n').textContent = String(o);
  $('notown-n').textContent = String(n);
}
async function loadOwned() {
  driverId = await currentDriverId();
  if (!driverId) return;
  owned = await fetchOwned();
  $('own-seg').hidden = false;
  renderOwned();
  if (state.own) render();
}
($('garage-tile') as HTMLAnchorElement).addEventListener('click', (e) => {
  if (driverId || !backendConfigured) return;
  e.preventDefault();
  login();
});

// ---- events -----------------------------------------------------------------
document.addEventListener('click', async (e) => {
  const t = e.target as HTMLElement;
  if (!t.closest('#toast') && !t.closest('[data-garage]') && !t.closest('[data-compare]') && !t.closest('#cmp-btn')) hideBubble();
  const cmp = t.closest<HTMLElement>('[data-compare]');
  if (cmp) {
    e.preventDefault();
    const id = cmp.dataset.compare!;
    if (!getSelected().includes(id) && getSelected().length >= MAX_COMPARE) { bubble(cmp, `You can compare up to ${MAX_COMPARE} cars. Remove one first.`); return; }
    toggleSelected(id);
    renderCompare();
    return;
  }
  const gar = t.closest<HTMLButtonElement>('[data-garage]');
  if (gar) {
    e.preventDefault();
    if (!driverId) {
      bubble(gar, backendConfigured ? 'Log in to track the cars you own.<button type="button" class="btn btn-discord btn-sm" data-login>Log in with Discord</button>' : 'Log in to track the cars you own.', 6000);
      return;
    }
    const id = gar.dataset.garage!;
    const next = !owned.has(id);
    gar.disabled = true;
    try {
      await setOwned(driverId, id, next);
      next ? owned.add(id) : owned.delete(id);
      renderOwned();
      if (next) {
        let seen = false;
        try { seen = localStorage.getItem('lr-garage-hint') === '1'; localStorage.setItem('lr-garage-hint', '1'); } catch { /* ignore */ }
        if (!seen) bubble(gar, 'Added to My Garage. Your collection is under <b>My garage</b> in the account menu.', 6000);
      }
      if (state.own) render();
    } catch {
      bubble(gar, 'Could not save that. Please try again.');
    } finally { gar.disabled = false; }
    return;
  }
  if (t.closest('[data-login]')) { login(); return; }
  const drop = t.closest<HTMLElement>('[data-drop]');
  if (drop) { Object.assign(state, without(state, drop.dataset.drop as FilterKey)); render(); return; }
  if (t.closest('[data-clear]')) { Object.assign(state, { q: '', own: '', sets: emptySets(), ranges: emptyRanges() }); render(); return; }
  const dym = t.closest<HTMLElement>('[data-dym]');
  if (dym) { e.preventDefault(); state.q = dym.dataset.dym!; render(); return; }
  const own = t.closest<HTMLElement>('[data-own]');
  if (own) { state.own = own.dataset.own as State['own']; render(); return; }
  const sort = t.closest<HTMLElement>('[data-sort]');
  if (sort && !(sort as HTMLButtonElement).disabled) { state.sort = sort.dataset.sort!; closeMenus(); closeSheet('sort-sheet'); render(); return; }
  const pc = t.closest<HTMLElement>('[data-pick-class]');
  if (pc) { state.sets.class = new Set(pc.dataset.pickClass ? [pc.dataset.pickClass] : []); closeMenus(); render(); return; }
  const pm = t.closest<HTMLElement>('[data-pick-make]');
  if (pm) { state.sets.make = new Set(pm.dataset.pickMake ? [pm.dataset.pickMake] : []); closeMenus(); render(); return; }
  const px = t.closest<HTMLElement>('[data-pick-max]');
  if (px) { state.ranges.price = [null, Number(px.dataset.pickMax)]; closeMenus(); (document.activeElement as HTMLElement)?.blur(); render(); return; }
  const dd = t.closest<HTMLElement>('[data-dd]');
  if (dd) {
    const menu = document.querySelector<HTMLElement>(`[data-menu="${dd.dataset.dd}"]`)!;
    const open = menu.hidden;
    closeMenus();
    menu.hidden = !open;
    dd.setAttribute('aria-expanded', String(open));
    return;
  }
  if (!t.closest('.menu') && !t.closest('#f-max')) closeMenus();
});
function closeMenus() {
  document.querySelectorAll<HTMLElement>('.menu').forEach((m) => { m.hidden = true; });
  document.querySelectorAll('[data-dd]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
}
$('show-more').addEventListener('click', () => { showAll = true; render(); });
$('cmp-btn').addEventListener('click', () => {
  // K1 (Fausto 15.10.): always open the compare page; with nothing picked you add cars there
  location.href = `${import.meta.env.BASE_URL}cars/compare/?cars=${getSelected().map(encodeURIComponent).join(',')}`;
});

let qTimer = 0;
($('f-q') as HTMLInputElement).addEventListener('input', (e) => {
  clearTimeout(qTimer);
  qTimer = window.setTimeout(() => { state.q = (e.target as HTMLInputElement).value.trim(); render(); }, 120);
});

// Max $ in the toolbar (C4/C6): greyed out until prices exist; popover with slider + presets
const maxInput = $('f-max') as HTMLInputElement;
if (!DOMAIN.price.has) {
  maxInput.disabled = true;
  maxInput.placeholder = 'after launch';
  $('ctl-price').classList.add('ctl-off');
  $('ctl-price').title = 'Prices arrive after launch';
} else {
  maxInput.addEventListener('focus', () => { closeMenus(); document.querySelector<HTMLElement>('[data-menu="max"]')!.hidden = false; });
  const applyMax = () => { state.ranges.price = [state.ranges.price[0], parseMoney(maxInput.value)]; render(); };
  maxInput.addEventListener('change', applyMax);
  maxInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { applyMax(); closeMenus(); maxInput.blur(); } });
  const single = document.querySelector<HTMLElement>('[data-range="price"][data-single]');
  let st = 0;
  if (single) wireRange(single, 'price', () => [null, state.ranges.price[1]], (r) => {
    state.ranges.price = [state.ranges.price[0], r[1]];
    maxInput.value = r[1] != null ? fmtMoney(r[1]).replace('$', '') : '';
    clearTimeout(st); st = window.setTimeout(render, 80);
  });
}
// sort options without data (C4)
document.querySelectorAll<HTMLButtonElement>('[data-needs]').forEach((b) => {
  if (DOMAIN[b.dataset.needs as RangeKey].has) return;
  b.disabled = true;
  b.title = 'After launch';
  if (!b.querySelector('span')) b.insertAdjacentHTML('beforeend', '<span>after launch</span>');
});

// ---- detailed search / filter sheet ------------------------------------------
let draft: State = cloneState(state);
const dsp = $('dsp');
const rangeBlocks = [...dsp.querySelectorAll<HTMLElement>('.rng[data-range]')];
rangeBlocks.forEach((el) => {
  const k = el.dataset.range as RangeKey;
  wireRange(el, k, () => draft.ranges[k], (r) => { draft.ranges[k] = r; paintDraft(false); });
});
function paintDraft(paintRanges = true) {
  dsp.querySelectorAll<HTMLButtonElement>('.mc[data-group]').forEach((b) => {
    b.setAttribute('aria-pressed', String(draft.sets[b.dataset.group as Group].has(b.dataset.value!)));
  });
  dsp.querySelectorAll<HTMLElement>('[data-sel]').forEach((em) => {
    const g = em.dataset.sel!;
    if (g === 'price' || g === 'speed' || g === 'lap') { em.textContent = rangeActive(draft.ranges[g]) ? 'set' : ''; return; }
    const n = draft.sets[g as Group].size;
    em.textContent = n ? `${n} selected` : '';
  });
  if (paintRanges) rangeBlocks.forEach((el) => { const k = el.dataset.range as RangeKey; if (DOMAIN[k].has) paintRange(el, k, draft.ranges[k]); });
  // C3: the search text is part of the result -> show it here
  $('dsp-q').hidden = !draft.q;
  $('dsp-qtext').textContent = `“${draft.q}”`;
  const n = countWith(draft);
  $('dsp-show').textContent = `Show ${n} ${n === 1 ? 'car' : 'cars'}`;
  $('dsp-sum').textContent = activeKeys(draft).filter((k) => k !== 'own').map((k) => filterLabel(k, draft)).join(SEP);
}
function openSheet(id: string) {
  hideBubble();
  $('dsp-back').hidden = false;
  $(id).hidden = false;
  document.body.style.overflow = 'hidden';
  $(id).querySelector<HTMLElement>('.dsp-x')?.focus();
}
function closeSheet(id: string) {
  $(id).hidden = true;
  if ($('dsp').hidden && $('sort-sheet').hidden) { $('dsp-back').hidden = true; document.body.style.overflow = ''; }
}
function openDetail() { draft = cloneState(state); paintDraft(); openSheet('dsp'); }
$('open-detail').addEventListener('click', openDetail);
$('open-filters').addEventListener('click', openDetail);
$('open-sort-phone').addEventListener('click', () => openSheet('sort-sheet'));
document.querySelector('[data-close-sort]')!.addEventListener('click', () => closeSheet('sort-sheet'));
$('dsp-close').addEventListener('click', () => closeSheet('dsp'));
$('dsp-back').addEventListener('click', () => { closeSheet('dsp'); closeSheet('sort-sheet'); });
$('dsp-qchip').addEventListener('click', () => { draft.q = ''; paintDraft(); });
dsp.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.mc[data-group]');
  if (!b || b.disabled) return;
  const s = draft.sets[b.dataset.group as Group];
  const v = b.dataset.value!;
  s.has(v) ? s.delete(v) : s.add(v);
  paintDraft();
});
// S4: same as "Clear all" on the page – also clears the search text
$('dsp-reset').addEventListener('click', () => { draft = { ...cloneState(draft), q: '', sets: emptySets(), ranges: emptyRanges() }; paintDraft(); });
$('dsp-show').addEventListener('click', () => { Object.assign(state, cloneState(draft)); closeSheet('dsp'); render(); });
(document.getElementById('dsp-msearch') as HTMLInputElement | null)?.addEventListener('input', (e) => {
  const q = (e.target as HTMLInputElement).value.trim().toLowerCase();
  dsp.querySelectorAll<HTMLElement>('.mlist .mc').forEach((b) => { b.hidden = Boolean(q) && !b.textContent!.toLowerCase().includes(q); });
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  closeMenus();
  hideBubble();
  if (!$('dsp').hidden) closeSheet('dsp');
  if (!$('sort-sheet').hidden) closeSheet('sort-sheet');
});

// ---- start ------------------------------------------------------------------
readUrl();
render();
renderCompare();
onCompareChange(renderCompare); // the compare bar (CompareBar.astro) can remove cars too
loadOwned();
// old /garage/#compare links (via the /garage -> /cars redirect) open the compare page (handoff 15.10.)
if (location.hash === '#compare') location.replace(`${import.meta.env.BASE_URL}cars/compare/`);
