// IndexNow (Fausto 14.11.2026): tell Bing, Yandex, Seznam, Naver … about changed pages right after a
// deploy, so new values (prices, top speeds, lap times) are picked up within minutes instead of days.
// Bing also feeds ChatGPT search and Copilot. Google does not use IndexNow (Search Console stays manual).
//
//   node scripts/indexnow.mjs prepare   (after `astro build`, in site/)
//     - fingerprints every page in the sitemap (title, description and <main>; scripts and asset
//       names ignored, so a rebuild without content changes counts as unchanged)
//     - writes dist/indexnow.json (published with the site = the next run's "before")
//     - compares with the live indexnow.json and writes indexnow-changed.txt (one URL per line)
//   node scripts/indexnow.mjs submit    (after the deploy; reads indexnow-changed.txt)
//
// The site rebuilds every 3 hours (schedule); only pages whose content changed are sent, as IndexNow asks.
// Key file: public/<KEY>.txt (IndexNow checks it on our domain to prove ownership).
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const KEY = '29e7fd094d1d36fc9d1fd518f99e9b46';
const SITE = 'https://leonidaracing.com';
const DIST = process.env.INDEXNOW_DIST ?? 'dist';
const MANIFEST = 'indexnow.json';
const CHANGED = 'indexnow-changed.txt';

async function sitemapUrls() {
  const index = await readFile(join(DIST, 'sitemap-index.xml'), 'utf8');
  const maps = [...index.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname.replace(/^\//, ''));
  const urls = [];
  for (const m of maps) {
    const xml = await readFile(join(DIST, m), 'utf8');
    for (const x of xml.matchAll(/<url><loc>([^<]+)<\/loc>/g)) urls.push(x[1]);
  }
  return urls;
}

function fingerprint(html) {
  const pick = (re) => (html.match(re)?.[1] ?? '');
  const content = [
    pick(/<title>([\s\S]*?)<\/title>/),
    pick(/<meta name="description" content="([^"]*)"/),
    pick(/<main[^>]*>([\s\S]*?)<\/main>/)
      .replace(/<script[\s\S]*?<\/script>/g, '')
      .replace(/\/_astro\/[^"' )]+/g, '')
      .replace(/data-astro-cid-[a-z0-9]+/g, '')
      .replace(/\s+/g, ' '),
  ].join('\n');
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

async function prepare() {
  const now = {};
  for (const url of await sitemapUrls()) {
    const path = new URL(url).pathname;
    const file = join(DIST, path.endsWith('/') ? `${path}index.html` : path);
    try { now[url] = fingerprint(await readFile(file, 'utf8')); } catch { /* not a built page */ }
  }
  await writeFile(join(DIST, MANIFEST), JSON.stringify(now));
  let before = null;
  try {
    const res = await fetch(`${SITE}/${MANIFEST}`, { headers: { 'cache-control': 'no-cache' } });
    if (res.ok) before = await res.json();
  } catch { /* first run or site unreachable */ }
  // first run (no manifest online yet): send everything once
  const changed = Object.keys(now).filter((u) => !before || before[u] !== now[u]);
  await writeFile(CHANGED, changed.join('\n'));
  console.log(`IndexNow: ${Object.keys(now).length} pages, ${changed.length} new or changed${before ? '' : ' (no previous manifest: full list)'}`);
}

async function submit() {
  let list = [];
  try { list = (await readFile(CHANGED, 'utf8')).split('\n').filter(Boolean); } catch { /* nothing prepared */ }
  if (!list.length) { console.log('IndexNow: nothing changed'); return; }
  for (let i = 0; i < list.length; i += 10000) {
    const urlList = list.slice(i, i + 10000);
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host: new URL(SITE).host, key: KEY, keyLocation: `${SITE}/${KEY}.txt`, urlList }),
    });
    // 200/202 = accepted; anything else is logged but never fails the deploy
    console.log(`IndexNow: sent ${urlList.length} URLs -> HTTP ${res.status}`);
  }
}

const mode = process.argv[2];
if (mode === 'prepare') await prepare();
else if (mode === 'submit') await submit();
else { console.error('usage: node scripts/indexnow.mjs prepare|submit'); process.exit(1); }
