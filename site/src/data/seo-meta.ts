// Search titles + meta descriptions built from the database (Fausto 07.11.2026, RS-0111).
// Values in priority order: top speed, price, class, real-life inspiration. No Gellhorn lap in the
// snippet (not established yet with searchers). Rebuilt with every deploy (every 3 h + on push), so
// new or changed values reach the snippet without manual edits. Missing values are left out; the
// description always stays one natural sentence.
// COPY STATUS: templates = Claude placeholders, Codex review pending; Fausto decides.
import { vehicleValues, type VehicleOption } from './vehicles';

const TITLE_MAX = 60;   // roughly what Google shows
const DESC_MAX = 160;

const mphOf = (id: string) => vehicleValues[id]?.top_speed_mph?.value ?? null; // stock values only
const priceOf = (id: string) => vehicleValues[id]?.price_gtad?.value ?? null;
const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
const kmh = (mph: number) => Math.round(mph * 1.609344);

// "a Sports car", "an SUV", "a sedan" ... (class names are plural labels in the data)
const SINGULAR: Record<string, string> = { SUVs: 'SUV', Sedans: 'sedan', Coupes: 'coupe' };
function classPhrase(classes: string[]): string {
  if (!classes.length) return 'a car';
  if (classes.length > 1) return `a car in the ${classes.join(' and ')} classes`;
  const c = classes[0];
  const noun = SINGULAR[c] ?? `${c} car`;
  return `${/^[AEIOU]/i.test(noun) || noun === 'SUV' ? 'an' : 'a'} ${noun}`;
}

export function vehicleTitle(v: VehicleOption): string {
  const name = `${v.make} ${v.model}`;
  const options = [
    `${name} in GTA 6 — Top Speed, Price & Specs`,
    `${name} — GTA 6 Top Speed & Price`,
    `${name} — GTA 6 Specs`,
  ];
  return options.find((t) => t.length <= TITLE_MAX) ?? options[options.length - 1];
}

export function vehicleDescription(v: VehicleOption): string {
  const name = `${v.make} ${v.model}`;
  const mph = mphOf(v.id);
  const price = priceOf(v.id);
  const based = v.realLifeInspiration ? ` Based on the ${v.realLifeInspiration}.` : '';
  const cls = classPhrase(v.classes);
  const build = (withKmh: boolean, withBased: boolean) => {
    const speed = mph != null ? `a top speed of ${Math.round(mph)} mph${withKmh ? ` (${kmh(mph)} km/h)` : ''}` : '';
    const cost = price != null ? `a price of ${usd(price)}` : '';
    const vals = [speed, cost].filter(Boolean).join(' and ');
    const tail = withBased ? based : '';
    return vals
      ? `The ${name} is ${cls} in GTA 6 with ${vals}.${tail}`
      : `The ${name} is ${cls} in GTA 6${v.realLifeInspiration && withBased ? `, based on the ${v.realLifeInspiration}` : ''}. Top speed, price and specs on Leonida Racing.`;
  };
  // shorten step by step if too long: drop km/h, then the inspiration
  return [build(true, true), build(false, true), build(false, false)].find((d) => d.length <= DESC_MAX) ?? build(false, false);
}

/** Class + manufacturer pages. `label` = "Sports Cars" / "SUVs" (class) or "Pfister Cars" (make). */
export function collectionTitle(isClass: boolean, label: string): string {
  const head = isClass ? `GTA 6 ${label}` : `${label} in GTA 6`;
  const options = [`${head} — Top Speeds, Prices & Real-Life Cars`, `${head} — Top Speeds & Prices`, head];
  return options.find((t) => t.length <= TITLE_MAX) ?? head;
}

export function collectionDescription(isClass: boolean, name: string, label: string, list: VehicleOption[], soleInspiration: string | null): string {
  const n = list.length;
  const what = isClass ? label : `${name} car${n === 1 ? '' : 's'}`;
  const count = n === 1 ? `1 ${isClass ? label.replace(/s$/, '') : what}` : `All ${n} ${what}`;
  const brand = !isClass && soleInspiration ? `, the brand behind the game's ${soleInspiration}-inspired cars,` : '';
  const top = list
    .map((v) => ({ v, mph: mphOf(v.id) }))
    .filter((x): x is { v: VehicleOption; mph: number } => x.mph != null)
    .sort((a, b) => b.mph - a.mph)[0];
  const lead = top ? ` Highest stock top speed: ${top.v.make} ${top.v.model}, ${Math.round(top.mph)} mph.` : '';
  const build = (withBrand: boolean, withLead: boolean) =>
    `${count} in GTA 6${withBrand ? brand : ''} with top speeds, prices and the real cars behind them.${withLead ? lead : ''}`;
  return [build(true, true), build(false, true), build(true, false), build(false, false)].find((d) => d.length <= DESC_MAX) ?? build(false, false);
}
