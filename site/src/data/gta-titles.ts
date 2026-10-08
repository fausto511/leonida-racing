// Earlier GTA titles for "New vs Returning" (Fausto 2026-10-08). Same slugs as
// the DB check vehicles_previous_games_check. Order = release order.
// Rule: a vehicle counts as returning when an earlier title had a vehicle with
// the same model name (design may differ). A missing manufacturer in old titles
// does not count as a different one (e.g. Banshee in GTA III).
export const gtaTitles: { slug: string; short: string; name: string }[] = [
  { slug: 'gta1', short: 'GTA', name: 'Grand Theft Auto (1997)' },
  { slug: 'gta-london-1969', short: 'London 1969', name: 'GTA: London 1969' },
  { slug: 'gta-london-1961', short: 'London 1961', name: 'GTA: London 1961' },
  { slug: 'gta2', short: 'GTA 2', name: 'Grand Theft Auto 2' },
  { slug: 'gta3', short: 'GTA III', name: 'Grand Theft Auto III' },
  { slug: 'gta-vc', short: 'Vice City', name: 'GTA: Vice City' },
  { slug: 'gta-sa', short: 'San Andreas', name: 'GTA: San Andreas' },
  { slug: 'gta-advance', short: 'Advance', name: 'GTA Advance' },
  { slug: 'gta-lcs', short: 'LCS', name: 'GTA: Liberty City Stories' },
  { slug: 'gta-vcs', short: 'VCS', name: 'GTA: Vice City Stories' },
  { slug: 'gta4', short: 'GTA IV', name: 'Grand Theft Auto IV' },
  { slug: 'gta4-tlad', short: 'TLAD', name: 'GTA IV: The Lost and Damned' },
  { slug: 'gta4-tbogt', short: 'TBoGT', name: 'GTA IV: The Ballad of Gay Tony' },
  { slug: 'gta-ctw', short: 'Chinatown Wars', name: 'GTA: Chinatown Wars' },
  { slug: 'gta5', short: 'GTA V', name: 'Grand Theft Auto V' },
  { slug: 'gta-online', short: 'GTA Online', name: 'GTA Online' },
];
export const gtaTitleBySlug = Object.fromEntries(gtaTitles.map((t) => [t.slug, t]));
export const sortTitles = (slugs: string[]) => [...slugs].sort((a, b) => gtaTitles.findIndex((t) => t.slug === a) - gtaTitles.findIndex((t) => t.slug === b));
