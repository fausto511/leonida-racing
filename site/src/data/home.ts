// Home page building blocks (Redesign Phase 3, DEC-0116). Used at build time
// (sample/fallback rows) and in the browser (live rows), so both look identical.
// COPY STATUS: row labels ("Open spot", "by", "sample until launch") are Claude
// placeholders from the mockup -> Codex review (DEC-0088).
import { esc, regionLabel, crewTagHtml, focusLabels, eventTypeLabels, type HubCrew, type HubEvent } from './hub';
import { lapTime } from './leaderboard';

const base = import.meta.env.BASE_URL;

/** Event row: date block · title · "time · type · by host TAG"; right: sign-up slot
 *  filled by scripts/event-rsvp.ts. Whole row links to the calendar entry. */
export function homeEventRow(e: HubEvent): string {
  const d = new Date(e.starts_at);
  const wd = d.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' }).toUpperCase();
  const day = d.toLocaleDateString('en-GB', { day: 'numeric', timeZone: 'UTC' });
  const mon = d.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' }).toUpperCase();
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  const host = e.host_name ?? e.host_account ?? e.host?.name ?? null;
  const hostTag = e.host ? crewTagHtml(e.host.tag, e.host.color, 'sm') : '';
  const href = `${base}community/events/#event-${encodeURIComponent(e.event_id)}`;
  return `<div class="crow" data-event="${esc(e.event_id)}">
  <a class="clink" href="${href}" aria-label="${esc(e.title)} in the event calendar"></a>
  <span class="cdate" data-ts="${esc(e.starts_at)}"><span data-fmt="wd" class="up">${esc(wd)}</span><b class="tnum" data-fmt="dnum">${esc(day)}</b><span data-fmt="mon" class="up">${esc(mon)}</span></span>
  <span class="cmain"><b>${esc(e.title)}</b><span><span data-ts="${esc(e.starts_at)}" data-fmt="time" class="tnum">${esc(time)}</span> · ${esc(eventTypeLabels[e.event_type] ?? e.event_type)}${host ? ` · by ${esc(host)}` : ''}${hostTag ? ` ${hostTag}` : ''}</span></span>
  <span class="cside" data-rsvp="${esc(e.event_id)}"></span>
</div>`;
}

/** Free slot so the card always shows 3 rows (DEC-0116). */
export function homeOpenSpotRow(): string {
  return `<div class="crow cfree">
  <a class="clink" href="${base}account/events/" aria-label="Host an event"></a>
  <span class="cdate"><span class="cplus" aria-hidden="true">+</span></span>
  <span class="cmain"><b>Open spot</b><span>Your event could be here</span></span>
</div>`;
}

/** Crew row: tag · name · "focus · region · members"; right: join slot filled by
 *  scripts/crew-membership.ts (it looks for .crew-card[data-crew-id] .crew-join-slot). */
export function homeCrewRow(c: HubCrew, sample: boolean): string {
  const joinId = sample ? c.slug : c.crew_id ?? '';
  const focus = c.focus.slice(0, 2).map((f) => focusLabels[f] ?? f).join(', ');
  const sub = [focus || null, regionLabel(c.region) || null, c.member_count != null ? `${c.member_count} ${c.member_count === 1 ? 'member' : 'members'}` : null].filter(Boolean).map((x) => esc(x)).join(' · ');
  const href = sample ? `${base}community/crews/` : `${base}community/crews/#crew-${encodeURIComponent(c.crew_id ?? '')}`;
  return `<div class="crow crew-card" data-crew-id="${esc(joinId)}">
  <a class="clink" href="${href}" aria-label="${esc(c.name)} in the crew directory"></a>
  ${crewTagHtml(c.tag, c.color, 'sm')}
  <span class="cmain"><b>${esc(c.name)}</b><span>${sub}</span></span>
  <span class="cside crew-join-slot"></span>
</div>`;
}

export interface TRow { rank: number; driver: string; crew: { tag: string; color: string } | null; car: string; ms: number; me?: boolean; gapBefore?: boolean }

/** Leaderboard row of the Time Attack band. */
export function homeLbRow(r: TRow): string {
  const href = `${base}time-attack/gellhorn-international-raceway/`;
  return `<a class="trow${r.me ? ' me' : ''}${r.gapBefore ? ' gapb' : ''}" href="${href}">
  <span class="tpos tnum${r.rank === 1 ? ' is-first' : ''}">${r.rank}</span>
  <span class="tdrv"><span class="tn">${esc(r.driver)}</span>${r.crew ? ` ${crewTagHtml(r.crew.tag, r.crew.color, 'sm')}` : ''}</span>
  <span class="tcar">${esc(r.car)}</span>
  <span class="ttime tnum">${lapTime(r.ms)}</span>
</a>`;
}
