// Share images for the Cars area, rendered at build time (see data/og-cars.ts, lib/og-cards.ts).
import type { APIRoute } from 'astro';
import { allOgCards, type OgCard } from '../../../data/og-cars';
import { photoCard, textCard, heroCard } from '../../../lib/og-cards';

export function getStaticPaths() {
  return allOgCards().map((card) => ({ params: { key: card.key }, props: { card } }));
}

export const GET: APIRoute = async ({ props }) => {
  const card = props.card as OgCard;
  const buf = card.kind === 'photo' ? await photoCard(card.vehicleId)
    : card.kind === 'hero' ? await heroCard(card)
    : await textCard(card);
  return new Response(new Uint8Array(buf), { headers: { 'Content-Type': 'image/jpeg' } });
};
