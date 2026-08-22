// Load and parse all content YAML files.
import { readdirSync, readFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { parse } from 'yaml';

export function loadContentDir(dir) {
  const entries = [];
  const errors = [];
  let files = [];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));
  } catch {
    return { entries, errors: [`content directory not found: ${dir}`] };
  }
  for (const file of files.sort()) {
    const path = join(dir, file);
    let doc;
    try {
      doc = parse(readFileSync(path, 'utf8'));
    } catch (e) {
      errors.push(`${file}: YAML parse error — ${e.message.split('\n')[0]}`);
      continue;
    }
    if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) {
      errors.push(`${file}: top level must be a mapping`);
      continue;
    }
    const stem = basename(file).replace(/\.ya?ml$/, '');
    entries.push({ file, path, stem, doc });
  }
  return { entries, errors };
}
