// ICON role (DEC-0215, Fausto 04.11.2026): well-known people of the GTA racing scene
// (creators, hosts, insiders), granted by moderators. Internal key 'notable' in hub_roles;
// the label below is the only place the visible name lives, so a rename is one edit.
// COPY STATUS: label decided by Fausto; tooltip = Claude placeholder, Codex review pending.
export const ICON_LABEL = 'ICON';
export const ICON_TITLE = 'Known in the GTA racing scene';

/** Small ICON badge next to a name, with a leading space; '' when the driver isn't an ICON. */
// Verified crew (DEC-0216): same rosette, so people and crews share one sign for "checked as genuine".
// COPY STATUS: tooltip = Claude placeholder, Codex review pending.
export const VERIFIED_CREW_TITLE = 'Verified crew — confirmed as the original by Leonida Racing';
export function verifiedCrewHtml(isVerified: boolean | undefined): string {
  return isVerified ? ` <span class="icon-tag" role="img" aria-label="Verified crew" title="${VERIFIED_CREW_TITLE}"></span>` : '';
}

export function iconTagHtml(isIcon: boolean | undefined): string {
  // Symbol only (rosette with cut-out check, styles/tokens.css); the name stays in tooltip + screen reader label.
  return isIcon ? ` <span class="icon-tag" role="img" aria-label="${ICON_LABEL}" title="${ICON_LABEL} — ${ICON_TITLE}"></span>` : '';
}
