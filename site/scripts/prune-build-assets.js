// Keep the complete harvest in the repository, but publish only curated assets.
import { readdirSync, lstatSync, unlinkSync, rmdirSync } from "node:fs";
import { resolve, relative, join } from "node:path";
import { loadAll, displayImages } from "../src/lib/data.js";

const root = resolve("dist");
const keep = new Set(
  loadAll().terms.flatMap((term) =>
    displayImages(term)
      .map((image) => image.file)
      .filter(Boolean),
  ),
);
let removed = 0;
function prune(directory) {
  if (lstatSync(directory).isSymbolicLink())
    throw new Error("Refusing to prune a symlink: " + directory);
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink())
      throw new Error("Refusing to prune a symlink: " + path);
    if (entry.isDirectory()) {
      prune(path);
      if (!readdirSync(path).length) rmdirSync(path);
    } else if (!keep.has(relative(root, path))) {
      unlinkSync(path);
      removed++;
    }
  }
}
prune(join(root, "assets"));
console.log(
  `Curated assets: ${keep.size} retained; ${removed} unselected files excluded from the build.`,
);
