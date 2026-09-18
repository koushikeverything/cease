---
name: enforce
argument-hint: "[case-id]"
description: >-
  Drafts the correct enforcement instrument for a case and routes it for
  signature: DMCA 512(c)(3) notice with all six statutory elements, marketplace
  IP reports (Amazon, eBay VeRO, Etsy, Walmart, TikTok Shop), platform IP forms
  (Meta, Google Ads trademark, TikTok), registrar and host abuse reports
  addressed from the case's own WHOIS record, payment-processor reports,
  cease-and-desist for attorney review, and counter-notice response memos with
  the restore deadline calendared. Nothing is ever sent without a named human
  signing first. Use when you say "file a takedown", "draft the DMCA", "report
  this listing", "we got a counter-notice", or "get this off Amazon". Not for
  finding or documenting infringement (cease:sweep, cease:check,
  cease:evidence). Does not give legal advice. Not for durable Eve agents
  (koushik plugin).
allowed-tools: Bash, Read, Write
---

# Draft the right instrument

Not "one-click DMCA". The instrument depends on the case type, and sending the
wrong one is worse than sending nothing.

## 1. Check the case is ready

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/case.mjs readiness cases/{{case}}.json
```

If it is not ready, report the missing elements **verbatim** and stop. A DMCA
notice without ownership proof is exposure, not enforcement (F7).

## 2. Pick the instrument from the classification

| Case type | Instrument |
|---|---|
| `content-theft` | `dmca-512c.md` |
| `counterfeit-goods` on a marketplace | `amazon-report.md` / `tiktok-ipp.md` — **not** a DMCA notice |
| `domain-impersonation` | `registrar-abuse.md` + `payment-processor.md`, plus `cloudflare-abuse.md` if a CDN fronts it |
| `ad-creative-theft` | `meta-ip-form.md` |
| `social-impersonation` | `meta-ip-form.md` / `tiktok-ipp.md` |
| `unauthorized-reseller` | **none of these.** It is a contract matter. Say so. |
| counter-notice received | `counter-notice-response.md` |

Two things to get right:

- **Marketplace reports are not DMCA notices.** They have their own forms and
  evidence expectations, and filing a § 512 notice into a marketplace queue
  usually just slows it down.
- **The payment processor is underused and often fastest.** A counterfeit store
  that cannot take money is dead whether or not the domain survives. Consider
  it early, not last.

Route abuse reports to the address in the case's **own WHOIS record**. Never
guess an abuse contact.

## 3. Fill it from the case file

Every `{{PLACEHOLDER}}` comes from the case or the fingerprint. **Leave nothing
invented.** If a value is missing, list it and ask — a fabricated registration
number in a sworn document is a serious problem, not a formatting gap.

The draft must contain its sentinel line, or the signature gate cannot match a
signature to it:

```
CEASE-Case: {{case}}
```

## 4. Record the draft, then get the signature

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/sign.mjs draft {{case}} <instrument> draft.txt
```

Now show the person the **complete text**, not a summary. Ask them to confirm
they have authority to act for the rights holder and that the statements are
true. Then:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/sign.mjs sign {{case}} "Their Name" draft.txt
```

Signing refuses if the text changed after drafting — signing must be an act on
something the person actually read.

**Be honest about what this signature is:** an in-session confirmation with an
audit trail. It is not a cryptographic signature. If they need one, that is
DocuSign, and CEASE does not have it connected.

If they decline or go quiet, the draft stays unsigned **indefinitely**. There
is no timeout that files on their behalf (F8). Discard it with
`sign.mjs discard {{case}}` if they say no.

## 5. Sending

Only after signing. The signature gate blocks unsigned sends automatically — if
you see it block something, that is the control working, not a bug to route
around. Never disable it, and never move an instrument to a different channel to
avoid it.

## What this skill will not do

- **It does not give legal advice.** Drafting is not advice. Say so when asked.
- It does not decide whether to litigate — that is `counter-notice-response.md`,
  a memo for a human and their attorney.
- It does not file anything itself. A person signs; a person sends.
