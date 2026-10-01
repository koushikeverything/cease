# CEASE — Inside-Out Brand Protection

**Your support inbox already knows who's counterfeiting you. CEASE reads it, traces
each signal to the storefront behind it, builds a case file that survives a lawyer,
and drafts the right legal instrument — then refuses to send it until you've
personally approved that exact document.**

Every incumbent in this category (Bustem, Red Points, Corsearch, BrandShield) sells the
same shape: an external crawler plus a dashboard. Their moat is index breadth, and they
are all outside the wall, guessing.

Meanwhile the highest-signal counterfeit evidence in the world sits unread inside the
brand's own tools:

| Signal | Where it lives | What it actually means |
|---|---|---|
| "I ordered from your site and got a fake" | support inbox | a counterfeit storefront is converting your traffic *right now* |
| Chargeback for an order you can't find | payments | a customer bought from an impersonator using your name |
| A return of something that isn't your SKU | orders | counterfeit in circulation, physical sample in hand |
| Your creative under another advertiser | public ad libraries | someone is running your ads |

None of that needs a crawler. All of it is near-zero false positive, because a real
customer already got burned — which means it arrives with **proof of damages attached**.

CEASE gives you:

1. **A ranked docket, not an alert feed.** Hits classified into one of six enforcement
   types, scored on four things it can actually measure, with your authorized
   resellers suppressed before anything reaches you.
2. **Case files with verifiable chain of custody.** Every artifact hashed at capture
   and re-checkable later, exportable for an attorney.
3. **The correct instrument per case, drafted and gated.** Nine templates — a DMCA
   notice is not an Amazon report is not a registrar abuse report — and nothing leaves
   without your typed approval.

---

## Product boundary (read this before trusting it with a legal filing)

CEASE is **decision support and drafting**. It does the 95% that is research, evidence
assembly, jurisdiction and form selection, and drafting. A person does the 5% that is
legal attestation.

It does **not**: file anything automatically · practise law or give legal advice ·
decide whether to litigate · purchase anything on your behalf · modify your store,
payment or ad accounts · store any credential of its own.

**Why the gate is the product, not a limitation.** A DMCA notice carries a statement
made under penalty of perjury, and **17 U.S.C. § 512(f)** creates real liability for
knowingly misrepresenting that material is infringing — damages, costs, attorney's fees.
The brands most likely to get hit by a § 512(f) claim are the ones with the most
aggressive automation. "One-click automated DMCA" is the category's marketing and it is
the failure mode.

**Precision is unmeasured.** CEASE has never run against a real brand's data. It makes
no false-positive claim anywhere, and a test fails the build if any file tries to.

---

## ⚡ Install (Claude Code)

This repo **is** a Claude Code plugin marketplace:

```bash
/plugin marketplace add koushikeverything/cease
```

```bash
/plugin install cease@cease-marketplace
```

> Cloning defaults to SSH; without SSH keys use
> `/plugin marketplace add https://github.com/koushikeverything/cease.git`.

To try it without installing, point Claude Code at a local checkout:

```bash
claude --plugin-dir /path/to/cease
```

**Zero dependencies.** Nothing to `npm install`; every script is stdlib Node. This is
deliberate — plugin dependencies install with `--ignore-scripts` under a 60-second cap,
so a dependency that fails to build leaves a plugin loaded but quietly broken.

---

## First run, step by step

### 1. Connect what you have *(2 minutes)*

CEASE reads through connectors you already own. In **Settings → Connectors**, enable
whichever of these you have:

| Connector | What it unlocks | Needed? |
|---|---|---|
| **Gmail** | support-inbox detection, sending signed notices | **yes** — this is the wedge |
| **Notion** | case files, brand fingerprint, audit log | **yes** — this is where cases live |
| **Shopify** | catalog, SKUs, price floors, order lookup | strongly recommended |
| **Stripe** | chargeback reason codes | adds one detection channel |
| **Google Calendar** | counter-notice deadlines, appeal windows | recommended |
| **Firecrawl** | marketplace, domain and social search | adds four detection channels |
| **Slack** | alerts and signature requests | optional — Gmail substitutes |

Browser and scheduled tasks are built into Claude; nothing to enable.

**Without Shopify and Stripe, CEASE runs on bundled synthetic test data** and says so in
every report. See [Fixture mode](#fixture-mode).

### 2. Fill in plugin settings *(once)*

Claude Code prompts you on install. Only `brand_name` is required:

| Setting | Example | Why it matters |
|---|---|---|
| `brand_name` | `Lumen Goods` | **required** |
| `owned_domains` | `lumengoods.com, lumengoods.co.uk` | every one you miss becomes a false positive against yourself |
| `owned_handles` | `@lumengoods, @lumengoods.official` | same |
| `authorized_resellers` | `Northwind Retail, Acme Distribution` | **the single highest-value field.** Flagging a real distributor is the failure that destroys trust in the whole system |
| `authorized_signers` | `Dana Okafor` | display and validation only — **never** authentication |
| `notion_case_db` | your Notion database URL | where cases are written |
| `fixture_mode` | `true` (default) | turn **off** once Shopify and Stripe are connected |

### 3. Build the brand fingerprint *(once, then monthly)*

```
/cease:baseline
```

Everything CEASE detects is a comparison against this. It reads your catalog and
produces: distinctive copy phrases per product (counterfeiters copy-paste descriptions,
so exact-phrase search is the cheapest detector that exists), a price floor per SKU
(default 60% of list — anything below is presumptively counterfeit), image hashes, and
the authorized-reseller allowlist.

It will ask once for what the catalog can't tell it: trademark registration numbers and
classes, owned domains and handles, and your reseller list. Answer in one go.

### 4. Check one suspect thing *(the command you'll use most)*

```
/cease:check https://lumengoods-outlet.example/products/halo-pendant
```

A customer forwards you a link; you want an answer. This works **cold** — no prior
sweep, no setup beyond step 3, and it still helps if you skipped step 3 (it just says
the comparison is weaker).

You get a verdict in one sentence, then the evidence under it: the copied phrase, the
price gap, the registrar. And the next step named.

Ambient too — you don't have to type the command. *"A customer sent me this link, is it
a real store?"* reaches the same skill.

### 5. Run a full sweep

```
/cease:sweep
```

First-party channels run **first**, because they're the highest-precision signal:

1. **Support-inbox distress.** Gmail search is keyword-only — it is *not* a detector. A
   probe of a real inbox returned 201 matches whose top hits were all newsletters using
   the word "fake". So CEASE retrieves broadly, then **classifies each thread**. A
   genuine signal is a customer describing their own purchase.
2. **Disputes with no matching order.** Reconciled against the order book. Two on one
   reason code is a cluster, not a coincidence.
3. **Returns that aren't your SKUs.** Counterfeit in circulation, sample in hand.

Then four investigators fan out in parallel — marketplace, social, domain, and public ad
libraries — and everything goes through triage.

**You always get the arithmetic:**

```
41 raw hits -> 6 on the docket: 12 suppressed as yours or authorized,
23 held for you to classify.
```

Never a docket without it. A user who can't see what was filtered can't tell a quiet
week from a broken detector.

### 6. Document, then enforce

```
/cease:evidence c-0001
/cease:enforce  c-0001
```

`evidence` captures before analysing — counterfeit storefronts vanish, often hours after
being contacted. Screenshot with visible URL and timestamp, archived page source,
registrar and host facts, seller identity, your ownership proof, and the support ticket
or chargeback that proves harm. Each artifact hashed **at capture**.

`enforce` picks the instrument from the case type, fills it from the case file, and
**invents nothing** — a missing value is listed and asked for, because a fabricated
registration number in a sworn document is a serious problem, not a formatting gap.

If the case needs physical proof — marketplace appeals and payment-processor reports both
land far harder with a sample in hand:

```
/cease:testbuy c-0001
```

**CEASE never makes the purchase.** It prepares the order, records it against the case,
and files the photographs when it arrives. You place it. It holds no payment details and
never asks for card details — if anything ever appears to, that is wrong and worth
reporting. It also carries the detail that makes a test buy worth doing at all: ship to
an address that isn't the brand's, or a counterfeiter who recognises the buyer sends a
genuine item and defeats the whole exercise.

### 7. Approve it — the part that can't be automated

See [The signature gate](#the-signature-gate). You type an approval. Nothing sends
without it.

### 8. Follow it through

```
/cease:pursue
```

Takedowns without follow-through are whack-a-mole, and this is where most services
quietly fail. Re-checks each filing at +24h, +72h and +7d; detects relaunches under new
domains by matching what an operator *can't* cheaply change (pasted copy, stolen images,
registrant email, nameservers); and climbs an escalation ladder where the
**payment processor is often the fastest kill** and the most underused — a store that
can't take money is dead whether or not the domain survives.

### 9. Put it on a schedule

CEASE ships **no scheduler** — it asks Claude for one, so just say:

> Create a daily 07:00 scheduled task running `/cease:sweep first-party`, a daily 02:00
> one running `/cease:sweep`, and a Monday 09:00 one running `/cease:brief`.

---

## All eight skills

Each works as a slash command *and* ambiently — you don't have to remember the names.

| Skill | What it does | Say it instead |
|---|---|---|
| `/cease:baseline` | builds the brand fingerprint and the reseller allowlist | *"we've taken on three new stockists"* |
| `/cease:sweep` | full detection pass across every connected channel | *"is anyone selling knock-offs of our stuff?"* |
| `/cease:check` | triages one link, listing, handle or ad — works cold | *"is this shop us or someone pretending?"* |
| `/cease:evidence` | builds or opens a case file with chain of custody | *"our solicitor wants a full pack on this seller"* |
| `/cease:enforce` | drafts the right instrument and routes it for signature | *"what do I send Amazon to make them pull this?"* |
| `/cease:testbuy` | walks an evidence purchase — you place the order | *"should we buy one ourselves to be sure?"* |
| `/cease:pursue` | verifies takedowns, catches relaunches, escalates | *"that shop we killed is trading again"* |
| `/cease:brief` | the weekly scorecard | *"give me the Monday rundown"* |

Five read-only investigator subagents run underneath `sweep` and `check` — marketplace,
social, domain, ads, and an evidence clerk. None of them can write, send, or classify;
they find and report.

---

## The signature gate

**Two things must be true before anything sends, and the second is the one that matters:**

1. A signature record exists for that exact text.
2. **You typed an approval in chat**, naming the case and the document's code.

The first alone is not enough, and deliberately so. The signature record is a file on
disk, and the skill that drafts an instrument can write files — so it proves the document
is unchanged, not that a person read it. The approval has to be a message *from you*,
because that is the one thing CEASE cannot produce on your behalf.

```
approve c-0042 a1b2c3d4
```

It will not accept a button press, a menu choice, or its own words repeated back. Change
the document and its code changes, so approving draft A can never send draft B.

**What's actually gated:** outbound connector sends (email, Slack), browser form fills
and clicks, `Bash`, and `WebFetch` — because five of the nine instruments are *web
forms* (Amazon, Meta, TikTok, Cloudflare), not emails. Gating only email would have left
the majority path open.

**Your ordinary mail is untouched.** The gate intervenes only on messages carrying a case
marker, or carrying two or more *operative* phrases — the sworn language that appears
only inside an instrument ("under penalty of perjury"), never the topic words you use
when discussing one ("DMCA"). Quoted and forwarded text is stripped before counting, so
replying to your attorney about a filed notice goes through.

**It fails closed**, and there is no timeout that files on your behalf. If a draft is
never approved, it is never sent — indefinitely.

**What "signed" is not:** a cryptographic signature. It is a deliberate human act with an
append-only, hash-chained audit trail. DocuSign is the upgrade path and is not wired in.

---

## The six case types

The type selects the instrument, so getting it wrong is a correctness failure, not a
labelling one.

| Type | What it is | Instrument |
|---|---|---|
| `counterfeit-goods` | physical fakes for sale | marketplace IP report, test buy, customs |
| `unauthorized-reseller` | genuine goods, broken price floor | **contract remedy, not IP** |
| `content-theft` | your photos or copy on their store | DMCA § 512(c) |
| `domain-impersonation` | lookalike storefront | registrar + host + payment processor |
| `ad-creative-theft` | your creative in their ad account | platform IP form |
| `social-impersonation` | fake account or endorsement | platform impersonation report |

**The distinction that matters most** is counterfeit goods versus unauthorized reseller.
One is an IP violation; the other is a contract dispute with someone who bought genuine
stock. Filing a DMCA notice against a grey-market reseller is both wrong and § 512(f)
exposure — so when the evidence doesn't separate them, CEASE returns
`held-for-classification` with the question spelled out rather than guessing.

---

## Fixture mode

Shopify and Stripe aren't connected in a default install, so catalog, orders and disputes
come from synthetic fixtures in `fixtures/` — a fictional brand, "Lumen Goods".

Every channel reads through one **source adapter** (`scripts/sources.mjs`), so a fixture
today and a live connector later are the same call site. Switching costs you a settings
toggle, not a rewrite — and a test enforces that swapping in a live connector edits no
skill file.

The fixtures carry the cases that matter rather than filler: a dispute with no matching
order (twice, on one reason code), an authorized reseller below price floor, a relaunch
under a new domain, a lookalike whose domain *contains* an owned domain, and
**newsletters that match "fake"/"counterfeit" but aren't complaints** — the exact
false-positive shape observed in a real inbox probe.

`fixtures/disputes.json` is an explicit **guess** at Stripe's dispute schema, labelled as
one in the file. Stripe was never probed for dispute reachability; check it against that
shape before trusting payment detection on live data.

---

## Running the engine without the AI

Every number comes from a deterministic script. No model involved, no network calls:

```bash
node scripts/fingerprint.mjs fingerprint.json --hash-images
node scripts/triage.mjs      hits.json fingerprint.json
node scripts/suppress.mjs    hits.json allowlist.json
node scripts/relaunch.mjs    hits.json closed-cases.json
node scripts/case.mjs        verify    cases/c-0001.json
node scripts/case.mjs        readiness cases/c-0001.json
node scripts/sign.mjs        status
node scripts/audit-append.mjs verify "$CLAUDE_PLUGIN_DATA/audit.jsonl"
```

`case.mjs verify` re-hashes every artifact and reports anything altered or missing since
capture. `case.mjs readiness` names exactly which DMCA element is still absent — a case
without ownership proof cannot become a notice. `audit-append.mjs verify` walks the hash
chain and names the entry where it broke.

The AI layer orchestrates, classifies prose, and explains. It does not compute severity,
suppression, hashes or chain integrity.

---

## Known limitations (honest list)

- **Precision is unmeasured.** Never run against a real brand's data. No false-positive
  claim is made anywhere, and a test fails the build if one appears.
- **Triggering is measured at one run per case.** 36/36 cases routed correctly with zero
  misroutes — but at n=1 that's a clean sweep, not a stability claim.
- **Crawl breadth is genuinely narrower** than a dedicated index product. CEASE will miss
  long-tail listings a full-index crawler catches. It trades recall for precision and for
  proof of damages.
- **Catalog and payment detection run on fixtures** until Shopify and Stripe are
  connected.
- **No private ad metrics.** CEASE checks public ad libraries for your creative under
  another advertiser. It cannot see CPM, CTR, branded CPC or impression share — that
  needs an ads connector, and it will not infer them.
- **Image matching is exact-byte only.** It catches a counterfeiter reusing your original
  file; a resized or re-encoded copy will not match. Perceptual hashing is deferred
  because it needs an image decoder that may fail to build under `--ignore-scripts`.
- **Evidence capture needs an interactive session.** In a scheduled overnight run,
  screenshots can't be taken; those captures queue for your next live session.
- **Marketplace leverage depends on programs you enrol in yourself** — Amazon Brand
  Registry, Transparency, Project Zero. CEASE prepares and tracks; it does not
  substitute.
- **No customs or physical seizure** beyond preparing a recordal you file.
- **Some platforms have no API path** for IP reports; those are browser-assisted form
  walks, slower and more fragile than an integration.
- **The audit log is tamper-evident, not tamper-proof.** An unkeyed hash chain detects
  edits; anything with write access can truncate and re-chain it. A forged log can no
  longer authorise a send (that's what the typed approval is for), so the log's integrity
  is no longer load-bearing for the gate.

---

## Your data

CEASE stores **no credentials**. All authentication lives in Claude's connector layer.

- **Case files and the audit log** go to *your* Notion workspace.
- **The local signature ledger** holds case ids, approver names, timestamps and hashes —
  never message bodies or customer data.
- **Brand data leaves to Firecrawl** as search queries (product phrases, brand names)
  when you run marketplace, domain or social detection.
- **Customer PII lands in Notion.** Linking the originating support email to a case means
  a real customer's name and complaint are copied into your case file.
- **Visiting a counterfeiter's site is observable by them.** Evidence capture hits their
  server from your browser. They can see they're being looked at, and may cloak or pull
  the page. Nothing here pretends otherwise.

---

## Development

```bash
npm test          # 179 tests, zero dependencies
npm run validate  # structural validation against the plugin spec
```

```bash
# all four targets — a single `validate .` checks the marketplace manifest alone
for t in .claude-plugin/plugin.json ./skills ./agents .; do
  claude plugin validate "$t" --strict
done
```

```bash
# triggering: measure routing from the trace, not from a judge
claude plugin eval . --runs 3 -j 4 --trust-plugin \
  --allow-tools Skill Read Glob Grep --keep-temp --ablation none --json run.json
node tools/routing-report.mjs run.json
```

`tools/routing-report.mjs` exists because `claude plugin eval`'s scored grader is an LLM
judge, and `tool_used: Skill` cannot say *which* skill fired. In a sandbox with no shell,
a skill that routes perfectly then can't run reads to a judge as a failure — which is how
a 36/36 routing result scored 27/36. The report reads the `skill` field of the trace's
tool_use events instead, and refuses to report at all on an incomplete or errored run.

`evals/results/` is build output and is gitignored — it carries full transcripts and
absolute local paths.

**Canonical artifacts:** `SPEC.md` (requirements, acceptance, exclusions, the leverage
verdict) · `docs/design/` (surface, triggering plan, security posture) ·
`docs/leverage/` (probe evidence) · `docs/checks/` (the review, findings, dispositions) ·
`docs/solutions/` (durable learnings and their enforcement) · `CONCEPTS.md` (vocabulary).

---

## Troubleshooting

- **"Run `/cease:baseline` first"** — every detector compares against the fingerprint.
  `/cease:check` works without one, with a weaker comparison; `/cease:sweep` does not.
- **Results say "test data" / the brand is "Lumen Goods"** — you're in fixture mode.
  Connect Shopify and Stripe, then turn off **Use bundled test data** in plugin settings.
- **The gate blocked something and you don't think it should have** — read the reason; it
  names the case and the exact phrase to type. If it blocked ordinary mail, that's a bug
  worth reporting: paste the message shape (not its contents) in an issue.
- **"No message from you approving case X"** — approval must be *typed by you* in chat,
  with the case id and document code. A menu choice or button won't register, by design.
- **A sweep reports channels that "did not run"** — that's deliberate. A channel that
  found nothing and a channel that never ran are different facts, so both are reported.
- **The docket is empty** — check the reduction line. `0 on the docket: 14 suppressed`
  means your allowlist is working; `0 raw hits` means the detectors found nothing.
- **An authorized reseller appeared on the docket** — they shouldn't. Check
  `authorized_resellers` in settings; matching tolerates case and punctuation but not
  different trading names.
- **`node: command not found` inside a skill** — the scripts need Node on PATH. CEASE
  declares no dependencies, so that's the only runtime requirement.

---

## Legal

References 17 U.S.C. § 512: takedown elements at § 512(c)(3)(A), counter-notification at
§ 512(g)(3), misrepresentation liability at § 512(f). **This is software, not legal
advice.** Drafting is not advice, and escalation past platform remedies needs a real
attorney.

## License

MIT © 2026 — see [LICENSE](LICENSE).

Source: https://github.com/koushikeverything/cease
