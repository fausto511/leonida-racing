import { vehicleOptions } from './vehicles';
// The Guide (/guide/), sourced overview of GTA VI cars, driving, ownership,
// customization, racing and car culture.
// COPY STATUS: Codex 2026-10-02 (Codex Zuarbeit/The-Guide-Website-Texte-und-Quellen-2026-10-02.md),
// approved by Fausto 2026-10-03 with Claude's corrections:
// Dazed staging link replaced with the public URL; "The Lab" line and the
// "See All Confirmed Mod Shops" CTA removed (no target page yet).
// Non-car vehicles: at most 1–2 incidental sentences (Fausto, DEC-0097); no own section.
// Codex corrections 2026-10-03 (Codex Zuarbeit/The-Guide-Korrekturen-2026-10-03.md) applied:
// one label set, Famitsu ownership facts, Garage scope, ~200 vehicle card.
// Internal links FROM the Guide: Claude decides (Fausto, 2026-10-03, DEC-0095).
// Links TO the Guide on other pages: Codex proposes, Fausto approves.
// Redesign 18.10.2026: "The Garage" -> "Cars", "The Hub" -> "Community" in links/copy (Claude placeholders, Codex review, DEC-0088).
// Launch update 20.11.2026: Codex copy (Codex Zuarbeit/Guide-Launch-Update-Nachbesserung-2026-11-19.md) with Fausto's choices;
// GranForma/Emperor/Piccia sentences + FAQ = Claude placeholders (Codex review pending, DEC-0088).
// Never add leak information here. Visible text: "GTA VI"; meta: "GTA 6".

/** Date shown as "Last updated" and used as dateModified. Change on every content update. */
// Bump on EVERY content change to the Guide (visible as "Last updated" + Article dateModified) — Fausto 27.10.2026.
export const GUIDE_UPDATED = '2026-11-22';
export const GUIDE_PUBLISHED = '2026-10-03';

export interface GuideSource { label: string; url: string; note: string }
/** Source card parts: label = "Publisher — Title". Origin pill derived from the publisher (Claude, 18.10.2026, DEC-0140):
 *  Rockstar's own channels = official, fan sites/databases = community, everything else = press. */
export type SourceKind = 'official' | 'press' | 'community' | 'tested';
const OFFICIAL = ['Rockstar Games', 'Rockstar Newswire', 'Rockstar Support'];
const COMMUNITY = ['GTABase', 'RockstarINTEL', 'TGG', 'PowerPyx'];
export function sourceParts(src: GuideSource): { publisher: string; title: string; kind: SourceKind } {
  const i = src.label.indexOf(' — ');
  const publisher = i > 0 ? src.label.slice(0, i) : src.label;
  const title = i > 0 ? src.label.slice(i + 3) : src.label;
  const kind: SourceKind = publisher === 'Leonida Racing' ? 'tested' : OFFICIAL.includes(publisher) ? 'official' : COMMUNITY.includes(publisher) ? 'community' : 'press';
  return { publisher, title, kind };
}
/** Status pill colour per evidence level (DEC-0140): Rockstar-sourced = lime, identification/report = orange, open = grey. */
export function statusTone(status: string): 'ok' | 'mid' | 'open' {
  if (/^Not Confirmed/i.test(status)) return 'open';
  if (/Community|Reported/i.test(status)) return 'mid';
  return 'ok';
}
/** Images in public/images/guide/<key>-<width>.webp (Fausto's selection, Visual/Guide, 2026-10-03).
 *  Cars only, no boats or aircraft (Fausto). Alt texts/captions: Codex 2026-10-03, approved; Rideout alt names
 *  the Albany Manana (Fausto, 2026-10-04; Codex had 'convertible'). */
export interface GuideImage { key: string; widths: number[]; w: number; h: number; alt: string; caption: string; src?: { label: string; url: string } }
const W3 = [640, 1280, 1920];
const RS = 'Official screenshot — Rockstar Games.';
// Returning vs new cars, computed from the database at build time (Fausto 27.10.2026).
// Only revealed cars whose earlier GTA appearances have been reviewed are counted.
const RETURNING_SENTENCE = (() => {
  const rev = vehicleOptions.filter((v) => v.releaseId && Array.isArray(v.previousGames));
  const fromV = rev.filter((v) => v.previousGames!.some((g) => g === 'gta5' || g === 'gta-online')).length;
  const older = rev.filter((v) => v.previousGames!.length > 0 && !v.previousGames!.some((g) => g === 'gta5' || g === 'gta-online')).length;
  const fresh = rev.filter((v) => v.previousGames!.length === 0).length;
  if (!rev.length || fromV * 2 <= rev.length) return '';
  const olderPart = older === 0 ? '' : older === 1 ? ', one returns from an older GTA game,' : `, ${older} return from older GTA games,`;
  const freshPart = fresh === 1 ? 'one is <a href="{base}cars/new-cars/">new to the series</a>' : `${fresh} are <a href="{base}cars/new-cars/">new to the series</a>`;
  return ` Most of the cars revealed so far are returning faces: of the ${rev.length} revealed cars in our database, ${fromV} appeared in GTA V or GTA Online${olderPart}${older ? '' : ','} and ${freshPart}.`;
})();

// Linked image sources (Fausto 27.10.2026): video frames with timestamp, screenshots to the publishing page.
const XL = 'https://www.youtube.com/watch?v=tJbzMqJGH4k';
const RS_SHOTS = { label: 'View gallery', url: 'https://www.rockstargames.com/VI/media/screenshots' };
const atXL = (sec: number, t: string) => ({ label: `Watch at ${t}`, url: `${XL}&t=${sec}s` });
const IMG_SRC: Record<string, { label: string; url: string }> = {
  granforma: { label: 'Bloomberg feature', url: 'https://www.bloomberg.com/features/2026-grand-theft-auto-6-making-of/' },
  driving: atXL(923, '15:23'),
  'heat-outfit': atXL(1069, '17:49'),
  'heat-police': atXL(943, '15:43'),
  safehouse: RS_SHOTS, 'dominator-buggy-garage': RS_SHOTS, 'rideout-customs': RS_SHOTS, 'one-eyed-willies': RS_SHOTS,
  'classic-collection-wyman': RS_SHOTS, 'classic-collection-car': RS_SHOTS, 'hero-cheetah': RS_SHOTS,
  'slim-jim': atXL(364, '6:04'),
  'circuit-race': atXL(1061, '17:41'),
  'street-race': atXL(1221, '20:21'),
  'car-meet': atXL(1566, '26:06'),
  'vehicles-ocean-drive': { label: 'Watch in Trailer 1 at 0:32', url: 'https://www.youtube.com/watch?v=QdBZY2fkU-0&t=32s' },
  'vehicles-cheetah-cockpit': RS_SHOTS,
  'circuit-empty': { label: 'Original at 17:46', url: `${XL}&t=1066s` },
  'street-takeover': { label: 'Watch in Trailer 1 at 0:45', url: 'https://www.youtube.com/watch?v=QdBZY2fkU-0&t=45s' },
};
const img = (key: string, widths: number[], w: number, h: number, alt: string, caption: string): GuideImage => ({ key, widths, w, h, alt, caption, src: IMG_SRC[key] });
const IMG = {
  // Vehicles pair (Fausto 27.10.2026): Visual/Crews and Events/carmeet3.jpg (Trailer 1, 0:32) + Cheetah cockpit (former guide band, Rockstar screenshot). Alt/captions: Claude placeholders -> Codex.
  vehiclesStreet: img('vehicles-ocean-drive', W3, 1920, 1080, 'Sports cars and classics lined up on a neon-lit beachfront street at dusk in GTA VI.', 'Cars lined up on a Vice City street — Rockstar Games.'),
  vehiclesCockpit: img('vehicles-cheetah-cockpit', [640, 1280, 1672], 1672, 940, 'The red interior of a white Grotti Cheetah ’95, seen through its open driver’s door, in GTA VI.', `Grotti Cheetah ’95, Ultimate Edition. ${RS}`),
  // Visual/Cars/Garage/granforma-zorrusso.png, 2000x1125 (web exports = vehicles/granforma-zorrusso-*.webp).
  granforma: img('granforma', W3, 2000, 1125, 'Rear three-quarter view of a green sports car in GTA VI, with GranForma lettering and an emblem above the rear grille.', 'New rear branding on the car identified as the GranForma Zorrusso. The name’s exact role remains unconfirmed. Rockstar Games image published with Bloomberg’s October 14 feature.'),
  // Visual/Heat/heat.png + heat2.png, 1800x1013, screenshots from the Extended Look (Fausto 17.10.). Alt/caption: Claude placeholders -> Codex (DEC-0088).
  // Visual/Guide/change-clothes.png, Extended Look 17:49 (Fausto 27.10.2026). Alt/caption: Claude placeholders -> Codex.
  heatOutfit: img('heat-outfit', [640, 1280, 1800], 1800, 1012, 'An in-game menu for switching headwear, glasses and outfits, with Rod’s Racing Cap highlighted, in GTA VI.', 'Switching headwear and outfits from the item menu — Rockstar Games.'),
  heatPolice: img('heat-police', [640, 1280, 1800], 1800, 1013, 'Several police cars with flashing lights near a sunlit city intersection in GTA VI.', 'From Grand Theft Auto VI: An Extended Look — Rockstar Games.'),
  driving: img('driving', [640, 1280], 1280, 720, 'A dark sedan turns across a city street with smoke around its tires in GTA VI.', 'GTA VI gameplay — Rockstar Games.'),
  slimJim: img('slim-jim', [640, 1280], 1280, 720, 'A character stands beside a red parked car with “Slim Jim” and “Smash Window” prompts on screen in GTA VI.', 'On-screen theft options in GTA VI gameplay — Rockstar Games.'),
  // Ownership pair (Fausto, 2026-10-04): safehouse with Jason's Ganado + Buggy at a garage. Alt/captions: Claude placeholders, Codex review pending.
  safehouse: img('safehouse', W3, 1920, 1080, 'Jason’s stilt house on the water with a yellow Ganado pickup parked in front in GTA VI.', `Jason’s Safehouse Vehicles, Ultimate Edition. ${RS}`),
  buggy: img('dominator-buggy-garage', W3, 1920, 1080, 'The ’67 Vapid Dominator Buggy parked in front of an open garage door in GTA VI.', `’67 Vapid Dominator Buggy, Ultimate Edition. ${RS}`),
  rideout: img('rideout-customs', W3, 1920, 1080, 'A mechanic works beneath a yellow Albany Manana while another stands beside it in a GTA VI workshop.', `Rideout Customs Mod Shop, Ultimate Edition. ${RS}`),
  willies: img('one-eyed-willies', W3, 1920, 1080, 'Mechanics work around a bright green pickup with its hood raised in a GTA VI workshop.', `One-Eyed Willie’s Mod Shop, Ultimate Edition. ${RS}`),
  wyman: img('classic-collection-wyman', W3, 1920, 1080, 'Wyman holds a wrench beside classic cars and workshop tools in a yard in GTA VI.', `Wyman and the Classic Car Collection, Ultimate Edition. ${RS}`),
  classicCar: img('classic-collection-car', W3, 1920, 1080, 'A turquoise Sirius Transgressor ’67 coupe with black side stripes and a rear spoiler, viewed from behind in GTA VI.', `Sirius Transgressor ’67 from the Classic Car Collection, Ultimate Edition. ${RS}`),
  circuitRace: img('circuit-race', [640, 1280, 1672], 1672, 941, 'A pack of race cars on a wet, palm-lined circuit in GTA VI.', 'Circuit racing in GTA VI — Rockstar Games.'),
  streetRace: img('street-race', [640, 1280], 1280, 720, 'Customized cars race along a street at sunset, with a blue exhaust flame behind the nearest car in GTA VI.', 'Street racing in GTA VI — Rockstar Games.'),
  // Visual/locations/Gellhorn International Raceway/gellhorn rent chavos xs.png, 3840x2160, Fausto 22.11.2026 (own PS5 screenshot).
  statsChavos: img('gellhorn-rental-chavos-xs', W3, 1920, 1080, 'A white, red, and blue race-prepared Dinka Chavos XS in the Gellhorn paddock, next to its stat panel with five stat bars and its road and off-road ratings, in GTA VI.', 'The race-prepared Chavos XS rental at Gellhorn and its stat panel. Leonida Racing in-game screenshot (PS5).'),
  circuitEmpty: img('circuit-empty', [640, 1280, 1672], 1672, 941, 'An empty race circuit lined with palms, fencing, and blue and red painted trackside areas in GTA VI.', 'The circuit from official GTA VI footage, with the race cars digitally removed for a clearer view of the track.'),
  carMeet: img('car-meet', [640, 1280, 1919], 1919, 1079, 'People gather beside customized cars at an outdoor parking-lot meet in GTA VI.', 'A car meet in GTA VI — Rockstar Games.'),
  takeover: img('street-takeover', [640, 1280, 1672], 1672, 941, 'A crowd surrounds cars and tire smoke at a nighttime street takeover in GTA VI, viewed from above.', 'A street takeover in GTA VI — Rockstar Games.'),
};
// Share image = og/site/guide.jpg, Ultimate Edition Grotti Cheetah cockpit (Fausto 14.11.2026, data/og-site.ts); the band is the Launch Trailer night race (1:03).
export const guideHeroImage = IMG.circuitRace;

export interface GuideSection {
  id: string;
  /** 1–2 images, shown after the first paragraph */
  images?: GuideImage[];
  title: string;
  status?: string;
  paragraphs: string[]; // trusted HTML (<strong>, internal <a href="{base}…">)
  cta?: { label: string; href: string };
  /** optional table after the paragraphs (cells: trusted HTML) */
  table?: { caption: string; head: string[]; rows: string[][] };
  sourcesHeading?: string;
  sources: GuideSource[];
}

const IGN_FULL = 'https://www.ign.com/articles/gta-6-the-big-interview';
const LAUNCH = 'https://www.youtube.com/watch?v=rz1B4B2yBZY';
const MUSIC = 'https://www.rockstargames.com/VI/music';
const R_MEDIA = 'https://www.rockstargames.com/VI/media';
const R_SHOTS = 'https://www.rockstargames.com/VI/media/screenshots';
const R_EDITIONS = 'https://www.rockstargames.com/VI/editions?ps5=1';
const R_SUPPORT = 'https://support.rockstargames.com/articles/4QfG4FmZCf5W1gS8jy4UVT/grand-theft-auto-vi-platform-editions-and-versions';
const EXT_LOOK = 'https://www.youtube.com/watch?v=tJbzMqJGH4k';
const TSA = 'https://www.thesixthaxis.com/2026/06/24/gta-6-ultimate-edition-pre-order-bonus-and-vintage-vice-city-pack-revealed/';
const FAMITSU = 'https://www.famitsu.com/article/202608/85753';
const EDGE_GR = 'https://www.gamesradar.com/edge/gtavi-cover/';
const HYPEBEAST_WCC = 'https://hypebeast.com/2026/11/grand-theft-auto-vi-gta6-real-in-game-cars';
const GTAVICE_EDGE = 'https://www.gtavice.net/news/gta-vi-edge-preview-reveals-huge-new-details-on-gameplay-police-relationships-and-more';
const VCH_EDGE = 'https://www.vicecityhustle.com/news/gta-6-edge-430-k9-units-cash-gated-story';
const DAZED = 'https://www.dazeddigital.com/life-culture/article/70859/1/gta-6-grand-theft-auto-vi-rockstar-exclusive-deep-dive-game-unparalleled-world';

/** hrefs are relative to the site base. */
export const guideSections: GuideSection[] = [
  {
    id: 'vehicles',
    images: [IMG.vehiclesStreet, IMG.vehiclesCockpit],
    title: 'Vehicles in GTA VI',
    status: 'Shown by Rockstar',
    paragraphs: [
      `GTA VI brings back familiar in-game manufacturers and models while adding vehicles created specifically for Leonida.${RETURNING_SENTENCE} In-game names replace earlier visual identifications once we have checked the car. Some familiar models return under new names: the car known as the Buffalo STX in GTA Online appears as the ’19 Buffalo in GTA VI. Our <a href="{base}cars/">Cars section</a> focuses on racing-relevant cars and is not a complete list of every vehicle shown for GTA VI.`,
      `Official footage also shows motorcycles, watercraft, and aircraft, but this guide focuses on cars and racing. A car appearing on screen does not by itself establish how it can be owned, stored, or customized.`,
      `Open Cars for individual models, <a href="{base}cars/classes/">GTA classes</a>, <a href="{base}cars/manufacturers/">manufacturers</a>, first appearances, release information, and real-life inspirations. Compare recorded prices and tested performance where results are available; individual car pages keep the source and tuning category beside the data.`,
    ],
    cta: { label: 'Explore Cars', href: 'cars/' },
    sources: [
      { label: 'Rockstar Games — GTA VI Launch Trailer', url: LAUNCH, note: 'October 15, 2026: new official trailer; not a complete vehicle list.' },
      { label: 'Rockstar Games — GTA VI Media', url: R_MEDIA, note: 'official trailers and media library.' },
      { label: 'Rockstar Games — GTA VI Screenshots', url: R_SHOTS, note: 'official screenshot titles, including named Ultimate Edition vehicles.' },
      { label: 'Rockstar Support — GTA VI Platforms, Editions, and Versions', url: R_SUPPORT, note: 'named edition vehicles and content.' },
      { label: 'Leonida Racing — In-game check (PS5)', url: '', note: 'November 21, 2026: 157 cars across the nine car types Coupe, Muscle, Off-Road, Pickup, Sedan, Sport, Super, SUV, and Van in the vehicle progress menu.' },
      { label: 'Leonida Racing — In-game check (PS5)', url: '', note: 'November 19, 2026: the car previously known as the Buffalo STX appears as ’19 Buffalo in the game. Leonida Racing lists year-designated models with the year after the model name.' },
    ],
  },
  {
    id: 'granforma',
    images: [IMG.granforma],
    title: 'Familiar Cars, Different Badges: Buckingham and GranForma',
    status: 'Community Identification',
    paragraphs: [
      `A familiar shape does not always come with a familiar badge. GTA VI is changing the branding on some returning cars, so the manufacturer you remember from GTA Online may no longer be the one on the bodywork.`,
      `The <a href="{base}cars/vehicles/buckingham-jubilee/">Jubilee</a> is a clear example. Known as the Enus Jubilee in GTA Online, the Rolls-Royce Cullinan-inspired SUV now wears <a href="{base}cars/manufacturers/buckingham/">Buckingham</a> branding in GTA VI’s Extended Look: on the front fender at around <a href="https://www.youtube.com/watch?v=tJbzMqJGH4k&amp;t=1186s" rel="noopener">19:46</a> and on the tailgate at around <a href="https://www.youtube.com/watch?v=tJbzMqJGH4k&amp;t=1207s" rel="noopener">20:07</a>. That brings a familiar luxury SUV under a marque previously known for aircraft and the Tug boat. The car returns; its place in GTA’s fictional industry changes.`,
      `The Windsor family is likely to follow. At around <a href="https://www.youtube.com/watch?v=rz1B4B2yBZY&amp;t=48s" rel="noopener">0:48</a> in the Launch Trailer, the Rolls-Royce Dawn-inspired <a href="{base}cars/vehicles/buckingham-windsor-drop/">Windsor Drop</a> carries a tall, rectangular badge on the front fender. That shape points to Buckingham rather than the oval Enus badge, although the emblem itself cannot be read clearly.`,
      `A familiar exotic with unfamiliar lettering tells another part of the story. The <a href="{base}cars/vehicles/granforma-zorrusso/">Zorrusso</a>-associated car in the Rockstar images published with Bloomberg’s October 14 feature carries <strong>GranForma</strong> lettering on the rear, replacing the familiar Pegassi branding. Its real-world inspiration is the Italdesign Zerouno. In the game, the Zorrusso is a GranForma.`,
      `It is not the only one. The <a href="{base}cars/vehicles/emperor-sultan/">Sultan</a> is listed under Emperor in GTA VI, and the <a href="{base}cars/vehicles/piccia-furia/">Furia</a> under Piccia.`,
      `The pattern suggests that Rockstar may be bringing some fictional marques into closer alignment with their real-world inspirations. It is a change worth following if you know the older cars—or organize your garage by manufacturer. Rockstar has not announced a rule for the full lineup, and a changed badge on one car does not mean every model under its old marque is moving with it.`,
    ],
    sources: [
      { label: 'RockstarINTEL — 2 More GTA 6 Screenshots Released', url: 'https://rockstarintel.com/2-more-gta-6-screenshots-released/', note: 'October 14, 2026: reports Rockstar-supplied Bloomberg images and the GranForma reading; model and brand interpretation are not a Rockstar announcement.' },
      { label: 'Bloomberg — The Making of Grand Theft Auto VI', url: 'https://www.bloomberg.com/features/2026-grand-theft-auto-6-making-of/', note: 'Original feature associated with the images.' },
      { label: 'Rockstar Games — GTA VI: An Extended Look', url: `${EXT_LOOK}&t=1186s`, note: 'August 27, 2026: Buckingham badge on the Jubilee’s front fender at approximately 19:46 and on the tailgate at approximately 20:07.' },
      { label: 'GTABase — Jubilee in GTA VI', url: 'https://www.gtabase.com/gta-6/vehicles/jubilee', note: 'Community identification of the Buckingham Jubilee.' },
      { label: 'GTABase — Jubilee in GTA Online', url: 'https://www.gtabase.com/grand-theft-auto-v/vehicles/enus-jubilee', note: 'The model’s earlier Enus identity.' },
      { label: 'Leonida Racing — In-game check (PS5)', url: '', note: 'November 19, 2026: in-game names show the Zorrusso as a GranForma, the Sultan as an Emperor, and the Furia as a Piccia.' },
      { label: 'Rockstar Games — GTA VI Launch Trailer', url: `${LAUNCH}&t=48s`, note: 'October 15, 2026: Windsor Drop with a tall, rectangular fender badge at approximately 0:48.' },
    ],
  },
  {
    id: 'driving',
    images: [IMG.driving],
    title: 'Driving and Vehicle Physics',
    status: 'Rockstar Interview',
    paragraphs: [
      `GTA VI’s driving model was rebuilt for the current hardware. Rockstar North co-studio head Rob Nelson says drivetrain, tires, suspension, and steering all feed into the vehicle physics, with the team aiming to combine the weight and feel associated with GTA IV with the accessibility of GTA V.`,
      `Rockstar has also assembled a vehicle-handling team that includes real race-car drivers. Our Gellhorn laps compare how cars perform around the circuit, including braking, cornering, and acceleration.`,
      `Narrower streets and dense traffic put more demands on your driving, according to Nelson. You can also switch between Jason and Lucia while the other character takes the wheel. At around <a href="https://www.youtube.com/watch?v=tJbzMqJGH4k&amp;t=1120s" rel="noopener">18:40</a> in the Extended Look, the player switches from Jason at the wheel to Lucia, who shoots at the pursuing cars while Jason keeps driving. Nelson describes moments where taking out a pursuing car’s tires blocks the cars following it.`,
      `IGN’s demo also includes a ride with <strong>Ryde Me</strong>, the game’s ride-hailing service. Nelson describes it as a way to fast travel, with the option to ride along and chat.`,
      `Small details matter when you’re just out for a drive, too. You work the turn signals yourself: on PS5, tap left or right on the D-pad while driving. The radio wheel also has a <strong>Vehicle</strong> tab with controls for the car itself, such as the lights and hazard lights.`,
      `In the cars we drove, older American muscle cars felt noticeably looser than older four-wheel-drive off-roaders. Age alone doesn’t tell you how planted a car will feel.`,
      `There’s no first-person view in the camera settings. You drive in third person.`,
      `Damage follows the impact: side hits leave dents where they land, headlights can break individually, and mirrors can be knocked loose. On the older cars we checked, mirrors broke off; on newer ones, they hung by a cable. A bumper torn loose on one side can drag along the road. Engine damage has its own readout.`,
    ],
    sources: [
      { label: 'Leonida Racing — In-game check (PS5)', url: '', note: 'November 20, 2026: PS5 turn signals on the D-pad, the Vehicle tab in the radio wheel, the camera settings, handling impressions, and damage on the cars we drove.' },
      { label: 'Hella Flush — GTA VI damage tests', url: 'https://www.youtube.com/watch?v=H_GhXwV384I&t=27s', note: 'November 2026: mirrors at 0:27, local dents at 1:00, engine damage at 1:23, and a dragging bumper at 4:31. Checked November 20, 2026.' },
      { label: 'IGN — GTA 6: The Big Interview', url: IGN_FULL, note: 'October 7, 2026; July demonstration.' },
      { label: 'GamesRadar — Rob Nelson on GTA VI driving physics', url: 'https://www.gamesradar.com/games/grand-theft-auto/gta-6-driving-is-the-best-parts-of-gta-4-but-with-the-accessibility-of-gta-5-says-rockstar-boss/', note: 'September 4, 2026: direct Nelson quotation covering drivetrain, tires, suspension, steering, and the rebuilt physics model.' },
      { label: 'Dazed — GTA VI: An Exclusive Deep Dive', url: DAZED, note: 'September 6, 2026: vehicle-handling team described as including race-car drivers.' },
    ],
  },
  {
    id: 'stats',
    images: [IMG.statsChavos],
    title: 'Vehicle Stats and Ratings',
    status: 'Tested in the game',
    paragraphs: [
      `The vehicle stat panel shows five values on a 0–10 scale: <strong>Speed</strong>, <strong>Acceleration</strong>, <strong>Asphalt Handling</strong>, <strong>Off-Road Handling</strong>, and <strong>Strength</strong>. It also shows separate road and off-road ratings. Asphalt and off-road handling describe different strengths, so a lifted 4x4 and a lowered sports car can both look strong for different jobs.`,
      `A small mark on each bar shows the car’s stock value, so you can see what upgrades have changed. You can also open the panel from the vehicle menu while driving. When you change parts, compare the road and off-road ratings directly.`,
      `The <a href="{base}cars/vehicles/dinka-chavos-xs/">Dinka Chavos XS</a> shows how much a race build can change a car. Stock, it has 5.2 Speed, 5.7 Acceleration, 3.9 Asphalt Handling, and a road rating of 497. The race-prepared rental at Gellhorn has 7.7 Speed, 7.9 Acceleration, 6.7 Asphalt Handling, and a road rating of 743. Its Off-Road Handling drops from 4.2 to 1.6.`,
      `At Gellhorn’s <strong>Keep It PG</strong> event, your car needs a road rating between 500 and 780. If yours falls outside that range, you can rent a race-prepared car at the track. Our <a href="{base}cars/">car pages</a> show the stats and ratings of the stock car as we read them in the game.`,
      `The info panel’s <strong>Specialist</strong> field names the type of mod shop with the most options for that car.`,
    ],
    sources: [
      { label: 'Leonida Racing — In-game check (PS5)', url: '', note: 'November 19, 2026: vehicle stat panels checked on Jason’s ’70 Ganado, the Cypher, the Buffalo ’19, and the Chavos XS. Stock-value marks confirmed on stock cars. Stock Chavos XS compared with the race-prepared Gellhorn rental; Keep It PG entry range checked in the event menu.' },
      { label: 'Digital Car Addict — GTA VI vehicle overview', url: 'https://www.youtube.com/watch?v=ie4vtIle3lU&t=444s', note: 'November 2026: the Specialist field at 7:24. Checked November 21, 2026.' },
    ],
  },
  {
    id: 'theft',
    images: [IMG.slimJim],
    title: 'Stealing, Scanning, Selling, and Registering Cars',
    status: 'Rockstar Interview',
    paragraphs: [
      `Stealing a parked car in GTA VI is no longer described as the same one-button job for every vehicle. Nelson says some cars remain inaccessible early in the story until Jason or Lucia obtains the right tools. Drivers can still be carjacked, but unattended vehicles may demand a quieter or more technical approach.`,
      `Check the car before you commit. Nelson describes a <strong>phone scanner</strong> that shows whether a vehicle is locked, has an alarm, or carries a tracker. It also shows what the car is worth at a Pay ’n’ Spray or specialty car fence and how much it would cost to register it for yourself. A Slim Jim works for one car; another needs a key cloner.`,
      `Moses gives you the <strong>Slim Jim</strong> during the Chapter 2 mission <strong>Moses</strong>. It opens a locked car without breaking the window or setting off the alarm. Cars with keyless ignition still need the key cloner.`,
      `The key cloner comes through the story. In Chapter 3, Randy provides it during his job to steal a Zorrusso; install it through your phone’s settings. Scan a car with WAINK to see whether it needs the key cloner.`,
      `Edge identifies <strong>WAINK</strong> as the app listing cars wanted by fences, including their security and tracking details. The fence usually has equipment to block a tracker’s signal at the drop-off.`,
      `To keep an eligible stolen car, register it as a personal vehicle. In Chapter 2, Moses in Port Gellhorn handles cars without trackers; respray the car, then choose <strong>Register</strong>. The first registration during his introduction is free. After <strong>Welcome to Vice City</strong> in Chapter 3, Pay ’n’ Spray shops can also register cars with standard trackers. Check the scan before taking a car you want to keep. Nelson told Famitsu that unregistered stolen cars disappear when the game restarts.`,
      `To sell a stolen car, check its tracker first. Moses buys cars without one, and Pay ’n’ Spray shops take cars with a standard tracker from Chapter 3. Randy in Balsero buys selected high-end cars after his Zorrusso job. The scan shows which buyers want the car.`,
      `An <strong>advanced tracker</strong> can turn a slow getaway into a police alert: Nelson says it pings your location when you drive too slowly. Condition matters at delivery, too. A car fence pays less for damage, and you can repair the car before selling it.`,
      `<strong>Pay ’n’ Spray</strong> repairs engine and body damage. It can also respray a car the police are looking for, which clears its vehicle heat. That respray is a quick fix in a basic color, not a custom paint job; for that, go to a mod shop. You can’t pull in while the police can see you.`,
      `The driver can be a problem before you even reach the ignition. Edge describes motorists who flee and others who fight back with a weapon. An owner can also report a theft after you have driven away.`,
      `A car fence can also point you toward a specific job. In the demo, one has supplied a door code for a <strong>police impound lot</strong>, where Jason and Lucia can steal the requested car together or alone. This is a theft job, not an explanation of how to recover your own impounded vehicle. Nelson also says there are points in the story where earning money through activities such as stealing and selling cars is needed to advance the mission flow.`,
    ],
    sources: [
      { label: 'IGN — GTA 6: The Big Interview', url: IGN_FULL, note: 'October 7, 2026; July demonstration.' },
      { label: 'Famitsu — Exclusive Interview with Rob Nelson', url: FAMITSU, note: 'August 28, 2026: vehicle registration, three initial storage spaces, purchasable garages, and the persistence rules for unregistered stolen vehicles.' },
      { label: 'Edge / GamesRadar — Grand Theft Auto VI exclusive: The state that never sleeps', url: EDGE_GR, note: 'October 29, 2026: WAINK, car security, trackers, and delivery condition. Checked October 30, 2026.' },
      { label: 'PowerPyx — GTA 6 How to Get Key Cloner', url: 'https://www.powerpyx.com/gta-6-how-to-get-key-cloner/', note: 'November 18, 2026: Chapter 3 story unlock during Randy’s Zorrusso job; vehicle scans identify key cloner requirements. Checked November 21, 2026.' },
      { label: 'PC Gamer — How to clone keys in GTA 6', url: 'https://www.pcgamer.com/games/grand-theft-auto/gta-6-clone-keys/', note: 'November 18, 2026: Chapter 3 unlock, keyless cars, vehicle scanning, and trackers. Checked November 21, 2026.' },
      { label: 'GAMES.GG — Key Cloner Guide: How to Get It in Grand Theft Auto 6', url: 'https://games.gg/grand-theft-auto-vi/guides/grand-theft-auto-6-how-to-get-the-key-cloner/', note: 'November 19, 2026: phone settings installation during Randy’s Zorrusso assignment. Checked November 21, 2026.' },
      { label: 'PC Gamer — GTA 6: How stealing cars has changed', url: 'https://www.pcgamer.com/games/grand-theft-auto/gta-6-how-to-steal-cars/', note: 'November 18, 2026: vehicle scanning and registration in the released game. Checked November 19, 2026.' },
      { label: 'GamesRadar — How to respray cars in GTA 6', url: 'https://www.gamesradar.com/games/grand-theft-auto/gta-6-respray-cars-how-to/', note: 'November 2026: a Pay ’n’ Spray respray removes vehicle heat; no entry while the police can see you. Checked November 21, 2026.' },
      { label: 'MetaForge — GTA 6 Pay ’n’ Spray Locations', url: 'https://metaforge.app/gta-6/gta-6-pay-n-spray-locations-how-to-lose-the-cops', note: 'November 2026: Repair covers engine and collision damage; Respray changes the color. Checked November 21, 2026.' },
      { label: 'Output Lag — GTA 6 How to Keep Stolen Cars and Register Them', url: 'https://outputlag.com/guides/gta-6-keep-register-cars/', note: 'November 2026: Pay ’n’ Spray resprays in basic colors only; full paint is at mod shops. Checked November 21, 2026.' },
      { label: 'PC Gamer — How to get a slim jim in GTA 6', url: 'https://www.pcgamer.com/games/grand-theft-auto/gta-6-slim-jim/', note: 'November 18, 2026: Chapter 2 Moses unlock, quiet entry, and the separate requirement for keyless ignition. Checked November 22, 2026.' },
      { label: 'PowerPyx — GTA 6 Moses walkthrough', url: 'https://www.powerpyx.com/gta-6-moses-take-a-vehicle-to-moses-walkthrough/', note: 'November 18, 2026: Slim Jim, untracked cars, respray before registration, and the first free registration. Checked November 22, 2026.' },
      { label: 'PowerPyx — GTA 6 How to Get New Personal Car', url: 'https://www.powerpyx.com/gta-6-how-to-get-new-personal-car/', note: 'November 18, 2026: registration changes between Chapters 2 and 3. Checked November 22, 2026.' },
      { label: 'PowerPyx — GTA 6 Welcome to Vice City walkthrough', url: 'https://www.powerpyx.com/gta-6-welcome-to-vice-city-walkthrough/', note: 'November 18, 2026: standard-tracker sales and registration at Pay ’n’ Spray unlock after this Chapter 3 mission. Checked November 22, 2026.' },
      { label: 'KeenGamer — GTA 6: How to Steal Any Car', url: 'https://www.keengamer.com/articles/guides/gta-6-how-to-steal-any-car-key-cloner-slim-jim-trackers/', note: 'November 20, 2026: Slim Jim, the first free registration, and standard-tracker registration at Pay ’n’ Spray in Chapter 3. Checked November 22, 2026.' },
      { label: 'PC Gamer — GTA 6 fence locations', url: 'https://www.pcgamer.com/games/grand-theft-auto/gta-6-fence-locations/', note: 'November 18, 2026: Moses in Port Gellhorn and Randy’s high-end car business in Balsero. Checked November 22, 2026.' },
      { label: 'Vice City Hustle — GTA 6 Edge: K9 Units, Scooter Bros, Cash Gates', url: VCH_EDGE, note: 'October 29, 2026: secondary Edge coverage of WAINK, personal-vehicle delivery, and fuel. Not a separate demonstration. Checked October 30, 2026.' },
    ],
  },
  {
    id: 'heat',
    title: 'Heat, Police Recognition, and Getaways',
    status: 'Rockstar Interview',
    images: [IMG.heatOutfit, IMG.heatPolice],
    paragraphs: [
      `The police response depends on what has been reported and what officers know. Nelson says a crime needs a witness or an alarm to reach the law. Police can know your appearance, your clothes, your vehicle, and that Jason and Lucia are traveling together. In the demonstration, switching to a car they do not recognize lowers their perception of you; splitting the pair up can help, too.`,
      `A baseball cap is not a complete escape plan. Nelson puts on glasses and a cap, then points out that the police still know his outfit. The same limitation applies to a haircut. A clothing store or a spare outfit from your personal vehicle gives you another option; in the shopping demonstration, he says buying and wearing a new outfit removes his current heat.`,
      `Sometimes the better exit is on foot. Nelson says a three-star pursuit in the city can be difficult to shake in a car unless it is very fast or you have a sports bike. His usual recommendation in that situation is to leave the streets and use the alleys. You can also wait for an area’s police search to die down instead of driving straight back into it.`,
      // Police Tempesta: final text Fausto 09.11.2026 (DEC-0212)
      `Edge’s pursuit adds spike strips laid across the road, and Vice Beach Police has a supercar of its own: Rockstar’s November screenshots show the Pegassi Tempesta in VBPD colours.`,
    ],
    sources: [
      { label: 'IGN — GTA 6: The Big Interview', url: IGN_FULL, note: 'October 7, 2026; July demonstration: reporting, recognition, outfit changes, vehicle swaps, splitting up, and escape advice.' },
      { label: 'Edge / GamesRadar — Grand Theft Auto VI exclusive: The state that never sleeps', url: EDGE_GR, note: 'October 29, 2026: spike strips during a police pursuit. Checked October 30, 2026.' },
      { label: 'Hypebeast / HYPEDRIVE — Grand Theft Auto VI real vs in-game cars', url: HYPEBEAST_WCC, note: 'November 2026: in-game screenshot of the Pegassi Tempesta in Vice Beach Police livery, supplied by Rockstar Games.' },
    ],
  },
  {
    id: 'ownership',
    images: [IMG.safehouse, IMG.buggy],
    title: 'Vehicle Ownership, Garages, and Safehouse Vehicles',
    status: 'Rockstar Interview',
    paragraphs: [
      `GTA VI has personal vehicles and expandable garage storage. Nelson told Famitsu that players begin with room for three vehicles. If all three spaces are occupied, one vehicle must be sold before another can be registered as personal. Buying garages around the map expands that capacity. You buy garages through the <strong>Vice City Real Estate</strong> app on your phone.`,
      `Rockstar’s Ultimate Edition includes Jason’s Safehouse Vehicles and the Ganado Retro Build. It also includes the <a href="{base}cars/vehicles/vapid-dominator-67-buggy/">’67 Vapid Dominator Buggy</a> with a garage, while the Vintage Vice City Pack includes the <a href="{base}cars/vehicles/vapid-stanier-55/">’55 Vapid Stanier Sedan</a> with a garage.`,
      `The accompanying Rockstar press material identifies those locations as Paradise Garage in Watson Bay and Shore Court Garage near Ocean Beach. They are personal garages, not confirmed tuning shops.`,
      `Your personal vehicle also acts as a mobile stash for spare outfits and purchased weapons. Wrecked it on the way somewhere? Call <strong>Joey</strong> from your phone contacts. In our test, the same car was waiting at the roadside a few seconds later, even though we had already driven on in another car. At around <a href="https://www.youtube.com/watch?v=tJbzMqJGH4k&amp;t=1069s" rel="noopener">17:49</a> in the Extended Look, Lucia changes her outfit while sitting in the car with Jason.`,
    ],
    sources: [
      { label: 'IGN — GTA 6: The Big Interview', url: IGN_FULL, note: 'October 7, 2026; July demonstration.' },
      { label: 'Famitsu — Exclusive Interview with Rob Nelson', url: FAMITSU, note: 'August 28, 2026: three initial vehicle spaces, the replacement rule when storage is full, and purchasable garages that expand ownership capacity.' },
      { label: 'PowerPyx — GTA 6 All Garage Locations', url: 'https://www.powerpyx.com/gta-6-all-garage-locations/', note: 'November 18, 2026: garages bought through the Vice City Real Estate phone app. Checked November 19, 2026.' },
      { label: 'GTABase — GTA 6 Properties & Garages', url: 'https://www.gtabase.com/gta-6/properties/', note: 'Garage purchases through Vice City Real Estate. Checked November 19, 2026.' },
      { label: 'Rockstar Games — GTA VI Editions', url: R_EDITIONS, note: 'Jason’s Safehouse Vehicles, Ganado Retro Build, and the named vehicle bonuses.' },
      { label: 'Rockstar Games — GTA VI Screenshots', url: R_SHOTS, note: '“Jason’s Safehouse Vehicles,” “Ganado Retro Build,” and “’67 Vapid Dominator Buggy.”' },
      { label: 'Rockstar Support — GTA VI Platforms, Editions, and Versions', url: R_SUPPORT, note: 'edition and pre-order package contents.' },
      { label: 'TheSixthAxis — GTA VI Ultimate Edition and Vintage Vice City Pack', url: TSA, note: 'June 24, 2026: documentation of Rockstar’s accompanying descriptions for Paradise Garage and Shore Court Garage.' },
      { label: 'Edge / GamesRadar — Grand Theft Auto VI exclusive: The state that never sleeps', url: EDGE_GR, note: 'October 29, 2026: vehicle storage and the personal vehicle as a stash. Checked October 30, 2026.' },
      { label: 'Leonida Racing — In-game check (PS5)', url: '', note: 'November 20, 2026: personal car wrecked, continued in another car, called Joey; the same personal car was delivered to the roadside seconds later. Cost not checked.' },
    ],
  },
  {
    // RS-0088 (Fausto 22.11.2026). COPY: Claude draft -> Codex review (DEC-0088).
    id: 'garages',
    title: 'All Garages in GTA VI: Locations, Spaces and How to Get Them',
    status: 'Reported by Players',
    paragraphs: [
      `Garages are the only property you can buy in GTA VI’s Story Mode. Every space in a garage lets you register one more personal car. Twelve garages come with every copy of the game: eight you buy and four the story gives you. Three more are edition and GTA+ bonuses.`,
      `The <strong>Vice City Real Estate</strong> app on your phone opens after the Chapter 2 mission “Daily Driver.” Each of the eight garages for sale has one space. Prices run from $5,000 to $50,000; BuckMe Gold members pay 20% less, which needs a $100,000 deposit in BuckMe Family Savings. Buy all eight and you unlock the Little Boxes trophy.`,
      `The story garages are free and bigger. Port Gellhorn Station comes after “Daily Driver,” Thompson Court after “Company Cars” in Chapter 4, and NE 15th Street and Pegassi Residences after “Operation Savage Glory” in Chapter 5. With three spaces, Pegassi Residences is the largest garage in the game.`,
      `Shore Court Garage in Ocean Beach comes with the pre-order bonus, Paradise Garage in Watson Bay with the Ultimate Edition, and GTA+ members get the Crosstown Garage from Chapter 3.`,
      `Keep track of your own setup on Leonida Racing: add the garages you own, park your cars in them and see which spaces are still free.`,
    ],
    table: {
      caption: 'GTA VI garages, spaces and how to get them',
      head: ['Garage', 'Area', 'Spaces', 'How to get it'],
      rows: [
        ['Mitchel Auto Center', 'Kelly County', '1', '$5,000 ($4,000 with BuckMe Gold)'],
        ['Persistence Road Garage', 'Belville', '1', '$9,500 ($7,600)'],
        ['7th Avenue Garage', 'Salton, Vice City', '1', '$15,000 ($12,000)'],
        ['Store n’ Bolt', 'Ambrosia', '1', '$21,000 ($16,800)'],
        ['Wyatt Motors', 'Allied Crystal, Ambrosia', '1', '$27,000 ($21,600)'],
        ['Vela Rota Drive Garage', 'Capri', '1', '$30,000 ($24,000)'],
        ['Bonita Court Garage', 'Vice Beach', '1', '$42,500 ($34,000)'],
        ['Atlantic Court Garage', 'Ocean Beach', '1', '$50,000 ($40,000)'],
        ['Port Gellhorn Station Garage', 'Port Gellhorn', '1', 'Story: “Daily Driver” (Chapter 2)'],
        ['Thompson Court Garage', 'Ocean Beach', '2', 'Story: “Company Cars” (Chapter 4)'],
        ['NE 15th Street Garage', 'Stockyard, Vice City', '2', 'Story: “Operation Savage Glory” (Chapter 5)'],
        ['Pegassi Residences Garage', 'Tequesta Retreat, Vice City', '3', 'Story: “Operation Savage Glory” (Chapter 5)'],
        ['Shore Court Garage', 'Ocean Beach', '1', 'Pre-order bonus'],
        ['Paradise Garage', 'Watson Bay', '1', 'Ultimate Edition'],
        ['GTA+ Crosstown Garage', 'Crosstown, Vice City', '1', 'GTA+, from Chapter 3'],
      ],
    },
    cta: { label: 'Sign in and manage your garages', href: 'account/#garages' },
    sources: [
      { label: 'PowerPyx — GTA 6 All Garage Locations', url: 'https://www.powerpyx.com/gta-6-all-garage-locations/', note: 'Eight garages for sale and four story garages with their spaces and unlock missions. Checked November 22, 2026.' },
      { label: 'Power Up Gaming — GTA 6: How to Buy Garages and Store Your Cars', url: 'https://powerupgaming.co.uk/2026/11/21/gta-6-how-to-buy-garages-and-store-your-cars/', note: 'November 21, 2026: regular and BuckMe Gold prices, spaces, story and bonus garages. Checked November 22, 2026.' },
      { label: 'gta6guide.fr — GTA 6 Properties: Houses, Garages, Prices & Locations', url: 'https://gta6guide.fr/en/gta-6/properties', note: 'All 15 garages with area and spaces. Checked November 22, 2026.' },
      { label: 'GTABase — All GTA 6 Garage Locations', url: 'https://www.gtabase.com/gta-6/map/?feature=garages', note: 'Garage map, unlock after “Daily Driver.” Checked November 22, 2026.' },
      { label: 'Game Checklists — GTA 6 Properties & Garages Checklist', url: 'https://game-checklists.com/gta6/properties-checklist/', note: 'Little Boxes trophy for buying all eight garages. Checked November 22, 2026.' },
    ],
  },
  {
    id: 'fuel',
    title: 'Fuel, EV Charging, and Gas-Station Repairs',
    status: 'Tested in the game',
    paragraphs: [
      `Edge reports a fuel gauge and engine-health readout for every vehicle. Refueling is described as quick, with cars covering long distances between stops.`,
      `Fuel is part of every drive: when the tank runs low, you refuel at a gas station. PC Gamer reports that electric vehicles use charging points instead and that fuel lasts long enough that stops are infrequent.`,
      `In published tests, a full tank lasted roughly 18 to 30 minutes of driving, depending on the car. A stolen car may already be low on fuel, so check the gauge before a chase.`,
      `Gas stations can repair your car, too, not just fill the tank.`,
    ],
    sources: [
      { label: 'Leonida Racing — In-game check (PS5)', url: '', note: 'November 19, 2026: refueling at a gas station in story mode.' },
      { label: 'PC Gamer — Refueling cars in GTA 6 is barely necessary', url: 'https://www.pcgamer.com/games/grand-theft-auto/gta-6-refuel-repair-cars/', note: 'November 19, 2026: gas-station refueling, EV charging, how often you need to stop, and the Repair option in the gas-station Services menu. Checked November 21, 2026.' },
      { label: 'Kotaku — We Tested How Long It Takes To Run Out Of Gas In GTA 6', url: 'https://kotaku.com/we-tested-how-long-it-takes-to-run-out-of-gas-in-gta-6-2000755601', note: 'Checked November 21, 2026: pickup 29:08; Banshee 18:31.' },
      { label: 'MotiveGTA — How Long Does Fuel REALLY Last in GTA 6?', url: 'https://www.youtube.com/watch?v=jFHpHTjyQ8o&t=244s', note: 'November 2026: Willard Transient result at 4:04, Infernus ’96 at 6:01. Checked November 21, 2026.' },
      { label: 'Digital Car Addict — GTA VI vehicle overview', url: 'https://www.youtube.com/watch?v=ie4vtIle3lU&t=249s', note: 'November 2026: gas stations refuel and repair at 4:09. Checked November 20, 2026.' },
      { label: 'TGG — GTA 6: Vehicles Work Differently Now', url: 'https://www.youtube.com/watch?v=5PEKC28azRU&t=558s', note: 'Original creator report; chapter “Fuel & EV Charging” starts at 9:18.' },
      { label: 'GamesRadar — Rockstar boss on GTA 6’s refueling system', url: 'https://www.gamesradar.com/games/grand-theft-auto/rockstar-boss-says-well-see-what-people-say-about-gta-6s-controversial-refueling-system-but-thinks-its-so-fast-that-you-cant-complain/', note: 'September 3, 2026: explicitly attributes the refuel/repair interaction and approximate timing to TGG’s preview account.' },
      { label: 'PC Gamer — GTA 6’s reported refuelling action', url: 'https://www.pcgamer.com/games/grand-theft-auto/grand-theft-auto-6s-controversial-refuelling-action-reportedly-takes-about-10-seconds-to-perform-which-rockstars-co-studio-head-says-is-pretty-fast-for-a-fill-up/', note: 'September 5, 2026: reports charging and refueling via TGG/GamesRadar; the same report chain, not another independent demo.' },
      { label: 'Edge / GamesRadar — Grand Theft Auto VI exclusive: The state that never sleeps', url: EDGE_GR, note: 'October 29, 2026: fuel and engine-health displays; qualitative refueling description. Checked October 30, 2026.' },
      { label: 'Vice City Hustle — GTA 6 Edge: K9 Units, Scooter Bros, Cash Gates', url: VCH_EDGE, note: 'October 29, 2026: secondary Edge coverage of WAINK, personal-vehicle delivery, and fuel. Not a separate demonstration. Checked October 30, 2026.' },
    ],
  },
  {
    id: 'customization',
    images: [IMG.rideout, IMG.willies],
    title: 'Car Customization, Tuning, and Mod Shops',
    status: 'Tested in the game',
    paragraphs: [
      `Mod shops across Leonida have different specialties. <strong>Coastal Auto Care</strong>, for example, offers retro builds. <strong>Rideout Customs</strong> in Vice City and <strong>One-Eyed Willie’s</strong> in Lake Leonida are exclusive to the Ultimate Edition.`,
      `Rockstar’s accompanying descriptions give the shops different identities. Rideout Customs focuses on detailed interiors, wheels, and donk builds. One-Eyed Willie’s specializes in off-road modifications and hand-painted vehicle designs. The same material describes the wider selection as both artistic and performance-oriented.`,
      `At <strong>Coastal Auto Care</strong>, the menu for <a href="{base}cars/vehicles/vapid-ganado-70/">Jason’s ’70 Ganado</a> has six tabs: <strong>Pro Builds</strong>, <strong>Cosmetics</strong>, <strong>Bodywork</strong>, <strong>Performance</strong>, <strong>Wheels</strong>, and <strong>Interior</strong>. Pro Builds offers complete build packages and wheel kits. On the Ganado, lowering the suspension improves asphalt handling at the expense of off-road handling; raising it does the reverse.`,
      `Its Performance menu lists the <strong>engine</strong>, <strong>intakes</strong>, <strong>transmission</strong>, and <strong>boost</strong>, which is nitrous. Engine and transmission upgrades come in stages. We found no separate brake or turbo upgrade there. Some parts require a bank account before you can buy them; nitrous was listed at $5,000 for the Ganado.`,
      `Don’t judge a part by its name. On the Ganado, most intakes and exhausts left the displayed stats unchanged, while a custom wing traded a little speed for asphalt handling. The preview highlights gains in green and losses in red before you buy.`,
    ],
    sources: [
      { label: 'Leonida Racing — In-game check (PS5)', url: '', note: 'November 19, 2026: Jason’s ’70 Ganado with the Retro Build – Ultimate Edition at Coastal Auto Care. Menu tabs, build and wheel kits, staged upgrades, nitrous, part previews, bank-account requirements, and the $5,000 nitrous listing checked on this car.' },
      { label: 'Rockstar Games — GTA VI Editions', url: R_EDITIONS, note: 'names and Ultimate Edition inclusion.' },
      { label: 'Rockstar Games — GTA VI Screenshots', url: R_SHOTS, note: '“Rideout Customs Mod Shop 01–03” and “One-Eyed Willie’s Mod Shop 01–03.”' },
      { label: 'TheSixthAxis — GTA VI Ultimate Edition details', url: TSA, note: 'Rockstar press descriptions of the shops and their specialties.' },
      { label: 'GamesRadar — GTA VI activities and customization', url: 'https://www.gamesradar.com/games/grand-theft-auto/gta-6-new-gameplay-details-activities-customization-confirmed-63-screenshots/', note: 'corroborating coverage of Rockstar’s press material.' },
    ],
  },
  {
    id: 'classics',
    images: [IMG.wyman, IMG.classicCar],
    title: 'Classic Cars, Restoration, and Special Builds',
    status: 'Confirmed by Rockstar',
    paragraphs: [
      `GTA VI treats some vehicles as projects rather than finished purchases. The Ultimate Edition includes the <strong>Classic Car Collection</strong>, an assignment connected to collector and fixer Wyman. Rockstar’s accompanying description says players will find abandoned classics and unfinished builds and restore them for his collection.`,
      `The <strong>Ganado Retro Build</strong> is another vehicle-specific conversion. At Coastal Auto Care, the Ganado’s Pro Builds menu lists the Ultimate Edition package alongside Standard, Advanced, and Elite versions.`,
    ],
    sources: [
      { label: 'Rockstar Support — GTA VI Editions', url: R_SUPPORT, note: 'Classic Car Collection and Ganado Retro Build.' },
      { label: 'Leonida Racing — In-game check (PS5)', url: '', note: 'November 19, 2026: the Ganado’s Pro Builds menu at Coastal Auto Care, with the Retro Build – Ultimate Edition and Standard, Advanced, and Elite versions.' },
      { label: 'Rockstar Games — GTA VI Screenshots', url: R_SHOTS, note: '“Classic Car Collection 01–06” and “Ganado Retro Build.”' },
      { label: 'TheSixthAxis — GTA VI Ultimate Edition details', url: TSA, note: 'documentation of Rockstar’s restoration description.' },
    ],
  },
  {
    id: 'racing',
    images: [IMG.circuitRace, IMG.streetRace],
    title: 'Racing in GTA VI',
    status: 'Tested in the game',
    paragraphs: [
      `GTA VI includes structured circuit, off-road, and street racing. Rockstar’s Extended Look shows all three with an active race HUD rather than presenting them only as background scenes.`,
      `Story-mode races take place at <strong>Gellhorn International Raceway</strong>, <strong>Boone Speedway</strong>, and the <strong>Thrillbilly Mud Club</strong>, among others.`,
      `Story mode has <strong>40 unique races</strong>. Win 20 different races for <strong>Earn Cash, Not Kudos</strong>, or 30 for the racing requirement toward 100% completion. Repeating the same race does not add another unique win.`,
      `The <strong>13 Race Challenges</strong> are a separate category, with time or score targets and bronze, silver, and gold medals. You need gold in 10 of them for 100% completion.`,
      `At around <a href="https://www.youtube.com/watch?v=tJbzMqJGH4k&amp;t=1061s" rel="noopener">17:41</a>, 16 cars race two laps on a wet paved circuit, with position, lap, and timing information on screen. At around <a href="https://www.youtube.com/watch?v=tJbzMqJGH4k&amp;t=1115s" rel="noopener">18:35</a>, a 12-entry field of quads, motorcycles, and off-road pickups runs two laps on a dirt course. At around <a href="https://www.youtube.com/watch?v=tJbzMqJGH4k&amp;t=1221s" rel="noopener">20:21</a>, a six-car street race tracks progress as a percentage. These are the events shown, not a fixed rule for grid sizes or race distances.`,
      `Racing can interrupt a getaway, too. Edge describes a customized 4x4 with purple underglow challenging Nelson’s station wagon on the highway. Its occupants keep taunting him until he accepts, and a passenger hangs out of the window as they pull ahead.`,
      `At <strong>Keep It PG</strong>, the event menu lists the lap count, field size, maximum payout, and accepted car ratings. You can compare those details before choosing your car.`,
      `At Gellhorn, races charge an entry fee, with a rental fee on top if you borrow a car. A win covers those costs and leaves a profit. In the races we played, the AI used heavy rubber-banding: rivals slowed sharply when we fell behind and caught up quickly when we pulled away.`,
      `Nitrous returns as an upgrade: on Jason’s ’70 Ganado, it sits under <strong>Boost</strong> in the Performance menu.`,
      `For your own car comparisons, keep <strong>top speed</strong> separate from <strong>lap time</strong>. One measures speed; the other includes the corners, braking, and acceleration of a particular route. Our car rankings keep Gellhorn laps separate from driver leaderboard results. Compare the same tuning category and read the test conditions before treating two times as equivalent.`,
    ],
    cta: { label: 'Go to Time Attack', href: 'time-attack/gellhorn-international-raceway/' },
    sources: [
      { label: 'Rockstar Games — Grand Theft Auto VI: An Extended Look', url: `${EXT_LOOK}&t=1061s`, note: 'August 27, 2026: circuit race at approximately 17:41–17:47, off-road race at 18:35–18:39, and street race with nitrous at 20:21–20:25.' },
      { label: 'Rockstar Newswire — An Extended Look', url: 'https://www.rockstargames.com/newswire/article/4k138k8okkk483/grand-theft-auto-vi-an-extended-look-now-playing', note: 'confirms the presentation was captured entirely from in-game PlayStation 5 footage.' },
      { label: 'Game Informer — GTA VI: Welcome to Leonida', url: 'https://gameinformer.com/feature/2026/09/29/grand-theft-auto-vi-welcome-to-leonida', note: 'September 29, 2026: Rockstar cover story additionally identifies street and off-road racing among the activities; full article access may require a subscription.' },
      { label: 'Edge / GamesRadar — Grand Theft Auto VI exclusive: The state that never sleeps', url: EDGE_GR, note: 'October 29, 2026: highway challenge involving a customized 4x4 with purple underglow. Checked October 30, 2026.' },
      { label: 'GTAVice — Edge preview and print-only Phil Hooker Q&A', url: GTAVICE_EDGE, note: 'October 29, 2026: secondary coverage, including attributed excerpts from the print-only Q&A and the reported 23-station total. Checked October 30, 2026.' },
      { label: 'Leonida Racing — In-game check (PS5)', url: '', note: 'November 19, 2026: Keep It PG event menu at Gellhorn checked for laps, field size, maximum payout, and the accepted road-rating range. Nitrous checked in the Performance menu at Coastal Auto Care. November 21, 2026: entry fees and heavy rubber-banding in our Gellhorn races.' },
      { label: 'PowerPyx — GTA 6 All Unique Race Locations', url: 'https://www.powerpyx.com/gta-6-all-unique-race-locations-racing-activities/', note: 'November 18, 2026: 40 unique races, 20 different wins for Earn Cash, Not Kudos, 30 for 100% completion, entry and rental fees, and winning for a profit. Checked November 22, 2026.' },
      { label: 'PowerPyx — GTA 6 All Race Challenge Locations & Gold Medals', url: 'https://www.powerpyx.com/gta-6-all-race-challenge-locations-gold-medals/', note: 'November 18, 2026: 13 separate medal challenges, with 10 gold medals required for 100% completion. Checked November 22, 2026.' },
      { label: 'GAMES.GG — All Race Challenge Locations', url: 'https://games.gg/grand-theft-auto-vi/guides/all-race-challenge-locations-in-gta-6/', note: 'November 19, 2026: challenge list, medal targets, and 10 gold medals for 100% completion. Checked November 22, 2026.' },
      { label: 'TheClick — GTA 6 Race Locations', url: 'https://www.theclick.gg/gta-6-race-locations/', note: 'November 19, 2026, updated November 21, 2026: 40 races, 20 wins for the trophy, 30 for 100% completion, and the separate Race Challenges. Checked November 22, 2026.' },
      { label: 'PowerPyx — GTA 6 All Challenges Guide', url: 'https://www.powerpyx.com/gta-6-all-challenges-guide/', note: 'November 18, 2026: racing challenges name Gellhorn International Raceway, Boone Speedway, and Thrillbilly Mud Club. Checked November 19, 2026.' },
      { label: 'GamesRadar — All GTA 6 cheats and how to unlock them', url: 'https://www.gamesradar.com/games/grand-theft-auto/gta-6-cheats/', note: 'Race-related unlock requirements name Gellhorn, Boone Speedway, and Thrillbilly Mud Club. Checked November 19, 2026.' },
    ],
  },
  {
    id: 'gellhorn',
    images: [IMG.circuitEmpty],
    title: 'Gellhorn and the Circuit',
    status: 'Tested in the game',
    paragraphs: [
      `Gellhorn International Raceway is a playable race venue south of Port Gellhorn. Earlier GTA games had stadium events, small ovals, and improvised routes, but never a permanent road course built into the map. Trailer 2 separately shows Lucia wearing clothing marked <strong>Gellhorn International</strong> with a race-car graphic.`,
      `Your first event at Gellhorn, the introduction race, unlocks <strong>Keep It PG</strong>, an amateur series of five races. Placing there opens up more, for 11 races at the track in total. Gellhorn has several layouts, many in both directions, from the <strong>Short Loop</strong> and <strong>Basic Loop</strong> to longer loops and a <strong>Rallycross Loop</strong>. In our races, the field had 16 cars; the Short Loop ran three laps and the Basic Loop five. You can enter your own car if its road rating fits, or rent a race-prepared Übermacht Cypher, Bravado Buffalo ’19, or Dinka Chavos XS at the track. Leonida Racing uses the circuit for its <a href="{base}time-attack/gellhorn-international-raceway/">Time Attack competition</a>.`,
      `Sebring International Raceway is a rumored inspiration, discussed in coverage by <strong>The Drive</strong> and <strong>Jalopnik</strong>. Parts of that comparison rely on leaked maps rather than official footage. It is a published theory about the inspiration, not a Rockstar-confirmed connection or proof that Gellhorn copies Sebring’s layout, length, or corners.`,
      `Rockstar’s research for GTA VI also included a Florida racetrack. In a November 2026 interview with The Guardian, Rockstar North co-studio head Rob Nelson recalled visiting a racetrack a few hours after a night in a Miami club. The coverage does not name the track or say whether the visit was tied to Gellhorn.`,
    ],
    cta: { label: 'Visit Gellhorn Time Attack', href: 'time-attack/gellhorn-international-raceway/' },
    sources: [
      { label: 'Leonida Racing — In-game check (PS5)', url: '', note: 'November 19, 2026: Gellhorn International Raceway in story mode, south of Port Gellhorn. Keep It PG checked with Basic Loop, Short Loop, Intermediate Loop CCW, and Long Loop; our races had 16 cars, with three laps on the Short Loop and five on the Basic Loop. Own-car entry and the Cypher, Buffalo ’19, and Chavos XS rentals checked. Rallycross Loop and Intermediate Loop CCW seen in the layout menu.' },
      { label: 'PowerPyx — GTA 6 All Unique Race Locations', url: 'https://www.powerpyx.com/gta-6-all-unique-race-locations-racing-activities/', note: 'November 18, 2026: Gellhorn Raceway – Introduction unlocks the five-race Keep It PG series; 11 races at the track. Checked November 21, 2026.' },
      { label: 'EGamers.io — GTA 6 Challenges Guide', url: 'https://egamers.io/gta-6-challenges-guide-all-80-goals-trophy-thresholds-and-race-rules/', note: 'November 2026: the introduction adds a five-race amateur series; 11 races at Gellhorn. Checked November 21, 2026.' },
      { label: 'Jalopnik — GTA VI Has A Race Track', url: 'https://www.jalopnik.com/2246099/gta-6-race-track-new-details/', note: 'August 27, 2026: discusses Sebring as an inspiration; not an independent Rockstar confirmation.' },
      { label: 'The Drive — Is Sebring Raceway Going To Be in GTA 6?', url: 'https://www.thedrive.com/news/theres-convincing-evidence-that-sebring-raceway-will-be-in-grand-theft-auto-6', note: 'April 3, 2026: documents the Sebring theory; map/leak-derived arguments are not treated as verified circuit facts.' },
      { label: 'Rockstar Games — Grand Theft Auto VI: An Extended Look', url: EXT_LOOK, note: 'approximately 17:41–17:47: official circuit-racing footage.' },
      { label: 'Rockstar Games — GTA VI Trailer 2', url: 'https://www.youtube.com/watch?v=VQRLujxTm3c', note: 'approximately 1:57: “Gellhorn International” clothing and race-car graphic.' },
      { label: 'Motor1 — GTA 6 Is Finally Getting Real Racing', url: 'https://www.motor1.com/news/806207/grand-theft-auto-6-race-track-leaked/', note: 'updated August 27, 2026: earlier GTA games had small ovals, dirt tracks, and improvised routes, but no dedicated asphalt road course.' },
      { label: 'RockstarINTEL — New GTA VI Interview Reveals More Gameplay Features', url: 'https://rockstarintel.com/new-gta-vi-interview-reveals-more-gameplay-features/', note: 'November 2026: secondary coverage of The Guardian interview with Rob Nelson, including the racetrack visit during Florida research. Checked November 13, 2026.' },
    ],
  },
  {
    id: 'car-culture',
    images: [IMG.carMeet, IMG.takeover],
    title: 'Car Meets, Street Takeovers, and Car Culture',
    status: 'Shown by Rockstar',
    paragraphs: [
      `Rockstar puts car culture front and center in GTA VI’s trailers. Street takeovers, parking-lot meets, donks, lifted trucks, and off-road parties keep bringing the camera back to the cars and the people around them. Taken together, they suggest car culture will play a bigger role in GTA VI.`,
      `Trailer 1 moves from a woman dancing on a car roof to a passenger standing in a moving pickup’s open doorway. At around <a href="https://www.youtube.com/watch?v=QdBZY2fkU-0&amp;t=55s" rel="noopener">0:55</a>, the <strong>Thrillbilly Mud Club</strong> name appears over a muddy off-road gathering. Later, at around <a href="https://www.youtube.com/watch?v=QdBZY2fkU-0&amp;t=68s" rel="noopener">1:08</a>, a car-scene clip carries <strong>High Rollerz Lifestyle</strong> branding and the handle <strong>@HighRollerzMag</strong>.`,
      `The details matter as much as the gatherings. Trailer 2 shows <strong>swangas</strong>, the outward-projecting wire wheels associated with Houston’s slab scene, adding a new wheel style to GTA. Rideout Customs and Vice Vinyl branding also appears in Trailer 1, alongside the customized vehicles. Rockstar has since named Rideout Customs as a mod shop; Vice Vinyl’s role remains unexplained.`,
      `These scenes give the culture its own people, builds, and places to gather. Which moments become player-controlled actions, and whether you can organize meets or takeovers with judging and rewards, remain open.`,
      `A good drive needs something on the radio, too. Rockstar’s October 8 reveal previews six stations, with styles ranging from Latin and country to metal, pop and southern hip-hop. Its official music page also describes in-game podcasts. GTAVice’s coverage of Edge’s print edition reports 23 radio stations in total. The station previews are not a complete playlist or a confirmed soundtrack for racing events.`,
    ],
    cta: { label: 'Find Community Events', href: 'community/events/' },
    sources: [
      { label: 'Rockstar Games — The Music of GTA VI', url: MUSIC, note: 'Official station previews and in-game podcasts; announcement dated October 8, 2026 in Newswire.' },
      { label: 'Rockstar Games — GTA VI Trailer 1', url: 'https://www.youtube.com/watch?v=QdBZY2fkU-0', note: 'Approximately 0:44: roof dancing; 0:45–0:47: takeover; 0:52–0:53: pickup and open-door passenger, Rideout Customs and Vice Vinyl branding; 0:55–0:57: Thrillbilly Mud Club; 1:08: High Rollerz Lifestyle / @HighRollerzMag. Key frames checked October 30, 2026.' },
      { label: 'Rockstar Games — GTA VI Trailer 2', url: 'https://www.youtube.com/watch?v=VQRLujxTm3c&t=126s', note: 'Approximately 2:06: customized red sedan with projecting wire wheels (swangas). Checked October 30, 2026.' },
      { label: 'Rockstar Games — Grand Theft Auto VI: An Extended Look', url: EXT_LOOK, note: 'approximately 26:06: parking-lot car-meet scene.' },
      { label: 'Rockstar Games — GTA VI Screenshots', url: R_SHOTS, note: 'official mod-shop and custom-vehicle imagery.' },
      { label: 'GTAVice — Edge preview and print-only Phil Hooker Q&A', url: GTAVICE_EDGE, note: 'October 29, 2026: secondary coverage, including attributed excerpts from the print-only Q&A and the reported 23-station total. Checked October 30, 2026.' },
    ],
  },
  {
    id: 'not-confirmed',
    title: 'What Rockstar Has Not Confirmed Yet',
    status: 'Not Confirmed',
    paragraphs: [
      `Several details are still open. Wheel support, manual shifting, insurance, and the full damage model remain open in the sources we checked, as does whether the police Tempesta takes part in pursuits.`,
      `This section will shrink as Rockstar releases more information and the finished game provides testable answers. Until then, “not confirmed” means exactly that—not impossible, not secretly ruled out, just not ready to call a fact.`,
    ],
    sourcesHeading: 'Official material checked for this section',
    sources: [
      { label: 'Rockstar Games — GTA VI Launch Trailer', url: LAUNCH, note: 'October 15, 2026; no new racing rules inferred from trailer imagery.' },
      { label: 'Rockstar Games — Grand Theft Auto VI', url: 'https://www.rockstargames.com/VI', note: '' },
      { label: 'Rockstar Games — GTA VI Media', url: R_MEDIA, note: '' },
      { label: 'Rockstar Games — GTA VI Editions', url: R_EDITIONS, note: '' },
      { label: 'Rockstar Support — GTA VI Platforms, Editions, and Versions', url: R_SUPPORT, note: '' },
      { label: 'Hypebeast / HYPEDRIVE — Grand Theft Auto VI real vs in-game cars', url: HYPEBEAST_WCC, note: 'November 2026: police Tempesta shown; no pursuit footage.' },
    ],
  },
];

/** "How Leonida Racing Covers ..." — The Lab line removed until the section exists. */
export const guideCoverage: { name: string; text: string }[] = [
  { name: 'Cars', text: 'brings models, classes, manufacturers and real-life inspirations together. Browse the available details and compare cars side by side.' },
  { name: 'Time Attack', text: 'is where your driving meets the stopwatch: Gellhorn lap submissions and leaderboards, with the required proof.' },
  { name: 'Community', text: 'connects drivers, crews, hosts and creators through events, car meets, playlists and Discord.' },
  { name: 'The Guide', text: 'explains what is known, shows where the information came from, and keeps confirmed facts separate from strong identifications and open questions.' },
];

/** FAQ: the same text is used for the visible answers and FAQPage JSON-LD. */
export const guideFaq: { q: string; a: string; aHtml?: string }[] = [
  { q: 'Is Gellhorn International Raceway based on Sebring?', a: 'Sebring is a rumored inspiration discussed by The Drive and Jalopnik. Parts of that comparison rely on leaked maps. The official material reviewed here does not confirm a Sebring connection or establish that Gellhorn copies its layout, length, or corners.' },
  { q: 'Do cars need fuel or charging in GTA VI?', a: 'Yes. Cars need fuel, and you refuel at gas stations. PC Gamer reports that electric vehicles charge at charging points and that fuel lasts long enough that stops are infrequent.' },
  { q: 'How long does a tank of fuel last in GTA VI?', a: 'In published tests, a full tank lasted roughly 18 to 30 minutes of driving, depending on the car.' },
  { q: 'Can you repair cars at gas stations in GTA VI?', a: 'Yes. Gas stations offer repairs as well as fuel.' },
  { q: 'Does GTA VI have nitrous?', a: 'Yes. Nitrous is an upgrade at mod shops; on Jason’s ’70 Ganado, it’s the Boost option in the Performance menu.' },
  { q: 'What do the car stats mean in GTA VI?', a: 'The panel shows Speed, Acceleration, Asphalt Handling, Off-Road Handling, and Strength on a 0–10 scale, plus road and off-road ratings. At Gellhorn’s Keep It PG event, the road rating decides whether your car is eligible.' },
  { q: 'Are GTA VI Online races confirmed by the gameplay footage?', a: 'No. GTA VI launched as a single-player game, so its races are story-mode races. Online racing would need its own announcement.' },
  { q: 'Do AI racers rubber-band in GTA VI?', a: 'Yes, and it’s very noticeable. In the races we played at Gellhorn, rivals slowed sharply when we fell behind and caught up quickly when we pulled away.' },
  { q: 'Is the fastest GTA VI car also the best for Gellhorn?', a: 'Top speed and lap time measure different things. Use Gellhorn laps to compare tested cars, and the driver leaderboard to compare submitted runs. Keep tuning categories and test conditions consistent.' },
  { q: 'How do you use turn signals in GTA VI?', a: 'On PS5, tap left or right on the D-pad while driving.' },
  { q: 'Does GTA VI have a first-person view?', a: 'No. There’s no first-person option in the camera settings, so you drive in third person.' },
  { q: 'How does the vehicle scanner work in GTA VI?', a: 'Rob Nelson describes a phone scanner that shows whether a car is locked, has an alarm or tracker, what it is worth at a Pay ’n’ Spray or specialty car fence, and what it costs to register for yourself. Different vehicles can require tools such as a Slim Jim or key cloner.' },
  { q: 'Can changing cars or clothes help you escape the police in GTA VI?', a: 'Yes. In Nelson’s demonstration, switching to a car the police do not recognize lowers their perception of you. He also says buying and wearing a new outfit removes his current heat. Glasses, a cap, or a haircut alone do not address clothing the police already recognize.' },
  { q: 'Is GranForma replacing Pegassi for the Zorrusso in GTA VI?', a: 'For the Zorrusso, yes. Rockstar images published with Bloomberg’s October 14 feature already showed GranForma lettering, and the in-game manufacturer is GranForma. That does not mean every former Pegassi model has moved.', aHtml: 'For the <a href="{base}cars/vehicles/granforma-zorrusso/">Zorrusso</a>, yes. Rockstar images published with Bloomberg’s October 14 feature already showed GranForma lettering, and the in-game manufacturer is GranForma. That does not mean every former Pegassi model has moved.' },
  { q: 'Can I call my personal vehicle in GTA VI?', a: 'Yes. Call Joey from your phone contacts. In our test, he delivered the same personal car nearby within seconds after we had wrecked it.' },
  { q: 'Which cars has Rockstar confirmed for GTA VI?', a: 'Rockstar has named cars including the ’95 Grotti Cheetah and ’67 Vapid Dominator Buggy. The game itself now shows each car’s name, and we use those names, such as the ’19 Buffalo for the car known as the Buffalo STX. Our Cars section focuses on racing-relevant cars.', aHtml: 'Rockstar has named cars including the <a href="{base}cars/vehicles/grotti-cheetah-95/">’95 Grotti Cheetah</a> and <a href="{base}cars/vehicles/vapid-dominator-67-buggy/">’67 Vapid Dominator Buggy</a>. The game itself now shows each car’s name, and we use those names, such as the ’19 Buffalo for the car known as the Buffalo STX. Our <a href="{base}cars/">Cars section</a> focuses on racing-relevant cars.' },
  { q: 'How does stealing cars work in GTA VI?', a: 'Rockstar North’s Rob Nelson described a tiered system. Some parked vehicles require tools such as a Slim Jim or key cloner, while occupied vehicles can still be carjacked. A phone scanner can provide information about a vehicle’s security, tracker, value, and registration cost.' },
  { q: 'How do you get the Slim Jim in GTA VI?', a: 'Moses gives you the Slim Jim during the Chapter 2 mission Moses. It opens locked cars quietly, but it does not start cars with keyless ignition.' },
  { q: 'How do you get the key cloner in GTA VI?', a: 'Through the story, during Randy’s job to steal a Zorrusso in Chapter 3. Follow the prompt to install it through your phone’s settings.' },
  { q: 'Can stolen cars become personal vehicles?', a: 'Yes. Register an eligible stolen car to keep it as a personal vehicle. The scan shows whether it can be registered and what that costs. Available services depend on your story progress and the car’s tracker.' },
  { q: 'Where can you register cars in GTA VI?', a: 'Moses in Port Gellhorn registers eligible cars without trackers from his Chapter 2 introduction. After Welcome to Vice City in Chapter 3, Pay ’n’ Spray shops also register cars with standard trackers.' },
  { q: 'Where can you sell stolen cars in GTA VI?', a: 'Moses buys cars without a tracker. Pay ’n’ Spray shops take cars with a standard tracker from Chapter 3, and Randy in Balsero buys selected high-end cars after his Zorrusso job. The scan shows which buyers want the car.' },
  { q: 'Does GTA VI have car customization?', a: 'Yes. The mod-shop menu for Jason’s ’70 Ganado includes engine, transmission, and nitrous upgrades, plus bodywork, wheels, paint, and interiors.' },
  { q: 'What mod shops are confirmed for GTA VI?', a: 'Rideout Customs in Vice City and One-Eyed Willie’s in Lake Leonida are exclusive to the Ultimate Edition. Other mod shops have their own specialties; Coastal Auto Care, for example, offers retro builds, including the Ganado Retro Build.' },
  { q: 'Does GTA VI have garages?', a: 'Yes. Players begin with storage for three vehicles, and buying garages expands that capacity. You buy garages through the Vice City Real Estate app on your phone. Rockstar has also revealed garage content tied to the ’67 Vapid Dominator Buggy and ’55 Vapid Stanier.', aHtml: 'Yes. Players begin with storage for three vehicles, and buying garages expands that capacity. You buy garages through the Vice City Real Estate app on your phone. Rockstar has also revealed garage content tied to the <a href="{base}cars/vehicles/vapid-dominator-67-buggy/">’67 Vapid Dominator Buggy</a> and <a href="{base}cars/vehicles/vapid-stanier-55/">’55 Vapid Stanier</a>.' },
  { q: 'What kinds of racing are in GTA VI?', a: 'Story mode includes circuit, street, off-road, elimination, and demolition races, plus separate Race Challenges with medal targets. Gellhorn events have car-rating requirements and offer rentals.' },
  { q: 'How many races are in GTA VI?', a: 'Story mode has 40 unique races and 13 separate Race Challenges. For 100% completion, win 30 different races and earn gold in 10 Race Challenges.' },
  { q: 'Is Gellhorn International Raceway confirmed?', a: 'Yes. Gellhorn International Raceway is a playable race venue south of Port Gellhorn, with several layouts.', aHtml: 'Yes. <a href="{base}time-attack/gellhorn-international-raceway/">Gellhorn International Raceway</a> is a playable race venue south of Port Gellhorn, with several layouts.' },
  { q: 'Are car meets confirmed in GTA VI?', a: 'Rockstar has shown car-meet and street-takeover scenes. Those scenes confirm the culture and setting, but Rockstar has not yet announced a player-hosted car-meet system.' },
  { q: 'Will GTA VI have a Race Creator?', a: 'Rockstar has not confirmed a Race Creator or player-built race jobs for GTA VI.' },
  { q: 'Where can I compare GTA VI cars?', a: 'Cars lets you browse racing-relevant GTA VI cars by class and manufacturer and compare the details currently available. Compare recorded prices, tested top speeds, and performance data where available, with sources and tuning categories kept alongside the results.', aHtml: '<a href="{base}cars/">Cars</a> lets you browse racing-relevant GTA VI cars by <a href="{base}cars/classes/">class</a> and <a href="{base}cars/manufacturers/">manufacturer</a> and <a href="{base}cars/compare/">compare</a> the details currently available. Compare recorded prices, tested top speeds, and performance data where available, with sources and tuning categories kept alongside the results.' },
  { q: 'Is there a Leonida Racing Discord for GTA VI racing?', a: 'Yes. Our Discord brings GTA racers, crews and car enthusiasts together to talk cars, share their work and find groups. You can join without a Leonida Racing account. A linked website account is needed for calendar event sign-ups and starting an LFG search.', aHtml: 'Yes. <a href="{base}discord/">Our Discord</a> brings GTA racers, crews and car enthusiasts together to talk cars, share their work and find groups. You can join without a Leonida Racing account. A linked website account is needed for calendar event sign-ups and starting an LFG search.' },
];

export const guideMethodology: string[] = [
  `Leonida Racing separates information into seven public evidence levels: <strong>Confirmed by Rockstar</strong>, <strong>Shown by Rockstar</strong>, <strong>Rockstar Interview</strong>, <strong>Reported from a Rockstar Demo</strong>, <strong>Tested in the game</strong>, <strong>Community Identification</strong>, and <strong>Not Confirmed</strong>. Each section carries one label for the evidence behind its central claim. When an individual detail uses a different evidence level, the text and its sources say so directly.`,
  `We check details in the game ourselves on PS5. These findings are labeled <strong>Tested in the game</strong>, with the car, shop, or event tested listed in the sources.`,
  `Official footage proves only what can be seen. A visible spoiler does not automatically prove a selectable spoiler upgrade, and a car at a meet does not automatically prove a player-hosted event system. Vehicle names and real-life inspirations identified by the community are labeled separately from Rockstar-confirmed names.`,
  `Sources are attached to the section they support, with timestamps for videos and official titles for screenshots. Reported theories may be included when they answer a useful question, with the publication and unconfirmed status made clear. Repetition across articles is not independent confirmation; an article’s use of leaked material is not presented as evidence from official footage. The page is updated when a source adds meaningful information or changes the evidence behind a claim.`,
];

/** Vehicle-count card (Fausto 2026-11-21): total of the nine in-game car types, no longer the GTABase count.
 *  Text: Codex 21.11.2026 (Guide-Update-2, point 17). Update value + checked date together. */
export const GUIDE_VEHICLES = {
  value: '157',
  label: 'Cars in the game',
  sourceLabel: '',
  sourceUrl: '',
  note: 'Across the game’s nine car types, as listed in the in-game vehicle progress menu. Checked November 21, 2026.',
};
