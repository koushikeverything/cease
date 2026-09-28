/**
 * Mechanism reachability — check-rubric.md, security.md rule 2.
 *
 * Every row of SPEC.md's security posture table names a file:symbol. This test
 * asserts each symbol has a caller OUTSIDE tests/. A safety symbol whose only
 * callers are tests is a P0 finding whatever the suite reports: a confinement
 * helper once passed five tests while nothing called it, and the artifact was
 * fully escapable while every gate reported success.
 *
 * A green suite testing dead code is worse than no suite, because it buys
 * confidence.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SECURITY_TABLE = [
  { symbol: 'decide',            file: 'hooks/signature-gate.mjs', rid: 'R29', claim: 'no instrument leaves without a signature' },
  { symbol: 'safeDecide',        file: 'hooks/signature-gate.mjs', rid: 'R29', claim: 'an internal error denies rather than escapes' },
  { symbol: 'verifyChain',       file: 'scripts/audit-append.mjs', rid: 'R30', claim: 'the audit chain is actually checked' },
  { symbol: 'verifyBodyHash',    file: 'hooks/signature-gate.mjs', rid: 'R29', claim: 'the thing sent is the thing that was signed' },
  { symbol: 'filterAllowlisted', file: 'scripts/suppress.mjs',     rid: 'R12', claim: 'authorized resellers never reach the docket' },
  { symbol: 'appendEntry',       file: 'scripts/audit-append.mjs', rid: 'R30', claim: 'the audit log cannot be rewritten' },
];

const sources = (() => {
  const out = [];
  const walk = (d) => {
    for (const e of readdirSync(d)) {
      if (['node_modules', '.git', 'tests', 'docs', 'evals'].includes(e)) continue;
      const p = join(d, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(mjs|js)$/.test(e)) out.push(p);
    }
  };
  walk('.');
  return out.map((p) => ({ path: p, src: readFileSync(p, 'utf8') }));
})();

describe('every security-table symbol actually runs', () => {
  for (const { symbol, file, rid, claim } of SECURITY_TABLE) {
    test(`${rid}: ${symbol}() has a non-test caller — "${claim}"`, () => {
      const callers = sources.filter(({ path, src }) => {
        const calls = new RegExp(`(?<!(function|const)\\s)\\b${symbol}\\s*\\(`).test(src);
        if (!calls) return false;
        if (path.endsWith(file)) {
          // Within its own module, require a call that is not the definition.
          const withoutDef = src.replace(new RegExp(`export\\s+(async\\s+)?function\\s+${symbol}[\\s\\S]*?\\n\\}`, 'g'), '');
          return new RegExp(`\\b${symbol}\\s*\\(`).test(withoutDef);
        }
        return true;
      });
      assert.ok(callers.length > 0,
        `${file}:${symbol} is defined but nothing outside tests/ calls it — the property it claims to enforce is unenforced (P0)`);
    });
  }

  test('the hook config points at the file that contains the gate [R29]', () => {
    const hooks = JSON.parse(readFileSync('hooks/hooks.json', 'utf8'));
    const entry = hooks.hooks.PreToolUse[0].hooks[0];
    const scriptArg = (entry.args ?? []).find((a) => a.endsWith('.mjs'));
    assert.ok(scriptArg, 'the PreToolUse hook must name a script in exec form');
    assert.ok(scriptArg.includes('signature-gate.mjs'),
      'the hook must point at the signature gate, or R29 is enforced by nothing');
    const src = readFileSync('hooks/signature-gate.mjs', 'utf8');
    assert.match(src, /render\(safeDecide\(/, 'the gate entrypoint must call the fail-closed wrapper');
  });

  test('the matcher covers send-shaped tools across ANY connector id [R29]', () => {
    const hooks = JSON.parse(readFileSync('hooks/hooks.json', 'utf8'));
    const matcher = hooks.hooks.PreToolUse[0].matcher;
    const re = new RegExp(matcher);
    // Connector ids are per-user UUIDs; the matcher must not depend on one.
    for (const tool of [
      'mcp__5b8979f9-8667-42c4-aac2-82320088d456__send_message',
      'mcp__deadbeef-0000-1111-2222-333344445555__send_message',
      'mcp__anything__reply',
      'mcp__x__forward',
    ]) {
      assert.ok(re.test(tool), `matcher fails to cover ${tool}`);
    }
    // ...and must not swallow unrelated reads.
    for (const tool of ['mcp__x__search_threads', 'mcp__x__get_message', 'Read', 'Bash']) {
      assert.ok(!re.test(tool), `matcher over-matches ${tool}`);
    }
  });
});


describe('verification commands run on an operational path [security.md rule 2]', () => {
  // A tamper detector that exists, is tested, and is never invoked is the named
  // worst case: a green suite buys confidence in a check nobody runs.
  const skillBodies = readdirSync('skills')
    .map((n) => join('skills', n, 'SKILL.md'))
    .filter((p) => { try { return statSync(p).isFile(); } catch { return false; } })
    .map((p) => readFileSync(p, 'utf8'))
    .join('\n');

  const VERIFIERS = [
    { cmd: 'audit-append.mjs verify', claim: 'the audit chain is checked weekly (R30)' },
    { cmd: 'case.mjs verify', claim: 'evidence custody is re-verified (R21)' },
    { cmd: 'case.mjs readiness', claim: 'DMCA readiness is gated (F7)' },
  ];

  for (const { cmd, claim } of VERIFIERS) {
    test(`\`${cmd}\` is invoked from a skill — ${claim}`, () => {
      assert.ok(skillBodies.includes(cmd),
        `${cmd} is never run by any skill, so the property it checks is unverified in practice`);
    });
  }
});
