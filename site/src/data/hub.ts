// The Hub (DEC-0062) -- shared types, sample data and markup renderers for
// the crew directory and the event calendar.
//
// One renderer per item type, used twice: at build time (sample rows,
// injected via set:html so the static page is never empty) and at runtime
// (live rows from Supabase replace the samples as soon as at least one real
// published row exists). Same pattern as Leaderboard.astro, but with a
// single source of markup so build-time and live rows can't drift apart.
//
// SAMPLE DATA IS FICTIONAL. Every sample crew and event below is invented
// for layout purposes only (explicitly allowed by Fausto, 2026-09-25) and is
// always shown with a visible "Sample data" flag. Replace by publishing real
// rows in the `crews` / `hub_events` tables -- not by editing this file.

export type Platform = 'ps5' | 'xbox';
export type CrewFocus = 'racing' | 'time-attack' | 'league' | 'drift' | 'car-meet' | 'cruise';
export type EventType = 'race' | 'time-attack' | 'league' | 'car-meet' | 'cruise' | 'other';

export interface HubCrew {
  crew_id?: string; // only on live data (needed for join requests)
  slug: string;
  name: string;
  tag: string;
  color: string;
  platforms: Platform[];
  focus: CrewFocus[];
  region: string | null;
  languages: string[]; // ISO 639-1 codes, see data/languages.ts
  description: string | null;
  member_count: number | null;
  discord_url: string | null;
  social_club_url: string | null;
  is_partner: boolean;
  /** set by moderators; featured crews come first on Hub overview + home (2026-10-03) */
  is_featured?: boolean;
}

export type StreamPlatform = 'twitch' | 'youtube' | 'kick';
export interface EventStream { platform: StreamPlatform; url: string; channel_name?: string | null; sort_order?: number }
// Same patterns as the DB check hub_event_streams_url_check (RS-0058).
const STREAM_RX: Record<StreamPlatform, RegExp> = {
  twitch: /^https:\/\/(www\.)?twitch\.tv\/[A-Za-z0-9_]{3,25}\/?$/,
  kick: /^https:\/\/(www\.)?kick\.com\/[A-Za-z0-9_-]{3,25}\/?$/,
  youtube: /^https:\/\/((www|m)\.)?(youtube\.com\/(watch\?v=[A-Za-z0-9_-]{11}|live\/[A-Za-z0-9_-]{11}|@[A-Za-z0-9._-]{3,30}(\/live)?|channel\/UC[A-Za-z0-9_-]{22}(\/live)?)|youtu\.be\/[A-Za-z0-9_-]{11})$/,
};
export const streamPlatformLabels: Record<StreamPlatform, string> = { twitch: 'Twitch', youtube: 'YouTube', kick: 'Kick' };
/** Platform of a stream URL, or null if it is not an accepted Twitch/YouTube/Kick link. */
export function streamPlatform(url: string): StreamPlatform | null {
  for (const p of Object.keys(STREAM_RX) as StreamPlatform[]) if (STREAM_RX[p].test(url)) return p;
  return null;
}

export interface HubEvent {
  event_id: string;
  title: string;
  event_type: EventType;
  starts_at: string; // ISO, UTC
  ends_at: string | null;
  platforms: Platform[];
  host_name: string | null;
  location: string | null;
  description: string | null;
  join_url: string | null;
  /** fallback for "Hosted by" when no PSN name is given: creator's site display name */
  host_account?: string | null;
  /** Discord invite where the event takes place (RS-0034) */
  discord_url?: string | null;
  status: 'scheduled' | 'cancelled';
  host?: { name: string; tag: string; color: string; discord_url?: string | null } | null;
  max_participants?: number | null;
  /** 'open' = "I'm in" possible; 'closed' = listed, no sign-ups (RS-0058) */
  registration?: 'open' | 'closed';
  /** stream links (RS-0058); own table, several per event possible */
  streams?: EventStream[];
  /** sample events only: fictional drivers already signed up */
  sample_going?: string[];
}

import { languageLabel } from './languages';
import { ACTIVE_PLATFORMS } from './platforms';
export const platformLabels: Record<Platform, string> = { ps5: 'PS5', xbox: 'Xbox Series X|S' };
/** Platform chips: only active platforms (DEC-0073: PS5 at launch). */
const platformChips = (list: Platform[]) => list.filter((p) => (ACTIVE_PLATFORMS as readonly string[]).includes(p)).map((p) => `<span class="chip chip-platform">${esc(platformShort[p] ?? p)}</span>`).join('');
export const platformShort: Record<Platform, string> = { ps5: 'PS5', xbox: 'XBOX' };
/** Card image per event type (home page strip). All types share one
 *  PLACEHOLDER until Fausto delivers a fixed image per type -- then only
 *  this map changes (02-Feature-und-Tool-Ideen: feste Event-Bilder). */
export const eventTypeImages: Record<EventType, string> = {
  race: 'images/hub/hub-events',
  'time-attack': 'images/hub/hub-events',
  league: 'images/hub/hub-events',
  'car-meet': 'images/hub/hub-events',
  cruise: 'images/hub/hub-events',
  other: 'images/hub/hub-events',
};

export const focusLabels: Record<CrewFocus, string> = {
  racing: 'Racing',
  'time-attack': 'Time Attack',
  league: 'League',
  drift: 'Drift',
  'car-meet': 'Car Meets',
  cruise: 'Cruises',
};
export const eventTypeLabels: Record<EventType, string> = {
  race: 'Race',
  'time-attack': 'Time Attack',
  league: 'League',
  'car-meet': 'Car Meet',
  cruise: 'Cruise',
  other: 'Other',
};

// ---------------------------------------------------------------------------
// Sample data (fictional)
// ---------------------------------------------------------------------------
export const sampleCrews: HubCrew[] = [
  { slug: 'sample-apex-syndicate', name: 'Apex Syndicate', tag: 'APEX', color: '#ed253d', platforms: ['ps5'], focus: ['racing', 'league'], region: 'Europe', languages: ['en'], description: 'Clean, competitive circuit racing with weekly league nights. Sample entry.', member_count: 142, discord_url: null, social_club_url: null, is_partner: true },
  { slug: 'sample-vice-drift-union', name: 'Vice Drift Union', tag: 'VDRU', color: '#ff7ab6', platforms: ['ps5'], focus: ['drift', 'car-meet'], region: 'North America', languages: ['en'], description: 'Tandem drift sessions and themed car meets. Sample entry.', member_count: 88, discord_url: null, social_club_url: null, is_partner: false },
  { slug: 'sample-leonida-lap-club', name: 'Leonida Lap Club', tag: 'LLAP', color: '#ffd74c', platforms: ['ps5'], focus: ['time-attack', 'racing'], region: 'Worldwide', languages: ['en'], description: 'Hotlap hunters chasing tenths on every board. Sample entry.', member_count: 37, discord_url: null, social_club_url: null, is_partner: false },
  { slug: 'sample-nordring-crew', name: 'Nordring Crew', tag: 'NRDC', color: '#3fa7ff', platforms: ['ps5'], focus: ['racing', 'cruise'], region: 'Europe', languages: ['de'], description: 'German-speaking racing crew with relaxed Sunday cruises. Sample entry.', member_count: 64, discord_url: null, social_club_url: null, is_partner: false },
  { slug: 'sample-gulf-coast-racing', name: 'Gulf Coast Racing', tag: 'GCRX', color: '#27c281', platforms: ['ps5'], focus: ['league'], region: 'North America', languages: ['en'], description: 'Season-based league with fixed grids and stewarding. Sample entry.', member_count: 210, discord_url: null, social_club_url: null, is_partner: false },
  { slug: 'sample-midnight-meet', name: 'Midnight Meet', tag: 'MNMT', color: '#9b6bff', platforms: ['ps5'], focus: ['car-meet', 'cruise'], region: 'Europe', languages: ['en'], description: 'Late-night meets, photo spots and convoy cruises. Sample entry.', member_count: 51, discord_url: null, social_club_url: null, is_partner: false },
];

const sampleHost = (slug: string) => {
  const c = sampleCrews.find((x) => x.slug === slug)!;
  return { name: c.name, tag: c.tag, color: c.color };
};

// Fixed dates are the build-time fallback only; in the browser the samples
// are moved to upcoming dates (sampleEventsUpcoming) so they stay joinable
// after release until real events replace them.
export const sampleEvents: HubEvent[] = [
  { event_id: 's1', title: 'Launch Night Grid Run', event_type: 'race', starts_at: '2026-11-21T19:00:00Z', ends_at: '2026-11-21T21:00:00Z', platforms: ['ps5'], host_name: 'Racer_01', location: 'Vice City Downtown', description: 'Open lobby, clean racing, stock vehicles. Sample event.', join_url: null, status: 'scheduled', host: sampleHost('sample-apex-syndicate'), max_participants: 16, sample_going: ['Racer_01', 'KerbHopper', 'ViceRacer', 'LateApex', 'SpeedyNomad', 'Nightshift', 'TurnInEarly'] },
  { event_id: 's2', title: 'Ocean Drive Car Meet', event_type: 'car-meet', starts_at: '2026-11-22T20:30:00Z', ends_at: null, platforms: ['ps5'], host_name: 'GhostPedal', location: 'Vice Beach', description: 'Bring your best build. Photo session at sunset. Sample event.', join_url: null, status: 'scheduled', host: sampleHost('sample-midnight-meet'), sample_going: ['GhostPedal', 'Nightshift', 'NeonDrift', 'CoastalRun'] },
  { event_id: 's3', title: 'Gellhorn Hotlap Session', event_type: 'time-attack', starts_at: '2026-11-25T18:00:00Z', ends_at: '2026-11-25T20:00:00Z', platforms: ['ps5'], host_name: 'SpeedyNomad', location: 'Gellhorn International Raceway', description: 'Group hotlapping, times submitted to Time Attack afterwards. Sample event.', join_url: null, status: 'scheduled', host: sampleHost('sample-leonida-lap-club'), max_participants: 12, sample_going: ['SpeedyNomad', 'ApexLimit', 'LateApex', 'Racer_01', 'Hillclimb', 'SolarFlare', 'MintyTires', 'ShadowLine', 'TarmacTom'] },
  { event_id: 's4', title: 'Season 1 — Round 1', event_type: 'league', starts_at: '2026-11-28T19:30:00Z', ends_at: null, platforms: ['ps5'], host_name: 'TurnInEarly', location: null, description: 'Qualifying and two races. The grid is set and sign-ups are closed—watch it live. Sample event.', join_url: null, status: 'scheduled', host: sampleHost('sample-gulf-coast-racing'), max_participants: 20, registration: 'closed', streams: [{ platform: 'twitch', url: 'https://www.twitch.tv/sample_channel' }], sample_going: ['TurnInEarly', 'RedlineRosa', 'OceanDriveOG', 'KerbHopper', 'BrakeLate99'] },
  { event_id: 's5', title: 'Everglades Sunday Cruise', event_type: 'cruise', starts_at: '2026-11-29T16:00:00Z', ends_at: null, platforms: ['ps5'], host_name: 'LatteBrake', location: 'Leonida Keys', description: 'Slow convoy, no racing. Sample event.', join_url: null, status: 'cancelled', host: sampleHost('sample-nordring-crew'), sample_going: ['LatteBrake', 'Hillclimb'] },
  { event_id: 's6', title: 'Community Drift Jam', event_type: 'other', starts_at: '2026-12-05T21:00:00Z', ends_at: null, platforms: ['ps5'], host_name: 'VelvetClutch', location: 'Port Gellhorn', description: 'Free-for-all drift session. Sample event.', join_url: null, status: 'scheduled', host: null, sample_going: ['SolarFlare', 'NeonDrift', 'VelvetClutch'] },
];

/** Sample events moved into the near future (first one 3 days from today,
 *  same spacing and time of day as the fixed dates). Deterministic per UTC
 *  day, so the events page and My Account show the same dates. Never earlier
 *  than the fixed dates, which start after the GTA VI launch (RS-0055: no
 *  event before Nov 19, 2026, samples included). */
export function sampleEventsUpcoming(now = new Date()): HubEvent[] {
  const DAY = 86400e3;
  const first = Date.parse(sampleEvents[0].starts_at);
  const firstDay = Math.floor(first / DAY) * DAY;
  const targetDay = Math.max(Math.floor(now.getTime() / DAY) * DAY + 3 * DAY, firstDay);
  const shift = targetDay - firstDay;
  const mv = (iso: string | null) => (iso ? new Date(Date.parse(iso) + shift).toISOString() : null);
  return sampleEvents.map((e) => ({ ...e, starts_at: mv(e.starts_at)!, ends_at: mv(e.ends_at) }));
}


// ---------------------------------------------------------------------------
// Rendering (shared by build time and runtime)
// ---------------------------------------------------------------------------
export function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const safeColor = (c: string) => (/^#[0-9a-fA-F]{6}$/.test(c) ? c : '#a0a0c6');
const safeUrl = (u: string | null) => (u && /^https:\/\//.test(u) ? u : null);
const DISCORD_RX = /^https:\/\/(discord\.gg|discord\.com\/invite)\/[A-Za-z0-9-]+$/;
/** Where to meet the host: the event's own Discord invite, else the host crew's (RS-0034). */
export function eventDiscord(e: HubEvent): string | null {
  const u = e.discord_url || e.host?.discord_url || null;
  return u && DISCORD_RX.test(u) ? u : null;
}
const iconDiscord = '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.3 5.3A18 18 0 0 0 15.9 4l-.3.6a15 15 0 0 1 4 1.6 16 16 0 0 0-13.2 0 15 15 0 0 1 4-1.6L10.1 4a18 18 0 0 0-4.4 1.3C2.9 9 2.2 12.6 2.5 16.1a18 18 0 0 0 5.5 2.8l.8-1.3a11 11 0 0 1-1.9-.9l.5-.4a13 13 0 0 0 9.2 0l.5.4a11 11 0 0 1-1.9.9l.8 1.3a18 18 0 0 0 5.5-2.8c.4-4-.7-7.5-2.2-10.8ZM9.3 14c-.8 0-1.4-.7-1.4-1.6s.6-1.6 1.4-1.6 1.4.7 1.4 1.6-.6 1.6-1.4 1.6Zm5.4 0c-.8 0-1.4-.7-1.4-1.6s.6-1.6 1.4-1.6 1.4.7 1.4 1.6-.6 1.6-1.4 1.6Z"/></svg>';
/** Discord link in the event's info line (DEC-0077); sample events get a
 *  greyed-out demo link. */
export function eventDiscordHtml(e: HubEvent, sample = false): string {
  if (e.status === 'cancelled') return '';
  if (sample) return `<span class="ev-dc is-disabled" title="Sample event — no real Discord server">${iconDiscord}Join the Host's Discord</span>`;
  const u = eventDiscord(e);
  return u ? `<a class="ev-dc" href="${esc(u)}" target="_blank" rel="noopener" title="Opens the host's Discord server">${iconDiscord}Join the host's Discord</a>` : '';
}

/** "Watch on Twitch/YouTube/Kick" links (RS-0058). Shown even when the
 *  event is full or sign-ups are closed; sample events get a demo link.
 *  COPY STATUS: approved (Codex 2026-10-02, Fausto). */
export function eventStreamHtml(e: HubEvent, sample = false): string {
  if (e.status === 'cancelled' || !e.streams?.length) return '';
  const icon = '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
  return [...e.streams].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((s) => {
    const label = `Watch on ${streamPlatformLabels[s.platform] ?? 'stream'}`;
    if (sample) return `<span class="ev-watch is-disabled" title="Sample event — no real stream">${icon}${label}</span>`;
    return streamPlatform(s.url) ? `<a class="ev-watch" href="${esc(s.url)}" target="_blank" rel="noopener">${icon}${label}</a>` : '';
  }).join('');
}

/** Social-Club-style crew tag: white plate, black tag, thin crew-colour bar at the bottom. */
export function crewTagHtml(tag: string, color: string, size: 'sm' | 'md' = 'md'): string {
  return `<span class="crew-tag crew-tag-${size}" style="--crew-color:${safeColor(color)}" title="Crew tag ${esc(tag)}">${esc(tag)}</span>`;
}

/** Crew emblem (Fausto, 2026-09-26): racing number panel in the crew colour
 *  (wheel 21/48 wide so it keeps clear space to the panel edges)
 *  with a steering wheel. Panel + wheel are Fausto's own drawings
 *  (Visual/Crew-Emblem/), wheel vectorised with potrace. The wheel turns dark
 *  on light crew colours so it stays readable (WCAG relative luminance). */
const EMBLEM_PANEL = 'M17.19 3H46.3L30.81 45H1.7Z';
const EMBLEM_WHEEL = 'M2365 5114 c-659 -68 -1184 -312 -1622 -755 -610 -617 -860 -1465 -687 -2327 142 -711 622 -1357 1274 -1717 539 -297 1188 -388 1800 -250 701 157 1323 626 1673 1263 293 531 384 1147 261 1760 -192 958 -973 1752 -1934 1967 -219 49 -585 77 -765 59z m515 -490 c542 -76 1074 -414 1385 -879 91 -137 250 -459 275 -559 80 -316 -93 -356 -575 -133 -957 442 -1979 422 -2950 -58 -199 -99 -303 -113 -384 -55 -104 73 -79 227 93 568 223 444 598 793 1042 970 380 151 739 198 1114 146z m-1903 -2400 c72 -25 128 -68 163 -127 17 -28 56 -95 87 -147 154 -260 290 -392 573 -555 353 -203 450 -343 438 -633 -10 -249 -128 -267 -539 -82 -437 195 -779 528 -1008 980 -76 150 -95 209 -95 295 0 203 187 335 381 269z m3409 -17 c118 -60 171 -178 145 -322 -30 -166 -260 -545 -459 -757 -234 -249 -621 -478 -955 -565 -184 -48 -267 95 -211 365 41 200 131 300 424 467 299 170 435 307 607 608 84 149 132 195 233 228 49 16 162 4 216 -24z';
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
export function crewEmblemHtml(color: string): string {
  const c = safeColor(color);
  const wheel = luminance(c) > 0.45 ? '#14141a' : '#ffffff';
  return `<span class="crew-emblem" aria-hidden="true"><svg viewBox="0 0 48 48" width="48" height="48"><path d="${EMBLEM_PANEL}" fill="${c}"/><g transform="translate(13.5 13.5) scale(0.041016) translate(0 512) scale(0.1 -0.1)"><path fill="${wheel}" d="${EMBLEM_WHEEL}"/></g></svg></span>`;
}

const iconUsers = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
const iconPin = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>';
const iconClock = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';

/** roster: display names of the crew's members on this site (live only,
 *  anonymised drivers are already excluded by the DB view). */
/** opts.sample: sample crew -- demo "Request to join" (keyed by slug) and a
 *  greyed-out Discord link, so the card is not a dead end (2026-10-02). */
export function crewCardHtml(c: HubCrew, roster?: string[], opts: { sample?: boolean } = {}): string {
  const discord = safeUrl(c.discord_url);
  const joinId = c.crew_id ?? (opts.sample ? c.slug : null);
  const sc = safeUrl(c.social_club_url);
  const langs = c.languages ?? [];
  const meta = [c.region, langs.map(languageLabel).join(', ')].filter(Boolean).map(esc).join(' · ');
  return `<article class="crew-card"${joinId ? ` data-crew-id="${esc(joinId)}"` : ''} data-platforms="${esc(c.platforms.join('|'))}" data-focus="${esc(c.focus.join('|'))}" data-languages="${esc(langs.join('|'))}" data-search="${esc(`${c.name} ${c.tag}`.toLowerCase())}" style="--crew-color:${safeColor(c.color)}">
  <div class="crew-card-head">
    ${crewEmblemHtml(c.color)}
    <div class="crew-card-id">
      <h3 class="crew-name">${esc(c.name)}${c.is_partner ? ' <span class="crew-partner">Partner</span>' : ''}</h3>
      ${c.member_count != null ? `<p class="crew-members">${iconUsers}${esc(c.member_count)} Members</p>` : ''}
      ${crewTagHtml(c.tag, c.color)}
    </div>
  </div>
  ${c.description ? `<p class="crew-desc">${esc(c.description)}</p>` : ''}
  <div class="crew-chips">
    ${platformChips(c.platforms)}
    ${c.focus.map((f) => `<span class="chip">${esc(focusLabels[f] ?? f)}</span>`).join('')}
  </div>
  ${roster && roster.length ? `<details class="crew-roster"><summary>Roster · ${roster.length} driver${roster.length === 1 ? '' : 's'}</summary><ul>${roster.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></details>` : ''}
  <div class="crew-foot">
    <span class="crew-meta">${meta}</span>
    <span class="crew-links">
      ${joinId ? '<span class="crew-join-slot"></span>' : ''}
      ${sc ? `<a class="crew-link" href="${esc(sc)}" target="_blank" rel="noopener">Social Club</a>` : ''}
      ${discord ? `<a class="crew-link crew-link-discord" href="${esc(discord)}" target="_blank" rel="noopener">Discord</a>` : opts.sample ? '<span class="crew-link crew-link-discord is-disabled" title="Sample crew — no Discord server">Discord</span>' : ''}
      ${c.crew_id ? `<a class="crew-report" href="${esc(`${import.meta.env.BASE_URL}report-content/?crew=${encodeURIComponent(c.crew_id)}`)}" title="Report this crew to the moderators">Report</a>` : ''}
    </span>
  </div>
</article>`;
}

// Build time renders these in UTC (the server has no idea where the visitor
// is); the runtime script re-formats every [data-ts] element into the
// visitor's local time zone right after load.
/** opts.rsvp: sign-up slot the page script fills (live and sample events).
 *  opts.sample: marks the row as a sample event. */
/** Public PSN profile page (Fausto 2026-10-04): opens the profile on the web or
 *  in the PlayStation app, where players can send a friend request. */
export function psnProfileUrl(name: string): string {
  return `https://profile.playstation.com/${encodeURIComponent(name)}`;
}

export function eventRowHtml(e: HubEvent, opts: { rsvp?: boolean; sample?: boolean } = {}): string {
  const start = new Date(e.starts_at);
  const end = e.ends_at ? new Date(e.ends_at) : null;
  const day = start.toLocaleDateString('en-GB', { day: '2-digit', timeZone: 'UTC' });
  const mon = start.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' });
  const wd = start.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });
  const time = start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  const endTime = end ? end.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) : '';
  const join = safeUrl(e.join_url);
  const cancelled = e.status === 'cancelled';
  // "Hosted by <PSN name> <crew tag>" right after the title (DEC-0077)
  // PSN name (marked "PSN" so players know whom to add on PlayStation), else
  // the creator's site display name as fallback (DEC-0077).
  const who = e.host_name
    ? (opts.sample
      ? `<strong title="PSN name — add the host on PlayStation">${esc(e.host_name)}</strong><span class="ev-psn">PSN</span>`
      : `<a class="ev-psn-link" href="${esc(psnProfileUrl(e.host_name))}" target="_blank" rel="noopener nofollow" title="Open the host's PSN profile to send a friend request"><strong>${esc(e.host_name)}</strong><span class="ev-psn">PSN</span></a>`)
    : e.host_account ? `<strong>${esc(e.host_account)}</strong>` : '';
  const hostedBy = who || e.host
    ? `<span class="ev-by">Hosted by ${who}${e.host ? ` ${crewTagHtml(e.host.tag, e.host.color, 'sm')}` : ''}</span>`
    : '';
  return `<article class="ev-row${cancelled ? ' is-cancelled' : ''}" id="event-${esc(e.event_id)}" data-type="${esc(e.event_type)}" data-platforms="${esc(e.platforms.join('|'))}" data-start="${esc(e.starts_at)}">
  <div class="ev-date" data-ts="${esc(e.starts_at)}">
    <span class="ev-wd" data-fmt="wd">${esc(wd)}</span>
    <span class="ev-day" data-fmt="day">${esc(day)}</span>
    <span class="ev-mon" data-fmt="mon">${esc(mon)}</span>
  </div>
  <div class="ev-main">
    <div class="ev-top">
      <span class="chip chip-type chip-${esc(e.event_type)}">${esc(eventTypeLabels[e.event_type] ?? e.event_type)}</span>
      ${cancelled ? '<span class="chip chip-cancelled">Cancelled</span>' : ''}
      ${opts.sample ? '<span class="chip chip-sample" title="Example event — it will not take place">Sample</span>' : ''}
      ${platformChips(e.platforms)}
    </div>
    <h3 class="ev-title"><span class="ev-title-text">${esc(e.title)}</span>${hostedBy}</h3>
    <p class="ev-facts">
      <span class="ev-time">${iconClock}<span data-ts="${esc(e.starts_at)}" data-fmt="time">${esc(time)}</span>${end ? `–<span data-ts="${esc(e.ends_at)}" data-fmt="time">${esc(endTime)}</span>` : ''} <span class="ev-tz" data-tz="${esc(e.starts_at)}">UTC</span></span>
      ${e.location ? `<span class="ev-loc">${iconPin}${esc(e.location)}</span>` : ''}
      ${eventDiscordHtml(e, Boolean(opts.sample))}
      ${eventStreamHtml(e, Boolean(opts.sample))}
      ${join && !cancelled ? `<a class="ev-info" href="${esc(join)}" target="_blank" rel="noopener">Event info ↗</a>` : ''}
      ${!opts.sample ? `<a class="ev-report" href="${esc(`${import.meta.env.BASE_URL}report-content/?event=${encodeURIComponent(e.event_id)}`)}" title="Report this event to the moderators">Report</a>` : ''}
    </p>
    ${e.description ? `<p class="ev-desc">${esc(e.description)}</p>` : ''}
  </div>
  <div class="ev-side">
    ${opts.rsvp ? `<div class="ev-rsvp" data-rsvp="${esc(e.event_id)}"></div>` : ''}
  </div>
</article>`;
}

/** Re-formats all [data-ts] nodes inside `root` into the visitor's local time. */
export function localizeTimes(root: ParentNode): void {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  root.querySelectorAll<HTMLElement>('[data-ts]').forEach((el) => {
    const d = new Date(el.dataset.ts!);
    if (Number.isNaN(d.getTime())) return;
    const fmt = el.dataset.fmt;
    if (fmt === 'time') { el.textContent = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }); return; }
    el.querySelectorAll<HTMLElement>('[data-fmt]').forEach((part) => {
      if (part.dataset.fmt === 'wd') part.textContent = d.toLocaleDateString('en-GB', { weekday: 'short' });
      if (part.dataset.fmt === 'day') part.textContent = d.toLocaleDateString('en-GB', { day: '2-digit' });
      if (part.dataset.fmt === 'dnum') part.textContent = d.toLocaleDateString('en-GB', { day: 'numeric' });
      if (part.dataset.fmt === 'mon') part.textContent = d.toLocaleDateString('en-GB', { month: 'short' });
    });
  });
  // Zone abbreviation per event date, not per today -- an event in winter
  // must show CET, not the CEST that applies while the page is viewed.
  root.querySelectorAll<HTMLElement>('[data-tz]').forEach((el) => {
    const at = new Date(el.dataset.tz!);
    const short = new Intl.DateTimeFormat('en-GB', { timeZoneName: 'short' }).formatToParts(Number.isNaN(at.getTime()) ? new Date() : at).find((p) => p.type === 'timeZoneName')?.value;
    el.textContent = short ?? tz;
    el.title = `Shown in your local time (${tz})`;
  });
}

/** Month heading key, e.g. "2026-11" -> "November 2026" (local time). */
export function monthLabel(iso: string, utc = false): string {
  return new Date(iso).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', ...(utc ? { timeZone: 'UTC' } : {}) });
}
