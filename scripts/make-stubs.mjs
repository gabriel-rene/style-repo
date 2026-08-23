#!/usr/bin/env node
// One-off stub generator. Facts stay null/[] with TODO markers;
// only editorial formal blocks are filled, flagged unreviewed.
import { writeFileSync, existsSync } from 'node:fs';
import { stringify } from 'yaml';

const TERMS = [
  { id: 'art-nouveau', type: 'style', name: 'Art Nouveau',
    formal: { grid_discipline: 'loose', palette_logic: { descriptor: 'restricted', note: 'organic secondary tones; muted naturals' }, contrast: 'medium', texture: 'pronounced', hierarchy: 'moderate', ornament_level: 'maximal' },
    stance: 'strongly-expressive', contexts: ['poster', 'advertising', 'architecture', 'editorial'] },
  { id: 'de-stijl', type: 'movement', name: 'De Stijl',
    formal: { grid_discipline: 'strict', palette_logic: { descriptor: 'primary', note: 'primaries plus black and white only' }, contrast: 'high', texture: 'flat', hierarchy: 'strict', ornament_level: 'none' },
    stance: 'strongly-rationalist', contexts: ['architecture', 'product', 'editorial'] },
  { id: 'dada', type: 'movement', name: 'Dada',
    formal: { grid_discipline: 'broken', palette_logic: { descriptor: 'other', note: 'found-material collage; newsprint tones' }, contrast: 'high', texture: 'pronounced', hierarchy: 'chaotic', ornament_level: 'moderate' },
    stance: 'strongly-expressive', contexts: ['poster', 'editorial', 'self-published'] },
  { id: 'constructivism', type: 'movement', name: 'Constructivism',
    formal: { grid_discipline: 'moderate', palette_logic: { descriptor: 'restricted', note: 'red, black, and white dominance; diagonal composition' }, contrast: 'high', texture: 'flat', hierarchy: 'strict', ornament_level: 'minimal' },
    stance: 'strongly-rationalist', contexts: ['poster', 'advertising', 'editorial'] },
  { id: 'pop-art', type: 'style', name: 'Pop art',
    formal: { grid_discipline: 'moderate', palette_logic: { descriptor: 'primary', note: 'flat commercial process colors; benday dots' }, contrast: 'high', texture: 'flat', hierarchy: 'moderate', ornament_level: 'moderate' },
    stance: 'expressive', contexts: ['advertising', 'editorial', 'music-packaging'] },
  { id: 'op-art', type: 'style', name: 'Op art',
    formal: { grid_discipline: 'strict', palette_logic: { descriptor: 'monochrome', note: 'high-frequency black/white; some chromatic pairs' }, contrast: 'high', texture: 'pronounced', hierarchy: 'flat', ornament_level: 'minimal' },
    stance: 'mixed', contexts: ['poster', 'fashion', 'editorial'] },
  { id: 'psychedelic-art', type: 'style', name: 'Psychedelic art',
    formal: { grid_discipline: 'broken', palette_logic: { descriptor: 'fluorescent', note: 'vibrating complementary pairs; melted letterforms' }, contrast: 'high', texture: 'pronounced', hierarchy: 'chaotic', ornament_level: 'maximal' },
    stance: 'strongly-expressive', contexts: ['poster', 'music-packaging'] },
  { id: 'surrealism', type: 'movement', name: 'Surrealism',
    formal: { grid_discipline: 'loose', palette_logic: { descriptor: 'full-spectrum', note: null }, contrast: 'medium', texture: 'pronounced', hierarchy: 'moderate', ornament_level: 'moderate' },
    stance: 'strongly-expressive', contexts: ['editorial', 'advertising', 'poster'] },
  { id: 'corporate-memphis', type: 'aesthetic', name: 'Corporate Memphis',
    formal: { grid_discipline: 'moderate', palette_logic: { descriptor: 'pastel', note: 'flat corporate brights; oversized limbs' }, contrast: 'medium', texture: 'flat', hierarchy: 'moderate', ornament_level: 'minimal' },
    stance: 'mixed', contexts: ['web-ui', 'corporate-identity', 'advertising'], lifecycle: 'saturated' },
  { id: 'glitch-art', type: 'aesthetic', name: 'Glitch art',
    formal: { grid_discipline: 'broken', palette_logic: { descriptor: 'fluorescent', note: 'RGB channel-split artifacts; databend noise' }, contrast: 'high', texture: 'pronounced', hierarchy: 'chaotic', ornament_level: 'moderate' },
    stance: 'expressive', contexts: ['music-packaging', 'web-ui', 'poster'], lifecycle: 'residual' },
  { id: 'pixel-art', type: 'style', name: 'Pixel art',
    formal: { grid_discipline: 'strict', palette_logic: { descriptor: 'restricted', note: 'hardware-limited palettes' }, contrast: 'high', texture: 'subtle', hierarchy: 'moderate', ornament_level: 'minimal' },
    stance: 'mixed', contexts: ['web-ui', 'product', 'self-published'] },
  { id: 'letterpress', type: 'technique', name: 'Letterpress',
    consequences: { grid_discipline: 'not-applicable', palette_logic: { descriptor: 'restricted', note: 'one ink per pass; spot colors; physical impression' }, contrast: 'medium', texture: 'pronounced', hierarchy: 'not-applicable', ornament_level: 'not-applicable' },
    contexts: ['editorial', 'poster', 'self-published'] },
  { id: 'screen-printing', type: 'technique', name: 'Screen printing',
    consequences: { grid_discipline: 'not-applicable', palette_logic: { descriptor: 'restricted', note: 'flat opaque spot-color layers' }, contrast: 'high', texture: 'flat', hierarchy: 'not-applicable', ornament_level: 'not-applicable' },
    contexts: ['poster', 'music-packaging', 'fashion', 'self-published'] },
];

for (const t of TERMS) {
  const path = `content/${t.id}.yaml`;
  if (existsSync(path)) { console.log(`skip ${t.id} (exists)`); continue; }
  const isProduction = t.type === 'technique' || t.type === 'apparatus';

  const facets = {
    era: { periods: [] },
    geography: { origin_places: [], spread: [] },
    lineage: { parents: [], influences: [], influenced: [], reacted_against: [], revival_of: [] },
  };
  if (!isProduction) facets.production = { apparatus: [], techniques: [] };
  if (isProduction) facets.formal_consequences = t.consequences;
  else facets.formal_properties = t.formal;
  if (!isProduction) facets.ideological_stance = t.stance;
  facets.commercial_context = { contexts: t.contexts };
  facets.revival = { status: null, revivals: [] };
  facets.lifecycle = { state: t.lifecycle ?? null, first_observed: null, review_due: null };
  facets.practitioners = { people: [], studios: [] };

  const todo = [
    'names.variants', 'summary', 'external_ids', 'facets.era.periods',
    'facets.geography', 'facets.lineage',
    ...(t.type === 'aesthetic' ? ['facets.lifecycle.first_observed', 'facets.lifecycle.review_due'] : ['facets.lifecycle']),
    'facets.practitioners', 'images',
  ];

  const provenance = {};
  provenance[isProduction ? 'facets.formal_consequences' : 'facets.formal_properties'] =
    [{ source: 'editorial', reviewed: false }];
  if (!isProduction) provenance['facets.ideological_stance'] = [{ source: 'editorial', reviewed: false }];
  provenance['facets.commercial_context'] = [{ source: 'editorial', reviewed: false }];
  if (t.lifecycle) provenance['facets.lifecycle.state'] = [{ source: 'editorial', reviewed: false }];

  const doc = {
    id: t.id,
    term_type: t.type,
    status: 'stub',
    names: { primary: t.name, variants: [] },
    summary: null,
    external_ids: { getty_aat: null, wikidata: null },
    facets,
    images: [],
    todo,
    provenance,
  };
  writeFileSync(path, stringify(doc));
  console.log(`wrote ${path}`);
}
