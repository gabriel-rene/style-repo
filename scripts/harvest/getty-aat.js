#!/usr/bin/env node
// Harvest Getty AAT for every term with an ACCEPTED aat id in harvest/mappings.yaml.
// Fills (only if empty): summary (scope note), names.variants, external_ids,
// era.periods (from gvp:estStart/estEnd when present).
// Parent hierarchy goes to harvest/aat-hierarchy.yaml as REPORT data — AAT
// broader terms are AAT concepts, not our term ids, so lineage.parents is not
// auto-filled (validator would reject unknown ids; mapping AAT->our ids is a
// user decision).
//
// Usage: node scripts/harvest/getty-aat.js [--refresh]

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { parse, stringify } from 'yaml';
import { cachedJson } from './lib/cache.js';
import { EntryUpdater } from './lib/apply.js';

const SOURCE = 'getty-aat';
const mappings = parse(readFileSync('harvest/mappings.yaml', 'utf8'));

async function sparql(query, label) {
  const url = 'https://vocab.getty.edu/sparql.json?query=' + encodeURIComponent(query);
  const { data, fetched } = await cachedJson(url, { label });
  return { rows: data.results.bindings, fetched };
}

const hierarchyReport = {};
let touched = 0;

for (const [termId, m] of Object.entries(mappings)) {
  const aat = m.getty_aat?.accept;
  if (!aat) continue;
  const num = aat.replace('aat:', '');
  const uri = `http://vocab.getty.edu/aat/${num}`;
  const pageUrl = `https://vocab.getty.edu/aat/${num}`;

  const { rows, fetched } = await sparql(`
    SELECT ?note ?alt ?start ?end ?parent ?parentLab WHERE {
      OPTIONAL { aat:${num} skos:scopeNote ?sn . ?sn dct:language gvp_lang:en ; rdf:value ?note }
      OPTIONAL { aat:${num} xl:altLabel ?al . ?al xl:literalForm ?alt . FILTER(lang(?alt)="en") }
      OPTIONAL { aat:${num} gvp:estStart ?start }
      OPTIONAL { aat:${num} gvp:estEnd ?end }
      OPTIONAL { aat:${num} gvp:broaderPreferred ?parent .
                 ?parent gvp:prefLabelGVP/xl:literalForm ?parentLab . FILTER(lang(?parentLab)="en") }
    }`, `aat-record:${termId}`);

  if (rows.length === 0) { console.log(`${termId}: AAT record empty`); continue; }

  const first = rows[0];
  const alts = [...new Set(rows.map((r) => r.alt?.value).filter(Boolean))];
  const parents = [...new Map(rows.filter((r) => r.parent)
    .map((r) => [r.parent.value, { uri: r.parent.value, label: r.parentLab?.value ?? '' }])).values()];

  const u = new EntryUpdater(`content/${termId}.yaml`);
  const prov = { source: SOURCE, url: pageUrl, accessed: fetched };

  u.fill('external_ids.getty_aat', aat, { ...prov, method: m.getty_aat.method });
  if (first.note?.value) u.fill('summary', first.note.value, prov);
  if (alts.length) u.fill('names.variants', alts, prov);

  const start = first.start?.value, end = first.end?.value;
  if (start || end) {
    u.fill('facets.era.periods', [{
      label: 'AAT estimated span',
      role: 'origin',
      start_year: start ? parseInt(start, 10) : null,
      end_year: end ? parseInt(end, 10) : null,
    }], prov);
  }

  hierarchyReport[termId] = { aat, parents, source_url: pageUrl, accessed: fetched };

  if (u.save()) {
    touched++;
    console.log(`${termId}: filled [${u.applied.join(', ')}]`
      + (u.skipped.length ? ` — kept existing [${u.skipped.join(', ')}]` : ''));
  } else {
    console.log(`${termId}: nothing to fill (all fields already set)`);
  }
}

mkdirSync('harvest', { recursive: true });
writeFileSync('harvest/aat-hierarchy.yaml', stringify(hierarchyReport));
console.log(`\ngetty-aat: updated ${touched} entries; hierarchy → harvest/aat-hierarchy.yaml`);
