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

interface GeneratedVehicle {
  vehicle_id: string; make: string; model: string; manufacturer_logo_slug: string; classes: string[];
  seats: number | null; drive: string | null; acquisition: string | null; has_photo: boolean;
  release_id: string | null; first_seen_in: string | null; real_life_inspiration: string | null;
  first_seen_url?: string | null; first_seen_timestamp?: string | null;
  family?: string | null; previous_games?: string[] | null; sellable?: string | null;
  other_names?: string[] | null;
}
// In-game stats (0-10) and ratings shown in the GTA VI vehicle menu (RS-0074, DEC-0132).
// Prepared before launch; no values yet, so nothing displays them so far.
export type InGameMetric = 'stat_speed' | 'stat_acceleration' | 'stat_handling_asphalt' | 'stat_handling_offroad' | 'stat_strength' | 'rating_road' | 'rating_offroad';
export interface VehicleValue {
  vehicle_id: string; metric: 'price_gtad' | 'sell_price_gtad' | 'top_speed_mph' | 'gellhorn_reference_lap_ms' | InGameMetric; value: number;
  /** 'stock' (default) or 'tuned' (Fausto 2026-10-08: measure stock first, tuned later). */
  tuning?: 'stock' | 'tuned';
  source_type: 'in_game' | 'rockstar' | 'controlled_test' | 'community' | 'derived'; method: string | null;
  game_release_id: string | null; platform: string | null; measured_at: string | null; evidence_url: string | null;
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
}));

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

// Garage tile order (RS-0049, DEC-0086, Fausto 2026-09-30):
//  1. vehicles with a photo first (only matters while photos are missing;
//     once every vehicle has one, this step has no effect),
//  2. then special-access vehicles (any `acquisition`: pre-order, Ultimate Edition, GTA+, ...),
//  3. then alphabetical by model name.
// The garage never relies on the order of vehicleOptions in this file.
export function compareGarageOrder(a: VehicleOption, b: VehicleOption): number {
  return (Number(!!b.photo) - Number(!!a.photo))
    || (Number(!!b.acquisition) - Number(!!a.acquisition))
    || a.model.localeCompare(b.model, 'en', { numeric: true, sensitivity: 'base' })
    || a.make.localeCompare(b.make, 'en', { sensitivity: 'base' });
}
export const garageOrderedVehicles: VehicleOption[] = [...vehicleOptions].sort(compareGarageOrder);

// Seen in GTA VI material, in-game name NOT verified -> not on the site and
// not in the database (class/seats/drive unknown, nothing to reference it).
// Once Rockstar names it: add it to vehicleOptions with the real name, add
// the DB row, and build the photo from the source file.
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
  if (v.metric.startsWith('rating_')) return String(Math.round(v.value));
  if (v.metric === 'price_gtad' || v.metric === 'sell_price_gtad') return `GTA$ ${Math.round(v.value).toLocaleString('en-US')}`;
  if (v.metric === 'top_speed_mph') return `${v.value.toFixed(1)} mph`;
  const ms = Math.round(v.value); const m = Math.floor(ms / 60000); const s = (ms % 60000) / 1000;
  return `${m}:${s.toFixed(3).padStart(6, '0')}`;
}

// Makes without a usable logo yet (RS-0073: GranForma, only a small emblem in
// the Bloomberg screenshot). Their logo file is a transparent placeholder so
// tiles never show a broken image; the vehicle page header hides it.
export const MAKES_WITHOUT_LOGO = new Set(['granforma']);
