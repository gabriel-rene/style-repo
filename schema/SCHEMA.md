# Style Term Schema — v0.2

One YAML file per term in `/content`. Filename = `<id>.yaml`. IDs are kebab-case.

## Core structural decision: `term_type`

The original facet list treated every entry as a peer. Stress-testing broke that:
Risograph is a machine, Blackletter is a letterform tradition spanning centuries,
Vaporwave is a loosely-bounded internet aesthetic. None is a peer of Bauhaus.

Every entry declares what *kind* of thing it is:

| term_type | What it is | Which stub uses it |
|---|---|---|
| `movement` | Organized movement, school, or collective with members | bauhaus, memphis |
| `style` | Coherent visual style; may outlive any group | swiss-international-style, art-deco, brutalist-web-design |
| `aesthetic` | Loosely-bounded visual cluster, often internet-native, lifecycle-active | vaporwave, acid-graphics, frutiger-aero |
| `apparatus` | A machine or tool whose constraints produce a look | risograph |
| `technique` | A reproduction or production method (screen print, letterpress, …) | — |
| `letterform-tradition` | A script/letterform class spanning eras and revivals | blackletter |

Optional `secondary_types: []` for hybrids (e.g. a movement that was also a school).

Facet applicability by term_type:

| Facet | movement / style / aesthetic | apparatus / technique | letterform-tradition |
|---|---|---|---|
| era | yes | yes | yes (multiple periods) |
| geography | yes | yes | yes |
| lineage | yes | yes | yes |
| production (apparatus/technique refs) | yes | — | yes |
| formal_properties | yes | — | yes |
| formal_consequences | — | **yes** (what the tool imposes) | — |
| ideological_stance | yes | — | optional |
| commercial_context | yes | yes | yes |
| revival | yes | yes | yes |
| lifecycle | yes (required for `aesthetic`) | optional | yes |
| practitioners | yes (harvest-only) | yes (harvest-only) | yes (harvest-only) |
| images | yes | yes | yes |

## Top-level fields

```yaml
id: string                  # kebab-case, = filename
term_type: enum             # table above
secondary_types: []         # optional
status: stub | draft | published
names:
  primary: string
  variants: []              # harvested or TODO
summary: string | null      # TODO until sourced or user-authored
external_ids:
  getty_aat: id | null
  wikidata: qid | null
```

## Facets

### era
```yaml
era:
  periods:
    - label: string                       # free label, no claim
      start_year: int | null              # SOURCED: harvest or recorded research
      end_year: int | null
      role: origin | peak | revival | active
      approximate: boolean               # optional; display as c.
```
A list, not a single span. Blackletter forced this: one start/end cannot hold
origin + print era + multiple revivals.

### geography
```yaml
geography:
  origin_places: []    # place refs (prefer Getty TGN id / Wikidata QID) — SOURCED
  spread: []
```

### lineage
All values are term ids in this repo. Validator will fail on unresolved ids.
```yaml
lineage:
  parents: []          # broader term (mirrors Getty AAT hierarchy)
  influences: []       # harvested relations
  influenced: []
  reacted_against: []
  revival_of: []
```

### production (style/movement/aesthetic/letterform entries only)
```yaml
production:
  apparatus: []        # ids of apparatus entries
  techniques: []       # ids of technique entries
```
Reverse links (which styles use a given apparatus) are computed by the build
index, not stored.

### formal_properties (editorial judgment — flagged in provenance, never harvested)
```yaml
formal_properties:
  grid_discipline: strict | moderate | loose | broken | not-applicable
  palette_logic:
    descriptor: monochrome | restricted | primary | pastel | fluorescent | full-spectrum | other
    note: string | null
  contrast: low | medium | high
  texture: flat | subtle | pronounced
  hierarchy: strict | moderate | flat | chaotic
  ornament_level: none | minimal | moderate | high | maximal
```

### formal_consequences (apparatus/technique entries only)
Same vocabulary as formal_properties. Meaning: what the tool imposes on output.
This is how Risograph resolves — apparatus + formal consequence, not a style peer.

### ideological_stance (editorial)
```yaml
ideological_stance: strongly-rationalist | rationalist | mixed | expressive | strongly-expressive
```

### commercial_context
```yaml
commercial_context:
  contexts: []   # controlled vocab, extendable: advertising, corporate-identity,
                 # editorial, music-packaging, self-published, poster, signage,
                 # web-ui, fashion, architecture, product
```

### revival
```yaml
revival:
  status: original-run | continuous | dormant | revived | null
  revivals: []           # {period_label, note} — claims harvested or user-authored
```

### lifecycle
```yaml
lifecycle:
  state: emerging | peaking | saturated | residual | revived | historical | null
  first_observed: date | null    # required when state is emerging/peaking/saturated
  review_due: date | null        # required when state is emerging/peaking/saturated
```

### practitioners — SOURCED: harvest or recorded research
```yaml
practitioners:
  people: []     # {name, wikidata} with provenance entries
  studios: []
```

### images — all four rights fields required before any commit
```yaml
images:
  - file: path | null        # existing local file under assets/
    remote_image: URL | null  # restricted records hotlink; never a local copy
    review_status: pending | approved | rejected # only approved images render
    source_url: string       # REQUIRED
    license: string          # REQUIRED
    attribution: string      # REQUIRED
    rights_status: open | restricted | unknown   # REQUIRED
    caption: string | null
    depicts: string | null
```

## Practical visual guides

```yaml
guide:
  dek: string                # concise visual introduction
  signature: [string]       # at least three identifying qualities
  application: string       # practical design observations
  caution: string           # useful distinctions and limitations
  compare: [term-id]         # valid other entries, not historical lineage
featured_image: URL | null   # source_url of an approved image
works:                     # optional, factual references with provenance
  - title: string
    url: URL
    note: string
```

Guide content needs `source: editorial`, `reviewed: true|false` provenance.
Guide comparisons must resolve to another term. Published entries cannot
contain unreviewed editorial provenance. Image review is a separate relevance
check and does not establish publication rights.

## Provenance

A `provenance:` map at the bottom of each file. Key = dotted field path.
Content fields stay clean and human-editable; the map is machine-checkable.

```yaml
provenance:
  facets.era.periods:
    - source: getty-aat
      url: http://vocab.getty.edu/aat/...
      accessed: 2026-08-23
  facets.formal_properties:
    - source: editorial
      reviewed: false        # user flips to true after review
```

Validator rules (Phase 2):
- Every populated factual branch needs provenance at that branch or an ancestor. A source for practitioner people cannot cover unsourced studios.
- `source: editorial` is only legal on formal_properties, formal_consequences,
  ideological_stance, commercial_context, lifecycle.state, and guide.
- Dates, places, practitioner names, lineage relations, summaries, aliases and works need recorded sources. `research-note` identifies supplied research and requires its URL; it is not independently verified merely by ingestion.
- `status: stub` relaxes completeness checks but never the rights rules.

## TODO convention

Unknown factual value = `null` (or `[]`) plus an entry in the top-level `todo:`
list naming the field path. A blank is always better than a plausible guess.
