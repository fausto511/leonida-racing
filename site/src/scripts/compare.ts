// Shared "compare" selection state, persisted in localStorage so marking a
// vehicle on the garage overview or on its own detail page stays in sync
// across page loads (Astro pages are separate documents, no shared JS state).
const KEY = 'gellhorn-compare-selected';

// Vehicle ids that were renamed; old ids stored in a visitor's browser are
// mapped to the new one (2026-09-30: Caracara -> Caracara 4x4).
const RENAMED: Record<string, string> = { 'vapid-caracara': 'vapid-caracara-4x4', 'karin-contender': 'vapid-contender' };

export function getSelected(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    const ids = raw ? (JSON.parse(raw) as string[]) : [];
    return [...new Set(ids.map((id) => RENAMED[id] ?? id))];
  } catch {
    return [];
  }
}

function setSelected(ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    // storage unavailable (private browsing, disabled, quota) -- selection just won't persist
  }
}

export function isSelected(id: string): boolean {
  return getSelected().includes(id);
}

// Toggles membership and returns the new state (true = now selected).
export function toggleSelected(id: string): boolean {
  const current = getSelected();
  const idx = current.indexOf(id);
  const next = idx === -1 ? [...current, id] : current.filter((x) => x !== id);
  setSelected(next);
  return next.includes(id);
}
