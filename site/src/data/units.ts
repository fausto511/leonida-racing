// Units (DEC-0197, Fausto 30.10.2026): km/h · km or mph · mi, one choice for the whole site.
// Data stays as measured (top speed in mph, track length in km); only the display converts.
// Pages render BOTH values (.u-met / .u-imp); <html data-units> decides which one is visible
// (styles/tokens.css), set before first paint by the inline script in layouts/Base.astro.
// Without JS (crawlers) the imperial value shows, as before.

export type Units = 'metric' | 'imperial';
export const KMH_PER_MPH = 1.609344;
export const MI_PER_KM = 0.621371;
export const UNITS_KEY = 'lr-units';

const num = (n: number, digits: number) => n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const short = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 1 });

/** "212 mph" / "341 km/h"; digits = decimals of the converted value (mph keeps its own format unless mphDigits is given) */
export function speedText(mph: number, units: Units, digits = 0, mphDigits?: number): string {
  return units === 'metric'
    ? `${num(mph * KMH_PER_MPH, digits)} km/h`
    : `${mphDigits == null ? String(mph) : num(mph, mphDigits)} mph`;
}
export function speedHtml(mph: number, digits?: number, mphDigits?: number): string {
  // km/h gets as many decimals as the mph value shows (131.4 mph -> 211.5 km/h, 131 mph -> 211 km/h)
  if (digits == null) digits = mphDigits ?? Math.min(1, (String(mph).split('.')[1] ?? '').length);
  return `<span class="u-met">${speedText(mph, 'metric', digits)}</span><span class="u-imp">${speedText(mph, 'imperial', digits, mphDigits)}</span>`;
}
export function lengthText(km: number, units: Units): string {
  return units === 'metric' ? `${short(km)} km` : `${short(km * MI_PER_KM)} mi`;
}
export function lengthHtml(km: number): string {
  return `<span class="u-met">${lengthText(km, 'metric')}</span><span class="u-imp">${lengthText(km, 'imperial')}</span>`;
}

/** current choice in the browser (client only; falls back to imperial on the server) */
export function currentUnits(): Units {
  if (typeof document === 'undefined') return 'imperial';
  return document.documentElement.dataset.units === 'metric' ? 'metric' : 'imperial';
}

// Time zones of places that post road speeds in mph (checked 30.10.2026 against the
// "Miles per hour" list: USA + territories, UK + Crown dependencies + overseas territories,
// Caribbean and Pacific states). Everything else -> metric. Liberia ("occasionally") stays metric.
// Kept as a string so the inline head script and this module share one list.
export const IMPERIAL_TZ_SRC = '^(America/(New_York|Detroit|Kentucky/.+|Indiana/.+|Chicago|Menominee|North_Dakota/.+|Denver|Boise|Phoenix|Los_Angeles|Anchorage|Juneau|Sitka|Metlakatla|Yakutat|Nome|Adak|Puerto_Rico|St_Thomas|Antigua|Nassau|Belize|Dominica|Grenada|St_Kitts|St_Lucia|St_Vincent|Anguilla|Tortola|Cayman|Montserrat|Grand_Turk|Fort_Wayne|Indianapolis|Louisville|Knox_IN)|US/.+|Pacific/(Honolulu|Johnston|Guam|Saipan|Pago_Pago|Samoa|Midway|Majuro|Kwajalein|Chuuk|Truk|Pohnpei|Ponape|Kosrae|Palau)|Europe/(London|Jersey|Guernsey|Isle_of_Man|Belfast)|GB|GB-Eire|Atlantic/(Stanley|St_Helena)|Indian/Chagos|EST5EDT|CST6CDT|MST7MDT|PST8PDT|HST|Navajo)$';
