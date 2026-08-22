// Cached HTTP fetch for harvesters. Every response lands in /cache keyed by
// a hash of method+url+body, so reruns never re-hit APIs unless --refresh.
// Cache is gitignored and disposable.

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const CACHE_DIR = 'cache';
const REFRESH = process.argv.includes('--refresh');
const UA = 'style-repo-harvester/0.1 (research tool; contact: repo owner)';

export async function cachedFetch(url, { headers = {}, accept, label } = {}) {
  const key = createHash('sha256').update(url).digest('hex').slice(0, 24);
  mkdirSync(CACHE_DIR, { recursive: true });
  const bodyPath = join(CACHE_DIR, `${key}.body`);
  const metaPath = join(CACHE_DIR, `${key}.meta.json`);

  if (!REFRESH && existsSync(bodyPath) && existsSync(metaPath)) {
    const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
    return { ...meta, body: readFileSync(bodyPath, 'utf8'), cached: true };
  }

  const res = await fetch(url, {
    headers: { 'user-agent': UA, ...(accept ? { accept } : {}), ...headers },
    redirect: 'follow',
  });
  const body = await res.text();
  const meta = {
    url, status: res.status, ok: res.ok,
    contentType: res.headers.get('content-type'),
    fetched: new Date().toISOString().slice(0, 10),
    label: label ?? null,
  };
  // Cache successes and 404s (a recorded "not found" is a result); not 5xx.
  if (res.ok || res.status === 404) {
    writeFileSync(bodyPath, body);
    writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  }
  return { ...meta, body, cached: false };
}

export async function cachedJson(url, opts = {}) {
  const r = await cachedFetch(url, { accept: 'application/json', ...opts });
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return { data: JSON.parse(r.body), fetched: r.fetched, cached: r.cached };
}

// Binary download (images) → save to destPath, cache-aware via a marker meta.
export async function cachedDownload(url, destPath) {
  const key = createHash('sha256').update('bin:' + url).digest('hex').slice(0, 24);
  mkdirSync(CACHE_DIR, { recursive: true });
  const metaPath = join(CACHE_DIR, `${key}.meta.json`);
  if (!REFRESH && existsSync(metaPath) && existsSync(destPath)) {
    return { cached: true, destPath };
  }
  const res = await fetch(url, { headers: { 'user-agent': UA }, redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  mkdirSync(join(destPath, '..'), { recursive: true });
  writeFileSync(destPath, buf);
  writeFileSync(metaPath, JSON.stringify({ url, destPath, fetched: new Date().toISOString().slice(0, 10) }));
  return { cached: false, destPath, bytes: buf.length };
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}
