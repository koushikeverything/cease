# CEASE — Brand protection plugin for Claude

**One line:** Bustem and its peers scan four billion pages to *guess* who's copying you. CEASE starts inside your own stack — your catalog, your ad account, your support inbox, your chargebacks — where the evidence of counterfeiting already sits, unread.

**Plugin slug:** `cease`
**Target user:** DTC / e-commerce brand, $1M–$100M revenue, no in-house legal
**Category:** Brand protection, IP enforcement, revenue recovery

---

## 1. The strategic wedge

Every incumbent in this category (Bustem, Red Points, Corsearch, BrandShield) sells the same shape: an external crawler plus a dashboard. Their moat is index breadth. A plugin cannot and should not compete on crawl volume.

But the incumbents all share one structural blind spot: **they have no access to the brand's first-party systems.** They are outside the wall, guessing. Meanwhile the highest-signal counterfeit evidence in the world is sitting inside the brand's own tools:

| Signal | Where it lives | What it actually means |
|---|---|---|
| "I ordered from your site and got a fake" | Support inbox / Zendesk | A counterfeit storefront is already converting your traffic |
| Chargebacks with reason code "product not as described" from orders you can't find | Stripe / Shopify | Customers bought from an impersonator using your brand name |
| Returns of items that aren't your SKUs | Shopify / 3PL | Counterfeit in circulation, physical sample in hand |
| A creative's CPM doubles and CTR collapses overnight | Meta / Google / TikTok ads | Someone else is running your creative, competing in your auction |
| Branded search CPC spikes with no campaign change | Google Ads | A copycat is bidding on your trademark |
| Traffic from a referring domain you don't recognize | Analytics | An affiliate cloner or a lookalike site |

None of this requires a crawler. All of it requires connectors — and it is near-zero false positive, because a real customer already got burned.

**The positioning:** incumbents detect *outside-in* with high recall and low precision. CEASE detects *inside-out* with high precision, then uses search and browser agents to trace each confirmed signal back to its source. The two are complementary; the inside-out half is the half nobody sells, and it's the half that comes with proof of damages attached.

**Secondary wedge — pricing shape.** Incumbents charge $1.5k–$10k/month retainers because they run infrastructure. CEASE runs on connectors the brand already pays for. That collapses the price floor and opens the sub-$5M segment that is currently unserved.

---

## 2. Plugin architecture

```
cease/
├── .claude-plugin/plugin.json
├── skills/
│   ├── baseline/        # one-time: build the Brand Fingerprint
│   ├── sweep/           # detection run across all channels
│   ├── triage/          # classify + score every hit
│   ├── evidence/        # build the case file
│   ├── enforce/         # produce the right instrument per platform
│   ├── pursue/          # post-takedown verification + relaunch watch
│   └── brief/           # weekly scorecard
├── agents/
│   ├── marketplace-investigator.md
│   ├── social-investigator.md
│   ├── domain-investigator.md
│   ├── ads-investigator.md
│   └── evidence-clerk.md
├── commands/
│   ├── scan.md    check.md    case.md
│   ├── enforce.md testbuy.md  brief.md
├── hooks/
│   └── pre-send-gate.js   # blocks any outbound legal instrument without signature
└── templates/
    ├── dmca-512c.md         amazon-report.md
    ├── meta-ip-form.md      tiktok-ipp.md
    ├── registrar-abuse.md   cloudflare-abuse.md
    ├── payment-processor.md cease-and-desist.md
    └── counter-notice-response.md
```

---

## 3. Skills

### 3.1 `cease:baseline` — the Brand Fingerprint
Runs once at install, refreshes monthly.

**Reads:** Shopify (`search_products`, `get-product`, `get-shop-info`) for the full catalog — titles, descriptions, image URLs, SKUs, price bands. Google Drive / Notion for trademark registration numbers, brand guidelines, authorized reseller list, and any prior enforcement history. Ads connector for the live creative library.

**Produces:** a canonical `brand-fingerprint.json` written to Notion (or Drive) containing:
- Perceptual hashes (pHash) of every product image — this is what makes image-theft detection deterministic rather than vibes-based
- Distinctive copy n-grams from product descriptions (counterfeiters copy-paste; exact-phrase search is the cheapest detector that exists)
- Trademark registration numbers + classes, per jurisdiction
- Owned domains, social handles, authorized reseller list — **the allowlist, so the plugin never flags a legitimate partner**
- Price floor per SKU — anything below it is presumptively counterfeit
- MAP policy, if one exists

The allowlist matters more than it sounds. The single loudest complaint about automated brand protection is false positives against real distributors. Because CEASE reads the brand's own systems, it knows who the real distributors are.

### 3.2 `cease:sweep` — detection
Runs on a schedule (daily) and on demand. Fans out to five investigator subagents in parallel.

| Investigator | Inputs | Method |
|---|---|---|
| **Marketplace** | Fingerprint, Shopify, TikTok Shop connector | Search Amazon / eBay / Etsy / AliExpress / Walmart / TikTok Shop for exact copy n-grams and SKU strings; compare listing images to pHash set; flag anything below price floor from a seller not on the allowlist |
| **Social** | Fingerprint | Search Instagram / TikTok / Facebook Marketplace for handle variants (typosquats, hyphen and underscore permutations, `.official` / `.store` / `.outlet` suffixes) and for reposted product photography |
| **Domain** | Fingerprint | Typo/homoglyph domain permutation set → DNS resolution check → WHOIS / registrar / host lookup → live-page screenshot and content compare. Norton `cybersafety_scam_check` as a second opinion on suspicious domains |
| **Ads** | Supermetrics or Windsor.ai | Anomaly pass on CPM, CTR, branded CPC, impression share lost. A sudden branded-search CPC jump with no campaign change is a copycat bidding on the trademark. Cross-check Meta Ad Library for your creative running under someone else's page |
| **First-party distress** | Gmail / Zendesk, Stripe, Shopify | Semantic search of support mail for counterfeit language; chargeback reason-code clustering; returns of non-SKU items. **This is the highest-precision channel and runs first** |

The sweep is deliberately cheap on the outside-in channels and thorough on the inside-out ones — the inverse of how incumbents allocate.

### 3.3 `cease:triage` — classify and score
Each hit is classified into one of six types, because the enforcement instrument differs entirely by type:

1. **Counterfeit goods** — physical fakes for sale → marketplace IP report, test buy, customs
2. **Unauthorized reseller** — genuine goods, broken MAP → contract/distribution remedy, not IP
3. **Content theft** — your photos/copy on their store → DMCA § 512(c)
4. **Domain impersonation** — lookalike storefront → registrar + host + payment processor
5. **Ad creative theft** — your creative in their account → platform ad-policy report + Meta/Google IP form
6. **Review or social impersonation** — fake account, fake endorsements → platform impersonation report

Each gets a severity score from four factors the plugin can actually measure: **traffic proximity** (are they ranking on your branded terms?), **revenue at risk** (price × observed listing velocity, benchmarked against your own conversion data), **customer harm evidence** (any linked support ticket or chargeback — this is the multiplier), and **persistence** (is this a repeat offender from the case history?).

Output is a ranked docket, not a list of 4,000 alerts. Triage exists to *reduce* what reaches the founder.

### 3.4 `cease:evidence` — build the case file
For every hit promoted to a case, the evidence clerk agent assembles:

- Full-page screenshot with visible URL and system timestamp (browser connector)
- Archived HTML source
- Side-by-side image comparison with pHash distance stated numerically
- WHOIS record, registrar, nameservers, hosting provider, CDN
- Seller identity, storefront age, other listings by the same seller
- Your ownership proof: original photo file with EXIF, first-publication date from the Shopify product record, trademark registration number
- Linked first-party harm: the support ticket, the chargeback, the return

Stored as a structured Notion page per case, with a `computer://`-style local copy in Drive. **The point is chain of custody.** If a case ever escalates to a registrar dispute, a marketplace appeal, or actual litigation, this file is what your attorney needs and what the incumbents' dashboards don't give you in exportable form.

### 3.5 `cease:enforce` — the right instrument, drafted
Not "one-click DMCA." The correct instrument per case type and per platform, pre-filled from the case file:

- **DMCA § 512(c)(3)(A) notice** — drafted with all six statutory elements: authorization signature, identification of the copyrighted work, location of the infringing material, contact details, good-faith statement, and the sworn statement under penalty of perjury.
- **Marketplace IP reports** — Amazon Brand Registry report, eBay VeRO, Etsy, Walmart, TikTok Shop IPP. These are *not* DMCA notices and have their own forms and evidence expectations.
- **Platform IP forms** — Meta IP report, Google Ads trademark complaint, TikTok IPP.
- **Registrar and host abuse** — routed to the correct abuse contact from the WHOIS lookup, with the Cloudflare abuse path handled separately when Cloudflare is fronting the origin.
- **Payment processor report** — Stripe / PayPal / Shopify Payments. Underused and often the fastest kill: a counterfeit store that can't take money is dead regardless of whether the domain survives.
- **Cease and desist** — drafted, for attorney review, escalating rather than opening with it.
- **Counter-notice response brief** — when an infringer files a § 512(g)(3) counter-notice, the host must restore the material in 10–14 business days unless you file a court action. The plugin flags the deadline on your calendar and prepares the decision memo.

**Everything stops at a signature gate.** See § 6.

### 3.6 `cease:pursue` — the part everyone skips
Takedowns without follow-through are whack-a-mole, and this is where most services quietly fail.

- Verification sweep at +24h, +72h, +7d: is it actually gone?
- Relaunch detection: the same pHash set, the same copy n-grams, the same seller fingerprint, the same registrant email or nameserver — reappearing under a new domain
- Repeat-offender dossier: a seller hit three times becomes an escalation case, with the accumulated history that makes registrar and marketplace escalation actually work
- Escalation ladder: platform report → registrar → host → payment processor → attorney (via the LegalZoom or General Legal connector) → customs recordal

### 3.7 `cease:brief` — Monday scorecard
Posted to Slack and archived in Notion. Deliberately short: what's new, what's resolved, what needs your signature this week, what's stuck and why, and the running recovery estimate with its assumptions shown.

---

## 4. Slash commands

| Command | What it does |
|---|---|
| `/cease scan` | Run a full sweep now |
| `/cease check <url>` | Triage one specific URL a customer or employee sent you — the most-used command in practice |
| `/cease case <id>` | Open a case file, see evidence, status, next action |
| `/cease enforce <id>` | Draft the enforcement pack for a case, ready to sign |
| `/cease testbuy <id>` | Walk through an evidence purchase from the suspect listing, log the order, and file the physical evidence when it arrives |
| `/cease brief` | Generate the scorecard on demand |

---

## 5. Connector wiring

**Core (required — the plugin doesn't work without these)**
- **Shopify** — catalog, images, SKUs, price floors, order lookup
- **Gmail** — support-inbox mining, sending notices, receiving platform responses, threading case correspondence
- **Notion** or **Google Drive** — case files, brand fingerprint, evidence archive
- **Claude in Chrome** or the built-in browser — evidence capture, screenshots, walking platform report forms

**Amplifying (each one adds a detection channel)**
- **Stripe** / **Razorpay** / **Chargebee** — chargeback reason codes, revenue reconciliation
- **Supermetrics** or **Windsor.ai** — Meta / Google / TikTok ad anomaly detection across 200–320 sources
- **AfterShip Channels for TikTok Shop** — marketplace listing surveillance
- **Slack** — alerting, the signature-request loop, war-room threads
- **Google Calendar** — counter-notice deadlines, marketplace appeal windows, trademark renewals
- **Norton** (authless) — independent scam/phishing verification on suspect domains

**Escalation**
- **Docusign** — signing sworn declarations with an audit trail
- **LegalZoom** or **General Legal** — attorney review when a case escalates past platform remedies
- **Linear** or **Asana** — when enforcement becomes a tracked workstream with owners

**Why this matters strategically:** every connector the brand adds makes the plugin better at its job, and each one is a switching cost the incumbent dashboard can never build, because the incumbent will never be allowed inside Stripe and the support inbox.

---

## 6. The human-in-the-loop gate (a feature, not a limitation)

A DMCA notice carries a statement made under penalty of perjury, and **17 U.S.C. § 512(f)** creates real liability for anyone who knowingly materially misrepresents that material is infringing — damages, costs, and attorney's fees.

So: **CEASE never auto-files.** A `pre-send` hook blocks any outbound legal instrument until a named human with authority to act for the rights holder reviews the case file and signs. The plugin does the 95% that is research, evidence assembly, jurisdiction and form selection, and drafting. A person does the 5% that is legal attestation.

This is the opposite of the category's "one-click automated DMCA" marketing, and it's the more defensible position — both legally and commercially. The failure mode of automated filing is a § 512(f) claim against your own brand, and the brands most likely to get hit are the ones with the most aggressive automation.

The gate also produces the audit log: who approved what, on what evidence, on what date. That's the artifact you want if a takedown is ever challenged.

---

## 7. Scheduled tasks

| Task | Cadence | Output |
|---|---|---|
| First-party distress sweep | Daily, 07:00 local | Slack alert only if something crosses threshold |
| Full multi-channel sweep | Daily, 02:00 local | Docket updated, no notification unless severity ≥ high |
| Takedown verification | +24h / +72h / +7d after each filing | Case status update, auto-escalate on failure |
| Relaunch watch | Daily, on closed cases for 90 days | New case auto-opened, linked to parent |
| Weekly brief | Monday 09:00 | Slack + Notion |
| Counter-notice deadline | On receipt | Calendar block at day 7 of the 10–14 business day window |

---

## 8. Honest limits

Worth stating plainly in any pitch, because the category is full of overclaiming:

- **Crawl breadth is genuinely narrower** than a dedicated crawler with a maintained index. CEASE will miss long-tail listings a full-index product catches. It trades recall for precision and for proof of damages.
- **It cannot practice law.** Drafting is not advice; escalation past platform remedies needs a real attorney, which is why the attorney connector is in the spec.
- **Marketplace enforcement leverage** still depends on programs the brand must enroll in itself — Amazon Brand Registry, Transparency, Project Zero. The plugin can prepare and track those applications, not substitute for them.
- **No customs or physical seizure capability** without a customs recordal the brand files.
- **Some platforms have no API path** for IP reports; those are browser-assisted form walks, which are slower and more fragile than an integration.

---

## 9. Build sequence

| Phase | Scope | Why first |
|---|---|---|
| **1. Wedge** | `baseline` + first-party distress sweep + `check <url>` + evidence capture | Needs only Shopify + Gmail + browser. Delivers a real "here are three counterfeit storefronts already burning your customers" moment on day one. Cheapest possible proof of value. |
| **2. Enforcement** | `enforce` with DMCA + the four big marketplace forms, signature gate, case files in Notion | Converts detection into outcomes. This is where willingness-to-pay appears. |
| **3. Breadth** | Domain, social, ads investigators; scheduled sweeps; weekly brief | Moves from reactive to standing protection. |
| **4. Persistence** | `pursue`, relaunch watch, repeat-offender escalation ladder, attorney handoff | The retention mechanic — this is what stops churn after the first wave of takedowns succeeds. |

---

*Legal mechanics in this document reference 17 U.S.C. § 512 (takedown elements at § 512(c)(3)(A), counter-notification at § 512(g)(3), misrepresentation liability at § 512(f)). This is a product specification, not legal advice.*
