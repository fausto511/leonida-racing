// Notification dot at the avatar (Fausto 14.11.2026, replaces the dropped Discord DMs, DEC-0208).
// my_notices() returns per account area what needs action (fix) and what is new since the
// driver last opened that area (new). Opening an area's page marks it seen (AccountHead).
// One request per page, shared by the header and the account tabs.
import { backendConfigured, getSupabase } from './supabase-client';

// 'garage' (RS-0130, Fausto 18.11.2026): cars in My garage or on the wishlist that got new stats.
export type NoticeArea = 'laps' | 'crews' | 'events' | 'tracks' | 'settings' | 'garage';
export type Notices = Record<NoticeArea, { fix: number; new: number }>;
export const NOTICE_AREAS: NoticeArea[] = ['laps', 'crews', 'events', 'tracks', 'settings', 'garage'];

/** The account area of the current page, if any (its "new" items count as seen). */
export function currentArea(): NoticeArea | null {
  const p = location.pathname.replace(/\/+$/, '/');
  if (/\/account\/$/.test(p)) return 'garage'; // My garage is the account start page
  const m = p.match(/\/account\/(laps|crew|events|tracks|settings)\/$/);
  if (!m) return null;
  return (m[1] === 'crew' ? 'crews' : m[1]) as NoticeArea;
}

let pending: Promise<Notices | null> | null = null;
export function loadNotices(force = false): Promise<Notices | null> {
  if (!backendConfigured) return Promise.resolve(null);
  if (pending && !force) return pending;
  pending = (async () => {
    const { data, error } = await getSupabase().rpc('my_notices');
    if (error || !data) return null;
    const n = data as Notices;
    const here = currentArea();
    if (here && n[here]) n[here] = { ...n[here], new: 0 }; // you are looking at it right now
    return n;
  })().catch(() => null);
  return pending;
}

export const areaCount = (n: Notices, a: NoticeArea) => (n[a]?.fix ?? 0) + (n[a]?.new ?? 0);

/** cars in My garage / on the wishlist with new stats since the last visit (for the "New stats" pill) */
export async function newStatsVehicles(): Promise<string[]> {
  if (!backendConfigured) return [];
  const { data, error } = await getSupabase().rpc('my_new_stats_vehicles');
  return error || !Array.isArray(data) ? [] : (data as string[]);
}
export const totalCount = (n: Notices) => NOTICE_AREAS.reduce((s, a) => s + areaCount(n, a), 0);

export async function markSeen(area: NoticeArea) {
  if (!backendConfigured) return;
  await getSupabase().rpc('mark_notices_seen', { p_area: area }).then(() => {}, () => {});
}
