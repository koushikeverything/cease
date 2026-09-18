# Triggering evals

The triggering plan from `docs/design/2026-09-17-cease-plugin-surface.md` §5,
turned into cases. For small artifacts the top failure mode is not a crash — it
is a skill that never fires, or two siblings that collide.

Run with the ablation baseline, which is the native under/over-trigger detector:

```bash
claude plugin eval --ablation with-without --threshold 0.8
```

In the baseline arm the plugin is not installed, so a `tool_used: Skill` grader
marked `with_only` is the did-it-fire signal: positives assert it fired,
negatives assert it did not.

## Contract these are held to

All eight skills are **ambient**: they must reach a user who describes the
problem in their own words ("someone sent me this link"), not only one who types
the command. Positive prompts are therefore written in user vocabulary and
deliberately avoid the descriptions' own wording.

## Coverage

- 16 positive (2 per skill)
- 16 negative (2 per skill — adjacent requests owned by a sibling skill, redpill, or nothing)
- 4 collision (koushik, koushik-jr, redpill, and one CEASE must win)

Intra-plugin collision is the live risk: eight siblings share one domain
vocabulary. The pairs most likely to flip are **sweep vs check** and
**evidence vs enforce** — run those head to head first.

## ⚠ Schema not yet verified

`claude plugin eval` could not be run while these were written — the Claude CLI
is not installed in the build environment (see the leverage manifest's toolchain
row). The case shape follows the koushik-jr ecosystem pack (`case.yaml`,
graders, `--ablation with-without`, `--threshold`, verified 2026-09-16), but the
exact grader field names are **unconfirmed against a live run**.

**The check stage must run these for real and correct the shape if it differs.**
Do not treat a green result here as evidence until they have actually executed.
