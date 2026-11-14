// Share images (og:image) for the Cars area, rendered at build time with sharp (Fausto 14.11.2026:
// no more empty-garage picture when a car link is shared). 1200x630 JPEG, works in Discord,
// WhatsApp, X, Facebook and iMessage (WebP is not shown everywhere).
//   photo card : the car's garage photo, cropped, with a small Leonida Racing mark
//   text card  : dark brand background, optional manufacturer logo, kicker + title
//   hero card  : one car photo with a title (Cars, Compare and other Cars pages without their own)
// Fonts: the site's own Archivo / Instrument Sans (woff2 via fontfile), so no system font is needed.
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const W = 1200, H = 630;
const PUB = join(process.cwd(), 'public');
const FONT_DISPLAY = join(process.cwd(), 'src/assets/fonts/archivo-wdth112-latin.woff2');
const FONT_BODY = join(process.cwd(), 'src/assets/fonts/instrument-sans-latin.woff2');
const BG = '#0B0B14', TEXT = '#FBF7EA', ORANGE = '#FF955A', MUTED = '#9C9CAB';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Text as a transparent PNG (Pango markup), wrapped at `width`. */
async function text(markup: string, opts: { font: string; file: string; width: number; align?: 'left' | 'centre'; spacing?: number }) {
  const { data, info } = await sharp({ text: { text: markup, font: opts.font, fontfile: opts.file, width: opts.width, rgba: true, align: opts.align ?? 'left', spacing: opts.spacing ?? 0, wrap: 'word' } })
    .png().toBuffer({ resolveWithObject: true });
  return { input: data, w: info.width, h: info.height };
}

/** Single-colour SVG logo recoloured (logos are black on transparent). */
async function logo(slug: string, size: number, colour: string) {
  try {
    const svg = await readFile(join(PUB, 'images/logos', `${slug}-gta-6-logo.svg`));
    const shape = await sharp(svg, { density: 300 }).resize(size, size, { fit: 'inside' }).ensureAlpha().png().toBuffer({ resolveWithObject: true });
    const tint = await sharp({ create: { width: shape.info.width, height: shape.info.height, channels: 4, background: colour } }).png().toBuffer();
    const data = await sharp(shape.data).composite([{ input: tint, blend: 'in' }]).png().toBuffer();
    return { input: data, w: shape.info.width, h: shape.info.height };
  } catch { return null; }
}

async function brandMark(height = 46) {
  const data = await sharp(join(PUB, 'images/brand/lr-logo-white.png')).resize({ height }).png().toBuffer({ resolveWithObject: true });
  return { input: data.data, w: data.info.width, h: data.info.height };
}

const backdrop = () => sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <radialGradient id="g" cx="88%" cy="8%" r="75%"><stop offset="0" stop-color="${ORANGE}" stop-opacity=".30"/><stop offset="1" stop-color="${ORANGE}" stop-opacity="0"/></radialGradient>
    <linearGradient id="v" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#141422"/><stop offset="1" stop-color="${BG}"/></linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#v)"/><rect width="100%" height="100%" fill="url(#g)"/>
  <rect x="0" y="${H - 10}" width="${W}" height="10" fill="${ORANGE}"/>
</svg>`));

const fade = (from = 0.15) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs><linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="${from}" stop-color="${BG}" stop-opacity="0"/><stop offset="1" stop-color="${BG}" stop-opacity=".92"/></linearGradient></defs>
  <rect width="100%" height="100%" fill="url(#f)"/></svg>`);

const jpeg = (img: sharp.Sharp) => img.jpeg({ quality: 82, mozjpeg: true }).toBuffer();

/** Car photo, cropped to 1200x630, small brand mark bottom left. */
export async function photoCard(vehicleId: string) {
  const photo = await sharp(join(PUB, 'images/vehicles', `${vehicleId}-1920.webp`)).resize(W, H, { fit: 'cover', position: 'centre' }).toBuffer();
  const mark = await brandMark(40);
  const low = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset=".72" stop-color="${BG}" stop-opacity="0"/><stop offset="1" stop-color="${BG}" stop-opacity=".75"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#f)"/></svg>`);
  return jpeg(sharp(photo).composite([{ input: low }, { input: mark.input, left: 40, top: H - mark.h - 30 }]));
}

/** Brand card: optional logo, kicker (orange caps), title (big), sub line; block centred vertically. */
export async function textCard(o: { title: string; kicker: string; sub?: string; logoSlug?: string }) {
  const layers: sharp.OverlayOptions[] = [];
  const x = 80;
  const title = o.title.replace(/GTA 6/g, 'GTA 6');
  if (o.logoSlug) {
    const wm = await logo(o.logoSlug, H - 150, TEXT); // stays clear of the domain line
    if (wm) {
      const faint = await sharp(wm.input).composite([{ input: { create: { width: wm.w, height: wm.h, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0.06 } } }, blend: 'dest-in' }]).png().toBuffer();
      layers.push({ input: faint, left: W - wm.w - 40, top: Math.round((H - 110 - wm.h) / 2) + 10 });
    }
  }
  const lg = o.logoSlug ? await logo(o.logoSlug, 140, TEXT) : null;
  const k = await text(`<span foreground="${ORANGE}" font_weight="700" letter_spacing="4000">${esc(o.kicker.toUpperCase())}</span>`, { font: 'Instrument Sans 28', file: FONT_BODY, width: W - 2 * x });
  const s = o.sub ? await text(`<span foreground="${MUTED}">${esc(o.sub)}</span>`, { font: 'Instrument Sans 30', file: FONT_BODY, width: W - 2 * x }) : null;
  const gap1 = 34, gap2 = 16, gap3 = 22;
  const room = H - 130 - 50; // between the top margin and the brand mark
  // biggest title size that keeps the whole block clear of the brand mark (one line preferred)
  let t = { input: Buffer.alloc(0), w: 0, h: 0 };
  let block = 0;
  for (const size of [112, 92, 76, 64]) {
    t = await text(`<span foreground="${TEXT}" font_weight="800">${esc(title)}</span>`, { font: `Archivo ${size}`, file: FONT_DISPLAY, width: W - 2 * x - 60, spacing: -6 });
    block = (lg ? lg.h + gap1 : 0) + k.h + gap2 + t.h + (s ? gap3 + s.h : 0);
    if (t.h < size * 1.5 && block <= room) break;
  }
  let y = Math.max(50, Math.round(40 + (H - 130 - 40 - block) / 2));
  if (lg) { layers.push({ input: lg.input, left: x, top: y }); y += lg.h + gap1; }
  layers.push({ input: k.input, left: x, top: y }); y += k.h + gap2;
  layers.push({ input: t.input, left: x, top: y }); y += t.h + gap3;
  if (s) layers.push({ input: s.input, left: x, top: y });
  const mark = await brandMark(44);
  layers.push({ input: mark.input, left: x, top: H - mark.h - 44 });
  const dom = await text(`<span foreground="${MUTED}">leonidaracing.com</span>`, { font: 'Instrument Sans 24', file: FONT_BODY, width: 400 });
  layers.push({ input: dom.input, left: W - dom.w - x, top: H - dom.h - 50 });
  return jpeg(backdrop().composite(layers));
}

/** One car photo as background, darkened towards the bottom, kicker + title over it. */
export async function heroCard(o: { title: string; kicker: string; vehicleId: string }) {
  const photo = await sharp(join(PUB, 'images/vehicles', `${o.vehicleId}-1920.webp`)).resize(W, H, { fit: 'cover', position: 'centre' }).toBuffer();
  const x = 80;
  const t = await text(`<span foreground="${TEXT}" font_weight="800">${esc(o.title.replace(/GTA 6/g, 'GTA 6'))}</span>`, { font: 'Archivo 104', file: FONT_DISPLAY, width: W - 2 * x, spacing: -6 });
  const k = await text(`<span foreground="${ORANGE}" font_weight="700" letter_spacing="4000">${esc(o.kicker.toUpperCase())}</span>`, { font: 'Instrument Sans 28', file: FONT_BODY, width: W - 2 * x });
  const mark = await brandMark(44);
  const tTop = H - 44 - mark.h - 34 - t.h;
  return jpeg(sharp(photo).composite([{ input: fade(0.2) }, { input: k.input, left: x, top: tTop - k.h - 12 }, { input: t.input, left: x, top: tTop }, { input: mark.input, left: x, top: H - mark.h - 44 }]));
}
