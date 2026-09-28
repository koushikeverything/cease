/** Case file and chain-of-custody tests — SPEC R17-R21, A7, F7. */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createCase, addEvidence, verifyCustody, readinessForDmca, EVIDENCE_KINDS } from '../scripts/case.mjs';

const workspace = () => mkdtempSync(join(tmpdir(), 'cease-case-'));
const artifact = (dir, name, body) => { const p = join(dir, name); writeFileSync(p, body); return p; };

describe('A7 — an evidence capture is recorded with method and hash', () => {
  test('a screenshot and page source are recorded with hashes [A7]', () => {
    const dir = workspace();
    const k = createCase('c-0001', { url: 'https://fake.example/p/1', domain: 'fake.example' });
    addEvidence(k, { kind: 'screenshot', path: artifact(dir, 'shot.png', 'PNGDATA'), method: 'browser full-page capture', url: 'https://fake.example/p/1' });
    addEvidence(k, { kind: 'page-source', path: artifact(dir, 'page.html', '<html>counterfeit</html>'), method: 'browser view-source save' });
    assert.equal(k.evidence.length, 2);
    for (const e of k.evidence) {
      assert.match(e.sha256, /^[0-9a-f]{64}$/, 'every artifact must be hashed at capture');
      assert.ok(e.method, 'method is part of the custody record');
      assert.match(e.capturedAt, /^\d{4}-\d{2}-\d{2}T/);
    }
    rmSync(dir, { recursive: true, force: true });
  });

  test('evidence without a capture method is refused [R21]', () => {
    const k = createCase('c-0001');
    assert.throws(() => addEvidence(k, { kind: 'screenshot', path: null }), /requires "method"/);
  });

  test('an unknown evidence kind is refused with the valid list [R21]', () => {
    const k = createCase('c-0001');
    assert.throws(() => addEvidence(k, { kind: 'vibes', method: 'x' }), /unknown evidence kind/);
    assert.ok(EVIDENCE_KINDS.includes('first-party-harm'));
  });
});

describe('custody is verified, not asserted [R21]', () => {
  test('an intact capture set verifies', () => {
    const dir = workspace();
    const k = createCase('c-0001');
    addEvidence(k, { kind: 'screenshot', path: artifact(dir, 'shot.png', 'PNGDATA'), method: 'browser' });
    assert.equal(verifyCustody(k, { baseDir: dir }).ok, true);
    rmSync(dir, { recursive: true, force: true });
  });

  test('an artifact edited after capture is reported as altered [R21]', () => {
    const dir = workspace();
    const k = createCase('c-0001');
    const p = artifact(dir, 'shot.png', 'PNGDATA');
    addEvidence(k, { kind: 'screenshot', path: p, method: 'browser' });
    writeFileSync(p, 'PNGDATA-cropped-and-annotated');   // the tempting, fatal edit
    const r = verifyCustody(k, { baseDir: dir });
    assert.equal(r.ok, false);
    assert.equal(r.problems[0].problem, 'altered since capture');
    rmSync(dir, { recursive: true, force: true });
  });

  test('an artifact deleted after capture is reported as missing [R21]', () => {
    const dir = workspace();
    const k = createCase('c-0001');
    addEvidence(k, { kind: 'page-source', path: artifact(dir, 'page.html', '<html>'), method: 'browser' });
    rmSync(join(dir, 'page.html'));
    const r = verifyCustody(k, { baseDir: dir });
    assert.equal(r.ok, false);
    assert.equal(r.problems[0].problem, 'missing since capture');
    rmSync(dir, { recursive: true, force: true });
  });
});

describe('F7 — an incomplete case cannot become a DMCA notice', () => {
  test('an empty case names every missing element [F7]', () => {
    const r = readinessForDmca(createCase('c-0001'));
    assert.equal(r.ready, false);
    assert.equal(r.missing.length, 4);
    assert.ok(r.missing.some((m) => /ownership proof/.test(m)));
  });

  test('a case missing only ownership proof says exactly that [F7]', () => {
    const dir = workspace();
    const k = createCase('c-0001', { url: 'https://fake.example/p/1' });
    addEvidence(k, { kind: 'screenshot', path: artifact(dir, 's.png', 'x'), method: 'browser' });
    addEvidence(k, { kind: 'page-source', path: artifact(dir, 'p.html', 'y'), method: 'browser' });
    const r = readinessForDmca(k);
    assert.equal(r.ready, false);
    assert.equal(r.missing.length, 1);
    assert.match(r.missing[0], /ownership proof/);
    rmSync(dir, { recursive: true, force: true });
  });

  test('a complete case is ready [F7]', () => {
    const dir = workspace();
    const k = createCase('c-0001', { url: 'https://fake.example/p/1' });
    addEvidence(k, { kind: 'screenshot', path: artifact(dir, 's.png', 'x'), method: 'browser' });
    addEvidence(k, { kind: 'page-source', path: artifact(dir, 'p.html', 'y'), method: 'browser' });
    k.ownershipProof.push({ kind: 'trademark', number: '5,123,456', class: 11 });
    assert.equal(readinessForDmca(k).ready, true);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe('custody verification handles both path shapes [R21 regression]', () => {
  test('an absolute evidence path verifies without a baseDir', () => {
    // Regression: verifyCustody joined baseDir onto already-absolute paths,
    // producing a path that never exists and reporting EVERY artifact as
    // missing — chain of custody broken for every real case.
    const dir = workspace();
    const k = createCase('c-0001');
    addEvidence(k, { kind: 'screenshot', path: artifact(dir, 'abs.png', 'DATA'), method: 'browser' });
    assert.equal(verifyCustody(k).ok, true, 'absolute paths must verify');
    assert.equal(verifyCustody(k, { baseDir: '/somewhere/else' }).ok, true, 'baseDir must not corrupt an absolute path');
    rmSync(dir, { recursive: true, force: true });
  });

  test('a relative evidence path still verifies against its baseDir', () => {
    const dir = workspace();
    const k = createCase('c-0001');
    artifact(dir, 'rel.png', 'DATA');
    addEvidence(k, { kind: 'screenshot', path: join(dir, 'rel.png'), method: 'browser' });
    k.evidence[0].path = 'rel.png';                       // as stored relative to the case file
    k.evidence[0].sha256 = createHash('sha256').update('DATA').digest('hex');
    assert.equal(verifyCustody(k, { baseDir: dir }).ok, true);
    rmSync(dir, { recursive: true, force: true });
  });
});
