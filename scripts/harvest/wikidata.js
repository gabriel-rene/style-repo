#!/usr/bin/env node
// Harvest Wikidata for every term with an ACCEPTED wikidata QID in
// harvest/mappings.yaml.
// Fills (only if empty): external_ids.wikidata, era.periods (inception/dissolved),
// geography.origin_places (country-of-origin QIDs with labels), practitioners
// (people whose "movement" property points at the term, capped).
// Cross-term relations (influenced-by etc.) go to harvest/wd-relations.yaml as a
// report — they reference QIDs, and mapping QID->our term id is a user decision
// unless both ends are already accepted mappings (then applied automatically).
//
// Usage: node scripts/harvest/wikidata.js [--refresh]

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { parse, stringify } from 'yaml';
import { cachedJson } from './lib/cache.js';
import { EntryUpdater } from './lib/apply.js';

const SOURCE = 'wikidata';
const PRACTITIONER_CAP = 25;
const mappings = parse(readFileSync('harvest/mappings.yaml', 'utf8'));

// QID -> our term id for relation resolution
const qidToTerm = new Map();
for (const [termId, m] of Object.entries(mappings)) {
  if (m.wikidata?.accept) qidToTerm.set(m.wikidata.accept, termId);
}

async function sparql(query, label) {
  const url = 'https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(query);
  const { data, fetched } = await cachedJson(url, { label });
  return { rows: data.results.bindings, fetched };
}

const year = (iso) => {
  const m = /^([+-]?\d{1,6})-/.exec(iso ?? '');
  return m ? parseInt(m[1], 10) : null;
};
const qid = (uri) => uri?.replace('http://www.wikidata.org/entity/', '');

const relationReport = {};
let touched = 0;

for (const [termId, m] of Object.entries(mappings)) {
  const q = m.wikidata?.accept;
  if (!q) continue;
  const pageUrl = `https://www.wikidata.org/wiki/${q}`;

  const { rows, fetched } = await sparql(`
    SELECT ?inception ?dissolved ?originCountry ?originCountryLabel
           ?influencedBy ?influencedByLabel ?follows ?followsLabel WHERE {
      OPTIONAL { wd:${q} wdt:P571 ?inception }
      OPTIONAL { wd:${q} wdt:P576 ?dissolved }
      OPTIONAL { wd:${q} wdt:P495 ?originCountry }
      OPTIONAL { wd:${q} wdt:P737 ?influencedBy }
      OPTIONAL { wd:${q} wdt:P155 ?follows }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    }`, `wd-facts:${termId}`);

  const { rows: practRows } = await sparql(`
    SELECT DISTINCT ?p ?pLabel WHERE {
      ?p wdt:P135 wd:${q} ; wdt:P31 wd:Q5 .
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    } LIMIT ${PRACTITIONER_CAP + 1}`, `wd-practitioners:${termId}`);

  const u = new EntryUpdater(`content/${termId}.yaml`);
  const prov = { source: SOURCE, url: pageUrl, accessed: fetched };

  u.fill('external_ids.wikidata', q, { ...prov, method: m.wikidata.method });

  const first = rows[0] ?? {};
  const startY = year(first.inception?.value);
  const endY = year(first.dissolved?.value);
  if (startY !== null) {
    u.fill('facets.era.periods', [{
      label: 'Wikidata inception' + (endY !== null ? '–dissolution' : ''),
      role: 'origin', start_year: startY, end_year: endY,
    }], { ...prov, property: endY !== null ? 'P571,P576' : 'P571' });
  }

  const places = [...new Map(rows.filter((r) => r.originCountry).map((r) => [
    qid(r.originCountry.value),
    { wikidata: qid(r.originCountry.value), label: r.originCountryLabel?.value ?? '' },
  ])).values()];
  if (places.length) {
    u.fill('facets.geography.origin_places', places, { ...prov, property: 'P495' });
  }

  const people = practRows.slice(0, PRACTITIONER_CAP).map((r) => ({
    name: r.pLabel?.value ?? qid(r.p.value),
    wikidata: qid(r.p.value),
  }));
  if (people.length) {
    u.fill('facets.practitioners.people', people, {
      ...prov, property: 'P135 (reverse)',
      note: practRows.length > PRACTITIONER_CAP ? `capped at ${PRACTITIONER_CAP}` : undefined,
    });
  }

  // relations: apply when both ends are accepted mappings; otherwise report
  const rels = { influences: [], unresolved: [] };
  for (const r of rows) {
    for (const [key, ourRel] of [['influencedBy', 'influences'], ['follows', 'parents']]) {
      if (!r[key]) continue;
      const otherQ = qid(r[key].value);
      const otherTerm = qidToTerm.get(otherQ);
      const label = r[`${key}Label`]?.value ?? otherQ;
      if (otherTerm && ourRel === 'influences') {
        // P737 "influenced by": otherTerm influenced termId
        if (!rels.influences.includes(otherTerm)) rels.influences.push(otherTerm);
      } else {
        rels.unresolved.push({ property: key === 'influencedBy' ? 'P737' : 'P155', qid: otherQ, label });
      }
    }
  }
  if (rels.influences.length) {
    u.fill('facets.lineage.influences', rels.influences, { ...prov, property: 'P737' });
  }
  if (rels.unresolved.length) {
    relationReport[termId] = { qid: q, source_url: pageUrl, accessed: fetched,
      unresolved: [...new Map(rels.unresolved.map((x) => [x.qid, x])).values()] };
  }

  if (u.save()) {
    touched++;
    console.log(`${termId}: filled [${u.applied.join(', ')}]`
      + (u.skipped.length ? ` — kept existing [${u.skipped.join(', ')}]` : ''));
  } else {
    console.log(`${termId}: nothing to fill`);
  }
}

mkdirSync('harvest', { recursive: true });
writeFileSync('harvest/wd-relations.yaml', stringify(relationReport));
console.log(`\nwikidata: updated ${touched} entries; unresolved relations → harvest/wd-relations.yaml`);
