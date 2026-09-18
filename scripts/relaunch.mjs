#!/usr/bin/env node
/**
 * Relaunch detection — SPEC R32, R33, A14.
 *
 * Takedowns without follow-through are whack-a-mole. The same operation comes
 * back under a new domain within days, and the tells are the things they cannot
 * cheaply change: the copy they pasted, the images they stole, the seller
 * identity, and the registrant or nameservers they reuse.
 */
import { readFileSync } from 'node:fs';
import { normalizeName, normalizeHandle, normalizeDomain } from './suppress.mjs';

/** Weighted because the signals differ in how hard they are to change. */
export const SIGNALS = {
  copyPhrase:   { weight: 35, label: 'identical product copy' },
  imageHash:    { weight: 30, label: 'identical product image' },
  seller:       { weight: 20, label: 'same seller identity' },
  registrant:   { weight: 25, label: 'same domain registrant' },
  nameservers:  { weight: 15, label: 'same nameservers' },
  priceExact:   { weight: 5,  label: 'identical price point' },
};

const shared = (a = [], b = [], norm = (x) => String(x).toLowerCase().trim()) => {
  const B = new Set(b.map(norm));
  return a.map(norm).filter((x) => B.has(x));
};

/**
 * @returns {{score:number, confidence:string, reasons:string[], parentCase:string|null}}
 */
export function matchRelaunch(hit, closedCase) {
  const reasons = [];
  let score = 0;

  // Same domain isn't a relaunch — it's the original never having gone.
  if (hit.domain && closedCase.subject?.domain &&
      normalizeDomain(hit.domain) === normalizeDomain(closedCase.subject.domain)) {
    return { score: 0, confidence: 'none', reasons: ['same domain as the closed case — this is a failed takedown, not a relaunch'], parentCase: null, notARelaunch: true };
  }

  const phrases = shared(hit.matchedPhrases, closedCase.matchedPhrases);
  if (phrases.length) { score += SIGNALS.copyPhrase.weight; reasons.push(`${SIGNALS.copyPhrase.label}: "${phrases[0]}"`); }

  const images = shared(hit.imageHashes, closedCase.imageHashes);
  if (images.length) { score += SIGNALS.imageHash.weight; reasons.push(SIGNALS.imageHash.label); }

  if (hit.seller && closedCase.subject?.seller &&
      normalizeName(hit.seller) === normalizeName(closedCase.subject.seller)) {
    score += SIGNALS.seller.weight; reasons.push(`${SIGNALS.seller.label}: ${hit.seller}`);
  }

  if (hit.registrantEmail && closedCase.registrantEmail &&
      String(hit.registrantEmail).toLowerCase() === String(closedCase.registrantEmail).toLowerCase()) {
    score += SIGNALS.registrant.weight; reasons.push(SIGNALS.registrant.label);
  }

  const ns = shared(hit.nameservers, closedCase.nameservers);
  if (ns.length >= 2) { score += SIGNALS.nameservers.weight; reasons.push(SIGNALS.nameservers.label); }

  if (hit.price != null && closedCase.price != null && Number(hit.price) === Number(closedCase.price)) {
    score += SIGNALS.priceExact.weight; reasons.push(SIGNALS.priceExact.label);
  }

  score = Math.min(100, score);
  return {
    score,
    confidence: score >= 55 ? 'high' : score >= 30 ? 'medium' : score > 0 ? 'low' : 'none',
    reasons,
    parentCase: score >= 30 ? closedCase.caseId : null,
  };
}

/** Best match across all closed cases still inside the watch window. */
export function findRelaunch(hit, closedCases, { windowDays = 90, now = new Date() } = {}) {
  const inWindow = closedCases.filter((c) => {
    if (!c.closedAt) return true;
    return (now - new Date(c.closedAt)) / 86400000 <= windowDays;
  });
  let best = null;
  for (const c of inWindow) {
    const m = matchRelaunch(hit, c);
    if (m.notARelaunch) continue;
    if (!best || m.score > best.score) best = { ...m, closedCase: c.caseId };
  }
  return best && best.score >= 30 ? best : null;
}

/** A seller hit repeatedly becomes an escalation case (R33). */
export function repeatOffenders(cases) {
  const byseller = new Map();
  for (const c of cases) {
    const s = normalizeName(c.subject?.seller);
    if (!s) continue;
    if (!byseller.has(s)) byseller.set(s, { seller: c.subject.seller, cases: [], domains: new Set() });
    const rec = byseller.get(s);
    rec.cases.push(c.caseId);
    if (c.subject?.domain) rec.domains.add(normalizeDomain(c.subject.domain));
  }
  return [...byseller.values()]
    .map((r) => ({ ...r, domains: [...r.domains], count: r.cases.length }))
    .filter((r) => r.count >= 2)
    .sort((a, b) => b.count - a.count);
}

// --- CLI ---
if (process.argv[1]?.endsWith('relaunch.mjs')) {
  const [hitsPath, casesPath] = process.argv.slice(2);
  if (!hitsPath || !casesPath) { console.error('usage: relaunch.mjs <hits.json> <closed-cases.json>'); process.exit(2); }
  const hits = JSON.parse(readFileSync(hitsPath, 'utf8'));
  const cases = JSON.parse(readFileSync(casesPath, 'utf8'));
  const out = hits.map((h) => ({ hit: h.id ?? h.url, relaunch: findRelaunch(h, cases) })).filter((r) => r.relaunch);
  console.log(JSON.stringify({ relaunches: out, repeatOffenders: repeatOffenders(cases) }, null, 2));
}
