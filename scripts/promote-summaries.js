#!/usr/bin/env node
// Promote research-note summaries from content/drafts/<id>.yaml overlays into
// content/<id>.yaml, but only where the content summary is still empty.
// Carries the research-note provenance across and clears the "summary" TODO.
// Overlays with nothing left besides the promoted summary are deleted; the
// original note stays in research/processed/.
//
// Edits are text-level so each content file keeps its hand-written layout.
//
// Usage: node --no-warnings scripts/promote-summaries.js [--dry-run]
import { readFileSync, writeFileSync, readdirSync, existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { parse, stringify } from "yaml";

const DRAFTS = "content/drafts";
const DRY = process.argv.includes("--dry-run");
if (!existsSync(DRAFTS)) { console.log("no drafts — nothing to do"); process.exit(0); }

const isFlow = (src) => src.trimStart().startsWith("{");

function promoteBlock(src, summary, prov) {
  const block = stringify({ summary }, { lineWidth: 80 }).trimEnd();
  let out = src.replace(/^summary: null.*$/m, () => block);
  if (out === src) throw new Error("no `summary: null` line");
  // Drop the "summary" item from the top-level todo list.
  out = out.replace(/(^todo:\n(?:  - .*\n)*?)  - summary\n/m, "$1");
  const provBlock = stringify({ summary: [prov] }).trimEnd().replace(/^/gm, "  ");
  if (!/^provenance:$/m.test(out)) throw new Error("no provenance block");
  return out.replace(/^provenance:$/m, `provenance:\n${provBlock}`);
}

function promoteFlow(src, summary, prov) {
  let out = src.replace(/"summary": null,/, `"summary": ${JSON.stringify(summary)},`);
  if (out === src) throw new Error('no `"summary": null,` entry');
  out = out.replace(/("todo":\s*\[[^\]]*?)"summary",?\s*/, "$1");
  const m = /"provenance":\s*\{/.exec(out);
  if (!m) throw new Error("no provenance map");
  const at = m.index + m[0].length;
  return out.slice(0, at) + `\n      summary: [${JSON.stringify(prov)}],` + out.slice(at);
}

let promoted = 0, skipped = 0;
for (const f of readdirSync(DRAFTS).filter((f) => f.endsWith(".yaml"))) {
  const draftPath = join(DRAFTS, f);
  const contentPath = join("content", f);
  const draft = parse(readFileSync(draftPath, "utf8"));
  const summary = draft.summary;
  const prov = draft.provenance?.summary?.find((p) => p.source === "research-note");
  if (typeof summary !== "string" || !prov || !existsSync(contentPath)) { skipped++; continue; }
  const src = readFileSync(contentPath, "utf8");
  if (typeof parse(src).summary === "string") {
    console.log(`SKIP ${f}: content already has a summary (ingest logs any clash to CONFLICTS.md)`);
    skipped++;
    continue;
  }
  const out = isFlow(src) ? promoteFlow(src, summary, prov) : promoteBlock(src, summary, prov);
  if (parse(out).summary !== summary) throw new Error(`${f}: promoted summary does not round-trip`);

  // Only delete the overlay when it holds nothing else of value.
  const otherFacts = Object.keys(draft.provenance ?? {}).filter((k) => k !== "summary");
  if (!DRY) {
    writeFileSync(contentPath, out);
    if (!otherFacts.length) unlinkSync(draftPath);
  }
  console.log(`${f}: summary promoted${otherFacts.length ? ` (overlay kept: ${otherFacts.join(", ")})` : ""}`);
  promoted++;
}
console.log(`\npromote-summaries: ${promoted} promoted, ${skipped} skipped${DRY ? " (dry run)" : ""}`);
