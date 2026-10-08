// Ranking pages, "New cars" and model family pages (Fausto 2026-10-08).
// All filled automatically from the database (vehicle_values, vehicles).
// They stay noindex (and out of the sitemap) until the data is good enough:
// a ranking needs RANKING_MIN_ENTRIES measured cars AND RANKING_MIN_COVERAGE of
// the officially revealed cars in its scope; "New cars" needs the research
// (vehicles.previous_games) for NEW_CARS_MIN_COVERAGE of revealed cars; a family
// page needs its own copy (familyCopy). Values: stock only (measure stock first).
// COPY STATUS: titles/intros are Claude placeholders, Codex review pending.
import { vehicleOptions, vehicleValues, familySlugs, familyMembers, FAMILY_PAGE_MIN, type VehicleOption, type VehicleValue } from './vehicles';
import { classPages, vehiclesInClass } from './garage-taxonomy';

export const RANKING_MIN_ENTRIES = 5;
export const RANKING_MIN_COVERAGE = 0.6;
export const NEW_CARS_MIN_COVERAGE = 0.8;

const classLabels: Record<string, string> = {
  super: 'Super Cars', sports: 'Sports Cars', muscle: 'Muscle Cars', 'sports-classics': 'Sports Classics',
  coupes: 'Coupes', sedans: 'Sedans', suvs: 'SUVs', 'off-road': 'Off-Road Vehicles',
};

export interface RankingDef {
  path: string;              // relative to BASE_URL, e.g. garage/rankings/fastest/
  slug: string;              // URL segment(s) under garage/rankings/
  title: string;             // H1 + browser title
  description: string;       // meta description
  metric: VehicleValue['metric'];
  order: 'asc' | 'desc';
  valueLabel: string;        // table column
  intro: string;
  scope: VehicleOption[];
  classSlug?: string;
}
export interface RankingEntry { vehicle: VehicleOption; value: VehicleValue }

const revealed = (list: VehicleOption[]) => list.filter((v) => v.releaseId);

function def(slug: string, title: string, description: string, metric: RankingDef['metric'], order: RankingDef['order'], valueLabel: string, intro: string, scope: VehicleOption[], classSlug?: string): RankingDef {
  return { path: `garage/rankings/${slug}/`, slug, title, description, metric, order, valueLabel, intro, scope: revealed(scope), classSlug };
}

export const rankings: RankingDef[] = [
  def('fastest', 'Fastest Cars in GTA 6', 'The fastest cars in GTA 6 ranked by measured top speed. Stock vehicles, one documented test method, updated as new cars are measured.',
    'top_speed_mph', 'desc', 'Top speed', 'Every car is measured stock, without upgrades, using the same documented method. Tuned values follow later.', vehicleOptions),
  ...classPages.map((c) => def(`fastest/${c.slug}`, `Fastest ${classLabels[c.slug] ?? c.name} in GTA 6`, `The fastest ${(classLabels[c.slug] ?? c.name).toLowerCase()} in GTA 6 ranked by measured top speed, stock and tested the same way.`,
    'top_speed_mph', 'desc', 'Top speed', `${classLabels[c.slug] ?? c.name} only, measured stock with the same documented method.`, vehiclesInClass(c.slug), c.slug)),
  def('most-expensive', 'Most Expensive Cars in GTA 6', 'The most expensive cars in GTA 6 ranked by purchase price, with the source of every price.',
    'price_gtad', 'desc', 'Price', 'Purchase prices as shown in the game, each with its source and game version.', vehicleOptions),
  def('cheapest', 'Cheapest Cars in GTA 6', 'The cheapest cars you can buy in GTA 6, ranked by purchase price, with the source of every price.',
    'price_gtad', 'asc', 'Price', 'Purchase prices as shown in the game, cheapest first. A good starting point when money is tight.', vehicleOptions),
  def('gellhorn-lap', 'Fastest Cars at Gellhorn International Raceway', 'GTA 6 cars ranked by their reference lap time at Gellhorn International Raceway, our community race track.',
    'gellhorn_reference_lap_ms', 'asc', 'Reference lap', 'Reference lap times at Gellhorn International Raceway, driven stock under the same conditions.', vehicleOptions),
];

export function rankingEntries(r: RankingDef): RankingEntry[] {
  const out: RankingEntry[] = [];
  for (const v of r.scope) { const val = vehicleValues[v.id]?.[r.metric]; if (val) out.push({ vehicle: v, value: val }); }
  return out.sort((a, b) => (r.order === 'asc' ? a.value.value - b.value.value : b.value.value - a.value.value));
}
export function rankingIndexable(r: RankingDef): boolean {
  const n = rankingEntries(r).length;
  return n >= RANKING_MIN_ENTRIES && r.scope.length > 0 && n / r.scope.length >= RANKING_MIN_COVERAGE;
}

// New cars: revealed vehicles whose earlier-titles research says "none".
export const newCars = () => revealed(vehicleOptions).filter((v) => Array.isArray(v.previousGames) && v.previousGames.length === 0);
export function newCarsResearchCoverage(): number {
  const r = revealed(vehicleOptions); return r.length ? r.filter((v) => Array.isArray(v.previousGames)).length / r.length : 0;
}
export const newCarsIndexable = () => newCars().length > 0 && newCarsResearchCoverage() >= NEW_CARS_MIN_COVERAGE;

// Family pages: from FAMILY_PAGE_MIN models; indexed once the family has its own copy.
export const familyCopy: Record<string, string[]> = {};
// only officially revealed members count and are shown (leak-only vehicles stay off public pages; Codex 08.10.)
export const familyPageSlugs = () => familySlugs().filter((f) => familyMembers(f).filter((v) => v.releaseId).length >= FAMILY_PAGE_MIN);
export const familyIndexable = (f: string) => Boolean(familyCopy[f]?.length) && familyMembers(f).some((v) => v.releaseId);

/** Paths (relative, with trailing slash) that are noindex because data/copy is missing -> kept out of the sitemap. */
export function dataNoindexPaths(): string[] {
  return [
    ...rankings.filter((r) => !rankingIndexable(r)).map((r) => `/${r.path}`),
    ...(newCarsIndexable() ? [] : ['/garage/new-cars/']),
    ...familyPageSlugs().filter((f) => !familyIndexable(f)).map((f) => `/garage/families/${f}/`),
  ];
}
