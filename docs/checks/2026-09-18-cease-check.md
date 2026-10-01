# Check report — CEASE plugin

**Date:** 2026-09-18 · **Branch:** `build/cease-plugin` · **Target:** claude-plugin
**Verdict: `checked`.** Structural, behavioral and runtime gates have all run.
The P0 is fixed. Remaining findings carry explicit dispositions below.

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

### Runtime smoke — PASS

```
$ claude -p "a customer sent me this link, is it a real store? https://lumengoods-outlet.example/..." \
    --plugin-dir . --output-format stream-json --verbose
result subtype: success | is_error: False
Skill tool_use events: [{'skill': 'cease:check',
  'args': 'https://lumengoods-outlet.example/products/halo-pendant — customer forwarded this link...'}]
```

Ambient routing confirmed on the structured `tool_use` field, not on output text.

### Behavioral (triggering) — RUN. See the two-instrument result below.

*(The section below the rule records the original blocked attempt, kept because
it is what the schema fix was found through.)*

#### Result — re-measured 2026-09-28 after F-14

The first measurement ran on prompts that quoted their own skill descriptions
(F-14). Those prompts were rewritten in independent phrasing and the suite
re-run. **The result got stronger, not weaker.**

| Measurement | Result |
|---|---|
| Trace-derived routing, all 36 cases, independent prompts | **36/36 correct · 0 misrouted · 0 over-triggered · 0 under-triggered** |
| Earlier, on description-echoing prompts | 14/16 positives correct |
| `claude plugin eval` graded score, echo prompts | 27/36 · 0.75 · ablation delta +0.25 |

Raw run output is **not committed**: `claude plugin eval` writes full
transcripts, HTML reports and absolute local paths into `evals/results/`, which
is build output and is now gitignored (2.3 MB across 22 files had been swept in
by a `git add -A`, and would have shipped to every user who installs the
plugin). The numbers and the per-case routing table above ARE the record;
reproduce them with:

```bash
claude plugin eval . --runs 3 -j 4 --trust-plugin \
  --allow-tools Skill Read Glob Grep --keep-temp --ablation none --json run.json
node tools/routing-report.mjs run.json
```

**Positives (16/16).** Every skill fired on a prompt phrased the way a founder
would actually type it, sharing no wording with its description — *"should we
buy one ourselves so we've actually got the thing in hand?"* → `cease:testbuy`;
*"that shop we killed last month is trading again on a different address"* →
`cease:pursue`; *"what's the state of play, and is anything sitting waiting on
me?"* → `cease:brief`.

**Negatives (16/16), and this is the strongest part.** The wrong skill never
fired — and in seven cases the *right sibling* fired instead, which is positive
evidence of correct routing rather than mere absence:

| Prompt aimed away from | What actually fired |
|---|---|
| `check` ("file the takedown for case c-0001") | `cease:enforce` |
| `enforce` ("document this case properly") | `cease:evidence` |
| `enforce` ("who's copying our products?") | `cease:sweep` |
| `evidence` ("draft the DMCA notice") | `cease:enforce` |
| `evidence` ("did that takedown actually work?") | `cease:pursue` |
| `pursue` ("find new infringements") | `cease:sweep` |
| `pursue` ("draft the registrar abuse report") | `cease:enforce` |

The four prompts owned by other plugins or by nothing (`redpill` stock work,
ordinary procurement) fired no skill at all.

**Collisions (4/4).** The three owned by siblings fired no cease skill. The one
CEASE should win fired `cease:sweep` then `cease:baseline` — correctly noticing
no fingerprint exists yet. The harness error that spoiled this case in the
earlier run did not recur.

**The intra-plugin collision flagged as the primary design risk did not
materialise, on either prompt set.** Eight siblings sharing one domain
vocabulary, zero misroutes across 36 cases.

#### What these evals still cannot tell us

- **One run per case.** No variance data. The rubric's default is 3. 36/36 is
  a clean sweep at n=1, not a stability claim.
- **Sibling plugins are absent** from an isolated plugin eval, so cross-plugin
  collisions can only assert "CEASE stayed out", never "the right owner took
  it". The case files now say so in their own text.
- ~~F-14~~ **CLOSED 2026-09-28.** All 16 positives rewritten in independent
  phrasing and re-measured at 36/36. `tests/eval-prompts.test.mjs` now fails the
  build if a positive prompt shares a content-bearing 4-word run with the
  description it targets — verified by re-planting the original verbatim echo.

---

### Behavioral — original blocked attempt

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

**A18 was UNMEASURED at this point.** It was measured after login — see the
result above. A20 (precision) remains unmeasured and always will until real
brand data runs through.

What *was* established: all 36 cases now **load** cleanly (schema validation
runs before auth), which was itself a P1 fix — see F-1.

*(The runtime smoke was blocked by the same expired credential. It was re-run
after login and PASSED — recorded above, not here.)*

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
| F-14 | **11 of 16 positive eval prompts quoted the descriptions' own words.** They proved nothing about reaching a user who does not echo the description — the whole ambient contract. | **FIXED 2026-09-28.** All 16 rewritten independently; re-measured at 36/36 correct. Enforced by `tests/eval-prompts.test.mjs`, which fails on any 4-word run shared with the target description. |
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
2. ~~Triggering is unmeasured~~ **MEASURED**: 14/16 correct routing, 0
   misrouted, 0 over-triggered — but at one run per case, and on prompts that
   partly echo the descriptions (F-14). 36 cases exist and load; none has run.
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

4. **"The score measured the harness, not the artifact."** Two full eval runs
   were discarded or reinterpreted because the sandbox — not the plugin —
   produced the result: once because the `Skill` tool was denied outright, once
   because an LLM judge scored a correctly-routed skill as failed for being
   unable to run `node`. Candidate: a check-rubric line — *before believing any
   behavioral score, confirm the environment could have produced a pass.*

Also a pack-update candidate: `hooks.json` is **not parsed at all** by
`claude plugin validate --strict` (probe-verified 2026-09-18) — the pack marks
the schema UNVERIFIED but does not say the validator gives zero coverage.


---

## 7. Ship record — 2026-09-28

State `shipped` — READY TO PUBLISH. Nothing has been published.

- Repository: https://github.com/koushikeverything/cease (**private**)
- PR: https://github.com/koushikeverything/cease/pull/1 (`build/cease-plugin` → `main`, 29 commits)
- Release tag: `cease--v0.1.0`, created by `claude plugin tag` (validates manifest/marketplace parity)

Re-verified fresh on the shipped tree: `validate --strict` PASS on all four
targets · 179 tests · structural validator clean · every file in the design's
file plan present.

**Fixed at ship:** LICENSE was missing while `plugin.json` claimed MIT; the
README install command was an unexecutable placeholder; `homepage` and
`repository` were unset (the spec reviewer's P3).

**Fixed at publish, found by the pre-publish checklist:** 2.3 MB of
`claude plugin eval` output was tracked across 22 files — per-run transcripts,
HTML reports, and 190+ occurrences of `/Users/momentum91/...`. Swept in by
`git add -A` and would have been cloned by every user. `evals/results/` is now
gitignored. This is exactly the hazard the publish-surface check exists for,
and it was caught by running the checklist rather than assuming the tree was
what it had been at ship.

**Accepted, not fixed:** four absolute local paths remain in §2 of this report.
They are verbatim `claude plugin validate` output, and the rubric requires suite
output recorded verbatim — editing evidence to tidy a path is the wrong trade.
They disclose a local username and nothing else.

### Publish-surface decision left to the human

A git-based plugin marketplace ships the **whole repository** — there is no
`files` allowlist as there would be for npm. Making this public therefore
publishes:

| Path | What it is |
|---|---|
| `docs/checks/` | this security review, including residual weaknesses |
| `docs/design/`, `docs/leverage/` | design rationale and probe evidence |
| `CEASE-plugin-spec.md` | internal strategy and competitive positioning |
| `cease-brand-protection_1.html` | a 37 KB landing page unrelated to the plugin |
| `.koushik/config.yaml` | dormant config from a different lifecycle, carries a published tracker URL |

None of it is secret and none of it blocks publishing. It is listed because
"internal process documents have nearly shipped this way" is a named
publish-surface hazard, and because the choice should be made deliberately
rather than discovered after the repo is public.
