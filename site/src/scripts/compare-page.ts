// Compare page in the browser (/cars/compare/, DEC-0128). Renders everything from the
// selection: ?cars=a,b,c wins over the stored list (shared links), the page keeps both in
// sync. Live data (community laps, own laps, garage, ratings) fills in when available.
// COPY STATUS: all texts are Claude placeholders from the mockup -> Codex (DEC-0088).
import { backendConfigured, getSupabase } from './supabase-client';
import { currentDriverId, fetchOwned, setOwned } from './owned';
import { getSelected, setSelectedList } from './compare';
import { bubble, hideBubble } from './bubble';
import { LEADERBOARD_PLATFORM } from '../data/platforms';
import { lapTime } from '../data/leaderboard';
import { COMPARE_MAX, verdict, alternatives, limited, limitedNote, money, moneyShort, secs, ALT_MAX_SLOWER_MS, ALT_MIN_CHEAPER, VALUE_MAX_SLOWER_MS, VALUE_MIN_CHEAPER, type CmpCar } from '../data/compare';

const base = import.meta.env.BASE_URL;
const TRACK = 'gellhorn-international-raceway';
const RATINGS_OPEN_AT = Date.parse('2026-11-18T10:00:00Z'); // mirrors public.ratings_open()
const root = document.getElementById('cp');
const dataEl = document.getElementById('cp-data');
if (root && dataEl) init(root, JSON.parse(dataEl.textContent || '[]') as CmpCar[]);

function init(root: HTMLElement, ALL: CmpCar[]) {
  const $ = (id: string) => document.getElementById(id)!;
  const byId = new Map(ALL.map((c) => [c.id, c]));
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
  const img = (c: CmpCar, w = 640) => `${base}images/vehicles/${c.id}-${w}.webp`;
  const logo = (c: CmpCar) => `${base}images/logos/${c.logo}-gta-6-logo.svg`;
  const ph = `${base}images/garage/garage-hero-placeholder-640.webp`;
  const vhref = (c: CmpCar) => `${base}cars/vehicles/${c.id}/`;
  const classSlug = (n: string) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  // ---- selection ----------------------------------------------------------------
  const fromUrl = new URLSearchParams(location.search).get('cars');
  let ids = (fromUrl ? fromUrl.split(',') : getSelected()).map((s) => s.trim()).filter((id) => byId.has(id));
  ids = [...new Set(ids)].slice(0, COMPARE_MAX);
  let hideSame = false;
  let showHidden = false;
  let slotOpen = false;
  const cars = () => ids.map((id) => byId.get(id)!);
  function save() {
    setSelectedList(ids);
    // readable links: commas stay commas (ids are [a-z0-9-] only)
    history.replaceState(null, '', location.pathname + (ids.length ? `?cars=${ids.join(',')}` : ''));
  }
  function add(id: string, anchor?: HTMLElement) {
    if (ids.includes(id)) return;
    if (ids.length >= COMPARE_MAX) { if (anchor) bubble(anchor, `You can compare up to ${COMPARE_MAX} cars. Remove one first.`); return; }
    ids.push(id); slotOpen = false; save(); render();
  }
  function remove(id: string) { ids = ids.filter((x) => x !== id); save(); render(); }

  // ---- live data ----------------------------------------------------------------
  let me: string | null = null;
  let owned = new Set<string>();
  const community = new Map<string, number>(); // best lap per car (any driver)
  const mine = new Map<string, { ms: number; rank: number }>();
  const owners = new Map<string, number>();
  const ratings = new Map<string, { avg: number; count: number }>();

  // ---- strip ----------------------------------------------------------------------
  const houseIco = '<svg class="g1" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21V9l9-6 9 6v12"/><path d="M7 21v-8h10v8M7 17h10"/></svg><svg class="g2" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21V9l9-6 9 6v12"/><path d="M8.5 14.5l2.5 2.5 4.5-5"/></svg>';
  function tile(c: CmpCar): string {
    const pic = c.photo
      ? `<img src="${img(c)}" alt="" width="640" height="360" loading="lazy" />`
      : `<img class="ct-ph-bg" src="${ph}" alt="" width="640" height="360" loading="lazy" /><img class="ct-ph-logo" src="${logo(c)}" alt="" width="56" height="56" loading="lazy" />`;
    const o = owned.has(c.id);
    return `<article class="ct" data-car="${c.id}">
  <a class="ct-img" href="${vhref(c)}" tabindex="-1" aria-hidden="true">${pic}</a>
  ${o ? '<span class="ct-own">✓ In your garage</span>' : ''}
  <button type="button" class="ct-x" data-remove="${c.id}" aria-label="Remove ${esc(c.make)} ${esc(c.model)}">×</button>
  <div class="ct-b">
    <span class="ct-make">${esc(c.make)}</span>
    <a class="ct-name" href="${vhref(c)}">${esc(c.model)}</a>
    <span class="ct-cls">${esc(c.cls)}</span>
    <div class="ct-foot"><a class="ct-view" href="${vhref(c)}">View car →</a>
      <button type="button" class="ct-gar" data-gar="${c.id}" aria-pressed="${o}" title="${o ? 'In My Garage · click to remove' : 'Mark as owned · Adds the car to My Garage'}" aria-label="My Garage">${houseIco}</button></div>
  </div>
</article>`;
  }
  function suggestions(): { label: string; list: CmpCar[] } {
    const list = cars();
    const alts = alternatives(list, ALL).map((a) => a.car);
    if (alts.length) return { label: 'Cheaper alternatives', list: alts };
    const cls = list[0]?.cls ?? null;
    const pool = ALL.filter((c) => c.release && !ids.includes(c.id) && (!cls || c.classes.includes(cls)))
      .sort((a, b) => Number(b.photo) - Number(a.photo) || a.model.localeCompare(b.model));
    return { label: cls ? `Popular in ${cls}` : 'Popular cars', list: pool.slice(0, 3) };
  }
  function slot(): string {
    const s = suggestions();
    return `<div class="ct ct-slot${slotOpen ? ' is-open' : ''}" id="ct-slot">
  <button type="button" class="ct-slot-top" data-open-search><span class="ct-slot-plus" aria-hidden="true">+</span>Add a car</button>
  <div class="ct-search"><input type="search" id="ct-q" placeholder="Search cars" aria-label="Search a car to add" autocomplete="off" /><ul class="ct-res" id="ct-res" hidden></ul></div>
  ${s.list.length ? `<div class="ct-sugg"><p>${esc(s.label)}</p><div class="ct-chips">${s.list.map((c) => `<button type="button" class="ct-chip" data-add="${c.id}">+ ${esc(c.model)}</button>`).join('')}</div></div>` : ''}
</div>`;
  }
  function renderStrip() {
    const list = cars();
    const strip = $('cp-strip');
    strip.querySelectorAll('.ct, .ct-empty').forEach((n) => n.remove());
    let html = list.map(tile).join('');
    if (list.length < COMPARE_MAX) html += slot();
    if (!list.length) html += '<p class="ct-empty">Pick cars with + on the Cars page, or search one here.</p>';
    strip.insertAdjacentHTML('beforeend', html);
    $('cp-count').textContent = `Comparing ${list.length} of ${COMPARE_MAX}`;
    const classes = new Set(list.map((c) => c.cls));
    $('cp-cls').innerHTML = list.length < 2 ? '' : classes.size === 1
      ? `<span class="cp-chip">✓ All ${esc(list[0].cls)}</span>`
      : '<span class="cp-diff">Different classes – they don\'t race each other on the leaderboard</span>';
    root.style.setProperty('--n', String(Math.max(1, list.length)));
    ($('cp-add-m') as HTMLElement).hidden = list.length >= COMPARE_MAX;
    ($('cp-clear') as HTMLElement).hidden = !list.length;
    (document.querySelector('.cp-tgl') as HTMLElement).hidden = list.length < 2;
    // compact bar
    $('cp-mini-row').innerHTML = `<span class="cm-l">${list.length} of ${COMPARE_MAX}</span>` + list.map((c) => `<span class="cm">${c.photo ? `<img src="${img(c)}" alt="" />` : '<i class="cm-ph"></i>'}<span>${esc(c.model)}</span></span>`).join('');
    wireSearch();
  }
  function wireSearch() {
    const q = document.getElementById('ct-q') as HTMLInputElement | null;
    const res = document.getElementById('ct-res');
    if (!q || !res) return;
    const showList = () => {
      const t = q.value.trim().toLowerCase();
      if (!t) {
        // empty field: offer cars right away (same class first), no typing needed (K2, Fausto 15.10.)
        const cls = cars()[0]?.cls ?? null;
        const pool = ALL.filter((c) => !ids.includes(c.id) && c.release)
          .sort((a, b) => Number(cls != null && b.classes.includes(cls)) - Number(cls != null && a.classes.includes(cls)) || Number(b.photo) - Number(a.photo) || a.model.localeCompare(b.model)).slice(0, 8);
        res.innerHTML = pool.map((c) => `<li><button type="button" data-add="${c.id}">${esc(c.make)} ${esc(c.model)} <small>${esc(c.cls)}</small></button></li>`).join('') + '<li class="ct-res-more"><small>Type to search all cars</small></li>';
        res.hidden = false;
        return;
      }
      const words = t.split(/\s+/);
      const hits = ALL.filter((c) => !ids.includes(c.id) && words.every((w) => `${c.make} ${c.model} ${c.cls}`.toLowerCase().includes(w))).slice(0, 8);
      res.innerHTML = hits.length ? hits.map((c) => `<li><button type="button" data-add="${c.id}">${esc(c.make)} ${esc(c.model)} <small>${esc(c.cls)}</small></button></li>`).join('') : '<li><button type="button" disabled>No car found</button></li>';
      res.hidden = false;
    };
    q.addEventListener('input', showList);
    q.addEventListener('focus', showList);
    q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const b = res.querySelector<HTMLElement>('[data-add]'); if (b) { e.preventDefault(); add(b.dataset.add!, q); } } });
  }

  // ---- our take -----------------------------------------------------------------------
  function renderTake() {
    const list = cars();
    const box = $('cp-take');
    if (list.length < 2) { box.innerHTML = ''; return; }
    const v = verdict(list);
    const rules = `<div class="tk-rules" id="tk-rules" hidden><b>How we judge</b><ul>
<li>Only our stock Gellhorn reference lap and the in-game price count. Community laps depend on the driver, so they never decide.</li>
<li>Best value: a car that is at most ${(VALUE_MAX_SLOWER_MS / 1000).toFixed(1)} s slower than the fastest pick and at least ${Math.round(VALUE_MIN_CHEAPER * 100)} % cheaper. Faster and cheaper at once is a clear pick.</li>
<li>Edition, bonus and GTA+ cars count like any other car. We only mark that they can't be bought later.</li>
<li>Top speed is its own category and doesn't decide the value.</li></ul></div>`;
    if (!v) {
      const miss = list.map((c) => {
        const m = [c.price == null ? 'price' : '', c.ref == null ? 'reference lap' : ''].filter(Boolean);
        return `<span>${esc(c.model)}: ${m.length ? m.map((x) => `<em>${x}</em>`).join(' · ') : 'ready'}</span>`;
      }).join('');
      box.innerHTML = `<p class="cp-eb">Our take</p><div class="lock"><div class="lock-m"><h3>Our verdict unlocks after launch</h3><p>We pick the best value, the fastest and the top-speed king as soon as the in-game price and our Gellhorn reference lap are known for at least two of these cars.</p><div class="lock-miss">${miss}</div></div><button type="button" class="btn btn-s" data-how>How we judge</button></div>${rules}`;
      return;
    }
    const card = (eb: string, x: { car: CmpCar; text: string } | null, link: [string, string], best = false) => x
      ? `<div class="tk-c${best ? ' is-best' : ''}"><span class="tk-eb">${best ? '★ ' : ''}${eb}</span><p class="tk-n">${esc(x.car.make)} ${esc(x.car.model)}</p><p class="tk-t">${esc(x.text)}</p><a class="tk-a" href="${link[1]}">${link[0]} →</a></div>`
      : `<div class="tk-c"><span class="tk-eb">${eb}</span><p class="tk-t">${eb === 'Best value' ? esc(v.valueNote ?? 'Not enough data yet.') : 'Not enough data yet.'}</p></div>`;
    const sp = v.speed?.car;
    box.innerHTML = `<p class="cp-eb">Our take</p><div class="tk">
${card('Best value', v.value, ['Cheapest cars ranking', `${base}cars/rankings/cheapest/`], Boolean(v.value))}
${card('Fastest at Gellhorn', v.fastest, ['Gellhorn leaderboard', `${base}time-attack/gellhorn-international-raceway/`])}
${card('Top speed', v.speed, [sp ? `Fastest ${sp.cls} ranking` : 'Fastest cars ranking', sp ? `${base}cars/rankings/fastest/${classSlug(sp.cls)}/` : `${base}cars/rankings/fastest/`])}
</div><div class="tk-foot"><span>Based on our stock Gellhorn reference lap and the in-game price.${new Set(list.map((c) => c.cls)).size > 1 ? ' Different classes – they don\'t race each other on the leaderboard.' : ''}</span><button type="button" class="tk-how" data-how>How we judge →</button></div>${rules}`;
  }

  // ---- table ---------------------------------------------------------------------------
  const tb = (long: string, short: string) => `<span class="tl">${long}</span><span class="ts">${short}</span>`;
  type Cell = { m: string; s?: string; tba?: boolean; mine?: boolean; v?: number | null; raw?: string };
  type Row = { label: string; sub?: string; dir?: 'min' | 'max'; cells: (c: CmpCar) => Cell };
  const star = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l2.6 5.6 6 .7-4.5 4.1 1.2 6-5.3-3-5.3 3 1.2-6L3.4 9.8l6-.7z"/></svg>';
  const stars = (n: number) => `<span class="tv-stars">${[1, 2, 3, 4, 5].map((i) => star.replace('<svg', `<svg class="${i <= Math.round(n) ? 'on' : ''}"`)).join('')}</span>`;
  const acqNote: Record<string, string> = { 'pre-order': 'Pre-order bonus', 'ultimate-edition': 'Ultimate Edition exclusive', 'gta-plus': 'GTA+ members only' };
  const classRank = (c: CmpCar) => {
    const t = community.get(c.id); if (t == null) return null;
    return 1 + ALL.filter((o) => o.classes.includes(c.cls) && (community.get(o.id) ?? Infinity) < t).length;
  };
  function groups(): { h: string; rows: Row[] }[] {
    const list = cars();
    const refs = list.map((c) => c.ref).filter((x): x is number => x != null);
    const minRef = refs.length ? Math.min(...refs) : null;
    const prices = list.map((c) => c.price).filter((x): x is number => x != null);
    const minPrice = prices.length ? Math.min(...prices) : null;
    const cheapest = list.find((c) => c.price === minPrice);
    const open = Date.now() >= RATINGS_OPEN_AT;
    const perf: Row[] = [
      { label: 'Gellhorn reference lap', sub: 'Stock · our test driver', dir: 'min', cells: (c) => c.ref != null
        ? { m: lapTime(c.ref), s: c.ref === minRef ? (refs.length > 1 ? 'Fastest' : '') : `+${secs(c.ref - minRef!)}`, v: c.ref }
        : { m: tb('Measured after launch', 'After launch'), raw: 'mal', tba: true } },
      { label: 'Best community lap', sub: 'Fastest driver in this car', dir: 'min', cells: (c) => {
        const t = community.get(c.id);
        if (t == null) return { m: `<a class="tv-link" href="${base}time-attack/submit/">${tb('Set the first time →', 'Set a time')}</a>`, raw: 'none' };
        const r = classRank(c);
        return { m: lapTime(t), s: r ? `#${r} in ${c.cls}` : '', v: t };
      } },
      ...(me ? [{ label: 'Your best lap', cells: (c: CmpCar): Cell => {
        const x = mine.get(c.id);
        return x ? { m: lapTime(x.ms), s: `#${x.rank} in this car`, mine: true } : { m: `<a class="tv-link" href="${base}time-attack/submit/">Set a time →</a>`, raw: 'none' };
      } } as Row] : []),
      { label: 'Top speed', sub: 'Stock', dir: 'max', cells: (c) => c.speed != null ? { m: `${Math.round(c.speed)} mph`, v: c.speed } : { m: tb('Measured after launch', 'After launch'), raw: 'mal', tba: true } },
    ];
    const price: Row[] = [
      { label: 'Price', dir: 'min', cells: (c) => c.price != null
        ? { m: money(c.price), s: [c.price === minPrice ? (prices.length > 1 ? 'Cheapest' : '') : cheapest ? `+${moneyShort(c.price - minPrice!)} vs ${cheapest.model}` : '', limited(c) ? "Can't be bought later" : ''].filter(Boolean).join('\u2002·\u2002'), v: c.price }
        : { m: tb('Not announced yet', 'Not announced'), raw: 'na', tba: true } },
      { label: 'Sell value', sub: 'Base price, no upgrades', dir: 'max', cells: (c) => c.sellable === 'no' ? { m: "Can't be sold" }
        : c.sell != null ? { m: money(c.sell), v: c.sell } : { m: 'After launch', tba: true } },
    ];
    const car: Row[] = [
      { label: 'Class', cells: (c) => ({ m: esc(c.classes.join(' / ')) }) },
      { label: 'Drive', cells: (c) => ({ m: esc(c.drive) }) },
      { label: 'Seats', cells: (c) => ({ m: String(c.seats) }) },
      { label: 'Where to get', cells: (c) => c.acq ? { m: acqNote[c.acq] ?? esc(c.acq), s: "Can't be bought later" } : { m: 'After launch', tba: true } },
      { label: 'Based on', cells: (c) => c.based ? { m: esc(c.based) } : { m: 'Under review', tba: true } },
    ];
    const comm: Row[] = [
      { label: 'Driver rating', dir: 'max', cells: (c) => {
        const r = ratings.get(c.id);
        if (r && r.count >= 3) return { m: stars(r.avg), s: `${r.avg.toFixed(1)} · ${r.count} ratings`, v: r.avg };
        return { m: open ? tb('Not enough ratings yet', 'Too few yet') : tb('Ratings open Nov 19', 'Opens Nov 19'), raw: 'r', tba: true };
      } },
      { label: 'In garages', cells: (c) => {
        const n = owners.get(c.id) ?? 0;
        return n ? { m: `${n} ${n === 1 ? 'driver' : 'drivers'}` } : { m: `<a class="tv-quiet" href="${vhref(c)}">${tb('Be the first →', 'Be the first')}</a>`, raw: 'none' };
      } },
    ];
    return [{ h: 'Performance', rows: perf }, { h: 'Price', rows: price }, { h: 'The car', rows: car }, { h: 'Community', rows: comm }];
  }
  function renderTable() {
    const list = cars();
    const box = $('cp-table');
    if (!list.length) { box.innerHTML = ''; return; }
    const hidden: string[] = [];
    let html = '';
    for (const g of groups()) {
      let rows = '';
      for (const r of g.rows) {
        const cells = list.map((c) => r.cells(c));
        const same = list.length > 1 && cells.every((x) => (x.raw ?? x.m) === (cells[0].raw ?? cells[0].m));
        if (hideSame && same && !showHidden) { hidden.push(r.label); continue; }
        const nums = cells.map((x) => x.v).filter((x): x is number => x != null);
        const bestV = r.dir && nums.length > 1 && new Set(nums).size > 1 ? (r.dir === 'min' ? Math.min(...nums) : Math.max(...nums)) : null;
        const tds = cells.map((x) => {
          const best = bestV != null && x.v === bestV;
          return `<div class="tv${best ? ' is-best' : ''}${x.tba ? ' is-tba' : ''}${x.mine ? ' is-mine' : ''}"><div class="tv-m">${x.m}${best ? '<span class="tv-best">Best</span>' : ''}</div>${x.s != null && (x.s || best) ? `<div class="tv-s">${esc(x.s ?? '')}</div>` : ''}</div>`;
        }).join('');
        const filler = '<div class="tv tv-empty"></div>'.repeat(Math.max(0, COMPARE_MAX - list.length));
        rows += `<div class="cp-grid tr"><div class="tr-l">${r.label}${r.sub ? `<small>${r.sub}</small>` : ''}</div>${tds}${filler}</div>`;
      }
      if (g.h === 'The car' && hidden.length && hideSame) rows += `<div class="tr-hid">${hidden.length} identical ${hidden.length === 1 ? 'row' : 'rows'} hidden: ${esc(hidden.join(', '))} <button type="button" data-show-hidden>Show</button></div>`;
      if (rows) html += `<div class="tg"><p class="tg-h">${g.h}</p>${rows}</div>`;
    }
    if (hideSame && hidden.length && !html.includes('tr-hid')) html += `<div class="tr-hid">${hidden.length} identical rows hidden: ${esc(hidden.join(', '))} <button type="button" data-show-hidden>Show</button></div>`;
    box.innerHTML = html;
  }

  // ---- alternatives + value map ----------------------------------------------------
  function mapSvg(cls: string, list: CmpCar[], alts: CmpCar[]): string {
    const pts = ALL.filter((c) => c.classes.includes(cls) && c.price != null && c.ref != null);
    const W = 520, H = 260, L = 50, R = 12, T = 18, B = 34;
    const lapShort = (ms: number) => `${Math.floor(ms / 60000)}:${((ms % 60000) / 1000).toFixed(1).padStart(4, '0')}`;
    const grid = [0, 1, 2, 3].map((i) => `<line x1="${L}" x2="${W - R}" y1="${T + i * (H - T - B) / 3}" y2="${T + i * (H - T - B) / 3}" stroke="rgba(200,200,222,.12)"/>`).join('')
      + [0, 1, 2, 3, 4].map((i) => `<line y1="${T}" y2="${H - B}" x1="${L + i * (W - L - R) / 4}" x2="${L + i * (W - L - R) / 4}" stroke="rgba(200,200,222,.08)"/>`).join('');
    if (pts.length < 2) {
      return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Value map, fills in after launch">${grid}<text x="${(W + L) / 2}" y="${H / 2 - 4}" text-anchor="middle" fill="#B4B4C2" font-size="15">Fills in after launch</text><text x="${(W + L) / 2}" y="${H / 2 + 16}" text-anchor="middle" fill="#77778A" font-size="12">once prices and Gellhorn reference laps are in</text><text x="${(W + L) / 2}" y="${H - 6}" text-anchor="middle" fill="#77778A" font-size="11">Price →</text></svg>`;
    }
    const px = pts.map((c) => c.price!), py = pts.map((c) => c.ref!);
    const x0 = Math.min(...px), x1 = Math.max(...px), y0 = Math.min(...py), y1 = Math.max(...py);
    const sx = (v: number) => L + ((v - x0) / Math.max(1, x1 - x0)) * (W - L - R);
    const sy = (v: number) => T + ((v - y0) / Math.max(1, y1 - y0)) * (H - T - B); // faster (smaller) = higher
    const chosen = new Set(list.map((c) => c.id)), alt = new Set(alts.map((c) => c.id));
    const dots = pts.sort((a, b) => Number(chosen.has(a.id) || alt.has(a.id)) - Number(chosen.has(b.id) || alt.has(b.id))).map((c) => {
      const x = sx(c.price!), y = sy(c.ref!);
      const right = x > W * 0.68;
      const lab = (fill: string) => `<text x="${right ? x - 9 : x + 9}" y="${y + 4}" text-anchor="${right ? 'end' : 'start'}" fill="${fill}" font-size="12" font-weight="600">${esc(c.model)}</text>`;
      if (chosen.has(c.id)) return `<circle cx="${x}" cy="${y}" r="6" fill="#F24B9D"/>${lab('#FBF7EA')}`;
      if (alt.has(c.id)) return `<circle cx="${x}" cy="${y}" r="5.5" fill="none" stroke="#FF955A" stroke-width="2"/>${lab('#FF955A')}`;
      return `<circle cx="${x}" cy="${y}" r="4" fill="#55556A"><title>${esc(c.make)} ${esc(c.model)}</title></circle>`;
    }).join('');
    const ticksX = [0, 1, 2, 3, 4].map((i) => `<text x="${L + i * (W - L - R) / 4}" y="${H - B + 16}" text-anchor="middle" fill="#77778A" font-size="11">${moneyShort(x0 + i * (x1 - x0) / 4)}</text>`).join('');
    const ticksY = [0, 1, 2, 3].map((i) => `<text x="${L - 6}" y="${T + i * (H - T - B) / 3 + 4}" text-anchor="end" fill="#77778A" font-size="11">${lapShort(y0 + i * (y1 - y0) / 3)}</text>`).join('');
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Value map: price against Gellhorn reference lap">${grid}<text x="${L + 6}" y="${T + 12}" fill="#D9F58E" font-size="11">↖ better value: faster and cheaper</text>${dots}${ticksX}${ticksY}<text x="${(W + L) / 2}" y="${H - 2}" text-anchor="middle" fill="#77778A" font-size="11">Price →</text></svg>`;
  }
  function renderBottom() {
    const list = cars();
    const box = $('cp-bottom');
    if (!list.length) { box.innerHTML = ''; return; }
    const alts = alternatives(list, ALL);
    const f = list.filter((c) => c.ref != null && c.price != null).sort((a, b) => a.ref! - b.ref!)[0];
    const cls = f?.cls ?? list[0].cls;
    const left = alts.length
      ? `<div class="al">${alts.map((a) => `<div class="al-r">${a.car.photo ? `<img class="al-img" src="${img(a.car)}" alt="" loading="lazy" />` : `<span class="al-img al-ph"><img src="${ph}" alt="" loading="lazy" /><img class="al-logo" src="${logo(a.car)}" alt="" loading="lazy" /></span>`}<div class="al-m"><b>${esc(a.car.make)} ${esc(a.car.model)}</b>${limited(a.car) ? `<small class="al-lim">${esc(limitedNote(a.car))}</small>` : ''}<span>${a.slower < 5 ? `As fast as the ${esc(f.model)}` : `${secs(a.slower)} slower than the ${esc(f.model)}`} · <em>${money(a.cheaper)} cheaper</em></span></div><button type="button" class="al-add" data-add="${a.car.id}">+ Compare</button></div>`).join('')}
<p class="al-note">Same class, within ${(ALT_MAX_SLOWER_MS / 1000).toFixed(1)} s of your fastest pick and at least ${Math.round(ALT_MIN_CHEAPER * 100)} % cheaper.</p></div>`
      : f
        ? `<div class="lock"><div class="lock-m"><h3>No cheaper alternative</h3><p>No ${esc(cls)} car is close enough at Gellhorn and clearly cheaper.</p></div></div>`
        : `<div class="lock"><div class="lock-m"><h3>Suggestions unlock with prices and lap times</h3><p>We will suggest ${esc(cls)} cars that are about as fast as your pick but clearly cheaper. Until then, browse the class.</p></div><a class="btn btn-s" href="${base}cars/?class=${encodeURIComponent(cls)}">All ${esc(cls)} cars →</a></div>`;
    box.innerHTML = `<div><p class="cp-eb">Cheaper alternatives</p>${left}</div><div><p class="cp-eb">Value map</p><div class="vmap"><div class="vmap-h"><span>${esc(cls)} cars · price vs. Gellhorn reference lap (stock)</span><span>Higher = faster</span></div>${mapSvg(cls, list, alts.map((a) => a.car))}</div></div>`;
  }

  function render() {
    renderStrip(); renderTake(); renderTable(); renderBottom();
    ($('cp-body') as HTMLElement).hidden = ids.length === 0;
  }

  // ---- events ----------------------------------------------------------------------
  ($('cp-hide') as HTMLInputElement).addEventListener('change', (e) => { hideSame = (e.target as HTMLInputElement).checked; showHidden = false; renderTable(); });
  const clearAll = () => { ids = []; save(); render(); };
  $('cp-clear').addEventListener('click', clearAll);
  $('cp-clear-end').addEventListener('click', clearAll);
  $('cp-add-m').addEventListener('click', () => { slotOpen = !slotOpen; renderStrip(); (document.getElementById('ct-q') as HTMLInputElement | null)?.focus(); });
  $('cp-share').addEventListener('click', async () => {
    const btn = $('cp-share');
    try { await navigator.clipboard.writeText(location.href); bubble(btn, 'Link copied. Anyone with it sees this comparison.'); }
    catch { bubble(btn, `Copy this link:<br><b>${esc(location.href)}</b>`, 8000); }
  });
  document.addEventListener('click', async (e) => {
    const t = e.target as HTMLElement;
    const rm = t.closest<HTMLElement>('[data-remove]');
    if (rm) { remove(rm.dataset.remove!); return; }
    if (t.closest('[data-open-search]')) { (document.getElementById('ct-q') as HTMLInputElement | null)?.focus(); return; }
    const ad = t.closest<HTMLElement>('[data-add]');
    if (ad) { add(ad.dataset.add!, ad); return; }
    if (t.closest('[data-show-hidden]')) { showHidden = true; renderTable(); return; }
    const how = t.closest<HTMLElement>('[data-how]');
    if (how) { const r = document.getElementById('tk-rules'); if (r) r.hidden = !r.hidden; return; }
    const lb = t.closest<HTMLElement>('[data-login]');
    if (lb) { getSupabase().auth.signInWithOAuth({ provider: 'discord', options: { redirectTo: location.href, scopes: 'identify email guilds.join' } }); return; }
    const g = t.closest<HTMLButtonElement>('[data-gar]');
    if (g) {
      e.stopPropagation();
      if (!me) { bubble(g, `Log in to track the cars you own.${backendConfigured ? '<button type="button" class="btn btn-discord btn-sm" data-login>Log in with Discord</button>' : ''}`, 6000); return; }
      const id = g.dataset.gar!, next = !owned.has(id);
      g.disabled = true;
      try { await setOwned(me, id, next); next ? owned.add(id) : owned.delete(id); owners.set(id, Math.max(0, (owners.get(id) ?? 0) + (next ? 1 : -1))); render(); }
      catch { bubble(g, 'Could not save. Please try again.'); g.disabled = false; }
      return;
    }
    if (!t.closest('#ct-slot') && !t.closest('#cp-add-m')) document.getElementById('ct-res')?.setAttribute('hidden', '');
    if (!t.closest('.lr-bubble')) hideBubble();
  });

  // compact strip while the big one is out of view
  const mini = $('cp-mini');
  new IntersectionObserver(([en]) => { mini.hidden = en.isIntersecting || en.boundingClientRect.top > 0 || ids.length === 0; }, { rootMargin: '-80px 0px 0px 0px' }).observe($('cp-strip'));

  save();
  render();
  if (!backendConfigured) return;

  // ---- live ----------------------------------------------------------------------------
  (async () => {
    const sb = getSupabase();
    me = await currentDriverId();
    const ranks = () => sb.from('public_leaderboard_ranks').select('scope_key,rank,driver_id,lap_time_ms').eq('track_id', TRACK).eq('platform', LEADERBOARD_PLATFORM).eq('scope', 'vehicle');
    const [best, own, cnt, rat, ownSet] = await Promise.all([
      ranks().eq('rank', 1),
      me ? ranks().eq('driver_id', me) : Promise.resolve({ data: [] }),
      sb.from('public_vehicle_owner_counts').select('vehicle_id, owner_count'),
      sb.from('public_vehicle_ratings').select('vehicle_id, rating_avg, rating_count'),
      me ? fetchOwned() : Promise.resolve(new Set<string>()),
    ]);
    for (const r of ((best as { data: { scope_key: string; lap_time_ms: number }[] | null }).data ?? [])) community.set(r.scope_key, r.lap_time_ms);
    for (const r of ((own as { data: { scope_key: string; lap_time_ms: number; rank: number }[] | null }).data ?? [])) mine.set(r.scope_key, { ms: r.lap_time_ms, rank: r.rank });
    for (const r of ((cnt as { data: { vehicle_id: string; owner_count: number }[] | null }).data ?? [])) owners.set(r.vehicle_id, Number(r.owner_count));
    for (const r of ((rat as { data: { vehicle_id: string; rating_avg: number; rating_count: number }[] | null }).data ?? [])) ratings.set(r.vehicle_id, { avg: Number(r.rating_avg), count: Number(r.rating_count) });
    owned = ownSet as Set<string>;
    render();
  })().catch(() => { /* keep the static values */ });
}
