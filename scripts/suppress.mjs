#!/usr/bin/env node
/**
 * Allowlist suppression — SPEC R12, A2.
 *
 * "Suppress any hit whose seller, domain, or handle appears on the allowlist,
 *  at every stage, before it reaches a human."
 *
 * This runs on the path, before docket assembly. It is a script and not a
 * paragraph in a SKILL.md because a prompt reminder is not enforcement
 * (security.md rule 2), and because the loudest complaint about automated brand
 * protection is false positives against real distributors.
 */
import { readFileSync } from 'node:fs';

/** example.com -> example.com ; https://WWW.Example.com/x -> example.com */
export function normalizeDomain(input) {
  if (!input) return '';
  let s = String(input).trim().toLowerCase();
  s = s.replace(/^[a-z]+:\/\//, '').replace(/^www\./, '');
  s = s.split('/')[0].split('?')[0].split('#')[0].split(':')[0];
  return s;
}

/** @example '@Example_Store' -> 'examplestore' */
export function normalizeHandle(input) {
  if (!input) return '';
  return String(input).trim().toLowerCase().replace(/^@/, '').replace(/[._\-\s]/g, '');
}

export function normalizeName(input) {
  if (!input) return '';
  return String(input).trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.,]/g, '');
}

/**
 * True when `host` is the allowed domain or a subdomain of it.
 * Deliberately NOT a substring test: "example.com.evil.com" must not match
 * "example.com" — that is the classic lookalike a naive check waves through.
 */
export function domainMatches(host, allowed) {
  const h = normalizeDomain(host);
  const a = normalizeDomain(allowed);
  if (!h || !a) return false;
  return h === a || h.endsWith('.' + a);
}

export function buildAllowlist(raw = {}) {
  const list = (v) => (Array.isArray(v) ? v : String(v ?? '').split(',')).map((x) => String(x).trim()).filter(Boolean);
  return {
    domains: [...list(raw.owned_domains), ...list(raw.domains)].map(normalizeDomain).filter(Boolean),
    handles: [...list(raw.owned_handles), ...list(raw.handles)].map(normalizeHandle).filter(Boolean),
    sellers: [...list(raw.authorized_resellers), ...list(raw.sellers)].map(normalizeName).filter(Boolean),
  };
}

/**
 * @returns {{reason:string, matched:string}|null} why this hit is allowlisted
 */
export function allowlistReason(hit, allowlist) {
  for (const field of ['domain', 'url', 'storefront', 'host']) {
    const v = hit?.[field];
    if (!v) continue;
    const match = allowlist.domains.find((d) => domainMatches(v, d));
    if (match) return { reason: 'owned or authorized domain', matched: match };
  }
  for (const field of ['handle', 'account', 'username']) {
    const v = hit?.[field];
    if (!v) continue;
    const n = normalizeHandle(v);
    const match = allowlist.handles.find((h) => h === n);
    if (match) return { reason: 'owned social handle', matched: match };
  }
  for (const field of ['seller', 'sellerName', 'merchant']) {
    const v = hit?.[field];
    if (!v) continue;
    const n = normalizeName(v);
    const match = allowlist.sellers.find((s) => s === n);
    if (match) return { reason: 'authorized reseller', matched: match };
  }
  return null;
}

/**
 * Split hits into what reaches the docket and what was suppressed.
 * Suppressed hits are RETAINED with their reason — silently dropping them would
 * make a false suppression impossible to debug (leverage.md: gaps are visible
 * rows, never silent holes).
 */
export function filterAllowlisted(hits, allowlistRaw) {
  const allowlist = buildAllowlist(allowlistRaw);
  const kept = [];
  const suppressed = [];
  for (const hit of hits ?? []) {
    const r = allowlistReason(hit, allowlist);
    if (r) suppressed.push({ ...hit, suppressed: true, suppressionReason: r.reason, suppressionMatch: r.matched });
    else kept.push(hit);
  }
  return { kept, suppressed };
}

// --- CLI: node scripts/suppress.mjs <hits.json> <allowlist.json> ---
if (process.argv[1]?.endsWith('suppress.mjs')) {
  const [hitsPath, allowPath] = process.argv.slice(2);
  if (!hitsPath || !allowPath) {
    console.error('usage: suppress.mjs <hits.json> <allowlist.json>');
    process.exit(2);
  }
  const hits = JSON.parse(readFileSync(hitsPath, 'utf8'));
  const allow = JSON.parse(readFileSync(allowPath, 'utf8'));
  const out = filterAllowlisted(Array.isArray(hits) ? hits : hits.hits, allow);
  console.log(JSON.stringify(out, null, 2));
}
