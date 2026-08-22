#!/usr/bin/env node
// Reconcile content terms against Getty AAT and Wikidata.
// Matching an external id IS a factual claim, so:
//   - exact case-insensitive label match  -> auto-accepted (method recorded)
//   - anything else                       -> candidate, accept: null, user decides
// Output: harvest/mappings.yaml (git-tracked). Harvesters only use accepted ids.
//
// Usage: node scripts/harvest/reconcile.js [--refresh]

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { parse, stringify } from 'yaml';
import { loadContentDir } from '../lib/load.js';
import { cachedJson, today } from './lib/cache.js';

const MAPPINGS_PATH = 'harvest/mappings.yaml';

const { entries, errors } = loadContentDir('content');
if (errors.length) { errors.forEach((e) => console.error(e)); process.exit(1); }

const existing = existsSync(MAPPINGS_PATH)
  ? parse(readFileSync(MAPPINGS_PATH, 'utf8')) ?? {}
  : {};

const norm = (s) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').trim();

async function searchAat(name) {
  // luc:term is Getty's full-text index; quoted phrase keeps multiword names intact.
  const q = `
    SELECT ?s ?lab WHERE {
      ?s a skos:Concept ; luc:term "${name.replace(/"/g, '')}" ;
         skos:inScheme aat: ; gvp:prefLabelGVP/xl:literalForm ?lab .
      FILTER (lang(?lab) = "en" || lang(?lab) = "")
    } LIMIT 8`;
  const url = 'https://vocab.getty.edu/sparql.json?query=' + encodeURIComponent(q);
  const { data } = await cachedJson(url, { label: `aat-search:${name}` });
  return data.results.bindings.map((b) => ({
    id: b.s.value.replace('http://vocab.getty.edu/aat/', 'aat:'),
    url: b.s.value,
    label: b.lab.value,
  }));
}

async function searchWikidata(name) {
  const url = 'https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json'
    + '&language=en&type=item&limit=8&search=' + encodeURIComponent(name);
  const { data } = await cachedJson(url, { label: `wd-search:${name}` });
  return (data.search ?? []).map((r) => ({
    id: r.id,
    url: `https://www.wikidata.org/wiki/${r.id}`,
    label: r.label ?? '',
    description: r.description ?? '',
  }));
}

function pick(name, candidates) {
  const exact = candidates.filter((c) => norm(c.label) === norm(name));
  if (exact.length === 1) {
    return { accept: exact[0].id, method: 'exact-label-match', candidates };
  }
  return { accept: null, method: exact.length > 1 ? 'ambiguous-exact' : 'no-exact-match', candidates };
}

const out = {};
for (const { doc } of entries) {
  const name = doc.names?.primary;
  const prev = existing[doc.id] ?? {};
  const row = { name, checked: today() };

  for (const [key, searcher] of [['getty_aat', searchAat], ['wikidata', searchWikidata]]) {
    // Never overwrite a user decision (accept set by hand, or previously accepted).
    if (prev[key]?.accept !== undefined && prev[key]?.accept !== null) {
      row[key] = prev[key];
      continue;
    }
    try {
      const candidates = await searcher(name);
      row[key] = pick(name, candidates);
    } catch (e) {
      row[key] = { accept: null, method: 'search-error', error: e.message, candidates: [] };
      console.error(`WARN ${doc.id}/${key}: ${e.message}`);
    }
  }
  out[doc.id] = row;
  const a = row.getty_aat, w = row.wikidata;
  console.log(`${doc.id}: aat=${a.accept ?? `? (${a.candidates.length} cand.)`}  wd=${w.accept ?? `? (${w.candidates.length} cand.)`}`);
}

mkdirSync('harvest', { recursive: true });
writeFileSync(MAPPINGS_PATH, stringify(out));
console.log(`\nreconcile: wrote ${MAPPINGS_PATH} — review entries with accept: null`);
