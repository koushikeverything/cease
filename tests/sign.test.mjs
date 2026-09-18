/** Signing ledger tests — SPEC R29, R30, A11, A12, F8. */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { draft, sign, discard, status, sentinelFor, INSTRUMENTS } from '../scripts/sign.mjs';
import { decide } from '../hooks/signature-gate.mjs';
import { verifyChain } from '../scripts/audit-append.mjs';

const dir = () => mkdtempSync(join(tmpdir(), 'cease-sign-'));
const TEXT = (id) => [sentinelFor(id), 'I have a good faith belief that the use is not authorized.',
                      'I swear, under penalty of perjury, that this notification is accurate.'].join('\n');

describe('draft and sign', () => {
  test('a draft without its case sentinel is refused [R29]', () => {
    const d = dir();
    assert.throws(() => draft('c-1', 'dmca-512c', 'no sentinel here', d), /case sentinel/);
    rmSync(d, { recursive: true, force: true });
  });

  test('an unknown instrument is refused with the valid list', () => {
    const d = dir();
    assert.throws(() => draft('c-1', 'strongly-worded-email', TEXT('c-1'), d), /unknown instrument/);
    assert.ok(INSTRUMENTS.includes('counter-notice-response'));
    rmSync(d, { recursive: true, force: true });
  });

  test('signing without a named approver is refused [security.md rule 8]', () => {
    const d = dir();
    draft('c-1', 'dmca-512c', TEXT('c-1'), d);
    assert.throws(() => sign('c-1', '', TEXT('c-1'), { dir: d }), /name of the person/);
    assert.throws(() => sign('c-1', '   ', TEXT('c-1'), { dir: d }), /name of the person/);
    rmSync(d, { recursive: true, force: true });
  });

  test('signing text that differs from the draft is refused [R29]', () => {
    const d = dir();
    draft('c-1', 'dmca-512c', TEXT('c-1'), d);
    assert.throws(() => sign('c-1', 'Dana', TEXT('c-1') + '\nAlso remove their other listings.', { dir: d }),
      /not the text that was drafted/);
    rmSync(d, { recursive: true, force: true });
  });

  test('signing with nothing drafted is refused', () => {
    const d = dir();
    assert.throws(() => sign('c-1', 'Dana', TEXT('c-1'), { dir: d }), /no drafted instrument/);
    rmSync(d, { recursive: true, force: true });
  });
});

describe('the ledger drives the gate — end to end [A11]', () => {
  test('drafted-but-unsigned BLOCKS the send; signing UNBLOCKS exactly that text', () => {
    const d = dir();
    const text = TEXT('c-1');
    const send = { tool_name: 'mcp__x__send_message', tool_input: { body: text } };

    draft('c-1', 'dmca-512c', text, d);
    assert.equal(decide(send, { dir: d }).decision, 'deny', 'an unsigned instrument must not send');

    sign('c-1', 'Dana Okafor', text, { dir: d });
    assert.equal(decide(send, { dir: d }).decision, null, 'a signed instrument must send');

    // ...and the signature does not travel to a different instrument.
    const other = { tool_name: 'mcp__x__send_message', tool_input: { body: text.replace('c-1', 'c-2') } };
    assert.equal(decide(other, { dir: d }).decision, 'deny', 'a signature must not cover another case');
    rmSync(d, { recursive: true, force: true });
  });

  test('signing clears the pending record so the fallback stops blocking [R29]', () => {
    const d = dir();
    draft('c-1', 'dmca-512c', TEXT('c-1'), d);
    assert.deepEqual(status(d).pending, ['c-1']);
    sign('c-1', 'Dana', TEXT('c-1'), { dir: d });
    assert.deepEqual(status(d).pending, []);
    assert.deepEqual(status(d).signed, ['c-1']);
    rmSync(d, { recursive: true, force: true });
  });

  test('F8 — an unsigned draft stays unsent indefinitely, with no expiry path', () => {
    const d = dir();
    draft('c-1', 'dmca-512c', TEXT('c-1'), d);
    const pendingPath = join(d, 'pending', 'c-1.json');
    const rec = JSON.parse(readFileSync(pendingPath, 'utf8'));
    rec.draftedAt = '1999-01-01T00:00:00Z';          // as old as you like
    writeFileSync(pendingPath, JSON.stringify(rec));
    assert.equal(decide({ tool_name: 'mcp__x__send_message', tool_input: { body: TEXT('c-1') } }, { dir: d }).decision,
      'deny', 'age must never convert an unsigned draft into a permitted send');
    rmSync(d, { recursive: true, force: true });
  });

  test('discarding a draft removes it without signing anything', () => {
    const d = dir();
    draft('c-1', 'dmca-512c', TEXT('c-1'), d);
    discard('c-1', d);
    assert.deepEqual(status(d).pending, []);
    assert.deepEqual(status(d).signed, []);
    rmSync(d, { recursive: true, force: true });
  });
});

describe('A12 — signing writes the audit trail', () => {
  test('a signature appends a verifiable audit entry naming approver, case and evidence', () => {
    const d = dir();
    draft('c-1', 'dmca-512c', TEXT('c-1'), d);
    sign('c-1', 'Dana Okafor', TEXT('c-1'), { dir: d, evidenceRef: 'notion://case/c-1' });
    const logPath = join(d, 'audit.jsonl');
    assert.ok(existsSync(logPath), 'signing must write an audit entry');
    const entry = JSON.parse(readFileSync(logPath, 'utf8').trim().split('\n')[0]);
    assert.equal(entry.actor, 'Dana Okafor');
    assert.equal(entry.action, 'signed dmca-512c');
    assert.equal(entry.caseId, 'c-1');
    assert.equal(entry.evidenceRef, 'notion://case/c-1');
    assert.equal(verifyChain(logPath).ok, true);
    rmSync(d, { recursive: true, force: true });
  });
});

describe('every instrument the skill routes to has a template', () => {
  test('all nine templates exist [R22-R28]', () => {
    for (const i of INSTRUMENTS) {
      assert.ok(existsSync(join('skills/enforce/templates', `${i}.md`)), `missing template: ${i}.md`);
    }
  });

  test('the DMCA template carries all six statutory elements [A8]', () => {
    const t = readFileSync('skills/enforce/templates/dmca-512c.md', 'utf8');
    for (const el of ['element i', 'element ii', 'element iii', 'element iv', 'element v', 'element vi']) {
      assert.ok(t.includes(el), `DMCA template is missing ${el}`);
    }
    assert.match(t, /under penalty of perjury/i);
    assert.match(t, /good faith belief/i);
    assert.match(t, /512\(f\)/, 'the template must warn about misrepresentation liability');
  });

  test('the marketplace template is structurally distinct from the DMCA notice [A9]', () => {
    const dmca = readFileSync('skills/enforce/templates/dmca-512c.md', 'utf8');
    const amazon = readFileSync('skills/enforce/templates/amazon-report.md', 'utf8');
    assert.match(amazon, /Not a DMCA notice/i, 'the marketplace template must say it is not a DMCA notice');
    assert.ok(!amazon.includes('element vi'), 'the marketplace report must not copy the statutory element structure');
    assert.notEqual(dmca, amazon);
  });
});
