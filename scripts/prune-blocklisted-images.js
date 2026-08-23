#!/usr/bin/env node
// Remove image records whose source_url is on harvest/image-blocklist.yaml,
// and delete their local files. Curation only — no factual fields touched.
// Usage: node scripts/prune-blocklisted-images.js
import { readFileSync, writeFileSync, readdirSync, existsSync, unlinkSync } from 'node:fs';
import { parseDocument } from 'yaml';
import { loadBlocklist } from './harvest/lib/blocklist.js';

const block = loadBlocklist();
if (block.size === 0) { console.log('blocklist empty — nothing to do'); process.exit(0); }

let removed = 0;
for (const f of readdirSync('content').filter((x) => x.endsWith('.yaml'))) {
  const path = `content/${f}`;
  const docNode = parseDocument(readFileSync(path, 'utf8'));
  const images = docNode.get('images')?.toJSON() ?? [];
  const keep = images.filter((im) => !block.has(im.source_url));
  if (keep.length === images.length) continue;
  for (const im of images) {
    if (block.has(im.source_url) && im.file && existsSync(im.file)) {
      unlinkSync(im.file);
    }
  }
  docNode.set('images', keep);
  writeFileSync(path, docNode.toString());
  removed += images.length - keep.length;
  console.log(`${f}: removed ${images.length - keep.length} blocklisted image record(s)`);
}
console.log(`\nprune: removed ${removed} image record(s)`);
