---
name: brief
description: >-
  Produces the brand-protection scorecard: what is new, what is resolved, what
  needs your signature this week, what is stuck and why, and the running
  recovery estimate with its assumptions shown. Use when you say "weekly
  update", "where are we on takedowns", "brand protection summary", or when a
  Monday schedule fires. Not for running detection (cease:sweep). Not for
  durable Eve agents (koushik plugin).
allowed-tools: Bash, Read, Write
---

# The scorecard

Deliberately short. A founder reads this in under a minute or does not read it.

## Five sections, in this order

### 1. New this period
Cases opened, worst first. One line each: what it is, where, severity, and
whether a real customer was burned.

### 2. Resolved
Confirmed gone, with the date and which rung of the ladder did it. Say which
lever worked — over time this is how the brand learns where to start.

### 3. Needs your signature
```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/sign.mjs status
```
Every drafted-but-unsigned instrument, with how long it has been waiting.
**Put this section first when anything has waited more than a week** — an
instrument nobody signs is the most common way enforcement quietly stops.

### 4. Stuck, and why
Filings past their expected response window, failed takedowns awaiting
escalation, cases held for classification. Each with the reason and the next
action. Never a bare count.

### 5. Recovery estimate — with its assumptions visible

Never state a number alone. Always:

> Estimated recovery this period: **$4,200**
> Assumes: 38 removed listings × observed listing velocity × your average
> order value of $112, and that 30% of those sales would have come to you.
> The 30% is an assumption, not a measurement.

If the brand's real conversion data is not available, say the estimate is
indicative and name what would sharpen it.

## Honesty rules

- **If the run used fixture data, say so in the first line.** Never present
  synthetic results as findings about their real brand.
- **Never claim a false-positive rate.** CEASE has not measured its precision
  and must not imply otherwise until real brand data has run through it.
- A quiet period is a finding, not a gap. Say "nothing new, and here is what
  was checked" rather than padding.

## Delivery

Post to Slack when connected; otherwise email it. Archive the full version in
Notion and keep the message short with a link.

## Scheduling

> Create a weekly scheduled task for Monday 09:00 running `/cease:brief`.
