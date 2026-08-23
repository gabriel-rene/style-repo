# Visual Style Reference Library

A browsable encyclopedia of graphic design, illustration, and typographic
styles. Facet navigation, historical context, reference imagery.

- `/content` — one YAML file per term. Source of truth. Human-editable.
- `/schema` — schema spec. See `schema/SCHEMA.md`.
- `/scripts` — validator, index builder, harvesters, setup.
- `/index` — derived SQLite db (gitignored, disposable, always rebuilt).
- `/harvest` — harvest state: mappings.yaml (id review queue), query
  overrides, relation reports, COVERAGE.md.
- `/assets` — downloaded open-license images (committed).
- `/site` — Astro static site (browse UI). `site/dist` is gitignored.
- `/cache` — raw API responses (gitignored, disposable).
- `DECISIONS.md` — log of non-obvious choices.

## Commands

```sh
sh scripts/setup.sh      # once per clone: deps + pre-commit hook
npm run validate         # check all content files (also runs on every commit)
npm run build:index      # rebuild index/styles.db from YAML

# harvesters (all cached; --refresh to re-hit APIs)
# ⚠ run ONE at a time — they rewrite content/*.yaml and clobber each other
node --no-warnings scripts/harvest/reconcile.js      # find AAT/Wikidata ids → mappings.yaml
node --no-warnings scripts/harvest/getty-aat.js      # scope notes, variants, dates
node --no-warnings scripts/harvest/wikidata.js       # dates, places, practitioners
node --no-warnings scripts/harvest/commons-images.js # open-license images (local)
node --no-warnings scripts/harvest/vam-images.js     # V&A objects (restricted, hotlinked)
node --no-warnings scripts/harvest/moma-images.js    # MoMA objects (restricted, hotlinked)
node --no-warnings scripts/coverage-report.js        # → harvest/COVERAGE.md
node --no-warnings scripts/prune-blocklisted-images.js # drop images listed in
                                                     # harvest/image-blocklist.yaml

# research ingest
node --no-warnings scripts/ingest-research.js        # research/inbox → content/drafts
                                                     # (format: research/FORMAT.md)

# trends (no caching — feeds are polled fresh)
node --no-warnings scripts/trends/collect-candidates.js  # feeds → trends/queue.yaml
node --no-warnings scripts/trends/review-due.js          # list overdue lifecycle reviews

# site (Astro, static; reads content/*.yaml directly at build time)
cd site && npm install    # once
npm run dev               # live preview at localhost:4321
npm run build             # rebuilds embeddings.json, then site/dist/
```

## Your review queue

- `harvest/mappings.yaml` — entries with `accept: null` need your yes/no on
  candidate AAT/Wikidata ids.
- `harvest/image-queries*.yaml` — terms set to `null` need a curated search
  query (their names are too ambiguous for auto-search).
- `harvest/image-blocklist.yaml` — curated list of never-harvest image URLs;
  add any irrelevant image's source_url here, then run
  `scripts/prune-blocklisted-images.js`.
- `harvest/aat-hierarchy.yaml`, `harvest/wd-relations.yaml` — cross-vocabulary
  relations awaiting your mapping decisions.
- Cooper Hewitt and Rijksmuseum harvesters need API keys from you.
- `CONFLICTS.md` (when it exists) — research-note claims that disagree with
  existing data; each block needs your decision.
- `trends/queue.yaml` — pending trend candidates; mark each `dismissed` or
  `accepted:<term-id>`.
- `harvest/trend-sources.yaml` — `arena_channels` is empty; add the Are.na
  channel slugs you want watched.
- `scripts/trends/review-due.js` output — tracked lifecycle states
  (emerging/peaking/saturated) that are overdue or missing a review date.

Status: Phases 3–5 done (harvesting, research ingest, trend pipeline).
Phase 6 site in `/site`: index, per-term pages, timeline, facet composition,
trending. Missing facts render as visible TODO slots, never invented.

Hard rules:
1. No date, attribution, origin claim, or practitioner name is ever written
   from model knowledge. Harvested with source URL, or null + TODO.
2. Every image record needs source URL, license, attribution, and rights
   status before commit.
