// Loads which of the given drivers have the ICON role (public view public_icons, DEC-0215).
// Never throws: on any error the page simply shows no badges.
import { getSupabase } from './supabase-client';

export async function loadIconIds(ids: (string | null | undefined)[]): Promise<Set<string>> {
  const list = [...new Set(ids.filter((x): x is string => Boolean(x)))].slice(0, 300);
  const out = new Set<string>();
  if (!list.length) return out;
  try {
    const { data, error } = await getSupabase().from('public_icons').select('driver_id').in('driver_id', list);
    if (!error) for (const r of (data ?? []) as { driver_id: string }[]) out.add(r.driver_id);
  } catch { /* no badges */ }
  return out;
}
