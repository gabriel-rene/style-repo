#!/usr/bin/env node
// List terms whose lifecycle review is due or missing.
//
// A term in a tracked lifecycle state (emerging | peaking | saturated) claims
// to describe a live phenomenon. That claim expires: review_due says when a
// human must re-check it. This script only REPORTS — changing state or dates
// is the user's call, in the term file, with provenance.
//
// Usage: node --no-warnings scripts/trends/review-due.js
// Exit 1 if anything is overdue (so it can gate CI), else 0.

import { loadContentDir } from '../lib/load.js';
import { TRACKED_LIFECYCLE_STATES } from '../lib/schema.js';
import { existsSync } from 'node:fs';

const today = new Date().toISOString().slice(0, 10);
const rows = [];

for (const dir of ['content', 'content/drafts']) {
  if (!existsSync(dir)) continue;
  for (const { file, doc } of loadContentDir(dir).entries) {
    const lc = doc?.facets?.lifecycle;
    if (!lc || !TRACKED_LIFECYCLE_STATES.includes(lc.state)) continue;
    const where = dir === 'content' ? file : `drafts/${file}`;
    if (!lc.review_due) {
      rows.push({ where, id: doc.id, state: lc.state, due: null, flag: 'NO DATE' });
    } else if (lc.review_due <= today) {
      rows.push({ where, id: doc.id, state: lc.state, due: lc.review_due, flag: 'OVERDUE' });
    } else {
      rows.push({ where, id: doc.id, state: lc.state, due: lc.review_due, flag: 'ok' });
    }
  }
}

if (!rows.length) {
  console.log('review-due: no terms in tracked lifecycle states (emerging/peaking/saturated)');
  process.exit(0);
}

rows.sort((a, b) => String(a.due ?? '') < String(b.due ?? '') ? -1 : 1);
for (const r of rows) {
  console.log(`${r.flag.padEnd(8)} ${r.id.padEnd(28)} state=${r.state.padEnd(10)} review_due=${r.due ?? '—'}  (${r.where})`);
}
const bad = rows.filter((r) => r.flag !== 'ok');
console.log(`\nreview-due: ${rows.length} tracked term(s), ${bad.length} need attention`);
process.exit(bad.length ? 1 : 0);
