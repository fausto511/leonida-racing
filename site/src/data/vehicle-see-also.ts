// Cross-reference sentence under a vehicle's About text (RS-0073: provisional
// duplicate Pegassi Zorrusso / GranForma Zorrusso). Copy: Codex, 2026-10-16.
export interface SeeAlso { before: string; linkText: string; id: string; after: string }
export const vehicleSeeAlso: Record<string, SeeAlso> = {
  'pegassi-zorrusso': { before: 'See the provisional ', linkText: 'GranForma Zorrusso', id: 'granforma-zorrusso', after: ' entry for the differently badged car; whether it represents a separate version or an updated identity remains unresolved.' },
  'granforma-zorrusso': { before: 'See the ', linkText: 'Pegassi Zorrusso', id: 'pegassi-zorrusso', after: ' entry for the familiar GTA Online identity; we are tracking both names provisionally while their relationship in GTA VI remains unresolved.' },
};
