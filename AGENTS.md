# AGENTS.md

## Koushik (durable-agent development)

This repository is managed with the koushik lifecycle for building durable agents with Eve.

- **Artifacts** live in predictable places: `STRATEGY.md` (product strategy), `CONCEPTS.md` (project vocabulary), `docs/plans/` (requirements → implementation-ready plans), `docs/agent-architecture/`, `docs/agent-reviews/`, `docs/eval-reports/`, `docs/test-drives/`, `docs/deployments/`, `docs/runbooks/`, `docs/pulse-reports/`, `docs/scale-plans/`, `docs/solutions/` (compound learnings). Project configuration (never secrets) is in `.koushik/config.yaml`.
- **Freshness protocol:** when sources disagree, precedence is — explicit current user decision → production/security policy and repo rules → current accepted strategy/requirements/architecture artifacts → current code/tests/evals → prior solution notes → old plans or chat history. See the koushik plugin's `references/lifecycle.md`.
- **Invariants are enforced by capability, not prompt prose:** anything the agent must never do is guarded by a mechanism (approval gate, eval, hook, permission scope) — never by instruction text alone.
