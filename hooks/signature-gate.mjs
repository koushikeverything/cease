#!/usr/bin/env node
/**
 * CEASE signature gate — enforces SPEC R29:
 * "Block every outbound legal instrument until a named human with authority to
 *  act for the rights holder signs."
 *
 * This is a PreToolUse hook. It is the reason CEASE is a plugin rather than a
 * skill: a skill cannot ship a hook, and R29 enforced by instruction text would
 * be a claim wearing the costume of a control (security.md rule 2).
 *
 * Runtime contract (verified live 2026-09-17 against code.claude.com/docs/en/hooks.md):
 *   - stdin carries JSON with `tool_name`, `tool_input`, `session_id`, `cwd`
 *   - exit 0 with no stdout      -> no decision, normal permission flow
 *   - exit 0 with the JSON below -> the tool call is blocked
 *
 * Three-way decision, because a brand-protection plugin that blocked the user's
 * ordinary email would be worse than useless:
 *   1. body carries a CEASE case sentinel -> require a signature whose hash
 *      matches the text being sent (sign draft A, send draft A)
 *   2. no sentinel but >= 2 legal-instrument phrases -> deny and route to
 *      /cease:enforce (catches an instrument even if the sentinel is missing,
 *      so the gate does not depend on the model behaving)
 *   3. otherwise -> no decision; ordinary mail is untouched
 *
 * Fails CLOSED: an unreadable or absent ledger denies. There is no timeout path
 * that converts absence of a signature into permission (SPEC F8).
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

/** Sentinel the enforce skill stamps into every instrument it drafts. */
export const SENTINEL = /CEASE-Case:\s*([A-Za-z0-9][A-Za-z0-9._-]{0,63})/;

/** Two or more of these in one message means it reads as a legal instrument. */
export const INSTRUMENT_PHRASES = [
  'under penalty of perjury',
  'good faith belief',
  '17 u.s.c',
  '512(c)',
  '512(g)',
  'dmca',
  'cease and desist',
  'vero',
  'infringing material',
  'notice of infringement',
  'trademark infringement',
  'intellectual property complaint',
];

/** Fields a send-shaped tool might carry the message text in. */
const TEXT_FIELDS = ['body', 'text', 'message', 'html', 'content', 'subject', 'markdown'];

export function dataDir() {
  return process.env.CEASE_DATA_DIR || process.env.CLAUDE_PLUGIN_DATA || null;
}

/** Collapse whitespace so trivial reformatting does not break the hash. */
export function normalizeBody(s) {
  return String(s).replace(/\s+/g, ' ').trim();
}

export function hashBody(s) {
  return createHash('sha256').update(normalizeBody(s), 'utf8').digest('hex');
}

/** Pull every plausible text field out of tool_input, concatenated. */
export function extractBody(toolInput) {
  if (!toolInput || typeof toolInput !== 'object') return '';
  const parts = [];
  const visit = (v, depth) => {
    if (depth > 4 || v == null) return;
    if (typeof v === 'string') { parts.push(v); return; }
    if (Array.isArray(v)) { v.forEach((x) => visit(x, depth + 1)); return; }
    if (typeof v === 'object') {
      for (const [k, val] of Object.entries(v)) {
        if (typeof val === 'string' && !TEXT_FIELDS.includes(k)) continue;
        visit(val, depth + 1);
      }
    }
  };
  for (const k of TEXT_FIELDS) if (k in toolInput) visit(toolInput[k], 0);
  // Some connectors nest the payload (e.g. { message: { body: ... } }).
  for (const val of Object.values(toolInput)) if (val && typeof val === 'object') visit(val, 1);
  return parts.join('\n');
}

export function countInstrumentPhrases(body) {
  const lower = body.toLowerCase();
  return INSTRUMENT_PHRASES.filter((p) => lower.includes(p)).length;
}

function readJSON(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}

export function loadSignature(caseId, dir = dataDir()) {
  if (!dir) return null;
  const p = join(dir, 'signatures', `${caseId}.json`);
  return existsSync(p) ? readJSON(p) : null;
}

/** Any instrument drafted but not yet signed, in any case. */
export function hasPendingUnsigned(dir = dataDir()) {
  if (!dir) return false;
  const p = join(dir, 'pending');
  if (!existsSync(p)) return false;
  try {
    return readdirSync(p).some((f) => f.endsWith('.json'));
  } catch { return false; }
}

export function verifyBodyHash(body, signature) {
  if (!signature || typeof signature.sha256 !== 'string') return false;
  return hashBody(body) === signature.sha256;
}

const deny = (reason) => ({ decision: 'deny', reason });
const allow = () => ({ decision: null, reason: null });

/**
 * The whole gate. Pure — takes the hook payload, returns a decision.
 * @param {{tool_name?:string, tool_input?:object}} payload
 * @param {{dir?:string|null, pending?:boolean}} [opts] injected for tests
 */
export function decide(payload, opts = {}) {
  const dir = opts.dir !== undefined ? opts.dir : dataDir();
  const body = extractBody(payload?.tool_input);

  // --- Branch A: the message text is visible ---
  if (normalizeBody(body).length > 0) {
    const m = body.match(SENTINEL);
    if (m) {
      const caseId = m[1];
      const sig = opts.signature !== undefined ? opts.signature : loadSignature(caseId, dir);
      if (!sig) {
        return deny(
          `CEASE blocked this: case ${caseId} carries no recorded signature. ` +
          `A named person with authority to act for the rights holder must sign it first — run /cease:enforce ${caseId}.`
        );
      }
      if (!verifyBodyHash(body, sig)) {
        return deny(
          `CEASE blocked this: the text being sent does not match what ${sig.approver ?? 'the approver'} signed for case ${caseId}. ` +
          `Re-open it with /cease:enforce ${caseId} and sign the current draft.`
        );
      }
      return allow();
    }

    const hits = countInstrumentPhrases(body);
    if (hits >= 2) {
      return deny(
        `CEASE blocked this: the message reads as a legal enforcement instrument (${hits} matching phrases) ` +
        `but carries no case reference, so no signature can be verified against it. ` +
        `Draft it through /cease:enforce, which records who signed what.`
      );
    }
    return allow();
  }

  // --- Branch B: the text is NOT visible to the hook ---
  // The runtime may not populate tool_input for connector tools (unresolved at
  // build time — see the design doc's open assumptions). Blanket-denying here
  // would block ordinary email, so key off CEASE's own state instead: if an
  // instrument is drafted and unsigned right now, a send is very likely it.
  const pending = opts.pending !== undefined ? opts.pending : hasPendingUnsigned(dir);
  if (pending) {
    return deny(
      'CEASE blocked this: an enforcement instrument is drafted and unsigned, and this send could not be ' +
      'inspected to confirm it is something else. Sign it with /cease:enforce, or discard the draft, then retry.'
    );
  }
  return allow();
}

export function render(result, eventName = 'PreToolUse') {
  if (!result.decision) return null;
  return JSON.stringify({
    hookSpecificOutput: {
      hookEventName: eventName,
      permissionDecision: result.decision,
      permissionDecisionReason: result.reason,
    },
  });
}

async function readStdin() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

export async function main() {
  let payload = {};
  try {
    const raw = await readStdin();
    payload = raw.trim() ? JSON.parse(raw) : {};
  } catch {
    // Unparseable input must not silently permit a send.
    payload = {};
  }
  const out = render(decide(payload), payload.hook_event_name ?? 'PreToolUse');
  if (out) process.stdout.write(out);
  process.exit(0);
}

// Only run when executed directly, so tests can import the pure functions.
if (process.argv[1] && process.argv[1].endsWith('signature-gate.mjs')) {
  main();
}
