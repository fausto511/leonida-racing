// Community tracks (Hub > Tracks, RS-0045, 2026-09-30). Race jobs built by
// creators in GTA VI. Creators submit title + Social Club link + key facts;
// a moderator checks them against the Social Club page and publishes.
// One renderer, used at build time (flagged samples) and at runtime (live rows).
import { esc } from './hub';

export type TrackLayout = 'circuit' | 'point-to-point';
// PLACEHOLDER list (GTA Online race types) until GTA VI's race types are
// known. Must match the DB check constraint on community_tracks.race_types.
export type RaceType = 'standard' | 'street' | 'stunt' | 'pursuit' | 'open-wheel' | 'transform' | 'special-vehicle' | 'drift';

export interface CommunityTrack {
  track_id: string;
  title: string;
  social_club_url: string | null; // null only for sample rows
  layout: TrackLayout;
  race_types: RaceType[];
  vehicle_classes: string[];
  players_min: number;
  players_max: number;
  length_km: number;
  created_at: string;
  updated_at: string;
  creator_name?: string | null; // site display name (public_drivers), filled at runtime
}

export const layoutLabels: Record<TrackLayout, string> = { circuit: 'Circuit (laps)', 'point-to-point': 'Point to point' };
export const raceTypeLabels: Record<RaceType, string> = {
  standard: 'Standard',
  street: 'Street',
  stunt: 'Stunt',
  pursuit: 'Pursuit',
  'open-wheel': 'Open Wheel',
  transform: 'Transform',
  'special-vehicle': 'Special Vehicle',
  drift: 'Drift',
};
/** Same classes as the Garage (vehicles.ts); must match the DB check constraint. */
export const trackVehicleClasses = ['Coupes', 'Muscle', 'Off-Road', 'SUVs', 'Sedans', 'Sports', 'Sports Classics', 'Super'];

const d = (daysAgo: number) => new Date(Date.UTC(2026, 8, 30) - daysAgo * 864e5).toISOString();
export const sampleTracks: CommunityTrack[] = [
  { track_id: 't1', title: 'Vice City Night Loop', social_club_url: null, layout: 'circuit', race_types: ['standard', 'street'], vehicle_classes: ['Sports', 'Super'], players_min: 2, players_max: 16, length_km: 4.8, created_at: d(20), updated_at: d(3), creator_name: 'Racer_01' },
  { track_id: 't2', title: 'Keys Causeway Sprint', social_club_url: null, layout: 'point-to-point', race_types: ['standard'], vehicle_classes: ['Sports', 'Sports Classics', 'Muscle'], players_min: 2, players_max: 12, length_km: 11.2, created_at: d(14), updated_at: d(14), creator_name: 'CoastalRun' },
  { track_id: 't3', title: 'Everglades Mud Run', social_club_url: null, layout: 'point-to-point', race_types: ['standard'], vehicle_classes: ['Off-Road', 'SUVs'], players_min: 2, players_max: 8, length_km: 7.5, created_at: d(40), updated_at: d(9), creator_name: 'MintyTires' },
  { track_id: 't4', title: 'Port Gellhorn Stunt Park', social_club_url: null, layout: 'circuit', race_types: ['stunt'], vehicle_classes: ['Super'], players_min: 1, players_max: 30, length_km: 3.1, created_at: d(6), updated_at: d(6), creator_name: 'NeonDrift' },
];

const iconUsers = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
const iconRoute = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/></svg>';

export const kmToMi = (km: number) => km * 0.621371;
const fmtLen = (km: number) => `${km.toLocaleString('en-US', { maximumFractionDigits: 1 })} km · ${kmToMi(km).toLocaleString('en-US', { maximumFractionDigits: 1 })} mi`;
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

const iconSave = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>';
/** Save toggle (DEC-0146): "Save" -> "Saved" (hover: "Remove"); the page script sets the state. */
export const trackSaveBtn = (id: string, saved = false) =>
  `<button type="button" class="tr-save${saved ? ' is-saved' : ''}" data-save="${esc(id)}" aria-pressed="${saved}" title="${saved ? 'Remove from your saved tracks' : 'Save to your tracks in My Account'}">${iconSave}<span class="t-def">${saved ? 'Saved' : 'Save'}</span>${saved ? '<span class="t-hov" aria-hidden="true">Remove</span>' : ''}</button>`;

/** Redesign 20.10.2026 (DEC-0146): chips, title, creator, facts; side: Save + "Open in Social Club" (outline). */
export function trackRowHtml(t: CommunityTrack, opts: { sample?: boolean; preview?: boolean; saved?: boolean } = {}): string {
  const sc = t.social_club_url && /^https:\/\/socialclub\.rockstargames\.com\//.test(t.social_club_url) ? t.social_club_url : null;
  const players = t.players_min === t.players_max ? `${t.players_max}` : `${t.players_min}–${t.players_max}`;
  const edited = t.updated_at.slice(0, 10) !== t.created_at.slice(0, 10);
  return `<article class="tr-row" data-track-id="${esc(t.track_id)}" data-layout="${esc(t.layout)}" data-types="${esc(t.race_types.join('|'))}" data-classes="${esc(t.vehicle_classes.join('|'))}" data-pmin="${t.players_min}" data-pmax="${t.players_max}">
  <div class="tr-main">
    <div class="tr-chips">
      ${t.race_types.map((r) => `<span class="chip chip-type">${esc(raceTypeLabels[r] ?? r)}</span>`).join('')}
      <span class="chip">${esc(layoutLabels[t.layout] ?? t.layout)}</span>
      ${opts.sample && !opts.preview ? '<span class="chip chip-sample" title="Example track — not a real job">Sample</span>' : ''}
    </div>
    <h3 class="tr-title">${esc(t.title)}</h3>
    ${t.creator_name ? `<p class="tr-by">by <strong>${esc(t.creator_name)}</strong></p>` : ''}
    <p class="tr-facts">
      <span>${iconRoute}${esc(fmtLen(t.length_km))}</span>
      <span>${iconUsers}${esc(players)} players</span>
      <span class="tr-classes">${t.vehicle_classes.map(esc).join(' · ')}</span>
    </p>
    <p class="tr-dates">Added ${esc(fmtDate(t.created_at))}${edited ? ` · updated ${esc(fmtDate(t.updated_at))}` : ''}</p>
  </div>
  <div class="tr-side">
    ${opts.preview ? '' : trackSaveBtn(t.track_id, Boolean(opts.saved))}
    ${sc
      ? `<a class="btn btn-outline tr-sc" href="${esc(sc)}" target="_blank" rel="noopener" title="Open the job on Social Club to bookmark it for the game">Open in Social Club <span aria-hidden="true">↗</span></a>`
      : `<span class="btn btn-outline tr-sc is-disabled" aria-disabled="true" title="Sample track — no real job">Open in Social Club <span aria-hidden="true">↗</span></span>`}
    ${!opts.sample ? `<a class="ev-report tr-report" href="${esc(`${import.meta.env.BASE_URL}report-content/`)}" title="Report this track to the moderators">Report</a>` : ''}
  </div>
</article>`;
}
