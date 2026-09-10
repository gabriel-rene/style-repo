# Visual Style Reference Library

A Swiss-inspired reference for graphic design, illustration, typography and
production methods. White, black and a restrained red accent; self-hosted
Archivo type; responsive layouts with keyboard-accessible controls.

61 entries have practical visual guides: identifying traits, applications,
cautions and comparisons. The historical collection includes Socialist
Realism, Victorian graphic design, Chromolithography, WPA poster design and
Postmodern graphic design. 21 entries have sourced historical overviews;
unverified dates and origins remain absent. This is a broad working reference,
not an exhaustive or independently verified global history.

Browse with text search, type and visual-character filters, grid/list views,
an approximate timeline, side-by-side comparisons and saved styles stored in
your browser. URLs preserve search, filter and comparison selections.

## Quick start

Requires Node.js 22.13 or later.

```sh
npm ci
npm ci --prefix site
npm run dev              # http://localhost:4321
npm run check            # regression tests + validation + SQLite + static build + link checks
npm run coverage         # regenerate harvest/COVERAGE.md
```

`npm run build` creates `site/dist/` and rebuilds the disposable SQLite index.
To preview the production output, run `npm run preview --prefix site`.
Content edits are read at build time; restart the dev server after editing YAML.

## Repository

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

## Content and image review

The supplied [Graphic Design Movements 1850–2000 research](https://docs.google.com/document/d/1KK3Jpu_uVfU7CJ3WykzY8IU8bvWV7SM_SAPWmRy1joc/edit)
informs the historical expansion. Research-note provenance remains distinct
from museum and archive sources. Selected claims were checked against MoMA,
Bauhaus-Archiv, the Library of Congress and Bowdoin College Museum of Art.
Editorial `guide` observations and comparisons are not historical assertions.
Entries remain `draft` until editorial review is complete.

Image discovery does not establish relevance. Each harvested image starts
`review_status: pending`; only `approved` records appear on the site. Inspect
the image, caption, source, rights and relevance before approving it. Set
`featured_image` to an approved record's `source_url` to choose its cover.
Rejected and pending records remain available for curation in YAML, but their
local files are excluded from `site/dist/`. The repository retains the harvest.
The index shows monochrome previews; detail pages preserve original color with
an optional monochrome view. Entries without approved imagery use typography
and a written visual guide. `harvest/COVERAGE.md` lists these gaps.

SQLite rebuilding is atomic: failed builds leave the last valid index intact.
Both local and remote image records are supported. The tests cover this,
provenance coverage, asset validation and guide completeness.

Hard rules:
1. No date, attribution, origin claim, or practitioner name is written from
   model memory. Use recorded research or harvested sources with URLs, or
   leave the value absent with a TODO.
2. Every image record needs source URL, license, attribution, and rights
   status before commit.
