---
name: pursue
description: >-
  Follows takedowns through instead of assuming they worked: re-checks each
  filing at 24 hours, 72 hours and 7 days, detects relaunches under new domains
  by matching image hashes, copy phrases, seller fingerprints and registrant
  details against closed cases, builds the repeat-offender history that makes
  registrar and marketplace escalation stick, and escalates when a filing
  fails. Use when you say "did that actually come down?", "they're back under a
  new domain", "this is the third time this seller", or "what's stuck?". Not
  for the first detection (cease:sweep) or the first filing (cease:enforce).
  Not for durable Eve agents (koushik plugin).
allowed-tools: Bash, Read, Write, Task
---

# Follow it through

This is the part everyone skips, and where most brand-protection services
quietly fail. A filed takedown is not a resolved case.

## 1. Verify each filing

At +24h, +72h and +7d after filing, check whether the material is actually gone.

Check the specific URL **and** the storefront root — plenty of "removed"
listings are simply relisted at a new path minutes later.

Three outcomes, and they are different:

- **Gone** — mark verified, move to relaunch watch for 90 days
- **Still live** — the filing failed. Escalate (step 3). Do not re-file the
  same instrument to the same place and hope.
- **Gone but the seller is still trading** — the listing died, the operation did
  not. Open a new case on the storefront.

## 2. Relaunch watch

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/relaunch.mjs hits.json closed-cases.json
```

Matching is on what they cannot cheaply change: the copy they pasted, the images
they stole, the seller identity, the registrant email, the nameservers. A new
case opens **linked to its parent**, so the history accumulates.

A hit on the *same* domain is not a relaunch — it means the takedown never
landed. The script distinguishes these; report them differently.

## 3. Escalation ladder

Climb it in order. Each rung is slower but harder to ignore.

1. **Platform report** — where you started
2. **Registrar** — abuse contact from the case's own WHOIS record
3. **Host** — plus Cloudflare separately when a CDN fronts the origin
4. **Payment processor** — often the fastest kill, and underused. A store that
   cannot take money is dead whether or not the domain survives
5. **Attorney** — a real one; CEASE does not practise law
6. **Customs recordal** — the brand files it

Each rung is drafted by `cease:enforce` and signed by a human. Escalation
changes the instrument, never the signature requirement.

## 4. Repeat offenders

A seller hit three times is a different conversation. The accumulated dossier —
every case, every domain, every relaunch, with dates — is what makes registrar
and marketplace escalation actually work. One report is a complaint; a
documented pattern is a problem they have to solve.

## 5. Report

Lead with what changed since last time, not a status dump:

- came down, confirmed
- **failed, now escalating to <rung>**
- relaunched, new case opened, linked to parent
- still waiting, and how long it has been waiting

Anything stuck for more than 14 days gets named explicitly with the reason. A
case quietly sitting is the failure mode this skill exists to prevent.

## Scheduling

CEASE ships no scheduler. Ask the host:

> Create a daily scheduled task running `/cease:pursue`.
