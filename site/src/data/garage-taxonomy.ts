// Class and manufacturer landing pages of The Garage (RS-0050, DEC-0087,
// supersedes DEC-0059). Pages: /garage/classes/<slug>/ and
// /garage/manufacturers/<slug>/.
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
  { slug: 'super', name: 'Super', teaser: 'The Tempesta and Thrax make even a quiet parking space look like the entrance to a supercar show.', copyStatus: 'approved', intro: [
    'The Garage’s Super category brings together the Furia, Tempesta, Zorrusso and Thrax: four different takes on the modern exotic, from compact wedges to an open cockpit and a broad hypercar silhouette. In GTA Online, Super is a familiar racing category, but sharing a class does not make cars equally competitive. For GTA VI, these labels organize our database; they do not establish final race eligibility. The footage shows their designs, while comparisons of lap times, acceleration and handling will need testing in the released game.',
  ] },
  { slug: 'sports', name: 'Sports', teaser: 'A compact Futo and a low-slung Banshee share this category, giving your next garage shortlist very different starting points.', copyStatus: 'approved', intro: [
    'The GTA VI Sports class covers nearly every kind of driver’s car: Japanese tuners, German coupes, electric grand tourers, American roadsters, and plenty in between. It is where cars inspired by the Dodge Viper, Toyota AE86, Nissan Skyline GT-R, and Porsche 911 share the same grid.',
  ] },
  { slug: 'muscle', name: 'Muscle', teaser: 'The Deviant wears its age proudly, while the Dominator GT brings open-top muscle to a much newer generation.', copyStatus: 'approved', intro: [
    'GTA VI Muscle cars bring big American engines and bold shapes to The Garage, from classic pony cars and lowriders to modern Mustang-, Challenger-, and Camaro-inspired builds. The lineup runs from the Buccaneer and Sabre Turbo to the Gauntlet Hellfire and the many faces of the Dominator. Some are clean, some are loud, and subtlety is rarely the point.',
  ] },
  { slug: 'sports-classics', name: 'Sports Classics', teaser: 'Start with the Mamba GT’s rounded racing silhouette or the Cheetah ’95’s pop-up headlights, then explore the classics around them.', copyStatus: 'approved', intro: [
    'GTA VI Sports Classics bring together the cars that made their era matter: Italian wedges, 1960s racers, German icons, and American cruisers. The class runs from the Cheetah \'95 and Infernus Classic to the Sentinel Classic, Mamba GT, and Manana. Take one racing or park it at the meet—the shape already has a story.',
  ] },
  { slug: 'coupes', name: 'Coupes', teaser: 'The Windsor makes an entrance before anyone gets out, while the FR36 offers a more understated take on two doors.', copyStatus: 'approved', intro: [
    'The Garage’s Coupes category spans the Windsor’s luxury-car proportions, the FR36’s compact shape and Übermacht’s Sentinel XS, Zion and Zion Cabrio. It groups two-door designs that offer different starting points for a collection, from a closed roof to an open cabin. In GTA Online, Coupes is also a racing category, but that does not establish how these cars will be classified or matched in GTA VI. Until the released game can be tested, body style is a useful way to browse, not evidence of equal performance.',
  ] },
  { slug: 'sedans', name: 'Sedans', teaser: 'Chrome on the Stanier ’55 and a long roof on the Stratum give this everyday category two very different personalities.', copyStatus: 'approved', intro: [
    'GTA VI Sedans range from ordinary-looking four-doors and wagons to full-size American classics and serious sports sedans. The roster stretches from the Stanier and Emperor to the Feroci, Tailgater, and Schafter V12. Crown Victoria, Lexus GS, Audi, and Cadillac influences make this class far less anonymous than the body style suggests.',
  ] },
  { slug: 'suvs', name: 'SUVs', teaser: 'Park the Riata Classic beside a Cavalcade XL and see how far the SUV silhouette has travelled across generations.', copyStatus: 'approved', intro: [
    'GTA VI SUVs run from city crossovers to full-size luxury trucks and old-school utility rigs. The Baller, Dubsta, Toros, and Granger families cover very different ideas of what an SUV should be. Range Rover, Mercedes-Benz G-Class, Lamborghini Urus, Ford, and Jeep influences give the class plenty of ways to take up more than its share of the road.',
  ] },
  { slug: 'off-road', name: 'Off-Road', teaser: 'Oversized tires turn the Dominator ’67 Buggy into an unlikely trail companion for the square-bodied Kamacho and its pickup bed.', copyStatus: 'approved', intro: [
    'GTA VI Off-Road vehicles bring together lifted trucks, 4x4s, and trail builds inspired by the Ford F-150 Raptor, Toyota Hilux, Hummer H1, and Jeep concepts. From the Caracara 4x4 and Rebel to the Patriot Mil-Spec and Kamacho, the class covers several ways to leave the city behind. When the pavement ends, this is the part of The Garage you start with.',
  ] },
];

export const manufacturerPages: TaxonomyPage[] = [
  { slug: 'vapid', name: 'Vapid', inspiration: ['Ford'], teaser: 'The Ganado ’70 puts a pickup bed behind classic car lines; the Dominator ’67 Buggy takes those proportions somewhere muddier.', copyStatus: 'approved', intro: ['Vapid brings Ford-inspired car culture into GTA VI, led by generations of Dominators alongside pickups, SUVs, and the Stanier sedans. That puts the Dominator, Stanier, Caracara, Aleutian, and Riata families under one badge. From old-school muscle to lifted builds, the Ford influence is hard to miss.'] },
  { slug: 'declasse', name: 'Declasse', inspiration: ['Chevrolet'], teaser: 'The Impaler ’80 and Tulip M-100 bring squared-off silhouettes to a Declasse shortlist that rewards looking beyond the obvious sports cars.', copyStatus: 'approved', intro: ['Declasse brings several generations of American performance and utility vehicles into GTA VI, from the Impaler and Tulip muscle cars to the Granger SUVs. The Vigero ZX Convertible adds modern Camaro-inspired styling, while the Mamba GT brings a Shelby Daytona-shaped racer to Sports Classics in The Garage. Chevrolet influence connects much of the range, but it does not explain every model beneath the badge.'] },
  { slug: 'albany', name: 'Albany', inspiration: ['Cadillac', 'Buick'], teaser: 'A Buccaneer Custom catches the eye at a meet, while the Primo offers a quieter starting point for an Albany collection.', copyStatus: 'approved', intro: ['Albany puts American luxury into GTA VI, drawing mainly from Cadillac and Buick. Its lineup moves from the Emperor and Manana classics to the Cavalcade XL and V-STR, covering several decades without losing that unmistakable big-car presence. From boulevard cruisers to full-size SUVs and sports sedans, Albany rarely does understated.'] },
  { slug: 'karin', name: 'Karin', inspiration: ['Toyota', 'Subaru'], teaser: 'The Futo’s compact, angular body stands apart from the Asterope GZ’s everyday sedan shape, even with the same badge up front.', copyStatus: 'approved', intro: ['Karin brings a wide slice of Japanese car culture to GTA VI, from the Asterope GZ and Feroci sedans to the Futo and Sultan sports cars. Toyota is the clearest influence, with Subaru and Lexus cues appearing across individual models. The Vivanite extends the selection into SUVs, while the Rebel adds an Off-Road entry in The Garage.'] },
  { slug: 'bravado', name: 'Bravado', inspiration: ['Dodge'], teaser: 'A Banshee’s sweeping bodywork and a Gauntlet Classic’s blunt nose give Bravado collectors two unmistakable shapes to look for.', copyStatus: 'approved', intro: ['Bravado brings Dodge-inspired American performance to GTA VI, from the Viper-shaped Banshee and Charger-inspired Buffalo family to the Challenger-style Gauntlets and Durango-like Dorado. The Garage groups these models across Sports, Muscle and SUVs, giving the badge a range that extends well beyond its two-door muscle cars.'] },
  { slug: 'ubermacht', name: 'Übermacht', inspiration: ['BMW'], teaser: 'The Sentinel Classic Cabrio leaves its angular cabin open to the sky, while the Cypher keeps a tighter modern silhouette.', copyStatus: 'approved', intro: ['BMW influence runs through every generation of Übermacht represented in GTA VI. The Cypher draws from the M2, the Sentinel XS from the M3, and the Zion from the 6 Series, while the Sentinel Classic brings the E30 era into The Garage. That gives BMW fans coupes, cabrios, modern tuner builds, and 1980s classics to choose from.'] },
  { slug: 'pfister', name: 'Pfister', inspiration: ['Porsche'], teaser: 'Put the compact Growler beside the taller Astron to see how the Pfister badge travels beyond its familiar sports-car outline.', copyStatus: 'approved', intro: ['Pfister’s GTA VI range carries Porsche-inspired design across several generations of sports cars, from the Comet Retro Custom and Comet S2 Cabrio to the compact Growler. The Neon adds an electric grand-tourer shape, while the Astron brings the family resemblance to an SUV. In The Garage, the range spans Sports and SUVs rather than a single type of two-door car.'] },
  { slug: 'grotti', name: 'Grotti', inspiration: ['Ferrari'], teaser: 'The Cheetah ’95 pairs pop-up headlights with bold side strakes, giving a Grotti collection a distinctive place to begin.', copyStatus: 'approved', intro: ['Grotti covers several eras of Ferrari-inspired design in GTA VI. The Cheetah ’95 brings a classic wedge shape, while the Carbonizzare and Itali RSX represent different generations of Italian sports-car styling. In The Garage, those models span Sports Classics and Sports, with the Furia adding a Super-class entry.'] },
  { slug: 'obey', name: 'Obey', inspiration: ['Audi'], teaser: 'Choose the Tailgater S’s compact sedan shape or the 8F Drafter’s broader coupe stance when putting together an Obey shortlist.', copyStatus: 'approved', intro: ['Obey applies Audi’s clean German design language across its GTA VI range. Models such as the Tailgater and Tailgater S cover executive and compact sports sedans, while the 8F Drafter draws from the RS5 coupe and the Omnis e-GT brings e-tron GT influence. From everyday four-doors to electric grand tourers, the four-ring inspiration is easy to spot.'] },
  { slug: 'pegassi', name: 'Pegassi', inspiration: ['Lamborghini'], teaser: 'The Tempesta and Infernus Classic make a striking pair, with low noses and wedge profiles from different generations of exotic design.', copyStatus: 'approved', intro: ['Pegassi puts Lamborghini-style drama at the center of its GTA VI range. Models such as the Huracán-inspired Tempesta, Urus-based Toros, and Diablo-shaped Infernus Classic cover very different sides of the badge, while the open-top Zorrusso adds another modern exotic shape. Across supercars, classics, and SUVs, sharp angles and very little restraint remain familiar themes.'] },
  { slug: 'dundreary', name: 'Dundreary', inspiration: ['Lincoln', 'Mercury'], teaser: 'The Landstalker XL fills the frame with a tall cabin and broad grille, making a substantial first pick for Dundreary browsing.', copyStatus: 'approved', intro: ['Dundreary covers the full-size side of American car design in GTA VI. The Landstalker XL follows the Lincoln Navigator, while the Sirius takes its long-hood shape from a 1970 Mercury Cougar. The Garage places the two models in SUVs and Muscle, respectively.'] },
  { slug: 'imponte', name: 'Imponte', inspiration: ['Pontiac'], teaser: 'Look for the Phoenix’s sculpted nose and the Ruiner’s angular hatchback profile when choosing which Imponte belongs in your collection.', copyStatus: 'approved', intro: ['Imponte channels Pontiac performance into GTA VI. The Phoenix draws from the 1970s Firebird, while the Ruiner brings the sharper shape of the 1980s Trans Am. Both sit in The Garage’s Muscle category, with long hoods and distinct silhouettes from different decades.'] },
  { slug: 'benefactor', name: 'Benefactor', inspiration: ['Mercedes-Benz'], teaser: 'The Dubsta’s upright windshield looks nothing like the Schafter V12’s sweeping roofline, but both carry the familiar Benefactor badge.', copyStatus: 'approved', intro: ['Benefactor translates Mercedes-Benz design into GTA VI across luxury SUVs and executive sedans. Models such as the G-Class-shaped Dubsta and GL-Class-inspired XLS cover different takes on the SUV, while the Schafter V12 moves an S-Class sedan toward AMG and Brabus territory. Whatever the body style, the three-pointed-star influence is clear.'] },
  { slug: 'canis', name: 'Canis', inspiration: ['Jeep'], teaser: 'A Kamacho’s open bed and a Seminole Frontier’s enclosed cabin offer two distinct silhouettes for a collection built around Canis.', copyStatus: 'approved', intro: ['Canis keeps Jeep-inspired 4x4 design at the center of its GTA VI range. The Wrangler-shaped Mesa and Cherokee XJ-inspired Seminole Frontier sit in The Garage’s SUV category, while the Crew Chief 715-inspired Kamacho brings an open pickup bed to Off-Road. Upright bodies and practical proportions connect the three models without making them interchangeable.'] },
  { slug: 'enus', name: 'Enus', inspiration: ['Rolls-Royce', 'Bentley'], teaser: 'The Jubilee’s tall, upright body and the Paragon R’s lower coupe silhouette give an Enus collection two different expressions of luxury.', copyStatus: 'approved', intro: ['Enus brings Rolls-Royce- and Bentley-inspired luxury to GTA VI through the Jubilee, Paragon R and Windsor. The Jubilee’s Cullinan-like SUV shape contrasts with the Paragon R’s Continental GT influence and the Windsor’s Wraith-inspired coupe proportions. In The Garage, the three models span SUVs, Sports and Coupes, respectively.'] },
];

export const classSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const classSet = new Set(classPages.map((c) => c.slug));
const makeSet = new Set(manufacturerPages.map((m) => m.slug));
export const classHref = (name: string) => (classSet.has(classSlug(name)) ? `garage/classes/${classSlug(name)}/` : null);
export const makeHref = (v: Pick<VehicleOption, 'logoSlug'>) => (makeSet.has(v.logoSlug) ? `garage/manufacturers/${v.logoSlug}/` : null);
export const vehiclesInClass = (slug: string) => vehicleOptions.filter((v) => v.classes.some((c) => classSlug(c) === slug));
export const vehiclesByMake = (slug: string) => vehicleOptions.filter((v) => v.logoSlug === slug);

/** Text blocks under the overview grids (Codex 2026-10-03, approved). */
export const classesAbout = {
  heading: 'Browse GTA VI Cars by Class',
  paragraphs: [
    'Classes give The Garage a useful starting point: choose the kind of car you are interested in, then look more closely at individual models. Sports and Super gather different takes on performance-car design, while Muscle and Sports Classics offer another route through the lineup. Coupes, Sedans, SUVs, and Off-Road help you explore beyond the obvious poster cars.',
    'These categories organize our database; they do not establish the final vehicle classes or entry rules for GTA VI races. A familiar class label also tells you little about how two cars will compare on the same track. That requires information from the released game and testing under comparable conditions.',
    'The Garage focuses on racing-relevant cars, rather than every vehicle in GTA VI. Rockstar has named some models directly; others are community identifications from official footage and screenshots. A model name used here should not be read as official confirmation unless Rockstar has provided it.',
  ],
};
export const manufacturersAbout = {
  heading: 'Explore GTA VI Car Manufacturers',
  paragraphs: [
    'A manufacturer badge is another way into The Garage. Follow a favorite marque across different body styles, or start with a shape you recognize and see what else wears the same name. A brand’s page brings its listed cars together so you can move from the broad family resemblance to the details of each model.',
    'GTA VI uses fictional manufacturers. The real-life inspirations shown here describe recognizable design influences, not licensed partnerships or exact equivalents. Individual cars can combine features from several sources, so a badge’s main inspiration does not explain every vehicle beneath it.',
    'Rockstar names some manufacturers and models in official material; other identifications come from the community’s reading of visible designs and badges. We keep that distinction separate from the real-world comparisons. The Garage concentrates on racing-relevant cars and does not attempt to catalogue every vehicle in GTA VI. Open a manufacturer to explore the selection, then use the individual vehicle pages for model-specific details.',
  ],
};
