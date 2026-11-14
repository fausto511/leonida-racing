// Share images (og:image) outside the Cars area, all with the Leonida Racing mark (Fausto 14.11.2026:
// every share image carries the logo). Rendered at build time by pages/og/site/[key].jpg.ts.
// src is relative to site/. src/assets/og/* are source photos only used here.
import type { EventType } from './hub';

export const ogSitePath = (key: string) => `og/site/${key}.jpg`;
const EVENT_TYPES: EventType[] = ['race', 'time-attack', 'league', 'car-meet', 'cruise', 'other'];

export const OG_SITE: { key: string; src: string; alt: string }[] = [
  // Home, account, legal pages and every page without its own (Fausto 14.11.: real game frame, not the AI image)
  { key: 'home', src: 'src/assets/og/home.jpg', alt: 'GTA VI race cars on Gellhorn International Raceway' },
  { key: 'hub', src: 'public/images/og/og-hub.jpg', alt: 'GTA VI car meet with customized cars and drivers' },
  { key: 'gellhorn', src: 'public/images/og/og-gellhorn.jpg', alt: 'Palm-lined Gellhorn International Raceway circuit in GTA VI' },
  // Guide: Ultimate Edition Grotti Cheetah, view into the cockpit (Fausto 14.11.)
  { key: 'guide', src: 'src/assets/og/guide.jpg', alt: 'Grotti Cheetah with the door open and a red interior in GTA VI' },
  ...EVENT_TYPES.map((t) => ({ key: `event-${t}`, src: `public/images/og/og-event-${t}.jpg`, alt: '' })),
];
