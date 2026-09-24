#!/usr/bin/env node
// Local review queue for the three hand-review jobs that are not images:
//   ids     — harvest/mappings.yaml entries with accept: null
//   drafts  — unreviewed editorial fields in draft entries, and publishing
//   trends  — trends/queue.yaml candidates with status: pending
// Every choice is written to the YAML file at once.
//
//   node --no-warnings scripts/review-queue.js   → http://localhost:4331
import { createServer } from "node:http";
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse, parseDocument } from "yaml";

const PORT = Number(process.env.PORT) || 4331;
const ROOT = resolve(".");
const CONTENT = join(ROOT, "content");
const MAPPINGS = join(ROOT, "harvest/mappings.yaml");
const TRENDS = join(ROOT, "trends/queue.yaml");
const VOCABS = { getty_aat: "Getty AAT", wikidata: "Wikidata" };

const readYaml = (p) => parse(readFileSync(p, "utf8"));
const contentFiles = () => readdirSync(CONTENT).filter((f) => f.endsWith(".yaml")).sort();
const at = (obj, dotted) => dotted.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);

// mappings.yaml and queue.yaml round-trip exactly through the yaml Document API.
function editDoc(path, fn) {
  const doc = parseDocument(readFileSync(path, "utf8"));
  fn(doc);
  writeFileSync(path, doc.toString());
}

// ---- ids ----
function idsQueue() {
  const m = readYaml(MAPPINGS);
  const names = new Map(contentFiles().map((f) => {
    const t = readYaml(join(CONTENT, f));
    return [t.id, { name: t.names?.primary, type: t.term_type, dek: t.guide?.dek ?? "", summary: t.summary ?? "" }];
  }));
  const out = [];
  for (const [id, row] of Object.entries(m)) {
    for (const vocab of Object.keys(VOCABS)) {
      const v = row[vocab];
      if (!v || v.accept !== null) continue;
      out.push({ id, vocab, vocabName: VOCABS[vocab], method: v.method, error: v.error ?? null,
        candidates: v.candidates ?? [], term: names.get(id) ?? { name: row.name } });
    }
  }
  return out;
}

function decideId({ id, vocab, accept }) {
  if (!(vocab in VOCABS)) throw new Error("bad vocab");
  if (accept !== false && accept !== null && typeof accept !== "string") throw new Error("bad accept");
  editDoc(MAPPINGS, (doc) => {
    if (!doc.hasIn([id, vocab])) throw new Error("unknown mapping");
    if (typeof accept === "string" && !(doc.getIn([id, vocab, "candidates"])?.toJSON() ?? []).some((c) => c.id === accept))
      throw new Error("not a candidate");
    doc.setIn([id, vocab, "accept"], accept);
  });
}

// ---- drafts ----

function draftsQueue() {
  const out = [];
  for (const f of contentFiles()) {
    const t = readYaml(join(CONTENT, f));
    if (t.status !== "draft") continue;
    const fields = [];
    for (const [path, sources] of Object.entries(t.provenance ?? {}))
      if ((sources ?? []).some((s) => s?.source === "editorial" && s.reviewed !== true))
        fields.push({ path, value: at(t, path) ?? null });
    const blockers = [];
    if (fields.length) blockers.push(`${fields.length} editorial field(s) not reviewed`);
    if (typeof t.summary !== "string") blockers.push("no sourced summary");
    out.push({ file: f, id: t.id, name: t.names?.primary, type: t.term_type, summary: t.summary ?? null,
      todo: t.todo ?? [], fields, blockers });
  }
  // Closest to publishable first.
  return out.sort((a, b) => a.blockers.length - b.blockers.length || a.fields.length - b.fields.length || a.name.localeCompare(b.name));
}

function contentPath(file) {
  const p = join(CONTENT, file);
  if (!p.startsWith(CONTENT + "/") || !existsSync(p)) throw new Error("unknown file");
  return p;
}

// Content files mix block and flow style with hand-wrapped lines, so they do
// not round-trip through the yaml printer. Swap only the scalar's source text.
function replaceScalar(p, find, text) {
  const src = readFileSync(p, "utf8");
  const node = find(parseDocument(src));
  if (!node?.range) throw new Error("field not found");
  const old = src.slice(node.range[0], node.range[1]);
  // Keep the original quoting style.
  const q = /^["']/.test(old) ? old[0] : "";
  writeFileSync(p, src.slice(0, node.range[0]) + q + text + q + src.slice(node.range[1]));
}

function markReviewed(file, path) {
  replaceScalar(contentPath(file), (doc) => {
    const item = doc.getIn(["provenance", path])?.items?.find((s) => s.get("source") === "editorial" && s.get("reviewed") !== true);
    return item?.get("reviewed", true);
  }, "true");
}

function publish(file) {
  const d = draftsQueue().find((x) => x.file === file);
  if (!d) throw new Error("not a draft");
  if (d.blockers.length) throw new Error("cannot publish: " + d.blockers.join("; "));
  replaceScalar(contentPath(file), (doc) => doc.get("status", true), "published");
}

// ---- trends ----
function trendsQueue() {
  const q = readYaml(TRENDS);
  const terms = contentFiles().map((f) => {
    const t = readYaml(join(CONTENT, f));
    return { id: t.id, name: t.names?.primary };
  }).sort((a, b) => a.name.localeCompare(b.name));
  const items = (q.candidates ?? []).map((c, index) => ({ ...c, index })).filter((c) => c.status === "pending");
  return { items, terms };
}

function decideTrend({ url, status }) {
  const ids = new Set(contentFiles().map((f) => readYaml(join(CONTENT, f)).id));
  if (status !== "dismissed" && status !== "pending" && !(status.startsWith("accepted:") && ids.has(status.slice(9))))
    throw new Error("bad status");
  editDoc(TRENDS, (doc) => {
    const item = doc.get("candidates").items.find((c) => c.get("url") === url);
    if (!item) throw new Error("unknown candidate");
    item.set("status", status);
  });
}

// ---- server ----
const PAGE = readFileSync(new URL("./review-queue.html", import.meta.url), "utf8");
const json = (res, data) => res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(data));

createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (req.method === "GET") {
    try {
      if (url.pathname === "/") return res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(PAGE);
      if (url.pathname === "/api/ids") return json(res, idsQueue());
      if (url.pathname === "/api/drafts") return json(res, draftsQueue());
      if (url.pathname === "/api/trends") return json(res, trendsQueue());
    } catch (e) {
      return res.writeHead(500).end(String(e.message));
    }
    return res.writeHead(404).end();
  }
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    try {
      const b = JSON.parse(body || "{}");
      if (url.pathname === "/api/ids") decideId(b);
      else if (url.pathname === "/api/drafts/review") markReviewed(b.file, b.path);
      else if (url.pathname === "/api/drafts/publish") publish(b.file);
      else if (url.pathname === "/api/trends") decideTrend(b);
      else return res.writeHead(404).end();
      res.writeHead(200).end("ok");
    } catch (e) {
      res.writeHead(400).end(String(e.message));
    }
  });
}).listen(PORT, "127.0.0.1", () => console.log(`review-queue: http://localhost:${PORT}`));
