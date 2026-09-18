#!/usr/bin/env node
/**
 * Triage — SPEC R14, R15, R16, F9, A5, A6.
 *
 * Classification selects the enforcement instrument, so getting the type wrong
 * is a correctness failure, not a cosmetic one (R14). The rules below decide
 * the clear cases deterministically; genuinely ambiguous ones are HELD for a
 * human rather than guessed, because counterfeit goods and an unauthorised
 * reseller need legally different remedies — IP versus contract (F9).
 */
import { readFileSync } from 'node:fs';
import { filterAllowlisted, domainMatches, normalizeName, normalizeHandle } from './suppress.mjs';

export const TYPES = [
  'counterfeit-goods',
  'unauthorized-reseller',
  'content-theft',
  'domain-impersonation',
  'ad-creative-theft',
  'social-impersonation',
];

export const HELD = 'held-for-classification';

const isAllowlistedSeller = (hit, allow) =>
  (allow?.authorized_resellers ?? []).some((s) => normalizeName(s) === normalizeName(hit.seller));

const isLookalikeDomain = (hit, allow) => {
  const owned = allow?.owned_domains ?? [];
  if (!hit.domain || owned.length === 0) return false;
  if (owned.some((d) => domainMatches(hit.domain, d))) return false;  // it IS ours
  const host = String(hit.domain).toLowerCase();
  return owned.some((d) => {
    const stem = String(d).toLowerCase().split('.')[0];
    return stem.length >= 4 && host.includes(stem);
  });
};

/**
 * @returns {{type:string, confidence:'high'|'medium'|'low', reasons:string[], needsHuman?:boolean}}
 */
export function classify(hit, fingerprint = {}, allow = {}) {
  const reasons = [];
  const product = (fingerprint.products ?? []).find((p) => p.sku === hit.sku);
  const belowFloor = product?.priceFloor != null && hit.price != null && hit.price < product.priceFloor;
  if (belowFloor) reasons.push(`priced ${hit.price} against a floor of ${product.priceFloor}`);

  const allowlisted = isAllowlistedSeller(hit, allow);
  if (allowlisted) reasons.push('seller is on the authorized-reseller allowlist');

  const lookalike = isLookalikeDomain(hit, allow);
  if (lookalike) reasons.push(`domain "${hit.domain}" imitates an owned domain`);

  if (hit.kind === 'ad-creative' || hit.adLibraryMatch) {
    reasons.push('our creative found under another advertiser in a public ad library');
    return { type: 'ad-creative-theft', confidence: 'high', reasons };
  }

  if (hit.kind === 'social' || hit.handle) {
    const ours = (allow?.owned_handles ?? []).some((h) => normalizeHandle(h) === normalizeHandle(hit.handle));
    if (ours) return { type: HELD, confidence: 'low', reasons: ['handle is ours — should have been suppressed'], needsHuman: true };
    reasons.push(`handle "${hit.handle}" imitates the brand`);
    return { type: 'social-impersonation', confidence: 'high', reasons };
  }

  // An allowlisted seller below floor is a contract problem (MAP), never an IP one.
  if (allowlisted) {
    return belowFloor
      ? { type: 'unauthorized-reseller', confidence: 'high', reasons: [...reasons, 'authorized seller breaking price floor — contract remedy, not IP'] }
      : { type: HELD, confidence: 'low', reasons: [...reasons, 'authorized seller, nothing wrong detected'], needsHuman: true };
  }

  if (lookalike && hit.sku) {
    return { type: 'domain-impersonation', confidence: 'high', reasons };
  }

  if (hit.imageMatch && !hit.sku) {
    reasons.push('our product photography reused');
    return { type: 'content-theft', confidence: 'high', reasons };
  }

  if (belowFloor && hit.sku) {
    return { type: 'counterfeit-goods', confidence: 'high', reasons };
  }

  // F9: selling our SKU at a plausible price, seller unknown. Counterfeit or
  // grey-market reseller? The remedies differ legally. Do not guess.
  if (hit.sku) {
    return {
      type: HELD,
      confidence: 'low',
      needsHuman: true,
      reasons: [...reasons, 'sells our SKU at a plausible price and the seller is unknown — counterfeit and unauthorised reseller need different remedies, so this is held for you to classify'],
    };
  }

  return { type: HELD, confidence: 'low', needsHuman: true, reasons: ['not enough signal to classify'] };
}

/**
 * Four factors CEASE can actually measure (R15). Customer harm is a multiplier,
 * not an addend: a hit with a real burned customer attached outranks a bigger
 * hit with none.
 */
export function score(hit, ctx = {}) {
  const f = { trafficProximity: 0, revenueAtRisk: 0, persistence: 0, customerHarm: 1 };

  if (hit.domain && ctx.lookalike) f.trafficProximity += 18;
  if (hit.brandedTermRank != null && hit.brandedTermRank <= 10) f.trafficProximity += 25 - hit.brandedTermRank;
  f.trafficProximity = Math.min(25, f.trafficProximity);

  const unitLoss = Math.max(0, (ctx.listPrice ?? 0) - (hit.price ?? 0));
  const velocity = hit.observedSales ?? hit.reviewCount ?? 1;
  f.revenueAtRisk = Math.min(25, Math.round(Math.log10(1 + unitLoss * velocity) * 10));

  const priors = ctx.priorCases ?? 0;
  f.persistence = Math.min(25, priors * 8);

  const harmLinks = (hit.linkedHarm ?? []).length;
  f.customerHarm = harmLinks > 0 ? Math.min(2, 1 + harmLinks * 0.5) : 1;

  const base = f.trafficProximity + f.revenueAtRisk + f.persistence;
  const severity = Math.min(100, Math.round(base * f.customerHarm));
  return { severity, factors: f, band: severity >= 70 ? 'critical' : severity >= 45 ? 'high' : severity >= 20 ? 'medium' : 'low' };
}

/**
 * Build the ranked docket (R16). A sweep that emits every hit has failed this
 * requirement: suppressed and unclassifiable hits are carried OUT of the docket
 * but retained, so the reduction is explainable rather than invisible.
 */
export function buildDocket(hits, { fingerprint = {}, allow = {}, priorCases = {} } = {}) {
  const { kept, suppressed } = filterAllowlisted(hits, {
    owned_domains: allow.owned_domains ?? [],
    owned_handles: allow.owned_handles ?? [],
    sellers: [],   // reseller status is a CLASSIFICATION here, not a suppression
  });

  const triaged = kept.map((hit) => {
    const c = classify(hit, fingerprint, allow);
    const product = (fingerprint.products ?? []).find((p) => p.sku === hit.sku);
    const s = score(hit, {
      listPrice: product?.price,
      lookalike: isLookalikeDomain(hit, allow),
      priorCases: priorCases[normalizeName(hit.seller)] ?? 0,
    });
    return { ...hit, classification: c, ...s };
  });

  const docket = triaged.filter((t) => !t.classification.needsHuman)
    .sort((a, b) => b.severity - a.severity);
  const held = triaged.filter((t) => t.classification.needsHuman);

  return {
    docket,
    held,
    suppressed,
    reduction: {
      raw: hits.length,
      docket: docket.length,
      suppressedCount: suppressed.length,
      heldCount: held.length,
      explanation: `${hits.length} raw hits -> ${docket.length} on the docket: ` +
        `${suppressed.length} suppressed as yours or authorized, ${held.length} held for you to classify.`,
    },
  };
}

// --- CLI ---
if (process.argv[1]?.endsWith('triage.mjs')) {
  const [hitsPath, fpPath] = process.argv.slice(2);
  if (!hitsPath) { console.error('usage: triage.mjs <hits.json> [fingerprint.json]'); process.exit(2); }
  const hits = JSON.parse(readFileSync(hitsPath, 'utf8'));
  const fp = fpPath ? JSON.parse(readFileSync(fpPath, 'utf8')) : {};
  console.log(JSON.stringify(buildDocket(Array.isArray(hits) ? hits : hits.hits, { fingerprint: fp, allow: fp.allowlist ?? {} }), null, 2));
}
