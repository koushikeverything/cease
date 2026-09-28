/** Allowlist suppression tests — SPEC R12, A2. */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { filterAllowlisted, domainMatches, normalizeHandle, normalizeDomain } from '../scripts/suppress.mjs';

const ALLOW = {
  owned_domains: 'example.com, example.co.uk',
  owned_handles: '@example, @example.official',
  authorized_resellers: 'Northwind Retail, Acme Distribution',
};

describe('A2 — an authorized reseller never reaches the docket', () => {
  test('a known distributor listing BELOW price floor is suppressed [A2]', () => {
    const hits = [
      { id: 'h1', seller: 'Northwind Retail', price: 12, priceFloor: 30, belowFloor: true },
      { id: 'h2', seller: 'Totally Legit Goods', price: 11, priceFloor: 30, belowFloor: true },
    ];
    const { kept, suppressed } = filterAllowlisted(hits, ALLOW);
    assert.deepEqual(kept.map((h) => h.id), ['h2'], 'the real counterfeit must survive suppression');
    assert.deepEqual(suppressed.map((h) => h.id), ['h1']);
    assert.equal(suppressed[0].suppressionReason, 'authorized reseller');
  });

  test('suppressed hits are retained with a reason, not silently dropped [R12]', () => {
    const { suppressed } = filterAllowlisted([{ id: 'h1', domain: 'shop.example.com' }], ALLOW);
    assert.equal(suppressed.length, 1);
    assert.equal(suppressed[0].suppressed, true);
    assert.ok(suppressed[0].suppressionReason);
    assert.equal(suppressed[0].suppressionMatch, 'example.com');
  });

  test('reseller matching tolerates case and punctuation drift [R12]', () => {
    for (const seller of ['northwind retail', 'NORTHWIND RETAIL', 'Northwind  Retail', 'Northwind Retail.']) {
      const { kept } = filterAllowlisted([{ id: 'x', seller }], ALLOW);
      assert.equal(kept.length, 0, `should have suppressed "${seller}"`);
    }
  });

  test('handle matching tolerates separator drift [R12]', () => {
    for (const handle of ['@example.official', '@example_official', 'exampleofficial', '@Example-Official']) {
      const { kept } = filterAllowlisted([{ id: 'x', handle }], ALLOW);
      assert.equal(kept.length, 0, `should have suppressed "${handle}"`);
    }
  });
});

describe('lookalike domains are NOT suppressed — the dangerous false negative', () => {
  test('a domain that merely CONTAINS an owned domain still reaches the docket [R12]', () => {
    const hits = [
      { id: 'bad1', domain: 'example.com.evil.com' },
      { id: 'bad2', domain: 'example-com.shop' },
      { id: 'bad3', domain: 'notexample.com' },
      { id: 'bad4', domain: 'example.com.co' },
      { id: 'good', domain: 'shop.example.com' },
    ];
    const { kept, suppressed } = filterAllowlisted(hits, ALLOW);
    assert.deepEqual(kept.map((h) => h.id).sort(), ['bad1', 'bad2', 'bad3', 'bad4'],
      'every lookalike must survive suppression — suppressing one would hide a real counterfeit storefront');
    assert.deepEqual(suppressed.map((h) => h.id), ['good']);
  });

  test('domainMatches is a boundary match, not a substring match', () => {
    assert.equal(domainMatches('shop.example.com', 'example.com'), true);
    assert.equal(domainMatches('example.com', 'example.com'), true);
    assert.equal(domainMatches('https://WWW.Example.com/products/1', 'example.com'), true);
    assert.equal(domainMatches('example.com.evil.com', 'example.com'), false);
    assert.equal(domainMatches('myexample.com', 'example.com'), false);
  });
});

describe('normalisation', () => {
  test('strips scheme, www, path, port and case', () => {
    assert.equal(normalizeDomain('HTTPS://www.Example.com:443/a/b?c=1'), 'example.com');
  });
  test('handles are compared without @ or separators', () => {
    assert.equal(normalizeHandle('@Example_Store'), 'examplestore');
  });
  test('an empty allowlist suppresses nothing', () => {
    const { kept } = filterAllowlisted([{ id: 'a', seller: 'Anyone' }], {});
    assert.equal(kept.length, 1);
  });
});
