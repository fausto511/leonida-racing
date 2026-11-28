// llms.txt (llmstxt.org): a plain-text summary for AI assistants and
// answer engines (DEC-0082). Only facts that are true on the site today --
// Section names Cars/Community instead of The Garage/The Hub (04.11.2026, DEC-0088/0114; Claude, Codex review pending).
// intro, status and Garage/Calendar/Tracks lines = approved Codex copy (2026-10-01);
// update it when sections change. URLs follow `site` + `base`.
import type { APIRoute } from 'astro';
import { SITE_NAME, FREE_PROMISE } from '../data/site';
import { isLaunched } from '../data/launch';
// Free account section: Claude 15.11.2026 (RS-0127), Codex review applied 16.11.

// Status paragraph switches with the first build after launch (Fausto 18.11.2026).
const launched = isLaunched();
const STATUS = launched
  ? 'Status: GTA VI was released on November 19, 2026. Leonida Racing adds top speeds, Gellhorn lap times and costs to register as they are measured in the game, each with its source. GTA VI has no car dealers: cars are stolen and registered. Lap times are reviewed by moderators before they are published.'
  : `Status: GTA VI is scheduled for release on November 19, 2026. Leonida Racing is live before the game: current leaderboard entries, lap data, crews, and events marked as samples are demonstration content. GTA VI Time Attack is planned to accept real submissions from launch day, and its rules will be tested against the released game. Vehicles known only from unofficial pre-release material are marked "Not officially revealed" and excluded from search indexing. Users can already create crews and schedule community events in the Community section.`;

export const GET: APIRoute = ({ site }) => {
  const base = import.meta.env.BASE_URL;
  const u = (p: string) => new URL(`${base}${p}`, site).href;
  const body = `# ${SITE_NAME}

> Leonida Racing is an independent Grand Theft Auto VI (GTA 6) racing database and community. Cars covers GTA VI vehicles, classes, release information, first appearances, and real-life inspirations. Time Attack brings proof-based lap-time leaderboards to Gellhorn International Raceway. Community connects racers through crews and community events. Leonida Racing is not affiliated with Rockstar Games or Take-Two Interactive.

${STATUS}

## Cars

- [Cars](${u('cars/')}): browse GTA VI vehicles by class and manufacturer, with seats, drivetrain (carried over from GTA V), release details, first appearance, and primary real-life inspiration; costs to register, tested top speeds, and lap data ${launched ? 'are added as they are measured' : 'follow after launch'}
- [How we measure](${u('cars/how-we-measure/')}): where the car data comes from: cost to register, sell value with body condition, stats and ratings, read in the game on a PS5 with the current game version

## Time Attack

- [Gellhorn International Raceway](${u('time-attack/gellhorn-international-raceway/')}): track page with the leaderboard, filterable by vehicle, driver or crew, and by verification level
- [How It Works](${u('time-attack/how-it-works/')}): how to submit a lap (screenshot or full lap video), review, video verification and the rules

## Community

- [Community](${u('community/')}): GTA VI racing community overview
- [Event Calendar](${u('community/events/')}): GTA VI races, league rounds, community playlists, and car meets, with start times shown in each visitor’s local time zone
- [Crews](${u('community/crews/')}): racing crews and car meet communities
- [Tracks](${u('community/tracks/')}): planned directory for GTA VI community race jobs, with creator submissions, moderation, and filters once compatible creation tools are available

## Free account

- [Features](${u('features/')}): everything a free account does. ${FREE_PROMISE} Login with Discord (no new password; joins the Discord server). Private garage (cars you own, wishlist, collection by class and manufacturer), car ratings, Time Attack lap submissions (results screenshot or full lap video) with moderator review, personal records and submissions, up to five crews with an active crew tag, crew leader and track creator applications, direct event submissions with moderator review, event sign-ups with local start times, hosted series and championships, saved tracks, display name and optional PSN name, km/h or mph, verified badges for people and crews, account deletion
- [Discord bot](${u('discord/bot/')}): event cards with sign-up from Discord, Find Players (LFG) with temporary voice channels, /car and /compare commands, a bot for other servers with feeds for events, new cars, records or videos, and a !car command for stream chats (Nightbot, StreamElements)

## The Guide

- [The Guide](${u('guide/')}): sourced overview of GTA VI cars, driving physics, car theft, customization and mod shops, garages, racing, and car culture, with confirmed facts kept separate from open questions

## Data

- [GTA VI car data (plain text)](${u('llms-full.txt')}): every officially revealed car with class, real-life inspiration and measured values, one line per car

## About

- [About](${u('about/')}): what the site is and what it isn't
- [Terms of Use](${u('terms/')})
- [Privacy Policy](${u('privacy/')})
- [Legal notice (Impressum)](${u('legal/')})
`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
