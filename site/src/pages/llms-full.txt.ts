// llms-full.txt (llmstxt.org convention, Fausto 04.11.2026): the car data itself as plain text,
// one line per officially revealed GTA VI car. Built from the database on every deploy (same
// source as the vehicle pages), so it needs no manual upkeep. Leak-only cars (no release) are
// left out; missing values are simply omitted. Credit line per DEC-0214.
// COPY STATUS: header = Claude placeholder; licence sentence follows the Terms once "Using our data" is live.
import type { APIRoute } from 'astro';
import { SITE_NAME } from '../data/site';
import { vehicleOptions, vehicleValues, fastestGellhornLapMs } from '../data/vehicles';
import { lapTime } from '../data/leaderboard';

export const GET: APIRoute = ({ site }) => {
  const base = import.meta.env.BASE_URL;
  const u = (p: string) => new URL(`${base}${p}`, site).href;
  const cars = vehicleOptions
    .filter((v) => v.releaseId)
    .sort((a, b) => `${a.make} ${a.model}`.localeCompare(`${b.make} ${b.model}`));
  const lines = cars.map((v) => {
    const val = vehicleValues[v.id] ?? {};
    const price = val.price_gtad?.value;
    const mph = val.top_speed_mph?.value;
    const ref = val.gellhorn_reference_lap_ms?.value;
    const best = fastestGellhornLapMs(v.id);
    return [
      `${v.make} ${v.model}`,
      v.classes.join(', '),
      v.realLifeInspiration ? `based on ${v.realLifeInspiration}` : '',
      price != null ? `price $${Math.round(price).toLocaleString('en-US')}` : '',
      mph != null ? `top speed ${Math.round(mph)} mph (${Math.round(mph * 1.609344)} km/h), stock` : '',
      ref != null ? `Gellhorn reference lap ${lapTime(ref)}` : best != null ? `fastest Gellhorn community lap ${lapTime(best)}` : '',
      u(`cars/vehicles/${v.id}/`),
    ].filter(Boolean).join(' · ');
  });
  const built = new Date().toISOString().slice(0, 10);
  const body = `# ${SITE_NAME} — GTA VI car data

> Officially revealed Grand Theft Auto VI (GTA 6) cars in the ${SITE_NAME} database: class, primary real-life inspiration and, where measured, price, stock top speed and Gellhorn lap time. Values that are not known yet are left out. ${SITE_NAME} is not affiliated with Rockstar Games or Take-Two Interactive.

Data by ${SITE_NAME} (${u('')}). Please credit "Data by ${SITE_NAME}" with a link when you use this data. Values can change with game updates.
Generated: ${built} · ${cars.length} cars · Format: name · class · inspiration · values · page

${lines.map((l) => `- ${l}`).join('\n')}
`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
