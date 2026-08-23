// Shared image blocklist: harvest/image-blocklist.yaml is a YAML list of
// source URLs that must never be harvested (curation decisions, not facts).
import { readFileSync, existsSync } from 'node:fs';
import { parse } from 'yaml';

export function loadBlocklist() {
  if (!existsSync('harvest/image-blocklist.yaml')) return new Set();
  const list = parse(readFileSync('harvest/image-blocklist.yaml', 'utf8')) ?? [];
  return new Set(list);
}
