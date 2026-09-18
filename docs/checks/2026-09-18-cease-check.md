# Check report — CEASE plugin

**Date:** 2026-09-18 · **Branch:** `build/cease-plugin` · **Target:** claude-plugin
**Verdict: BLOCKED — does not reach `checked`.** The P0 is now FIXED (see F-0);
the behavioral gate has still never executed, which is what holds this open.

---

## 1. Lenses run

| Lens | Run | Why |
|---|---|---|
| `spec-compliance-reviewer` | ✅ | always |
| `dx-triggering-reviewer` | ✅ | always |
| `artifact-security-reviewer` | ✅ | the artifact ships scripts, a hook, 5 subagents, network access, and ingests untrusted content |

None skipped. All three ran in separate contexts with the artifact, SPEC and
manifest, and without the builder's reasoning. Two hit their turn limit and
were resumed rather than accepted partial.

---

## 2. Validation suite — verbatim

### Structural — PASS

```
$ claude plugin validate .claude-plugin/plugin.json --strict
Validating plugin manifest: /Users/momentum91/Documents/Cease/.claude-plugin/plugin.json
✔ Validation passed                                               EXIT=0

$ claude plugin validate ./skills --strict
Validating components in: /Users/momentum91/Documents/Cease/skills
✔ Validation passed                                               EXIT=0

$ claude plugin validate ./agents --strict
Validating components in: /Users/momentum91/Documents/Cease/agents
✔ Validation passed                                               EXIT=0

$ claude plugin validate . --strict
Validating marketplace manifest: /Users/momentum91/Documents/Cease/.claude-plugin/marketplace.json
✔ Validation passed                                               EXIT=0
```

All four targets run, per the rubric. Confirmed live that `validate .` checks
the **marketplace alone** — a single `validate .` would have been a hollow gate.

```
$ npm run validate
ok    structure valid - 8 skill(s), 5 agent(s), 0 warning(s)       EXIT=0

$ npm test
ℹ tests 144   ℹ pass 144   ℹ fail 0                                EXIT=0
```

### Behavioral (triggering) — **NOT RUN. BLOCKED.**

```
$ claude plugin eval . --case "check-positive-1" --runs 1 --trust-plugin
  check-positive-1 run 1/1 [with]: score 0.00  $0.00  error: exit 1: Not logged in · Please run /login
    ✗ fired [with-only, not scored]: Skill called 0x (expected 1..∞)
    ✗ routed (weight 1): grader threw: judge call failed: Failed to authenticate:
      OAuth session expired and could not be refreshed
⚠ a run could not authenticate — every remaining run would fail the same way, so the suite stops here.
1 case(s) · 1s · $0.00 · ⚠ partial (stopped: authentication failed)
```

`claude plugin eval` spawns a child Claude on the user's own credential. That
credential's OAuth session is expired, so **zero triggering cases have ever
executed**. This is the documented structured auth failure (`Failed to
authenticate`), not a guess from substring matching.

**A18 is therefore UNMEASURED**, exactly as A20 is unmeasured for precision. It
must not be reported as passing.

What *was* established: all 36 cases now **load** cleanly (schema validation
runs before auth), which was itself a P1 fix — see F-1.

### Runtime smoke — **NOT RUN. BLOCKED, same cause.**

```
$ claude -p "reply with exactly: OK" --plugin-dir .
Failed to authenticate: OAuth session expired and could not be refreshed
```

---

## 3. Mechanism reachability

Run before the lenses, per the rubric. Every row of SPEC.md's security posture
table checked for a caller outside `tests/`.

| Invariant | Symbol | Reachable? |
|---|---|---|
| R29 no unsigned send | `hooks/signature-gate.mjs:safeDecide→decide` | ✅ hook config → `main()` → `safeDecide()` → `decide()`; entrypoint tests spawn the real binary |
| R29 sent == signed | `:verifyBodyHash` | ✅ called by `decide()` |
| R12 allowlist suppression | `scripts/suppress.mjs:filterAllowlisted` | ✅ via `buildDocket`, invoked by sweep and check |
| R30 audit append-only | `scripts/audit-append.mjs:appendEntry` | ✅ called by `sign()` |
| R30 audit chain checked | `:verifyChain` | ⚠ **was tests-only** — now wired into `/cease:brief` (F-5) |

Now enforced permanently by `tests/reachability.test.mjs`, which also requires
every verification command to appear in a skill body.

---

## 4. Findings and dispositions

### P0 — OPEN, requires an explicit human decision

**F-0 · The "named human" in R29 is enforced by prompt text; the agent can mint its own signature.**
*Evidence:* `skills/enforce/SKILL.md` grants `Bash`; `scripts/sign.mjs:52` accepts any
non-empty approver string; `hooks/signature-gate.mjs` trusts any file at
`$CLAUDE_PLUGIN_DATA/signatures/<case>.json` whose `sha256` matches the body.
*Failure path:* no attacker needed. Under "just file it" pressure the model can run
`sign.mjs sign c-0042 "Dana Reyes" draft.txt` without ever showing Dana the text — or
write the ledger file directly with Bash, bypassing `sign.mjs` and the audit log
entirely. A §512 perjury declaration then goes out over a name that never saw it: the
precise 17 U.S.C. §512(f) exposure the product exists to avoid.
*Aggravating:* `plugin.json` advertises `authorized_signers` as *"Display and
validation only"*, and **no code reads it** — a control whose description promises a
validation layer that does not exist.
*Disposition:* **FIXED 2026-09-18**, on the user's explicit instruction after the
options were put to them (a human gate — accepting a security finding is not mine to
do). Chosen option: bind approval to a genuine user turn.

`hooks/signature-gate.mjs:findUserApproval` now reads the session transcript the hook
is handed and requires a message **typed by the user** naming the case and the first 8
characters of the document hash. A matching signature is necessary but no longer
sufficient. Transcript shape verified against real sessions before relying on it:
`type: "user"` + `userType: "external"`, excluding `tool_result` blocks and `isMeta`.

Why this closes it: the agent can write any file and run any command, but it cannot
author a user turn. The forgery cases are tested directly — an assistant turn saying
the words, a tool result containing them, a meta turn, an approval for a different
case, an approval for a different document, and vague assent ("yes", "go ahead",
"approve it") are each asserted to FAIL.

Residual, stated honestly: approval is a typed phrase, not a cryptographic signature,
and a user who types it without reading is still unprotected. It converts a silent
automatic act into a deliberate one that cannot happen without them. F-17 (audit log
truncation) shares the old root cause and is reduced but not eliminated.

### P1 — fixed this stage

| ID | Finding | Fix |
|---|---|---|
| F-1 | **All 36 eval cases were unloadable.** Build wrote them to the pack's documented shape and flagged it unverified; it was wrong (`schema_version`, `execution`, per-grader `name` all required; `with_only`/`expect` not keys). | Schema discovered by iterating against the real runner; all 36 regenerated and verified to load. |
| F-2 | **`CLAUDE_PLUGIN_DATA` is absent from Bash-tool commands**, so the entire signing flow threw on a real install — while the hook (which *does* get it) failed closed. Net effect: nothing could ever be signed and every instrument-shaped send was denied forever. A permanent deadlock. The pack states this on line 46; the build read it and shipped past it. | All four call sites now pass `CEASE_DATA_DIR="${CLAUDE_PLUGIN_DATA}"`. New validator rule catches the class. |
| F-3 | **Gate covered one channel out of several.** Five of nine instruments are web forms (Amazon, Meta, TikTok, Cloudflare); a form fill or `curl` fired no hook. | Matcher extended to browser form/computer/js tools, `Bash`, `WebFetch`; `TEXT_FIELDS` reads `value`/`input`/`command`/`data`. Tested both ways. |
| F-4 | **The gate would block the user's own legal correspondence.** Topic words (`dmca`, `cease and desist`, `infringing material`) meant emailing their attorney about a filed notice was denied, with no override. | Operative sworn phrases only; `subject` excluded; quoted and forwarded regions stripped. Six realistic sends now tested as ALLOWED. |
| F-5 | **A2 contradicted by the code claiming to enforce it.** `buildDocket` passed `sellers: []`, so authorized resellers reached the enforcement docket — the trust-destroying failure R12 exists to prevent. The helper test passed while the real path did the opposite. | Sellers suppressed per A2; MAP breach reported separately as a contract matter; asserted at the docket level. |
| F-6 | **Audit chain verifier had no caller outside tests** — security.md's named worst case. | Wired into `/cease:brief`; a test now requires every verification command to appear in a skill body. |
| F-7 | **`main()` failed OPEN.** `render(decide(...))` sat outside any try; a PreToolUse hook exiting non-zero is non-blocking, so an uncaught throw silently disabled the gate. | `safeDecide()` extracted and pinned by the reachability test. |
| F-8 | **All 16 negative eval cases lacked a did-it-fire grader**, so the native over-trigger detector was absent. | `tool_used: Skill, min 0, max 0` added to 16 negatives and 3 collisions. (The blanket edit also inverted `cease-owns-this`, the one collision CEASE must win — caught and corrected to `min: 1`.) |
| F-9 | **README install command was unexecutable** (`<owner>/<repo>` with no remote). | Working local `--plugin-dir` command; marketplace form marked as filled in at publish. |
| F-10 | Two-sided boundary gaps: `brief`↔`pursue` (both claim "what's stuck?"), `check`↔`evidence`, `enforce`↔`pursue`; `testbuy` did not name redpill. | Boundaries added on both sides of each pair. |
| F-11 | `hooks/hooks.json` carried an undocumented top-level `description`; `--strict` parses this file **not at all** (probe-verified: bogus keys pass). | Key removed; validator now enforces a two-level allowlist for hooks.json. |
| F-12 | `skills/check` loaded `../sweep/references/triage.md`, escaping its own skill dir; `${CLAUDE_PLUGIN_ROOT}` was used inside a Read-loaded reference where substitution is undocumented. | Shared reference moved to plugin-root `references/`; validator forbids `../` in skill references and plugin vars in verbatim-read files. |
| F-13 | Search investigators inherited `Bash` with no need for it. | Removed from marketplace, social, ads investigators. |

### P2 / P3 — deferred, with notes

| ID | Finding | Disposition |
|---|---|---|
| F-14 | **11 of 16 positive eval prompts quote the descriptions' own words.** They discriminate against the ablation arm but prove nothing about reaching a user who does not echo the description — which is the whole ambient contract. | **Defer to the first real eval run.** Rewriting them is pointless until the suite can execute; do it with the auth fix. High priority once unblocked. |
| F-15 | `evidence-clerk` scoped by denylist, so it inherits every connector including Gmail send; an injected page could reach an exfiltration path the gate does not cover (no instrument phrases). | **Defer with note.** A `tools:` allowlist cannot name connectors portably (per-user ids) — the same constraint that produced the earlier UUID bug. Needs a design decision, not a patch. |
| F-16 | `fingerprint.mjs:hashImage` fetches data-derived URLs with no scheme allowlist, host restriction or size cap (SSRF / memory DoS). | **Defer.** Only reachable with `--hash-images` against a live catalog; unreachable in fixture mode. Fix before first real-brand run. |
| F-17 | Audit log is tamper-**evident**, not append-only: unkeyed hash means anything with `Write` can truncate and re-chain a clean history. | **Reduced, not eliminated.** F-0's fix means a forged log can no longer authorise a send, so the log's integrity is no longer load-bearing for R29. Truncation is still possible and still undetectable. Fix properly with a keyed HMAC or an out-of-process append target. |
| F-18 | Branch B of the gate (text not visible) may be dead code in the real runtime. | **Defer to the smoke run.** Needs a live PreToolUse payload to settle. |
| F-19 | Skills do not pre-approve the connector tools they instruct → first-run permission-prompt storm. | **Defer to ship.** DX, not correctness. |
| F-20 | `baseline` re-asks four fields `userConfig` already collected. | **Defer to ship.** |
| F-21 | `notion_case_db` optional but four skills assume it, no fallback named. | **Defer to ship.** |
| F-22 | Four scripts throw raw stack traces instead of actionable refusals. | **Defer to ship.** |
| F-23 | Two collision cases carry no cease vocabulary and would pass with the descriptions deleted. | **Defer to the first real eval run**, with F-14. |
| F-24 | SPEC trigger moments with no eval or no owner ("40 alerts", chargebacks line). | **Defer.** Either serve it or strike it from SPEC — a spec change, routes to design. |
| F-25 | `sources.mjs` returns a field named `instruction` containing an imperative. | **P3, defer.** Static plugin-authored text today; rename when touched. |

---

## 5. Unresolved risk

1. ~~F-0 is open~~ **FIXED** — approval is now bound to a genuine user turn.
2. **Triggering is unmeasured.** 36 cases exist and load; none has run.
3. **Runtime smoke never ran** — the plugin has never been loaded by Claude Code.
4. **Precision remains unmeasured** (A20), unchanged from build.
5. F-14/F-23 mean that even once the suite runs, the first result will overstate
   ambient reach until the echo-prompts are rewritten.

---

## 6. Recurring-finding candidates → `/koushik-jr:compound`

Three classes appeared **more than once** in this build and are the strongest
promotion candidates:

1. **"Tested but not on the real path."** Appeared three times: the custody
   path bug (helper green, real path broken), A2 (helper suppressed, docket did
   not), and `verifyChain` (tested, never called). Candidate: a standing
   reviewer checklist line — *assert every acceptance criterion at the level the
   user experiences it, never at the helper.*
2. **"Verified for this machine only."** Appeared twice: connector UUIDs in
   agent frontmatter, and the hook matcher. Already a validator rule; candidate
   for promotion to a pack fact.
3. **"The pack said so and the build shipped past it."** F-2 was stated
   verbatim in the loaded pack. Candidate: a design-stage checklist line forcing
   each plugin env var reference to name where it is read from.

Also a pack-update candidate: `hooks.json` is **not parsed at all** by
`claude plugin validate --strict` (probe-verified 2026-09-18) — the pack marks
the schema UNVERIFIED but does not say the validator gives zero coverage.
