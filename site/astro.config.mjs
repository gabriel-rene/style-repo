import { defineConfig } from 'astro/config';

// Static output only — v1 has no server, no LLM, nothing dynamic.
export default defineConfig({
  output: 'static',
});
