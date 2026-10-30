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
// Never add leak information here. Visible text: "GTA VI"; meta: "GTA 6".

/** Date shown as "Last updated" and used as dateModified. Change on every content update. */
// Bump on EVERY content change to the Guide (visible as "Last updated" + Article dateModified) — Fausto 27.10.2026.
export const GUIDE_UPDATED = '2026-10-30';
export const GUIDE_PUBLISHED = '2026-10-03';

export interface GuideSource { label: string; url: string; note: string }
/** Source card parts: label = "Publisher — Title". Origin pill derived from the publisher (Claude, 18.10.2026, DEC-0140):
 *  Rockstar's own channels = official, fan sites/databases = community, everything else = press. */
export type SourceKind = 'official' | 'press' | 'community';
const OFFICIAL = ['Rockstar Games', 'Rockstar Newswire', 'Rockstar Support'];
const COMMUNITY = ['GTABase', 'RockstarINTEL', 'TGG'];
export function sourceParts(src: GuideSource): { publisher: string; title: string; kind: SourceKind } {
  const i = src.label.indexOf(' — ');
  const publisher = i > 0 ? src.label.slice(0, i) : src.label;
  const title = i > 0 ? src.label.slice(i + 3) : src.label;
  const kind: SourceKind = OFFICIAL.includes(publisher) ? 'official' : COMMUNITY.includes(publisher) ? 'community' : 'press';
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
  classicCar: img('classic-collection-car', W3, 1920, 1080, 'A turquoise Sirius coupe with black side stripes and a rear spoiler, viewed from behind in GTA VI.', `Sirius from the Classic Car Collection, Ultimate Edition. ${RS}`),
  circuitRace: img('circuit-race', [640, 1280, 1672], 1672, 941, 'A pack of race cars on a wet, palm-lined circuit in GTA VI.', 'Circuit racing in GTA VI — Rockstar Games.'),
  streetRace: img('street-race', [640, 1280], 1280, 720, 'Customized cars race along a street at sunset, with a blue exhaust flame behind the nearest car in GTA VI.', 'Street racing in GTA VI — Rockstar Games.'),
  circuitEmpty: img('circuit-empty', [640, 1280, 1672], 1672, 941, 'An empty race circuit lined with palms, fencing, and blue and red painted trackside areas in GTA VI.', 'The circuit from official GTA VI footage, with the race cars digitally removed for a clearer view of the track.'),
  carMeet: img('car-meet', [640, 1280, 1919], 1919, 1079, 'People gather beside customized cars at an outdoor parking-lot meet in GTA VI.', 'A car meet in GTA VI — Rockstar Games.'),
  takeover: img('street-takeover', [640, 1280, 1672], 1672, 941, 'A crowd surrounds cars and tire smoke at a nighttime street takeover in GTA VI, viewed from above.', 'A street takeover in GTA VI — Rockstar Games.'),
};
// Share image (og-guide.jpg) = circuit race crop (Fausto 27.10.2026); the band is the Launch Trailer night race (1:03).
export const guideHeroImage = IMG.circuitRace;

export interface GuideSection {
  id: string;
  /** 1–2 images, shown after the first paragraph */
  images?: GuideImage[];
  title: string;
  status?: string;
  paragraphs: string[]; // trusted HTML (<strong>, internal <a href="{base}…">)
  cta?: { label: string; href: string };
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
      `GTA VI brings back familiar in-game manufacturers and models while adding vehicles created specifically for Leonida.${RETURNING_SENTENCE} Rockstar has named only part of the lineup, while many vehicles shown in official trailers and screenshots are identified by their design and badges. Those are community identifications, not Rockstar-confirmed names. Our <a href="{base}cars/">Cars section</a> focuses on racing-relevant cars and is not a complete list of every vehicle shown for GTA VI.`,
      `Official footage also shows motorcycles, watercraft, and aircraft, but this guide focuses on cars and racing. A car appearing on screen does not by itself establish how it can be owned, stored, or customized.`,
      `Open Cars for individual models, <a href="{base}cars/classes/">GTA classes</a>, <a href="{base}cars/manufacturers/">manufacturers</a>, first appearances, release information, and real-life inspirations. Compare recorded prices and tested performance where results are available; individual car pages keep the source and tuning category beside the data.`,
      `Rockstar released the Launch Trailer on October 15, 2026. It joins the official footage used to document vehicles, while model identifications remain separate from Rockstar-confirmed names.`,
    ],
    cta: { label: 'Explore Cars', href: 'cars/' },
    sources: [
      { label: 'Rockstar Games — GTA VI Launch Trailer', url: LAUNCH, note: 'October 15, 2026: new official trailer; not a complete vehicle list.' },
      { label: 'Rockstar Games — GTA VI Media', url: R_MEDIA, note: 'official trailers and media library.' },
      { label: 'Rockstar Games — GTA VI Screenshots', url: R_SHOTS, note: 'official screenshot titles, including named Ultimate Edition vehicles.' },
      { label: 'Rockstar Support — GTA VI Platforms, Editions, and Versions', url: R_SUPPORT, note: 'named edition vehicles and content.' },
      // Fausto 15.10.2026: source of the vehicle count on the home Guide card. Note: Codex 18.10. (Racing-Fahrzeug-News-2026-10-18.md), Fausto: show 311 with GTABase.
      { label: 'GTABase — GTA 6 Cars & Vehicles List', url: 'https://www.gtabase.com/gta-6/vehicles/', note: 'Community database listing 311 entries across all vehicle types; entries do not all have the same evidence basis. Checked October 18, 2026.' },
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
      `A familiar exotic with unfamiliar lettering tells another part of the story. The <a href="{base}cars/vehicles/granforma-zorrusso/">Zorrusso</a>-associated car in the Rockstar images published with Bloomberg’s October 14 feature carries <strong>GranForma</strong> lettering on the rear, replacing the familiar Pegassi branding. Its real-world inspiration is the Italdesign Zerouno. Whether GranForma denotes the manufacturer, a customizer or a particular version remains unresolved.`,
      `The pattern suggests that Rockstar may be bringing some fictional marques into closer alignment with their real-world inspirations. It is a change worth following if you know the older cars—or organize your garage by manufacturer. Rockstar has not announced a rule for the full lineup, and a changed badge on one car does not mean every model under its old marque is moving with it.`,
    ],
    sources: [
      { label: 'RockstarINTEL — 2 More GTA 6 Screenshots Released', url: 'https://rockstarintel.com/2-more-gta-6-screenshots-released/', note: 'October 14, 2026: reports Rockstar-supplied Bloomberg images and the GranForma reading; model and brand interpretation are not a Rockstar announcement.' },
      { label: 'Bloomberg — The Making of Grand Theft Auto VI', url: 'https://www.bloomberg.com/features/2026-grand-theft-auto-6-making-of/', note: 'Original feature associated with the images.' },
      { label: 'Rockstar Games — GTA VI: An Extended Look', url: `${EXT_LOOK}&t=1186s`, note: 'August 27, 2026: Buckingham badge on the Jubilee’s front fender at approximately 19:46 and on the tailgate at approximately 20:07.' },
      { label: 'GTABase — Jubilee in GTA VI', url: 'https://www.gtabase.com/gta-6/vehicles/jubilee', note: 'Community identification of the Buckingham Jubilee.' },
      { label: 'GTABase — Jubilee in GTA Online', url: 'https://www.gtabase.com/grand-theft-auto-v/vehicles/enus-jubilee', note: 'The model’s earlier Enus identity.' },
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
      `Rockstar has also assembled a vehicle-handling team that includes real race-car drivers. That signals serious attention to how vehicles behave, but it is not proof that GTA VI is a full driving simulation. Exact grip levels, drivetrain advantages, damage behavior, and the fastest cars still need to be tested in the released game.`,
      `Narrower streets and dense traffic put more demands on your driving, according to Nelson. You can also switch between Jason and Lucia while the other character takes the wheel. At around <a href="https://www.youtube.com/watch?v=tJbzMqJGH4k&amp;t=1120s" rel="noopener">18:40</a> in the Extended Look, the player switches from Jason at the wheel to Lucia, who shoots at the pursuing cars while Jason keeps driving. Nelson describes moments where taking out a pursuing car’s tires blocks the cars following it.`,
      `IGN’s demo also includes a ride with <strong>Ryde Me</strong>, the game’s ride-hailing service. Nelson describes it as a way to fast travel, with the option to ride along and chat.`,
      `Small details matter when you’re just out for a drive, too. At around <a href="https://www.youtube.com/watch?v=tJbzMqJGH4k&amp;t=506s" rel="noopener">8:26</a> in the Extended Look, the <a href="{base}cars/vehicles/ubermacht-sentinel-classic-cabrio/">Sentinel Classic Cabrio</a> drives with a working turn signal. The footage does not show whether you operate the indicators yourself or the game handles them.`,
    ],
    sources: [
      { label: 'Rockstar Games — Grand Theft Auto VI: An Extended Look', url: `${EXT_LOOK}&t=506s`, note: 'August 27, 2026: Sentinel Classic Cabrio with a working turn signal at approximately 8:26.' },
      { label: 'IGN — GTA 6: The Big Interview', url: IGN_FULL, note: 'October 7, 2026; July demonstration.' },
      { label: 'GamesRadar — Rob Nelson on GTA VI driving physics', url: 'https://www.gamesradar.com/games/grand-theft-auto/gta-6-driving-is-the-best-parts-of-gta-4-but-with-the-accessibility-of-gta-5-says-rockstar-boss/', note: 'September 4, 2026: direct Nelson quotation covering drivetrain, tires, suspension, steering, and the rebuilt physics model.' },
      { label: 'Dazed — GTA VI: An Exclusive Deep Dive', url: DAZED, note: 'September 6, 2026: vehicle-handling team described as including race-car drivers.' },
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
      `Edge identifies <strong>WAINK</strong> as the app listing cars wanted by fences, including their security and tracking details. The fence usually has equipment to block a tracker’s signal at the drop-off.`,
      `Stolen cars can be sold or registered as personal vehicles. Nelson told Famitsu that an unregistered stolen vehicle remains available for a while, appears with a gray radar icon, and disappears when the game is restarted. Registration makes the vehicle yours, while the complete list of eligible vehicles and the later-game ownership limit remain unannounced.`,
      `An <strong>advanced tracker</strong> can turn a slow getaway into a police alert: Nelson says it pings your location when you drive too slowly. Condition matters at delivery, too. A car fence pays less for damage, and you can repair the car before selling it.`,
      `The driver can be a problem before you even reach the ignition. Edge describes motorists who flee and others who fight back with a weapon. An owner can also report a theft after you have driven away.`,
      `A car fence can also point you toward a specific job. In the demo, one has supplied a door code for a <strong>police impound lot</strong>, where Jason and Lucia can steal the requested car together or alone. This is a theft job, not an explanation of how to recover your own impounded vehicle. Nelson also says there are points in the story where earning money through activities such as stealing and selling cars is needed to advance the mission flow.`,
    ],
    sources: [
      { label: 'IGN — GTA 6: The Big Interview', url: IGN_FULL, note: 'October 7, 2026; July demonstration.' },
      { label: 'Famitsu — Exclusive Interview with Rob Nelson', url: FAMITSU, note: 'August 28, 2026: vehicle registration, three initial storage spaces, purchasable garages, and the persistence rules for unregistered stolen vehicles.' },
      { label: 'Edge / GamesRadar — Grand Theft Auto VI exclusive: The state that never sleeps', url: EDGE_GR, note: 'October 29, 2026: WAINK, car security, trackers, and delivery condition. Checked October 30, 2026.' },
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
      `Edge’s pursuit adds spike strips laid across the road.`,
    ],
    sources: [
      { label: 'IGN — GTA 6: The Big Interview', url: IGN_FULL, note: 'October 7, 2026; July demonstration: reporting, recognition, outfit changes, vehicle swaps, splitting up, and escape advice.' },
      { label: 'Edge / GamesRadar — Grand Theft Auto VI exclusive: The state that never sleeps', url: EDGE_GR, note: 'October 29, 2026: spike strips during a police pursuit. Checked October 30, 2026.' },
    ],
  },
  {
    id: 'ownership',
    images: [IMG.safehouse, IMG.buggy],
    title: 'Vehicle Ownership, Garages, and Safehouse Vehicles',
    status: 'Rockstar Interview',
    paragraphs: [
      `GTA VI has personal vehicles and expandable garage storage. Nelson told Famitsu that players begin with room for three vehicles. If all three spaces are occupied, one vehicle must be sold before another can be registered as personal. Buying garages around the map expands that capacity. Rockstar has not announced the later-game ownership limit, whether individual properties have different capacities, or how freely vehicles can be moved between garages.`,
      `Rockstar’s Ultimate Edition includes Jason’s Safehouse Vehicles and the Ganado Retro Build. It also includes the <a href="{base}cars/vehicles/vapid-dominator-67-buggy/">’67 Vapid Dominator Buggy</a> with a garage, while the Vintage Vice City Pack includes the <a href="{base}cars/vehicles/vapid-stanier-55/">’55 Vapid Stanier Sedan</a> with a garage.`,
      `The accompanying Rockstar press material identifies those locations as Paradise Garage in Watson Bay and Shore Court Garage near Ocean Beach. They are personal garages, not confirmed tuning shops.`,
      `Your personal vehicle also acts as a mobile stash for spare outfits and purchased weapons. Edge names the delivery service <strong>Scooter Bros</strong>: pay through the phone app, and a driver brings your car in seconds before leaving on a scooter. At around <a href="https://www.youtube.com/watch?v=tJbzMqJGH4k&amp;t=1069s" rel="noopener">17:49</a> in the Extended Look, Lucia changes her outfit while sitting in the car with Jason.`,
    ],
    sources: [
      { label: 'IGN — GTA 6: The Big Interview', url: IGN_FULL, note: 'October 7, 2026; July demonstration.' },
      { label: 'Famitsu — Exclusive Interview with Rob Nelson', url: FAMITSU, note: 'August 28, 2026: three initial vehicle spaces, the replacement rule when storage is full, and purchasable garages that expand ownership capacity.' },
      { label: 'Rockstar Games — GTA VI Editions', url: R_EDITIONS, note: 'Jason’s Safehouse Vehicles, Ganado Retro Build, and the named vehicle bonuses.' },
      { label: 'Rockstar Games — GTA VI Screenshots', url: R_SHOTS, note: '“Jason’s Safehouse Vehicles,” “Ganado Retro Build,” and “’67 Vapid Dominator Buggy.”' },
      { label: 'Rockstar Support — GTA VI Platforms, Editions, and Versions', url: R_SUPPORT, note: 'edition and pre-order package contents.' },
      { label: 'TheSixthAxis — GTA VI Ultimate Edition and Vintage Vice City Pack', url: TSA, note: 'June 24, 2026: documentation of Rockstar’s accompanying descriptions for Paradise Garage and Shore Court Garage.' },
      { label: 'Edge / GamesRadar — Grand Theft Auto VI exclusive: The state that never sleeps', url: EDGE_GR, note: 'October 29, 2026: Scooter Bros delivery and vehicle storage. Checked October 30, 2026.' },
      { label: 'Vice City Hustle — GTA 6 Edge: K9 Units, Scooter Bros, Cash Gates', url: VCH_EDGE, note: 'October 29, 2026: secondary Edge coverage of WAINK, personal-vehicle delivery, and fuel. Not a separate demonstration. Checked October 30, 2026.' },
    ],
  },
  {
    id: 'fuel',
    title: 'Fuel, EV Charging, and Gas-Station Repairs',
    status: 'Reported from a Rockstar Demo',
    paragraphs: [
      `Edge reports a fuel gauge and engine-health readout for every vehicle. Refueling is described as quick, with cars covering long distances between stops.`,
      `<strong>GamesRadar</strong> reports TGG’s account of a Rockstar North preview: a gas-station interaction offered refueling or vehicle repair, with the fill-up estimated at around ten seconds. That timing is the previewer’s estimate, not a fixed specification for every car.`,
      `<strong>PC Gamer</strong> also reports EV charging in the same preview account. Charging and gas-station repairs are reported demo features, not a published rulebook for fuel consumption, charging speed, prices, or race conditions. Whether the systems can be disabled or apply differently across missions and racing remains unresolved.`,
    ],
    sources: [
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
    title: 'Car Customization and Mod Shops',
    status: 'Confirmed by Rockstar',
    paragraphs: [
      `Vehicle customization is confirmed for GTA VI. Rockstar has named two specialist shops included with the Ultimate Edition: <strong>Rideout Customs Mod Shop</strong> in Vice City and <strong>One-Eyed Willie’s Mod Shop</strong> in Lake Leonida.`,
      `Rockstar’s accompanying descriptions give the shops different identities. Rideout Customs focuses on detailed interiors, wheels, and donk builds. One-Eyed Willie’s specializes in off-road modifications and hand-painted vehicle designs. The same material describes the wider selection as both artistic and performance-oriented.`,
      `Official screenshots support those descriptions with custom upholstery, steering wheels, oversized street wheels, lifted off-road builds, protective hardware, and painted graphics. They show what finished vehicles can look like; they do not reveal a complete parts menu. Engine stages, transmissions, brakes, suspension options, compatibility, and prices remain unannounced.`,
    ],
    sources: [
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
      `The <strong>Ganado Retro Build</strong> is another confirmed example of a vehicle-specific conversion. Rockstar has shown and named the package for Jason’s Vapid Ganado. These examples prove that curated restorations and special builds exist, but they do not yet establish a universal restoration system for every car.`,
    ],
    sources: [
      { label: 'Rockstar Support — GTA VI Editions', url: R_SUPPORT, note: 'Classic Car Collection and Ganado Retro Build.' },
      { label: 'Rockstar Games — GTA VI Screenshots', url: R_SHOTS, note: '“Classic Car Collection 01–06” and “Ganado Retro Build.”' },
      { label: 'TheSixthAxis — GTA VI Ultimate Edition details', url: TSA, note: 'documentation of Rockstar’s restoration description.' },
    ],
  },
  {
    id: 'racing',
    images: [IMG.circuitRace, IMG.streetRace],
    title: 'Racing in GTA VI',
    status: 'Shown by Rockstar',
    paragraphs: [
      `GTA VI includes structured circuit, off-road, and street racing. Rockstar’s Extended Look shows all three with an active race HUD rather than presenting them only as background scenes.`,
      `At around <a href="https://www.youtube.com/watch?v=tJbzMqJGH4k&amp;t=1061s" rel="noopener">17:41</a>, 16 cars race two laps on a wet paved circuit, with position, lap, and timing information on screen. At around <a href="https://www.youtube.com/watch?v=tJbzMqJGH4k&amp;t=1115s" rel="noopener">18:35</a>, a 12-entry field of quads, motorcycles, and off-road pickups runs two laps on a dirt course. At around <a href="https://www.youtube.com/watch?v=tJbzMqJGH4k&amp;t=1221s" rel="noopener">20:21</a>, a six-car street race tracks progress as a percentage. These are the events shown, not a fixed rule for grid sizes or race distances.`,
      `Racing can interrupt a getaway, too. Edge describes a customized 4x4 with purple underglow challenging Nelson’s station wagon on the highway. Its occupants keep taunting him until he accepts, and a passenger hangs out of the window as they pull ahead.`,
      `The footage shows organized racing, but the full event rules remain open: entry requirements, eligible classes, rewards, championships, and online support. A race shown in the story-game presentation does not establish a GTA VI Online racing mode.`,
      `Nitrous returns in the street race shown in the Extended Look. Which cars can run it, how you get it, and whether every event allows it are separate questions the footage does not answer.`,
      `For your own car comparisons, keep <strong>top speed</strong> separate from <strong>lap time</strong>. One measures speed; the other includes the corners, braking, and acceleration of a particular route. Our car rankings distinguish reference testing from driver leaderboard results. Compare the same tuning category and read the test conditions before treating two times as equivalent.`,
    ],
    cta: { label: 'Go to Time Attack', href: 'time-attack/gellhorn-international-raceway/' },
    sources: [
      { label: 'Rockstar Games — Grand Theft Auto VI: An Extended Look', url: `${EXT_LOOK}&t=1061s`, note: 'August 27, 2026: circuit race at approximately 17:41–17:47, off-road race at 18:35–18:39, and street race with nitrous at 20:21–20:25.' },
      { label: 'Rockstar Newswire — An Extended Look', url: 'https://www.rockstargames.com/newswire/article/4k138k8okkk483/grand-theft-auto-vi-an-extended-look-now-playing', note: 'confirms the presentation was captured entirely from in-game PlayStation 5 footage.' },
      { label: 'Game Informer — GTA VI: Welcome to Leonida', url: 'https://gameinformer.com/feature/2026/09/29/grand-theft-auto-vi-welcome-to-leonida', note: 'September 29, 2026: Rockstar cover story additionally identifies street and off-road racing among the activities; full article access may require a subscription.' },
      { label: 'Edge / GamesRadar — Grand Theft Auto VI exclusive: The state that never sleeps', url: EDGE_GR, note: 'October 29, 2026: highway challenge involving a customized 4x4 with purple underglow. Checked October 30, 2026.' },
      { label: 'GTAVice — Edge preview and print-only Phil Hooker Q&A', url: GTAVICE_EDGE, note: 'October 29, 2026: secondary coverage, including attributed excerpts from the print-only Q&A and the reported 23-station total. Checked October 30, 2026.' },
      { label: 'Rockstar Support — GTAV Title Update 1.47 Notes', url: 'https://support.rockstargames.com/articles/6clYU1N1kk9hiaBceBu81d/gtav-title-update-1-47-notes-ps4-xbox-one-pc', note: 'Rockstar refers to Nitro Boost on Arena contender vehicles in GTA Online. Historical context only; not evidence of GTA VI upgrade availability. Checked October 30, 2026.' },
    ],
  },
  {
    id: 'gellhorn',
    images: [IMG.circuitEmpty],
    title: 'Gellhorn and the Circuit',
    status: 'Shown by Rockstar',
    paragraphs: [
      `Rockstar has shown a dedicated paved race circuit in GTA VI, complete with a grid, curbing, timing, position, and lap information. Trailer 2 separately shows Lucia wearing clothing marked <strong>Gellhorn International</strong> with a race-car graphic.`,
      `The venue is widely known as <strong>Gellhorn International Raceway</strong>, and Leonida Racing uses that established name for its <a href="{base}time-attack/gellhorn-international-raceway/">Time Attack competition</a>. The source record remains more precise: Rockstar’s public footage shows the circuit and the Gellhorn International branding, but does not display the full venue name alongside the race. The complete layout, location, classes, and event schedule remain unannounced.`,
      `Sebring International Raceway is a rumored inspiration, discussed in coverage by <strong>The Drive</strong> and <strong>Jalopnik</strong>. Parts of that comparison rely on leaked maps rather than official footage. It is a published theory about the inspiration, not a Rockstar-confirmed connection or proof that Gellhorn copies Sebring’s layout, length, or corners.`,
    ],
    cta: { label: 'Visit Gellhorn Time Attack', href: 'time-attack/gellhorn-international-raceway/' },
    sources: [
      { label: 'Jalopnik — GTA VI Has A Race Track', url: 'https://www.jalopnik.com/2246099/gta-6-race-track-new-details/', note: 'August 27, 2026: discusses Sebring as an inspiration; not an independent Rockstar confirmation.' },
      { label: 'The Drive — Is Sebring Raceway Going To Be in GTA 6?', url: 'https://www.thedrive.com/news/theres-convincing-evidence-that-sebring-raceway-will-be-in-grand-theft-auto-6', note: 'April 3, 2026: documents the Sebring theory; map/leak-derived arguments are not treated as verified circuit facts.' },
      { label: 'Rockstar Games — Grand Theft Auto VI: An Extended Look', url: EXT_LOOK, note: 'approximately 17:41–17:47: official circuit-racing footage.' },
      { label: 'Rockstar Games — GTA VI Trailer 2', url: 'https://www.youtube.com/watch?v=VQRLujxTm3c', note: 'approximately 1:57: “Gellhorn International” clothing and race-car graphic.' },
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
      `Several details players naturally want to know are still open. Rockstar has not published a complete vehicle list, dealership structure, later-game ownership limit, property-by-property garage capacities, tuning catalog, parts compatibility list, upgrade pricing, or final performance figures.`,
      `The full damage model, insurance, recovery rules for owned vehicles, wheel support, manual shifting, race creation tools, and GTA VI online racing systems remain unresolved in the reviewed sources. Refueling, EV charging, and gas-station repairs have been reported from a Rockstar demo; their final rates, costs, settings, and application to racing are separate open questions.`,
      `This section will shrink as Rockstar releases more information and the finished game provides testable answers. Until then, “not confirmed” means exactly that—not impossible, not secretly ruled out, just not ready to call a fact.`,
    ],
    sourcesHeading: 'Official material checked for this section',
    sources: [
      { label: 'Rockstar Games — GTA VI Launch Trailer', url: LAUNCH, note: 'October 15, 2026; no new racing rules inferred from trailer imagery.' },
      { label: 'Rockstar Games — Grand Theft Auto VI', url: 'https://www.rockstargames.com/VI', note: '' },
      { label: 'Rockstar Games — GTA VI Media', url: R_MEDIA, note: '' },
      { label: 'Rockstar Games — GTA VI Editions', url: R_EDITIONS, note: '' },
      { label: 'Rockstar Support — GTA VI Platforms, Editions, and Versions', url: R_SUPPORT, note: '' },
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
  { q: 'Do cars need fuel or charging in GTA VI?', a: 'Edge reports vehicle fuel gauges and quick refueling. EV charging is separately reported from TGG’s Rockstar North preview. Consumption rates, charging times, settings, and race-specific rules remain unresolved.' },
  { q: 'Can you repair cars at gas stations in GTA VI?', a: 'GamesRadar reports that TGG’s Rockstar preview included a gas-station choice between refueling and vehicle repair. That does not establish the services available at every station or their prices.' },
  { q: 'Does GTA VI have nitrous?', a: 'Yes. Nitrous is used in the street race shown in Rockstar’s Extended Look. Which cars can run it, how you get it, and the rules for individual events are not shown.' },
  { q: 'Are GTA VI Online races confirmed by the gameplay footage?', a: 'The circuit, off-road, and street races shown in the Extended Look do not establish an online racing mode. Online event formats, multiplayer grids, cross-play, and Race Creator support need their own confirmation.' },
  { q: 'Is the fastest GTA VI car also the best for Gellhorn?', a: 'Top speed and lap time measure different things. Use Gellhorn reference laps to compare tested cars, and the driver leaderboard to compare submitted runs. Keep tuning categories and test conditions consistent.' },
  { q: 'How does the vehicle scanner work in GTA VI?', a: 'Rob Nelson describes a phone scanner that shows whether a car is locked, has an alarm or tracker, what it is worth at a Pay ’n’ Spray or specialty car fence, and what it costs to register for yourself. Different vehicles can require tools such as a Slim Jim or key cloner.' },
  { q: 'Can changing cars or clothes help you escape the police in GTA VI?', a: 'Yes. In Nelson’s demonstration, switching to a car the police do not recognize lowers their perception of you. He also says buying and wearing a new outfit removes his current heat. Glasses, a cap, or a haircut alone do not address clothing the police already recognize.' },
  { q: 'Is GranForma replacing Pegassi for the Zorrusso in GTA VI?', a: 'The Zorrusso-associated car shown in Rockstar images published with Bloomberg’s October 14 feature carries GranForma lettering instead of the familiar Pegassi branding. Whether GranForma is the manufacturer, a customizer or a particular version remains unresolved. It does not establish a replacement for Pegassi across the lineup.', aHtml: 'The <a href="{base}cars/vehicles/granforma-zorrusso/">Zorrusso</a>-associated car shown in Rockstar images published with Bloomberg’s October 14 feature carries GranForma lettering instead of the familiar Pegassi branding. Whether GranForma is the manufacturer, a customizer or a particular version remains unresolved. It does not establish a replacement for Pegassi across the lineup.' },
  { q: 'Can I call my personal vehicle in GTA VI?', a: 'Yes. Edge describes Scooter Bros, a paid phone-app service that delivers your personal car. Delivery fees and restrictions have not been fully detailed.' },
  { q: 'Which cars has Rockstar confirmed for GTA VI?', a: 'Rockstar has named cars including the ’95 Grotti Cheetah and ’67 Vapid Dominator Buggy. More cars appear in official footage without being named; their model names are often community identifications. Rockstar has not published a complete official lineup. Our Cars section focuses on racing-relevant cars.', aHtml: 'Rockstar has named cars including the <a href="{base}cars/vehicles/grotti-cheetah-95/">’95 Grotti Cheetah</a> and <a href="{base}cars/vehicles/vapid-dominator-67-buggy/">’67 Vapid Dominator Buggy</a>. More cars appear in official footage without being named; their model names are often community identifications. Rockstar has not published a complete official lineup. Our <a href="{base}cars/">Cars section</a> focuses on racing-relevant cars.' },
  { q: 'How does stealing cars work in GTA VI?', a: 'Rockstar North’s Rob Nelson described a tiered system. Some parked vehicles require tools such as a Slim Jim or key cloner, while occupied vehicles can still be carjacked. A phone scanner can provide information about a vehicle’s security, tracker, value, and registration cost.' },
  { q: 'Can stolen cars become personal vehicles?', a: 'Yes. A stolen car can be registered as a personal vehicle. Unregistered stolen vehicles remain temporarily but disappear when the game is restarted. Players begin with storage for three vehicles and can buy garages to expand it; the complete list of eligible vehicles and the later-game ownership limit remain unannounced.' },
  { q: 'Does GTA VI have car customization?', a: 'Yes. Rockstar has confirmed specialist mod shops and described cosmetic and performance-oriented modifications. The complete parts catalog and standard-edition workshop options remain unknown.' },
  { q: 'What mod shops are confirmed for GTA VI?', a: 'Rideout Customs Mod Shop in Vice City and One-Eyed Willie’s Mod Shop in Lake Leonida are confirmed as Ultimate Edition content. Rideout Customs focuses on interiors, wheels, and donk builds; One-Eyed Willie’s specializes in off-road modifications and hand-painted designs.' },
  { q: 'Does GTA VI have garages?', a: 'Yes. Players begin with storage for three vehicles, and garages purchased around the map expand that capacity. Rockstar has also revealed garage content tied to the ’67 Vapid Dominator Buggy and ’55 Vapid Stanier. The later-game ownership limit and the capacity of each garage remain unannounced.', aHtml: 'Yes. Players begin with storage for three vehicles, and garages purchased around the map expand that capacity. Rockstar has also revealed garage content tied to the <a href="{base}cars/vehicles/vapid-dominator-67-buggy/">’67 Vapid Dominator Buggy</a> and <a href="{base}cars/vehicles/vapid-stanier-55/">’55 Vapid Stanier</a>. The later-game ownership limit and the capacity of each garage remain unannounced.' },
  { q: 'What kinds of racing are shown in GTA VI?', a: 'Rockstar’s Extended Look shows circuit, off-road, and street racing with position and timing information on screen. Event access, rewards, classes, championships, and online support remain open.' },
  { q: 'Is Gellhorn International Raceway confirmed?', aHtml: 'Rockstar has shown a dedicated paved circuit and separate Gellhorn International racing branding. Leonida Racing uses the established name <a href="{base}time-attack/gellhorn-international-raceway/">Gellhorn International Raceway</a>, while noting that Rockstar’s public footage has not yet displayed the complete venue name beside the circuit.', a: 'Rockstar has shown a dedicated paved circuit and separate Gellhorn International racing branding. Leonida Racing uses the established name Gellhorn International Raceway, while noting that Rockstar’s public footage has not yet displayed the complete venue name beside the circuit.' },
  { q: 'Are car meets confirmed in GTA VI?', a: 'Rockstar has shown car-meet and street-takeover scenes. Those scenes confirm the culture and setting, but Rockstar has not yet announced a player-hosted car-meet system.' },
  { q: 'Will GTA VI have a Race Creator?', a: 'Rockstar has not confirmed a Race Creator or player-built race jobs for GTA VI.' },
  { q: 'Where can I compare GTA VI cars?', a: 'Cars lets you browse racing-relevant GTA VI cars by class and manufacturer and compare the details currently available. Compare recorded prices, tested top speeds, and performance data where available, with sources and tuning categories kept alongside the results.', aHtml: '<a href="{base}cars/">Cars</a> lets you browse racing-relevant GTA VI cars by <a href="{base}cars/classes/">class</a> and <a href="{base}cars/manufacturers/">manufacturer</a> and <a href="{base}cars/compare/">compare</a> the details currently available. Compare recorded prices, tested top speeds, and performance data where available, with sources and tuning categories kept alongside the results.' },
  { q: 'Is there a Leonida Racing Discord for GTA VI racing?', a: 'Yes. Our Discord brings GTA racers, crews and car enthusiasts together to talk cars, share their work and find groups. You can join without a Leonida Racing account. A linked website account is needed for calendar event sign-ups and starting an LFG search.', aHtml: 'Yes. <a href="{base}discord/">Our Discord</a> brings GTA racers, crews and car enthusiasts together to talk cars, share their work and find groups. You can join without a Leonida Racing account. A linked website account is needed for calendar event sign-ups and starting an LFG search.' },
];

export const guideMethodology: string[] = [
  `Leonida Racing separates information into six public evidence levels: <strong>Confirmed by Rockstar</strong>, <strong>Shown by Rockstar</strong>, <strong>Rockstar Interview</strong>, <strong>Reported from a Rockstar Demo</strong>, <strong>Community Identification</strong>, and <strong>Not Confirmed</strong>. Each section carries one label for the evidence behind its central claim. When an individual detail uses a different evidence level, the text and its sources say so directly.`,
  `Official footage proves only what can be seen. A visible spoiler does not automatically prove a selectable spoiler upgrade, and a car at a meet does not automatically prove a player-hosted event system. Vehicle names and real-life inspirations identified by the community are labeled separately from Rockstar-confirmed names.`,
  `Sources are attached to the section they support, with timestamps for videos and official titles for screenshots. Reported theories may be included when they answer a useful question, with the publication and unconfirmed status made clear. Repetition across articles is not independent confirmation; an article’s use of leaked material is not presented as evidence from official footage. The page is updated when a source adds meaningful information or changes the evidence behind a claim.`,
];

/** Vehicle-count card. Value = GTABase count (Fausto 2026-10-03: GTABase has very good sourcing).
 *  Label from Codex; note adapted by Claude to name the source (Codex review pending).
 *  Update value + checked date together. */
export const GUIDE_VEHICLES = {
  value: '311',
  label: 'GTABase Entries',
  sourceLabel: 'GTABase',
  sourceUrl: 'https://www.gtabase.com/gta-6/vehicles/',
  note: 'Total across all vehicle types in GTABase’s database. This is not an official Rockstar vehicle count or a count of vehicles independently verified here. Checked October 18, 2026.',
};
