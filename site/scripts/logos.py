#!/usr/bin/env python3
# Manufacturer logos for the website (Fausto 16.10.2026): ONE file per make,
# <slug>-gta-6-logo.webp, used everywhere (18 px in lists up to 170 px on the
# vehicle page without photo). Canvas 512 px = sharp at 170 px on 3x displays.
# Same rule as Visual/Logos/Car Manufacturers/README.md (logo trimmed, max
# 84.4 % of the canvas, centered, lossless WebP). Run: python3 site/scripts/logos.py
# Sources: unchanged originals listed in web/manifest.json.
import json, sys
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'Visual/Logos/Car Manufacturers'
OUT = ROOT / 'site/public/images/logos'
C, MAXC = 512, 432
manifest = {m['slug']: m for m in json.loads((SRC / 'web/manifest.json').read_text(encoding='utf-8'))}
for f in sorted(OUT.glob('*-gta-6-logo.webp')):
    slug = f.name.replace('-gta-6-logo.webp', '')
    m = manifest.get(slug)
    out = f
    if not m:  # no source (e.g. granforma placeholder): transparent canvas
        Image.new('RGBA', (C, C), (0, 0, 0, 0)).save(out, 'WEBP', lossless=True)
        print(f'{slug}: no source, transparent placeholder'); continue
    im = Image.open(SRC / m['source_file']).convert('RGBA')
    bbox = im.getchannel('A').getbbox()
    if bbox: im = im.crop(bbox)
    s = min(MAXC / im.width, MAXC / im.height)
    im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
    canvas = Image.new('RGBA', (C, C), (0, 0, 0, 0))
    canvas.paste(im, ((C - im.width) // 2, (C - im.height) // 2), im)
    canvas.save(out, 'WEBP', lossless=True, method=6)
    print(f'{slug}: {m["source_file"]} -> {im.width}x{im.height}{"  (UPSCALED)" if s > 1 else ""}  {out.stat().st_size//1024} KB')
