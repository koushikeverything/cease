/**
 * Signature gate tests — SPEC R29, A11, F8.
 *
 * Every assertion names the requirement it encodes. The ENTRYPOINT tests at the
 * bottom drive the hook the way the runtime does (spawn + stdin + stdout JSON),
 * because a safety property validated only through its helper is not validated:
 * a confinement helper can pass every test while nothing calls it.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { decide, hashBody, render, extractBody, countInstrumentPhrases } from '../hooks/signature-gate.mjs';

const GATE = fileURLToPath(new URL('../hooks/signature-gate.mjs', import.meta.url));

const DMCA = [
  'CEASE-Case: c-0042',
  'I have a good faith belief that the use of the material described above is not authorized.',
  'I swear, under penalty of perjury, that the information in this notification is accurate.',
].join('\n');

function ledger({ signed = null, pending = [] } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'cease-gate-'));
  if (signed) {
    mkdirSync(join(dir, 'signatures'), { recursive: true });
    writeFileSync(join(dir, 'signatures', `${signed.caseId}.json`), JSON.stringify(signed));
  }
  if (pending.length) {
    mkdirSync(join(dir, 'pending'), { recursive: true });
    for (const id of pending) writeFileSync(join(dir, 'pending', `${id}.json`), '{}');
  }
  return dir;
}

const send = (body) => ({ tool_name: 'mcp__abc__send_message', tool_input: { body } });

describe('branch A — message text visible', () => {
  test('signed case whose hash matches is allowed [R29]', () => {
    const dir = ledger({ signed: { caseId: 'c-0042', approver: 'Dana', sha256: hashBody(DMCA) } });
    assert.equal(decide(send(DMCA), { dir }).decision, null);
    rmSync(dir, { recursive: true, force: true });
  });

  test('case with NO signature is denied [A11]', () => {
    const dir = ledger();
    const r = decide(send(DMCA), { dir });
    assert.equal(r.decision, 'deny');
    assert.match(r.reason, /no recorded signature/);
    rmSync(dir, { recursive: true, force: true });
  });

  test('signed case whose text was changed after signing is denied [R29]', () => {
    // Sign draft A, try to send draft B — the exact failure the hash exists to stop.
    const dir = ledger({ signed: { caseId: 'c-0042', approver: 'Dana', sha256: hashBody(DMCA) } });
    const tampered = DMCA.replace('not authorized', 'not authorized by us or our agents');
    const r = decide(send(tampered), { dir });
    assert.equal(r.decision, 'deny');
    assert.match(r.reason, /does not match what Dana signed/);
    rmSync(dir, { recursive: true, force: true });
  });

  test('whitespace reformatting does NOT break a valid signature [R29]', () => {
    const dir = ledger({ signed: { caseId: 'c-0042', approver: 'Dana', sha256: hashBody(DMCA) } });
    const reflowed = DMCA.replace(/\n/g, '\n\n  ');
    assert.equal(decide(send(reflowed), { dir }).decision, null);
    rmSync(dir, { recursive: true, force: true });
  });

  test('instrument without a sentinel is denied on phrase match [R29]', () => {
    const body = 'We have a good faith belief this listing is infringing material and demand removal.';
    const r = decide(send(body), { dir: ledger() });
    assert.equal(r.decision, 'deny');
    assert.match(r.reason, /reads as a legal enforcement instrument/);
  });

  test('ordinary email is NOT blocked [over-blocking guard]', () => {
    for (const body of [
      'Hi Sam, attaching the Q3 numbers. Talk tomorrow.',
      'Can you send the updated invoice for order 5512?',
      'Reminder: standup moved to 10am.',
    ]) {
      assert.equal(decide(send(body), { dir: ledger() }).decision, null, `blocked ordinary mail: ${body}`);
    }
  });

  test('one legal phrase alone is not enough to block [over-blocking guard]', () => {
    const body = 'Our lawyer mentioned the DMCA process — can we discuss on Thursday?';
    assert.equal(countInstrumentPhrases(body), 1);
    assert.equal(decide(send(body), { dir: ledger() }).decision, null);
  });
});

describe('branch B — message text NOT visible to the hook', () => {
  test('denies while an unsigned instrument is pending [R29 fallback]', () => {
    const dir = ledger({ pending: ['c-0042'] });
    const r = decide({ tool_name: 'mcp__abc__send_message', tool_input: {} }, { dir });
    assert.equal(r.decision, 'deny');
    assert.match(r.reason, /could not be inspected/);
    rmSync(dir, { recursive: true, force: true });
  });

  test('allows when nothing is pending, so ordinary mail still works', () => {
    const dir = ledger();
    assert.equal(decide({ tool_name: 'mcp__abc__send_message', tool_input: {} }, { dir }).decision, null);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe('fail-closed behaviour [F8]', () => {
  test('no data directory at all still denies a sentinel-bearing send', () => {
    const r = decide(send(DMCA), { dir: null });
    assert.equal(r.decision, 'deny');
  });

  test('unreadable ledger denies rather than permitting', () => {
    const dir = ledger();
    mkdirSync(join(dir, 'signatures'), { recursive: true });
    writeFileSync(join(dir, 'signatures', 'c-0042.json'), '{ this is not json');
    assert.equal(decide(send(DMCA), { dir }).decision, 'deny');
    rmSync(dir, { recursive: true, force: true });
  });

  test('there is no expiry or timeout that converts absence of a signature into permission [F8]', () => {
    const dir = ledger({ signed: { caseId: 'c-0042', approver: 'Dana', sha256: hashBody(DMCA), signedAt: '1999-01-01T00:00:00Z' } });
    // An ancient signature that still matches the text is honoured; nothing in the
    // gate grants permission because time passed with no signature.
    assert.equal(decide(send(DMCA), { dir }).decision, null);
    assert.equal(decide(send(DMCA), { dir: ledger() }).decision, 'deny');
    rmSync(dir, { recursive: true, force: true });
  });
});

describe('body extraction across connector payload shapes', () => {
  test('finds the text in nested and alternate fields', () => {
    assert.match(extractBody({ body: DMCA }), /CEASE-Case/);
    assert.match(extractBody({ message: { body: DMCA } }), /CEASE-Case/);
    assert.match(extractBody({ text: DMCA }), /CEASE-Case/);
    assert.match(extractBody({ html: DMCA }), /CEASE-Case/);
  });
  test('ignores non-text fields so metadata cannot be mistaken for a body', () => {
    assert.equal(extractBody({ to: 'a@b.com', threadId: 'x1' }).trim(), '');
  });
});

describe('ENTRYPOINT — the hook as the runtime actually invokes it [A11]', () => {
  const run = (payload, env) => {
    const out = execFileSync('node', [GATE], {
      input: JSON.stringify(payload),
      env: { ...process.env, ...env },
      encoding: 'utf8',
    });
    return out.trim() ? JSON.parse(out) : null;
  };

  test('unsigned instrument is blocked end to end, in the documented output shape', () => {
    const dir = ledger();
    const res = run({ hook_event_name: 'PreToolUse', tool_name: 'mcp__abc__send_message', tool_input: { body: DMCA } },
                    { CEASE_DATA_DIR: dir });
    assert.ok(res, 'hook produced no output — the send would have proceeded');
    assert.equal(res.hookSpecificOutput.hookEventName, 'PreToolUse');
    assert.equal(res.hookSpecificOutput.permissionDecision, 'deny');
    assert.match(res.hookSpecificOutput.permissionDecisionReason, /signature/i);
    rmSync(dir, { recursive: true, force: true });
  });

  test('signed instrument passes end to end with no decision emitted', () => {
    const dir = ledger({ signed: { caseId: 'c-0042', approver: 'Dana', sha256: hashBody(DMCA) } });
    const res = run({ hook_event_name: 'PreToolUse', tool_name: 'mcp__abc__send_message', tool_input: { body: DMCA } },
                    { CEASE_DATA_DIR: dir });
    assert.equal(res, null, 'hook emitted a decision for a correctly signed instrument');
    rmSync(dir, { recursive: true, force: true });
  });

  test('ordinary mail passes end to end', () => {
    const dir = ledger();
    assert.equal(run({ tool_name: 'mcp__abc__send_message', tool_input: { body: 'lunch at 1?' } }, { CEASE_DATA_DIR: dir }), null);
    rmSync(dir, { recursive: true, force: true });
  });

  test('malformed hook input does not silently permit a send', () => {
    const dir = ledger({ pending: ['c-0042'] });
    const out = execFileSync('node', [GATE], { input: 'not json at all', env: { ...process.env, CEASE_DATA_DIR: dir }, encoding: 'utf8' });
    const res = out.trim() ? JSON.parse(out) : null;
    assert.equal(res?.hookSpecificOutput?.permissionDecision, 'deny');
    rmSync(dir, { recursive: true, force: true });
  });
});

describe('the gate is reachable from the entrypoint [security.md rule 2]', () => {
  test('main() calls decide() — the enforcing symbol has a non-test caller', async () => {
    const src = await import('node:fs').then((fs) => fs.readFileSync(GATE, 'utf8'));
    const mainBody = src.slice(src.indexOf('export async function main()'));
    assert.match(mainBody, /render\(decide\(/, 'main() must call decide(); an unreached gate enforces nothing');
    assert.match(src, /signature-gate\.mjs'\)\)\s*\{\s*\n\s*main\(\);/, 'the module must invoke main() when executed directly');
  });
});
