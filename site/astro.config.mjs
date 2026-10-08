// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { vehicleOptions } from './src/data/vehicles.ts';
import { dataNoindexPaths } from './src/data/rankings.ts';

// noindex pages that must stay out of the sitemap (RS-0050): vehicles without
// an official release (leak-only) and the submit form until launch day.
const noindexVehiclePaths = vehicleOptions.filter((v) => !v.releaseId).map((v) => `/garage/vehicles/${v.id}/`);
// Rankings, New cars and family pages stay out until enough data/copy exists (Fausto 2026-10-08).
const noindexDataPaths = dataNoindexPaths();

// Eigene Domain leonidaracing.com (DEC-0081, angebunden 2026-09-27): Seite
// liegt auf der Root, daher kein `base` mehr. Vorher: GitHub-Pages-
// Projektseite unter https://fausto511.github.io/gellhorn-racing/ mit
// base '/gellhorn-racing'. robots.txt, llms.txt, canonical und og:url folgen
// `site` automatisch.
const base = '/';

export default defineConfig({
  site: 'https://leonidaracing.com',
  base,
  output: 'static',
  trailingSlash: 'always',
  build: {
    format: 'directory',
    // Inline all CSS into each page: no render-blocking stylesheet requests
    // (PageSpeed, 2026-10-03). GitHub Pages only caches for 10 min anyway.
    inlineStylesheets: 'always',
  },
  integrations: [
    sitemap({
      // /account/ and /moderator/ are private/internal, not content for
      // search -- excluded from the sitemap and separately set to
      // noindex on the page itself (see Base.astro).
      // /hub/ stays out while it only shows sample data (noindex, RS-0022).
      // Forwarding pages (/time-attack/, /tracks/…, the old /garage/vehicles/vapid-caracara/)
      // are not content either.
      filter: (page) =>
        !page.includes('/account/') && !page.includes('/moderator/') && !page.includes('/hub/') &&
        !page.endsWith('/time-attack/') && !page.includes('/tracks/') && !page.includes('/report/') && !page.includes('/report-content/') && !page.endsWith('.txt') &&
        !page.endsWith('/garage/vehicles/vapid-caracara/') && !page.endsWith('/garage/vehicles/buckingham-jubilee/') && !page.endsWith('/garage/vehicles/karin-contender/') && !page.endsWith('/time-attack/submit/') &&
        !noindexVehiclePaths.some((p) => page.endsWith(p)) && !noindexDataPaths.some((p) => page.endsWith(p)),
    }),
  ],
  // Forwarding URLs (/time-attack/ and the old /tracks/gellhorn-international-raceway/)
  // are real pages now (src/components/RedirectPage.astro) instead of
  // Astro's `redirects`, whose generated page flashed white (2026-09-26).
});
