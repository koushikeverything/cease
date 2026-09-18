import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('plugin manifest is well-formed [A17]', () => {
  const p = JSON.parse(readFileSync('.claude-plugin/plugin.json', 'utf8'));
  assert.equal(p.name, 'cease');
  assert.match(p.version, /^\d+\.\d+\.\d+$/);
  assert.ok(p.description.length > 0);
});

test('plugin description does not claim private ad-account metrics [R11]', () => {
  const p = JSON.parse(readFileSync('.claude-plugin/plugin.json', 'utf8'));
  const d = p.description.toLowerCase();
  for (const overclaim of ['ad account', 'cpm', 'click-through', 'branded cpc', 'impression share']) {
    assert.ok(!d.includes(overclaim), `description must not claim "${overclaim}" (R11 narrowed 2026-09-18)`);
  }
});
