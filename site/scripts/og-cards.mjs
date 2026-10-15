#!/usr/bin/env node
// Share/preview cards for vehicles without a photo (Fausto, 2026-10-15).
// Google and Discord show og:image next to a result; a generic garage photo
// says nothing, so every vehicle without its own photo gets a 1200x630 card:
// make logo + make, model name, class · drive · seats, LR mark on the
// pink-orange band. Runs in CI after fetch-vehicles.mjs (and locally), reads
// src/data/vehicles.generated.json, writes public/images/og/cars/<id>.jpg.
// Vehicles with a photo keep using the photo (see cars/vehicles/[id]).
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import satori from 'satori';
import sharp from 'sharp';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public/images/og/cars');
const W = 1200, H = 630;
const C = { bg: '#0B0B14', text: '#FBF7EA', muted: '#B4B4C2', orange: '#FF955A', pink: '#F24B9D', orange2: '#FF7A3D' };

const font = (f) => readFile(path.join(ROOT, 'scripts/og/fonts', f));
const fonts = [
  { name: 'Archivo', data: await font('archivo-800.ttf'), weight: 800, style: 'normal' },
  { name: 'Archivo', data: await font('archivo-700.ttf'), weight: 700, style: 'normal' },
  { name: 'Instrument', data: await font('instrument-600.ttf'), weight: 600, style: 'normal' },
  { name: 'Instrument', data: await font('instrument-500.ttf'), weight: 500, style: 'normal' },
];
const dataUri = (buf) => `data:image/png;base64,${buf.toString('base64')}`;
const mark = dataUri(await readFile(path.join(ROOT, 'scripts/og/lr-mark-white.png')));

// Manufacturer logo as a white silhouette (logos are dark on transparent).
const logoCache = new Map();
async function whiteLogo(slug) {
  if (logoCache.has(slug)) return logoCache.get(slug);
  let uri = null;
  try {
    const src = sharp(path.join(ROOT, `public/images/logos/${slug}-gta-6-logo.webp`)).resize(88, 88, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).ensureAlpha();
    const alpha = await src.clone().extractChannel('alpha').toBuffer();
    const png = await sharp({ create: { width: 88, height: 88, channels: 3, background: '#ffffff' } }).joinChannel(alpha).png().toBuffer();
    uri = dataUri(png);
  } catch { /* missing logo: card without logo */ }
  logoCache.set(slug, uri);
  return uri;
}

// Model name: largest size that fits in two lines of the text column.
function modelSize(name) {
  const n = name.length;
  if (n <= 9) return 112;
  if (n <= 13) return 96;
  if (n <= 18) return 84;
  if (n <= 24) return 72;
  return 62;
}

const h = (type, style, children) => ({ type, props: { style, children } });
const img = (src, w, hgt, style = {}) => ({ type: 'img', props: { src, width: w, height: hgt, style } });

async function card(v) {
  const logo = await whiteLogo(v.manufacturer_logo_slug);
  const meta = [v.classes.join(' / '), v.drive && v.drive !== 'n/a' ? v.drive : null, v.seats ? `${v.seats} seats` : null].filter(Boolean).join(' · ');
  const size = modelSize(v.model);
  const tree = h('div', { width: W, height: H, display: 'flex', position: 'relative', backgroundColor: C.bg, fontFamily: 'Archivo' }, [
    // pink-orange band with the LR mark
    h('div', { position: 'absolute', top: 0, left: 0, width: W, height: H, display: 'flex',
      backgroundImage: `linear-gradient(120deg, ${C.pink}, ${C.orange2})`,
      clipPath: `polygon(${W * 0.70}px 0, ${W}px 0, ${W}px ${H}px, ${W * 0.58}px ${H}px)` }, []),
    img(mark, 330, 101, { position: 'absolute', left: W * 0.79 - 165 + 40, top: (H - 101) / 2 }),
    // text column
    h('div', { position: 'absolute', left: 72, top: 0, width: 600, height: H, display: 'flex', flexDirection: 'column', justifyContent: 'center' }, [
      h('div', { display: 'flex', alignItems: 'center', marginBottom: 14 }, [
        ...(logo ? [img(logo, 44, 44, { marginRight: 16 })] : []),
        h('div', { display: 'flex', fontSize: 32, fontWeight: 700, color: C.muted, letterSpacing: 1 }, v.make.toUpperCase()),
      ]),
      h('div', { display: 'flex', fontSize: size, fontWeight: 800, color: C.text, lineHeight: 1.02, maxWidth: 580 }, v.model.toUpperCase()),
      h('div', { display: 'flex', fontFamily: 'Instrument', fontSize: 32, fontWeight: 600, color: C.orange, marginTop: 18 }, meta),
    ]),
    h('div', { position: 'absolute', left: 72, bottom: 38, display: 'flex', fontFamily: 'Instrument', fontSize: 24, fontWeight: 500, color: C.muted }, 'GTA VI CAR DATABASE  ·  leonidaracing.com'),
  ]);
  const svg = await satori(tree, { width: W, height: H, fonts });
  return sharp(Buffer.from(svg)).jpeg({ quality: 86, mozjpeg: true }).toBuffer();
}

const data = JSON.parse(await readFile(path.join(ROOT, 'src/data/vehicles.generated.json'), 'utf8'));
await mkdir(OUT, { recursive: true });
let n = 0;
for (const v of data.vehicles) {
  if (v.has_photo) continue;
  await writeFile(path.join(OUT, `${v.vehicle_id}.jpg`), await card(v));
  n++;
}
console.log(`og-cards: ${n} vehicle cards written to public/images/og/cars/`);
