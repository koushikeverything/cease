# AGENTS.md

## Koushik (durable-agent development)

This repository is managed with the koushik lifecycle for building durable agents with Eve.

- **Artifacts** live in predictable places: `STRATEGY.md` (product strategy), `CONCEPTS.md` (project vocabulary), `docs/plans/` (requirements → implementation-ready plans), `docs/agent-architecture/`, `docs/agent-reviews/`, `docs/eval-reports/`, `docs/test-drives/`, `docs/deployments/`, `docs/runbooks/`, `docs/pulse-reports/`, `docs/scale-plans/`, `docs/solutions/` (compound learnings). Project configuration (never secrets) is in `.koushik/config.yaml`.
- **Freshness protocol:** when sources disagree, precedence is — explicit current user decision → production/security policy and repo rules → current accepted strategy/requirements/architecture artifacts → current code/tests/evals → prior solution notes → old plans or chat history. See the koushik plugin's `references/lifecycle.md`.
- **Invariants are enforced by capability, not prompt prose:** anything the agent must never do is guarded by a mechanism (approval gate, eval, hook, permission scope) — never by instruction text alone.

---

## This repository is the `cease` plugin

Published at https://github.com/koushikeverything/cease and built with the
koushik-jr lifecycle (small shipped artifacts), not the koushik one above.
Its artifacts: `SPEC.md`, `docs/design/`, `docs/leverage/`, `docs/checks/`,
`docs/solutions/`, config in `.koushik-jr/config.yaml`. The koushik tree above
is dormant in this repo.

- `npm test` · `npm run validate` · `claude plugin validate <path> --strict`
  on **all four** targets (`.claude-plugin/plugin.json`, `./skills`,
  `./agents`, `.`) — a single `validate .` checks the marketplace manifest
  alone and is a hollow gate.
- `evals/results/` is build output and is gitignored. Do not commit it: it
  carries full transcripts and absolute local paths, and this repo is cloned
  by every user who installs the plugin.

## Verification rules (earned, not assumed)

Promoted here after the same failure shape produced six separate defects in one
build — see `docs/solutions/verification/2026-10-01-green-but-unmeasured.md`.

- **A green signal is evidence only if it had a path to the fact.** Before
  believing any test or score, answer: *what is the shortest path from the
  artifact's entrypoint to this assertion?* If it routes through a test file
  only, the property is unverified however many tests pass.
- **Assert every acceptance criterion at the altitude the user experiences
  it**, never at the helper. "A-ID says absent from the docket" is tested
  against the docket, not against the function the docket is supposed to call.
- **Every security-posture symbol must have a non-test caller.** Enforced by
  `tests/reachability.test.mjs`. A control that is defined, documented and
  tested but never wired in is more dangerous than a missing one, because the
  green suite buys confidence a missing control never gets.
- **A detector must distinguish "nothing was wrong" from "nothing happened."**
  Refuse to report on incomplete, errored or evidence-free runs rather than
  printing a pass. Before quoting any score, confirm the environment could have
  produced the opposite result.
- **Spec facts come from the ecosystem packs or a live source, never memory**,
  and a pack fact that contradicts the build is the pack's problem to re-verify
  — not something to code around.
