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

// Before believing any routing number, confirm the environment could have
// produced a pass at all. Three separate runs in this project reported clean or
// low scores that measured the harness, not the plugin: once the Skill tool was
// denied outright, once an LLM judge failed correctly-routed skills for being
// unable to run node, and once every run errored with "Not logged in" while
// this report still printed "ok, no misrouting". A detector that cannot tell
// "nothing was wrong" from "nothing happened" is not a detector.
const errored = (data.cases ?? []).filter((c) => c.arms?.with?.[0]?.error);
if (data.partial || errored.length) {
  console.error('REFUSING TO REPORT — the run did not complete cleanly, so its routing numbers mean nothing.\n');
  if (data.partial) console.error(`  partial run: ${(data.cases ?? []).length} case(s) recorded, suite stopped early`);
  for (const c of errored.slice(0, 5)) console.error(`  ${c.name}: ${c.arms.with[0].error}`);
  if (errored.length > 5) console.error(`  ...and ${errored.length - 5} more`);
  const auth = errored.some((c) => /not logged in|authenticate/i.test(String(c.arms.with[0].error)));
  console.error(auth
    ? '\nThe credential expired. Run `claude` then `/login`, and re-run the suite.'
    : '\nFix the run errors above and re-run the suite.');
  process.exit(2);
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

// Absence of evidence is not evidence of correctness. Without traces there is
// nothing to check, and saying "ok" here would be the same failure one level
// down from the partial-run guard above.
const judged = tally.correct + tally.misrouted + tally.silent + tally.overTriggered;
if (judged === 0) {
  console.log(`\nINCONCLUSIVE — no run had a readable trace (${tally.noTrace} case(s)).`);
  console.log('Nothing was measured. Re-run with --keep-temp so traces survive.');
  process.exit(2);
}
if (tally.noTrace) console.log(`\nnote: ${tally.noTrace} case(s) had no readable trace and were not judged.`);
console.log(`ok    no misrouting and no over-triggering (${judged} case(s) judged)`);
