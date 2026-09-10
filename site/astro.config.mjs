import { defineConfig } from 'astro/config';

// Static output only — v1 has no server, no LLM, nothing dynamic.
export default defineConfig({
  // GitHub Pages serves project sites from /<repository-name>/.
  // Astro rewrites internal links and built asset URLs against this base.
  base: process.env.GITHUB_ACTIONS ? '/style-repo/' : '/',
  output: 'static',
});
