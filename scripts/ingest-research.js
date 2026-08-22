#!/usr/bin/env node
// Parse research notes from research/inbox/*.md into drafts in
// content/drafts/. See research/FORMAT.md for the note format.
//
// Policy:
// - Drafts only. Never writes to content/ directly.
// - Fill-only merge. An existing different value = conflict → CONFLICTS.md,
//   both claims recorded with sources, existing value kept.
// - Every fact carries provenance {source: research-note, url, note, accessed}.
//
// Usage: node scripts/ingest-research.js [--keep] (--keep: don't move notes)

import { readFileSync, writeFileSync, readdirSync, mkdirSync, renameSync, existsSync, appendFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { parse, parseDocument, stringify } from 'yaml';
import { loadContentDir } from './lib/load.js';

const INBOX = 'research/inbox';
const PROCESSED = 'research/processed';
const DRAFTS = 'content/drafts';
const KEEP = process.argv.includes('--keep');
const today = new Date().toISOString().slice(0, 10);

const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const LINEAGE_KEYS = ['parents', 'influences', 'influenced', 'reacted_against', 'revival_of'];

// known term ids (published + drafts) for lineage checking
const known = new Set();
for (const dir of ['content', DRAFTS]) {
  if (!existsSync(dir)) continue;
  const { entries } = loadContentDir(dir);
  for (const e of entries) known.add(e.doc.id);
}

// ---------- note parsing ----------

function parseNote(raw, file) {
  const fm = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(raw);
  if (!fm) throw new Error('missing frontmatter block');
  const head = parse(fm[1]);
  if (!head?.term || !ID_RE.test(head.term)) throw new Error('frontmatter needs a kebab-case "term"');
  if (!head?.source || typeof head.source !== 'string') throw new Error('frontmatter needs a "source" (URL or citation)');

  // split body into ## sections
  const sections = {};
  let current = null;
  for (const line of fm[2].split('\n')) {
    const h = /^##\s+(.+?)\s*$/.exec(line);
    if (h) { current = h[1].toLowerCase(); sections[current] = []; continue; }
    if (current) sections[current].push(line);
  }
  for (const k of Object.keys(sections)) sections[k] = sections[k].join('\n').trim();

  const bullets = (text) => (text ?? '').split('\n')
    .map((l) => /^[-*]\s+(.*)$/.exec(l.trim())?.[1]?.trim())
    .filter(Boolean);

  const note = {
    term: head.term,
    source: head.source,
    accessed: head.accessed ? String(head.accessed).slice(0, 10) : today,
    file: basename(file),
    facts: {},
  };

  // era: "- origin: 1950-1965" / "- revival: 2010-"
  if (sections.era) {
    const periods = [];
    for (const b of bullets(sections.era)) {
      const m = /^([a-z]+)\s*:\s*(\d{3,4})\s*[-–]\s*(\d{3,4})?\s*$/.exec(b);
      if (!m) throw new Error(`era bullet not parseable: "${b}" (want "role: YYYY-YYYY" or "role: YYYY-")`);
      const role = m[1];
      if (!['origin', 'peak', 'revival', 'active'].includes(role)) {
        throw new Error(`era role "${role}" not one of origin|peak|revival|active`);
      }
      periods.push({ label: `research: ${basename(file)}`, role, start_year: +m[2], end_year: m[3] ? +m[3] : null });
    }
    if (periods.length) note.facts['facets.era.periods'] = periods;
  }

  if (sections.geography) {
    const origin = [], spread = [];
    for (const b of bullets(sections.geography)) {
      const m = /^(origin|spread)\s*:\s*(.+)$/.exec(b);
      if (!m) throw new Error(`geography bullet not parseable: "${b}"`);
      const places = m[2].split(',').map((s) => ({ label: s.trim(), wikidata: null }));
      (m[1] === 'origin' ? origin : spread).push(...places);
    }
    if (origin.length) note.facts['facets.geography.origin_places'] = origin;
    if (spread.length) note.facts['facets.geography.spread'] = spread;
  }

  if (sections.lineage) {
    for (const b of bullets(sections.lineage)) {
      const m = /^([a-z_]+)\s*:\s*(.+)$/.exec(b);
      if (!m || !LINEAGE_KEYS.includes(m[1])) throw new Error(`lineage bullet not parseable: "${b}"`);
      const ids = m[2].split(',').map((s) => s.trim());
      const bad = ids.find((i) => !ID_RE.test(i));
      if (bad) throw new Error(`lineage target "${bad}" is not a kebab-case id`);
      note.facts[`facets.lineage.${m[1]}`] = ids;
    }
  }

  if (sections.practitioners) {
    const people = bullets(sections.practitioners).map((name) => ({ name, wikidata: null }));
    if (people.length) note.facts['facets.practitioners.people'] = people;
  }

  if (sections.variants) {
    const v = bullets(sections.variants);
    if (v.length) note.facts['names.variants'] = v;
  }

  if (sections.summary) note.facts['summary'] = sections.summary;
  if (sections.notes) note.facts['research_notes'] = sections.notes;

  const knownSections = new Set(['era', 'geography', 'lineage', 'practitioners', 'variants', 'summary', 'notes']);
  for (const k of Object.keys(sections)) {
    if (!knownSections.has(k)) throw new Error(`unknown section "## ${k}" — see research/FORMAT.md`);
  }
  return note;
}

// ---------- draft management ----------

function draftSkeleton(id) {
  return {
    id, term_type: null, status: 'draft',
    names: { primary: null, variants: [] },
    summary: null,
    external_ids: { getty_aat: null, wikidata: null },
    facets: {
      era: { periods: [] },
      geography: { origin_places: [], spread: [] },
      lineage: { parents: [], influences: [], influenced: [], reacted_against: [], revival_of: [] },
      production: { apparatus: [], techniques: [] },
      formal_properties: null,
      ideological_stance: null,
      commercial_context: { contexts: [] },
      revival: { status: null, revivals: [] },
      lifecycle: { state: null, first_observed: null, review_due: null },
      practitioners: { people: [], studios: [] },
    },
    images: [],
    research_notes: null,
    todo: ['term_type', 'names.primary', 'facets.formal_properties'],
    // provenance intentionally absent — setIn creates it in block style;
    // an empty {} here would lock the whole map into cramped flow style
  };
}

const getPath = (obj, dotted) => dotted.split('.').reduce((n, p) => (n && typeof n === 'object' ? n[p] : undefined), obj);
const isEmpty = (v) => v === null || v === undefined || (Array.isArray(v) && v.length === 0) || (typeof v === 'string' && !v.trim());

function setPath(docNode, dotted, value) { docNode.setIn(dotted.split('.'), value); }

function logConflict(termId, path, existing, incoming, note, existingWhere) {
  const block = [
    `## ${termId} — \`${path}\` (${today})`,
    '',
    `- **Existing** (${existingWhere}): \`${JSON.stringify(existing)}\``,
    `- **Incoming** (research note \`${note.file}\`, source: ${note.source}): \`${JSON.stringify(incoming)}\``,
    '',
    'Existing value kept. Resolve by editing the draft/content file and deleting this block.',
    '',
  ].join('\n');
  if (!existsSync('CONFLICTS.md')) {
    writeFileSync('CONFLICTS.md', '# Data conflicts\n\nLogged by scripts/ingest-research.js. Each block needs a human decision.\n\n');
  }
  appendFileSync('CONFLICTS.md', block);
}

// ---------- main ----------

mkdirSync(INBOX, { recursive: true });
mkdirSync(PROCESSED, { recursive: true });
mkdirSync(DRAFTS, { recursive: true });

const files = readdirSync(INBOX).filter((f) => f.endsWith('.md'));
if (!files.length) { console.log('inbox empty — nothing to do'); process.exit(0); }

let ok = 0, failed = 0, conflicts = 0;
for (const f of files) {
  const path = join(INBOX, f);
  let note;
  try {
    note = parseNote(readFileSync(path, 'utf8'), f);
  } catch (e) {
    console.error(`REJECT ${f}: ${e.message} (left in inbox)`);
    failed++;
    continue;
  }

  // Published term with same id? Merge into a draft copy of nothing — we only
  // ever write drafts. If content/<id>.yaml exists, conflicts are checked
  // against it, and non-conflicting NEW facts still go to a draft overlay.
  const publishedPath = `content/${note.term}.yaml`;
  const draftPath = join(DRAFTS, `${note.term}.yaml`);
  const published = existsSync(publishedPath) ? parse(readFileSync(publishedPath, 'utf8')) : null;

  let docNode;
  if (existsSync(draftPath)) {
    docNode = parseDocument(readFileSync(draftPath, 'utf8'));
  } else {
    const skel = draftSkeleton(note.term);
    if (published) skel.names.primary = published.names?.primary ?? null;
    docNode = parseDocument(stringify(skel));
  }
  const doc = docNode.toJS();

  const prov = { source: 'research-note', url: note.source, note: note.file, accessed: note.accessed };
  let applied = 0;

  for (const [p, value] of Object.entries(note.facts)) {
    const inDraft = getPath(doc, p);
    const inPublished = published ? getPath(published, p) : undefined;

    // conflict = an existing NON-EMPTY value that differs from the incoming one
    const clash = (existing, where) => {
      if (isEmpty(existing)) return false;
      if (JSON.stringify(existing) === JSON.stringify(value)) return true; // identical: skip silently
      logConflict(note.term, p, existing, value, note, where);
      conflicts++;
      return true;
    };
    if (clash(inPublished, publishedPath) || clash(inDraft, `draft ${draftPath}`)) continue;

    setPath(docNode, p, value);
    const provPath = ['provenance', p];
    const existingProv = docNode.getIn(provPath);
    if (existingProv === undefined) docNode.setIn(provPath, [prov]);
    else docNode.addIn(provPath, prov);
    applied++;

    // flag unknown lineage targets
    if (p.startsWith('facets.lineage.')) {
      for (const target of value) {
        if (!known.has(target)) {
          const todoRaw = docNode.get('todo');
          const todo = todoRaw?.toJSON ? todoRaw.toJSON() : (todoRaw ?? []);
          const flag = `${p}: "${target}" not in content/ — create it or fix the id`;
          if (!todo.includes(flag)) docNode.set('todo', [...todo, flag]);
        }
      }
    }
  }

  writeFileSync(draftPath, docNode.toString());
  if (!KEEP) renameSync(path, join(PROCESSED, `${today}-${f}`));
  ok++;
  console.log(`${f} → ${draftPath} (${applied} fact(s) applied${KEEP ? '' : '; note moved to processed/'})`);
}

console.log(`\ningest: ${ok} note(s) processed, ${failed} rejected, ${conflicts} conflict(s)${conflicts ? ' → CONFLICTS.md' : ''}`);
process.exit(failed ? 1 : 0);
