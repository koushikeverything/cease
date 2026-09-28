#!/usr/bin/env node
/**
 * Source adapters — SPEC "Data sources and the fixture boundary", A21.
 *
 * Shopify and Stripe are not connectable in this build, so catalog, orders and
 * disputes come from synthetic fixtures. This module is the seam that stops
 * that becoming permanent: every channel is read through ONE call site, and
 * A21 requires that switching to a live connector edits no SKILL.md.
 *
 * A node script cannot call a Claude connector — connectors are MCP tools the
 * model invokes. So an adapter in live mode does not fetch; it returns a
 * `needsConnector` envelope naming the tool to call, and `normalize()` accepts
 * either that tool's payload or a fixture and returns one canonical shape.
 * The SKILL.md carries both branches from day one and therefore never changes.
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, '..', 'fixtures');

/** Live sources per channel, with the connector tool a skill should call. */
export const CHANNELS = {
  catalog:  { connector: 'Shopify', tool: 'search_products', fixture: 'catalog.json' },
  orders:   { connector: 'Shopify', tool: 'list-orders',     fixture: 'orders.json' },
  disputes: { connector: 'Stripe',  tool: 'stripe_api_read', fixture: 'disputes.json' },
  mail:     { connector: 'Gmail',   tool: 'search_threads',  fixture: 'mail.json', liveByDefault: true },
  notify:   { connector: 'Gmail',   tool: 'send_message',    fixture: null, liveByDefault: true },
};

/** Fixture mode is on unless explicitly disabled. Defaults to safe, not convenient. */
export function fixtureMode() {
  const v = process.env.CEASE_FIXTURE_MODE ?? process.env.CLAUDE_PLUGIN_OPTION_FIXTURE_MODE;
  if (v === undefined) return true;
  return !/^(0|false|off|no)$/i.test(String(v).trim());
}

export function mode(channel) {
  const c = CHANNELS[channel];
  if (!c) throw new Error(`unknown channel "${channel}" — expected one of ${Object.keys(CHANNELS).join(', ')}`);
  if (c.liveByDefault) return 'live';
  return fixtureMode() ? 'fixture' : 'live';
}

function loadFixture(name) {
  const p = join(FIXTURES, name);
  if (!existsSync(p)) throw new Error(`fixture ${name} is missing — run from the plugin root`);
  return JSON.parse(readFileSync(p, 'utf8'));
}

// ---------- canonical shapes ----------
// Every downstream step reads these fields and no others, so a Shopify payload
// and a fixture are indistinguishable past this point.

export function normalizeProduct(raw) {
  return {
    sku: raw.sku ?? raw.variant_sku ?? raw.id ?? null,
    title: raw.title ?? raw.name ?? '',
    description: raw.description ?? raw.body_html ?? '',
    imageUrls: raw.imageUrls ?? raw.images?.map?.((i) => i.src ?? i.url ?? i) ?? [],
    price: raw.price != null ? Number(raw.price) : (raw.variants?.[0]?.price != null ? Number(raw.variants[0].price) : null),
    currency: raw.currency ?? raw.currency_code ?? 'USD',
  };
}

export function normalizeOrder(raw) {
  return {
    id: String(raw.id ?? raw.order_number ?? raw.name ?? ''),
    email: raw.email ?? raw.contact_email ?? null,
    total: raw.total != null ? Number(raw.total) : (raw.total_price != null ? Number(raw.total_price) : null),
    currency: raw.currency ?? raw.currency_code ?? 'USD',
    createdAt: raw.createdAt ?? raw.created_at ?? null,
    items: (raw.items ?? raw.line_items ?? []).map((li) => ({ sku: li.sku ?? null, qty: Number(li.qty ?? li.quantity ?? 1) })),
  };
}

export function normalizeDispute(raw) {
  return {
    id: String(raw.id ?? ''),
    orderId: raw.orderId ?? raw.order_id ?? raw.charge ?? null,
    reasonCode: raw.reasonCode ?? raw.reason ?? 'unknown',
    amount: raw.amount != null ? Number(raw.amount) : null,
    currency: raw.currency ?? 'USD',
    createdAt: raw.createdAt ?? raw.created ?? null,
  };
}

const NORMALIZERS = { catalog: normalizeProduct, orders: normalizeOrder, disputes: normalizeDispute };

/** Normalize a raw payload from EITHER a connector or a fixture. */
export function normalize(channel, raw) {
  const fn = NORMALIZERS[channel];
  if (!fn) throw new Error(`channel "${channel}" has no normalizer`);
  // Connector payloads commonly wrap the array; fixtures are already arrays.
  const rows = Array.isArray(raw) ? raw
    : raw?.products ?? raw?.orders ?? raw?.disputes ?? raw?.data ?? raw?.items ?? [];
  return rows.map(fn);
}

/**
 * Read a channel. In fixture mode returns normalized rows. In live mode returns
 * an envelope telling the caller which connector tool to invoke and to pipe the
 * result back through `normalize`.
 */
export function read(channel) {
  const c = CHANNELS[channel];
  if (!c) throw new Error(`unknown channel "${channel}"`);
  if (mode(channel) === 'fixture' && c.fixture) {
    return { mode: 'fixture', channel, rows: normalize(channel, loadFixture(c.fixture)) };
  }
  return {
    mode: 'live',
    channel,
    needsConnector: { connector: c.connector, tool: c.tool },
    instruction: `Call the ${c.connector} connector's \`${c.tool}\` tool, then pipe its result through: node scripts/sources.mjs normalize ${channel} <file.json>`,
  };
}

// --- CLI ---
if (process.argv[1]?.endsWith('sources.mjs')) {
  const [cmd, arg, file] = process.argv.slice(2);
  try {
    if (cmd === 'normalize') {
      console.log(JSON.stringify(normalize(arg, JSON.parse(readFileSync(file, 'utf8'))), null, 2));
    } else if (cmd === 'mode') {
      console.log(JSON.stringify(Object.fromEntries(Object.keys(CHANNELS).map((k) => [k, mode(k)])), null, 2));
    } else if (cmd && CHANNELS[cmd]) {
      console.log(JSON.stringify(read(cmd), null, 2));
    } else {
      console.log(`usage: sources.mjs <${Object.keys(CHANNELS).join('|')}> | normalize <channel> <file.json> | mode`);
      process.exit(2);
    }
  } catch (e) { console.error(`error: ${e.message}`); process.exit(1); }
}
