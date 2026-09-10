#!/usr/bin/env node
// Build the static "reads like" index → site/src/data/embeddings.json.
//
// Offline by design: vectors are hashed TF-IDF over each term's own on-file
// text (names, summary, facet values, image captions). No API, no key, fully
// deterministic, rebuilt on every content change. If a real embedding model
// is wanted later, only this script changes — the JSON contract stays.
//
// Usage: node site/scripts/build-embeddings.js

import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { parse } from 'yaml';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DIM = 256;

function textOf(t) {
  const parts = [];
  const walk = (v) => {
    if (typeof v === 'string') parts.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  parts.push(t.id, t.term_type, ...(t.secondary_types ?? []));
  walk(t.names);
  if (t.summary) parts.push(t.summary);
  walk(t.facets);
  walk(t.guide);
  for (const img of t.images ?? []) if (img.review_status === 'approved' && img.caption) parts.push(img.caption);
  return parts.join(' ').toLowerCase();
}

const tokenize = (s) => s.match(/[a-z][a-z0-9-]{2,}/g) ?? [];
const bucket = (tok) => createHash('sha1').update(tok).digest().readUInt16BE(0) % DIM;

const terms = [];
for (const f of readdirSync(join(REPO, 'content')).filter((f) => f.endsWith('.yaml')).sort()) {
  const doc = parse(readFileSync(join(REPO, 'content', f), 'utf8'));
  if (doc?.id) terms.push(doc);
}

// document frequency per token, for idf weighting
const df = new Map();
const docs = terms.map((t) => {
  const toks = tokenize(textOf(t));
  for (const tok of new Set(toks)) df.set(tok, (df.get(tok) ?? 0) + 1);
  return { id: t.id, toks };
});

const N = docs.length;
const vectors = {};
for (const { id, toks } of docs) {
  const v = new Array(DIM).fill(0);
  const tf = new Map();
  for (const tok of toks) tf.set(tok, (tf.get(tok) ?? 0) + 1);
  for (const [tok, n] of tf) {
    const idf = Math.log(1 + N / df.get(tok));
    v[bucket(tok)] += (n / toks.length) * idf;
  }
  vectors[id] = v.map((x) => Math.round(x * 1e4) / 1e4);
}

const out = join(REPO, 'site/src/data/embeddings.json');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ method: 'hashed-tfidf-v1', dim: DIM, vectors }));
console.log(`embeddings: ${N} terms, dim ${DIM} → ${out}`);
