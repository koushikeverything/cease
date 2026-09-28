#!/usr/bin/env node
/**
 * Routing report — the sound triggering detector.
 *
 * `claude plugin eval`'s scored grader for these cases is an LLM judge reading
 * the transcript, and `tool_used: Skill` cannot say WHICH skill fired (and is
 * unscored under --ablation anyway). In a sandbox with no shell and an empty
 * working directory, a skill that routes perfectly and then cannot do its work
 * reads to a judge as a failure. That is how a 14/16 routing result scored 8/16.
 *
 * This reads the structured field that actually proves the claim: the `skill`
 * input of a Skill tool_use event in each run's trace. Per check-rubric.md, a
 * detector must name the field it reads rather than pattern-match a stream.
 *
 *   claude plugin eval . --case "*-positive-*" --keep-temp --json out.json
 *   node tools/routing-report.mjs out.json
 */
import { readFileSync, existsSync } from 'node:fs';

const file = process.argv[2];
if (!file) { console.error('usage: routing-report.mjs <eval-json>'); process.exit(2); }

/** Skill names invoked in one run, from the trace's tool_use events. */
export function skillsInTrace(tracePath) {
  if (!tracePath || !existsSync(tracePath)) return null;
  const out = [];
  for (const line of readFileSync(tracePath, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let e;
    try { e = JSON.parse(line); } catch { continue; }
    if (!e || typeof e !== 'object') continue;
    const content = e.message && typeof e.message === 'object' ? e.message.content : null;
    if (!Array.isArray(content)) continue;
    for (const b of content) {
      if (b && b.type === 'tool_use' && b.name === 'Skill') out.push(b.input?.skill ?? null);
    }
  }
  return out;
}

/** `evals/triggering/<skill>/positive-1` -> expected skill name. */
const expectedFrom = (name) => name.replace(/-(positive|negative)-\d+$/, '');

const data = JSON.parse(readFileSync(file, 'utf8'));
const rows = [];
for (const c of data.cases ?? []) {
  const kind = c.name.includes('positive') ? 'positive'
    : c.name.includes('negative') ? 'negative' : 'collision';
  const run = c.arms?.with?.[0];
  const fired = skillsInTrace(run?.tracePath);
  rows.push({ name: c.name, kind, expected: expectedFrom(c.name), fired, error: run?.error ?? null });
}

const tally = { correct: 0, misrouted: 0, silent: 0, overTriggered: 0, noTrace: 0 };
const problems = [];

for (const r of rows) {
  if (r.fired === null) { tally.noTrace++; r.verdict = 'no trace (re-run with --keep-temp)'; continue; }
  const hit = r.fired.some((s) => String(s).endsWith(`:${r.expected}`));
  if (r.kind === 'positive') {
    if (hit) { tally.correct++; r.verdict = 'correct'; }
    else if (r.fired.length === 0) { tally.silent++; r.verdict = 'UNDER-TRIGGER: no skill fired'; problems.push(r); }
    else { tally.misrouted++; r.verdict = `MISROUTED to ${r.fired.join(', ')}`; problems.push(r); }
  } else {
    if (hit) { tally.overTriggered++; r.verdict = `OVER-TRIGGER: ${r.expected} fired`; problems.push(r); }
    else { tally.correct++; r.verdict = r.fired.length ? `stayed out (${r.fired.join(', ')} fired)` : 'stayed out'; }
  }
}

const pad = (s, n) => String(s).padEnd(n);
console.log(`${pad('case', 28)}${pad('expected', 11)}${pad('fired', 26)}verdict`);
console.log('-'.repeat(92));
for (const r of rows) console.log(`${pad(r.name, 28)}${pad(r.expected, 11)}${pad((r.fired ?? []).join(', ') || '(none)', 26)}${r.verdict}`);

console.log(`\ncorrect ${tally.correct} · misrouted ${tally.misrouted} · under-triggered ${tally.silent} ` +
            `· over-triggered ${tally.overTriggered} · no trace ${tally.noTrace}`);

// Misrouting and over-triggering are real defects. An under-trigger at one run
// per case is weak evidence — report it, do not fail on it.
if (tally.misrouted || tally.overTriggered) {
  console.log('\nFAIL — routing defects:');
  for (const p of problems.filter((x) => /MISROUTED|OVER-TRIGGER/.test(x.verdict))) console.log(`  ${p.name}: ${p.verdict}`);
  process.exit(1);
}
console.log('ok    no misrouting and no over-triggering');
