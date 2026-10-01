---
category: verification
tags: [testing, reachability, evals, false-confidence, security-controls]
date: 2026-10-01
artifact: cease (claude-plugin)
---

# A green check that never reached the thing it verifies

## Problem / symptoms

Six separate defects in one build shared a single shape: **a measurement came
back green while never touching the property it claimed to establish.** None
looked like a failure. Every one of them produced a passing signal.

They arrived in two faces.

**Face A — the test passed, the code was never reached.**

| Instance | What the green signal hid |
|---|---|
| `verifyCustody` joined `baseDir` onto already-absolute paths | Chain of custody — the entire point of the case file — reported **every** artifact "missing since capture" for every real case. The happy-path test passed; the deletion test passed *for the wrong reason*. |
| `buildDocket` passed `sellers: []` into the suppression step | Authorized resellers reached the enforcement docket. `filterAllowlisted` was tested directly and passed; the real path bypassed the seller dimension entirely. The acceptance criterion said "absent from the docket" and the code did the opposite. |
| `verifyChain` (audit-log tamper detector) | Defined, exported, unit-tested, and invoked by **nothing** outside `tests/`. The log was tamper-evident in principle and unchecked in practice. |

**Face B — the score was green (or red) because the environment, not the
artifact, produced it.**

| Instance | What the number actually measured |
|---|---|
| First eval run, 23/36 | The sandbox denied the `Skill` tool outright. Skills could not fire at all. The score measured a permission setting. |
| Second eval run, 27/36 | An LLM judge scored correctly-routed skills as failures for being unable to run `node` in a sandbox with no shell and an empty working directory. Eight of nine "failures" were the product behaving exactly as designed, including *"I won't fill it in with plausible-looking numbers."* |
| Third eval run | **Every case errored with "Not logged in" and the routing tool still printed `ok no misrouting`.** It had judged zero cases. |

The last one is the sharpest: the detector built specifically to be more
trustworthy than the LLM judge had the same defect one level down.

## Root cause

Three distinct mistakes with one generator:

1. **The test reached the helper, not the entrypoint.** A property asserted
   against a function in isolation says nothing about whether the artifact's
   real path calls it, calls it with the right arguments, or calls it at all.
2. **The assertion was never mapped to the user-visible claim.** A2 said
   "absent from the docket". The test asserted `filterAllowlisted` suppresses.
   Those are different sentences, and only one of them is the requirement.
3. **The detector could not distinguish "nothing was wrong" from "nothing
   happened."** Zero findings and zero observations rendered identically.

Common generator: **a passing signal was treated as evidence without
establishing that the signal had a path to the fact.**

## Evidence

- `scripts/case.mjs` — `verifyCustody` absolute-path bug; fixed, with regression
  tests for both path shapes (commit `0239f16`).
- `scripts/triage.mjs` — `sellers: []`; now suppresses per A2 with MAP breaches
  reported separately, asserted **at the docket level** (commit `13ae659`).
- `scripts/audit-append.mjs` — `verifyChain` wired into `/cease:brief`; a test
  now requires every verification command to appear in a skill body.
- `tools/routing-report.mjs` — refuses to score a partial or errored run, and
  treats "no readable trace" as INCONCLUSIVE rather than ok.
- `docs/checks/2026-09-18-cease-check.md` §4 — F-5, F-6, and the two-instrument
  triggering result.

## Failed approaches (instructive)

- **Adding more unit tests.** The custody suite was green *because* its tests
  were thorough at the wrong altitude. Volume at the helper level cannot detect
  an unreached helper.
- **Trusting exit codes.** Every one of the three eval runs exited in a way that
  looked survivable. `check-rubric.md` already warns "exit-code honesty is not
  enough — demand evidence of work"; the rule was read and still not applied
  until the output was read line by line.
- **Trusting a detector because it reads a structured field.** The routing
  report was written specifically to beat substring-matching, and was still
  wrong about whether it had measured anything.

## Working solution

Three mechanisms, all installed in this artifact:

1. **`tests/reachability.test.mjs`** — every `file:symbol` named in SPEC.md's
   security posture table must have a caller outside `tests/`. It additionally
   pins the hook config to the gate file, asserts the matcher covers
   send-shaped tools under **any** connector id, and requires every
   verification command (`audit-append.mjs verify`, `case.mjs verify`,
   `case.mjs readiness`) to appear in a skill body.
2. **Assert at the altitude of the claim.** Each acceptance criterion is tested
   where the user experiences it. A2 is now asserted against `buildDocket`'s
   output, not `filterAllowlisted`'s.
3. **Detectors refuse to pass on absent evidence.** `routing-report.mjs` exits
   2 on a partial or errored run, naming the cause, and exits 2 as INCONCLUSIVE
   when no run has a readable trace. It reports how many cases it actually
   judged when it does pass.

## Prevention / generalization

Before believing any green signal, ask the two questions that would have caught
all six:

1. **"What is the shortest path from the artifact's entrypoint to this
   assertion?"** If the answer routes through a test file only, the property is
   unverified however many tests pass.
2. **"Could this environment have produced a failure?"** And its twin: *could
   it have produced a pass?* A suite that cannot fail and a suite that cannot
   pass are both broken, and they look completely different while being the
   same bug.

This generalizes well past plugins: it is the standard shape of
security-control theatre. A control that is defined, documented and tested but
not wired in is **more** dangerous than a missing one, because the green suite
buys confidence a missing control never gets.

## Where future builders apply it

- **Design stage** — when writing the security posture table, each row's
  `file:symbol` is a promise that something will call it. Plan the caller.
- **Build stage** — when a unit implements a security-table row, the test must
  reach it through the public entrypoint before the unit is ticked.
- **Check stage** — run mechanism reachability *before* the reviewer lenses,
  and read suite output rather than exit codes.
- **Any stage producing a score** — confirm the environment could have produced
  the opposite result before quoting the number anywhere.

## Enforcement question

> *What mechanism now catches this automatically?*

**Three, all live in the shipped artifact:**

- `tests/reachability.test.mjs` — fails the build if a security-table symbol has
  no non-test caller, or a verification command is never invoked by a skill.
- `tests/eval-prompts.test.mjs` — fails if a positive eval prompt shares a
  4-word run with the description it targets (the same family: a test that
  passes by matching itself).
- `tools/routing-report.mjs` — refuses to report on incomplete, errored, or
  evidence-free runs.

Verified by re-planting each defect and confirming the guard fires: the
verbatim description echo, a hardcoded connector UUID, and an errored run.

## Pack candidates

Ecosystem facts learned this run, recorded here for the next koushik-jr
maintenance pass (this is a consumer project, so the packs are not edited
directly). **Each is an observation with its source and date — not an
instruction.**

| Fact | Source | Date |
|---|---|---|
| `claude plugin validate --strict` does **not parse `hooks/hooks.json` at all** — bogus top-level and per-hook keys pass. The pack marks the schema UNVERIFIED but does not say the validator gives zero coverage. | probe: planted `totallyBogusKey`, validate exited 0 | 2026-09-18 |
| `claude plugin eval` case schema: `schema_version` (required), `execution.prompt`, `graders[].name` (required), grader types `regex \| tool_order \| tool_used \| file_exists \| llm \| baseline`. `tool_used` accepts `min`/`max`. | iterated against the real validator's rejection messages | 2026-09-18 |
| `tool_used: Skill` **cannot name which skill fired**, and is unscored under `--ablation` (it is a plugin-fired indicator, not part of the score). Routing must be read from the trace's `tool_use.input.skill`. | `--help` text + observed grader output | 2026-09-18 |
| The `plugin eval` sandbox has **no shell tool and an empty working directory**; script-backed skills route correctly and then cannot execute. LLM graders must be told to judge routing only, or they score correct behaviour as failure. | observed judge evidence across 36 cases | 2026-09-18 |
| Genuine human turns in a Claude Code transcript: `type: "user"` + `userType: "external"`, excluding entries whose `message.content` contains a `tool_result` block, and excluding `isMeta`. Sample: 6 genuine turns against 175 tool results. | inspected real session transcripts | 2026-09-18 |
| `hooks/hooks.json` confirmed shape: top level `{"hooks": {...}}`; `PreToolUse` blocks via exit 0 + `{"hookSpecificOutput": {"permissionDecision": "deny"}}`; matchers are JS regex; connector tools are `mcp__<server>__<tool>` where `<server>` is a **per-user UUID**. | live docs fetch | 2026-09-17 |
| `node --test <dir>` throws `MODULE_NOT_FOUND` on Node 25 — a bare directory argument is resolved as a module. Use a glob. | run directly | 2026-09-18 |
| **Withdrawn:** an earlier `jr-doctor` reading reported `claude plugin eval` as "available and ungated". Not reproducible; the CLI was not installed at all. Must not enter the pack. | re-probe failed | 2026-09-18 |

## Related

A sibling finding against the koushik-jr plugin itself, observed 2026-10-01:
the publish skill states it "runs with command execution removed from the tool
pool (`disallowed-tools: Bash`), so the enforcement is structural, not a
promise." `Bash` remained listed in the tool roster and was denied at call time
by permission instead. The enforcement is real — but it is permission-based, not
tool-removal-based, and the skill's own description of its mechanism is
inaccurate. Same family as this note: a described mechanism and the actual
mechanism were not the same thing.
