// ICON role (DEC-0215, Fausto 04.11.2026): well-known people of the GTA racing scene
// (creators, hosts, insiders), granted by moderators. Internal key 'notable' in hub_roles;
// the label below is the only place the visible name lives, so a rename is one edit.
// Public wording (Fausto 04.11.): "Verified user" / "Verified crew" -- short, final. "ICON" stays the internal
// role name in the moderator area.
export const ICON_LABEL = 'Verified user';

/** Small ICON badge next to a name, with a leading space; '' when the driver isn't an ICON. */
// Verified crew (DEC-0216): same rosette, so people and crews share one sign for "checked as genuine".
export const VERIFIED_CREW_TITLE = 'Verified crew';
export function verifiedCrewHtml(isVerified: boolean | undefined): string {
  return isVerified ? ` <span class="icon-tag" role="img" aria-label="Verified crew" title="${VERIFIED_CREW_TITLE}"></span>` : '';
}

export function iconTagHtml(isIcon: boolean | undefined): string {
  // Symbol only (rosette with cut-out check, styles/tokens.css); the name stays in tooltip + screen reader label.
  return isIcon ? ` <span class="icon-tag" role="img" aria-label="${ICON_LABEL}" title="${ICON_LABEL}"></span>` : '';
}
