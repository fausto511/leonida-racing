// Last change date per vehicle page from git history (Fausto 27.11.2026): sitemap lastmod should also
// move when a car gets a new text or photo, not only when its database values change.
// - photos: last commit that touched public/images/vehicles/<id>-*.webp
// - text:   last commit whose diff of src/data/vehicle-copy.ts adds a line for "<id>"
// Needs full git history (deploy-pages.yml: fetch-depth 0). Without git or history the result is
// simply empty and the sitemap falls back to the database dates.
import { execFileSync } from 'node:child_process';

function git(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return '';
  }
}

/** @returns {Record<string, string>} vehicle id -> ISO date of the last text/photo change */
export function contentDates() {
  /** @type {Record<string, string>} */
  const out = {};
  const keep = (id, date) => { if (!out[id] || Date.parse(date) > Date.parse(out[id])) out[id] = date; };

  // photos (newest commits first)
  let date = '';
  for (const line of git(['log', '--format=@@%cI', '--name-only', '--', 'public/images/vehicles']).split('\n')) {
    if (line.startsWith('@@')) { date = line.slice(2); continue; }
    const m = line.match(/public\/images\/vehicles\/(.+?)-(?:640|1280|1920)\.webp$/);
    if (m && date) keep(m[1], date);
  }

  // texts: added lines like `  "dinka-chavos-xs": [...]`
  date = '';
  for (const line of git(['log', '--format=@@%cI', '-p', '--unified=0', '--', 'src/data/vehicle-copy.ts']).split('\n')) {
    if (line.startsWith('@@') && !line.startsWith('@@ ')) { date = line.slice(2); continue; }
    const m = line.match(/^\+\s+"([a-z0-9-]+)":\s*\[/);
    if (m && date) keep(m[1], date);
  }
  return out;
}
