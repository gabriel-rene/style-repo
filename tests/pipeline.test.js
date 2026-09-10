import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  rmSync,
  readdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { stringify, parse } from "yaml";
const fixture = () => ({
  id: "example",
  term_type: "movement",
  status: "stub",
  names: { primary: "Example" },
  facets: {},
});
function runFixture(fn) {
  const dir = mkdtempSync(join(tmpdir(), "style-repo-test-"));
  try {
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
const run = (script, ...args) =>
  spawnSync(process.execPath, [resolve(script), ...args], { encoding: "utf8" });
test("remote images survive SQLite indexing", () =>
  runFixture((dir) => {
    const doc = fixture();
    doc.images = [
      {
        remote_image: "https://example.com/image.jpg",
        source_url: "https://example.com/work",
        license: "Restricted",
        attribution: "Example museum",
        rights_status: "restricted",
      },
    ];
    writeFileSync(join(dir, "example.yaml"), stringify(doc));
    const path = join(dir, "output.db");
    const result = run("scripts/build-index.js", dir, path);
    assert.equal(result.status, 0, result.stderr);
    const db = new DatabaseSync(path);
    const row = db.prepare("SELECT * FROM images").get();
    assert.equal(row.file, null);
    assert.equal(row.remote_image, doc.images[0].remote_image);
    db.close();
  }));
test("failed indexing preserves the last usable database", () =>
  runFixture((dir) => {
    writeFileSync(join(dir, "example.yaml"), stringify(fixture()));
    const path = join(dir, "output.db");
    assert.equal(run("scripts/build-index.js", dir, path).status, 0);
    const before = readFileSync(path);
    const invalid = fixture();
    invalid.term_type = null;
    writeFileSync(join(dir, "example.yaml"), stringify(invalid));
    assert.notEqual(run("scripts/build-index.js", dir, path).status, 0);
    assert.deepEqual(readFileSync(path), before);
    assert.equal(
      readdirSync(dir).some((f) => f.includes(".tmp")),
      false,
    );
  }));
test("a source on people cannot cover unsourced studios", () =>
  runFixture((dir) => {
    const doc = fixture();
    doc.facets.practitioners = {
      people: [{ name: "Person" }],
      studios: [{ name: "Studio" }],
    };
    doc.provenance = {
      "facets.practitioners.people": [
        { source: "research-note", url: "https://example.com" },
      ],
    };
    writeFileSync(join(dir, "example.yaml"), stringify(doc));
    const result = run("scripts/validate.js", dir);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /practitioners.studios/);
    doc.provenance["facets.practitioners"] = [
      { source: "research-note", url: "https://example.com" },
    ];
    writeFileSync(join(dir, "example.yaml"), stringify(doc));
    assert.equal(run("scripts/validate.js", dir).status, 0);
  }));
test("missing local image and unapproved featured image are rejected", () =>
  runFixture((dir) => {
    const doc = fixture();
    doc.images = [
      {
        file: "assets/does-not-exist.jpg",
        source_url: "https://example.com",
        license: "CC0",
        attribution: "Example",
        rights_status: "open",
        review_status: "pending",
      },
    ];
    doc.featured_image = "https://example.com";
    writeFileSync(join(dir, "example.yaml"), stringify(doc));
    const result = run("scripts/validate.js", dir);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /existing file/);
    assert.match(result.stderr, /approved image/);
  }));

test("all reference guides are complete and comparisons resolve", () => {
  const terms = readdirSync("content")
    .filter((f) => f.endsWith(".yaml"))
    .map((f) => parse(readFileSync(join("content", f), "utf8")));
  const ids = new Set(terms.map((t) => t.id));
  for (const t of terms) {
    assert.ok(t.guide?.dek?.length > 30, `${t.id}: missing description`);
    assert.ok(t.guide.signature.length >= 3, `${t.id}: missing signature`);
    assert.ok(
      t.guide.application && t.guide.caution,
      `${t.id}: missing practical guidance`,
    );
    for (const id of t.guide.compare)
      assert.ok(ids.has(id), `${t.id}: invalid comparison ${id}`);
  }
});
