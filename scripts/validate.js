#!/usr/bin/env node
// Validator for /content YAML entries. Fails loudly (exit 1) on:
//  - schema violations (bad enums, wrong shapes, missing required fields)
//  - image records missing any rights field
//  - broken lineage/production references
//  - provenance violations (editorial source outside allowed fields,
//    harvest-only fields filled without a sourced URL, dangling paths)
//
// Usage: node scripts/validate.js [contentDir]
//   also validates /content/drafts if present (same rules, status must be stub|draft)

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadContentDir } from './lib/load.js';
import {
  TERM_TYPES, STATUSES, PRODUCTION_TYPES, ENUMS,
  TRACKED_LIFECYCLE_STATES, COMMERCIAL_CONTEXTS, LINEAGE_KEYS,
  EDITORIAL_OK_PREFIXES, HARVEST_ONLY_PATHS,
} from './lib/schema.js';

const contentDir = process.argv[2] ?? 'content';
const problems = [];
const warnings = [];

function err(file, msg) { problems.push(`${file}: ${msg}`); }
function warn(file, msg) { warnings.push(`${file}: ${msg}`); }

const isStr = (v) => typeof v === 'string' && v.length > 0;
const isArr = Array.isArray;
const isObj = (v) => v !== null && typeof v === 'object' && !isArr(v);

function checkEnum(file, value, allowed, label, { nullable = true } = {}) {
  if (value === undefined || value === null) {
    if (!nullable) err(file, `${label} is required`);
    return;
  }
  if (!allowed.includes(value)) {
    err(file, `${label} has invalid value "${value}" (allowed: ${allowed.join(', ')})`);
  }
}

function checkFormalBlock(file, block, label) {
  if (!isObj(block)) { err(file, `${label} must be a mapping`); return; }
  checkEnum(file, block.grid_discipline, ENUMS.grid_discipline, `${label}.grid_discipline`);
  checkEnum(file, block.contrast, ENUMS.contrast, `${label}.contrast`);
  checkEnum(file, block.texture, ENUMS.texture, `${label}.texture`);
  checkEnum(file, block.hierarchy, ENUMS.hierarchy, `${label}.hierarchy`);
  checkEnum(file, block.ornament_level, ENUMS.ornament_level, `${label}.ornament_level`);
  const pal = block.palette_logic;
  if (pal !== undefined && pal !== null) {
    if (!isObj(pal)) err(file, `${label}.palette_logic must be a mapping`);
    else checkEnum(file, pal.descriptor, ENUMS.palette_descriptor, `${label}.palette_logic.descriptor`);
  }
}

// ---- load main content + drafts ----
const { entries, errors: loadErrors } = loadContentDir(contentDir);
for (const e of loadErrors) problems.push(e);

const draftsDir = join(contentDir, 'drafts');
let draftEntries = [];
if (existsSync(draftsDir)) {
  const r = loadContentDir(draftsDir);
  for (const e of r.errors) problems.push(`drafts/${e}`);
  draftEntries = r.entries.map((x) => ({ ...x, file: `drafts/${x.file}`, isDraft: true }));
}

const all = [...entries, ...draftEntries];
const idSet = new Set(entries.map((e) => e.doc?.id).filter(Boolean));
const typeById = new Map(entries.map((e) => [e.doc?.id, e.doc?.term_type]));

// duplicate ids across content (drafts may shadow; that's their job)
const seen = new Map();
for (const e of entries) {
  const id = e.doc?.id;
  if (id && seen.has(id)) err(e.file, `duplicate id "${id}" (also in ${seen.get(id)})`);
  else if (id) seen.set(id, e.file);
}

for (const { file, stem, doc, isDraft } of all) {
  // ---- identity ----
  if (!isStr(doc.id)) err(file, 'missing id');
  else {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(doc.id)) err(file, `id "${doc.id}" is not kebab-case`);
    if (doc.id !== stem) err(file, `id "${doc.id}" does not match filename stem "${stem}"`);
  }
  checkEnum(file, doc.term_type, TERM_TYPES, 'term_type', { nullable: false });
  if (doc.secondary_types !== undefined) {
    if (!isArr(doc.secondary_types)) err(file, 'secondary_types must be a list');
    else for (const t of doc.secondary_types) checkEnum(file, t, TERM_TYPES, 'secondary_types entry');
  }
  checkEnum(file, doc.status, STATUSES, 'status', { nullable: false });
  if (isDraft && doc.status === 'published') err(file, 'a draft cannot have status published');

  if (!isObj(doc.names) || !isStr(doc.names.primary)) err(file, 'names.primary is required');

  const isProduction = PRODUCTION_TYPES.includes(doc.term_type);
  const facets = doc.facets;
  if (!isObj(facets)) { err(file, 'facets is required'); continue; }

  // ---- era ----
  if (facets.era !== undefined) {
    if (!isObj(facets.era) || !isArr(facets.era.periods ?? [])) err(file, 'facets.era.periods must be a list');
    else for (const [i, p] of (facets.era.periods ?? []).entries()) {
      if (!isObj(p)) { err(file, `era.periods[${i}] must be a mapping`); continue; }
      if (!isStr(p.label)) err(file, `era.periods[${i}].label is required`);
      checkEnum(file, p.role, ENUMS.period_role, `era.periods[${i}].role`, { nullable: false });
      for (const k of ['start_year', 'end_year']) {
        if (p[k] !== undefined && p[k] !== null && !Number.isInteger(p[k])) {
          err(file, `era.periods[${i}].${k} must be an integer or null`);
        }
      }
    }
  }

  // ---- lineage / production refs ----
  const lin = facets.lineage;
  if (lin !== undefined) {
    if (!isObj(lin)) err(file, 'facets.lineage must be a mapping');
    else for (const key of Object.keys(lin)) {
      if (!LINEAGE_KEYS.includes(key)) { err(file, `facets.lineage.${key} is not a known relation`); continue; }
      if (!isArr(lin[key])) { err(file, `facets.lineage.${key} must be a list`); continue; }
      for (const ref of lin[key]) {
        if (!isStr(ref)) err(file, `facets.lineage.${key} entries must be term-id strings`);
        else if (!idSet.has(ref)) err(file, `facets.lineage.${key} references unknown term "${ref}"`);
        else if (ref === doc.id) err(file, `facets.lineage.${key} references itself`);
      }
    }
  }
  const prod = facets.production;
  if (prod !== undefined && prod !== null) {
    if (isProduction) err(file, `${doc.term_type} entries do not take a production facet`);
    else if (!isObj(prod)) err(file, 'facets.production must be a mapping');
    else {
      for (const [key, wantType] of [['apparatus', 'apparatus'], ['techniques', 'technique']]) {
        for (const ref of prod[key] ?? []) {
          if (!idSet.has(ref)) err(file, `facets.production.${key} references unknown term "${ref}"`);
          else if (typeById.get(ref) !== wantType) {
            err(file, `facets.production.${key} ref "${ref}" is a ${typeById.get(ref)}, expected ${wantType}`);
          }
        }
      }
    }
  }

  // ---- formal properties vs consequences (term_type gating) ----
  if (isProduction) {
    if (facets.formal_properties !== undefined) {
      err(file, `${doc.term_type} entries use formal_consequences, not formal_properties`);
    }
    if (facets.ideological_stance !== undefined && facets.ideological_stance !== null) {
      err(file, `${doc.term_type} entries do not take ideological_stance`);
    }
    if (facets.formal_consequences !== undefined) {
      checkFormalBlock(file, facets.formal_consequences, 'formal_consequences');
    }
  } else {
    if (facets.formal_consequences !== undefined) {
      err(file, `only apparatus/technique entries take formal_consequences`);
    }
    if (facets.formal_properties !== undefined) {
      checkFormalBlock(file, facets.formal_properties, 'formal_properties');
    }
    checkEnum(file, facets.ideological_stance, ENUMS.ideological_stance, 'ideological_stance');
  }

  // ---- commercial context ----
  const cc = facets.commercial_context;
  if (cc !== undefined && cc !== null) {
    if (!isObj(cc) || !isArr(cc.contexts ?? [])) err(file, 'commercial_context.contexts must be a list');
    else for (const c of cc.contexts ?? []) {
      if (!COMMERCIAL_CONTEXTS.includes(c)) {
        err(file, `commercial_context "${c}" not in vocabulary (extend scripts/lib/schema.js + note in DECISIONS.md)`);
      }
    }
  }

  // ---- revival ----
  const rev = facets.revival;
  if (rev !== undefined && rev !== null) {
    if (!isObj(rev)) err(file, 'facets.revival must be a mapping');
    else checkEnum(file, rev.status, ENUMS.revival_status, 'revival.status');
  }

  // ---- lifecycle ----
  const lc = facets.lifecycle;
  if (doc.term_type === 'aesthetic' && (!isObj(lc) || lc.state === undefined)) {
    err(file, 'aesthetic entries require facets.lifecycle.state (null allowed on stubs only)');
  }
  if (isObj(lc)) {
    checkEnum(file, lc.state, ENUMS.lifecycle_state, 'lifecycle.state');
    if (TRACKED_LIFECYCLE_STATES.includes(lc.state) && doc.status !== 'stub') {
      for (const k of ['first_observed', 'review_due']) {
        if (!isStr(lc[k])) err(file, `lifecycle.state "${lc.state}" requires lifecycle.${k} (ISO date)`);
        else if (!/^\d{4}-\d{2}-\d{2}$/.test(lc[k])) err(file, `lifecycle.${k} must be YYYY-MM-DD`);
      }
    }
  }

  // ---- practitioners: harvest-only shape ----
  const pract = facets.practitioners;
  if (isObj(pract)) {
    for (const kind of ['people', 'studios']) {
      for (const [i, p] of (pract[kind] ?? []).entries()) {
        if (!isObj(p) || !isStr(p.name)) err(file, `practitioners.${kind}[${i}] needs a name`);
      }
    }
  }

  // ---- images: rights fields, NO EXCEPTIONS ----
  const images = doc.images;
  if (images !== undefined && !isArr(images)) err(file, 'images must be a list');
  for (const [i, img] of (isArr(images) ? images : []).entries()) {
    if (!isObj(img)) { err(file, `images[${i}] must be a mapping`); continue; }
    for (const field of ['source_url', 'license', 'attribution']) {
      if (!isStr(img[field])) err(file, `images[${i}] missing rights field "${field}"`);
    }
    checkEnum(file, img.rights_status, ENUMS.rights_status, `images[${i}].rights_status`, { nullable: false });
    if (isStr(img.source_url) && !/^https?:\/\//.test(img.source_url)) {
      err(file, `images[${i}].source_url must be an http(s) URL`);
    }
    if (!isStr(img.file)) err(file, `images[${i}].file (local path) is required`);
  }

  // ---- provenance ----
  const prov = doc.provenance ?? {};
  if (!isObj(prov)) err(file, 'provenance must be a mapping');
  else {
    for (const [path, sources] of Object.entries(prov)) {
      if (!pathExists(doc, path)) err(file, `provenance path "${path}" does not exist in the document`);
      if (!isArr(sources)) { err(file, `provenance["${path}"] must be a list of sources`); continue; }
      for (const s of sources) {
        if (!isObj(s) || !isStr(s.source)) { err(file, `provenance["${path}"] entry needs a source`); continue; }
        if (s.source === 'editorial') {
          if (!EDITORIAL_OK_PREFIXES.some((p) => path === p || path.startsWith(p + '.'))) {
            err(file, `provenance["${path}"]: editorial source not allowed here — harvested source with URL required`);
          }
          if (typeof s.reviewed !== 'boolean') err(file, `provenance["${path}"]: editorial entries need reviewed: true|false`);
        } else if (s.source !== 'user') {
          if (!isStr(s.url)) err(file, `provenance["${path}"]: harvested source "${s.source}" needs a url`);
        }
      }
    }
    // harvest-only fields with data must have non-editorial provenance
    for (const hPath of HARVEST_ONLY_PATHS) {
      if (!hasNonEmptyData(doc, hPath)) continue;
      const covered = Object.entries(prov).some(([p, srcs]) =>
        (p === hPath || p.startsWith(hPath + '.') || hPath.startsWith(p + '.')) &&
        isArr(srcs) && srcs.some((s) => isObj(s) && s.source && s.source !== 'editorial'));
      if (!covered) err(file, `"${hPath}" contains data but has no harvested/user provenance — hand-authoring is forbidden here`);
    }
    // published entries: all editorial provenance must be reviewed
    if (doc.status === 'published') {
      for (const [path, sources] of Object.entries(prov)) {
        if (isArr(sources)) for (const s of sources) {
          if (isObj(s) && s.source === 'editorial' && s.reviewed !== true) {
            err(file, `published entry has unreviewed editorial field "${path}"`);
          }
        }
      }
      if (!isStr(doc.summary)) err(file, 'published entries require a summary');
      if (isArr(doc.todo) && doc.todo.length > 0) warn(file, `published with ${doc.todo.length} open TODOs`);
    }
  }
}

function pathExists(doc, dotted) {
  let node = doc;
  for (const part of dotted.split('.')) {
    if (!isObj(node) || !(part in node)) return false;
    node = node[part];
  }
  return true;
}
function hasNonEmptyData(doc, dotted) {
  let node = doc;
  for (const part of dotted.split('.')) {
    if (!isObj(node) || !(part in node)) return false;
    node = node[part];
  }
  const empty = (v) =>
    v === null || v === undefined ||
    (isArr(v) && v.length === 0) ||
    (isObj(v) && Object.values(v).every(empty));
  return !empty(node);
}

// ---- report ----
for (const w of warnings) console.warn(`WARN  ${w}`);
if (problems.length) {
  for (const p of problems) console.error(`ERROR ${p}`);
  console.error(`\nvalidate: FAILED — ${problems.length} error(s) in ${all.length} file(s)`);
  process.exit(1);
}
console.log(`validate: OK — ${all.length} file(s), ${warnings.length} warning(s)`);
