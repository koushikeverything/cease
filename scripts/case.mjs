#!/usr/bin/env node
/**
 * Case files and chain of custody — SPEC R17-R21, A7.
 *
 * "Chain of custody" is only real if something records what was captured, when,
 * by what method, and proves it is unmodified since. This module does that: it
 * hashes every captured artifact at the moment of capture and can re-verify the
 * whole set later. A case file that merely asserts custody is a claim.
 *
 * The canonical case lives in the brand's own Notion workspace. This local
 * record carries hashes, paths and metadata — never customer data
 * (security.md rule 11).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { createHash } from 'node:crypto';

export const EVIDENCE_KINDS = ['screenshot', 'page-source', 'whois', 'image', 'ownership-proof', 'first-party-harm', 'note'];

const sha256File = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

export function createCase(id, fields = {}) {
  if (!id) throw new Error('a case needs an id');
  return {
    caseId: id,
    openedAt: fields.openedAt ?? new Date().toISOString(),
    status: 'open',
    subject: {
      url: fields.url ?? null,
      domain: fields.domain ?? null,
      seller: fields.seller ?? null,
      handle: fields.handle ?? null,
    },
    classification: fields.classification ?? null,
    severity: fields.severity ?? null,
    parentCase: fields.parentCase ?? null,
    evidence: [],
    ownershipProof: [],
    linkedHarm: [],
    custody: { verifiedAt: null, ok: null },
  };
}

/**
 * Record one captured artifact. `method` matters as much as the bytes: a
 * screenshot taken by the browser and one pasted by a person are different
 * evidence, and an attorney reading this later needs to know which.
 */
export function addEvidence(kase, { kind, path, url, method, capturedAt, note }) {
  if (!EVIDENCE_KINDS.includes(kind)) throw new Error(`unknown evidence kind "${kind}" — expected one of ${EVIDENCE_KINDS.join(', ')}`);
  if (!method) throw new Error('evidence requires "method" — how it was captured is part of the custody record');
  const entry = {
    kind, url: url ?? null, method,
    path: path ?? null,
    file: path ? basename(path) : null,
    bytes: path && existsSync(path) ? statSync(path).size : null,
    sha256: path && existsSync(path) ? sha256File(path) : null,
    capturedAt: capturedAt ?? new Date().toISOString(),
    note: note ?? null,
  };
  if (path && !existsSync(path)) entry.missing = true;
  kase.evidence.push(entry);
  return entry;
}

/** Re-hash every artifact and report anything altered or missing since capture. */
export function verifyCustody(kase, { baseDir = '.' } = {}) {
  const problems = [];
  for (const e of kase.evidence) {
    if (!e.path) continue;
    const p = join(baseDir, e.path);
    if (!existsSync(p)) { problems.push({ file: e.file, problem: 'missing since capture' }); continue; }
    if (e.sha256 && sha256File(p) !== e.sha256) problems.push({ file: e.file, problem: 'altered since capture' });
  }
  kase.custody = { verifiedAt: new Date().toISOString(), ok: problems.length === 0, problems };
  return kase.custody;
}

/**
 * R22 gate: a DMCA draft needs ownership proof. F7 says a case missing an
 * element cannot be promoted, and must say WHICH element.
 */
export function readinessForDmca(kase) {
  const missing = [];
  if (!kase.evidence.some((e) => e.kind === 'screenshot')) missing.push('a timestamped screenshot of the infringing page');
  if (!kase.evidence.some((e) => e.kind === 'page-source')) missing.push('archived page source');
  if (!kase.ownershipProof?.length) missing.push('ownership proof (original image with EXIF, first-publication date, or trademark registration number)');
  if (!kase.subject?.url) missing.push('the exact location of the infringing material');
  return { ready: missing.length === 0, missing };
}

export function saveCase(kase, path) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(kase, null, 2));
  return path;
}
export const loadCase = (path) => JSON.parse(readFileSync(path, 'utf8'));

// --- CLI ---
if (process.argv[1]?.endsWith('case.mjs')) {
  const [cmd, a, b] = process.argv.slice(2);
  try {
    if (cmd === 'new') { console.log(JSON.stringify(createCase(a, b ? JSON.parse(b) : {}), null, 2)); }
    else if (cmd === 'verify') {
      const k = loadCase(a);
      const r = verifyCustody(k, { baseDir: dirname(a) });
      console.log(r.ok ? `ok    custody intact — ${k.evidence.length} artifact(s)`
                       : `FAIL  ${r.problems.map((p) => `${p.file}: ${p.problem}`).join('; ')}`);
      process.exit(r.ok ? 0 : 1);
    } else if (cmd === 'readiness') {
      const r = readinessForDmca(loadCase(a));
      console.log(r.ready ? 'ok    case has every element a DMCA notice requires'
                          : `not ready — missing:\n  - ${r.missing.join('\n  - ')}`);
      process.exit(r.ready ? 0 : 1);
    } else { console.log('usage: case.mjs new <id> [json] | verify <case.json> | readiness <case.json>'); process.exit(2); }
  } catch (e) { console.error(`error: ${e.message}`); process.exit(1); }
}
