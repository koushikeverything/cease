#!/usr/bin/env node
/**
 * The signing ledger — the state the PreToolUse gate reads (SPEC R29, R30, A11, A12).
 *
 * draft() records an instrument as pending and unsigned. sign() records that a
 * NAMED human approved the exact text, hashed. hooks/signature-gate.mjs reads
 * both: a pending-and-unsigned instrument blocks sends it cannot inspect, and a
 * signature only permits the exact text it was given.
 *
 * What a signature means here, stated honestly: an in-session confirmation by a
 * person, recorded with an audit trail. It is NOT a cryptographic signature and
 * must never be described as one. DocuSign is the upgrade path.
 *
 * security.md rule 8: the approver name is recorded, never trusted as
 * authentication. A name in config cannot satisfy R29 — a live human act can.
 */
import { writeFileSync, existsSync, mkdirSync, readFileSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { hashBody } from '../hooks/signature-gate.mjs';
import { appendEntry } from './audit-append.mjs';

export const INSTRUMENTS = [
  'dmca-512c', 'amazon-report', 'meta-ip-form', 'tiktok-ipp', 'registrar-abuse',
  'cloudflare-abuse', 'payment-processor', 'cease-and-desist', 'counter-notice-response',
];

export function dataDir() {
  const d = process.env.CEASE_DATA_DIR || process.env.CLAUDE_PLUGIN_DATA;
  if (!d) throw new Error('no data directory — set CLAUDE_PLUGIN_DATA (or CEASE_DATA_DIR for local runs)');
  return d;
}

/** Every instrument carries this line so the gate can find its case. */
export const sentinelFor = (caseId) => `CEASE-Case: ${caseId}`;

export function draft(caseId, instrument, text, dir = dataDir()) {
  if (!caseId) throw new Error('drafting requires a case id');
  if (!INSTRUMENTS.includes(instrument)) throw new Error(`unknown instrument "${instrument}" — expected one of ${INSTRUMENTS.join(', ')}`);
  if (!text?.includes(sentinelFor(caseId)))
    throw new Error(`the drafted text must contain its case sentinel "${sentinelFor(caseId)}" — without it the signature gate cannot match a signature to this send`);
  mkdirSync(join(dir, 'pending'), { recursive: true });
  const record = { caseId, instrument, draftedAt: new Date().toISOString(), sha256: hashBody(text) };
  writeFileSync(join(dir, 'pending', `${caseId}.json`), JSON.stringify(record, null, 2));
  return record;
}

/**
 * Record a human's approval of the exact drafted text.
 * Refuses if the text differs from what was drafted — signing must be an act on
 * something the person actually saw.
 */
export function sign(caseId, approver, text, { dir = dataDir(), evidenceRef = null, auditLog = null } = {}) {
  if (!approver || !String(approver).trim()) throw new Error('signing requires the name of the person approving it');
  const pendingPath = join(dir, 'pending', `${caseId}.json`);
  if (!existsSync(pendingPath)) throw new Error(`case ${caseId} has no drafted instrument to sign — run the draft step first`);
  const pending = JSON.parse(readFileSync(pendingPath, 'utf8'));
  const sha256 = hashBody(text);
  if (sha256 !== pending.sha256)
    throw new Error('the text being signed is not the text that was drafted — re-draft, show it to the approver, and sign that');

  mkdirSync(join(dir, 'signatures'), { recursive: true });
  const record = { caseId, instrument: pending.instrument, approver: String(approver).trim(), signedAt: new Date().toISOString(), sha256, evidenceRef };
  writeFileSync(join(dir, 'signatures', `${caseId}.json`), JSON.stringify(record, null, 2));
  rmSync(pendingPath, { force: true });

  appendEntry({ actor: record.approver, action: `signed ${record.instrument}`, caseId, instrument: record.instrument, evidenceRef, sha256 },
              auditLog ?? join(dir, 'audit.jsonl'));
  return record;
}

export function discard(caseId, dir = dataDir()) {
  rmSync(join(dir, 'pending', `${caseId}.json`), { force: true });
}

export function status(dir = dataDir()) {
  const list = (sub) => (existsSync(join(dir, sub)) ? readdirSync(join(dir, sub)).filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', '')) : []);
  return { pending: list('pending'), signed: list('signatures') };
}

// --- CLI ---
if (process.argv[1]?.endsWith('sign.mjs')) {
  const [cmd, a, b, c] = process.argv.slice(2);
  try {
    if (cmd === 'draft') { const r = draft(a, b, readFileSync(c, 'utf8')); console.log(`drafted ${r.instrument} for ${r.caseId} — awaiting signature`); }
    else if (cmd === 'sign') { const r = sign(a, b, readFileSync(c, 'utf8')); console.log(`signed: ${r.instrument} for ${r.caseId} by ${r.approver} at ${r.signedAt}`); }
    else if (cmd === 'discard') { discard(a); console.log(`discarded the draft for ${a}`); }
    else if (cmd === 'status') { console.log(JSON.stringify(status(), null, 2)); }
    else { console.log('usage: sign.mjs draft <caseId> <instrument> <file> | sign <caseId> "<approver>" <file> | discard <caseId> | status'); process.exit(2); }
  } catch (e) { console.error(`error: ${e.message}`); process.exit(1); }
}
