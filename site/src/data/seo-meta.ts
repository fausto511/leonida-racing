// Search titles + meta descriptions built from the database (Fausto 07.11.2026, RS-0111).
// Snippet rework 26.11.2026 (Fausto, Codex review Codex Zuarbeit/Fahrzeug-Snippets-2026-11-24.md):
// promise only what the pages show. One fixed wording for every car / class / manufacturer, no
// per-page "is this value there?" variants (Fausto: ratings, stats and costs to register are being
// filled in for all cars). Numbers are inserted from the database at every build (every 3 h + on
// push); a value that is still missing is simply left out of the sentence.
// Top speed: not measured yet, so not in the titles. When it is, add it back to the title here.
// COPY STATUS: approved by Fausto 26.11.2026.
import { vehicleValues, COST_METRIC, type VehicleOption } from './vehicles';

const TITLE_MAX = 60;   // roughly what Google shows
const DESC_MAX = 160;

const mphOf = (id: string) => vehicleValues[id]?.top_speed_mph?.value ?? null; // stock values only
// GTA VI has no car dealers: the money value is the in-game cost to register (DEC-0247).
const priceOf = (id: string) => vehicleValues[id]?.[COST_METRIC]?.value ?? null;
const roadOf = (id: string) => vehicleValues[id]?.rating_road?.value ?? null;
const offOf = (id: string) => vehicleValues[id]?.rating_offroad?.value ?? null;
const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
const kmh = (mph: number) => Math.round(mph * 1.609344);

// "a sports car", "an off-road car", "a supercar", "an SUV" ... (class names are plural labels in the data)
const SINGULAR: Record<string, string> = {
  SUVs: 'SUV', Sedans: 'sedan', Coupes: 'coupe', Pickups: 'pickup', Vans: 'van', // Pickups/Vans: DEC-0253
  Sports: 'sports car', Muscle: 'muscle car', Super: 'supercar', 'Off-Road': 'off-road car',
};
function classPhrase(classes: string[]): string {
  if (!classes.length) return 'a car';
  if (classes.length > 1) return `a car in the ${classes.join(' and ')} classes`;
  const c = classes[0];
  const noun = SINGULAR[c] ?? `${c.toLowerCase()} car`;
  return `${/^[AEIOU]/i.test(noun) || noun === 'SUV' ? 'an' : 'a'} ${noun}`;
}

/** Fits the limit, else the next shorter option, else the last one. */
const firstFit = (options: string[], max: number) => options.find((t) => t.length <= max) ?? options[options.length - 1];

export function vehicleTitle(v: VehicleOption): string {
  const name = `${v.make} ${v.model}`;
  return firstFit([
    `${name} in GTA 6 — Real Car, Stats & Ratings`,
    `${name} — GTA 6 Real Car, Stats & Ratings`,
    `${name} — GTA 6 Stats & Ratings`,
    `${name} in GTA 6`,
  ], TITLE_MAX);
}

export function vehicleDescription(v: VehicleOption): string {
  const name = `${v.make} ${v.model}`;
  const mph = mphOf(v.id);
  const price = priceOf(v.id);
  const road = roadOf(v.id);
  const off = offOf(v.id);
  const head = (withBased: boolean) =>
    `The ${name} is ${classPhrase(v.classes)} in GTA 6${withBased && v.realLifeInspiration ? `, based on the ${v.realLifeInspiration}` : ''}.`;
  const speed = (withKmh: boolean) => (mph != null ? `Top speed: ${Math.round(mph)} mph${withKmh ? ` (${kmh(mph)} km/h)` : ''}.` : '');
  const ratings = road != null && off != null ? `Road rating ${Math.round(road)}, off-road rating ${Math.round(off)}.`
    : road != null ? `Road rating ${Math.round(road)}.`
    : off != null ? `Off-road rating ${Math.round(off)}.` : '';
  const cost = price != null ? `Costs ${usd(price)} to register.` : '';
  const join = (...parts: string[]) => parts.filter(Boolean).join(' ');
  // too long: drop km/h, then the cost, then the ratings, then the inspiration
  return firstFit([
    join(head(true), speed(true), ratings, cost),
    join(head(true), speed(false), ratings, cost),
    join(head(true), speed(false), ratings),
    join(head(true), speed(false)),
    join(head(false), speed(false), ratings),
    head(false),
  ], DESC_MAX);
}

/** "Sports Cars" -> "sports cars", "Super Cars" -> "supercars", "SUVs" stays "SUVs" (for running text). */
const lowerLabel = (label: string) => (label === 'Super Cars' ? 'supercars' : label.split(' ').map((w) => (/^[A-Z]{2,}/.test(w) ? w : w.toLowerCase())).join(' '));

/** Class + manufacturer pages. `label` = "Sports Cars" / "SUVs" (class) or "Pfister Cars" (make). */
export function collectionTitle(isClass: boolean, label: string): string {
  const head = isClass ? `GTA 6 ${label}` : `${label} in GTA 6`;
  return firstFit([`${head} — Real Cars, Stats & Ratings`, `${head} — Stats & Ratings`, head], TITLE_MAX);
}

export function collectionDescription(isClass: boolean, name: string, label: string, list: VehicleOption[], soleInspiration: string | null): string {
  const what = isClass ? lowerLabel(label) : `${name} cars`;
  // manufacturer whose cars all share one real brand: name it ("Pfister = Porsche" is what people look for)
  const brand = !isClass && soleInspiration ? `, the brand behind the game's ${soleInspiration}-inspired cars,` : '';
  const top = list
    .map((v) => ({ v, mph: mphOf(v.id) }))
    .filter((x): x is { v: VehicleOption; mph: number } => x.mph != null)
    .sort((a, b) => b.mph - a.mph)[0];
  const lead = top ? ` Highest recorded stock top speed: ${top.v.make} ${top.v.model}, ${Math.round(top.mph)} mph.` : '';
  const body = brand
    ? `Explore ${what} in GTA 6${brand} with in-game stats and ratings.`
    : `Explore ${what} in GTA 6, with real-life inspirations, in-game stats and ratings.`;
  const plain = `Explore ${what} in GTA 6, with real-life inspirations, in-game stats and ratings.`;
  return firstFit([body + lead, body, plain], DESC_MAX);
}
