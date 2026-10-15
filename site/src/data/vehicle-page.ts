// Vehicle page building blocks (Redesign phase 5, DEC-0118). Used at build time
// (sample rows until launch) and in the browser (live rows), so both look the same.
// COPY STATUS: all labels ("Leader", "No lap", "Your lap could be here", the #1 tile)
// are Claude placeholders from the mockup -> Codex review (DEC-0088).
import { esc } from './hub';
import { lapTime, type LbEntry } from './leaderboard';
import { vehicleOptions, type VehicleOption } from './vehicles';

const base = import.meta.env.BASE_URL;
const byId = new Map(vehicleOptions.map((v) => [v.id, v]));

export interface DriverRow { rank: number; driver: string; ms: number; me?: boolean }
export interface ClassRow { id: string; ms: number | null }

/** "Fastest drivers in this car": rank · driver · lap */
export function driverRowHtml(r: DriverRow): string {
  return `<div class="vg-row${r.me ? ' me' : ''}">
  <span class="vg-pos tnum${r.rank === 1 ? ' is-first' : ''}">${r.rank}</span>
  <span class="vg-name">${esc(r.driver)}${r.me ? ' <em class="vg-you">You</em>' : ''}</span>
  <span class="vg-time tnum">${lapTime(r.ms)}</span>
</div>`;
}

/** Placeholder row under the top 5 (guest / no own lap) */
export function openRowHtml(): string {
  return `<div class="vg-row vg-open"><span class="vg-pos">–</span><span class="vg-name">Your lap could be here</span><span class="vg-time">—</span></div>`;
}

/** Dashed tile when nobody has a lap in this car yet */
export function startTileHtml(model: string, submitHref: string): string {
  return `<div class="vg-start">
  <b class="vg-start-n">#1</b>
  <p class="vg-start-t">No laps in the ${esc(model)} yet.</p>
  <p class="vg-start-s">Set the first time and take #1. Every lap after yours has to beat it.</p>
  <a class="btn btn-p" href="${submitHref}"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/></svg>Set the first time</a>
</div>`;
}

function thumb(v: VehicleOption): string {
  return v.photo
    ? `<img class="vg-thumb" src="${base}images/vehicles/${v.id}-640.webp" alt="" width="64" height="36" loading="lazy" />`
    : `<span class="vg-thumb vg-thumb-logo"><img class="vg-thumb-bg" src="${base}images/garage/garage-hero-placeholder-640.webp" alt="" width="64" height="36" loading="lazy" /><img class="vg-thumb-l" src="${base}images/logos/${v.logoSlug}-gta-6-logo.webp" alt="" width="22" height="22" loading="lazy" /></span>`;
}

/** Class list sorted by each car's best lap; cars without a lap at the bottom. */
export function sortClass(rows: ClassRow[]): ClassRow[] {
  return [...rows].sort((a, b) => (a.ms == null ? 1 : 0) - (b.ms == null ? 1 : 0) || (a.ms ?? 0) - (b.ms ?? 0)
    || (byId.get(a.id)?.model ?? '').localeCompare(byId.get(b.id)?.model ?? ''));
}

export function classRowsHtml(rows: ClassRow[], currentId: string): string {
  const sorted = sortClass(rows);
  const leader = sorted[0]?.ms ?? null;
  let rank = 0;
  return sorted.map((r) => {
    const v = byId.get(r.id);
    if (!v) return '';
    if (r.ms != null) rank += 1;
    const gap = r.ms == null ? '' : r.ms === leader && rank === 1 ? '<span class="vg-lead">Leader</span>' : `+${((r.ms - (leader ?? r.ms)) / 1000).toFixed(3)}`;
    return `<a class="vg-row vg-crow${r.id === currentId ? ' is-this' : ''}${r.ms == null ? ' no-lap' : ''}" href="${base}cars/vehicles/${v.id}/">
  <span class="vg-pos tnum">${r.ms == null ? '–' : rank}</span>
  ${thumb(v)}
  <span class="vg-name"><span class="vg-make">${esc(v.make)} </span>${esc(v.model)}</span>
  ${r.ms == null ? '<span class="vg-time vg-nolap">No lap</span>' : `<span class="vg-gap tnum">${gap}</span><span class="vg-time tnum">${lapTime(r.ms)}</span>`}
</a>`;
  }).join('');
}

/** Rivals for the compare tile: the cars right ahead of / behind this one in the class list. */
export function rivalsFromClass(rows: ClassRow[], currentId: string): { id: string; note: string }[] | null {
  const timed = sortClass(rows).filter((r) => r.ms != null);
  const i = timed.findIndex((r) => r.id === currentId);
  if (i < 0 || timed.length < 2) return null;
  const out: { id: string; note: string }[] = [];
  if (i > 0) out.push({ id: timed[i - 1].id, note: '1 place ahead' });
  if (i < timed.length - 1) out.push({ id: timed[i + 1].id, note: '1 place behind' });
  if (out.length < 2 && i > 1) out.unshift({ id: timed[i - 2].id, note: '2 places ahead' });
  if (out.length < 2 && i < timed.length - 2) out.push({ id: timed[i + 2].id, note: '2 places behind' });
  return out.slice(0, 2);
}

export function rivalHtml(id: string, note: string, currentId: string): string {
  const v = byId.get(id);
  if (!v) return '';
  return `<a class="vh-rival" href="${base}cars/compare/?cars=${esc(currentId)},${esc(id)}" data-vs="${esc(id)}" data-self="${esc(currentId)}">
  ${thumb(v)}
  <span class="vh-rival-t"><b>${esc(v.model)}</b><span>${esc(note)}</span></span>
  <span class="vh-vs">vs →</span>
</a>`;
}

/** Sample mode (before the first real lap): best lap per car and driver rows from the fictional sample. */
export function sampleClassRows(sample: LbEntry[], classIds: string[]): ClassRow[] {
  return classIds.map((id) => {
    const laps = sample.filter((e) => e.vehicle_id === id).map((e) => e.lap_time_ms);
    return { id, ms: laps.length ? Math.min(...laps) : null };
  });
}
