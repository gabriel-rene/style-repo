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

## Phase 3 — image harvesting

- **Three image sources shipped; two blocked on keys.** Wikimedia Commons
  (open licenses, downloaded locally), V&A (restricted, hotlinked via IIIF),
  MoMA dataset (metadata CC0, image rights not cleared → restricted,
  hotlinked). Cooper Hewitt rejects keyless calls; the legacy Rijksmuseum API
  is retired (HTTP 410) and its replacement needs a key. Both are wired-up
  candidates once the user provides tokens.

- **rights_status maps to storage policy.** `open` images must have a local
  file under assets/; `restricted` images must NOT be copied locally — the
  record stores a `remote_image` URL instead and the validator enforces both
  directions. This keeps hard rule 2 honest: we never redistribute imagery we
  don't have rights to.

- **Commons license allowlist, not blocklist.** Only `pd`, `cc0`, `cc-by-*`,
  `cc-by-sa-*` machine-readable license ids are accepted; anything else is
  skipped, not marked restricted, because unvetted Commons files aren't worth
  a record.

- **Ambiguous term names get `null` query overrides instead of guesses.**
  "Memphis" matched Tennessee photography at MoMA; "acid graphics" matched
  etching and unrelated files. harvest/image-queries*.yaml maps term-id →
  search string, and an explicit `null` means "skip until the user writes a
  curated query." The harvester never invents a disambiguation on its own.

- **Relevance guard on Commons full-text search.** A result is only kept if
  its title/description contains a distinctive (non-generic) word from the
  term name or query. This killed a "Flag of Plano, Texas" match for Bauhaus
  that slipped in because its description said "graphic designer".

- **Download politeness.** upload.wikimedia.org rate-limits bursts (HTTP 429);
  cachedDownload now paces ~1 req/s and retries 429/5xx with backoff.
  Some downloads still fail on a first pass — a re-run picks up survivors
  from cache and only re-fetches the failures.

- **Coverage report is generated, not curated.** scripts/coverage-report.js
  writes harvest/COVERAGE.md (per-term counts, gap lists, open-license
  coverage bucketed by origin-period era). "Era unknown" is itself reported
  as a harvest gap rather than being guessed.

## Phase 4 — research ingest

- **Notes are structured markdown, not free prose.** research/FORMAT.md
  defines `## era`, `## geography`, `## lineage`, `## practitioners`,
  `## variants`, `## summary`, `## notes` sections with strict bullet
  grammars. A note that doesn't parse is rejected loudly and left in the
  inbox — the parser never guesses at intent. `term` + `source` frontmatter
  are mandatory so every ingested fact has a citation.

- **Drafts only, and drafts may shadow published terms.** Ingest writes to
  content/drafts/<id>.yaml even when content/<id>.yaml exists; promotion to
  /content is always a manual git mv by the user. New facts about a published
  term accumulate in its draft overlay for review.

- **Conflict = existing non-empty value ≠ incoming value.** Both claims,
  both sources, and the date go to CONFLICTS.md; the existing value is kept
  untouched. Identical values are skipped silently (agreement isn't a
  conflict). This is the "never silently pick one" rule made executable.

- **Validator is draft-tolerant but never rights-tolerant.** In drafts,
  missing term_type/names.primary and unknown lineage targets degrade to
  warnings (a draft is allowed to be incomplete). Image rights fields and
  provenance policy stay hard errors everywhere — incompleteness is a state,
  unlicensed imagery is a violation.

## Phase 5 — trend pipeline

- **The collector gathers; the user decides.** collect-candidates.js only
  appends `status: pending` entries to trends/queue.yaml. It never creates a
  term, never touches content/, never auto-publishes. Triage = the user edits
  status to `dismissed` or `accepted:<term-id>`.

- **queue.yaml is user-owned; the collector is append-only.** Existing
  entries are never modified, and a URL already present (any status,
  including dismissed) is never re-added — so a dismissal is permanent
  without a separate tombstone file.

- **Trend feeds are NOT cached.** Unlike the museum harvesters, freshness is
  the whole point; a stale feed defeats it. Politeness is 1 req/s pacing
  instead. A failed source is skipped with an error; the queue is untouched.

- **Are.na channel list ships empty.** Which channels signal trends is a
  curation judgment. harvest/trend-sources.yaml documents how to add slugs.
  fontsinuse.com/main.rss is on by default because it is the site-wide
  contributions firehose, not a topical pick. (Feed URL read from the site's
  own <link rel="alternate"> tags; /rss and /feed 500.)

- **review-due.js reports, exits 1 on overdue, changes nothing.** Terms in
  emerging/peaking/saturated states claim to describe live phenomena;
  review_due is when that claim expires. Missing date = "NO DATE" flag.
  Updating state/dates stays a human edit with provenance.
