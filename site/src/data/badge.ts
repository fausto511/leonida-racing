// Driver Badge (DEC-0230, DEC-0223, DEC-0229; Fausto 06.11.2026).
// One badge per driver, the same everywhere:
//   number = activity: +1 per car + track with an accepted lap (stage 1, until GTA Online)
//   colour = strength: per class with >= 4 drivers, the driver's position in the class board
//            (0 = first, 1 = last), averaged over those classes; then among all ranked drivers:
//            ahead of >= 90 % Pink · >= 65 % Gold · >= 30 % Silver · else Bronze (= 10/25/35/30 %) · Grey = no class with 4 drivers yet.
// Stage 1 is computed in the browser from the leaderboard rows (best accepted lap per driver + car);
// with more tracks this moves into the database.
// COPY STATUS: tooltip texts are placeholders until the Codex review (DEC-0088).
import { vehicleOptions } from './vehicles';

/** Kill switch: false hides every badge (one-line change + push). */
export const BADGE_ENABLED = true;
/** A class counts once this many drivers have a time in it. */
export const BADGE_MIN_FIELD = 4;

export type BadgeTier = 'grey' | 'bronze' | 'silver' | 'gold' | 'pink';
export interface Badge { n: number; tier: BadgeTier; /** % of the other ranked drivers this one is ahead of */ top?: number }

interface Row { driver_id: string; vehicle_id: string; lap_time_ms: number }
const classesOf = new Map(vehicleOptions.map((v) => [v.id, v.classes]));

/** Badges for every driver in the rows (rows = best accepted lap per driver + car on one track). */
export function computeBadges(rows: Row[]): Map<string, Badge> {
  const cars = new Map<string, Set<string>>();
  // best time per class per driver
  const byClass = new Map<string, Map<string, number>>();
  for (const r of rows) {
    if (!cars.has(r.driver_id)) cars.set(r.driver_id, new Set());
    cars.get(r.driver_id)!.add(r.vehicle_id);
    for (const c of classesOf.get(r.vehicle_id) ?? []) {
      if (!byClass.has(c)) byClass.set(c, new Map());
      const m = byClass.get(c)!;
      const cur = m.get(r.driver_id);
      if (cur === undefined || r.lap_time_ms < cur) m.set(r.driver_id, r.lap_time_ms);
    }
  }
  // position in each class with enough drivers
  const pos = new Map<string, number[]>();
  for (const m of byClass.values()) {
    if (m.size < BADGE_MIN_FIELD) continue;
    const sorted = [...m.entries()].sort((a, b) => a[1] - b[1]);
    sorted.forEach(([id], i) => {
      if (!pos.has(id)) pos.set(id, []);
      pos.get(id)!.push(i / (sorted.length - 1));
    });
  }
  const ranked = [...pos.entries()].map(([id, p]) => ({ id, score: p.reduce((a, b) => a + b, 0) / p.length }))
    .sort((a, b) => a.score - b.score);
  const out = new Map<string, Badge>();
  for (const [id, set] of cars) out.set(id, { n: set.size, tier: 'grey' });
  ranked.forEach(({ id }, i) => {
    // share of the other ranked drivers this one is ahead of (1 = best, 0 = last); tooltip shows the same value
    const better = ranked.length > 1 ? (ranked.length - 1 - i) / (ranked.length - 1) : 1;
    const tier: BadgeTier = better >= 0.90 ? 'pink' : better >= 0.65 ? 'gold' : better >= 0.30 ? 'silver' : 'bronze';
    out.get(id)!.tier = tier;
    out.get(id)!.top = Math.round(better * 100);
  });
  return out;
}

// ---- SVG (design V2: tacho arc 240°, straight ends, metallic gradient low -> high, mark at the bottom) ----
const STOPS: Record<BadgeTier, [string, string, string]> = {
  grey: ['#2E2E3A', '#5A5A6E', '#6E6E82'],
  bronze: ['#3A2820', '#8E5A3A', '#A8724F'],
  silver: ['#4A4D55', '#C7CCD6', '#E6E9EE'],
  gold: ['#6A4A12', '#C8962A', '#E9C46A'],
  pink: ['#5C2440', '#F24B9D', '#FF7DBA'],
};
const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lerp = (a: string, b: string, k: number) => {
  const A = hex(a), B = hex(b);
  return '#' + A.map((x, i) => Math.round(x + (B[i] - x) * k).toString(16).padStart(2, '0')).join('');
};
const pt = (r: number, deg: number) => { const a = (deg * Math.PI) / 180; return `${(50 + r * Math.cos(a)).toFixed(2)} ${(50 + r * Math.sin(a)).toFixed(2)}`; };
const SEG = 30;
const arcCache = new Map<BadgeTier, string>();
function arcPaths(t: BadgeTier) {
  if (arcCache.has(t)) return arcCache.get(t)!;
  const [s0, s1, s2] = STOPS[t];
  let s = '';
  for (let i = 0; i < SEG; i++) {
    const d0 = 150 + (i * 240) / SEG, d1 = 150 + ((i + 1) * 240) / SEG + 0.8;
    const k = i / (SEG - 1);
    const col = k < 0.6 ? lerp(s0, s1, k / 0.6) : lerp(s1, s2, (k - 0.6) / 0.4);
    s += `<path d="M${pt(41.5, d0)} A41.5 41.5 0 0 1 ${pt(41.5, d1)}" stroke="${col}"/>`;
  }
  const html = `<g fill="none" stroke-width="12" stroke-linecap="butt">${s}</g><rect x="40" y="80" width="20" height="5" fill="${s1}"/>`;
  arcCache.set(t, html);
  return html;
}
export const badgeNumber = (n: number) => (n < 1000 ? String(n) : `${(Math.floor(n / 100) / 10).toString().replace(/\.0$/, '')}k`);
const TIER_NAME: Record<BadgeTier, string> = { grey: 'No colour yet', bronze: 'Bronze', silver: 'Silver', gold: 'Gold', pink: 'Pink' };

export function badgeTitle(b: Badge): string {
  const cars = `${b.n} car${b.n === 1 ? '' : 's'} with an accepted lap`;
  return b.tier === 'grey'
    ? `No colour yet: it appears once ${BADGE_MIN_FIELD} drivers have a time in one of your classes · ${cars}`
    : `${TIER_NAME[b.tier]} · ahead of ${b.top} % of ranked drivers at Gellhorn · ${cars}`;
}

/** Badge markup (px = rendered size). Empty when the switch is off or there is no badge. */
export function badgeHtml(b: Badge | undefined, px = 28): string {
  if (!BADGE_ENABLED || !b) return '';
  const num = badgeNumber(b.n);
  const fs = num.length >= 3 ? 30 : num.length === 2 ? 36 : 42;
  const title = badgeTitle(b);
  return `<span class="drv-badge" title="${title}"><svg width="${px}" height="${px}" viewBox="0 0 100 100" role="img" aria-label="${title}"><circle cx="50" cy="50" r="48" fill="#14141F"/>${arcPaths(b.tier)}<text x="50" y="51" text-anchor="middle" dominant-baseline="central" font-family="LR Display, Arial, sans-serif" font-weight="800" font-size="${fs}" fill="#FBF7EA">${num}</text></svg></span>`;
}
