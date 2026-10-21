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
  if (!state.available) return { error: 'Saving tracks is currently unavailable. Please try again later.' };
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

// ---- Ratings (DEC-0146): table track_ratings (own rows), view public_track_ratings (avg from 3 ratings).
const SAMPLE_RATE_KEY = 'lr-sample-track-ratings';
export type Ratings = { pub: Map<string, { avg: number; count: number }>; my: Map<string, number>; available: boolean };

export async function loadRatings(live: boolean, state: SavedState): Promise<Ratings> {
  if (!live) {
    let my: Record<string, number> = {};
    try { my = JSON.parse(localStorage.getItem(SAMPLE_RATE_KEY) || '{}'); } catch { /* ignore */ }
    return { pub: new Map(), my: new Map(Object.entries(my)), available: true };
  }
  const sb = getSupabase();
  const [pubRes, myRes] = await Promise.all([
    sb.from('public_track_ratings').select('track_id, rating_avg, rating_count'),
    state.driverId ? sb.from('track_ratings').select('track_id, stars').eq('driver_id', state.driverId) : Promise.resolve({ data: [], error: null }),
  ]);
  const pub = new Map(((pubRes.data ?? []) as { track_id: string; rating_avg: number; rating_count: number }[]).map((r) => [r.track_id, { avg: Number(r.rating_avg), count: Number(r.rating_count) }]));
  const my = new Map(((myRes.data ?? []) as { track_id: string; stars: number }[]).map((r) => [r.track_id, Number(r.stars)]));
  return { pub, my, available: !pubRes.error };
}

export async function rateTrack(state: SavedState, ratings: Ratings, trackId: string, stars: number, live: boolean): Promise<{ ok?: boolean; error?: string; login?: boolean }> {
  if (!live) {
    ratings.my.set(trackId, stars);
    try { localStorage.setItem(SAMPLE_RATE_KEY, JSON.stringify(Object.fromEntries(ratings.my))); } catch { /* ignore */ }
    return { ok: true };
  }
  if (!state.signedIn) return { login: true };
  if (!state.driverId) return { error: 'Your driver profile is not ready yet. Reload the page in a moment.' };
  if (!ratings.available) return { error: 'Track ratings are currently unavailable. Please try again later.' };
  const sb = getSupabase();
  const { error } = await sb.from('track_ratings').upsert({ driver_id: state.driverId, track_id: trackId, stars, updated_at: new Date().toISOString() }, { onConflict: 'driver_id,track_id' });
  if (error) return { error: 'Could not save your rating. Please try again.' };
  ratings.my.set(trackId, stars);
  const { data } = await sb.from('public_track_ratings').select('rating_avg, rating_count').eq('track_id', trackId).maybeSingle();
  if (data) ratings.pub.set(trackId, { avg: Number((data as any).rating_avg), count: Number((data as any).rating_count) });
  return { ok: true };
}

/** Discord login that comes back to the page (rating needs a login). */
export function loginToRate() {
  getSupabase().auth.signInWithOAuth({ provider: 'discord', options: { redirectTo: window.location.href.split('#')[0], scopes: 'identify email guilds.join' } });
}
