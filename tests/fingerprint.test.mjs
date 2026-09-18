/** Fingerprint tests — SPEC R1, R2, R3, A1. */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildFingerprint, distinctivePhrases, priceFloor, tokenize, shingles, hashImage } from '../scripts/fingerprint.mjs';
import { read } from '../scripts/sources.mjs';

const catalog = () => read('catalog').rows;

describe('A1 — a fingerprint per product', () => {
  test('every product gets phrases, a price and a price floor [A1]', async () => {
    const fp = await buildFingerprint(catalog(), { brand: 'Lumen Goods' });
    assert.equal(fp.products.length, 3);
    for (const p of fp.products) {
      assert.ok(p.sku, 'product has no SKU');
      assert.ok(p.phrases.length > 0, `${p.sku} produced no distinctive phrases`);
      assert.equal(typeof p.price, 'number');
      assert.equal(typeof p.priceFloor, 'number');
      assert.ok(p.priceFloor < p.price);
    }
  });

  test('an image slot exists per image even when hashing is off [A1]', async () => {
    const fp = await buildFingerprint(catalog(), {});
    const withImages = fp.products.filter((p) => p.images.length);
    assert.ok(withImages.length > 0);
    for (const p of withImages) for (const img of p.images) {
      assert.ok('url' in img && 'sha256' in img, 'image entry must always carry url and sha256 keys');
    }
  });

  test('the fingerprint declares that perceptual hashing is deferred [honest limits]', async () => {
    const fp = await buildFingerprint(catalog(), {});
    assert.match(fp.perceptualHashing, /deferred/);
  });

  test('the allowlist is carried into the fingerprint [R3]', async () => {
    const fp = await buildFingerprint(catalog(), {
      config: { owned_domains: 'example.com, example.co.uk', authorized_resellers: 'Northwind Retail' },
    });
    assert.deepEqual(fp.allowlist.owned_domains, ['example.com', 'example.co.uk']);
    assert.deepEqual(fp.allowlist.authorized_resellers, ['Northwind Retail']);
  });
});

describe('distinctive phrases are what a counterfeiter copy-pastes', () => {
  test('generic marketing copy loses to specific copy', () => {
    const generic = distinctivePhrases('Buy now for the best quality premium product with free shipping on all items');
    const specific = distinctivePhrases('Hand-spun brushed brass shade with a warm dimmable core finished in our Leeds workshop');
    assert.ok(specific.length > 0);
    assert.ok(specific.some((p) => /brushed brass|dimmable|leeds/i.test(p)),
      'a distinctive phrase must survive; got: ' + JSON.stringify(specific));
    assert.ok(generic.length <= specific.length);
  });

  test('phrases are long enough to be unique', () => {
    for (const p of distinctivePhrases('Oiled walnut column with a linen diffuser that softens the light without swallowing it')) {
      assert.ok(p.split(' ').length >= 4, `phrase too short to be distinctive: "${p}"`);
    }
  });

  test('near-duplicate phrases are not both kept', () => {
    const phrases = distinctivePhrases('the machined weighted base machined from a single billet of solid brass stock');
    const pairs = phrases.flatMap((a, i) => phrases.slice(i + 1).map((b) => [a, b]));
    for (const [a, b] of pairs) assert.notEqual(a, b);
  });

  test('short or empty descriptions degrade without throwing', () => {
    assert.deepEqual(distinctivePhrases(''), []);
    assert.deepEqual(distinctivePhrases(null), []);
    assert.equal(distinctivePhrases('two words').length, 1);
  });

  test('tokenize strips html and punctuation', () => {
    assert.deepEqual(tokenize('<p>Brass &mdash; shade!</p>'), ['brass', 'mdash', 'shade']);
  });

  test('shingles are contiguous runs', () => {
    assert.deepEqual(shingles(['a', 'b', 'c'], 2), ['a b', 'b c']);
  });
});

describe('price floor [R1]', () => {
  test('defaults to 60% of list', () => {
    assert.equal(priceFloor(100), 60);
    assert.equal(priceFloor(189), 113.4);
  });
  test('honours a custom ratio', () => assert.equal(priceFloor(100, 0.8), 80));
  test('a missing price yields null, never NaN', () => {
    assert.equal(priceFloor(null), null);
    assert.equal(priceFloor(undefined), null);
    assert.equal(priceFloor('abc'), null);
  });
});

describe('image hashing degrades honestly', () => {
  test('an unreachable image records a reason instead of failing the build', async () => {
    const r = await hashImage('https://cdn.lumengoods.example/x.jpg', {
      fetchImpl: async () => { throw new Error('getaddrinfo ENOTFOUND'); },
    });
    assert.equal(r.sha256, null);
    assert.match(r.reason, /unreachable/);
  });

  test('a reachable image yields a stable sha256', async () => {
    const bytes = new TextEncoder().encode('fake-image-bytes');
    const fetchImpl = async () => ({ ok: true, arrayBuffer: async () => bytes.buffer });
    const a = await hashImage('https://x/1.jpg', { fetchImpl });
    const b = await hashImage('https://x/1.jpg', { fetchImpl });
    assert.equal(a.sha256, b.sha256);
    assert.match(a.sha256, /^[0-9a-f]{64}$/);
  });

  test('a non-200 response records the status', async () => {
    const r = await hashImage('https://x/404.jpg', { fetchImpl: async () => ({ ok: false, status: 404 }) });
    assert.equal(r.sha256, null);
    assert.match(r.reason, /404/);
  });
});
