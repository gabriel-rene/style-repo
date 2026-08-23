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

  // ---- batch 2: broader coverage across eras, types, and production ----
  { id: 'arts-and-crafts', type: 'movement', name: 'Arts and Crafts',
    formal: { grid_discipline: 'loose', palette_logic: { descriptor: 'restricted', note: 'earthy natural-dye tones; hand-drawn borders' }, contrast: 'medium', texture: 'pronounced', hierarchy: 'moderate', ornament_level: 'high' },
    stance: 'strongly-expressive', contexts: ['editorial', 'product', 'architecture'] },
  { id: 'vienna-secession', type: 'movement', name: 'Vienna Secession',
    formal: { grid_discipline: 'moderate', palette_logic: { descriptor: 'restricted', note: 'gold, black, white; geometric ornament frames' }, contrast: 'high', texture: 'subtle', hierarchy: 'moderate', ornament_level: 'high' },
    stance: 'mixed', contexts: ['poster', 'editorial', 'architecture'] },
  { id: 'futurism', type: 'movement', name: 'Futurism',
    formal: { grid_discipline: 'broken', palette_logic: { descriptor: 'restricted', note: 'dynamic diagonals; words-in-freedom typography' }, contrast: 'high', texture: 'subtle', hierarchy: 'chaotic', ornament_level: 'minimal' },
    stance: 'strongly-expressive', contexts: ['poster', 'editorial', 'self-published'] },
  { id: 'suprematism', type: 'movement', name: 'Suprematism',
    formal: { grid_discipline: 'loose', palette_logic: { descriptor: 'restricted', note: 'floating geometric planes; red-black-white dominance' }, contrast: 'high', texture: 'flat', hierarchy: 'flat', ornament_level: 'none' },
    stance: 'mixed', contexts: ['poster', 'editorial'] },
  { id: 'plakatstil', type: 'style', name: 'Plakatstil',
    formal: { grid_discipline: 'moderate', palette_logic: { descriptor: 'restricted', note: 'flat spot-color object on plain ground; product + name only' }, contrast: 'high', texture: 'flat', hierarchy: 'strict', ornament_level: 'minimal' },
    stance: 'rationalist', contexts: ['poster', 'advertising'] },
  { id: 'new-typography', type: 'movement', name: 'New Typography',
    formal: { grid_discipline: 'strict', palette_logic: { descriptor: 'restricted', note: 'black plus one accent (often red); asymmetric layouts' }, contrast: 'high', texture: 'flat', hierarchy: 'strict', ornament_level: 'none' },
    stance: 'strongly-rationalist', contexts: ['editorial', 'advertising', 'corporate-identity'] },
  { id: 'streamline-moderne', type: 'style', name: 'Streamline Moderne',
    formal: { grid_discipline: 'moderate', palette_logic: { descriptor: 'restricted', note: 'horizontal speed lines; rounded aerodynamic forms' }, contrast: 'medium', texture: 'subtle', hierarchy: 'moderate', ornament_level: 'minimal' },
    stance: 'mixed', contexts: ['product', 'architecture', 'advertising'] },
  { id: 'mid-century-modern', type: 'style', name: 'Mid-century modern',
    formal: { grid_discipline: 'moderate', palette_logic: { descriptor: 'restricted', note: 'muted primaries and mustard/teal secondaries; organic shapes' }, contrast: 'medium', texture: 'flat', hierarchy: 'moderate', ornament_level: 'minimal' },
    stance: 'rationalist', contexts: ['advertising', 'editorial', 'product', 'corporate-identity'] },
  { id: 'new-wave-typography', type: 'style', name: 'New Wave typography',
    formal: { grid_discipline: 'broken', palette_logic: { descriptor: 'restricted', note: 'letterspacing play; stair-step rules; grid subversion' }, contrast: 'high', texture: 'subtle', hierarchy: 'chaotic', ornament_level: 'minimal' },
    stance: 'expressive', contexts: ['poster', 'editorial'] },
  { id: 'punk-graphics', type: 'style', name: 'Punk graphics',
    formal: { grid_discipline: 'broken', palette_logic: { descriptor: 'restricted', note: 'photocopy black-and-white plus one shock color; ransom-note lettering' }, contrast: 'high', texture: 'pronounced', hierarchy: 'chaotic', ornament_level: 'minimal' },
    stance: 'strongly-expressive', contexts: ['music-packaging', 'poster', 'self-published'] },
  { id: 'grunge-typography', type: 'style', name: 'Grunge typography',
    formal: { grid_discipline: 'broken', palette_logic: { descriptor: 'restricted', note: 'dirty neutrals; distressed, overprinted layers' }, contrast: 'medium', texture: 'pronounced', hierarchy: 'chaotic', ornament_level: 'moderate' },
    stance: 'expressive', contexts: ['editorial', 'music-packaging', 'poster'] },
  { id: 'ukiyo-e', type: 'style', name: 'Ukiyo-e',
    formal: { grid_discipline: 'loose', palette_logic: { descriptor: 'restricted', note: 'flat woodblock pigment areas; bold contour lines' }, contrast: 'medium', texture: 'subtle', hierarchy: 'moderate', ornament_level: 'moderate' },
    stance: 'expressive', contexts: ['editorial', 'poster'] },
  { id: 'superflat', type: 'style', name: 'Superflat',
    formal: { grid_discipline: 'loose', palette_logic: { descriptor: 'full-spectrum', note: 'flat high-key brights; no modeling or shadow' }, contrast: 'high', texture: 'flat', hierarchy: 'flat', ornament_level: 'moderate' },
    stance: 'mixed', contexts: ['product', 'fashion', 'editorial'] },
  { id: 'minimalism', type: 'style', name: 'Minimalism',
    formal: { grid_discipline: 'strict', palette_logic: { descriptor: 'restricted', note: 'few colors; generous negative space' }, contrast: 'medium', texture: 'flat', hierarchy: 'strict', ornament_level: 'none' },
    stance: 'strongly-rationalist', contexts: ['corporate-identity', 'editorial', 'web-ui', 'product'] },
  { id: 'maximalism', type: 'style', name: 'Maximalism',
    formal: { grid_discipline: 'loose', palette_logic: { descriptor: 'full-spectrum', note: 'dense layering; pattern-on-pattern' }, contrast: 'high', texture: 'pronounced', hierarchy: 'chaotic', ornament_level: 'maximal' },
    stance: 'strongly-expressive', contexts: ['editorial', 'fashion', 'web-ui'] },
  { id: 'ligne-claire', type: 'style', name: 'Ligne claire',
    formal: { grid_discipline: 'moderate', palette_logic: { descriptor: 'restricted', note: 'uniform-weight black outline; flat unmodulated fills' }, contrast: 'medium', texture: 'flat', hierarchy: 'moderate', ornament_level: 'minimal' },
    stance: 'mixed', contexts: ['editorial', 'self-published', 'advertising'] },
  { id: 'flat-design', type: 'aesthetic', name: 'Flat design',
    formal: { grid_discipline: 'strict', palette_logic: { descriptor: 'restricted', note: 'solid fills; no gradients, bevels, or drop shadows' }, contrast: 'medium', texture: 'flat', hierarchy: 'strict', ornament_level: 'none' },
    stance: 'rationalist', contexts: ['web-ui', 'corporate-identity', 'product'], lifecycle: 'residual' },
  { id: 'skeuomorphism', type: 'aesthetic', name: 'Skeuomorphism',
    formal: { grid_discipline: 'moderate', palette_logic: { descriptor: 'full-spectrum', note: 'simulated materials: leather, glass, brushed metal' }, contrast: 'medium', texture: 'pronounced', hierarchy: 'moderate', ornament_level: 'high' },
    stance: 'mixed', contexts: ['web-ui', 'product'], lifecycle: 'residual' },
  { id: 'y2k-aesthetic', type: 'aesthetic', name: 'Y2K aesthetic',
    formal: { grid_discipline: 'loose', palette_logic: { descriptor: 'other', note: 'chrome and iridescent gradients; translucent plastics; blobs' }, contrast: 'high', texture: 'pronounced', hierarchy: 'moderate', ornament_level: 'high' },
    stance: 'expressive', contexts: ['fashion', 'music-packaging', 'web-ui'], lifecycle: 'revived' },
  { id: 'synthwave', type: 'aesthetic', name: 'Synthwave',
    formal: { grid_discipline: 'moderate', palette_logic: { descriptor: 'fluorescent', note: 'neon pink/purple on dark; horizon grids and sunsets' }, contrast: 'high', texture: 'subtle', hierarchy: 'moderate', ornament_level: 'moderate' },
    stance: 'expressive', contexts: ['music-packaging', 'poster', 'web-ui'], lifecycle: 'residual' },
  { id: 'cyberpunk-aesthetic', type: 'aesthetic', name: 'Cyberpunk aesthetic',
    formal: { grid_discipline: 'loose', palette_logic: { descriptor: 'fluorescent', note: 'neon signage colors on dark, dense urban layering' }, contrast: 'high', texture: 'pronounced', hierarchy: 'chaotic', ornament_level: 'moderate' },
    stance: 'expressive', contexts: ['music-packaging', 'poster', 'web-ui', 'fashion'] },
  { id: 'woodcut', type: 'technique', name: 'Woodcut',
    consequences: { grid_discipline: 'not-applicable', palette_logic: { descriptor: 'restricted', note: 'one block per color; carved white-line negative space' }, contrast: 'high', texture: 'pronounced', hierarchy: 'not-applicable', ornament_level: 'not-applicable' },
    contexts: ['editorial', 'poster', 'self-published'] },
  { id: 'linocut', type: 'technique', name: 'Linocut',
    consequences: { grid_discipline: 'not-applicable', palette_logic: { descriptor: 'restricted', note: 'bold gouged marks; flat inked areas' }, contrast: 'high', texture: 'pronounced', hierarchy: 'not-applicable', ornament_level: 'not-applicable' },
    contexts: ['poster', 'self-published', 'editorial'] },
  { id: 'lithography', type: 'technique', name: 'Lithography',
    consequences: { grid_discipline: 'not-applicable', palette_logic: { descriptor: 'other', note: 'continuous-tone crayon texture; multi-stone color printing' }, contrast: 'medium', texture: 'pronounced', hierarchy: 'not-applicable', ornament_level: 'not-applicable' },
    contexts: ['poster', 'advertising', 'editorial'] },
  { id: 'etching', type: 'technique', name: 'Etching',
    consequences: { grid_discipline: 'not-applicable', palette_logic: { descriptor: 'monochrome', note: 'fine incised line; aquatint tonal fields' }, contrast: 'medium', texture: 'pronounced', hierarchy: 'not-applicable', ornament_level: 'not-applicable' },
    contexts: ['editorial', 'self-published'] },
  { id: 'collage', type: 'technique', name: 'Collage',
    consequences: { grid_discipline: 'not-applicable', palette_logic: { descriptor: 'other', note: 'found-material palettes; visible cut edges and seams' }, contrast: 'high', texture: 'pronounced', hierarchy: 'not-applicable', ornament_level: 'not-applicable' },
    contexts: ['poster', 'editorial', 'music-packaging'] },
  { id: 'photomontage', type: 'technique', name: 'Photomontage',
    consequences: { grid_discipline: 'not-applicable', palette_logic: { descriptor: 'other', note: 'recombined photographic fragments; scale jumps' }, contrast: 'high', texture: 'subtle', hierarchy: 'not-applicable', ornament_level: 'not-applicable' },
    contexts: ['poster', 'editorial', 'advertising'] },
  { id: 'halftone', type: 'technique', name: 'Halftone',
    consequences: { grid_discipline: 'not-applicable', palette_logic: { descriptor: 'monochrome', note: 'continuous tone simulated by dot screens; visible rosettes' }, contrast: 'medium', texture: 'subtle', hierarchy: 'not-applicable', ornament_level: 'not-applicable' },
    contexts: ['editorial', 'advertising', 'poster'] },
  { id: 'cyanotype', type: 'technique', name: 'Cyanotype',
    consequences: { grid_discipline: 'not-applicable', palette_logic: { descriptor: 'monochrome', note: 'Prussian-blue photogram; white silhouettes' }, contrast: 'medium', texture: 'subtle', hierarchy: 'not-applicable', ornament_level: 'not-applicable' },
    contexts: ['self-published', 'editorial'] },
  { id: 'airbrush', type: 'apparatus', name: 'Airbrush',
    consequences: { grid_discipline: 'not-applicable', palette_logic: { descriptor: 'full-spectrum', note: 'smooth sprayed gradients; soft masked edges' }, contrast: 'medium', texture: 'subtle', hierarchy: 'not-applicable', ornament_level: 'not-applicable' },
    contexts: ['advertising', 'music-packaging', 'poster'] },
  { id: 'photocopier', type: 'apparatus', name: 'Photocopier',
    consequences: { grid_discipline: 'not-applicable', palette_logic: { descriptor: 'monochrome', note: 'high-contrast toner; degradation across copy generations' }, contrast: 'high', texture: 'pronounced', hierarchy: 'not-applicable', ornament_level: 'not-applicable' },
    contexts: ['self-published', 'poster', 'music-packaging'] },
  { id: 'pen-plotter', type: 'apparatus', name: 'Pen plotter',
    consequences: { grid_discipline: 'not-applicable', palette_logic: { descriptor: 'restricted', note: 'single-pen line strokes; hatching instead of fills' }, contrast: 'medium', texture: 'subtle', hierarchy: 'not-applicable', ornament_level: 'not-applicable' },
    contexts: ['poster', 'self-published'] },
  { id: 'copperplate-script', type: 'letterform-tradition', name: 'Copperplate script',
    formal: { grid_discipline: 'not-applicable', palette_logic: { descriptor: 'monochrome', note: 'letterform tradition; palette varies by use' }, contrast: 'high', texture: 'subtle', hierarchy: 'not-applicable', ornament_level: 'high' },
    stance: null, contexts: [] },
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
