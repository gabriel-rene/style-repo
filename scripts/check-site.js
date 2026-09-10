#!/usr/bin/env node
// Verify generated routes, local resources and fragments without external requests.
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
const root = resolve("site/dist");
const files = [];
function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".html")) files.push(p);
  }
}
walk(root);
const problems = [];
for (const file of files) {
  const html = readFileSync(file, "utf8");
  if (!/<h1[\s>]/.test(html)) problems.push(`${file}: missing h1`);
  for (const [, raw] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const value = raw.replaceAll("&amp;", "&");
    if (!value.startsWith("/") && !value.startsWith("#")) continue;
    const u = new URL(
      value,
      "https://local.test" + file.slice(root.length).replace(/index.html$/, ""),
    );
    let path = join(root, decodeURIComponent(u.pathname));
    if (existsSync(path) && statSync(path).isDirectory())
      path = join(path, "index.html");
    if (!existsSync(path)) {
      problems.push(`${file}: missing ${value}`);
      continue;
    }
    if (u.hash && path.endsWith(".html")) {
      const target = readFileSync(path, "utf8");
      if (!target.includes(`id="${decodeURIComponent(u.hash.slice(1))}"`))
        problems.push(`${file}: missing fragment ${value}`);
    }
  }
}
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(
  `check-site: OK — ${files.length} pages; local links, images and fragments resolve.`,
);
