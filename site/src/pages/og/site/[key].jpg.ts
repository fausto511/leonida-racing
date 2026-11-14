// Share images outside the Cars area, with the brand mark (see data/og-site.ts).
import type { APIRoute } from 'astro';
import { OG_SITE } from '../../../data/og-site';
import { sitePhotoCard } from '../../../lib/og-cards';

export function getStaticPaths() {
  return OG_SITE.map((o) => ({ params: { key: o.key }, props: { src: o.src } }));
}

export const GET: APIRoute = async ({ props }) => new Response(new Uint8Array(await sitePhotoCard(props.src as string)), { headers: { 'Content-Type': 'image/jpeg' } });
