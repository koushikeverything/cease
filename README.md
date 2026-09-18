# CEASE

**Inside-out brand protection for DTC and e-commerce brands.**

Every incumbent in this category sells the same shape: an external crawler plus
a dashboard. They are outside the wall, guessing. Meanwhile the highest-signal
counterfeit evidence sits unread inside the brand's own tools — a support email
saying "I ordered from your site and got a fake", a chargeback for an order that
does not exist, a return of something that is not your SKU.

CEASE starts there, traces each confirmed signal back to its source, assembles a
case file that survives an attorney reading it, and drafts the right enforcement
instrument for a human to sign.

**It never files anything automatically.** See [The signature gate](#the-signature-gate).

---

## Install

> **Not yet published.** This repository has no remote, so there is no
> marketplace to add. To try it now, point Claude Code at a local checkout:
>
> ```bash
> claude --plugin-dir /path/to/cease
> ```
>
> Once it is published, installation becomes:
>
> ```bash
> /plugin marketplace add OWNER/REPO
> /plugin install cease@cease-marketplace
> ```
>
> `OWNER/REPO` is filled in at publish time. If you are reading this with the
> placeholder still present, the plugin has not shipped.

Then set the brand settings when prompted: brand name, owned domains and
handles, authorized resellers, authorized signers, and your Notion case
database.

## Start here

```
/cease:baseline          build the brand fingerprint — do this first
/cease:check <url>       triage one suspect link (the most-used command)
/cease:sweep             full detection pass across every channel
```

## The eight skills

| Skill | What it does |
|---|---|
| `cease:baseline` | Builds the fingerprint: copy phrases, price floors, image hashes, and the authorized-reseller allowlist |
| `cease:sweep` | Full detection pass — support mail, disputes, returns, marketplaces, domains, social, public ad libraries |
| `cease:check` | Triages one link, listing, handle or ad, cold |
| `cease:evidence` | Builds a case file with verifiable chain of custody |
| `cease:enforce` | Drafts the correct instrument and routes it for signature |
| `cease:testbuy` | Walks an evidence purchase — you place the order |
| `cease:pursue` | Verifies takedowns, catches relaunches, escalates |
| `cease:brief` | The weekly scorecard |

## The signature gate

A DMCA notice carries a statement made under penalty of perjury, and
**17 U.S.C. § 512(f)** creates real liability for knowingly misrepresenting that
material is infringing. The brands most likely to get hit are the ones with the
most aggressive automation.

So CEASE does the 95% that is research, evidence, jurisdiction and drafting. A
person does the 5% that is legal attestation.

This is enforced by a hook, not by instruction text. A `PreToolUse` hook blocks
any outbound message that carries a case reference without a matching signature,
and any message that reads as a legal instrument with no case reference at all.
It verifies that the text being sent is the text that was signed, so approving
draft A cannot send draft B. It fails closed, and there is no timeout that files
on your behalf.

Your ordinary email is untouched: the gate only intervenes on messages carrying
a case marker or matching two or more legal-instrument phrases.

**Two things must be true before anything sends**, and the second is the one
that matters:

1. A signature record exists for that exact text.
2. **You typed an approval in chat** naming the case and the document's code.

The first alone is not enough, and deliberately so: CEASE can write that file
itself, so it proves the document is unchanged, not that a person read it. The
approval has to be a message from you, because that is the one thing CEASE
cannot produce on your behalf. It will not accept a button press, a menu choice,
or its own words repeated back.

Change the document and its code changes, so an approval of draft A can never
send draft B.

**What this is not:** a cryptographic signature. It is a deliberate human act
with an audit trail. DocuSign is the upgrade path and is not wired in.

## What connects

**Live:** Gmail (support mail, sending), Notion (cases, fingerprint, audit log),
Google Calendar (counter-notice deadlines), Firecrawl (marketplace, domain and
social search), the browser (evidence capture), and the host's scheduled tasks.

**Not connected in this build:** Shopify and Stripe. Catalog, orders and
disputes come from synthetic fixtures in `fixtures/`. Everything reads through
`scripts/sources.mjs`, so connecting them later changes no skill — turn off
**Use bundled test data** in settings.

## Honest limits

Worth stating plainly, because this category is full of overclaiming.

- **Precision is unmeasured.** CEASE has never run against a real brand's data.
  It makes no false-positive claim, and will not until it has earned one.
- **Crawl breadth is narrower** than a dedicated index product. CEASE trades
  recall for precision and for proof of damages.
- **Catalog and payment detection run on test data** in this build. Those
  channels are structurally exercised, not validated against reality.
- **No private ad metrics.** CEASE checks public ad libraries for your creative
  running under another advertiser. It does not see CPM, click-through rate,
  branded cost-per-click or impression share — that needs an ads connector.
- **Image matching is exact-byte only.** It catches a counterfeiter reusing your
  original file. A resized or re-encoded copy will not match; perceptual hashing
  is deferred.
- **It cannot practise law.** Drafting is not advice. Escalation past platform
  remedies needs a real attorney.
- **Marketplace leverage depends on programs you enrol in yourself** — Amazon
  Brand Registry, Transparency, Project Zero. CEASE prepares and tracks; it does
  not substitute.
- **No customs or physical seizure** beyond preparing a recordal you file.
- **Some platforms have no API path** for IP reports; those are browser-assisted
  form walks, which are slower and more fragile.
- **The gate covers send-shaped connector tools.** A shell `curl` to a platform
  API is not gated.

## Your data

CEASE stores **no credentials**. All authentication lives in Claude's connector
layer. Case files and the audit log go to your own Notion workspace. The local
signature ledger holds case ids, approver names, timestamps and hashes — never
message bodies or customer data.

Note that evidence capture visits the suspect's site from your browser, which is
observable by them.

## Development

```bash
npm test          # 116 tests
npm run validate  # structural validation against the plugin spec
```

`tools/validate-structure.mjs` is a stand-in for `claude plugin validate
--strict`, which could not be run in the build environment. It does not replace
it — run the real validator before publishing.

## Legal

References 17 U.S.C. § 512: takedown elements at § 512(c)(3)(A),
counter-notification at § 512(g)(3), misrepresentation liability at § 512(f).
This is software, not legal advice.

MIT licensed.
