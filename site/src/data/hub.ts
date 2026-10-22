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
  /** set by moderators: "Official" badge (site crews, original creators; Fausto 2026-10-07) */
  is_official?: boolean;
  /** DEC-0144: 'open' = join at once, 'request' = leader/commissioner approves (default) */
  join_mode?: 'open' | 'request';
}

/** Crew regions (Fausto 2026-10-07): fixed list instead of free text, one per crew.
 *  Same values as the DB check crews_region_valid. */
export type CrewRegion = 'international' | 'north-america' | 'south-america' | 'europe' | 'middle-east' | 'africa' | 'asia' | 'oceania';
export const crewRegionLabels: Record<CrewRegion, string> = {
  international: 'International',
  'north-america': 'North America',
  'south-america': 'South America',
  europe: 'Europe',
  'middle-east': 'Middle East',
  africa: 'Africa',
  asia: 'Asia',
  oceania: 'Oceania',
};
export function regionLabel(r: string | null | undefined): string {
  return r ? (crewRegionLabels as Record<string, string>)[r] ?? r : '';
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
// Real data at build time (Fausto 19.10.2026): community.generated.json is written by
// scripts/fetch-vehicles.mjs before every CI build (published crews, upcoming events).
// ---------------------------------------------------------------------------
import communityData from './community.generated.json';
export const buildCrews: HubCrew[] = (communityData as { crews: HubCrew[] }).crews;
export const buildEvents: HubEvent[] = (communityData as { events: HubEvent[] }).events;
/** House crews run by Leonida Racing (Fausto 19.10.2026): used for the crew tags of the
 *  sample leaderboard until launch. Site crews LERA/GRAC are deliberately not used there. */
export const HOUSE_CREW_TAGS = ['BCRW', 'LOWN', 'VCSR'];
/** Flagship crews (DEC-0143): moderated, run events. */
export const FLAGSHIP_CREW_TAGS = ['LERA', 'GRAC'];
/** "Pick a crew" in My Account > Crew (DEC-0144): flagships first, then the side crews. */
export const PICK_CREW_TAGS = [...FLAGSHIP_CREW_TAGS, ...HOUSE_CREW_TAGS];

// Fictional sample crews/events removed 19.10.2026 (Fausto): Community pages show only
// real published crews/events (build snapshot + live).

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

const safeColor = (c: string) => (/^#[0-9a-fA-F]{6}$/.test(c) ? c : '#9C9CAB');
const safeUrl = (u: string | null) => (u && /^https:\/\//.test(u) ? u : null);
const DISCORD_RX = /^https:\/\/(discord\.gg|discord\.com\/invite)\/[A-Za-z0-9-]+$/;
/** Where to meet the host: the event's own Discord invite, else the host crew's (RS-0034). */
export function eventDiscord(e: HubEvent): string | null {
  const u = e.discord_url || e.host?.discord_url || null;
  return u && DISCORD_RX.test(u) ? u : null;
}
export const iconDiscord = '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.3 5.3A18 18 0 0 0 15.9 4l-.3.6a15 15 0 0 1 4 1.6 16 16 0 0 0-13.2 0 15 15 0 0 1 4-1.6L10.1 4a18 18 0 0 0-4.4 1.3C2.9 9 2.2 12.6 2.5 16.1a18 18 0 0 0 5.5 2.8l.8-1.3a11 11 0 0 1-1.9-.9l.5-.4a13 13 0 0 0 9.2 0l.5.4a11 11 0 0 1-1.9.9l.8 1.3a18 18 0 0 0 5.5-2.8c.4-4-.7-7.5-2.2-10.8ZM9.3 14c-.8 0-1.4-.7-1.4-1.6s.6-1.6 1.4-1.6 1.4.7 1.4 1.6-.6 1.6-1.4 1.6Zm5.4 0c-.8 0-1.4-.7-1.4-1.6s.6-1.6 1.4-1.6 1.4.7 1.4 1.6-.6 1.6-1.4 1.6Z"/></svg>';
/** Discord link in the event's info line (DEC-0077); sample events get a
 *  greyed-out demo link. */
export function eventDiscordHtml(e: HubEvent, sample = false): string {
  if (e.status === 'cancelled') return '';
  if (sample) return `<span class="ev-dc is-disabled" title="Sample event — no real Discord server">${iconDiscord}Event Discord</span>`;
  const u = eventDiscord(e);
  return u ? `<a class="ev-dc" href="${esc(u)}" target="_blank" rel="noopener" title="Opens the host's Discord server">${iconDiscord}Event Discord</a>` : '';
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
  const wheel = luminance(c) > 0.45 ? '#0B0B14' : '#ffffff';
  return `<span class="crew-emblem" aria-hidden="true"><svg viewBox="0 0 48 48" width="48" height="48"><path d="${EMBLEM_PANEL}" fill="${c}"/><g transform="translate(13.5 13.5) scale(0.041016) translate(0 512) scale(0.1 -0.1)"><path fill="${wheel}" d="${EMBLEM_WHEEL}"/></g></svg></span>`;
}

const iconUsers = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
const iconPin = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>';

/** roster: display names of the crew's members on this site (live only,
 *  anonymised drivers are already excluded by the DB view). */
/** opts.sample: sample crew -- demo "Request to join" (keyed by slug) and a
 *  greyed-out Discord link, so the card is not a dead end (2026-10-02). */
/** opts.actions: HTML for the action area at the bottom of the card (My Account:
 *  status + Set as Active Crew / Leave Crew). Without it, cards that can be joined
 *  get an empty .crew-join-slot there, filled by scripts/crew-membership.ts (2026-10-07). */
export function crewCardHtml(c: HubCrew, _roster?: string[], opts: { sample?: boolean; actions?: string; badges?: string } = {}): string {
  // Redesign (boards Community / Crews): crew-colour bar on top, tag + name, badges, focus chips,
  // two-line description, "region · languages · members", foot with Discord/SC + Request Invite.
  // Blocks keep fixed heights so lines sit at the same place on every card (Fausto 2026-10-07).
  // COPY STATUS: labels are Claude placeholders, Codex review pending.
  const discord = safeUrl(c.discord_url);
  const joinId = c.crew_id ?? (opts.sample ? c.slug : null);
  const sc = safeUrl(c.social_club_url);
  const langs = (c.languages ?? []).slice(0, 2);
  const members = c.member_count != null ? `${c.member_count} ${c.member_count === 1 ? 'member' : 'members'}` : '';
  const meta = [regionLabel(c.region), langs.map(languageLabel).join(', '), members].filter(Boolean).map(esc).join('<span class="dot">·</span>');
  const focus = c.focus.map((f) => focusLabels[f] ?? f);
  const shown = focus.length > 3 ? focus.slice(0, 2) : focus;
  const rest = focus.slice(shown.length);
  const chips = shown.map((f) => `<span class="crew-chip">${esc(f)}</span>`).concat(rest.length ? [`<span class="crew-chip" title="${esc(rest.join(', '))}">+${rest.length}</span>`] : []).join('');
  const badges = [
    c.is_official ? '<span class="crew-badge b-official" title="Official crew of this site or of the original creators">Official</span>' : '',
    c.is_featured ? '<span class="crew-badge b-featured">Featured</span>' : '',
    c.is_partner ? '<span class="crew-badge b-partner">Partner</span>' : '',
    opts.badges ?? '',
  ].join('');
  const scLink = sc ? `<a class="crew-icon-link crew-icon-sc" href="${esc(sc)}" target="_blank" rel="noopener" title="Social Club" aria-label="Social Club">SC</a>` : '';
  const dcLink = discord ? `<a class="crew-icon-link crew-icon-dc" href="${esc(discord)}" target="_blank" rel="noopener" title="Discord" aria-label="Discord">${iconDiscord}</a>`
    : opts.sample ? `<span class="crew-icon-link crew-icon-dc is-disabled" title="Sample crew — no Discord server">${iconDiscord}</span>` : '';
  const report = c.crew_id ? `<a class="crew-report" href="${esc(`${import.meta.env.BASE_URL}report-content/?crew=${encodeURIComponent(c.crew_id)}`)}" title="Report this crew to the moderators" aria-label="Report this crew"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 22V4"/><path d="M4 4h12l-2 4 2 4H4"/></svg></a>` : '';
  const actions = opts.actions ? `<div class="crew-actions">${opts.actions}</div>` : joinId ? '<span class="crew-join-slot"></span>' : '';
  return `<article class="crew-card"${c.crew_id && !opts.sample ? ` id="crew-${esc(c.crew_id)}"` : ''}${joinId ? ` data-crew-id="${esc(joinId)}"` : ''} data-platforms="${esc(c.platforms.join('|'))}" data-focus="${esc(c.focus.join('|'))}" data-featured="${c.is_featured ? '1' : '0'}" data-languages="${esc((c.languages ?? []).join('|'))}" data-search="${esc(`${c.name} ${c.tag}`.toLowerCase())}" style="--crew-color:${safeColor(c.color)}">
  ${report}
  <div class="crew-head">${crewTagHtml(c.tag, c.color)}<h3 class="crew-name" title="${esc(c.name)}">${esc(c.name)}</h3></div>
  ${badges ? `<div class="crew-badges">${badges}</div>` : ''}
  <div class="crew-chips">${chips}</div>
  <p class="crew-desc">${c.description ? esc(c.description) : ''}</p>
  <p class="crew-meta">${iconUsers}<span>${meta}</span></p>
  <div class="crew-foot"><span class="crew-links">${dcLink}${scLink}</span>${actions}</div>
</article>`;
}

// Build time renders these in UTC (the server has no idea where the visitor
// is); the runtime script re-formats every [data-ts] element into the
// visitor's local time zone right after load.
/** opts.rsvp: sign-up slot the page script fills (live and sample events).
 *  opts.sample: marks the row as a sample event. */
/** Public PSN profile page (Fausto 2026-10-04): opens the profile on the web or
 *  in the PlayStation app, where players can send a friend request. */
export const iconPlayStation = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8.984 2.596v17.547l3.915 1.261V6.688c0-.69.304-1.151.794-.991.636.18.76.814.76 1.505v5.875c2.441 1.193 4.362-.002 4.362-3.152 0-3.237-1.126-4.675-4.438-5.827-1.307-.448-3.728-1.186-5.39-1.502zm4.656 16.241l6.296-2.275c.715-.258.826-.625.246-.818-.586-.192-1.637-.139-2.357.123l-4.205 1.5V14.98l.24-.085s1.201-.42 2.913-.615c1.696-.18 3.785.03 5.437.661 1.848.601 2.04 1.472 1.576 2.072-.465.6-1.622 1.036-1.622 1.036l-8.544 3.107V18.86zM1.807 18.6c-1.9-.545-2.214-1.668-1.352-2.32.801-.586 2.16-1.052 2.16-1.052l5.615-2.013v2.313L4.205 17c-.705.271-.825.632-.239.826.586.195 1.637.15 2.343-.12L8.247 17v2.074c-.12.03-.256.044-.39.073-1.939.331-3.996.196-6.038-.479z"/></svg>';

export function psnProfileUrl(name: string): string {
  return `https://profile.playstation.com/${encodeURIComponent(name)}`;
}

export function eventRowHtml(e: HubEvent, opts: { rsvp?: boolean; sample?: boolean; full?: boolean } = {}): string {
  // Redesign (boards Community / Events): date block · title · "type  time · place" ·
  // "Hosted by <PSN> TAG · Event Discord · PS5" · description; right: sign-up slot
  // (scripts/event-rsvp.ts). Times are rendered in UTC here and localised in the browser.
  const start = new Date(e.starts_at);
  const end = e.ends_at ? new Date(e.ends_at) : null;
  const day = start.toLocaleDateString('en-GB', { day: 'numeric', timeZone: 'UTC' });
  const mon = start.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' });
  const wd = start.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });
  const time = start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  const endTime = end ? end.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) : '';
  const join = safeUrl(e.join_url);
  const cancelled = e.status === 'cancelled';
  // PSN name (marked "PSN" so players know whom to add on PlayStation), else the
  // creator's site display name as fallback (DEC-0077).
  const who = e.host_name
    ? (opts.sample
      ? `<strong title="PSN name — add the host on PlayStation">${esc(e.host_name)}</strong><span class="ev-psn">PSN</span>`
      : `<a class="ev-psn-link" href="${esc(psnProfileUrl(e.host_name))}" target="_blank" rel="noopener nofollow" title="Open the host's PSN profile to send a friend request"><strong>${esc(e.host_name)}</strong><span class="ev-psn">PSN</span></a>`)
    : e.host_account ? `<strong>${esc(e.host_account)}</strong>` : '';
  const hostedBy = who || e.host
    ? `<span class="ev-by"><span class="ev-by-l">Hosted by</span> ${who}${e.host ? ` ${crewTagHtml(e.host.tag, e.host.color, 'sm')}` : ''}</span>`
    : '';
  const plats = e.platforms.filter((p) => (ACTIVE_PLATFORMS as readonly string[]).includes(p)).map((p) => platformShort[p] ?? p).join(', ');
  const l2 = [
    hostedBy,
    eventDiscordHtml(e, Boolean(opts.sample)),
    eventStreamHtml(e, Boolean(opts.sample)),
    plats ? `<span class="ev-plat">${esc(plats)}</span>` : '',
    join && !cancelled ? `<a class="ev-info" href="${esc(join)}" target="_blank" rel="noopener">Event info ↗</a>` : '',
    !opts.sample ? `<a class="ev-report" href="${esc(`${import.meta.env.BASE_URL}report-content/?event=${encodeURIComponent(e.event_id)}`)}" title="Report this event to the moderators">Report</a>` : '',
  ].filter(Boolean).join('<span class="dot" aria-hidden="true">·</span>');
  const dateBlock = `<div class="ev-date" data-ts="${esc(e.starts_at)}">
    <span class="ev-wd" data-fmt="wd">${esc(wd)}</span>
    <span class="ev-day" data-fmt="dnum">${esc(day)}</span>
    <span class="ev-mon" data-fmt="mon">${esc(mon)}</span>
  </div>`;
  const timeHtml = `<b class="ev-time"><span data-ts="${esc(e.starts_at)}" data-fmt="time">${esc(time)}</span>${end ? `–<span data-ts="${esc(e.ends_at)}" data-fmt="time">${esc(endTime)}</span>` : ''}</b>`;
  if (opts.full) {
    // Event calendar (board Events): chips · title · Hosted by · time + place · links · description;
    // right: sign-up slot, Share + Report at the bottom.
    const iconClock = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>';
    const links = [
      eventDiscordHtml(e, Boolean(opts.sample)),
      eventStreamHtml(e, Boolean(opts.sample)),
      e.event_type === 'time-attack' && !cancelled ? `<a class="ev-lb" href="${import.meta.env.BASE_URL}time-attack/gellhorn-international-raceway/"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z"/></svg>Gellhorn leaderboard →</a>` : '',
      join && !cancelled ? `<a class="ev-info" href="${esc(join)}" target="_blank" rel="noopener">Event info ↗</a>` : '',
    ].filter(Boolean).join('<span class="dot" aria-hidden="true">·</span>');
    const share = cancelled ? '' : `<button type="button" class="ev-share" data-share="${esc(e.event_id)}" data-title="${esc(e.title)}"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4"/></svg>Share</button>`;
    const report = !opts.sample ? `<a class="ev-report" href="${esc(`${import.meta.env.BASE_URL}report-content/?event=${encodeURIComponent(e.event_id)}`)}" title="Report this event to the moderators">Report</a>` : '<span class="ev-report is-off" title="Sample event">Report</span>';
    return `<article class="ev-row ev-fullrow${cancelled ? ' is-cancelled' : ''}" id="event-${esc(e.event_id)}" data-type="${esc(e.event_type)}" data-platforms="${esc(e.platforms.join('|'))}" data-start="${esc(e.starts_at)}">
  ${dateBlock}
  <div class="ev-main">
    <p class="ev-chips"><span class="ev-type">${esc(eventTypeLabels[e.event_type] ?? e.event_type)}</span>${plats ? `<span class="ev-type">${esc(plats)}</span>` : ''}${opts.sample ? '<span class="ev-flag" title="Example event — it will not take place">Sample</span>' : ''}</p>
    <h3 class="ev-title">${esc(e.title)}</h3>
    ${hostedBy ? `<p class="ev-l2">${hostedBy}</p>` : ''}
    <p class="ev-l1"><span class="ev-clock">${iconClock}${timeHtml}</span>${e.location ? `<span class="dot" aria-hidden="true">·</span><span class="ev-loc">${iconPin}${esc(e.location)}</span>` : ''}</p>
    ${links ? `<p class="ev-l3">${links}</p>` : ''}
    ${e.description ? `<p class="ev-desc">${esc(e.description)}</p>` : ''}
  </div>
  <div class="ev-side">
    ${cancelled ? '<span class="ev-flag ev-cancel">Cancelled</span>' : ''}
    ${opts.rsvp ? `<div class="ev-rsvp" data-rsvp="${esc(e.event_id)}"></div>` : ''}
    <div class="ev-tools">${share}${report}</div>
  </div>
</article>`;
  }
  return `<article class="ev-row${cancelled ? ' is-cancelled' : ''}" id="event-${esc(e.event_id)}" data-type="${esc(e.event_type)}" data-platforms="${esc(e.platforms.join('|'))}" data-start="${esc(e.starts_at)}">
  <div class="ev-date" data-ts="${esc(e.starts_at)}">
    <span class="ev-wd" data-fmt="wd">${esc(wd)}</span>
    <span class="ev-day" data-fmt="dnum">${esc(day)}</span>
    <span class="ev-mon" data-fmt="mon">${esc(mon)}</span>
  </div>
  <div class="ev-main">
    <h3 class="ev-title">${esc(e.title)}</h3>
    <p class="ev-l1"><span class="ev-type">${esc(eventTypeLabels[e.event_type] ?? e.event_type)}</span>${cancelled ? '<span class="ev-flag ev-cancel">Cancelled</span>' : ''}${opts.sample ? '<span class="ev-flag" title="Example event — it will not take place">Sample</span>' : ''}<b class="ev-time"><span data-ts="${esc(e.starts_at)}" data-fmt="time">${esc(time)}</span>${end ? `–<span data-ts="${esc(e.ends_at)}" data-fmt="time">${esc(endTime)}</span>` : ''}</b>${e.location ? `<span class="dot" aria-hidden="true">·</span><span class="ev-loc">${iconPin}${esc(e.location)}</span>` : ''}</p>
    ${l2 ? `<p class="ev-l2">${l2}</p>` : ''}
    ${e.description ? `<p class="ev-desc">${esc(e.description)}</p>` : ''}
  </div>
  <div class="ev-side">
    ${opts.rsvp ? `<div class="ev-rsvp" data-rsvp="${esc(e.event_id)}"></div>` : ''}
  </div>
</article>`;
}

/** Last row of an event list: invitation to host (boards Community / Events). */
export function eventOpenSpotHtml(): string {
  return `<div class="ev-open"><span class="ev-open-plus" aria-hidden="true">+</span><span class="ev-open-t"><b>Open spot</b><span>Host a race, a meet, or a hotlap session.</span></span><a class="btn btn-s ev-open-btn" href="${import.meta.env.BASE_URL}account/events/">Become a host</a></div>`;
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
