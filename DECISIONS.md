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

- **Repo initialized as git even though Phase 1 is a proposal.** Commits are
  labeled as proposal; nothing is final until user approval per hard rule 3.
