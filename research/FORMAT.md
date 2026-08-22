# Research note format

Drop markdown files into `research/inbox/`. Run:

```sh
node --no-warnings scripts/ingest-research.js
```

The parser turns each note into (or merges into) a draft at
`content/drafts/<term-id>.yaml`. Drafts NEVER go straight to `/content` —
you promote them by hand after review (`git mv content/drafts/x.yaml content/`
and set `status`). Conflicts between a note and existing data go to
`CONFLICTS.md`, never silently resolved.

## Note structure

```markdown
---
term: swiss-international-style   # required; kebab-case id
source: https://example.com/article-or-book-citation   # required; URL or citation
accessed: 2026-08-20              # optional; defaults to today
---

# Any title

## era
- origin: 1950-1965
- revival: 2010-

## geography
- origin: Switzerland
- spread: United States, Germany

## lineage
- parents: modernism
- influences: bauhaus, constructivism
- influenced: brutalist-web-design
- reacted_against: art-deco

## practitioners
- Josef Müller-Brockmann
- Armin Hofmann

## variants
- International Typographic Style

## summary
Free prose. Everything under this heading becomes the draft summary.

## notes
Free prose. Kept in the draft under research_notes, verbatim.
```

Rules the parser enforces:

- `term` and `source` frontmatter are required; a note without them is
  rejected (left in the inbox with an error printed).
- Facts land in the draft with provenance `source: research-note`, the note's
  `source` URL/citation, and the note filename.
- Lineage targets must be kebab-case ids. Unknown ids are kept but flagged in
  the draft's `todo` list (`lineage target not in content/`).
- If the draft (or a published term with the same id) already has a DIFFERENT
  value for a fact, BOTH claims go to `CONFLICTS.md` with their sources.
  The existing value stays. Nothing is overwritten.
- Processed notes move to `research/processed/` with a date prefix.
```
