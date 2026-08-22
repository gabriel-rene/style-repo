# Visual Style Reference Library

A browsable encyclopedia of graphic design, illustration, and typographic
styles. Facet navigation, historical context, reference imagery.

- `/content` — one YAML file per term. Source of truth. Human-editable.
- `/schema` — schema spec. See `schema/SCHEMA.md`.
- `DECISIONS.md` — log of non-obvious choices.

Status: Phase 1 (schema proposal). Awaiting approval.

Hard rules:
1. No date, attribution, origin claim, or practitioner name is ever written
   from model knowledge. Harvested with source URL, or null + TODO.
2. Every image record needs source URL, license, attribution, and rights
   status before commit.
