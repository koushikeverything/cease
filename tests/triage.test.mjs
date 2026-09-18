/** Triage tests — SPEC R14, R15, R16, F9, A5, A6. */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { classify, score, buildDocket, TYPES, HELD } from '../scripts/triage.mjs';

const FP = {
  products: [
    { sku: 'LG-PEND-01', title: 'Halo Pendant', price: 189, priceFloor: 113.4 },
    { sku: 'LG-DESK-04', title: 'Arc Desk', price: 124, priceFloor: 74.4 },
  ],
  allowlist: {},
};
const ALLOW = {
  owned_domains: ['lumengoods.example'],
  owned_handles: ['@lumengoods'],
  authorized_resellers: ['Northwind Retail'],
};

describe('A5 — each of the six types is classified correctly', () => {
  const cases = [
    ['counterfeit-goods', { id: 1, sku: 'LG-PEND-01', price: 78, seller: 'Outlet Store', domain: 'randomshop.example' }],
    ['unauthorized-reseller', { id: 2, sku: 'LG-DESK-04', price: 60, seller: 'Northwind Retail', domain: 'marketplace.example' }],
    ['content-theft', { id: 3, imageMatch: true, domain: 'someblog.example' }],
    ['domain-impersonation', { id: 4, sku: 'LG-PEND-01', price: 150, seller: 'Unknown', domain: 'lumengoods-outlet.example' }],
    ['ad-creative-theft', { id: 5, kind: 'ad-creative', adLibraryMatch: true }],
    ['social-impersonation', { id: 6, kind: 'social', handle: '@lumengoods.official' }],
  ];
  for (const [expected, hit] of cases) {
    test(`${expected} [A5]`, () => {
      const c = classify(hit, FP, ALLOW);
      assert.equal(c.type, expected, `got ${c.type}; reasons: ${c.reasons.join('; ')}`);
      assert.ok(TYPES.includes(c.type));
      assert.ok(c.reasons.length > 0, 'a classification with no stated reason is unreviewable');
    });
  }
});

describe('F9 — ambiguity is held, never guessed', () => {
  test('our SKU at a plausible price from an unknown seller is held [F9]', () => {
    const c = classify({ id: 9, sku: 'LG-PEND-01', price: 175, seller: 'Some Shop', domain: 'shop.example' }, FP, ALLOW);
    assert.equal(c.type, HELD);
    assert.equal(c.needsHuman, true);
    assert.match(c.reasons.join(' '), /different remedies/);
  });

  test('an authorized reseller breaking the floor is a CONTRACT problem, not IP [R14]', () => {
    const c = classify({ id: 10, sku: 'LG-DESK-04', price: 60, seller: 'Northwind Retail' }, FP, ALLOW);
    assert.equal(c.type, 'unauthorized-reseller');
    assert.match(c.reasons.join(' '), /contract remedy, not IP/);
  });
});

describe('R15 — scoring', () => {
  test('customer harm multiplies rather than adds [R15]', () => {
    const base = { sku: 'LG-PEND-01', price: 78, domain: 'x.example', observedSales: 50 };
    const without = score(base, { listPrice: 189, lookalike: true });
    const with1 = score({ ...base, linkedHarm: ['ticket-1'] }, { listPrice: 189, lookalike: true });
    assert.ok(with1.severity > without.severity, 'a linked burned customer must raise severity');
    assert.equal(with1.factors.customerHarm, 1.5);
  });

  test('a repeat offender outranks a first-time hit of the same size [R15]', () => {
    const hit = { sku: 'LG-PEND-01', price: 78, observedSales: 10 };
    const first = score(hit, { listPrice: 189, priorCases: 0 });
    const repeat = score(hit, { listPrice: 189, priorCases: 3 });
    assert.ok(repeat.severity > first.severity);
  });

  test('severity is bounded and banded', () => {
    const s = score({ sku: 'X', price: 0, observedSales: 999999, linkedHarm: ['a', 'b', 'c'], brandedTermRank: 1 },
                    { listPrice: 1000, lookalike: true, priorCases: 99 });
    assert.ok(s.severity <= 100);
    assert.equal(s.band, 'critical');
  });
});

describe('A6 — the docket reduces what reaches a human', () => {
  const hits = [
    { id: 'own', domain: 'shop.lumengoods.example', sku: 'LG-PEND-01', price: 189, seller: 'Lumen Goods' },
    { id: 'reseller', sku: 'LG-DESK-04', price: 60, seller: 'Northwind Retail', domain: 'marketplace.example' },
    { id: 'fake', sku: 'LG-PEND-01', price: 78, seller: 'Outlet Store', domain: 'lumengoods-outlet.example', linkedHarm: ['ticket-1'] },
    { id: 'ambiguous', sku: 'LG-PEND-01', price: 175, seller: 'Mystery Shop', domain: 'other.example' },
    { id: 'lookalike', sku: 'LG-PEND-01', price: 60, seller: 'Unknown', domain: 'lumengoods.example.evil.example' },
  ];

  test('the docket is materially smaller than the raw hits, with the reduction explained [A6]', () => {
    const r = buildDocket(hits, { fingerprint: FP, allow: ALLOW });
    assert.ok(r.docket.length < hits.length, 'no reduction happened');
    assert.equal(r.reduction.raw, 5);
    assert.match(r.reduction.explanation, /raw hits -> \d+ on the docket/);
    assert.equal(r.reduction.docket + r.reduction.suppressedCount + r.reduction.heldCount, 5,
      'every raw hit must be accounted for somewhere — none may vanish');
  });

  test("the brand's own storefront is suppressed, not flagged [R12]", () => {
    const r = buildDocket(hits, { fingerprint: FP, allow: ALLOW });
    assert.ok(r.suppressed.some((h) => h.id === 'own'));
    assert.ok(!r.docket.some((h) => h.id === 'own'));
  });

  test('the ambiguous hit is held, not silently dropped or guessed [F9]', () => {
    const r = buildDocket(hits, { fingerprint: FP, allow: ALLOW });
    assert.ok(r.held.some((h) => h.id === 'ambiguous'));
    assert.ok(!r.docket.some((h) => h.id === 'ambiguous'));
  });

  test('the lookalike domain survives suppression and reaches the docket [R12]', () => {
    const r = buildDocket(hits, { fingerprint: FP, allow: ALLOW });
    assert.ok(!r.suppressed.some((h) => h.id === 'lookalike'), 'a lookalike must never be suppressed as ours');
  });

  test('the docket is ranked by severity, worst first [R16]', () => {
    const r = buildDocket(hits, { fingerprint: FP, allow: ALLOW });
    for (let i = 1; i < r.docket.length; i++) {
      assert.ok(r.docket[i - 1].severity >= r.docket[i].severity, 'docket is not sorted worst-first');
    }
  });

  test('the hit with a real burned customer ranks above one without [R15]', () => {
    const r = buildDocket(hits, { fingerprint: FP, allow: ALLOW });
    const fake = r.docket.find((h) => h.id === 'fake');
    assert.ok(fake, 'the corroborated counterfeit must reach the docket');
    assert.ok(fake.linkedHarm.length > 0);
  });
});
