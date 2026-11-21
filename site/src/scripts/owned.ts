// "My Garage" (RS-0032, DEC-0074): which vehicles the signed-in driver owns.
// Private -- RLS only returns the driver's own rows (table owned_vehicles).
import { backendConfigured, getSupabase } from './supabase-client';

export async function currentDriverId(): Promise<string | null> {
  if (!backendConfigured) return null;
  const sb = getSupabase();
  const { data } = await sb.auth.getSession();
  const uid = data?.session?.user?.id;
  if (!uid) return null;
  const own = await sb.from('drivers').select('driver_id').eq('auth_user_id', uid).maybeSingle();
  return (own.data?.driver_id as string) ?? null;
}

/** owned vehicle ids, oldest first (= the order the driver added them) */
export async function fetchOwnedList(): Promise<string[]> {
  if (!backendConfigured) return [];
  const { data, error } = await getSupabase().from('owned_vehicles').select('vehicle_id, created_at').order('created_at', { ascending: true });
  if (error) return [];
  return (data ?? []).map((r: { vehicle_id: string }) => r.vehicle_id);
}

export async function fetchOwned(): Promise<Set<string>> {
  return new Set(await fetchOwnedList());
}

/** true = now owned, false = now not owned; throws on error */
export async function setOwned(driverId: string, vehicleId: string, owned: boolean): Promise<boolean> {
  const sb = getSupabase();
  const { error } = owned
    ? await sb.from('owned_vehicles').upsert({ driver_id: driverId, vehicle_id: vehicleId }, { onConflict: 'driver_id,vehicle_id', ignoreDuplicates: true })
    : await sb.from('owned_vehicles').delete().eq('driver_id', driverId).eq('vehicle_id', vehicleId);
  if (error) throw error;
  return owned;
}

// ---- Garages (RS-0088, Fausto 22.11.2026): the driver marks the garages he owns in the game and
// sorts his cars into them. My cars stays unlimited; a car without a garage is simply "not in a garage".
// Strict spaces: the database refuses a car for a full garage (trigger owned_vehicle_garage_capacity,
// error "garage_full"). Removing a garage puts its cars back to "not in a garage" (FK on delete set null).

export type GarageKind = 'purchase' | 'story' | 'bonus';
export interface Garage { id: string; name: string; area: string | null; kind: GarageKind; capacity: number; unlock: string | null }

/** all garages in the game, in display order (public table) */
export async function fetchGarageCatalog(): Promise<Garage[]> {
  if (!backendConfigured) return [];
  const { data, error } = await getSupabase().from('garages').select('garage_id, name, area, kind, capacity, unlock, sort').order('sort');
  if (error) return [];
  return (data ?? []).map((g: any) => ({ id: g.garage_id, name: g.name, area: g.area, kind: g.kind, capacity: g.capacity, unlock: g.unlock }));
}

/** garage ids the signed-in driver owns */
export async function fetchMyGarages(): Promise<string[]> {
  if (!backendConfigured) return [];
  const { data, error } = await getSupabase().from('driver_garages').select('garage_id, created_at').order('created_at');
  if (error) return [];
  return (data ?? []).map((r: { garage_id: string }) => r.garage_id);
}

/** adds and removes owned garages in one go; throws on error */
export async function saveMyGarages(driverId: string, add: string[], remove: string[]): Promise<void> {
  const sb = getSupabase();
  if (add.length) {
    const { error } = await sb.from('driver_garages').upsert(add.map((garage_id) => ({ driver_id: driverId, garage_id })), { onConflict: 'driver_id,garage_id', ignoreDuplicates: true });
    if (error) throw error;
  }
  if (remove.length) {
    const { error } = await sb.from('driver_garages').delete().eq('driver_id', driverId).in('garage_id', remove);
    if (error) throw error;
  }
}

/** vehicle id -> garage id (null = not in a garage) for the driver's cars */
export async function fetchCarGarages(): Promise<Map<string, string | null>> {
  if (!backendConfigured) return new Map();
  const { data, error } = await getSupabase().from('owned_vehicles').select('vehicle_id, garage_id');
  if (error) return new Map();
  return new Map((data ?? []).map((r: { vehicle_id: string; garage_id: string | null }) => [r.vehicle_id, r.garage_id]));
}

/** puts a car into a garage (null = take it out); throws, message "garage_full" when there is no space */
export async function setCarGarage(driverId: string, vehicleId: string, garageId: string | null): Promise<void> {
  const { error } = await getSupabase().from('owned_vehicles').update({ garage_id: garageId }).eq('driver_id', driverId).eq('vehicle_id', vehicleId);
  if (error) throw error;
}

// ---- Wishlist (RS-0087, DEC-0189): cars the driver wants next. Private like
// owned_vehicles (table wishlist_vehicles). Owning a car removes it from the
// wishlist in the database itself (trigger owned_vehicle_clears_wishlist).

/** wishlisted vehicle ids, oldest first */
export async function fetchWishList(): Promise<string[]> {
  if (!backendConfigured) return [];
  const { data, error } = await getSupabase().from('wishlist_vehicles').select('vehicle_id, created_at').order('created_at', { ascending: true });
  if (error) return [];
  return (data ?? []).map((r: { vehicle_id: string }) => r.vehicle_id);
}

/** true = now on the wishlist, false = removed; throws on error */
export async function setWished(driverId: string, vehicleId: string, wished: boolean): Promise<boolean> {
  const sb = getSupabase();
  const { error } = wished
    ? await sb.from('wishlist_vehicles').upsert({ driver_id: driverId, vehicle_id: vehicleId }, { onConflict: 'driver_id,vehicle_id', ignoreDuplicates: true })
    : await sb.from('wishlist_vehicles').delete().eq('driver_id', driverId).eq('vehicle_id', vehicleId);
  if (error) throw error;
  return wished;
}
