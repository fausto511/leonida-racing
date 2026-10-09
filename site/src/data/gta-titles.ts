// Earlier GTA titles for "New vs Returning" (Fausto 2026-10-08). Same slugs as
// the DB check vehicles_previous_games_check. Order = release order.
// Rule: a vehicle counts as returning when an earlier title had a vehicle with
// the same model name (design may differ). A missing manufacturer in old titles
// does not count as a different one (e.g. Banshee in GTA III).
export const gtaTitles: { slug: string; short: string; name: string }[] = [
  { slug: 'gta1', short: 'GTA 1', name: 'Grand Theft Auto (1997)' },
  { slug: 'gta-london-1969', short: 'London 1969', name: 'GTA: London 1969' },
  { slug: 'gta-london-1961', short: 'London 1961', name: 'GTA: London 1961' },
  { slug: 'gta2', short: 'GTA 2', name: 'Grand Theft Auto 2' },
  { slug: 'gta3', short: 'GTA III', name: 'Grand Theft Auto III' },
  { slug: 'gta-vc', short: 'GTA VC', name: 'GTA: Vice City' },
  { slug: 'gta-sa', short: 'GTA SA', name: 'GTA: San Andreas' },
  { slug: 'gta-advance', short: 'GTA Adv', name: 'GTA Advance' },
  { slug: 'gta-lcs', short: 'GTA LCS', name: 'GTA: Liberty City Stories' },
  { slug: 'gta-vcs', short: 'GTA VCS', name: 'GTA: Vice City Stories' },
  { slug: 'gta4', short: 'GTA IV', name: 'Grand Theft Auto IV' },
  { slug: 'gta4-tlad', short: 'TLAD', name: 'GTA IV: The Lost and Damned' },
  { slug: 'gta4-tbogt', short: 'TBoGT', name: 'GTA IV: The Ballad of Gay Tony' },
  { slug: 'gta-ctw', short: 'GTA CW', name: 'GTA: Chinatown Wars' },
  { slug: 'gta5', short: 'GTA V', name: 'Grand Theft Auto V' },
  { slug: 'gta-online', short: 'GTA Online', name: 'GTA Online' },
];
export const gtaTitleBySlug = Object.fromEntries(gtaTitles.map((t) => [t.slug, t]));
export const sortTitles = (slugs: string[]) => [...slugs].sort((a, b) => gtaTitles.findIndex((t) => t.slug === a) - gtaTitles.findIndex((t) => t.slug === b));

// Display grouping (Fausto 2026-10-09): expansions are shown under their game, the tooltip
// only says whether it was the main game, an expansion or both. Data stays per title.
const GROUP: Record<string, { label: string; part: 'main' | 'expansion' }> = {
  gta1: { label: 'GTA 1', part: 'main' },
  'gta-london-1969': { label: 'GTA 1', part: 'expansion' },
  'gta-london-1961': { label: 'GTA 1', part: 'expansion' },
  gta4: { label: 'GTA IV', part: 'main' },
  'gta4-tlad': { label: 'GTA IV', part: 'expansion' },
  'gta4-tbogt': { label: 'GTA IV', part: 'expansion' },
  gta5: { label: 'GTA V', part: 'main' },
  'gta-online': { label: 'GTA V', part: 'expansion' },
};
// Kept in the database, not shown on the site (Fausto 2026-10-09: GTA Advance too obscure).
const HIDDEN_ON_SITE = new Set(['gta-advance']);
export interface TitleChip { label: string; tooltip: string }
/** Grouped chips in release order, e.g. ["GTA IV" (Expansion), "GTA V" (Main game and expansion)]. */
export function groupedTitles(slugs: string[]): TitleChip[] {
  const out: { label: string; main: boolean; exp: boolean }[] = [];
  for (const s of sortTitles(slugs).filter((x) => !HIDDEN_ON_SITE.has(x))) {
    const g = GROUP[s] ?? { label: gtaTitleBySlug[s]?.short ?? s, part: 'main' as const };
    let e = out.find((x) => x.label === g.label);
    if (!e) { e = { label: g.label, main: false, exp: false }; out.push(e); }
    if (g.part === 'main') e.main = true; else e.exp = true;
  }
  // Tooltip: full game name + main game / expansion (short labels need the full name, Fausto 2026-10-09)
  const full: Record<string, string> = { 'GTA 1': 'Grand Theft Auto (1997)', 'GTA IV': 'Grand Theft Auto IV', 'GTA V': 'Grand Theft Auto V' };
  const nameOf = (label: string) => full[label] ?? gtaTitles.find((t) => t.short === label)?.name ?? label;
  return out.map((e) => ({ label: e.label, tooltip: `${nameOf(e.label)} · ${e.main && e.exp ? 'Main game and expansion' : e.exp ? 'Expansion' : 'Main game'}` }));
}
