// Compact crew / event cards for the home page strips (2026-09-28).
// Full cards live in The Hub; these link there.
import { esc, regionLabel, crewEmblemHtml, crewTagHtml, focusLabels, eventTypeLabels, eventTypeImages, type HubCrew, type HubEvent } from './hub';

const base = import.meta.env.BASE_URL;

export function homeCrewCard(c: HubCrew): string {
  const focus = c.focus.slice(0, 2).map((f) => `<span class="chip">${esc(focusLabels[f] ?? f)}</span>`).join('');
  const sub = [c.member_count != null ? `${c.member_count} ${c.member_count === 1 ? 'member' : 'members'}` : null, regionLabel(c.region)].filter(Boolean).map(esc).join(' · ');
  return `<a class="hc-card" rel="nofollow" href="${base}hub/crews/?q=${encodeURIComponent(c.tag)}">
  <span class="hc-top">${crewEmblemHtml(c.color)}<span style="min-width:0"><span class="hc-name">${esc(c.name)}</span><span class="hc-sub">${sub}</span></span></span>
  <span class="hc-chips">${crewTagHtml(c.tag, c.color, 'sm')}${focus}</span>
</a>`;
}

// Event card (2026-09-30, Fausto): image by event type on top, the title as
// the main line, date + time small below (visitor's local time via
// localizeTimes; build-time fallback is UTC).
export function homeEventCard(e: HubEvent): string {
  const d = new Date(e.starts_at);
  const wd = d.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });
  const day = d.toLocaleDateString('en-GB', { day: 'numeric', timeZone: 'UTC' });
  const mon = d.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  const img = `${base}${eventTypeImages[e.event_type] ?? eventTypeImages.other}-640.webp`;
  return `<a class="hc-card he-card" href="${base}hub/events/">
  <span class="he-img"><img src="${esc(img)}" alt="" width="640" height="360" loading="lazy" /><span class="chip chip-type chip-${esc(e.event_type)} he-type">${esc(eventTypeLabels[e.event_type] ?? e.event_type)}</span></span>
  <span class="he-body">
    <span class="he-title">${esc(e.title)}</span>
    <span class="he-when"><span data-ts="${esc(e.starts_at)}"><span data-fmt="wd">${esc(wd)}</span> <span data-fmt="dnum">${esc(day)}</span> <span data-fmt="mon">${esc(mon)}</span></span> · <span data-ts="${esc(e.starts_at)}" data-fmt="time">${esc(time)}</span> <span class="he-tz" data-tz="${esc(e.starts_at)}">UTC</span></span>
    ${e.location || e.host ? `<span class="he-meta">${e.host ? crewTagHtml(e.host.tag, e.host.color, 'sm') + ' ' : ''}${e.location ? esc(e.location) : ''}</span>` : ''}
  </span>
</a>`;
}
