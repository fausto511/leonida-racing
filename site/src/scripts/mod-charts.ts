// Plain SVG charts for the moderator area (RS-0102): one series each, value on hover (<title>).
// Same look as the Overview charts; styles in styles/mod.css (.mc-card).
export type DayValue = { day: string; n: number };
const W = 560, H = 200, X0 = 44, X1 = 552, YB = 170, YT = 20;
const fmt = (n: number) => n.toLocaleString('en-US');
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
export const dayLabel = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const niceMax = (v: number) => { if (v <= 5) return 5; const p = 10 ** Math.floor(Math.log10(v)); return Math.ceil(v / p) * p; };
const axis = (max: number) => `<line x1="${X0}" y1="${YB}" x2="${X1}" y2="${YB}" class="ax"/><line x1="${X0}" y1="${YT}" x2="${X1}" y2="${YT}" class="gr"/>
  <text x="${X0 - 8}" y="${YB + 4}" text-anchor="end">0</text><text x="${X0 - 8}" y="${YT + 4}" text-anchor="end">${fmt(max)}</text>`;
const xLabels = (a: string, b: string) => `<text x="${X0}" y="${H - 8}">${a}</text><text x="${X1}" y="${H - 8}" text-anchor="end">${b}</text>`;

/** Running total: startTotal + cumulative daily values. */
export function lineChart(days: DayValue[], startTotal: number, label: string): string {
  if (!days.length) return '';
  let total = startTotal;
  const vals = days.map((d) => (total += d.n));
  const max = niceMax(Math.max(...vals, 1));
  const step = (X1 - X0) / Math.max(days.length - 1, 1);
  const pts = vals.map((v, i) => [X0 + i * step, YB - (v / max) * (YB - YT)]);
  const last = pts[pts.length - 1];
  const hits = vals.map((v, i) => `<rect x="${(pts[i][0] - step / 2).toFixed(1)}" y="${YT}" width="${step.toFixed(1)}" height="${YB - YT}" class="hit"><title>${dayLabel(days[i].day)}: ${fmt(v)}</title></rect>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">${axis(max)}
    <polyline points="${pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')}" class="ln"/>
    <circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="5" class="dot"/>
    <text x="${(last[0] - 10).toFixed(1)}" y="${(last[1] - 10).toFixed(1)}" text-anchor="end" class="val">${fmt(vals[vals.length - 1])}</text>
    ${xLabels(dayLabel(days[0].day), dayLabel(days[days.length - 1].day))}${hits}</svg>`;
}

export function barChart(days: DayValue[], label: string): string {
  if (!days.length) return '';
  const max = niceMax(Math.max(...days.map((d) => d.n), 1));
  const slot = (X1 - X0) / days.length;
  const bars = days.map((d, i) => {
    const h = d.n ? Math.max((d.n / max) * (YB - YT), 2) : 0;
    return `<g><rect x="${(X0 + i * slot).toFixed(1)}" y="${YT}" width="${slot.toFixed(1)}" height="${YB - YT}" class="hit"/>${d.n ? `<rect x="${(X0 + i * slot + 2).toFixed(1)}" y="${(YB - h).toFixed(1)}" width="${Math.max(slot - 4, 1).toFixed(1)}" height="${h.toFixed(1)}" rx="3" class="bar"/>` : ''}<title>${dayLabel(d.day)}: ${fmt(d.n)}</title></g>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">${axis(max)}${bars}${xLabels(dayLabel(days[0].day), dayLabel(days[days.length - 1].day))}</svg>`;
}

/** Fill missing days with 0 so the x axis is continuous (last `days` days up to today, local date). */
export function fillDays(rows: DayValue[], days: number): DayValue[] {
  const map = new Map(rows.map((r) => [r.day, r.n]));
  const out: DayValue[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() - i));
    const key = d.toISOString().slice(0, 10);
    out.push({ day: key, n: map.get(key) ?? 0 });
  }
  return out;
}
