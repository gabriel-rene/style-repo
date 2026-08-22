# Decisions log

## 2026-08-23 — Phase 1

- **Added `term_type` (not in the proposed facet list).** The proposed facets
  implicitly made every entry a peer. Risograph (a machine), blackletter (a
  letterform tradition), and vaporwave (an internet aesthetic) all broke that.
  `term_type` + a facet-applicability matrix resolves it: apparatus entries get
  `formal_consequences`, styles point at apparatus via a `production` facet.

- **Era is a list of periods, not one span.** Blackletter needs origin + print
  era + revivals. A single start/end forced either a lie or a uselessly wide range.

- **Provenance as a separate dotted-path map, not inline wrappers.** Inline
  `{value, sources}` wrappers on every field make YAML painful to hand-edit.
  A bottom-of-file `provenance:` map keeps content clean and is still
  machine-checkable. Tradeoff: field renames must update the map; the validator
  will catch dangling paths.

- **Formal properties and stance are editorial, flagged `reviewed: false`.**
  They are interpretive judgments, not harvestable facts. They live under
  `source: editorial` in provenance and require user review before an entry
  can reach `status: published`. Dates/places/names/lineage are harvest-only.

- **Stubs carry provisional editorial values only in the editorial-legal fields**
  (formal properties, stance, contexts), all flagged unreviewed — to demonstrate
  structural fit. Every date, place, name, lineage relation, and summary is
  null + TODO.

- **`memphis` entry models the style; the collective is metadata.**
  term_type `movement` with the group name as a name variant slot (TODO,
  harvest). Practitioner/group membership comes from Wikidata in Phase 3.

- **Bauhaus-style hybrids use `secondary_types`.** A movement that was also a
  school stays one entry; the hybrid nature is recorded, not split.

## 2026-08-23 — Phase 2

- **Node's built-in `node:sqlite` instead of better-sqlite3.** Node v22.22 ships
  SQLite 3.51 with FTS5 compiled in. Zero native-build dependency; the module is
  marked experimental, so build scripts run with `--no-warnings`. If the API
  shifts on a Node upgrade, swapping to better-sqlite3 is a small mechanical change.

- **Only runtime dependency is `yaml`.** No validation framework (ajv etc.) —
  the rules are mostly cross-field and provenance-shaped, which JSON Schema
  handles poorly. Hand-rolled validator in `scripts/validate.js`, constants
  shared with the index builder via `scripts/lib/schema.js`.

- **Validator enforces provenance policy, not just shape.** Harvest-only fields
  (era periods, geography, lineage, practitioners) that contain data but lack a
  non-editorial source entry are an error. `source: editorial` outside the
  allowed interpretive fields is an error. Published entries with unreviewed
  editorial fields are an error. This is hard rule 1 made executable.

- **`source: user` is a valid provenance source, no URL required.** For facts
  the user personally asserts (e.g. review-due dates, revival notes). The model
  never writes it; only the user does.

- **Lifecycle date requirements skip stubs.** `emerging/peaking/saturated`
  require first_observed + review_due, but only once status is draft/published —
  otherwise stubs couldn't exist before Phase 5 tooling fills dates.

- **Index computes inverse relations** (influenced_by ↔ influences,
  apparatus_used_by, children) with an `inferred` flag, so YAML stores each
  relation once and the UI can still navigate both directions.

- **Hook via `core.hooksPath .githooks`**, not a copied `.git/hooks` file, so
  the hook itself is version-controlled. `scripts/setup.sh` wires it on clone.

- **Repo initialized as git even though Phase 1 is a proposal.** Commits are
  labeled as proposal; nothing is final until user approval per hard rule 3.
