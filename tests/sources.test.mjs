/** Source adapter tests — SPEC "Data sources", A21, A4. */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { read, mode, normalize, normalizeProduct, normalizeOrder, normalizeDispute, CHANNELS } from '../scripts/sources.mjs';

describe('A21 — the fixture boundary is a seam, not a fork', () => {
  test('a fixture channel returns normalized rows', () => {
    const r = read('catalog');
    assert.equal(r.mode, 'fixture');
    assert.ok(r.rows.length >= 3);
    assert.ok(r.rows.every((p) => p.sku && p.title && typeof p.price === 'number'));
  });

  test('a live channel names the connector tool instead of fetching [A21]', () => {
    process.env.CEASE_FIXTURE_MODE = 'off';
    const r = read('catalog');
    assert.equal(r.mode, 'live');
    assert.deepEqual(r.needsConnector, { connector: 'Shopify', tool: 'search_products' });
    assert.match(r.instruction, /normalize catalog/);
    delete process.env.CEASE_FIXTURE_MODE;
  });

  test('a Shopify-shaped payload and a fixture normalize identically [A21]', () => {
    // The property that makes the swap free: past normalize(), the two are
    // indistinguishable, so no SKILL.md needs to know which one it got.
    const shopifyShaped = { products: [{
      id: 'LG-PEND-01',
      title: 'Halo Pendant Lamp — Brushed Brass',
      body_html: 'Hand-spun brushed brass shade.',
      images: [{ src: 'https://cdn.example/x.jpg' }],
      variants: [{ price: '189.00' }],
      currency_code: 'USD',
    }] };
    const fixtureShaped = [{
      sku: 'LG-PEND-01',
      title: 'Halo Pendant Lamp — Brushed Brass',
      description: 'Hand-spun brushed brass shade.',
      imageUrls: ['https://cdn.example/x.jpg'],
      price: 189.0,
      currency: 'USD',
    }];
    assert.deepEqual(normalize('catalog', shopifyShaped), normalize('catalog', fixtureShaped));
  });

  test('mail and notify are live even in fixture mode — they have real connectors', () => {
    assert.equal(mode('mail'), 'live');
    assert.equal(mode('notify'), 'live');
  });

  test('fixture mode defaults ON — safe, not convenient', () => {
    delete process.env.CEASE_FIXTURE_MODE;
    delete process.env.CLAUDE_PLUGIN_OPTION_FIXTURE_MODE;
    assert.equal(mode('catalog'), 'fixture');
  });

  test('an unknown channel fails loudly with the valid list', () => {
    assert.throws(() => read('shopify'), /unknown channel/);
    assert.throws(() => mode('nope'), /expected one of/);
  });
});

describe('A4 — the dispute that proves an impersonator took the sale', () => {
  test('the fixture set contains unmatched disputes clustered on one reason code', () => {
    const disputes = read('disputes').rows;
    const orderIds = new Set(read('orders').rows.map((o) => o.id));
    const unmatched = disputes.filter((d) => !d.orderId || !orderIds.has(String(d.orderId)));
    assert.ok(unmatched.length >= 2, 'need a cluster, not a one-off');
    assert.ok(unmatched.every((d) => d.reasonCode === 'product_not_as_described'));
    const matched = disputes.filter((d) => d.orderId && orderIds.has(String(d.orderId)));
    assert.ok(matched.length >= 1, 'need an ordinary dispute too, or the test proves nothing');
  });
});

describe('normalizers tolerate both payload shapes', () => {
  test('order line items come from items[] or line_items[]', () => {
    assert.deepEqual(normalizeOrder({ id: 1, line_items: [{ sku: 'A', quantity: 2 }] }).items, [{ sku: 'A', qty: 2 }]);
    assert.deepEqual(normalizeOrder({ id: 1, items: [{ sku: 'A', qty: 2 }] }).items, [{ sku: 'A', qty: 2 }]);
  });
  test('dispute order reference comes from orderId, order_id or charge', () => {
    assert.equal(normalizeDispute({ id: 'd', order_id: '9' }).orderId, '9');
    assert.equal(normalizeDispute({ id: 'd', charge: 'ch_1' }).orderId, 'ch_1');
  });
  test('a product with no price normalizes to null rather than NaN', () => {
    assert.equal(normalizeProduct({ sku: 'X', title: 'T' }).price, null);
  });
});

describe('every declared channel has a usable definition', () => {
  test('each channel names a connector and a tool', () => {
    for (const [name, c] of Object.entries(CHANNELS)) {
      assert.ok(c.connector, `${name} has no connector`);
      assert.ok(c.tool, `${name} has no tool`);
    }
  });
});
