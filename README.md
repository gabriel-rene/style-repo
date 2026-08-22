# Visual Style Reference Library

A browsable encyclopedia of graphic design, illustration, and typographic
styles. Facet navigation, historical context, reference imagery.

- `/content` — one YAML file per term. Source of truth. Human-editable.
- `/schema` — schema spec. See `schema/SCHEMA.md`.
- `/scripts` — validator, index builder, setup.
- `/index` — derived SQLite db (gitignored, disposable, always rebuilt).
- `DECISIONS.md` — log of non-obvious choices.

## Commands

```sh
sh scripts/setup.sh      # once per clone: deps + pre-commit hook
npm run validate         # check all content files (also runs on every commit)
npm run build:index      # rebuild index/styles.db from YAML
```

Status: Phase 2 done (schema approved 2026-08-23; validator + index + hook).

Hard rules:
1. No date, attribution, origin claim, or practitioner name is ever written
   from model knowledge. Harvested with source URL, or null + TODO.
2. Every image record needs source URL, license, attribution, and rights
   status before commit.
