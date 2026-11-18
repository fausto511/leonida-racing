// GTA VI launch (RS-0050). Rockstar has announced the date (Nov 19, 2026) but
// no unlock time, so countdowns run to 00:00 in the visitor's own time zone
// and only show the date, never a clock time. If Rockstar publishes a fixed
// unlock moment, change LAUNCH_AT to that instant (e.g. '2026-11-19T04:00:00Z').
export const LAUNCH_DATE = '2026-11-19'; // local midnight of this day
export const LAUNCH_AT: string | null = null; // fixed instant, if ever announced
export const LAUNCH_LABEL = 'Nov 19, 2026';

/** Launch switch (RS-0128, Fausto 18.11.2026): true from LAUNCH_AT, else from 00:00 UTC of LAUNCH_DATE.
 *  At build time the scheduled build after midnight UTC flips static pages; in the browser it flips live. */
export const LAUNCH_MS = new Date(LAUNCH_AT ?? `${LAUNCH_DATE}T00:00:00Z`).getTime();
export const isLaunched = () => Date.now() >= LAUNCH_MS;
