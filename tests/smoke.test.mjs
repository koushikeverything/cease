import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

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

test('A20 — nothing claims a precision or false-positive rate [A20]', () => {
  // The product's central claim is precision, and it has never been measured.
  // Any number here would be invented.
  const docs = ['README.md', 'skills/brief/SKILL.md', 'skills/sweep/SKILL.md', '.claude-plugin/plugin.json'];
  const banned = [
    /\d+\s*%\s*(accurate|precision|precise)/i,
    /(false[- ]positive|false[- ]negative)\s*rate\s*(of|:)?\s*\d+(\.\d+)?\s*%?/i,  // \d+ required: [\d.]+ matched a full stop
    /\b(99|98|97|95|90)\s*%\b/,
    /zero false positives/i,
  ];
  for (const f of docs) {
    const src = readFileSync(f, 'utf8');
    for (const re of banned) {
      assert.ok(!re.test(src), `${f} appears to claim a measured precision figure — A20 forbids it until real brand data has run through`);
    }
  }
});

test('A20 — the README states precision is unmeasured [A20]', () => {
  assert.match(readFileSync('README.md', 'utf8'), /Precision is unmeasured/i);
});

test('every skill named in the README exists [docs drift]', () => {
  const readme = readFileSync('README.md', 'utf8');
  const named = [...readme.matchAll(/cease:([a-z-]+)/g)].map((m) => m[1]);
  const actual = new Set(readdirSync('skills'));
  for (const s of new Set(named)) {
    assert.ok(actual.has(s), `README names cease:${s}, which does not exist`);
  }
});

test('every skill that exists is documented in the README [docs drift]', () => {
  const readme = readFileSync('README.md', 'utf8');
  for (const s of readdirSync('skills')) {
    assert.ok(readme.includes(`cease:${s}`), `skills/${s} is not documented in the README`);
  }
});
