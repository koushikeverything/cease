---
name: evidence
argument-hint: "[case-id, or blank to open a new case]"
description: >-
  Builds or opens a case file with chain of custody: timestamped full-page
  screenshot with the URL visible, archived page source, registrar, host and
  WHOIS facts, seller identity and storefront age, your ownership proof
  (original image EXIF, first-publication date, trademark number), and the
  support ticket, chargeback or return that proves customer harm. Use when you
  say "open the case", "what do we have on this seller", "my lawyer wants
  everything on this one", or "document this before it disappears". Not for
  finding new infringements (cease:sweep, cease:check), not for drafting the
  notice (cease:enforce). Not for durable Eve agents (koushik plugin).
allowed-tools: Bash, Read, Write, Task
---

# Build the case file

The point is **chain of custody**. If this ever reaches a registrar dispute, a
marketplace appeal or an attorney, this file is what they read — and what the
incumbents' dashboards will not hand over in exportable form.

## Opening a case

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/case.mjs new c-0001 '{"url":"...","domain":"...","seller":"..."}'
```

With a case id, load the existing file instead and report its current state,
evidence, and next action. That is the "my lawyer wants everything on this
seller" request.

## Capture, before it disappears

Counterfeit storefronts vanish. Capture first, analyse second.

Hand the capture to `evidence-clerk`, which records each artifact with its
method and hash at the moment of capture:

1. **Full-page screenshot** with the URL bar and a system timestamp visible.
2. **Archived page source** — save the HTML, do not summarise it.
3. **Product images** from the listing, as files.
4. **Registration facts** — registrar, creation date, nameservers, host, CDN.
5. **Seller facts** — identity, storefront age, other listings.

Firecrawl cannot do steps 1–3: this connection has no scrape tool. Use the
browser. In a scheduled run with no browser, record what is outstanding and
defer it to the next interactive session rather than reporting a failure (F4).

## Your side of the proof

A case without ownership proof cannot become a DMCA notice (F7). Gather:

- the **original image file with EXIF** intact
- the **first-publication date** from the catalog record
- the **trademark registration number** and class, if the claim is a mark

## Link the first-party harm

This is the multiplier, and the thing no outside-in crawler can produce: the
support thread, the chargeback, or the return that shows a real customer was
burned. Link it by id. A case with a named victim is a different case.

## Verify and check readiness

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/case.mjs verify   cases/c-0001.json
node ${CLAUDE_PLUGIN_ROOT}/scripts/case.mjs readiness cases/c-0001.json
```

`verify` re-hashes every artifact and reports anything altered or missing since
capture. `readiness` names exactly which DMCA element is still absent — report
that list verbatim rather than saying the case "needs more work".

## Store it

Write the case to the brand's Notion workspace. Evidence files stay local and
are referenced by path and hash. Never put customer data in plugin data
(security.md rule 11).
