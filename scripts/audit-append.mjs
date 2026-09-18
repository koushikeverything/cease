#!/usr/bin/env node
/**
 * Append-only, hash-chained audit log — SPEC R30, A12.
 *
 * "Produce an append-only audit log: who approved what, on what evidence, on
 *  what date." Append-only is enforced by construction: every entry carries the
 * hash of the one before it, so editing or removing any entry breaks the chain
 * and verifyChain() reports exactly where.
 *
 * This is the local, tamper-evident copy. The canonical human-readable log is
 * mirrored into the brand's own Notion workspace (R30) — private case content
 * belongs there, not in plugin data (security.md rule 11). Entries here carry
 * references and hashes, never message bodies or customer data.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';

export const GENESIS = '0'.repeat(64);

const canonical = (o) => JSON.stringify(o, Object.keys(o).sort());

export function entryHash(entry) {
  const { hash, ...rest } = entry;
  return createHash('sha256').update(canonical(rest), 'utf8').digest('hex');
}

export function readLog(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((l) => l.trim())
    .map((l, i) => {
      try { return JSON.parse(l); }
      catch { throw new Error(`audit log line ${i + 1} is not valid JSON — the log is corrupt`); }
    });
}

/**
 * Append one entry. Never rewrites, never reorders.
 * @param {{actor:string, action:string, caseId?:string, instrument?:string,
 *          evidenceRef?:string, sha256?:string}} fields
 */
export function appendEntry(fields, path) {
  if (!fields?.actor) throw new Error('audit entry requires "actor" — who approved this');
  if (!fields?.action) throw new Error('audit entry requires "action" — what they approved');

  const log = readLog(path);
  const prev = log.at(-1);
  const prevHash = prev ? prev.hash : GENESIS;

  const entry = {
    seq: log.length + 1,
    ts: fields.ts ?? new Date().toISOString(),
    actor: fields.actor,
    action: fields.action,
    caseId: fields.caseId ?? null,
    instrument: fields.instrument ?? null,
    evidenceRef: fields.evidenceRef ?? null,
    sha256: fields.sha256 ?? null,
    prevHash,
  };
  entry.hash = entryHash(entry);

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, (log.length ? '' : '') + JSON.stringify(entry) + '\n', { flag: 'a' });
  return entry;
}

/** @returns {{ok:boolean, length:number, brokenAt?:number, reason?:string}} */
export function verifyChain(path) {
  let log;
  try { log = readLog(path); }
  catch (e) { return { ok: false, length: 0, brokenAt: 0, reason: e.message }; }

  let prevHash = GENESIS;
  for (let i = 0; i < log.length; i++) {
    const e = log[i];
    if (e.seq !== i + 1)
      return { ok: false, length: log.length, brokenAt: i + 1, reason: `entry ${i + 1} has seq ${e.seq} — an entry was removed or reordered` };
    if (e.prevHash !== prevHash)
      return { ok: false, length: log.length, brokenAt: i + 1, reason: `entry ${i + 1} does not chain to the previous entry — the log was edited` };
    if (entryHash(e) !== e.hash)
      return { ok: false, length: log.length, brokenAt: i + 1, reason: `entry ${i + 1} contents do not match its own hash — the entry was altered` };
    prevHash = e.hash;
  }
  return { ok: true, length: log.length };
}

// --- CLI ---
if (process.argv[1]?.endsWith('audit-append.mjs')) {
  const [cmd, a, b] = process.argv.slice(2);
  try {
    if (cmd === 'append') {
      const e = appendEntry(JSON.parse(a), b);
      console.log(`appended #${e.seq} ${e.action} by ${e.actor}`);
    } else if (cmd === 'verify') {
      const r = verifyChain(a);
      console.log(r.ok ? `ok    audit chain intact — ${r.length} entr${r.length === 1 ? 'y' : 'ies'}`
                       : `FAIL  audit chain broken at entry ${r.brokenAt}: ${r.reason}`);
      process.exit(r.ok ? 0 : 1);
    } else {
      console.log('usage: audit-append.mjs append \'<json>\' <logfile>  |  verify <logfile>');
      process.exit(2);
    }
  } catch (e) { console.error(`error: ${e.message}`); process.exit(1); }
}
