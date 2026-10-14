// Cars page (Redesign Phase 4, DEC-0117): search, filters (toolbar + detailed
// search), chips, sort, "Show more", no-results help, compare (max 4) and
// My Garage. All cards are server-rendered; this only shows/hides/reorders them.
// COPY STATUS: messages are Claude placeholders -> Codex review (DEC-0088).
import { getSelected, toggleSelected } from './compare';
import { currentDriverId, fetchOwned, setOwned } from './owned';
import { backendConfigured, getSupabase } from './supabase-client';
import { releaseById } from '../data/releases';

const PAGE = 24;
const MAX_COMPARE = 4;
const $ = (id: string) => document.getElementById(id)!;
const grid = $('cars-grid');
const cards = [...grid.querySelectorAll<HTMLElement>('.vcard')];
const N = cards.length;

type Group = 'class' | 'make' | 'drive' | 'seats' | 'avail' | 'origin';
type FilterKey = Group | 'q' | 'max' | 'own';
interface State { q: string; max: number | null; own: '' | 'owned' | 'not'; sort: string; sets: Record<Group, Set<string>> }
const emptySets = (): Record<Group, Set<string>> => ({ class: new Set(), make: new Set(), drive: new Set(), seats: new Set(), avail: new Set(), origin: new Set() });
const state: State = { q: '', max: null, own: '', sort: 'class', sets: emptySets() };
let limit = PAGE;
let owned = new Set<string>();
let driverId: string | null = null;

// ---- labels -----------------------------------------------------------------
const makeName = new Map<string, string>();
cards.forEach((c) => makeName.set(c.dataset.make!, c.querySelector('.vc-brand')?.textContent?.trim() ?? c.dataset.make!));
const AVAIL: Record<string, string> = { base: 'Base game', 'pre-order': 'Pre-Order bonus', 'ultimate-edition': 'Ultimate Edition', 'gta-plus': 'GTA+' };
const ORIGIN: Record<string, string> = { new: 'New in GTA VI', returning: 'Returning' };
const fmtMoney = (n: number) => (n >= 1e6 ? `$${+(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${+(n / 1e3).toFixed(1)}k` : `$${n}`);
function valueLabel(g: Group, v: string) {
  if (g === 'make') return makeName.get(v) ?? v;
  if (g === 'seats') return `${v} seats`;
  if (g === 'avail') return AVAIL[v] ?? v;
  if (g === 'origin') return ORIGIN[v] ?? v;
  return v;
}
function filterLabel(k: FilterKey): string {
  if (k === 'q') return `“${state.q}”`;
  if (k === 'max') return `Max ${fmtMoney(state.max!)}`;
  if (k === 'own') return state.own === 'owned' ? 'Owned' : 'Not owned';
  return [...state.sets[k]].map((v) => valueLabel(k, v)).join(' or ');
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
  // Max $ hides cars without a price (DEC-0117)
  if (st.max != null && !(d.price && Number(d.price) <= st.max)) out.push('max');
  if (st.own === 'owned' && !owned.has(d.id!)) out.push('own');
  if (st.own === 'not' && owned.has(d.id!)) out.push('own');
  return out;
}
const activeKeys = (st: State): FilterKey[] => [
  ...(st.q ? ['q' as const] : []),
  ...(Object.keys(st.sets) as Group[]).filter((g) => st.sets[g].size),
  ...(st.max != null ? ['max' as const] : []),
  ...(st.own ? ['own' as const] : []),
];
const countWith = (st: State) => cards.filter((c) => !fails(c, st).length).length;
const cloneState = (st: State): State => ({ ...st, sets: Object.fromEntries((Object.keys(st.sets) as Group[]).map((g) => [g, new Set(st.sets[g])])) as Record<Group, Set<string>> });
function without(st: State, k: FilterKey): State {
  const n = cloneState(st);
  if (k === 'q') n.q = '';
  else if (k === 'max') n.max = null;
  else if (k === 'own') n.own = '';
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
  const w = q.toLowerCase();
  let best: { c: HTMLElement; s: number } | null = null;
  for (const c of cards) {
    const words = c.dataset.name!.split(/\s+/);
    const s = Math.min(lev(w, c.dataset.name!), ...words.map((x) => lev(w, x)), ...words.map((x) => lev(w, x.slice(0, w.length))));
    if (!best || s < best.s) best = { c, s };
  }
  return best && best.s <= Math.max(2, Math.floor(w.length / 3)) ? best.c : null;
}

// ---- render -----------------------------------------------------------------
const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));
function render() {
  const keys = activeKeys(state);
  const matches = cards.filter((c) => !fails(c, state).length).sort(sortKey);
  const rest = cards.filter((c) => !matches.includes(c));
  [...matches, ...rest].forEach((c) => grid.appendChild(c));
  matches.forEach((c, i) => c.classList.toggle('is-hidden', i >= limit));
  rest.forEach((c) => c.classList.add('is-hidden'));
  grid.classList.toggle('one-class', state.sets.class.size === 1);
  ($('show-more') as HTMLButtonElement).hidden = matches.length <= limit;
  $('show-more').textContent = `Show more (${matches.length - limit})`;

  // chips / count
  const chips = $('chips');
  if (!keys.length) chips.innerHTML = `<span class="muted">Showing ${matches.length} cars</span>`;
  else chips.innerHTML = `<span class="muted">${matches.length} ${matches.length === 1 ? 'car' : 'cars'}</span>`
    + keys.map((k) => `<button type="button" class="fchip" data-drop="${k}" aria-label="Remove filter ${esc(filterLabel(k))}">${esc(filterLabel(k))}<b aria-hidden="true">×</b></button>`).join('')
    + `<button type="button" class="clear-all" data-clear>Clear all</button>`;

  // toolbar labels
  const one = (g: Group, all: string) => (state.sets[g].size === 0 ? all : state.sets[g].size === 1 ? valueLabel(g, [...state.sets[g]][0]) : `${state.sets[g].size} selected`);
  document.querySelector('[data-dd-label="class"]')!.textContent = one('class', 'All');
  document.querySelector('[data-dd-label="make"]')!.textContent = one('make', 'All');
  document.querySelectorAll<HTMLElement>('[data-pick-class]').forEach((b) => b.classList.toggle('on', b.dataset.pickClass ? state.sets.class.has(b.dataset.pickClass) : !state.sets.class.size));
  document.querySelectorAll<HTMLElement>('[data-pick-make]').forEach((b) => b.classList.toggle('on', b.dataset.pickMake ? state.sets.make.has(b.dataset.pickMake) : !state.sets.make.size));
  document.querySelectorAll<HTMLElement>('[data-sort]').forEach((b) => b.classList.toggle('on', b.dataset.sort === state.sort));
  document.querySelectorAll('[data-sort-label]').forEach((el) => { el.textContent = SORT_LABEL[state.sort]; });
  const maxInput = $('f-max') as HTMLInputElement;
  if (document.activeElement !== maxInput) maxInput.value = state.max != null ? fmtMoney(state.max).replace('$', '') : '';
  const qInput = $('f-q') as HTMLInputElement;
  if (document.activeElement !== qInput) qInput.value = state.q;
  const pro = (['drive', 'seats', 'avail', 'origin'] as Group[]).reduce((n, g) => n + state.sets[g].size, 0);
  $('detail-count').hidden = !pro; $('detail-count').textContent = String(pro);
  const allF = keys.filter((k) => k !== 'q' && k !== 'own').length;
  $('filter-count').hidden = !allF; $('filter-count').textContent = String(allF);
  document.querySelectorAll<HTMLElement>('[data-own]').forEach((b) => b.classList.toggle('on', b.dataset.own === state.own));

  // no results
  const empty = $('empty');
  empty.hidden = matches.length > 0;
  if (!matches.length) {
    $('empty-drops').innerHTML = keys.map((k) => {
      const n = countWith(without(state, k));
      return n ? `<button type="button" class="btn btn-s btn-sm" data-drop="${k}">Without ${esc(filterLabel(k))} → ${n} ${n === 1 ? 'car' : 'cars'}</button>` : '';
    }).join('');
    const dym = state.q ? didYouMean(state.q) : null;
    $('empty-dym').innerHTML = state.q
      ? `No car named <b>“${esc(state.q)}”</b>.${dym ? ` Did you mean <a href="#" data-dym="${esc(dym.dataset.name!)}">${esc(dym.querySelector('.vc-brand')!.textContent!.trim())} ${esc(dym.querySelector('.vc-name')!.textContent!.trim())}</a>?` : ''}`
      : 'Try removing a filter.';
    const near = cards.map((c) => ({ c, f: fails(c, state) })).filter((x) => x.f.length === 1 && x.f[0] !== 'q').sort((a, b) => sortKey(a.c, b.c)).slice(0, 4);
    $('closest-wrap').hidden = !near.length;
    $('closest').innerHTML = '';
    near.forEach(({ c, f }) => {
      const cl = c.cloneNode(true) as HTMLElement;
      cl.classList.remove('is-hidden');
      cl.removeAttribute('id');
      cl.querySelector('.vc-name')?.insertAdjacentHTML('afterend', `<span class="miss">Not ${esc(filterLabel(f[0]))}</span>`);
      $('closest').appendChild(cl);
    });
  }
  syncUrl();
}

// ---- URL --------------------------------------------------------------------
function syncUrl() {
  const p = new URLSearchParams();
  if (state.q) p.set('q', state.q);
  if (state.sets.class.size) p.set('class', [...state.sets.class].join(','));
  if (state.sets.make.size) p.set('make', [...state.sets.make].join(','));
  if (state.max != null) p.set('max', String(state.max));
  if (state.sort !== 'class') p.set('sort', state.sort);
  const qs = p.toString();
  history.replaceState(null, '', location.pathname + (qs ? `?${qs}` : '') + location.hash);
}
function readUrl() {
  const p = new URLSearchParams(location.search);
  state.q = p.get('q') ?? '';
  p.get('class')?.split(',').filter(Boolean).forEach((c) => state.sets.class.add(c));
  p.get('make')?.split(',').filter(Boolean).forEach((m) => state.sets.make.add(m));
  const m = p.get('max'); if (m) state.max = parseMoney(m);
  const s = p.get('sort'); if (s && SORT_LABEL[s]) state.sort = s;
}

// ---- toast ------------------------------------------------------------------
let toastTimer = 0;
function toast(html: string, ms = 4200) {
  const t = $('toast');
  t.innerHTML = html;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { t.hidden = true; }, ms);
}
const login = () => getSupabase().auth.signInWithOAuth({ provider: 'discord', options: { redirectTo: location.origin + location.pathname + location.search, scopes: 'identify email guilds.join' } });

// ---- compare ----------------------------------------------------------------
function renderCompare() {
  const sel = getSelected();
  document.querySelectorAll<HTMLElement>('[data-compare]').forEach((b) => b.setAttribute('aria-pressed', String(sel.includes(b.dataset.compare!))));
  const btn = $('cmp-btn');
  btn.classList.toggle('on', sel.length > 0);
  $('cmp-n').textContent = sel.length ? String(sel.length) : `0 / ${MAX_COMPARE}`;
  $('cmpbar').hidden = sel.length === 0;
  $('cmpbar-n').textContent = String(sel.length);
  $('cmpbar-cars').innerHTML = sel.map((id) => {
    const c = cards.find((x) => x.dataset.id === id);
    if (!c) return '';
    const img = c.querySelector<HTMLImageElement>('.vc-img img')?.getAttribute('src') ?? '';
    const name = `${c.querySelector('.vc-brand')?.textContent?.trim()} ${c.querySelector('.vc-name')?.textContent?.trim()}`;
    return `<span class="cb"><img src="${esc(img)}" alt="" width="64" height="40" /><span>${esc(name)}</span><button type="button" data-uncompare="${esc(id)}" aria-label="Remove ${esc(name)} from compare">×</button></span>`;
  }).join('');
}

// ---- my garage --------------------------------------------------------------
function renderOwned() {
  document.querySelectorAll<HTMLElement>('[data-garage]').forEach((b) => {
    const on = owned.has(b.dataset.garage!);
    b.setAttribute('aria-pressed', String(on));
    b.title = on ? 'In My Garage · click to remove' : 'Mark as owned · Adds the car to My Garage';
  });
  $('own-n').textContent = String(owned.size);
  $('notown-n').textContent = String(N - owned.size);
  if (driverId) {
    $('gt-owned').textContent = String(owned.size);
    ($('gt-bar') as HTMLElement).style.width = `${(owned.size / N) * 100}%`;
    $('gt-cta').textContent = 'Open →';
  }
}
async function loadOwned() {
  driverId = await currentDriverId();
  if (!driverId) return;
  owned = await fetchOwned();
  $('own-seg').hidden = false;
  renderOwned();
  if (state.own) render();
}
const garageTile = $('garage-tile') as HTMLAnchorElement;
garageTile.addEventListener('click', (e) => {
  if (driverId || !backendConfigured) return;
  e.preventDefault();
  login();
});

// ---- events -----------------------------------------------------------------
document.addEventListener('click', async (e) => {
  const t = e.target as HTMLElement;
  const cmp = t.closest<HTMLElement>('[data-compare]');
  if (cmp) {
    e.preventDefault();
    const id = cmp.dataset.compare!;
    if (!getSelected().includes(id) && getSelected().length >= MAX_COMPARE) { toast(`You can compare up to ${MAX_COMPARE} cars. Remove one first.`); return; }
    toggleSelected(id);
    renderCompare();
    return;
  }
  const unc = t.closest<HTMLElement>('[data-uncompare]');
  if (unc) { toggleSelected(unc.dataset.uncompare!); renderCompare(); return; }
  const gar = t.closest<HTMLButtonElement>('[data-garage]');
  if (gar) {
    e.preventDefault();
    if (!driverId) {
      toast(backendConfigured ? 'Log in to track the cars you own. <button type="button" class="btn btn-p btn-sm" data-login>Log in with Discord</button>' : 'Log in to track the cars you own.');
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
        if (!seen) toast('Added to My Garage. Your collection is under <b>My garage</b> in the account menu.', 6000);
      }
      if (state.own) render();
    } catch {
      toast('Could not save that. Please try again.');
    } finally { gar.disabled = false; }
    return;
  }
  if (t.closest('[data-login]')) { login(); return; }
  const drop = t.closest<HTMLElement>('[data-drop]');
  if (drop) { Object.assign(state, without(state, drop.dataset.drop as FilterKey)); limit = PAGE; render(); return; }
  if (t.closest('[data-clear]')) { Object.assign(state, { q: '', max: null, own: '', sets: emptySets() }); limit = PAGE; render(); return; }
  const dym = t.closest<HTMLElement>('[data-dym]');
  if (dym) { e.preventDefault(); state.q = dym.dataset.dym!; render(); return; }
  const own = t.closest<HTMLElement>('[data-own]');
  if (own) { state.own = own.dataset.own as State['own']; limit = PAGE; render(); return; }
  const sort = t.closest<HTMLElement>('[data-sort]');
  if (sort && !(sort as HTMLButtonElement).disabled) { state.sort = sort.dataset.sort!; closeMenus(); closeSheet('sort-sheet'); render(); return; }
  const pc = t.closest<HTMLElement>('[data-pick-class]');
  if (pc) { state.sets.class = new Set(pc.dataset.pickClass ? [pc.dataset.pickClass] : []); closeMenus(); limit = PAGE; render(); return; }
  const pm = t.closest<HTMLElement>('[data-pick-make]');
  if (pm) { state.sets.make = new Set(pm.dataset.pickMake ? [pm.dataset.pickMake] : []); closeMenus(); limit = PAGE; render(); return; }
  const px = t.closest<HTMLElement>('[data-pick-max]');
  if (px) { state.max = Number(px.dataset.pickMax); closeMenus(); (document.activeElement as HTMLElement)?.blur(); limit = PAGE; render(); return; }
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
$('show-more').addEventListener('click', () => { limit += PAGE; render(); });
$('cmp-btn').addEventListener('click', () => {
  if (!getSelected().length) toast(`Pick up to ${MAX_COMPARE} cars with + on the cards.`);
  else $('cmpbar').scrollIntoView({ block: 'end', behavior: 'smooth' });
});
$('cmpbar-clear').addEventListener('click', () => { getSelected().forEach((id) => toggleSelected(id)); renderCompare(); });

let qTimer = 0;
($('f-q') as HTMLInputElement).addEventListener('input', (e) => {
  clearTimeout(qTimer);
  qTimer = window.setTimeout(() => { state.q = (e.target as HTMLInputElement).value.trim(); limit = PAGE; render(); }, 120);
});
const maxInput = $('f-max') as HTMLInputElement;
maxInput.addEventListener('focus', () => { closeMenus(); document.querySelector<HTMLElement>('[data-menu="max"]')!.hidden = false; });
const applyMax = () => { state.max = parseMoney(maxInput.value); limit = PAGE; render(); };
maxInput.addEventListener('change', applyMax);
maxInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { applyMax(); closeMenus(); maxInput.blur(); } });

// ---- detailed search / filter sheet ------------------------------------------
let draft: State = cloneState(state);
const dsp = $('dsp');
function paintDraft() {
  dsp.querySelectorAll<HTMLButtonElement>('.mc[data-group]').forEach((b) => {
    const g = b.dataset.group!;
    const on = g === 'max' ? draft.max === Number(b.dataset.value) : draft.sets[g as Group].has(b.dataset.value!);
    b.setAttribute('aria-pressed', String(on));
  });
  dsp.querySelectorAll<HTMLElement>('[data-sel]').forEach((em) => {
    const g = em.dataset.sel!;
    const n = g === 'max' ? (draft.max != null ? 1 : 0) : draft.sets[g as Group].size;
    em.textContent = n ? `${n} selected` : '';
  });
  const n = countWith(draft);
  $('dsp-show').textContent = `Show ${n} ${n === 1 ? 'car' : 'cars'}`;
  const parts = activeKeys(draft).filter((k) => k !== 'q' && k !== 'own').map((k) => (k === 'max' ? `Max ${fmtMoney(draft.max!)}` : [...draft.sets[k as Group]].map((v) => valueLabel(k as Group, v)).join(', ')));
  $('dsp-sum').textContent = parts.join(' · ');
}
function openSheet(id: string) {
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
dsp.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.mc[data-group]');
  if (!b || b.disabled) return;
  const g = b.dataset.group!;
  const v = b.dataset.value!;
  if (g === 'max') draft.max = draft.max === Number(v) ? null : Number(v);
  else { const s = draft.sets[g as Group]; s.has(v) ? s.delete(v) : s.add(v); }
  paintDraft();
});
$('dsp-reset').addEventListener('click', () => { draft = { ...cloneState(draft), max: null, sets: emptySets() }; paintDraft(); });
$('dsp-show').addEventListener('click', () => { Object.assign(state, cloneState(draft)); limit = PAGE; closeSheet('dsp'); render(); });
($('dsp-msearch') as HTMLInputElement).addEventListener('input', (e) => {
  const q = (e.target as HTMLInputElement).value.trim().toLowerCase();
  dsp.querySelectorAll<HTMLElement>('.mlist .mc').forEach((b) => { b.hidden = Boolean(q) && !b.textContent!.toLowerCase().includes(q); });
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  closeMenus();
  if (!$('dsp').hidden) closeSheet('dsp');
  if (!$('sort-sheet').hidden) closeSheet('sort-sheet');
});

// ---- start ------------------------------------------------------------------
readUrl();
render();
renderCompare();
loadOwned();
if (location.hash === '#compare') $('cmp-btn').scrollIntoView({ block: 'center' });
