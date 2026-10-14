// llms.txt (llmstxt.org): a plain-text summary for AI assistants and
// answer engines (DEC-0082). Only facts that are true on the site today --
// intro, status and Garage/Calendar/Tracks lines = approved Codex copy (2026-10-01);
// update it when sections change. URLs follow `site` + `base`.
import type { APIRoute } from 'astro';
import { SITE_NAME } from '../data/site';

export const GET: APIRoute = ({ site }) => {
  const base = import.meta.env.BASE_URL;
  const u = (p: string) => new URL(`${base}${p}`, site).href;
  const body = `# ${SITE_NAME}

> Leonida Racing is an independent Grand Theft Auto VI (GTA 6) racing database and community. The Garage covers GTA VI vehicles, classes, release information, first appearances, and real-life inspirations. Time Attack brings proof-based lap-time leaderboards to Gellhorn International Raceway. The Hub connects racers through crews and community events. Leonida Racing is not affiliated with Rockstar Games or Take-Two Interactive.

Status: GTA VI is scheduled for release on November 19, 2026. Leonida Racing is live before the game: current leaderboard entries, lap data, crews, and events marked as samples are demonstration content. GTA VI Time Attack is planned to accept real submissions from launch day, and its rules will be tested against the released game. Vehicles known only from unofficial pre-release material are marked "Not officially revealed" and excluded from search indexing. Users can already create crews and schedule community events in The Hub.

## The Garage

- [The Garage](${u('cars/')}): browse GTA VI vehicles by class and manufacturer, with seats, drivetrain, release details, first appearance, and primary real-life inspiration; prices, tested top speeds, and lap data follow after launch

## Time Attack

- [Gellhorn International Raceway](${u('time-attack/gellhorn-international-raceway/')}): track page with the leaderboard, filterable by vehicle, driver or crew, and by verification level
- [How It Works](${u('time-attack/how-it-works/')}): how to submit a lap in four steps
- [Rules & Verification](${u('time-attack/rules/')}): what counts as a valid lap; screenshot entry vs. video-verified times

## The Hub

- [The Hub](${u('community/')}): GTA VI racing community overview
- [Event Calendar](${u('community/events/')}): GTA VI races, league rounds, community playlists, and car meets, with start times shown in each visitor’s local time zone
- [Crews](${u('community/crews/')}): racing crews and car meet communities
- [Tracks](${u('community/tracks/')}): planned directory for GTA VI community race jobs, with creator submissions, moderation, and filters once compatible creation tools are available

## The Guide

- [The Guide](${u('guide/')}): sourced overview of GTA VI cars, driving physics, car theft, customization and mod shops, garages, racing, and car culture, with confirmed facts kept separate from open questions

## About

- [About](${u('about/')}): what the site is and what it isn't
- [Terms of Use](${u('terms/')})
- [Privacy Policy](${u('privacy/')})
- [Legal notice (Impressum)](${u('legal/')})
`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
