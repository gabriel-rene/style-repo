#!/usr/bin/env node
// Harvest object records from the MoMA collection dataset (CSV on GitHub,
// CC0 metadata). The dataset is downloaded once to cache/moma-artworks.csv.
// MoMA's metadata is CC0 but the IMAGE files themselves are not cleared for
// reuse, so records are rights_status: "restricted" and hotlink ImageURL.
//
// Matching: a term matches if its name (or a query override) appears in the
// artwork Title. This is deliberately conservative — dataset has no
// style/movement tagging.
//
// Per-term query override: harvest/image-queries-moma.yaml (term-id: "query")
// Usage: node scripts/harvest/moma-images.js [termId ...]

import { readFileSync, existsSync } from 'node:fs';
import { parse } from 'yaml';
import { cachedDownload, today } from './lib/cache.js';
import { EntryUpdater } from './lib/apply.js';
import { loadBlocklist } from './lib/blocklist.js';
import { loadContentDir } from '../lib/load.js';

const blocklist = loadBlocklist();
const MAX_PER_TERM = 6;
const CSV_PATH = 'cache/moma-artworks.csv';
const CSV_URL = 'https://media.githubusercontent.com/media/MuseumofModernArt/collection/main/Artworks.csv';
const DATASET_URL = 'https://github.com/MuseumofModernArt/collection';

const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const queries = existsSync('harvest/image-queries-moma.yaml')
  ? parse(readFileSync('harvest/image-queries-moma.yaml', 'utf8')) ?? {}
  : {};

if (!existsSync(CSV_PATH)) {
  console.log('downloading MoMA dataset (~73MB, one-time)…');
  await cachedDownload(CSV_URL, CSV_PATH);
}

// Minimal RFC-4180 CSV parser (fields can contain quoted commas/newlines).
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false;
      } else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

console.log('parsing MoMA CSV…');
const rows = parseCsv(readFileSync(CSV_PATH, 'utf8').replace(/^﻿/, ''));
const header = rows[0];
const col = Object.fromEntries(header.map((h, i) => [h, i]));
const artworks = rows.slice(1);
console.log(`${artworks.length} artworks loaded`);

const { entries, errors } = loadContentDir('content');
if (errors.length) { errors.forEach((e) => console.error(e)); process.exit(1); }

let totalAdded = 0;
for (const { doc } of entries) {
  if (only.length && !only.includes(doc.id)) continue;
  // explicit null in image-queries-moma.yaml = needs a human-curated query; skip
  if (doc.id in queries && queries[doc.id] === null) {
    console.log(`${doc.id}: skipped (query set to null — needs manual curation)`);
    continue;
  }
  const query = (queries[doc.id] ?? doc.names.primary).toLowerCase();

  const existingUrls = new Set((doc.images ?? []).map((i) => i.source_url));
  const picked = [];
  for (const a of artworks) {
    if (picked.length >= MAX_PER_TERM) break;
    const title = a[col.Title] ?? '';
    if (!title.toLowerCase().includes(query)) continue;
    const imageUrl = a[col.ImageURL];
    const pageUrl = a[col.URL];
    if (!imageUrl || !pageUrl) continue; // need a viewable image + object page
    if (existingUrls.has(pageUrl) || blocklist.has(pageUrl)) continue;
    const artist = a[col.Artist] || 'Unknown';
    const date = a[col.Date] || '';
    picked.push({
      file: null, // restricted — hotlink only
      remote_image: imageUrl,
      source_url: pageUrl,
      license: `MoMA collection image — rights not cleared for reuse (metadata CC0: ${DATASET_URL})`,
      attribution: `${artist}, "${title}"${date ? ', ' + date : ''}. The Museum of Modern Art, New York (${a[col.CreditLine] || 'credit line unknown'})`,
      rights_status: 'restricted',
      review_status: 'pending',
      caption: [title, date, a[col.Medium]].filter(Boolean).join('. ').slice(0, 300),
      depicts: null,
    });
  }

  if (!picked.length) { console.log(`${doc.id}: 0 MoMA matches for "${query}"`); continue; }

  const u = new EntryUpdater(`content/${doc.id}.yaml`);
  const prov = { source: 'moma-dataset', url: DATASET_URL, accessed: today(), note: `title contains: ${query}` };
  const merged = [...(doc.images ?? []), ...picked];
  if ((doc.images ?? []).length === 0) {
    u.fill('images', merged, prov);
  } else {
    u.docNode.set('images', merged);
    u.addProvenance('images', prov);
    u.applied.push('images');
  }
  u.save();
  totalAdded += picked.length;
  console.log(`${doc.id}: +${picked.length} MoMA objects (query "${query}")`);
}
console.log(`\nmoma-images: added ${totalAdded} image records`);
