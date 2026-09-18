/** Audit log tests — SPEC R30, A12. */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { appendEntry, verifyChain, readLog } from '../scripts/audit-append.mjs';

const fresh = () => join(mkdtempSync(join(tmpdir(), 'cease-audit-')), 'audit.jsonl');

const sign = (n) => ({ actor: `Approver ${n}`, action: 'signed', caseId: `c-000${n}`, instrument: 'dmca-512c', evidenceRef: `notion://case/${n}`, sha256: 'a'.repeat(64) });

describe('append-only audit log', () => {
  test('an entry records who approved what, on what evidence, when [A12]', () => {
    const p = fresh();
    const e = appendEntry(sign(1), p);
    assert.equal(e.actor, 'Approver 1');
    assert.equal(e.action, 'signed');
    assert.equal(e.caseId, 'c-0001');
    assert.equal(e.evidenceRef, 'notion://case/1');
    assert.match(e.ts, /^\d{4}-\d{2}-\d{2}T/);
    rmSync(p, { force: true });
  });

  test('an entry missing its approver is refused [A12]', () => {
    const p = fresh();
    assert.throws(() => appendEntry({ action: 'signed' }, p), /requires "actor"/);
    assert.throws(() => appendEntry({ actor: 'Dana' }, p), /requires "action"/);
  });

  test('a clean chain verifies [R30]', () => {
    const p = fresh();
    for (let i = 1; i <= 4; i++) appendEntry(sign(i), p);
    const r = verifyChain(p);
    assert.equal(r.ok, true);
    assert.equal(r.length, 4);
  });

  test('editing an entry in place is detected [R30 — the log cannot be rewritten]', () => {
    const p = fresh();
    for (let i = 1; i <= 3; i++) appendEntry(sign(i), p);
    const lines = readFileSync(p, 'utf8').trim().split('\n');
    const tampered = JSON.parse(lines[1]);
    tampered.actor = 'Someone Else';               // rewrite history
    lines[1] = JSON.stringify(tampered);
    writeFileSync(p, lines.join('\n') + '\n');
    const r = verifyChain(p);
    assert.equal(r.ok, false);
    assert.equal(r.brokenAt, 2);
    assert.match(r.reason, /do not match its own hash/);
  });

  test('deleting an entry is detected [R30]', () => {
    const p = fresh();
    for (let i = 1; i <= 3; i++) appendEntry(sign(i), p);
    const lines = readFileSync(p, 'utf8').trim().split('\n');
    writeFileSync(p, [lines[0], lines[2]].join('\n') + '\n');
    const r = verifyChain(p);
    assert.equal(r.ok, false);
    assert.match(r.reason, /removed or reordered/);
  });

  test('re-hashing a tampered entry still breaks the chain downstream [R30]', () => {
    // The sophisticated tamper: edit an entry AND fix its own hash.
    const p = fresh();
    for (let i = 1; i <= 3; i++) appendEntry(sign(i), p);
    const lines = readFileSync(p, 'utf8').trim().split('\n');
    const e = JSON.parse(lines[1]);
    e.actor = 'Someone Else';
    const { hash, ...rest } = e;
    e.hash = createHash('sha256').update(JSON.stringify(rest, Object.keys(rest).sort()), 'utf8').digest('hex');
    lines[1] = JSON.stringify(e);
    writeFileSync(p, lines.join('\n') + '\n');
    const r = verifyChain(p);
    assert.equal(r.ok, false, 'a re-hashed edit must still break the following entry');
    assert.equal(r.brokenAt, 3);
  });

  test('a corrupt line is reported, not silently skipped [R30]', () => {
    const p = fresh();
    appendEntry(sign(1), p);
    writeFileSync(p, readFileSync(p, 'utf8') + '{ broken\n');
    assert.equal(verifyChain(p).ok, false);
  });
});
