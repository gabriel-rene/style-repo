// Apply harvested values into content YAML.
// Policy: FILL-ONLY. A harvester may fill a null/empty field and add
// provenance; it never overwrites non-empty data (user edits win).
// Every applied value gets a provenance entry with source + url + accessed.

import { readFileSync, writeFileSync } from 'node:fs';
import { parseDocument } from 'yaml';

const isEmpty = (v) =>
  v === null || v === undefined ||
  (Array.isArray(v) && v.length === 0) ||
  (typeof v === 'string' && v.trim() === '');

export class EntryUpdater {
  constructor(path) {
    this.path = path;
    // parseDocument preserves comments and formatting on save.
    this.docNode = parseDocument(readFileSync(path, 'utf8'));
    this.doc = this.docNode.toJS();
    this.applied = [];
    this.skipped = [];
  }

  // dotted path helpers over the plain-JS view
  get(dotted) {
    let n = this.doc;
    for (const p of dotted.split('.')) {
      if (n === null || typeof n !== 'object') return undefined;
      n = n[p];
    }
    return n;
  }

  // Fill a field if empty. Records provenance either way it applies.
  fill(dotted, value, prov) {
    if (isEmpty(value)) return false;
    const current = this.get(dotted);
    if (!isEmpty(current)) { this.skipped.push(dotted); return false; }
    const parts = dotted.split('.');
    this.docNode.setIn(parts, value);
    // Drop a stale "# TODO" comment that was attached to the old null value.
    const node = this.docNode.getIn(parts, true);
    if (node && node.comment) node.comment = null;
    this.addProvenance(dotted, prov);
    this.doc = this.docNode.toJS();
    this.applied.push(dotted);
    this._clearTodo(dotted);
    return true;
  }

  addProvenance(dotted, prov) {
    const provPath = ['provenance', dotted];
    const existing = this.docNode.getIn(provPath);
    const entry = { ...prov };
    if (existing === undefined) {
      this.docNode.setIn(provPath, [entry]);
    } else {
      const list = this.docNode.getIn(provPath).toJSON();
      // de-dup identical source+url
      if (!list.some((s) => s.source === entry.source && s.url === entry.url)) {
        this.docNode.addIn(provPath, entry);
      }
    }
  }

  _clearTodo(dotted) {
    // doc.set() may store a plain array, so normalize before filtering.
    const raw = this.docNode.get('todo');
    const list = raw?.toJSON ? raw.toJSON() : raw;
    if (!Array.isArray(list)) return;
    // Remove entries equal to or more specific than the filled path. A coarser
    // entry (e.g. `external_ids` when only .getty_aat was filled) stays —
    // other subfields may still be open.
    const keep = list.filter((t) => !(t === dotted || t.startsWith(dotted + '.')));
    this.docNode.set('todo', keep);
  }

  save() {
    if (this.applied.length === 0) return false;
    writeFileSync(this.path, this.docNode.toString());
    return true;
  }
}
