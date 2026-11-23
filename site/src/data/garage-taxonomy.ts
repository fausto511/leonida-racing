// Class and manufacturer landing pages of The Garage (RS-0050, DEC-0087,
// supersedes DEC-0059). Pages: /cars/classes/<slug>/ and
// /cars/manufacturers/<slug>/.
//
// COPY STATUS: all intros are Codex copy approved by Fausto (2026-10-01;
// Sports Classics, Declasse, Dundreary, Imponte corrected 2026-10-02 so only
// officially revealed vehicles are named).
import { vehicleOptions, type VehicleOption } from './vehicles';

export interface TaxonomyPage {
  slug: string; name: string; intro: string[]; copyStatus: 'draft-claude' | 'approved';
  /** Manufacturers: main real-life inspiration(s), max. 2 (Fausto, 2026-10-03).
   *  Derived from the approved intros; Codex to confirm (Karin, Dundreary). */
  inspiration?: string[];
  /** One sentence for the overview tile (Codex 2026-10-03, approved); replaces the model line. */
  teaser?: string;
}

export const classPages: TaxonomyPage[] = [
  { slug: 'super', name: 'Super', teaser: 'The Tempesta and Thrax make even a quiet parking space look like the entrance to a supercar show.', copyStatus: 'approved', intro: ["GTA VI’s Super class brings together very different takes on the modern exotic, from compact wedges and open cockpits to broad hypercar silhouettes. A Tempesta and a Thrax can share the same meet without sharing the same design philosophy. The appeal is in those differences: proportions, surfaces, and the way each manufacturer makes a fast-looking car its own."] },
  // 23.11.2026 (DEC-0253): sports + sedans intros changed for the class switch (Futo -> Coupes, Schafter V12 -> Sports). COPY: Claude placeholder -> Codex.
  { slug: 'sports', name: 'Sports', teaser: 'A widebody Comet ’88 and a low-slung Banshee share this category, giving your next garage shortlist very different starting points.', copyStatus: 'draft-claude', intro: [
    'The GTA VI Sports class covers nearly every kind of driver’s car: German coupes, electric grand tourers, American roadsters, Japanese tuners, and plenty in between. It is where cars inspired by the Dodge Viper, Chevrolet Corvette, BMW M3, and Porsche 911 share the same grid.',
  ] },
  { slug: 'muscle', name: 'Muscle', teaser: 'The Deviant ’72 wears its age proudly, while the Dominator GT brings open-top muscle to a much newer generation.', copyStatus: 'approved', intro: [
    'GTA VI Muscle cars bring big American engines and bold shapes to our car database, from classic pony cars and lowriders to modern Mustang-, Challenger-, and Camaro-inspired builds. The lineup runs from the Buccaneer ’65 and Gauntlet Custom ’69 to the Gauntlet Hellfire and the many faces of the Dominator. Some are clean, some are loud, and subtlety is rarely the point.',
  ] },
  { slug: 'coupes', name: 'Coupes', teaser: 'The Windsor Drop makes an entrance before anyone gets out, while the FR36 offers a more understated take on two doors.', copyStatus: 'approved', intro: ["GTA VI’s Coupes class runs from understated two-door cars to long luxury shapes and open-top cruisers. The Windsor Drop’s formal proportions, the FR36’s more compact profile, and the Apoc’s grand-tourer shape give collectors very different starting points. A fixed roof or an open cabin can change the mood of the whole car meet."] },
  { slug: 'sedans', name: 'Sedans', teaser: 'Chrome on the Stanier ’55 and a long roof on the Parkland ’71 give this everyday category two very different personalities.', copyStatus: 'draft-claude', intro: [
    'GTA VI Sedans range from ordinary-looking four-doors and wagons to full-size American classics and serious sports sedans. The roster stretches from the Stanier ’98 and Emperor ’85 to the Feroci ’98, Tailgater S, and Schafter S. Crown Victoria, Lexus GS, Audi, and Cadillac influences make this class far less anonymous than the body style suggests.',
  ] },
  { slug: 'suvs', name: 'SUVs', teaser: 'Park the Riata ’70 beside a Cavalcade XL and see how far the SUV silhouette has travelled across generations.', copyStatus: 'approved', intro: [
    'GTA VI SUVs run from city crossovers to full-size luxury trucks and old-school utility rigs. The Baller, Dubsta, Toros, and Granger families cover very different ideas of what an SUV should be. Range Rover, Mercedes-Benz G-Class, Lamborghini Urus, Ford, and Jeep influences give the class plenty of ways to take up more than its share of the road.',
  ] },
  // 23.11.2026 (DEC-0253): Pickups/SUVs left Off-Road; text rewritten. COPY: Claude placeholder -> Codex.
  { slug: 'off-road', name: 'Off-Road', teaser: 'The Dominator ’67 Buggy and the Patriot Mil-Spec take two very different routes off the pavement.', copyStatus: 'draft-claude', intro: [
    'GTA VI Off-Road is a small class for vehicles built for the trail. Pickups and SUVs now have their own classes, so this one is for the specialists. The Dominator ’67 Buggy turns first-generation Mustang lines into a trail build, and the Hummer H1-inspired Patriot Mil-Spec brings military-style bulk.',
  ] },
  // 23.11.2026 (Fausto, DEC-0253): classes follow the vehicle type shown in the game; Pickups and Vans added,
  // Sports Classics removed. COPY: Claude placeholders -> Codex.
  { slug: 'pickups', name: 'Pickups', teaser: 'A Bison with a work-truck stance and a lifted Caracara 4x4 show how far a pickup can go from the farm road.', copyStatus: 'draft-claude', intro: [
    'GTA VI Pickups cover work trucks, lifted 4x4s and everyday haulers. The Bison family, the Caracara 4x4, the Sandking XL and the Rebel show how wide the range runs, from a clean daily truck to something built for the trail. An open bed is the common ground; what goes in it is up to you.',
  ] },
  { slug: 'vans', name: 'Vans', teaser: 'The Sojourn and the Vivanite trade a sporty shape for space, and that is exactly the point.', copyStatus: 'draft-claude', intro: [
    'GTA VI Vans are the practical end of the garage: room for the crew, the gear and the drive home. The Sojourn and the Vivanite bring family-vehicle shapes to Leonida, and a van makes an honest support vehicle at any car meet.',
  ] },
];

export const manufacturerPages: TaxonomyPage[] = [
  { slug: 'vapid', name: 'Vapid', inspiration: ['Ford'], teaser: 'The Ganado ’70 puts a pickup bed behind classic car lines; the Dominator ’67 Buggy takes those proportions somewhere muddier.', copyStatus: 'approved', intro: ['Vapid brings Ford-inspired car culture into GTA VI, led by generations of Dominators alongside pickups, SUVs, and the Stanier sedans. That puts the Dominator, Stanier, Caracara, Aleutian, and Riata families under one badge. From old-school muscle to lifted builds, the Ford influence is hard to miss.'] },
  { slug: 'declasse', name: 'Declasse', inspiration: ['Chevrolet'], teaser: 'The Impaler ’80 and Tulip M-100 bring squared-off silhouettes to a Declasse shortlist that rewards looking beyond the obvious sports cars.', copyStatus: 'draft-claude', intro: ['Declasse brings several generations of American performance and utility vehicles into GTA VI, from the Impaler and Tulip muscle cars to the Granger SUVs. The Vigero ZX Convertible adds modern Camaro-inspired styling, while the Mamba GT ’64 brings a Shelby Daytona-shaped racer to the Sports class. Chevrolet influence connects much of the range, but it does not explain every model beneath the badge.'] },
  { slug: 'albany', name: 'Albany', inspiration: ['Cadillac', 'Buick'], teaser: 'A Buccaneer ’65 catches the eye at a meet, while the Primo offers a quieter starting point for an Albany collection.', copyStatus: 'draft-claude', intro: ['Albany puts American luxury into GTA VI, drawing mainly from Cadillac and Buick. Its lineup moves from the Emperor ’85 and Manana ’77 classics to the Cavalcade XL and V-STR, covering several decades without losing that unmistakable big-car presence. From boulevard cruisers to full-size SUVs and sports sedans, Albany rarely does understated.'] },
  { slug: 'karin', name: 'Karin', inspiration: ['Toyota', 'Lexus'], teaser: "The compact, angular body of the Futo ’85 stands apart from the Asterope GZ’s everyday sedan shape, even with the same badge up front.", copyStatus: 'approved', intro: ["Karin brings a wide slice of Japanese car culture to GTA VI, from the Asterope GZ and Feroci ’98 sedans to the Futo ’85 sports car. Toyota is the clearest influence, with Lexus cues appearing across individual models. The Vivanite adds a family-vehicle shape, while the Rebel brings the badge into off-road territory."] },
  { slug: 'bravado', name: 'Bravado', inspiration: ['Dodge'], teaser: 'A Banshee’s sweeping bodywork and a Gauntlet Custom ’69’s blunt nose give Bravado collectors two unmistakable shapes to look for.', copyStatus: 'approved', intro: ['Bravado brings Dodge-inspired American performance to GTA VI, from the Viper-shaped Banshee and Charger-inspired Buffalo family to the Challenger-style Gauntlets and Durango-like Dorado. Our database groups these models across Sports, Muscle and SUVs, giving the badge a range that extends well beyond its two-door muscle cars.'] },
  { slug: 'ubermacht', name: 'Übermacht', inspiration: ['BMW'], teaser: 'The Sentinel ’85 can leave its angular cabin open to the sky, while the Cypher keeps a tighter modern silhouette.', copyStatus: 'approved', intro: ['BMW influence runs through every generation of Übermacht represented in GTA VI. The Cypher draws from the M2 and the Apoc from the 6 Series, while the Sentinel ’85 brings the E30 era into the lineup. That gives BMW fans coupes, cabrios, modern tuner builds, and 1980s classics to choose from.'] },
  { slug: 'pfister', name: 'Pfister', inspiration: ['Porsche'], teaser: 'Put the compact Growler beside the taller Astron to see how the Pfister badge travels beyond its familiar sports-car outline.', copyStatus: 'draft-claude', intro: ['Pfister’s GTA VI range carries Porsche-inspired design across several generations of sports cars, from the Comet ’88 and Comet S2 to the compact Growler. The Neon adds an electric grand-tourer shape, while the Astron brings the family resemblance to an SUV. Not every Pfister has to be a two-door sports car.'] },
  { slug: 'grotti', name: 'Grotti', inspiration: ['Ferrari'], teaser: 'The Cheetah ’95 pairs pop-up headlights with bold side strakes, giving a Grotti collection a distinctive place to begin.', copyStatus: 'approved', intro: ["Grotti covers several eras of Ferrari-inspired design in GTA VI. The Cheetah ’95 brings a classic wedge shape, while the Carbonizzare and Itali RSX represent different generations of Italian sports-car styling. That mix gives a Grotti garage its character: familiar Italian design cues, expressed very differently from one era to the next."] },
  { slug: 'obey', name: 'Obey', inspiration: ['Audi'], teaser: 'Choose the Tailgater S’s compact sedan shape or the 8F Drafter’s broader coupe stance when putting together an Obey shortlist.', copyStatus: 'approved', intro: ['Obey applies Audi’s clean German design language across its GTA VI range. The Tailgater S covers the compact sports sedan and the Animus the A7-style fastback, while the 8F Drafter draws from the RS5 coupe. From everyday four-doors to electric grand tourers, the four-ring inspiration is easy to spot.'] },
  { slug: 'pegassi', name: 'Pegassi', inspiration: ['Lamborghini'], teaser: 'The Tempesta and Infernus ’96 make a striking pair, with low noses and wedge profiles from different generations of exotic design.', copyStatus: 'approved', intro: ["Pegassi puts Lamborghini-style drama at the center of its GTA VI range. Models such as the Huracán-inspired Tempesta, Urus-based Toros, and Diablo-shaped Infernus ’96 cover very different sides of the badge. Across supercars, classics, and SUVs, sharp angles and very little restraint remain familiar themes."] },
  { slug: 'dundreary', name: 'Dundreary', inspiration: ['Lincoln'], teaser: 'The Landstalker XL fills the frame with a tall cabin and broad grille, making a substantial first pick for Dundreary browsing.', copyStatus: 'approved', intro: ['Dundreary covers the full-size side of American car design in GTA VI, from formal coupes to substantial luxury SUVs. The Chino ’65 draws on 1965 Lincoln Continental and Chrysler Imperial styling, while the Landstalker XL follows the Lincoln Navigator. The two bring different generations of American luxury under the same badge.'] },
  { slug: 'imponte', name: 'Imponte', inspiration: ['Pontiac'], teaser: 'Look for the Phoenix ’77’s sculpted nose and the Ruiner’s angular hatchback profile when choosing which Imponte belongs in your collection.', copyStatus: 'approved', intro: ['Imponte channels Pontiac performance into GTA VI. The Phoenix ’77 draws from the 1970s Firebird, while the Ruiner ’82 brings the sharper shape of the 1980s Trans Am. Both sit in the Muscle class, with long hoods and distinct silhouettes from different decades.'] },
  { slug: 'benefactor', name: 'Benefactor', inspiration: ['Mercedes-Benz'], teaser: 'The Dubsta’s upright windshield looks nothing like the Schafter V12’s sweeping roofline, but both carry the familiar Benefactor badge.', copyStatus: 'approved', intro: ['Benefactor translates Mercedes-Benz design into GTA VI across luxury SUVs and executive sedans. Models such as the G-Class-shaped Dubsta and GL-Class-inspired XLS cover different takes on the SUV, while the Schafter V12 moves an S-Class sedan toward AMG and Brabus territory. Whatever the body style, the three-pointed-star influence is clear.'] },
  { slug: 'canis', name: 'Canis', inspiration: ['Jeep'], teaser: 'A Kamacho’s open bed and a Mesa’s enclosed cabin offer two distinct silhouettes for a collection built around Canis.', copyStatus: 'draft-claude', intro: ['Canis keeps Jeep-inspired 4x4 design at the center of its GTA VI range. The Wrangler-shaped Mesa, the Scrambler-inspired Crawler ’82 and the Crew Chief 715-inspired Kamacho all sit in the SUV class, and the Kamacho adds an open pickup bed. Upright bodies and practical proportions connect the range without making the models interchangeable.'] },
  // enus removed 2026-11-21 (Fausto): its only car, the Paragon, is an Ascot in GTA VI; /cars/manufacturers/enus/ redirects to the overview.
  { slug: 'buckingham', name: 'Buckingham', inspiration: ['Rolls-Royce'], teaser: "A Cullinan-inspired SUV and a Dawn-shaped convertible give Buckingham two very different ways to arrive with the whole crew.", copyStatus: 'approved', intro: ["Buckingham brings Rolls-Royce-inspired cars to GTA VI, from the Jubilee’s upright SUV shape to the open Windsor Drop. Familiar to GTA Online players under Enus, these returning models now wear a different badge. Their shared taste for grand proportions leaves plenty of room for different body styles."] },
  { slug: 'emperor', name: 'Emperor', inspiration: ['Lexus'], teaser: 'The Sultan’s sports-sedan shape and the Vectre’s sharp coupe body show two sides of the Emperor badge.', copyStatus: 'approved', intro: ['Emperor brings Lexus-inspired design to GTA VI. The Sultan puts a familiar sports-sedan shape under the badge, while the Vectre takes its cues from the Lexus RC F. Returning players knew the Sultan as a Karin, so a familiar name now sits in a different part of the garage.'] },
  { slug: 'willard', name: 'Willard', inspiration: ['Buick'], teaser: 'A Reatta-inspired Lasso ’90 and a Skylark-shaped Grouse ’92 give Willard two very different ways to revisit the ’90s.', copyStatus: 'approved', intro: ['Willard brings Buick-inspired American design to GTA VI, from everyday sedans to more unusual personal cars. The Grouse ’92 and Lasso ’90 share an era but take very different approaches to it; the newer Transient adds another generation. There is room under the badge for family-car nostalgia and a two-person weekend drive, without making either the whole Willard story.'] },
];

export const classSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const classSet = new Set(classPages.map((c) => c.slug));
const makeSet = new Set(manufacturerPages.map((m) => m.slug));
export const classHref = (name: string) => (classSet.has(classSlug(name)) ? `cars/classes/${classSlug(name)}/` : null);
export const makeHref = (v: Pick<VehicleOption, 'logoSlug'>) => (makeSet.has(v.logoSlug) ? `cars/manufacturers/${v.logoSlug}/` : null);
export const vehiclesInClass = (slug: string) => vehicleOptions.filter((v) => v.classes.some((c) => classSlug(c) === slug));
export const vehiclesByMake = (slug: string) => vehicleOptions.filter((v) => v.logoSlug === slug);

/** Text blocks under the overview grids (Codex 2026-10-03, approved). */
export const classesAbout = {
  heading: 'Browse GTA VI Cars by Class',
  paragraphs: [
    // COPY: Claude placeholder 23.11.2026 (classes now follow the in-game vehicle type) -> Codex
    'Classes give our car database a useful starting point: choose the kind of car you are interested in, then look more closely at individual models. Sports and Super gather different takes on performance-car design, while Muscle and Coupes offer another route through the lineup. Sedans, SUVs, Off-Road, Pickups and Vans help you explore beyond the obvious poster cars.',
    'Our classes follow the vehicle type the game shows for each car. A shared class tells you little about how two cars will compare on the same track; that takes testing under comparable conditions.',
    'Our car database focuses on racing-relevant cars, rather than every vehicle in GTA VI. Rockstar has named some models directly; others are community identifications from official footage and screenshots. A model name used here should not be read as official confirmation unless Rockstar has provided it.',
  ],
};
export const manufacturersAbout = {
  heading: 'Explore GTA VI Car Manufacturers',
  paragraphs: [
    'A manufacturer badge is another way into our car database. Follow a favorite marque across different body styles, or start with a shape you recognize and see what else wears the same name. A brand’s page brings its listed cars together so you can move from the broad family resemblance to the details of each model.',
    'GTA VI uses fictional manufacturers. The real-life inspirations shown here describe recognizable design influences, not licensed partnerships or exact equivalents. Individual cars can combine features from several sources, so a badge’s main inspiration does not explain every vehicle beneath it.',
    'Rockstar names some manufacturers and models in official material; other identifications come from the community’s reading of visible designs and badges. We keep that distinction separate from the real-world comparisons. Our database concentrates on racing-relevant cars and does not attempt to catalogue every vehicle in GTA VI. Open a manufacturer to explore the selection, then use the individual vehicle pages for model-specific details.',
  ],
};
