// Gellhorn leaderboard: data model, sample data and renderers (2026-09-26).
//
// One renderer for both worlds: the build renders the SAMPLE data (so the page
// looks right without JS), the browser re-renders the same way with either
// the sample data or -- as soon as at least one real run is published -- the
// live rows from public_leaderboard. Filters (Overall / Vehicle Records,
// driver + vehicle search, All times / Verified only) work on both.
//
// SAMPLE DATA IS FICTIONAL. Drivers, times and crew memberships are invented;
// only garage vehicles are used so every vehicle link resolves. Crews are the
// fictional sample crews of The Hub (data/hub.ts). Always shown with the
// visible "Sample data" flag.
import { vehicleOptions } from './vehicles';
import { makeHref, classHref, classSlug } from './garage-taxonomy';
import { taxonomyCopy } from './taxonomy-copy';
import { sampleCrews, esc } from './hub';

export interface LbEntry {
  /** best run of one driver on one vehicle (= one row of public_leaderboard) */
  driver: string;
  driver_id: string;
  crew: { tag: string; color: string } | null;
  vehicle_id: string;
  make: string;
  model: string;
  logo: string | null; // manufacturer logo slug
  lap_time_ms: number;
  entries: number; // published laps of this driver on the track
  verified: boolean;
  video_url: string | null;
}

export type LbMode = 'overall' | 'class' | 'make' | 'car';
export interface LbState {
  /** Segment (DEC-0119 + Fausto 17.10.: Overall / By class / By manufacturer / By car) */
  mode: LbMode;
  /** logged-in driver (driver_id) -> own row highlighted, rows around it shown */
  me: string | null;
  vehicle: string | null; // null = Overall (all vehicles), else one vehicle's board
  /** Class filter (class name as in the data, e.g. "Sports"); null = all classes (Fausto 17.10.) */
  cls: string | null;
  /** Manufacturer filter (logo slug, e.g. "grotti"); null = all manufacturers */
  make: string | null;
  qDriver: string;
  verifiedOnly: boolean;
  showAll: boolean;
}
export const initialState: LbState = { mode: 'overall', me: null, vehicle: null, cls: null, make: null, qDriver: '', verifiedOnly: false, showAll: false };
export const PAGE = 12;

// ---------------------------------------------------------------------------
// Sample data (fictional, deterministic)
// ---------------------------------------------------------------------------
function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Garage vehicle + fictional base pace on Gellhorn (ms)
const SAMPLE_VEHICLES: [string, number][] = [
  ['grotti-furia', 84200], ['pegassi-zorrusso', 84500], ['truffade-thrax', 84900], ['pegassi-tempesta', 85300],
  ['grotti-itali-rsx', 85900], ['pfister-neon', 86500], ['bravado-banshee', 86800], ['invetero-coquette-d10', 87100],
  ['ubermacht-cypher', 87500], ['annis-elegy-retro-custom', 87900], ['obey-8f-drafter', 88200], ['karin-sultan', 88900],
  ['ubermacht-sentinel-xs', 89300], ['grotti-cheetah-95', 89600], ['vapid-dominator-gtx', 90400], ['karin-futo', 91200],
  ['dinka-blista-compact', 93800],
];
const crewBySlug = (slug: string) => {
  const c = sampleCrews.find((x) => x.slug === slug)!;
  return { tag: c.tag, color: c.color };
};
// name, crew slug (or null), skill offset ms
const SAMPLE_DRIVERS: [string, string | null, number][] = [
  ['Racer_01', 'sample-apex-syndicate', 0], ['SpeedyNomad', 'sample-leonida-lap-club', 350], ['CoastalRun', null, 600],
  ['Nightshift', 'sample-midnight-meet', 800], ['LatteBrake', 'sample-nordring-crew', 950], ['ViceRacer', 'sample-apex-syndicate', 1100],
  ['ApexLimit', 'sample-leonida-lap-club', 1250], ['ShadowLine', null, 1400], ['TurnInEarly', 'sample-gulf-coast-racing', 1550],
  ['Hillclimb', 'sample-nordring-crew', 1700], ['SolarFlare', 'sample-vice-drift-union', 1850], ['MintyTires', null, 2000],
  ['KerbHopper', 'sample-apex-syndicate', 2150], ['LateApex', 'sample-leonida-lap-club', 2300], ['RedlineRosa', 'sample-gulf-coast-racing', 2450],
  ['Slipstream_K', null, 2600], ['GhostPedal', 'sample-midnight-meet', 2750], ['TarmacTom', 'sample-nordring-crew', 2900],
  ['NeonDrift', 'sample-vice-drift-union', 3050], ['PitWallPete', null, 3200], ['OceanDriveOG', 'sample-gulf-coast-racing', 3350],
  ['FlatOutFinn', 'sample-nordring-crew', 3500], ['BrakeLate99', null, 3650], ['VelvetClutch', 'sample-vice-drift-union', 3800],
];

function buildSample(): LbEntry[] {
  const r = rng(1601);
  const out: LbEntry[] = [];
  SAMPLE_DRIVERS.forEach(([name, crewSlug, skill], i) => {
    const count = 1 + Math.floor(r() * 4);
    const picked = new Set<number>();
    while (picked.size < count) {
      // bias towards the faster cars, but every car gets drivers
      const idx = Math.floor(Math.pow(r(), 1.4) * SAMPLE_VEHICLES.length);
      picked.add(idx);
    }
    const entries = count + Math.floor(r() * 30);
    for (const idx of picked) {
      const [id, basePace] = SAMPLE_VEHICLES[idx];
      const v = vehicleOptions.find((x) => x.id === id)!;
      out.push({
        driver: name,
        driver_id: `sample-${i}`,
        crew: crewSlug ? crewBySlug(crewSlug) : null,
        vehicle_id: v.id,
        make: v.make,
        model: v.model,
        logo: v.logoSlug,
        lap_time_ms: basePace + skill + Math.floor(r() * 900),
        entries,
        verified: r() < 0.55,
        video_url: null,
      });
    }
  });
  return out;
}
export const sampleEntries: LbEntry[] = buildSample();

// ---------------------------------------------------------------------------
// Ranking + filtering
// ---------------------------------------------------------------------------
const norm = (t: string) => t.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const vehName = (e: { make: string; model: string }) => `${e.make} ${e.model}`;
const byTime = (a: LbEntry, b: LbEntry) => a.lap_time_ms - b.lap_time_ms || a.driver.localeCompare(b.driver);

function matchDriver(e: LbEntry, q: string) {
  return !q || norm(e.driver).includes(q) || (e.crew ? norm(e.crew.tag).includes(q) : false);
}

/** Overall: every driver once, with his fastest vehicle. */
export function overallRows(all: LbEntry[], verifiedOnly: boolean) {
  const best = new Map<string, LbEntry>();
  for (const e of all) {
    if (verifiedOnly && !e.verified) continue;
    const cur = best.get(e.driver_id);
    if (!cur || byTime(e, cur) < 0) best.set(e.driver_id, e);
  }
  return [...best.values()].sort(byTime).map((e, i) => ({ e, rank: i + 1 }));
}
/** One vehicle: every driver's best on that vehicle. */
export function vehicleRows(all: LbEntry[], vehicleId: string, verifiedOnly: boolean) {
  return all.filter((e) => e.vehicle_id === vehicleId && (!verifiedOnly || e.verified)).sort(byTime).map((e, i) => ({ e, rank: i + 1 }));
}
// ---------------------------------------------------------------------------
// Markup (Redesign DEC-0119: grid rows, Car column with class, Gap, P1 pink / own row orange)
// ---------------------------------------------------------------------------
const base = import.meta.env.BASE_URL;
export function lapTime(ms: number) {
  const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000), t = ms % 1000;
  return `${m}:${String(s).padStart(2, '0')}.${String(t).padStart(3, '0')}`;
}
const logoUrl = (slug: string | null) => (slug ? `${base}images/logos/${slug}-gta-6-logo.webp` : null);
const inGarage = (id: string) => vehicleOptions.some((v) => v.id === id);
const garageUrl = (id: string) => `${base}cars/vehicles/${encodeURIComponent(id)}/`;
const vById = new Map(vehicleOptions.map((v) => [v.id, v]));

export function logoChip(e: { logo: string | null }, lg = false) {
  const u = logoUrl(e.logo);
  const px = lg ? 48 : 30;
  return u ? `<span class="logo-chip${lg ? ' logo-chip-lg' : ''}"><img src="${u}" alt="" width="${px}" height="${px}" loading="lazy" /></span>` : '<span class="logo-chip"></span>';
}
/** Car cell: logo + "Make Model" (link to the car page) + class underneath. */
function carCell(e: LbEntry, cls: string | null) {
  const v = vById.get(e.vehicle_id);
  const klass = cls && v?.classes.includes(cls) ? cls : v?.classes[0] ?? '';
  const name = `${esc(e.make)} ${esc(e.model)}`;
  const nm = inGarage(e.vehicle_id) ? `<a href="${garageUrl(e.vehicle_id)}">${name}</a>` : `<span>${name}</span>`;
  return `<span class="car" role="cell">${logoChip(e)}<span class="nm"><b>${nm}</b>${klass ? `<small>${esc(klass)}</small>` : ''}</span></span>`;
}
function crewTag(c: LbEntry['crew']) {
  if (!c || !/^#[0-9a-fA-F]{6}$/.test(c.color)) return '';
  return `<a class="crew-tag crew-tag-sm lb-crew-tag" rel="nofollow" style="--crew-color:${c.color}" href="${base}community/crews/?q=${encodeURIComponent(c.tag)}" title="Crew ${esc(c.tag)}">${esc(c.tag)}</a>`;
}
const CHECK = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';
const PLAY = '<svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4v16l13-8z"/></svg>';
function statusCell(verified: boolean) {
  return verified
    ? `<span class="st ok" role="cell" title="Video verified"><i>${CHECK}</i><span class="st-t">Video verified</span></span>`
    : '<span class="st no" role="cell" title="Not video verified (screenshot only)"><i></i><span class="st-t">Not video verified</span></span>';
}
function videoCell(e: LbEntry, sample: boolean) {
  if (e.verified && e.video_url && /^https:\/\//.test(e.video_url)) return `<a class="vd" href="${esc(e.video_url)}" target="_blank" rel="noopener" aria-label="Watch ${esc(e.driver)}'s lap">${PLAY}<span class="vd-t">Watch</span></a>`;
  if (e.verified && sample) return `<span class="vd is-off" title="Sample data — no real video">${PLAY}<span class="vd-t">Watch</span></span>`;
  return '<span class="vd x" aria-label="No video">—</span>';
}
const empty = (text: string) => `<div class="tr lb-empty" role="row"><span role="cell">${text}</span></div>`;

/** Does a vehicle id pass the class / manufacturer filters? */
export function inFilter(id: string, logo: string | null, s: Pick<LbState, 'cls' | 'make'>): boolean {
  const v = vById.get(id);
  if (s.cls && !(v?.classes ?? []).includes(s.cls)) return false;
  if (s.make && (v?.logoSlug ?? logo) !== s.make) return false;
  return true;
}
/** Classes (mockup order first) and manufacturers of the garage vehicles. */
const CLASS_ORDER = ['Super', 'Sports', 'Muscle', 'Sports Classics', 'Off-Road', 'SUVs', 'Sedans', 'Coupes'];
const allClasses = [...new Set(vehicleOptions.flatMap((v) => v.classes))];
export const lbClasses = [...CLASS_ORDER.filter((c) => allClasses.includes(c)), ...allClasses.filter((c) => !CLASS_ORDER.includes(c)).sort()];
export const lbMakes = [...new Map(vehicleOptions.map((v) => [v.logoSlug, v.make])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
const classLabel = (c: string) => taxonomyCopy[classSlug(c)]?.h1 ?? c;
const makeName = (slug: string) => lbMakes.find(([k]) => k === slug)?.[1] ?? slug;

/** Class chips (no counts, active = white). */
export function classChipsHtml(s: LbState): string {
  const chip = (val: string, label: string) => `<button type="button" class="chip-c${(s.cls ?? '') === val ? ' on' : ''}" data-cls="${esc(val)}" aria-pressed="${(s.cls ?? '') === val}">${esc(label)}</button>`;
  return chip('', 'All classes') + lbClasses.map((c) => chip(c, c)).join('');
}
export function makeSelectHtml(s: LbState): string {
  return `<option value=""${s.make ? '' : ' selected'}>Choose a manufacturer</option>` + lbMakes.map(([slug, name]) => `<option value="${esc(slug)}"${s.make === slug ? ' selected' : ''}>${esc(name)}</option>`).join('');
}

export interface Rendered { body: string; context: string; more: string; meta: string; hasMe: boolean }

type Ranked = { e: LbEntry; rank: number }[];
/** Rows to show: Top 12; logged in and further down -> the driver ahead, own row, the driver behind
 *  (break only when they don't follow on from the Top 12, DEC-0119). */
function pick(rows: Ranked, s: LbState, searching: boolean): { list: Ranked; breakBefore: number | null } {
  if (s.showAll || searching) return { list: rows, breakBefore: null };
  const top = rows.slice(0, PAGE);
  const mi = s.me ? rows.findIndex(({ e }) => e.driver_id === s.me) : -1;
  if (mi < PAGE) return { list: top, breakBefore: null };
  const from = mi - 1, to = Math.min(rows.length, mi + 2);
  if (from <= PAGE) return { list: rows.slice(0, to), breakBefore: null };
  return { list: [...top, ...rows.slice(from, to)], breakBefore: rows[from].rank };
}

export function render(all: LbEntry[], s: LbState, sample: boolean): Rendered {
  const qd = norm(s.qDriver);
  const vf = s.verifiedOnly ? 'verified ' : '';
  const driverCount = new Set(all.map((e) => e.driver_id)).size;
  const laps = [...new Map(all.map((e) => [e.driver_id, e.entries])).values()].reduce((a, b) => a + b, 0);
  const meta = `Best lap per driver · PS5 · ${driverCount} driver${driverCount === 1 ? '' : 's'} · ${laps} accepted lap${laps === 1 ? '' : 's'}`;

  let ranked: Ranked;
  let context = '';
  const carCol = !s.vehicle;
  if (s.vehicle) {
    const g = vById.get(s.vehicle);
    const v = all.find((e) => e.vehicle_id === s.vehicle) ?? (g ? ({ make: g.make, model: g.model, logo: g.logoSlug, vehicle_id: g.id } as LbEntry) : null);
    ranked = vehicleRows(all, s.vehicle, s.verifiedOnly);
    const name = v ? `${esc(v.make)} ${esc(v.model)}` : 'Unknown car';
    context = `<div class="lb-context"><div class="lb-context-title">${v ? logoChip(v, true) : ''}<div><p class="lb-context-kicker">Car leaderboard · ${ranked.length} driver${ranked.length === 1 ? '' : 's'}</p><h3>${name}</h3></div></div>${v && inGarage(v.vehicle_id) ? `<a class="lb-context-link" href="${garageUrl(v.vehicle_id)}">Open the car page →</a>` : ''}</div>`;
  } else {
    const filtered = s.cls || s.make;
    ranked = overallRows(filtered ? all.filter((e) => inFilter(e.vehicle_id, e.logo, s)) : all, s.verifiedOnly);
    if (filtered) {
      const title = s.make && s.cls ? `${esc(makeName(s.make))} · ${esc(classLabel(s.cls))}` : s.make ? `${esc(makeName(s.make))} Cars` : esc(classLabel(s.cls!));
      const kicker = s.make && s.cls ? 'Manufacturer + class leaderboard' : s.make ? 'Manufacturer leaderboard' : 'Class leaderboard';
      const page = s.make && !s.cls ? makeHref({ logoSlug: s.make }) : s.cls && !s.make ? classHref(s.cls) : null;
      context = `<div class="lb-context"><div class="lb-context-title">${s.make ? logoChip({ logo: s.make }, true) : ''}<div><p class="lb-context-kicker">${kicker} · ${ranked.length} driver${ranked.length === 1 ? '' : 's'}</p><h3>${title}</h3></div></div>${page ? `<a class="lb-context-link" href="${base}${page}">Open in Cars →</a>` : ''}</div>`;
    }
  }
  const rows = ranked.filter(({ e }) => matchDriver(e, qd));
  const { list, breakBefore } = pick(rows, s, Boolean(qd));
  const best = ranked[0]?.e.lap_time_ms ?? 0;
  let hasMe = false;
  const body = list.length
    ? list.map(({ e, rank }) => {
      const me = Boolean(s.me && e.driver_id === s.me);
      if (me) hasMe = true;
      const cls = ['tr', rank === 1 ? 'first' : '', me ? 'me' : '', rank === breakBefore ? 'brk' : ''].filter(Boolean).join(' ');
      const gp = e.lap_time_ms === best ? '' : `+${((e.lap_time_ms - best) / 1000).toFixed(3)}`;
      return `<div class="${cls}" role="row"${me ? ' id="lb-me"' : ''}><span class="rk" role="cell">${rank}</span><span class="dr" role="cell"><span class="n">${esc(e.driver)}</span>${crewTag(e.crew)}${me ? '<span class="you">YOU</span>' : ''}</span>${carCol ? carCell(e, s.cls) : ''}<span class="mt"><span class="gp" role="cell">${gp}</span>${statusCell(e.verified)}${videoCell(e, sample)}</span><span class="tm" role="cell">${lapTime(e.lap_time_ms)}</span></div>`;
    }).join('')
    : empty(ranked.length ? 'No driver matches your search.' : s.vehicle || s.cls || s.make ? `No ${vf}times in this selection yet. <a href="${base}time-attack/submit/">Be the first — submit a lap</a>.` : `No ${vf}times yet.`);
  const shownCount = list.length;
  const more = !qd && !s.showAll && shownCount < rows.length ? `<button type="button" class="btn btn-s lb-more-btn" data-lb-more>Show all ${rows.length} ${vf}drivers</button>` : '';
  return { body, context, more, meta, hasMe };
}

/** Header row (Car column only when the table spans several cars). */
export function headHtml(carCol: boolean): string {
  return `<div class="tr h" role="row"><span role="columnheader">#</span><span role="columnheader">Driver</span>${carCol ? '<span role="columnheader">Car</span>' : ''}<span class="mt"><span class="gp" role="columnheader">Gap</span><span role="columnheader">Status</span><span class="vd-h" role="columnheader">Video</span></span><span class="tm" role="columnheader">Lap time</span></div>`;
}

/** Car dropdown ("By car"): every garage car grouped by class, with the number of drivers. */
export function vehicleSelectHtml(all: LbEntry[], s: LbState): string {
  const count = new Map<string, number>();
  for (const e of all) if (!s.verifiedOnly || e.verified) count.set(e.vehicle_id, (count.get(e.vehicle_id) ?? 0) + 1);
  const groups = new Map<string, typeof vehicleOptions>();
  for (const v of vehicleOptions) {
    const c = v.classes[0] ?? 'Other';
    if (!groups.has(c)) groups.set(c, []);
    groups.get(c)!.push(v);
  }
  const opt = (v: (typeof vehicleOptions)[number]) => {
    const n = count.get(v.id) ?? 0;
    return `<option value="${esc(v.id)}"${s.vehicle === v.id ? ' selected' : ''}>${esc(v.make)} ${esc(v.model)}${n ? ` (${n})` : ''}</option>`;
  };
  const order = (c: string) => (lbClasses.indexOf(c) < 0 ? 99 : lbClasses.indexOf(c));
  const sorted = [...groups.entries()].sort((a, b) => order(a[0]) - order(b[0]));
  return `<option value=""${s.vehicle ? '' : ' selected'}>Choose a car</option>`
    + sorted.map(([c, vs]) => `<optgroup label="${esc(c)}">${vs.sort((a, b) => `${a.make} ${a.model}`.localeCompare(`${b.make} ${b.model}`)).map(opt).join('')}</optgroup>`).join('');
}

/** "No lap yet in these cars": garage cars without any lap. Six picks spread over the classes
 *  (officially shown cars first), plus the full list for "All N cars without a lap". */
export function noLapCars(all: LbEntry[]) {
  const withLap = new Set(all.map((e) => e.vehicle_id));
  const none = vehicleOptions.filter((v) => !withLap.has(v.id));
  const pool = [...none].sort((a, b) => Number(Boolean(b.releaseId)) - Number(Boolean(a.releaseId)) || Number(Boolean(b.photo)) - Number(Boolean(a.photo)));
  const picks: typeof vehicleOptions = [];
  for (let round = 0; picks.length < 6 && round < 20; round++) {
    for (const c of lbClasses) {
      const hit = pool.filter((v) => v.classes[0] === c && !picks.includes(v))[0];
      if (hit && picks.length < 6) picks.push(hit);
    }
    if (!pool.some((v) => !picks.includes(v))) break;
  }
  const item = (v: (typeof vehicleOptions)[number]) => `<a href="${garageUrl(v.id)}" title="${esc(v.make)} ${esc(v.model)}">${logoChip({ logo: v.logoSlug })}<span class="t"><b>${esc(v.model)}</b><small>Take #1 →</small></span></a>`;
  const rest = none.filter((v) => !picks.includes(v)).sort((a, b) => `${a.make} ${a.model}`.localeCompare(`${b.make} ${b.model}`));
  return { count: none.length, picks: picks.map(item).join(''), rest: rest.map(item).join('') };
}

/** Hero tile + track facts: verified record, drivers, laps, cars with a lap. */
export function trackStats(all: LbEntry[], verified: LbEntry[]) {
  const rec = [...verified].filter((e) => e.verified).sort(byTime)[0] ?? null;
  const drivers = new Set(all.map((e) => e.driver_id)).size;
  const laps = [...new Map(all.map((e) => [e.driver_id, e.entries])).values()].reduce((a, b) => a + b, 0);
  const cars = new Set(all.map((e) => e.vehicle_id)).size;
  return { rec, drivers, laps, cars };
}
export function recordWhoHtml(rec: LbEntry | null): string {
  if (!rec) return '<span>No video-verified lap yet</span>';
  return `<b>${esc(rec.driver)}</b>${crewTag(rec.crew)}<span>in ${esc(rec.make)} ${esc(rec.model)}</span>`;
}
