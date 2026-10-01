# CONCEPTS

CEASE — an inside-out brand-protection agent for DTC/e-commerce brands: it finds counterfeit and impersonation evidence in the brand's own first-party systems (support inbox, payments, ads, analytics), traces it to the source, and produces enforcement instruments.

<!-- Vocabulary entries are added by compound as durable terms emerge. -->

## Verification

**green-but-unmeasured** — a passing signal with no established path to the fact
it claims to establish. Covers both a test that reached only a helper and a
score the test environment produced rather than the artifact. The generator
behind six defects in the v0.1.0 build; see
`docs/solutions/verification/2026-10-01-green-but-unmeasured.md`.

**unreached guard** — a control that is defined, exported and unit-tested while
nothing outside `tests/` calls it. More dangerous than a missing control,
because the green suite buys confidence. Caught by
`tests/reachability.test.mjs`.

**harness-measured score** — a number produced by the conditions of the test
run rather than by the artifact under test. Three of this build's eval runs were
harness-measured: one where the `Skill` tool was denied, one where a judge
failed correctly-routed skills for being unable to run `node`, one where every
case errored on an expired credential.

**echo prompt** — a triggering eval prompt that quotes the description of the
skill it tests, so it demonstrates only that the router can match itself.
Forbidden by `tests/eval-prompts.test.mjs`.

## CEASE internals

**source adapter** — the single call site through which a channel is read, so a
synthetic fixture today and a live connector later are indistinguishable
downstream (`scripts/sources.mjs`). Acceptance A21 requires that swapping one
for the other edits no `SKILL.md`.

**operative phrase** — sworn language that appears only inside an enforcement
instrument ("under penalty of perjury"), as distinct from topic words that
appear whenever someone *discusses* one ("DMCA"). The signature gate counts
only operative phrases, because counting topic words blocked the user's own
correspondence with their attorney.

**held-for-classification** — a triage outcome for a hit the evidence does not
separate into counterfeit goods versus unauthorized reseller. The remedies are
legally different (IP versus contract), so the classifier refuses to guess and
surfaces the question (F9).
