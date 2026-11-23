// Ranking pages, "New cars" and model family pages (Fausto 2026-10-08).
// All filled automatically from the database (vehicle_values, vehicles).
// They stay noindex (and out of the sitemap) until the data is good enough:
// a ranking needs RANKING_MIN_ENTRIES measured cars AND RANKING_MIN_COVERAGE of
// the officially revealed cars in its scope; "New cars" needs the research
// (vehicles.previous_games) for NEW_CARS_MIN_COVERAGE of revealed cars; a family
// page needs its own copy (familyCopy). Values: stock only (measure stock first).
// COPY STATUS: Codex texts (2026-10-08), approved by Fausto 2026-10-09.
import { vehicleOptions, vehicleValues, COST_METRIC, familySlugs, familyMembers, FAMILY_PAGE_MIN, type VehicleOption, type VehicleValue } from './vehicles';
import { classPages, vehiclesInClass } from './garage-taxonomy';

export const RANKING_MIN_ENTRIES = 5;
export const RANKING_MIN_COVERAGE = 0.6;
export const NEW_CARS_MIN_COVERAGE = 0.8;

const classLabels: Record<string, string> = {
  super: 'Super Cars', sports: 'Sports Cars', muscle: 'Muscle Cars',   coupes: 'Coupes', sedans: 'Sedans', suvs: 'SUVs', 'off-road': 'Off-Road Vehicles', pickups: 'Pickups', vans: 'Vans',
};

export interface RankingDef {
  path: string;              // relative to BASE_URL, e.g. cars/rankings/fastest/
  slug: string;              // URL segment(s) under cars/rankings/
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
  return { path: `cars/rankings/${slug}/`, slug, title, description, metric, order, valueLabel, intro, scope: revealed(scope), classSlug };
}

// COPY: Codex 2026-10-08 (Garage-Texte-2026-10-08.md), approved by Fausto 2026-10-09.
const codexClass: Record<string, string> = {
  super: 'Super cars', sports: 'Sports cars', muscle: 'Muscle cars',   coupes: 'Coupes', sedans: 'Sedans', suvs: 'SUVs', 'off-road': 'Off-Road vehicles', pickups: 'Pickups', vans: 'Vans',
};
export const rankings: RankingDef[] = [
  def('fastest', 'Fastest Cars in GTA 6', 'Compare GTA 6 cars by recorded top speed in stock form. See the vehicles with available results, their speeds and the source of each value.',
    'top_speed_mph', 'desc', 'Top speed', 'Recorded top speeds for GTA VI cars in stock form, ordered from highest to lowest. Each result includes its source and, where available, the game version.', vehicleOptions),
  ...classPages.map((c) => def(`fastest/${c.slug}`, `Fastest ${classLabels[c.slug] ?? c.name} in GTA 6`, `Compare GTA 6 ${codexClass[c.slug] ?? c.name} by recorded top speed in stock form, with available results and the source of each value.`,
    'top_speed_mph', 'desc', 'Top speed', `${codexClass[c.slug] ?? c.name} with recorded top speeds in stock form, ordered from highest to lowest.`, vehiclesInClass(c.slug), c.slug)),
  // URLs and titles stay (search terms), the value is the in-game cost to register (Fausto 23.11.2026, DEC-0247).
  // COPY: descriptions + intros = Claude placeholders 23.11.2026, Codex review open.
  def('most-expensive', 'Most Expensive Cars in GTA 6', 'GTA 6 has no car dealers: you steal a car and pay to register it. These cars cost the most to register, each value with its source.',
    COST_METRIC, 'desc', 'Cost to register', 'GTA VI has no car dealers. You steal a car and pay to register it, so the cost to register is what a car costs you. Ordered from highest to lowest, each value with its source.', vehicleOptions),
  def('cheapest', 'Cheapest Cars in GTA 6', 'GTA 6 has no car dealers: you steal a car and pay to register it. These cars cost the least to register, each value with its source.',
    COST_METRIC, 'asc', 'Cost to register', 'GTA VI has no car dealers. You steal a car and pay to register it, so the cost to register is what a car costs you. Ordered from lowest to highest, each value with its source.', vehicleOptions),
  def('gellhorn-lap', 'Fastest Cars at Gellhorn International Raceway', 'Find the best GTA 6 cars for Gellhorn International Raceway by recorded stock reference lap times, with the source of each result.',
    'gellhorn_reference_lap_ms', 'asc', 'Reference lap', 'Recorded reference lap times at Gellhorn International Raceway for cars in stock form, ordered from quickest to slowest. These are vehicle reference results, separate from driver times in the Time Attack leaderboard.', vehicleOptions),
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
// Manual gate (Fausto 2026-10-09): keep noindex until Fausto has reviewed the page. Reviewed + enabled 2026-10-20 (Fausto).
export const NEW_CARS_INDEX_ENABLED = true;
export const newCarsIndexable = () => NEW_CARS_INDEX_ENABLED && newCars().length > 0 && newCarsResearchCoverage() >= NEW_CARS_MIN_COVERAGE;

// Family pages: from FAMILY_PAGE_MIN models; indexed once the family has its own copy.
export const familyCopy: Record<string, string[]> = {
  // Codex 2026-10-08, approved 2026-10-09
  dominator: [
    'The Vapid Dominator family brings several generations of Mustang-inspired design to GTA VI. The Dominator, ASP and GTX offer different coupe silhouettes, while the GT adds a convertible body. The Dominator ’67 Buggy takes the name into an off-road variant with raised suspension and oversized tires.',
    'These are separate models within the same family. Their shared name connects the designs; it does not establish equal performance or the same racing class. Top-speed and reference-lap results will allow more detailed comparisons as GTA VI testing progresses.',
  ],
};
// Manual gate (Fausto 2026-10-09): family pages stay noindex until listed here. dominator: 2026-10-20 (Fausto).
export const FAMILY_INDEX_ENABLED = new Set<string>(['dominator']);
// only officially revealed members count and are shown (leak-only vehicles stay off public pages; Codex 08.10.)
export const familyPageSlugs = () => familySlugs().filter((f) => familyMembers(f).filter((v) => v.releaseId).length >= FAMILY_PAGE_MIN);
export const familyIndexable = (f: string) => FAMILY_INDEX_ENABLED.has(f) && Boolean(familyCopy[f]?.length) && familyMembers(f).some((v) => v.releaseId);

/** Paths (relative, with trailing slash) that are noindex because data/copy is missing -> kept out of the sitemap. */
export function dataNoindexPaths(): string[] {
  return [
    ...rankings.filter((r) => !rankingIndexable(r)).map((r) => `/${r.path}`),
    ...(newCarsIndexable() ? [] : ['/cars/new-cars/']),
    ...familyPageSlugs().filter((f) => !familyIndexable(f)).map((f) => `/cars/families/${f}/`),
  ];
}
