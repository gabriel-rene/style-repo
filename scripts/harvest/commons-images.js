#!/usr/bin/env node
// Harvest openly licensed images from Wikimedia Commons.
// Only licenses on the allowlist are accepted; everything else is skipped.
// Downloads an 800px thumb to assets/<term>/ and appends a fully-populated
// image record (source_url, license, attribution, rights_status) to the entry.
// Existing image records are never touched; re-runs only add new files.
//
// Per-term query override: harvest/image-queries.yaml  (term-id: "query string")
// Usage: node scripts/harvest/commons-images.js [--refresh] [termId ...]

import { readFileSync, existsSync } from 'node:fs';
import { parse } from 'yaml';
import { cachedJson, cachedDownload } from './lib/cache.js';
import { EntryUpdater } from './lib/apply.js';
import { loadContentDir } from '../lib/load.js';

const MAX_PER_TERM = 6;
// Machine-readable license ids Commons uses (extmetadata.License).
const OPEN_LICENSES = /^(pd|cc0|cc-by(-sa)?-[0-9.]+([a-z-]*)?)$/i;

const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const queries = existsSync('harvest/image-queries.yaml')
  ? parse(readFileSync('harvest/image-queries.yaml', 'utf8')) ?? {}
  : {};

const { entries, errors } = loadContentDir('content');
if (errors.length) { errors.forEach((e) => console.error(e)); process.exit(1); }

const strip = (html) => (html ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

let totalAdded = 0;
for (const { doc } of entries) {
  if (only.length && !only.includes(doc.id)) continue;
  // explicit null in image-queries.yaml = term needs a human-curated query; skip
  if (doc.id in queries && queries[doc.id] === null) {
    console.log(`${doc.id}: skipped (query set to null — needs manual curation)`);
    continue;
  }
  const query = queries[doc.id] ?? `${doc.names.primary} graphic design`;
  const url = 'https://commons.wikimedia.org/w/api.php?action=query&format=json'
    + '&generator=search&gsrnamespace=6&gsrlimit=20'
    + '&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=800'
    + '&gsrsearch=' + encodeURIComponent(query);

  let data, fetched;
  try { ({ data, fetched } = await cachedJson(url, { label: `commons:${doc.id}` })); }
  catch (e) { console.error(`WARN ${doc.id}: commons search failed — ${e.message}`); continue; }

  const pages = Object.values(data.query?.pages ?? {});
  const existingUrls = new Set((doc.images ?? []).map((i) => i.source_url));
  const picked = [];

  for (const p of pages) {
    if (picked.length >= MAX_PER_TERM) break;
    const ii = p.imageinfo?.[0];
    const em = ii?.extmetadata ?? {};
    const licenseId = em.License?.value ?? '';
    if (!OPEN_LICENSES.test(licenseId)) continue;          // open licenses only
    if (!/\.(jpe?g|png|gif|webp)$/i.test(p.title)) continue; // raster only for now
    // Relevance guard: title or description must mention a distinctive word
    // from the term name or query, otherwise full-text search drags in files
    // that merely mention "design".
    const hay = (p.title + ' ' + (em.ImageDescription?.value ?? '')).toLowerCase();
    const GENERIC = new Set(['graphic', 'graphics', 'design', 'designs', 'print', 'prints', 'poster', 'posters', 'typography', 'style', 'styles', 'international', 'web']);
    const words = `${doc.names.primary} ${query}`.toLowerCase().split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 4 && !GENERIC.has(w));
    if (words.length && !words.some((w) => hay.includes(w))) continue;
    const descUrl = ii.descriptionurl ?? ii.url;
    if (existingUrls.has(descUrl)) continue;

    const licenseName = strip(em.LicenseShortName?.value) || licenseId;
    const artist = strip(em.Artist?.value);
    const attribution = em.Attribution?.value
      ? strip(em.Attribution.value)
      : `${artist || 'Unknown author'}, ${licenseName}, via Wikimedia Commons`;

    const safe = p.title.replace(/^File:/, '').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80);
    const localPath = `assets/${doc.id}/${safe}`;
    try {
      // strip utm_* query params the API appends; they add nothing
      await cachedDownload((ii.thumburl ?? ii.url).split('?')[0], localPath);
    } catch (e) {
      console.error(`WARN ${doc.id}: download failed for ${p.title} — ${e.message}`);
      continue;
    }
    picked.push({
      file: localPath,
      source_url: descUrl,
      license: licenseName,
      attribution,
      rights_status: 'open',
      caption: strip(em.ImageDescription?.value).slice(0, 300) || null,
      depicts: null,
    });
  }

  if (!picked.length) { console.log(`${doc.id}: 0 open-licensed images for "${query}"`); continue; }

  const u = new EntryUpdater(`content/${doc.id}.yaml`);
  const prov = {
    source: 'wikimedia-commons',
    url: 'https://commons.wikimedia.org/w/index.php?search=' + encodeURIComponent(query),
    accessed: fetched, note: `query: ${query}`,
  };
  const merged = [...(doc.images ?? []), ...picked];
  // fill() refuses non-empty targets, so set images directly but still fill-only per URL
  if ((doc.images ?? []).length === 0) {
    u.fill('images', merged, prov);
  } else {
    u.docNode.set('images', merged);
    u.addProvenance('images', prov);
    u.applied.push('images');
  }
  u.save();
  totalAdded += picked.length;
  console.log(`${doc.id}: +${picked.length} images (query "${query}")`);
}
console.log(`\ncommons-images: added ${totalAdded} image records`);
