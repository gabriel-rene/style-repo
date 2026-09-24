#!/usr/bin/env node
// Local image review queue. Shows pending images one at a time and writes
// review_status (and optionally featured_image) back to content/*.yaml.
// Edits are line-level so the rest of each YAML file keeps its formatting.
//
//   node --no-warnings scripts/review-images.js   → http://localhost:4330
import { createServer } from "node:http";
import { readdirSync, readFileSync, writeFileSync, existsSync, createReadStream } from "node:fs";
import { join, resolve, extname } from "node:path";
import { parse } from "yaml";

const PORT = Number(process.env.PORT) || 4330;
const ROOT = resolve(".");
const CONTENT = join(ROOT, "content");
const TYPES = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml", ".tif": "image/tiff", ".tiff": "image/tiff" };

function loadQueue() {
  const terms = [];
  for (const f of readdirSync(CONTENT).filter((f) => f.endsWith(".yaml")).sort()) {
    const t = parse(readFileSync(join(CONTENT, f), "utf8"));
    const images = t.images ?? [];
    const pending = images.filter((i) => (i.review_status ?? "pending") === "pending");
    if (!pending.length) continue;
    terms.push({
      id: t.id ?? f.replace(/\.yaml$/, ""),
      file: f,
      name: t.names?.primary ?? f,
      type: t.term_type ?? "",
      dek: t.guide?.dek ?? "",
      signature: t.guide?.signature ?? [],
      approved: images.filter((i) => i.review_status === "approved").length,
      featured: t.featured_image ?? null,
      pending: pending.map((i) => ({
        source_url: i.source_url,
        src: i.remote_image ?? (i.file ? "/" + i.file : null),
        caption: i.caption ?? "",
        license: i.license ?? "",
        attribution: i.attribution ?? "",
        rights: i.rights_status ?? "",
      })),
    });
  }
  // Terms without any approved image first: they need a cover most.
  return terms.sort((a, b) => (a.approved > 0) - (b.approved > 0) || a.name.localeCompare(b.name));
}

function valueOf(line, key) {
  const m = line.match(new RegExp(`^\\s*(?:- )?${key}:\\s*(.*)$`));
  return m ? parse(m[1]) : undefined;
}

function decide(file, sourceUrl, status, featured) {
  const path = join(CONTENT, file);
  if (!path.startsWith(CONTENT) || !existsSync(path)) throw new Error("unknown file");
  const lines = readFileSync(path, "utf8").split("\n");
  const start = lines.findIndex((l) => valueOf(l, "source_url") === sourceUrl && /^\s+(- )?source_url:/.test(l));
  if (start < 0) throw new Error("image not found");
  const indent = lines[start].match(/^\s*/)[0].length + (lines[start].trimStart().startsWith("- ") ? 2 : 0);
  let i = start + 1;
  for (; i < lines.length; i++) {
    const l = lines[i];
    const ind = l.match(/^\s*/)[0].length;
    if (l.trim() && (ind < indent || (ind === indent - 2 && l.trimStart().startsWith("- ")))) { i = -1; break; }
    if (ind === indent && /^\s*review_status:/.test(l)) break;
  }
  if (i < 0 || i >= lines.length) throw new Error("review_status not found");
  lines[i] = `${" ".repeat(indent)}review_status: ${status}`;
  if (featured) {
    const fi = lines.findIndex((l) => /^featured_image:/.test(l));
    if (fi >= 0) lines[fi] = `featured_image: ${sourceUrl}`;
    else lines.splice(lines.at(-1) === "" ? lines.length - 1 : lines.length, 0, `featured_image: ${sourceUrl}`);
  }
  writeFileSync(path, lines.join("\n"));
}

const PAGE = readFileSync(new URL("./review-images.html", import.meta.url), "utf8");

createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  try {
    if (req.method === "GET" && url.pathname === "/") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(PAGE);
    } else if (req.method === "GET" && url.pathname === "/api/queue") {
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(loadQueue()));
    } else if (req.method === "GET" && url.pathname.startsWith("/assets/")) {
      const p = resolve(ROOT, "." + decodeURIComponent(url.pathname));
      if (!p.startsWith(join(ROOT, "assets")) || !existsSync(p)) return res.writeHead(404).end();
      res.writeHead(200, { "content-type": TYPES[extname(p).toLowerCase()] ?? "application/octet-stream" });
      createReadStream(p).pipe(res);
    } else if (req.method === "POST" && url.pathname === "/api/decide") {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        try {
          const { file, source_url, status, featured } = JSON.parse(body);
          if (!["approved", "rejected", "pending"].includes(status)) throw new Error("bad status");
          decide(file, source_url, status, featured && status === "approved");
          res.writeHead(200).end("ok");
        } catch (e) {
          res.writeHead(400).end(String(e.message));
        }
      });
    } else res.writeHead(404).end();
  } catch (e) {
    res.writeHead(500).end(String(e.message));
  }
}).listen(PORT, "127.0.0.1", () => console.log(`review-images: http://localhost:${PORT}`));
