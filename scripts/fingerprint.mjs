#!/usr/bin/env node
/**
 * Brand fingerprint — SPEC R1, R2, R3, A1.
 *
 * The thing every detector compares against: distinctive copy phrases, a price
 * floor per SKU, image hashes, and the authorized-reseller allowlist that stops
 * real partners being flagged (R3 feeds scripts/suppress.mjs).
 *
 * Copy n-grams are the cheapest detector that exists: counterfeiters copy-paste
 * product descriptions, and an exact-phrase search finds them for one query.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { read } from './sources.mjs';

/** Words too common to make a phrase distinctive. */
const STOPWORDS = new Set(('a an the and or but of for with without in on at to from by is are was were be been ' +
  'this that these those it its as into over under our your their his her we you they i more most very ' +
  'new best top great quality premium free shipping sale off buy shop now item items product products').split(' '));

export function tokenize(text) {
  return String(text ?? '').toLowerCase().replace(/<[^>]+>/g, ' ').replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/).filter(Boolean);
}

/** Contiguous word runs of length n. */
export function shingles(tokens, n) {
  const out = [];
  for (let i = 0; i + n <= tokens.length; i++) out.push(tokens.slice(i, i + n).join(' '));
  return out;
}

/**
 * Pick the phrases most worth searching for: long enough to be unique, and
 * carrying enough rare words that a generic marketing sentence loses out.
 */
export function distinctivePhrases(description, { n = 5, limit = 6, corpusFreq = null } = {}) {
  const tokens = tokenize(description);
  if (tokens.length < n) return tokens.length ? [tokens.join(' ')] : [];
  const scored = shingles(tokens, n).map((phrase) => {
    const words = phrase.split(' ');
    const contentWords = words.filter((w) => !STOPWORDS.has(w) && w.length > 2);
    // Rarer across the catalog = more distinctive.
    const rarity = corpusFreq
      ? contentWords.reduce((acc, w) => acc + 1 / (1 + (corpusFreq.get(w) ?? 0)), 0)
      : contentWords.length;
    return { phrase, score: contentWords.length * 2 + rarity, contentWords: contentWords.length };
  });
  const chosen = [];
  for (const s of scored.sort((a, b) => b.score - a.score)) {
    if (s.contentWords < 2) continue;
    // Avoid near-duplicates that overlap heavily with one already chosen.
    if (chosen.some((c) => overlap(c, s.phrase) > 0.6)) continue;
    chosen.push(s.phrase);
    if (chosen.length >= limit) break;
  }
  return chosen;
}

function overlap(a, b) {
  const A = new Set(a.split(' ')), B = new Set(b.split(' '));
  const inter = [...A].filter((x) => B.has(x)).length;
  return inter / Math.max(A.size, B.size);
}

export function corpusFrequencies(products) {
  const freq = new Map();
  for (const p of products) for (const w of new Set(tokenize(p.description))) freq.set(w, (freq.get(w) ?? 0) + 1);
  return freq;
}

/** Anything below this is presumptively counterfeit (SPEC R1). */
export function priceFloor(price, ratio = 0.6) {
  if (price == null || Number.isNaN(Number(price))) return null;
  return Math.round(Number(price) * ratio * 100) / 100;
}

/**
 * Exact-byte hash of a product image.
 *
 * DEFERRED: perceptual hashing (pHash), which would survive resizing and
 * re-encoding. It needs an image decoder, and plugin dependencies install with
 * --ignore-scripts under a 60s cap, so a native decoder may simply fail to
 * build (claude-plugin pack). Exact-byte hashing still catches the common case
 * — a counterfeiter re-uploading the original file untouched. The limit is
 * stated in the README rather than papered over.
 */
export async function hashImage(url, { fetchImpl = fetch, timeoutMs = 8000 } = {}) {
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeoutMs);
    const res = await fetchImpl(url, { signal: ac.signal });
    clearTimeout(t);
    if (!res.ok) return { url, sha256: null, reason: `fetch returned ${res.status}` };
    const buf = Buffer.from(await res.arrayBuffer());
    return { url, sha256: createHash('sha256').update(buf).digest('hex'), bytes: buf.length };
  } catch (e) {
    return { url, sha256: null, reason: `unreachable: ${e.name === 'AbortError' ? 'timed out' : e.message}` };
  }
}

export async function buildFingerprint(products, opts = {}) {
  const {
    brand = 'unknown', floorRatio = 0.6, config = {}, hashImages = false, fetchImpl = fetch,
  } = opts;
  const freq = corpusFrequencies(products);

  const entries = [];
  for (const p of products) {
    const images = [];
    if (hashImages) for (const url of p.imageUrls ?? []) images.push(await hashImage(url, { fetchImpl }));
    else for (const url of p.imageUrls ?? []) images.push({ url, sha256: null, reason: 'image hashing not requested' });
    entries.push({
      sku: p.sku,
      title: p.title,
      phrases: distinctivePhrases(p.description, { corpusFreq: freq }),
      price: p.price,
      currency: p.currency,
      priceFloor: priceFloor(p.price, floorRatio),
      images,
    });
  }

  const csv = (v) => String(v ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return {
    generatedAt: new Date().toISOString(),
    brand,
    floorRatio,
    products: entries,
    allowlist: {
      owned_domains: csv(config.owned_domains),
      owned_handles: csv(config.owned_handles),
      authorized_resellers: csv(config.authorized_resellers),
    },
    trademarks: config.trademarks ?? [],
    perceptualHashing: 'deferred — exact-byte image hashing only; see README limits',
  };
}

// --- CLI: node scripts/fingerprint.mjs [out.json] [--hash-images] ---
if (process.argv[1]?.endsWith('fingerprint.mjs')) {
  const args = process.argv.slice(2);
  const out = args.find((a) => !a.startsWith('--')) ?? 'fingerprint.json';
  const source = read('catalog');
  if (source.mode === 'live') {
    console.log(JSON.stringify(source, null, 2));
    process.exit(0);
  }
  const fp = await buildFingerprint(source.rows, {
    brand: process.env.CLAUDE_PLUGIN_OPTION_BRAND_NAME ?? 'unknown',
    hashImages: args.includes('--hash-images'),
    config: {
      owned_domains: process.env.CLAUDE_PLUGIN_OPTION_OWNED_DOMAINS,
      owned_handles: process.env.CLAUDE_PLUGIN_OPTION_OWNED_HANDLES,
      authorized_resellers: process.env.CLAUDE_PLUGIN_OPTION_AUTHORIZED_RESELLERS,
    },
  });
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(fp, null, 2));
  console.log(`fingerprint: ${fp.products.length} products, ${fp.products.reduce((a, p) => a + p.phrases.length, 0)} phrases -> ${out}`);
}
