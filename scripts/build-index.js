#!/usr/bin/env node
// Build the derived SQLite index from /content YAML.
// YAML is the source of truth; index/styles.db is disposable — always rebuilt
// from scratch. Also computes reverse links (e.g. which styles use an apparatus).
//
// Usage: node scripts/build-index.js [contentDir] [dbPath]

import { mkdirSync, rmSync, renameSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { loadContentDir } from "./lib/load.js";

const contentDir = process.argv[2] ?? "content";
const dbPath = process.argv[3] ?? "index/styles.db";

const { entries, errors } = loadContentDir(contentDir);
if (errors.length) {
  for (const e of errors) console.error(`ERROR ${e}`);
  process.exit(1);
}

mkdirSync(dirname(dbPath), { recursive: true });
const temporaryPath = `${dbPath}.${process.pid}.tmp`;
const db = new DatabaseSync(temporaryPath);
try {
  db.exec(`
  PRAGMA journal_mode = DELETE;
  BEGIN;
  CREATE TABLE terms (
    id TEXT PRIMARY KEY,
    term_type TEXT NOT NULL,
    status TEXT NOT NULL,
    name TEXT NOT NULL,
    summary TEXT,
    ideological_stance TEXT,
    lifecycle_state TEXT,
    lifecycle_first_observed TEXT,
    lifecycle_review_due TEXT,
    revival_status TEXT,
    doc_json TEXT NOT NULL              -- full parsed document for the frontend
  );
  CREATE TABLE facet_values (           -- flat facet rows for facet-composition nav
    term_id TEXT NOT NULL REFERENCES terms(id),
    facet TEXT NOT NULL,                -- e.g. formal.grid_discipline, commercial_context
    value TEXT NOT NULL
  );
  CREATE INDEX idx_facet ON facet_values(facet, value);
  CREATE TABLE relations (              -- lineage + production, with computed inverses
    from_id TEXT NOT NULL,
    relation TEXT NOT NULL,             -- parents, influences, uses_apparatus, ...
    to_id TEXT NOT NULL,
    inferred INTEGER NOT NULL DEFAULT 0 -- 1 = computed inverse, not stored in YAML
  );
  CREATE INDEX idx_rel_from ON relations(from_id, relation);
  CREATE INDEX idx_rel_to ON relations(to_id, relation);
  CREATE TABLE periods (
    term_id TEXT NOT NULL REFERENCES terms(id),
    label TEXT NOT NULL,
    role TEXT NOT NULL,
    start_year INTEGER,
    end_year INTEGER
  );
  CREATE TABLE images (
    term_id TEXT NOT NULL REFERENCES terms(id),
    file TEXT,
    remote_image TEXT,
    source_url TEXT NOT NULL,
    license TEXT NOT NULL,
    attribution TEXT NOT NULL,
    rights_status TEXT NOT NULL,
    caption TEXT,
    CHECK (file IS NOT NULL OR remote_image IS NOT NULL)
  );
  CREATE VIRTUAL TABLE terms_fts USING fts5(
    id UNINDEXED, name, variants, summary
  );
`);

  const INVERSE = {
    influences: "influenced",
    influenced: "influences",
    parents: "parent_of",
    revival_of: "revived_by",
    reacted_against: "reacted_against_by",
  };

  const insTerm = db.prepare(
    `INSERT INTO terms VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
  );
  const insFacet = db.prepare(`INSERT INTO facet_values VALUES (?,?,?)`);
  const insRel = db.prepare(`INSERT INTO relations VALUES (?,?,?,?)`);
  const insPeriod = db.prepare(`INSERT INTO periods VALUES (?,?,?,?,?)`);
  const insImage = db.prepare(`INSERT INTO images VALUES (?,?,?,?,?,?,?,?)`);
  const insFts = db.prepare(`INSERT INTO terms_fts VALUES (?,?,?,?)`);

  let relCount = 0,
    imgCount = 0;
  for (const { doc } of entries) {
    const f = doc.facets ?? {};
    const lc = f.lifecycle ?? {};
    insTerm.run(
      doc.id,
      doc.term_type,
      doc.status,
      doc.names?.primary ?? doc.id,
      doc.summary ?? null,
      f.ideological_stance ?? null,
      lc.state ?? null,
      lc.first_observed ?? null,
      lc.review_due ?? null,
      f.revival?.status ?? null,
      JSON.stringify(doc),
    );
    insFts.run(
      doc.id,
      doc.names?.primary ?? doc.id,
      (doc.names?.variants ?? []).join(" "),
      doc.summary ?? "",
    );

    insFacet.run(doc.id, "term_type", doc.term_type);
    for (const t of doc.secondary_types ?? [])
      insFacet.run(doc.id, "term_type", t);
    const formal = f.formal_properties ?? f.formal_consequences ?? {};
    for (const k of [
      "grid_discipline",
      "contrast",
      "texture",
      "hierarchy",
      "ornament_level",
    ]) {
      if (formal[k]) insFacet.run(doc.id, `formal.${k}`, formal[k]);
    }
    if (formal.palette_logic?.descriptor) {
      insFacet.run(doc.id, "formal.palette", formal.palette_logic.descriptor);
    }
    if (f.ideological_stance)
      insFacet.run(doc.id, "stance", f.ideological_stance);
    for (const c of f.commercial_context?.contexts ?? [])
      insFacet.run(doc.id, "commercial_context", c);
    if (lc.state) insFacet.run(doc.id, "lifecycle", lc.state);

    for (const [rel, targets] of Object.entries(f.lineage ?? {})) {
      for (const to of targets ?? []) {
        insRel.run(doc.id, rel, to, 0);
        relCount++;
        if (INVERSE[rel]) {
          insRel.run(to, INVERSE[rel], doc.id, 1);
          relCount++;
        }
      }
    }
    for (const to of f.production?.apparatus ?? []) {
      insRel.run(doc.id, "uses_apparatus", to, 0);
      insRel.run(to, "apparatus_used_by", doc.id, 1);
      relCount += 2;
    }
    for (const to of f.production?.techniques ?? []) {
      insRel.run(doc.id, "uses_technique", to, 0);
      insRel.run(to, "technique_used_by", doc.id, 1);
      relCount += 2;
    }

    for (const p of f.era?.periods ?? []) {
      insPeriod.run(
        doc.id,
        p.label,
        p.role,
        p.start_year ?? null,
        p.end_year ?? null,
      );
    }
    for (const img of doc.images ?? []) {
      insImage.run(
        doc.id,
        img.file ?? null,
        img.remote_image ?? null,
        img.source_url,
        img.license,
        img.attribution,
        img.rights_status,
        img.caption ?? null,
      );
      imgCount++;
    }
  }

  db.exec("COMMIT");
  db.close();
  renameSync(temporaryPath, dbPath);
  console.log(
    `build-index: OK — ${entries.length} terms, ${relCount} relations, ${imgCount} images → ${dbPath}`,
  );
} catch (error) {
  try {
    db.close();
  } catch {}
  rmSync(temporaryPath, { force: true });
  rmSync(`${temporaryPath}-journal`, { force: true });
  throw error;
}
