// Which share image (og:image) each Cars page uses (Fausto 14.11.2026: never the empty garage).
// The images themselves are rendered at build time by pages/og/cars/[key].jpg.ts (lib/og-cards.ts).
//   v-<id>    vehicle: its photo, else a card with logo + name
//   m-<slug>  manufacturer without a photo car: logo card
//   c-<slug>  class without a photo car: name card
//   r-<slug>  ranking: title card, fixed (Fausto 14.11.; the Gellhorn ranking uses og/site/gellhorn.jpg)
//   p-cars    the Cars band photo with "GTA 6 Cars": Cars, Compare and every other Cars page without its own
import { vehicleOptions, MAKES_WITHOUT_LOGO } from './vehicles';
import { classPages, manufacturerPages, vehiclesInClass, vehiclesByMake } from './garage-taxonomy';
import { rankings } from './rankings';

export const OG_W = 1200, OG_H = 630;
export const ogCarPath = (key: string) => `og/cars/${key}.jpg`;
export const rankingKey = (slug: string) => `r-${slug.replace(/\//g, '-')}`;

export type OgCard =
  | { key: string; kind: 'photo'; vehicleId: string }
  | { key: string; kind: 'text'; title: string; kicker: string; sub?: string; logoSlug?: string }
  | { key: string; kind: 'hero'; title: string; kicker: string; vehicleId?: string; src?: string };

const cars = (n: number) => (n ? `${n} ${n === 1 ? 'car' : 'cars'} in GTA 6` : undefined); // no "0 cars" before a reveal

/** Every card the build renders. */
export function allOgCards(): OgCard[] {
  const out: OgCard[] = vehicleOptions.map((v) => v.photo
    ? { key: `v-${v.id}`, kind: 'photo' as const, vehicleId: v.id }
    : { key: `v-${v.id}`, kind: 'text' as const, kicker: v.make, title: v.model, sub: `${v.classes.join(' / ')} · GTA 6`, logoSlug: MAKES_WITHOUT_LOGO.has(v.logoSlug) ? undefined : v.logoSlug });
  for (const m of manufacturerPages) out.push({ key: `m-${m.slug}`, kind: 'text', kicker: 'Manufacturer', title: m.name, sub: cars(vehiclesByMake(m.slug).filter((v) => v.releaseId).length), logoSlug: MAKES_WITHOUT_LOGO.has(m.slug) ? undefined : m.slug });
  for (const c of classPages) out.push({ key: `c-${c.slug}`, kind: 'text', kicker: 'Class', title: c.name, sub: cars(vehiclesInClass(c.slug).filter((v) => v.releaseId).length) });
  for (const r of rankings) out.push({ key: rankingKey(r.slug), kind: 'text', kicker: 'Ranking', title: r.title });
  // the Cars page band (car meet at night, DEC-0117), fixed (Fausto 14.11.)
  out.push({ key: 'p-cars', kind: 'hero', kicker: 'Leonida Racing', title: 'GTA 6 Cars', src: 'images/garage/cars-band-1920.webp' });
  return out;
}
