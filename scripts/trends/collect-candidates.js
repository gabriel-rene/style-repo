#!/usr/bin/env node
// Trend-candidate collector. Polls the sources in harvest/trend-sources.yaml
// (Are.na channels, Fonts in Use RSS) and appends NEW items to the triage
// queue at trends/queue.yaml.
//
// Policy — this script has no opinions:
// - It never creates a term, never edits content/, never publishes anything.
// - It only appends candidates with status: pending. The user triages by
//   editing status to dismissed or accepted:<term-id>.
// - Existing queue entries are never modified. A URL already in the queue
//   (any status, including dismissed) is never re-added.
//
// No response caching: trend feeds must be seen fresh each run.
//
// Usage: node --no-warnings scripts/trends/collect-candidates.js

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { parse, stringify } from 'yaml';

const SOURCES = 'harvest/trend-sources.yaml';
const QUEUE = 'trends/queue.yaml';
const UA = 'style-repo-harvester/0.1 (research tool; contact: repo owner)';
const today = new Date().toISOString().slice(0, 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const QUEUE_HEADER = `# Trend candidate triage queue — written by scripts/trends/collect-candidates.js.
#
# YOUR file to edit. For each candidate set status to one of:
#   pending              — not looked at yet (collector default)
#   dismissed            — not a style signal; stays here so it is never re-added
#   accepted:<term-id>   — evidence for a term; cite the queue entry's url in
#                          that term's research note or lifecycle provenance
#
# The collector only APPENDS new pending entries. It never edits or removes
# yours, and it never re-adds a url that is already listed.
`;

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'user-agent': UA }, redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// ---- Are.na: public channel contents API, no key needed ----
async function arenaCandidates(slug) {
  const body = await fetchText(`https://api.are.na/v2/channels/${encodeURIComponent(slug)}/contents?per=50&sort=position&direction=desc`);
  const { contents = [] } = JSON.parse(body);
  return contents.map((b) => ({
    url: b.source?.url ?? `https://www.are.na/block/${b.id}`,
    title: (b.title || b.generated_title || '(untitled block)').trim(),
    source: `arena:${slug}`,
    kind: b.class?.toLowerCase() ?? null,
    published_at: (b.connected_at ?? b.created_at ?? '').slice(0, 10) || null,
  }));
}

// ---- RSS: minimal <item> extraction, enough for Fonts in Use feeds ----
function rssCandidates(xml, feedUrl) {
  const unwrap = (s) => (s ?? '')
    .replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, '$1')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .trim();
  const tag = (item, name) => unwrap(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(item)?.[1]);
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  const label = `rss:${new URL(feedUrl).hostname}${new URL(feedUrl).pathname}`;
  return items.map((item) => {
    const d = tag(item, 'pubDate');
    return {
      url: tag(item, 'link'),
      title: tag(item, 'title') || '(untitled)',
      source: label,
      kind: 'rss-item',
      published_at: d ? new Date(d).toISOString().slice(0, 10) : null,
    };
  }).filter((c) => c.url);
}

// ---- main ----
const sources = parse(readFileSync(SOURCES, 'utf8'));
mkdirSync('trends', { recursive: true });
const queue = existsSync(QUEUE) ? (parse(readFileSync(QUEUE, 'utf8')) ?? {}) : {};
queue.candidates ??= [];
const seen = new Set(queue.candidates.map((c) => c.url));

const found = [];
for (const slug of sources.arena_channels ?? []) {
  try {
    found.push(...await arenaCandidates(slug));
    console.log(`arena:${slug} — ok`);
  } catch (e) {
    console.error(`arena:${slug} — FAILED: ${e.message} (skipped, queue untouched)`);
  }
  await sleep(1000);
}
for (const feed of sources.fontsinuse_feeds ?? []) {
  try {
    found.push(...rssCandidates(await fetchText(feed), feed));
    console.log(`${feed} — ok`);
  } catch (e) {
    console.error(`${feed} — FAILED: ${e.message} (skipped, queue untouched)`);
  }
  await sleep(1000);
}

let added = 0;
for (const c of found) {
  if (seen.has(c.url)) continue;
  seen.add(c.url);
  queue.candidates.push({ ...c, first_seen: today, status: 'pending' });
  added++;
}

writeFileSync(QUEUE, QUEUE_HEADER + '\n' + stringify({ candidates: queue.candidates }));
const pending = queue.candidates.filter((c) => c.status === 'pending').length;
console.log(`\ncollect: ${found.length} item(s) fetched, ${added} new → ${QUEUE} (${pending} pending total)`);
