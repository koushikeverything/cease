---
name: baseline
description: >-
  Builds the brand fingerprint CEASE detects against: product image hashes,
  distinctive copy phrases, SKU list, per-SKU price floor, trademark
  registrations, owned domains and social handles, and the authorized-reseller
  allowlist that stops real partners being flagged. Use when setting up CEASE
  for the first time, after a catalog or product-line change, when adding or
  removing a distributor, or when someone says "refresh the fingerprint" or
  "our reseller list changed". Not for running a detection sweep (cease:sweep)
  or checking one link (cease:check). Not for inventory, stock-file or
  replenishment analysis (redpill). Not for durable Eve agents (koushik plugin).
allowed-tools: Bash, Read, Write
---

# Build the brand fingerprint

Everything CEASE detects is a comparison against this file. Build it before the
first sweep; refresh it when the catalog or the reseller list changes.

## 1. Read the catalog

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/sources.mjs catalog
```

Two possible answers, and you handle both without changing anything:

- `"mode": "fixture"` — bundled synthetic products came back in `rows`. Say so
  plainly in your summary: this is test data, not their real catalog.
- `"mode": "live"` — call the connector named in `needsConnector` (Shopify
  `search_products`), save its raw output, then normalize it:
  ```bash
  node ${CLAUDE_PLUGIN_ROOT}/scripts/sources.mjs normalize catalog <raw.json>
  ```

## 2. Gather what the catalog cannot tell you

Ask the user once, in a single question, for whatever is missing — never a
drip of separate questions:

- **Trademark registrations** — number, class, jurisdiction. Needed before any
  DMCA or marketplace report can claim ownership (R19, R22).
- **Owned domains and social handles** — every one you miss becomes a false
  positive against the brand itself.
- **Authorized resellers** — the allowlist. Ask explicitly; this is the single
  highest-value input, because flagging a real distributor is the failure mode
  that destroys trust in the whole system.
- **Price floor ratio** — default 0.6 (anything under 60% of list is
  presumptively counterfeit). Ask whether that matches their discounting.

If the user has these in Notion or Drive, read them rather than asking.

## 3. Build it

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/fingerprint.mjs fingerprint.json --hash-images
```

Drop `--hash-images` when the image URLs are not reachable (always true in
fixture mode). Image hashing is exact-byte only — a re-encoded or resized copy
will not match. Say so if the user asks what it catches.

## 4. Store it

Write the fingerprint to the brand's Notion workspace (the case database in
plugin settings), not to plugin data — plugin data is shared with later
sessions and is not a place for the brand's catalog (security.md rule 11).

## 5. Report

State, in plain language: how many products, how many distinctive phrases, how
many allowlist entries, and **what is missing**. A fingerprint with no
authorized resellers listed is a fingerprint that will generate false
positives — say that rather than presenting an empty allowlist as complete.

## Refresh

Re-run monthly, or when the user says the catalog or reseller list changed.
Schedule it with the host's scheduled-tasks feature — CEASE does not ship a
scheduler:

> Create a monthly scheduled task that runs `/cease:baseline`.
