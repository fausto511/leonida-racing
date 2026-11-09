// Moderator overview data (RS-0102 stage 1, 09.11.2026): one call to mod_overview()
// (database refuses non-moderators). Shared by the moderator navigation, the overview
// page and the header menu; loaded once per page.
import { getSupabase, backendConfigured } from './supabase-client';

export interface ModTodo {
  laps_review: number; videos_check: number; events_review: number; event_changes: number;
  requests: number; tracks: number; time_reports: number; content_reports: number;
}
export interface ModOverview {
  todo: ModTodo;
  users: { accounts: number; new_today: number; active_1: number; active_7: number; active_30: number; accounts_before: number;
    new_per_day: { day: string; n: number }[]; active_per_day: { day: string; n: number }[] };
  laps: { total: number; in_review: number; needs_correction: number; accepted: number; verified: number; rejected: number };
  cars: { ratings: number; rating_drivers: number; stars: Record<string, number>; owned: number; wishlist: number };
  community: { crews: number; events_upcoming: number; signups: number; feeds: number; feeds_by_source: Record<string, number> };
  at: string;
}

let p: Promise<ModOverview | null> | null = null;
/** null = not logged in, not a moderator or no backend. */
export function loadModOverview(): Promise<ModOverview | null> {
  if (p) return p;
  p = (async () => {
    if (!backendConfigured) return null;
    const sb = getSupabase();
    const { data: s } = await sb.auth.getSession();
    if (!s?.session) return null;
    const { data, error } = await sb.rpc('mod_overview');
    return error ? null : (data as ModOverview);
  })().catch(() => null);
  return p;
}

export const todoTotal = (t: ModTodo) => Object.values(t).reduce((a, b) => a + (Number(b) || 0), 0);
