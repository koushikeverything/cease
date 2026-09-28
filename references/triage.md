# Triage — classify, score, reduce

Loaded by `cease:sweep` and `cease:check`. Triage exists to **reduce** what
reaches the user (R16). A run that hands over every hit has failed.

The skill that loaded this file runs the triage script; the exact command is in
that skill body. This file is the rubric, not the invocation.

## The six types — the type selects the instrument

Getting the type wrong sends the wrong legal instrument, so this is a
correctness question, not a labelling one.

| Type | What it is | Instrument it routes to |
|---|---|---|
| `counterfeit-goods` | physical fakes for sale | marketplace IP report, test buy, customs |
| `unauthorized-reseller` | genuine goods, broken price floor | **contract remedy, not IP** |
| `content-theft` | your photos or copy on their store | DMCA §512(c) |
| `domain-impersonation` | lookalike storefront | registrar + host + payment processor |
| `ad-creative-theft` | your creative in their ad account | platform ad-policy + IP form |
| `social-impersonation` | fake account or endorsement | platform impersonation report |

**The distinction that matters most** is counterfeit goods versus unauthorized
reseller. One is an intellectual-property violation; the other is a contract
dispute with someone who bought genuine stock. Filing a DMCA notice against a
grey-market reseller is both wrong and exposure under 17 U.S.C. §512(f).

## What gets held instead of guessed (F9)

`scripts/triage.mjs` returns `held-for-classification` when the evidence does
not separate those two — typically a listing selling a real SKU at a plausible
price from a seller you do not recognise. Held items appear in their own
section with the question spelled out. **Do not resolve them by guessing.** Ask
the user, or send it to `cease:check` for evidence that settles it.

## Scoring — four things CEASE can actually measure (R15)

- **Traffic proximity** — are they ranking on your branded terms, or sitting on
  a lookalike domain? (0–25)
- **Revenue at risk** — unit price gap × observed velocity, log-scaled so one
  listing with 4,000 reviews does not drown everything else. (0–25)
- **Persistence** — prior cases against this seller. (0–25)
- **Customer harm** — a **multiplier**, not an addend (×1 to ×2). A hit with a
  real burned customer attached outranks a larger hit with none, because that
  is the hit that comes with proof of damages.

Bands: `critical` ≥ 70 · `high` ≥ 45 · `medium` ≥ 20 · `low` below.

## Reporting the reduction

Always show the arithmetic:

> 41 raw hits → 6 on the docket: 12 suppressed as yours or authorized,
> 23 held for you to classify.

Never present the docket without it. A user who cannot see what was filtered
cannot tell the difference between a quiet week and a broken detector.
