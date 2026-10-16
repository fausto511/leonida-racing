// Sources shown under a vehicle's About text, for claims that rest on reporting
// rather than our own data. Codex research: "Codex Zuarbeit/Update-Pegassi-Zorrusso-2026-10-16.md".
// COPY STATUS: label "Sources" is a Claude placeholder -> Codex (DEC-0088).
export interface VehicleSource { label: string; url: string }
export const vehicleSources: Record<string, VehicleSource[]> = {
  'pegassi-zorrusso': [
    { label: 'Bloomberg, The Making of Grand Theft Auto VI (14 Oct 2026)', url: 'https://www.bloomberg.com/features/2026-grand-theft-auto-6-making-of/' },
    { label: 'RockstarINTEL (14 Oct 2026)', url: 'https://rockstarintel.com/2-more-gta-6-screenshots-released/' },
    { label: 'GTAforum.org', url: 'https://gtaforum.org/articles.html/3_gaming-news/rockstar-hands-bloomberg-new-gta-6-screenshots-including-a-mystery-granforma-car-r798/' },
  ],
  'granforma-zorrusso': [
    { label: 'Bloomberg, The Making of Grand Theft Auto VI (14 Oct 2026)', url: 'https://www.bloomberg.com/features/2026-grand-theft-auto-6-making-of/' },
    { label: 'RockstarINTEL (14 Oct 2026)', url: 'https://rockstarintel.com/2-more-gta-6-screenshots-released/' },
  ],
};
