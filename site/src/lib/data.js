// Build-time data layer. Reads ../content YAML directly (the source of truth).
// The SQLite index is for tooling; the site rebuilds the same derived views
// here so `astro build` needs nothing but the YAML files.
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { parse } from "yaml";

// Astro bundles this module into dist/, so import.meta.url is useless for
// locating the repo. Walk up from cwd until content/ appears instead
// (astro runs with cwd = site/, so this finds the repo root in one hop).
function findRepo() {
  let dir = resolve(process.cwd());
  while (true) {
    if (existsSync(join(dir, "content")) && existsSync(join(dir, "schema")))
      return dir;
    const up = dirname(dir);
    if (up === dir)
      throw new Error("style-repo root not found from " + process.cwd());
    dir = up;
  }
}
const REPO = findRepo();
const CONTENT = join(REPO, "content");
// This module is also loaded directly by the Node embedding-build script, where
// Astro's import.meta.env is unavailable.
const SITE_BASE = process.env.GITHUB_ACTIONS ? "/style-repo/" : "/";

// lineage relation -> its computed inverse label
const INVERSE = {
  parents: "parent_of",
  influences: "influenced",
  influenced: "influences",
  reacted_against: "reacted_against_by",
  revival_of: "revived_by",
};

let _cache = null;

export function loadAll() {
  if (_cache) return _cache;
  const terms = [];
  for (const file of readdirSync(CONTENT)
    .filter((f) => f.endsWith(".yaml"))
    .sort()) {
    const doc = parse(readFileSync(join(CONTENT, file), "utf8"));
    if (doc && typeof doc === "object") terms.push(doc);
  }
  const byId = new Map(terms.map((t) => [t.id, t]));

  // relations: stored + computed inverses, deduped
  const relations = [];
  const push = (from, relation, to, inferred) => {
    if (byId.has(from) && byId.has(to))
      relations.push({ from, relation, to, inferred });
  };
  for (const t of terms) {
    const lin = t.facets?.lineage ?? {};
    for (const [key, refs] of Object.entries(lin)) {
      for (const ref of refs ?? []) {
        push(t.id, key, ref, false);
        if (INVERSE[key]) push(ref, INVERSE[key], t.id, true);
      }
    }
    const prod = t.facets?.production ?? {};
    for (const ref of prod.apparatus ?? []) {
      push(t.id, "uses_apparatus", ref, false);
      push(ref, "apparatus_used_by", t.id, true);
    }
    for (const ref of prod.techniques ?? []) {
      push(t.id, "uses_technique", ref, false);
      push(ref, "technique_used_by", t.id, true);
    }
  }

  const unique = [
    ...new Map(
      relations.map((r) => [`${r.from}:${r.relation}:${r.to}`, r]),
    ).values(),
  ];
  _cache = { terms, byId, relations: unique };
  return _cache;
}

export function relationsFor(id) {
  const { relations } = loadAll();
  const grouped = {};
  for (const r of relations.filter((r) => r.from === id)) {
    (grouped[r.relation] ??= []).push(r);
  }
  return grouped;
}

// First displayable image for a term card. Open images live in /assets
// (symlinked into site/public); restricted ones hotlink via remote_image.
export function thumb(term) {
  for (const img of displayImages(term)) {
    if (typeof img?.file === "string" && img.file)
      return { src: SITE_BASE + img.file, img };
    if (typeof img?.remote_image === "string")
      return { src: img.remote_image, img };
  }
  return null;
}

export function imageSrc(img) {
  if (typeof img?.file === "string" && img.file) return SITE_BASE + img.file;
  if (typeof img?.remote_image === "string") return img.remote_image;
  return null;
}

// Era span for timeline: min start / max end across dated periods.
export function eraSpan(term) {
  const periods = (term.facets?.era?.periods ?? []).filter(
    (p) => Number.isInteger(p?.start_year) || Number.isInteger(p?.end_year),
  );
  if (!periods.length) return null;
  const starts = periods.map((p) => p.start_year).filter(Number.isInteger);
  const ends = periods.map((p) => p.end_year).filter(Number.isInteger);
  return {
    start: starts.length ? Math.min(...starts) : null,
    end: ends.length ? Math.max(...ends) : null,
    periods,
  };
}

const TRACKED = ["emerging", "peaking", "saturated"];

export function lifecycleRows() {
  const { terms } = loadAll();
  const today = new Date().toISOString().slice(0, 10);
  return terms
    .filter((t) => TRACKED.includes(t.facets?.lifecycle?.state))
    .map((t) => {
      const lc = t.facets.lifecycle;
      const flag = !lc.review_due
        ? "no date"
        : lc.review_due <= today
          ? "overdue"
          : "ok";
      return {
        term: t,
        state: lc.state,
        review_due: lc.review_due ?? null,
        flag,
      };
    });
}

export function trendQueue() {
  const path = join(REPO, "trends/queue.yaml");
  if (!existsSync(path))
    return { pending: [], counts: { pending: 0, dismissed: 0, accepted: 0 } };
  const q = parse(readFileSync(path, "utf8")) ?? {};
  const all = q.candidates ?? [];
  const counts = {
    pending: all.filter((c) => c.status === "pending").length,
    dismissed: all.filter((c) => c.status === "dismissed").length,
    accepted: all.filter((c) => String(c.status).startsWith("accepted:"))
      .length,
  };
  return { pending: all.filter((c) => c.status === "pending"), counts };
}

// Facet dimensions offered for composition browsing. Each yields
// { dim, label, values: Map<value, Set<termId>> } built from real data only.
export function facetDimensions() {
  const { terms } = loadAll();
  const dims = [
    ["term_type", "Type", (t) => [t.term_type, ...(t.secondary_types ?? [])]],
    ["grid_discipline", "Grid", (t) => [formal(t)?.grid_discipline]],
    ["palette", "Palette", (t) => [formal(t)?.palette_logic?.descriptor]],
    ["contrast", "Contrast", (t) => [formal(t)?.contrast]],
    ["texture", "Texture", (t) => [formal(t)?.texture]],
    ["hierarchy", "Hierarchy", (t) => [formal(t)?.hierarchy]],
    ["ornament", "Ornament", (t) => [formal(t)?.ornament_level]],
    ["stance", "Stance", (t) => [t.facets?.ideological_stance]],
    [
      "context",
      "Used for",
      (t) => t.facets?.commercial_context?.contexts ?? [],
    ],
    ["lifecycle", "Lifecycle", (t) => [t.facets?.lifecycle?.state]],
  ];
  return dims
    .map(([dim, label, get]) => {
      const values = new Map();
      for (const t of terms) {
        for (const v of get(t) ?? []) {
          if (v == null || v === "not-applicable") continue;
          if (!values.has(v)) values.set(v, new Set());
          values.get(v).add(t.id);
        }
      }
      return { dim, label, values };
    })
    .filter((d) => d.values.size > 0);
}

function formal(t) {
  return t.facets?.formal_properties ?? t.facets?.formal_consequences ?? null;
}

// Static embedding index (committed artifact built by site/scripts/build-embeddings.js).
export function related(id, limit = 4) {
  const path = join(REPO, "site/src/data/embeddings.json");
  if (!existsSync(path)) return [];
  const { vectors } = JSON.parse(readFileSync(path, "utf8"));
  const me = vectors[id];
  if (!me) return [];
  const cos = (a, b) => {
    let dot = 0,
      na = 0,
      nb = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
  };
  return Object.entries(vectors)
    .filter(([k]) => k !== id)
    .map(([k, v]) => ({ id: k, score: cos(me, v) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function displayImages(term) {
  return (term.images ?? [])
    .filter((i) => i.review_status === "approved")
    .sort(
      (a, b) =>
        Number(b.source_url === term.featured_image) -
        Number(a.source_url === term.featured_image),
    );
}
export function sourcesFor(term) {
  const found = new Map();
  for (const [field, sources] of Object.entries(term.provenance ?? {})) {
    if (field === "images") continue;
    for (const s of sources)
      if (s.url && /^https?:/.test(s.url)) {
        const existing = found.get(s.url);
        if (existing) existing.fields.push(field);
        else found.set(s.url, { ...s, fields: [field] });
      }
  }
  return [...found.values()];
}
export const typeLabel = (type) =>
  ({
    movement: "Movement",
    style: "Style",
    aesthetic: "Aesthetic",
    technique: "Technique",
    apparatus: "Apparatus",
    "letterform-tradition": "Letterform",
  })[type] ?? type;
export const description = (term) =>
  term.guide?.dek ?? term.summary ?? term.names.primary;
