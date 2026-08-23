#!/usr/bin/env node
// Harvest object imagery from the V&A collections API (api.vam.ac.uk/v2).
// V&A images are viewable but NOT openly licensed — they sit under the V&A's
// own non-commercial terms. Every record is therefore rights_status:
// "restricted" with the terms URL as the license. Nothing is downloaded;
// we record the IIIF thumbnail URL so the UI can hotlink per V&A guidance.
//
// Per-term query override: harvest/image-queries-vam.yaml (term-id: "query")
// Usage: node scripts/harvest/vam-images.js [--refresh] [termId ...]

import { readFileSync, existsSync } from 'node:fs';
import { parse } from 'yaml';
import { cachedJson } from './lib/cache.js';
import { EntryUpdater } from './lib/apply.js';
import { loadBlocklist } from './lib/blocklist.js';
import { loadContentDir } from '../lib/load.js';

const blocklist = loadBlocklist();

const MAX_PER_TERM = 6;
const VAM_TERMS_URL = 'https://www.vam.ac.uk/info/va-websites-terms-conditions';

const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const queries = existsSync('harvest/image-queries-vam.yaml')
  ? parse(readFileSync('harvest/image-queries-vam.yaml', 'utf8')) ?? {}
  : {};

const { entries, errors } = loadContentDir('content');
if (errors.length) { errors.forEach((e) => console.error(e)); process.exit(1); }

let totalAdded = 0;
for (const { doc } of entries) {
  if (only.length && !only.includes(doc.id)) continue;
  // explicit null in image-queries-vam.yaml = needs a human-curated query; skip
  if (doc.id in queries && queries[doc.id] === null) {
    console.log(`${doc.id}: skipped (query set to null — needs manual curation)`);
    continue;
  }
  const query = queries[doc.id] ?? doc.names.primary;
  const url = 'https://api.vam.ac.uk/v2/objects/search?images_exist=1&page_size=20&q='
    + encodeURIComponent(query);

  let data, fetched;
  try { ({ data, fetched } = await cachedJson(url, { label: `vam:${doc.id}` })); }
  catch (e) { console.error(`WARN ${doc.id}: V&A search failed — ${e.message}`); continue; }

  const existingUrls = new Set((doc.images ?? []).map((i) => i.source_url));
  const picked = [];
  for (const r of data.records ?? []) {
    if (picked.length >= MAX_PER_TERM) break;
    const imgBase = r._images?._iiif_image_base_url;
    if (!imgBase) continue;
    const objectUrl = `https://collections.vam.ac.uk/item/${r.systemNumber}`;
    if (existingUrls.has(objectUrl) || blocklist.has(objectUrl)) continue;
    const maker = r._primaryMaker?.name;
    const title = r._primaryTitle || r.objectType || 'Untitled object';
    picked.push({
      file: null, // not downloaded — restricted; hotlink IIIF per V&A terms
      remote_image: `${imgBase}full/!800,800/0/default.jpg`,
      source_url: objectUrl,
      license: `V&A non-commercial terms (${VAM_TERMS_URL})`,
      attribution: `${maker ? maker + ', ' : ''}"${title}"${r._primaryDate ? ', ' + r._primaryDate : ''}. © Victoria and Albert Museum, London`,
      rights_status: 'restricted',
      caption: [title, r._primaryDate, r._primaryPlace].filter(Boolean).join(', '),
      depicts: null,
    });
  }

  if (!picked.length) { console.log(`${doc.id}: 0 V&A objects for "${query}"`); continue; }

  const u = new EntryUpdater(`content/${doc.id}.yaml`);
  const prov = { source: 'vam', url, accessed: fetched, note: `query: ${query}` };
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
  console.log(`${doc.id}: +${picked.length} V&A objects (query "${query}", ${data.info.record_count} total hits)`);
}
console.log(`\nvam-images: added ${totalAdded} image records`);
