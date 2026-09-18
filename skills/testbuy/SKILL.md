---
name: testbuy
argument-hint: "[case-id]"
description: >-
  Walks an evidence purchase from a suspect listing: records what to order, logs
  the order against the case, and files the physical evidence and packaging
  photos when it arrives. Prepares the purchase for you to complete yourself —
  never buys anything on your behalf. Use when you say "order one to prove it's
  fake", "do a test buy", or "we need a physical sample for the marketplace
  appeal". Not for ordinary shopping, reordering stock, or any purchase
  unrelated to an open case. Not for durable Eve agents (koushik plugin).
allowed-tools: Bash, Read, Write
---

# Walk an evidence purchase

A physical sample is the strongest evidence in a counterfeit case. Marketplace
appeals and payment-processor reports both land far harder with one.

## CEASE never makes the purchase

**You place the order yourself.** This skill prepares it, records it, and files
what arrives. It does not hold payment details, does not check out, and does not
ask you for card details — if anything ever appears to, that is wrong and should
be reported.

## 1. Prepare

From the case file, lay out exactly what to buy and what to watch for:

- the listing URL, seller, price and variant
- **a delivery address that is not the brand's** — a counterfeiter who
  recognises the buyer will ship a genuine item and defeat the whole exercise
- payment method, chosen so the settlement path is traceable, since the
  merchant identifier that surfaces is what makes the payment-processor report
  work
- what to photograph on arrival, before opening: packaging, labels, shipping
  documents, the return address

## 2. Record the order

Log it against the case: date, order number, seller, price paid, payment method,
expected delivery. An unlogged test buy is an expense with no evidentiary value.

## 3. File what arrives

Photograph before unwrapping. Then record the comparison against the genuine
article: materials, finish, branding, serial or batch marks, packaging inserts,
and anything a customer would notice.

Add each photo through `scripts/case.mjs` with `kind: "image"` and the method
used. **Do not edit the photos** — not to crop or brighten. The hash is the
point.

## 4. What it unlocks

Record which instruments the sample now strengthens:

- Amazon and other marketplace reports — substantially higher success rate
- the payment-processor report — proves money settled to the merchant
- a customs recordal, if the brand files one

## If it never arrives

That is also evidence: a storefront taking money for goods it does not ship is
a payment-processor report on its own, and often a faster kill than an IP claim.
