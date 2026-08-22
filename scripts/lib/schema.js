// Shared schema constants for validator and index builder.
// Mirrors schema/SCHEMA.md — change both together.

export const TERM_TYPES = [
  'movement',
  'style',
  'aesthetic',
  'apparatus',
  'technique',
  'letterform-tradition',
];

export const STATUSES = ['stub', 'draft', 'published'];

// term_types that describe how things are made, not how they look.
// They get formal_consequences; everything else gets formal_properties.
export const PRODUCTION_TYPES = ['apparatus', 'technique'];

export const ENUMS = {
  grid_discipline: ['strict', 'moderate', 'loose', 'broken', 'not-applicable'],
  palette_descriptor: [
    'monochrome', 'restricted', 'primary', 'pastel',
    'fluorescent', 'full-spectrum', 'other', 'not-applicable',
  ],
  contrast: ['low', 'medium', 'high', 'not-applicable'],
  texture: ['flat', 'subtle', 'pronounced', 'not-applicable'],
  hierarchy: ['strict', 'moderate', 'flat', 'chaotic', 'not-applicable'],
  ornament_level: ['none', 'minimal', 'moderate', 'high', 'maximal', 'not-applicable'],
  ideological_stance: [
    'strongly-rationalist', 'rationalist', 'mixed',
    'expressive', 'strongly-expressive',
  ],
  revival_status: ['original-run', 'continuous', 'dormant', 'revived'],
  lifecycle_state: [
    'emerging', 'peaking', 'saturated', 'residual',
    'revived', 'historical',
  ],
  rights_status: ['open', 'restricted', 'unknown'],
  period_role: ['origin', 'peak', 'revival', 'active'],
};

// Lifecycle states that demand active tracking dates.
export const TRACKED_LIFECYCLE_STATES = ['emerging', 'peaking', 'saturated'];

// Commercial contexts. Extendable: add here, note it in DECISIONS.md.
export const COMMERCIAL_CONTEXTS = [
  'advertising', 'corporate-identity', 'editorial', 'music-packaging',
  'self-published', 'poster', 'signage', 'web-ui', 'fashion',
  'architecture', 'product',
];

export const LINEAGE_KEYS = [
  'parents', 'influences', 'influenced', 'reacted_against', 'revival_of',
];

// Fields where `source: editorial` provenance is legal.
// Everything else factual must come from a harvested source with a URL.
export const EDITORIAL_OK_PREFIXES = [
  'facets.formal_properties',
  'facets.formal_consequences',
  'facets.ideological_stance',
  'facets.commercial_context',
  'facets.lifecycle.state',
];

// Fields that must NEVER be hand-authored: harvested source with URL only.
export const HARVEST_ONLY_PATHS = [
  'facets.era.periods',
  'facets.geography.origin_places',
  'facets.geography.spread',
  'facets.lineage',
  'facets.practitioners',
];
