/**
 * A19 — every schedule is created through the host's scheduled-tasks surface.
 * No scheduler code exists in this plugin.
 *
 * The leverage manifest recorded scheduled-tasks as `works` and the verdict
 * leveraged it. This test is what stops that decision quietly eroding: the
 * cheapest way to break a hybrid verdict is for someone to reimplement the
 * leveraged capability because it felt easier than asking the host.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const walk = (dir, out = []) => {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.git' || e === 'tests') continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(mjs|js|json|md)$/.test(e)) out.push(p);
  }
  return out;
};

describe('A19 — no scheduler is built', () => {
  const files = walk('scripts').concat(walk('hooks'), walk('skills'), walk('agents'));

  test('no cron expression or timer implementation ships in the plugin [A19]', () => {
    const banned = [
      [/\bnode-cron\b/, 'a cron library'],
      [/\bsetInterval\s*\(/, 'a polling timer'],
      [/require\(['"]cron['"]\)/, 'a cron library'],
      [/\bcrontab\b/, 'a crontab'],
      [/\*\s+\*\s+\*\s+\*\s+\*/, 'a raw cron expression'],
    ];
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      for (const [re, what] of banned) {
        assert.ok(!re.test(src), `${f} appears to implement ${what} — scheduling is leveraged from the host, not built (A19)`);
      }
    }
  });

  test('the skills that need scheduling ask the host for it instead [A19]', () => {
    for (const skill of ['baseline', 'sweep', 'pursue', 'brief']) {
      const src = readFileSync(join('skills', skill, 'SKILL.md'), 'utf8');
      assert.match(src, /scheduled task/i, `skills/${skill} should hand scheduling to the host`);
    }
  });

  test('plugin.json declares no scheduling component [A19]', () => {
    const p = JSON.parse(readFileSync('.claude-plugin/plugin.json', 'utf8'));
    assert.ok(!('monitors' in p), 'monitors would be a scheduling surface this plugin does not need');
  });
});
