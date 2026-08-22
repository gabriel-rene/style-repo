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
- `/cache` — raw API responses (gitignored, disposable).
- `DECISIONS.md` — log of non-obvious choices.

## Commands

```sh
sh scripts/setup.sh      # once per clone: deps + pre-commit hook
npm run validate         # check all content files (also runs on every commit)
npm run build:index      # rebuild index/styles.db from YAML

# harvesters (all cached; --refresh to re-hit APIs)
node --no-warnings scripts/harvest/reconcile.js      # find AAT/Wikidata ids → mappings.yaml
node --no-warnings scripts/harvest/getty-aat.js      # scope notes, variants, dates
node --no-warnings scripts/harvest/wikidata.js       # dates, places, practitioners
node --no-warnings scripts/harvest/commons-images.js # open-license images (local)
node --no-warnings scripts/harvest/vam-images.js     # V&A objects (restricted, hotlinked)
node --no-warnings scripts/harvest/moma-images.js    # MoMA objects (restricted, hotlinked)
node --no-warnings scripts/coverage-report.js        # → harvest/COVERAGE.md
```

## Your review queue

- `harvest/mappings.yaml` — entries with `accept: null` need your yes/no on
  candidate AAT/Wikidata ids.
- `harvest/image-queries*.yaml` — terms set to `null` need a curated search
  query (their names are too ambiguous for auto-search).
- `harvest/aat-hierarchy.yaml`, `harvest/wd-relations.yaml` — cross-vocabulary
  relations awaiting your mapping decisions.
- Cooper Hewitt and Rijksmuseum harvesters need API keys from you.

Status: Phase 3 harvesting done (Commons/V&A/MoMA + Getty/Wikidata).

Hard rules:
1. No date, attribution, origin claim, or practitioner name is ever written
   from model knowledge. Harvested with source URL, or null + TODO.
2. Every image record needs source URL, license, attribution, and rights
   status before commit.
