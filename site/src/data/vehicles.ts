// Vehicle types + helpers. The data itself comes from Supabase (see below).
export interface VehicleOption {
  id: string;
  classes: string[];
  make: string;
  model: string;
  logoSlug: string;
  seats: number;
  drive: string;
  // Release metadata (RS-0047, DEC-0084; mirrors public.vehicles in Supabase).
  // releaseId -> data/releases.ts (game_releases): the content release that adds
  // the vehicle (Base Game, later updates/DLCs); release date comes from there.
  // Unset = not officially announced (leak-only) -> shown as "TBA".
  releaseId?: string;
  firstSeenIn?: string; // earliest official appearance; unset for leak-only vehicles
  // Official Rockstar source for firstSeenIn (YouTube with &t= or rockstargames.com) and the m:ss
  // inside the video; only set where verified (Codex 2026-10-06, 17 of 100).
  firstSeenUrl?: string;
  firstSeenTimestamp?: string;
  realLifeInspiration?: string; // one editorially chosen real-world model
  // Access requirement, independent of releaseId (a launch car can still need the Ultimate Edition):
  acquisition?: 'pre-order' | 'ultimate-edition' | 'gta-plus';
  // true = a garage photo exists at public/images/vehicles/<id>-{640,1280,1920}.webp
  // (made from "Visual/Cars/<Make Model> Garage.jpg", 2026-09-30).
  photo?: boolean;
  // Model family slug (Fausto 2026-10-08), e.g. 'dominator'; set by hand in Moderator > Vehicles.
  family?: string;
  // Earlier GTA titles with the same model name (see data/gta-titles.ts).
  // undefined = not researched yet; [] = new in GTA VI.
  previousGames?: string[];
  // Can it be sold in-game? undefined = unknown.
  sellable?: 'yes' | 'no';
  // Other names (earlier games, unconfirmed names, spellings; RS-0074, DEC-0132).
  // Search only -- never shown as the official name, which is always `model`.
  otherNames?: string[];
  // In-game info from the vehicle menu (Tuning garage, Fausto 19.11.2026). Unset = not recorded yet.
  // gameType is internal for now (check against classes); era/storage/nitrous are meant for the car page.
  gameType?: string;
  era?: string;
  storage?: number;
  // Pickups: seats in the cab only; seats = with an empty bed (+2 in the bed). DEC-0258.
  seatsCab?: number;
  nitrous?: boolean;
  // scanner info (Fausto 21./23.11.2026): mod shop specialist, tracker, whether the Key Cloner is needed
  specialist?: string;
  tracker?: string;
  keyCloner?: boolean;
}

// RULE (Fausto, 2026-09-30): vehicleOptions lists ONLY vehicles whose GTA VI
// in-game name is verified (exception: Übermacht Sentinel Classic Cabrio).
// Everything here is public: garage, vehicle pages, sitemap, submit form,
// compare. Cars seen in GTA VI material whose in-game name is still unknown
// go into unverifiedVehicles below instead -- never shown on the site.

// RS-0052 (DEC-0089): vehicle data comes from the database (single source).
// vehicles.generated.json is written by site/scripts/fetch-vehicles.mjs before
// every CI build; edit vehicles in Moderator > Vehicles, never in this file.
import generated from './vehicles.generated.json';
import { speedHtml } from './units';

interface GeneratedVehicle {
  vehicle_id: string; make: string; model: string; manufacturer_logo_slug: string; classes: string[];
  seats: number | null; drive: string | null; acquisition: string | null; has_photo: boolean;
  release_id: string | null; first_seen_in: string | null; real_life_inspiration: string | null;
  first_seen_url?: string | null; first_seen_timestamp?: string | null;
  family?: string | null; previous_games?: string[] | null; sellable?: string | null;
  other_names?: string[] | null;
  game_type?: string | null; era?: string | null; storage?: number | null; seats_cab?: number | null; nitrous_available?: boolean | null;
  specialist?: string | null; tracker?: string | null; key_cloner_required?: boolean | null;
  updated_at?: string | null;
}
// In-game stats (0-10) and ratings shown in the GTA VI vehicle menu (RS-0074, DEC-0132).
// Prepared before launch; no values yet, so nothing displays them so far.
export type InGameMetric = 'stat_speed' | 'stat_acceleration' | 'stat_handling_asphalt' | 'stat_handling_offroad' | 'stat_strength' | 'rating_road' | 'rating_offroad'
  // Nitrous boost per car: the blue plus in the tuning preview, not part of the ratings (19.11.2026).
  | 'boost_speed' | 'boost_acceleration';
export interface VehicleValue {
  vehicle_id: string; metric: 'price_gtad' | 'sell_price_gtad' | 'register_cost_gtad' | 'top_speed_mph' | 'gellhorn_reference_lap_ms' | InGameMetric; value: number;
  /** 'stock' (default) or 'tuned' (Fausto 2026-10-08: measure stock first, tuned later). */
  tuning?: 'stock' | 'tuned';
  source_type: 'in_game' | 'rockstar' | 'controlled_test' | 'community' | 'derived'; method: string | null;
  game_release_id: string | null; platform: string | null; measured_at: string | null; evidence_url: string | null;
  /** body condition in the scanner when read (sell values, DEC-0248); null = not condition-dependent */
  condition?: string | null;
}

export const vehicleOptions: VehicleOption[] = (generated.vehicles as GeneratedVehicle[]).map((v) => ({
  id: v.vehicle_id,
  classes: v.classes,
  make: v.make,
  model: v.model,
  logoSlug: v.manufacturer_logo_slug,
  seats: v.seats ?? 0,
  drive: v.drive ?? 'n/a',
  ...(v.acquisition ? { acquisition: v.acquisition as VehicleOption['acquisition'] } : {}),
  ...(v.has_photo ? { photo: true } : {}),
  ...(v.release_id ? { releaseId: v.release_id } : {}),
  ...(v.first_seen_in ? { firstSeenIn: v.first_seen_in } : {}),
  ...(v.first_seen_url ? { firstSeenUrl: v.first_seen_url } : {}),
  ...(v.first_seen_timestamp ? { firstSeenTimestamp: v.first_seen_timestamp } : {}),
  ...(v.real_life_inspiration ? { realLifeInspiration: v.real_life_inspiration } : {}),
  ...(v.family ? { family: v.family } : {}),
  ...(Array.isArray(v.previous_games) ? { previousGames: v.previous_games } : {}),
  ...(v.sellable === 'yes' || v.sellable === 'no' ? { sellable: v.sellable } : {}),
  ...(v.other_names?.length ? { otherNames: v.other_names } : {}),
  ...(v.game_type ? { gameType: v.game_type } : {}),
  ...(v.era ? { era: v.era } : {}),
  ...(v.storage != null ? { storage: v.storage } : {}),
  ...(v.seats_cab != null && v.seats != null && v.seats_cab < v.seats ? { seatsCab: v.seats_cab } : {}),
  ...(v.nitrous_available != null ? { nitrous: v.nitrous_available } : {}),
  ...(v.specialist ? { specialist: v.specialist } : {}),
  ...(v.tracker ? { tracker: v.tracker } : {}),
  ...(v.key_cloner_required != null ? { keyCloner: v.key_cloner_required } : {}),
}));

/** Model name for tight spots (tiles, chips): adds the make when another car shares the model name,
 *  e.g. Pegassi Zorrusso / GranForma Zorrusso (Fausto 20.10., DEC-0145). */
const modelCount = new Map<string, number>();
vehicleOptions.forEach((v) => modelCount.set(v.model, (modelCount.get(v.model) ?? 0) + 1));
export const shortModelName = (v: { make: string; model: string }) => ((modelCount.get(v.model) ?? 0) > 1 ? `${v.make} ${v.model}` : v.model);

// Current measured values per vehicle (price, top speed, reference lap), each
// with its provenance. Missing = not measured yet ("Data pending").
// vehicleValues = stock values (what pages and rankings show first);
// vehicleValuesTuned = fully tuned values, added later (Fausto 2026-10-08).
export const vehicleValues: Record<string, Partial<Record<VehicleValue['metric'], VehicleValue>>> = {};
export const vehicleValuesTuned: Record<string, Partial<Record<VehicleValue['metric'], VehicleValue>>> = {};
for (const val of generated.values as VehicleValue[]) {
  const target = val.tuning === 'tuned' ? vehicleValuesTuned : vehicleValues;
  (target[val.vehicle_id] ??= {})[val.metric] = { ...val, value: Number(val.value) };
}

/** Sell values depend on the car's body condition (Fausto 23.11.2026, DEC-0248): one stock value per
 *  condition, best condition first. Only values with a recorded condition are shown. */
export const CONDITIONS = ['Top', 'Good', 'Average', 'Poor', 'Scrap'] as const;
export const vehicleSellValues: Record<string, VehicleValue[]> = {};
for (const val of generated.values as VehicleValue[]) {
  if (val.metric !== 'sell_price_gtad' || val.tuning === 'tuned' || !val.condition) continue;
  (vehicleSellValues[val.vehicle_id] ??= []).push({ ...val, value: Number(val.value) });
}
for (const list of Object.values(vehicleSellValues)) list.sort((a, b) => CONDITIONS.indexOf(a.condition as any) - CONDITIONS.indexOf(b.condition as any));
const usd0 = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
/** "$1,000 · Poor condition" (one scan) or "$4,000–6,650" + "Average to Top" (several); null = none.
 *  COPY: Claude placeholder 23.11.2026 (Codex review open). */
export function sellValueText(id: string): { main: string; sub: string; max: number } | null {
  const list = vehicleSellValues[id];
  if (!list?.length) return null;
  const vals = list.map((v) => v.value);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  if (list.length === 1) return { main: usd0(hi), sub: `${list[0].condition} condition`, max: hi };
  return { main: lo === hi ? usd0(hi) : `${usd0(lo)}–${usd0(hi).slice(1)}`, sub: `${list[list.length - 1].condition} to ${list[0].condition} condition`, max: hi };
}

/** Sitemap lastmod per vehicle page (04.11.2026): latest of the vehicle row's
 *  updated_at and the measured_at of its current values. Missing (e.g. an older
 *  committed JSON without updated_at) = no lastmod for that page. */
export const vehicleLastmod: Record<string, string> = {};
for (const v of generated.vehicles as GeneratedVehicle[]) {
  if (v.updated_at) vehicleLastmod[v.vehicle_id] = v.updated_at;
}
for (const val of generated.values as VehicleValue[]) {
  if (!val.measured_at) continue;
  const cur = vehicleLastmod[val.vehicle_id];
  if (!cur || new Date(val.measured_at) > new Date(cur)) vehicleLastmod[val.vehicle_id] = val.measured_at;
}

// Fastest accepted Gellhorn lap per car (from public_leaderboard_ranks, fetched
// before the build; empty until real laps exist). Port phase 0, 2026-10-14.
const GELLHORN = 'gellhorn-international-raceway';
const fastestLap = new Map<string, number>();
for (const l of ((generated as { laps?: { track_id: string; vehicle_id: string; lap_time_ms: number }[] }).laps ?? [])) {
  if (l.track_id === GELLHORN) fastestLap.set(l.vehicle_id, Number(l.lap_time_ms));
}
export const fastestGellhornLapMs = (id: string): number | null => fastestLap.get(id) ?? null;

/** Image band motif for class / manufacturer / ranking pages (Fausto 2026-10-14):
 *  the car with the fastest Gellhorn lap among `list` that has a photo; else the
 *  first car with a photo; null = use the garage placeholder image.
 *  Prepared for the redesign, not rendered anywhere yet. */
export function bandVehicle(list: VehicleOption[]): VehicleOption | null {
  const withPhoto = list.filter((v) => v.photo);
  const timed = withPhoto.filter((v) => fastestLap.has(v.id)).sort((a, b) => fastestLap.get(a.id)! - fastestLap.get(b.id)!);
  return timed[0] ?? withPhoto[0] ?? null;
}

// Model families (Fausto 2026-10-08): other members of the same family, any class.
// A family gets its own page from FAMILY_PAGE_MIN models on.
export const FAMILY_PAGE_MIN = 5;
export const familyMembers = (family: string) => vehicleOptions.filter((v) => v.family === family);
export function familyName(family: string): string {
  // Display name = the shared model name of the family's members, e.g. "Dominator".
  const members = familyMembers(family);
  const words = members.map((m) => m.model.split(' ')[0]);
  return words.length ? words.sort((a, b) => a.length - b.length)[0] : family.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
export const familySlugs = () => [...new Set(vehicleOptions.map((v) => v.family).filter((f): f is string => Boolean(f)))];

// Garage tile order (RS-0049, DEC-0086; changed Fausto 2026-11-24):
//  1. vehicles with in-game stats first: all five stats, then some, then none,
//  2. then vehicles with a photo,
//  3. then alphabetical by model name.
// (Until 24.11. step 1 was "special-access vehicles first", because only those had photos.)
// The garage never relies on the order of vehicleOptions in this file.
const STAT_KEYS = ['stat_speed', 'stat_acceleration', 'stat_handling_asphalt', 'stat_handling_offroad', 'stat_strength'] as const;
function statTier(v: VehicleOption): number {
  const r = vehicleValues[v.id];
  const n = r ? STAT_KEYS.filter((k) => r[k]).length : 0;
  return n === STAT_KEYS.length ? 2 : n > 0 ? 1 : 0;
}
export function compareGarageOrder(a: VehicleOption, b: VehicleOption): number {
  return (statTier(b) - statTier(a))
    || (Number(!!b.photo) - Number(!!a.photo))
    || a.model.localeCompare(b.model, 'en', { numeric: true, sensitivity: 'base' })
    || a.make.localeCompare(b.make, 'en', { sensitivity: 'base' });
}
export const garageOrderedVehicles: VehicleOption[] = [...vehicleOptions].sort(compareGarageOrder);

// Seen in GTA VI material, in-game name NOT verified -> not on the site and
// not in the database (class/seats/drive unknown, nothing to reference it).
// Once Rockstar names it: add it to vehicleOptions with the real name, add
// the DB row, and build the photo from the source file.
// ---------------------------------------------------------------------------
// New stats (RS-0130, Fausto 18.11.2026): home page "Fresh in the database",
// "Stats updated" on the vehicle page, and data-stats-at for the Discord feed
// (the dispatcher posts only once the car page carries the new stats).
// ---------------------------------------------------------------------------
type Stamped = VehicleValue & { created_at?: string | null };
type Previous = { vehicle_id: string; metric: VehicleValue['metric']; tuning?: string | null; value: number; created_at: string };
const stamped = (generated.values as Stamped[]).filter((v) => v.created_at);
const previous = ((generated as { previous?: Previous[] }).previous ?? []);

/** newest created_at of the current values per vehicle (ISO, as the database sent it) */
export const vehicleStatsAt: Record<string, string> = {};
for (const v of stamped) {
  const cur = vehicleStatsAt[v.vehicle_id];
  if (!cur || Date.parse(v.created_at!) > Date.parse(cur)) vehicleStatsAt[v.vehicle_id] = v.created_at!;
}

export interface StatChange { metric: VehicleValue['metric']; tuning: 'stock' | 'tuned'; value: VehicleValue; prev: VehicleValue | null }
export interface StatsUpdate { vehicle: VehicleOption; at: string; changes: StatChange[]; isNew: boolean }
const optById = new Map(vehicleOptions.map((v) => [v.id, v]));
const METRIC_ORDER: VehicleValue['metric'][] = ['top_speed_mph', 'register_cost_gtad', 'price_gtad', 'gellhorn_reference_lap_ms', 'sell_price_gtad',
  'stat_speed', 'stat_acceleration', 'stat_handling_asphalt', 'stat_handling_offroad', 'stat_strength', 'rating_road', 'rating_offroad',
  'boost_speed', 'boost_acceleration'];

/** Latest updates, one entry per car (its values from the last 24 h before its newest value), newest first. */
export const statsFeed: StatsUpdate[] = Object.entries(vehicleStatsAt)
  .map(([id, at]) => {
    const vehicle = optById.get(id);
    if (!vehicle?.releaseId) return null; // only officially shown cars have a page worth pointing to
    const from = Date.parse(at) - 24 * 3600e3;
    const changes: StatChange[] = stamped
      .filter((v) => v.vehicle_id === id && Date.parse(v.created_at!) >= from)
      .map((v) => {
        const tuning = v.tuning === 'tuned' ? 'tuned' : 'stock';
        const p = previous.find((x) => x.vehicle_id === id && x.metric === v.metric && (x.tuning ?? 'stock') === tuning
          && Date.parse(x.created_at) < Date.parse(v.created_at!));
        return { metric: v.metric, tuning, value: { ...v, value: Number(v.value) }, prev: p ? { ...v, value: Number(p.value) } : null } as StatChange;
      })
      .sort((a, b) => METRIC_ORDER.indexOf(a.metric) - METRIC_ORDER.indexOf(b.metric) || a.tuning.localeCompare(b.tuning));
    return { vehicle, at, changes, isNew: changes.every((c) => !c.prev) };
  })
  .filter((x): x is StatsUpdate => !!x && x.changes.length > 0)
  .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

/** automatic counters for the home page (never typed into a text, Fausto 16.11.) */
export const statsTotals = {
  cars: new Set(stamped.filter((v) => optById.get(v.vehicle_id)?.releaseId).map((v) => v.vehicle_id)).size,
  values: stamped.filter((v) => optById.get(v.vehicle_id)?.releaseId).length,
  lastAt: statsFeed[0]?.at ?? null,
};

/** short label of a metric for chips (Codex review 18.11. decided by Fausto; same names in discord-dispatch METRIC_LABEL) */
export const statLabels: Record<VehicleValue['metric'], string> = {
  price_gtad: 'Price', sell_price_gtad: 'Sell value', top_speed_mph: 'Top speed', gellhorn_reference_lap_ms: 'Gellhorn lap',
  stat_speed: 'Speed', stat_acceleration: 'Acceleration', stat_handling_asphalt: 'Asphalt handling', stat_handling_offroad: 'Off-road handling',
  stat_strength: 'Strength', rating_road: 'Road rating', rating_offroad: 'Off-road rating',
  // COPY: Claude placeholder 23.11.2026 (Codex review open). "Cost to register" is the in-game scanner wording.
  register_cost_gtad: 'Cost to register', boost_speed: 'Boost speed', boost_acceleration: 'Boost acceleration',
};

/** GTA VI has no car dealers: cars are stolen and registered (Fausto 23.11.2026, DEC-0247). The money value
 *  shown wherever the site used to show a price is the in-game "Cost to register". price_gtad stays in the
 *  database for a possible purchase price in GTA Online, but nothing displays it. */
export const COST_METRIC = 'register_cost_gtad' as const;
export const COST_LABEL = 'Cost to register'; // COPY: Claude placeholder 23.11.2026 (in-game wording)
export const isMoneyMetric = (m: string) => m.endsWith('_gtad');

export interface UnverifiedVehicle { workingId: string; basedOn: string; photoSource: string; note: string }
export const unverifiedVehicles: UnverifiedVehicle[] = [
  { workingId: "unnamed-kellison-j4-inspired", basedOn: "Kellison J4 (1960s US kit sports car)", photoSource: "Visual/Cars/Kellison J4 Garage.jpg", note: "GTA Wiki lists it as a Kellison J4-inspired car without in-game name or manufacturer (checked 2026-09-30)." },
];

// Display helpers for measured values (RS-0052)
export const valueSourceLabels: Record<VehicleValue['source_type'], string> = {
  in_game: 'In-game', rockstar: 'Rockstar', controlled_test: 'Measured', community: 'Community', derived: 'Calculated',
};
export function formatVehicleValue(v: VehicleValue): string {
  if (v.metric.startsWith('stat_')) return v.value.toFixed(1);
  if (v.metric.startsWith('boost_')) return `+${v.value.toFixed(1)}`;
  if (v.metric.startsWith('rating_')) return String(Math.round(v.value));
  if (isMoneyMetric(v.metric)) return `GTA$ ${Math.round(v.value).toLocaleString('en-US')}`;
  if (v.metric === 'top_speed_mph') return `${v.value.toFixed(1)} mph`;
  const ms = Math.round(v.value); const m = Math.floor(ms / 60000); const s = (ms % 60000) / 1000;
  return `${m}:${s.toFixed(3).padStart(6, '0')}`;
}
/** same as formatVehicleValue, but speeds in both units (DEC-0197; render with set:html) */
export function formatVehicleValueHtml(v: VehicleValue): string {
  if (v.metric === 'top_speed_mph') return speedHtml(v.value, 1, 1);
  return formatVehicleValue(v).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
}

// Makes without a usable logo yet. Their logo file is a transparent placeholder so
// tiles never show a broken image; the vehicle page header hides it.
// GranForma has a placeholder badge by Fausto since 25.11.2026 (not the original logo).
export const MAKES_WITHOUT_LOGO = new Set(['piccia', 'sirius', 'ascot']);
