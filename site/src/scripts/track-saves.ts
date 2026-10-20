// Saved tracks (DEC-0146, Fausto 20.10.2026): one list per driver, table public.saved_tracks
// (driver_id, track_id, created_at; RLS: own rows only). Sample tracks (no live data yet):
// saved in this browser only. If the table does not exist yet, saving reports that.
import { backendConfigured, getSupabase } from './supabase-client';

const SAMPLE_KEY = 'lr-sample-saved-tracks';
const readSample = (): string[] => { try { return JSON.parse(localStorage.getItem(SAMPLE_KEY) || '[]'); } catch { return []; } };
const writeSample = (ids: string[]) => { try { localStorage.setItem(SAMPLE_KEY, JSON.stringify(ids)); } catch { /* storage blocked */ } };

export type SavedState = { ids: Set<string>; driverId: string | null; signedIn: boolean; available: boolean };

async function driverId(): Promise<{ id: string | null; signedIn: boolean }> {
  if (!backendConfigured) return { id: null, signedIn: false };
  const sb = getSupabase();
  const { data } = await sb.auth.getSession();
  const s = data?.session;
  if (!s) return { id: null, signedIn: false };
  const own = await sb.from('drivers').select('driver_id').eq('auth_user_id', s.user.id).maybeSingle();
  return { id: (own.data as { driver_id: string } | null)?.driver_id ?? null, signedIn: true };
}

/** Saved track ids of the current driver (live) or of this browser (sample). */
export async function loadSaved(live: boolean): Promise<SavedState> {
  if (!live) return { ids: new Set(readSample()), driverId: null, signedIn: false, available: true };
  const me = await driverId();
  if (!me.id) return { ids: new Set(), driverId: null, signedIn: me.signedIn, available: true };
  const { data, error } = await getSupabase().from('saved_tracks').select('track_id').eq('driver_id', me.id);
  return { ids: new Set(((data ?? []) as { track_id: string }[]).map((r) => r.track_id)), driverId: me.id, signedIn: true, available: !error };
}

/** Toggle one track; returns the new saved state, or an error message. */
export async function toggleSaved(state: SavedState, trackId: string, live: boolean): Promise<{ saved?: boolean; error?: string; login?: boolean }> {
  const was = state.ids.has(trackId);
  if (!live) {
    const ids = new Set(readSample());
    if (was) ids.delete(trackId); else ids.add(trackId);
    writeSample([...ids]);
    state.ids = ids;
    return { saved: !was };
  }
  if (!state.signedIn) return { login: true };
  if (!state.driverId) return { error: 'Your driver profile is not ready yet. Reload the page in a moment.' };
  if (!state.available) return { error: 'Saving tracks is not switched on yet.' };
  const sb = getSupabase();
  const { error } = was
    ? await sb.from('saved_tracks').delete().eq('driver_id', state.driverId).eq('track_id', trackId)
    : await sb.from('saved_tracks').insert({ driver_id: state.driverId, track_id: trackId });
  if (error) return { error: 'That did not work. Please try again.' };
  if (was) state.ids.delete(trackId); else state.ids.add(trackId);
  return { saved: !was };
}

/** Discord login that comes back and saves the track (?save=<id>). */
export function loginToSave(trackId: string) {
  const url = new URL(window.location.href);
  url.hash = '';
  url.searchParams.set('save', trackId);
  getSupabase().auth.signInWithOAuth({ provider: 'discord', options: { redirectTo: url.toString(), scopes: 'identify email guilds.join' } });
}
