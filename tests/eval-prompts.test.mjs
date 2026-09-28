/**
 * Eval prompt independence — SPEC A18, check-report F-14.
 *
 * A positive triggering prompt that quotes its own skill description proves
 * only that the router can match itself. The declared contract is AMBIENT: the
 * skill must reach a user who describes the problem in their own words. Eleven
 * of sixteen prompts originally echoed the descriptions — some verbatim — and
 * that was invisible until a reviewer read them side by side.
 *
 * This makes it mechanical: a positive prompt may share no 4-word run with the
 * description of the skill it targets.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const STOP = new Set(('a an the and or but of for with to from in on at is are was it its this that '
  + 'you your our we they their i me my if not no so as by be been do does did can could would should').split(' '));

const words = (s) => String(s).toLowerCase().replace(/[^a-z0-9\s'-]/g, ' ').split(/\s+/).filter(Boolean);

/** Content-bearing 4-word runs, so shared filler words don't trip it. */
function ngrams(text, n = 4) {
  const w = words(text);
  const out = new Set();
  for (let i = 0; i + n <= w.length; i++) {
    const run = w.slice(i, i + n);
    if (run.filter((x) => !STOP.has(x)).length >= 2) out.add(run.join(' '));
  }
  return out;
}

function description(skill) {
  const src = readFileSync(join('skills', skill, 'SKILL.md'), 'utf8');
  const m = src.match(/description: >-\n((?:  .*\n)+)/);
  return m ? m[1].split('\n').map((l) => l.trim()).join(' ') : '';
}

function promptOf(caseFile) {
  const m = readFileSync(caseFile, 'utf8').match(/  prompt: \|\n((?:    .*\n)+)/);
  return m ? m[1].split('\n').map((l) => l.trim()).join(' ').trim() : '';
}

const positives = [];
for (const skill of readdirSync('evals/triggering')) {
  for (const dir of readdirSync(join('evals/triggering', skill))) {
    if (!dir.startsWith('positive')) continue;
    const f = join('evals/triggering', skill, dir, 'case.yaml');
    if (existsSync(f)) positives.push({ skill, name: `${skill}/${dir}`, prompt: promptOf(f) });
  }
}

describe('positive prompts are the user’s words, not the description’s [A18, F-14]', () => {
  test('the suite has positives to check', () => {
    assert.ok(positives.length >= 16, `expected at least 16 positive cases, found ${positives.length}`);
  });

  for (const { skill, name, prompt } of positives) {
    test(`${name} shares no 4-word run with the cease:${skill} description`, () => {
      assert.ok(prompt, `${name} has no prompt`);
      const shared = [...ngrams(prompt)].filter((g) => ngrams(description(skill)).has(g));
      assert.deepEqual(shared, [],
        `${name} quotes its own description ("${shared.join('", "')}") — it tests a user repeating the description back, not the ambient contract`);
    });
  }

  test('no two positive prompts are identical', () => {
    const seen = new Map();
    for (const { name, prompt } of positives) {
      const key = prompt.toLowerCase().trim();
      assert.ok(!seen.has(key), `${name} duplicates ${seen.get(key)}`);
      seen.set(key, name);
    }
  });

  test('the criteria quote the prompt they actually run [drift guard]', () => {
    // The llm criteria embed the prompt text; if a prompt is edited and the
    // criteria are not, the judge grades a question that was never asked.
    for (const skill of readdirSync('evals/triggering')) {
      for (const dir of readdirSync(join('evals/triggering', skill))) {
        const f = join('evals/triggering', skill, dir, 'case.yaml');
        if (!existsSync(f)) continue;
        const src = readFileSync(f, 'utf8');
        const prompt = promptOf(f);
        const quoted = src.match(/The user asked: "(.+)"/);
        if (!quoted) continue;
        assert.equal(quoted[1], prompt,
          `${skill}/${dir}: the grader quotes a different prompt than the case runs`);
      }
    }
  });
});
