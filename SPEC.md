# SPEC — CEASE

**Artifact:** `cease` — a Claude Code plugin for inside-out brand protection.
**Target class:** `claude-plugin`
**Ecosystem:** claude (`references/ecosystems/claude/`)
**Defined:** 2026-09-17 · **Leverage manifest:** [`docs/leverage/2026-09-17-manifest.md`](docs/leverage/2026-09-17-manifest.md)
**Source of record for product intent:** [`CEASE-plugin-spec.md`](CEASE-plugin-spec.md) (unchanged by this stage)

---

## Stated scope decision and its risk

The user chose **full spec — all 7 skills** over the recommended Phase-1 wedge.
On 2026-09-18 they further confirmed that **no new connectors can be connected
for this build** — reversing the intake commitment to connect Shopify, Stripe
and Slack. Both are recorded decisions, delivered as asked.

**What this build actually runs on:**

| Channel | Source this build | Consequence |
|---|---|---|
| Support mail (R5), case files (R21), evidence capture (R17), deadlines (R28), marketplace/domain/social search (R8-R10), scheduling (R4, R13) | **live connectors** — Gmail, Notion, browser, Calendar, Firecrawl, scheduled-tasks | fully exercisable |
| Catalog, SKUs, price floors, orders (R1, R6, R7, R19) | **synthetic fixtures** (Shopify absent) | structural acceptance only |
| Payment disputes (R6) | **synthetic fixtures** (Stripe absent) | structural acceptance only; also defers the unresolved question of whether Stripe exposes dispute objects at all |
| Alerts and signature requests (R29 delivery, R35) | **Gmail**, not Slack | real and testable — a synthetic Slack would prove nothing |

The consequence, stated once here rather than discovered later:

> Every *detection* requirement that depends on catalog or payment data is
> acceptance-tested structurally ("the sweep runs, classifies, and suppresses
> allowlisted sellers on fixtures") rather than by outcome ("it found real
> fakes"). Precision — the entire strategic claim of this product — **cannot be
> measured in this loop.** A-IDs are written honestly against that limit, and
> A20 exists to make the gap explicit rather than silent.

Full scope also means the artifact's surface is large (8 skills, 5 subagents,
1 hook, 9 templates). Build should sequence by the source spec's 4-phase order
even though all four are in scope.

## Purpose and primary users

**Purpose.** Find counterfeit and impersonation evidence inside a brand's own
first-party systems — support inbox, payments, catalog, ads — trace each
confirmed signal to its source, assemble a chain-of-custody case file, and
draft the correct enforcement instrument for a human to sign.

**Primary user.** A DTC / e-commerce brand doing $1M–$100M with no in-house
legal: typically the founder or an ops lead, who has a support inbox full of
"I got a fake" emails and no idea which storefront they came from.

**Secondary user.** The brand's outside attorney, who receives the case file
when a matter escalates past platform remedies.

---

## Trigger moments

*In the user's own vocabulary. `/koushik-jr:design` lifts these verbatim when
drafting the plugin's skill descriptions — this section is the raw material
for triggering, not decoration.*

- "A customer emailed me saying they bought a fake from us — but that order isn't in our system."
- "Someone sent me this link, is it a real store or a knockoff?"
- "We're getting chargebacks for orders that don't exist."
- "There's an Instagram account using our name with `.official` on the end."
- "Someone's running our ad creative on their own page."
- "I need to file a DMCA takedown but I don't know what goes in it."
- "We got a counter-notice — what happens now, and when?"
- "We took that listing down two weeks ago and it's back under a new domain."
- "Which of these 40 alerts actually matters?"
- "My lawyer wants everything we have on this seller."
- "Are our photos being used on AliExpress?"
- "Give me the weekly brand-protection update."

---

## Requirements

Stable IDs. `[L]` = satisfied by a leveraged capability, not built (see
manifest §5). `[B]` = built.

### Brand fingerprint

| ID | Requirement |
|---|---|
| R1 `[B]` | Build a canonical brand fingerprint from the brand's own systems: product titles, descriptions, image perceptual hashes, SKUs, and a price floor per SKU. |
| R2 `[B]` | Record trademark registration numbers and classes per jurisdiction, owned domains, owned social handles, MAP policy — from user-supplied documents. |
| R3 `[B]` | Derive and maintain an **authorized-reseller allowlist** from the brand's own records, so legitimate partners are never flagged. |
| R4 `[L]` | Refresh the fingerprint monthly and on demand (scheduling leveraged from the native scheduled-tasks surface). |

### Detection

| ID | Requirement |
|---|---|
| R5 `[B]` | **First-party distress sweep, run first**: retrieve support mail by keyword, then classify each thread for genuine counterfeit/impersonation signal. Keyword retrieval alone is not a detector — see F1. |
| R6 `[B]` | Cluster payment disputes by reason code and reconcile against the order book; a dispute with no matching order is a high-severity signal. |
| R7 `[B]` | Flag returns of items that are not the brand's SKUs. |
| R8 `[B]` | **Marketplace detection**: search major marketplaces for distinctive copy n-grams and SKU strings; flag listings below the SKU price floor from sellers absent from the R3 allowlist. |
| R9 `[B]` | **Social detection**: generate handle-variant permutations (typosquats, separator swaps, `.official` / `.store` / `.outlet` suffixes) and search for them, plus reposted product photography. |
| R10 `[B]` | **Domain detection**: generate typo and homoglyph permutations, resolve them, and for live hosts capture registrar / nameserver / host / CDN facts and compare page content to the fingerprint. |
| R11 `[B]` | **Ad-creative theft detection, public sources only**: cross-check public ad libraries (Meta Ad Library and equivalents) for the brand's own creative running under another advertiser's page. **Narrowed 2026-09-18** — private ad-account metrics (CPM, CTR, branded CPC, impression share) are OUT of scope: they require an ads connector (Supermetrics / Windsor.ai) that is not connected and is not being added. See Exclusions. |
| R12 `[B]` | Suppress any hit whose seller, domain, or handle appears on the R3 allowlist, at every stage, before it reaches a human. |
| R13 `[L]` | Run sweeps on a schedule and on demand. |

### Triage

| ID | Requirement |
|---|---|
| R14 `[B]` | Classify every hit into exactly one of six types: counterfeit goods · unauthorized reseller · content theft · domain impersonation · ad creative theft · social/review impersonation. The type selects the instrument, so misclassification is a correctness failure, not a cosmetic one. |
| R15 `[B]` | Score severity from four measurable factors: traffic proximity, revenue at risk, linked customer-harm evidence (a multiplier), and persistence (repeat offender). |
| R16 `[B]` | Output a ranked docket that **reduces** what reaches the user. A sweep that emits every hit has failed this requirement. |

### Evidence

| ID | Requirement |
|---|---|
| R17 `[B]` | Capture a full-page screenshot showing the URL and a system timestamp, plus the page's archived HTML source. |
| R18 `[B]` | Record registration and hosting facts (WHOIS, registrar, nameservers, host, CDN) and seller facts (identity, storefront age, other listings). |
| R19 `[B]` | Assemble ownership proof: original image file with EXIF, first-publication date from the catalog record, trademark registration number. |
| R20 `[B]` | Link the originating first-party harm — the support thread, the dispute, the return — to the case. |
| R21 `[B]` | Store each case as a structured file with **chain of custody**: what was captured, when, by what method, and unmodified since. Exportable for an attorney. |

### Enforcement

| ID | Requirement |
|---|---|
| R22 `[B]` | Draft a DMCA §512(c)(3)(A) notice carrying all six statutory elements. |
| R23 `[B]` | Draft marketplace IP reports per platform (Amazon Brand Registry, eBay VeRO, Etsy, Walmart, TikTok Shop IPP) — these are **not** DMCA notices and have their own forms and evidence expectations. |
| R24 `[B]` | Draft platform IP forms: Meta IP report, Google Ads trademark complaint, TikTok IPP. |
| R25 `[B]` | Route registrar and host abuse reports to the correct abuse contact derived from the R18 lookup, handling the Cloudflare-fronted-origin path separately. |
| R26 `[B]` | Draft payment-processor reports (Stripe / PayPal / Shopify Payments). |
| R27 `[B]` | Draft a cease-and-desist for attorney review, positioned as escalation — never the opening instrument. |
| R28 `[B]` | On receipt of a §512(g)(3) counter-notice, prepare a decision memo and place the 10–14 business-day restore deadline on the calendar, computed in the **rights-holder's** jurisdiction. |
| R29 `[B]` | **Block every outbound legal instrument until a named human with authority to act for the rights holder signs.** Enforced by a mechanism, never by instruction text. See §"Security posture". |
| R30 `[B]` | Produce an append-only audit log: who approved what, on what evidence, on what date. |

### Persistence

| ID | Requirement |
|---|---|
| R31 `[B]` | Verify each filing at +24h, +72h and +7d: is the material actually gone? |
| R32 `[B]` | Detect relaunch by matching image hashes, copy n-grams, seller fingerprint, registrant email or nameserver against closed cases for 90 days; open a new case linked to its parent. |
| R33 `[B]` | Maintain a repeat-offender dossier with accumulated history, which is what makes registrar and marketplace escalation work. |
| R34 `[B]` | Escalate on verification failure along a defined ladder: platform → registrar → host → payment processor → attorney → customs recordal. |

### Delivery surface

| ID | Requirement |
|---|---|
| R35 `[B]` | Weekly scorecard: what is new, resolved, awaiting signature, and stuck — plus a recovery estimate **with its assumptions shown**. |
| R36 `[B]` | Six commands: `/cease scan`, `check <url>`, `case <id>`, `enforce <id>`, `testbuy <id>`, `brief`. |
| R37 `[B]` | `/cease check <url>` triages a single user-supplied URL end to end — the spec names it the most-used command in practice, so it must work standalone without a prior sweep. |
| R38 `[B]` | `/cease testbuy <id>` walks an evidence purchase, logs the order against the case, and records the physical evidence on arrival. |
| R39 `[B]` | Ship as an installable Claude Code plugin with manifest, marketplace entry, and version parity. |

---

## Acceptance expectations

Honest against the synthetic-fixture constraint (see A20).

| ID | Expectation |
|---|---|
| A1 | Given a fixture catalog, the fingerprint produces an image hash per product, an n-gram set per description, and a price floor per SKU. |
| A2 | A hit whose seller is on the allowlist is absent from the docket — verified by a fixture containing a known-good distributor listing below price floor. (R12) |
| A3 | Given a fixture mail corpus mixing genuine counterfeit complaints with newsletters containing the words "fake"/"counterfeit", the classifier's docket contains the complaints and none of the newsletters. This fixture is drawn from the real probe result in manifest §2. (R5, F1) |
| A4 | A dispute with no matching order in the fixture order book is scored high-severity. (R6, R15) |
| A5 | Each of the six hit types in a mixed fixture set is classified correctly and routed to its matching instrument template. (R14, R23) |
| A6 | A sweep over a fixture set emitting N raw hits produces a docket materially smaller than N, with the reduction explained. (R16) |
| A7 | An evidence capture yields a screenshot with visible URL and timestamp plus archived HTML, both referenced from the case file. (R17, R21) |
| A8 | A drafted DMCA notice contains all six §512(c)(3)(A) elements, checkable element by element. (R22) |
| A9 | A marketplace IP report is structurally distinct from the DMCA notice for the same case. (R23) |
| A10 | An abuse report is addressed to the contact derived from the case's own lookup record, not a guessed address. (R25) |
| A11 | **An attempt to send any instrument without a recorded signature is blocked by the hook, and the block is demonstrable in a headless run.** (R29) |
| A12 | The audit log entry for a signed instrument names approver, case, evidence set, and date. (R30) |
| A13 | A counter-notice fixture produces a calendar entry whose date is computed in US business days regardless of the calendar's local timezone. (R28) |
| A14 | A relaunch fixture (same image hash, new domain) opens a new case linked to the closed parent. (R32) |
| A15 | `/cease check <url>` runs to a classified result with evidence on a cold session with no prior sweep. (R37) |
| A16 | The weekly brief renders the four sections and shows the assumptions behind its recovery estimate. (R35) |
| A17 | `claude plugin validate --strict` passes for plugin, marketplace, and each component path. (R39) |
| A18 | Triggering evals score above the ablation baseline on the trigger-moment prompts above, with sibling-collision prompts (notably against the co-installed `koushik` plugin) not misrouting. |
| A19 | Every scheduled task in spec §7 is created through the native scheduled-tasks surface — no scheduler code exists in the plugin. (R4, R13) |
| A21 | Replacing a fixture adapter with its live connector requires no edit to any `SKILL.md`. (Data sources) |
| A20 | **Precision is explicitly reported as unmeasured.** No README, brief, or output claims a false-positive rate until a real brand's data has run through it. |

---

## Failure and edge behavior

| ID | Behavior |
|---|---|
| F1 | Keyword mail retrieval returns high-volume noise (probed: 201 matches, top hits all newsletters). The sweep must never treat a retrieval hit as a detection; an unclassified retrieval is discarded silently, not surfaced. |
| F2 | A required connector is not connected or loses auth mid-run: the affected channel is reported as a named gap with its fix, the remaining channels complete, and the run does not fail. |
| F3 | Stripe cannot return dispute objects (unverified — manifest §2): R6 degrades to a manual dispute-export import path, announced, not silently skipped. |
| F4 | A scheduled/unattended run cannot use the browser (interactive-session-bound): evidence capture for those hits is deferred and flagged for the next interactive session, with the standing reason given once — never re-reported as a fresh failure each run. |
| F5 | Firecrawl credits are exhausted or an investigator exceeds its query budget: the sweep returns partial results labeled partial, naming which channels were cut. |
| F6 | A suspect page's content is injected with text addressed to the agent. Page content is evidence, never instruction — treated as untrusted data at every stage. |
| F7 | Ownership proof is incomplete for a case (no EXIF, no registration number): the case cannot be promoted to a DMCA draft, and says which element is missing. |
| F8 | A signature is requested and never given: the instrument stays unsent indefinitely. There is no timeout that auto-files. |
| F9 | A takedown target is ambiguous between counterfeit and unauthorized reseller: the case is held for human classification rather than guessed, because the remedies are legally different (IP vs contract). |
| F10 | Two sweeps overlap: the second detects the first is running and defers, so a case is never opened twice for the same hit. |

---

## Exclusions

Out of scope for this artifact, stated so design does not drift into them:

- **No crawler or maintained index.** Crawl breadth is genuinely narrower than a dedicated index product; recall is traded for precision and proof of damages. (Honest limit, carried from the source spec §8.)
- **No legal advice.** Drafting is not advice. Escalation past platform remedies requires a real attorney.
- **No auto-filing, ever** — the inverse of the category's "one-click DMCA" marketing, and a deliberate position on 17 U.S.C. §512(f) exposure.
- **No customs or physical seizure capability** beyond preparing a recordal the brand files itself.
- **No substitute for enrollment** in Amazon Brand Registry / Transparency / Project Zero — the plugin prepares and tracks applications only.
- **No private ad-account metrics.** CPM, CTR, branded-CPC and impression-share anomaly detection needs an ads connector that isn't connected. Only the public ad-library cross-check ships. Reinstating it is a connector decision, not a code decision.
- **No MCP server.** Every data source has a first-party connector; a second bridge would be a finding, not a feature.
- **No scheduler.** The native scheduled-tasks surface covers spec §7.
- **No multi-tenant hosted operation.** That is a durable-agent architecture under the sibling `koushik` lifecycle — see manifest §5, flip condition 2.

---

## Data sources and the fixture boundary

Because two channels run on fixtures now and connectors later, every channel
reads through **one documented source adapter** rather than calling a connector
inline. A fixture satisfies the adapter today; the connector satisfies it when
it is enabled, with no change to any skill.

| Adapter | Live source when connected | Standing in now |
|---|---|---|
| `catalog` | Shopify `search_products` / `get-product` | `fixtures/catalog.json` — products, images, SKUs, prices |
| `orders` | Shopify `list-orders` / `get-order` | `fixtures/orders.json` — includes the "no matching order" case |
| `disputes` | Stripe dispute objects (**reachability still unverified**) | `fixtures/disputes.json` — reason-code clusters |
| `mail` | Gmail `search_threads` | live — no fixture needed |
| `notify` | Slack `slack_send_message` | Gmail — live |

**A21 (new acceptance):** swapping a fixture adapter for its live connector
must require no edit to any `SKILL.md`. This is what stops the fixture decision
becoming permanent technical debt.

Fixtures are synthetic and carry no real customer data. The mail fixture reuses
the newsletter false-positive pattern observed in the real probe (manifest §2),
because that is the case most likely to break the classifier.

---

## Permissions, network and secrets

Every entry is tied to the requirement that justifies it. `/koushik-jr:design`
will be held to exactly this list by `references/security.md`.

| Capability | Scope | Justified by |
|---|---|---|
| Shopify connector | read: products, shop info, orders — **not connected; fixture-backed this build** | R1, R6, R7, R19 |
| Gmail connector | read: thread search and fetch | R5, R20 |
| Gmail connector | **write: send** | R22–R27 delivery — gated by R29, never reachable unsigned |
| Stripe connector | read: disputes — **not connected; fixture-backed this build** | R6 |
| Notion connector | read + write: case files, fingerprint, audit log | R1, R21, R30 |
| Google Calendar | write: deadline events | R28 |
| Slack connector | **not used this build** — delivery routes to Gmail instead | R29 delivery, R35 |
| Firecrawl | outbound search queries | R8, R9, R10 |
| Browser | navigate + screenshot on suspect pages | R17 |
| scheduled-tasks | create/list/run | R4, R13, R31, R32, R35 |
| Network egress | marketplace, social, registrar/WHOIS, ad-library, suspect domains | R8–R11, R17, R18 |
| Fixture files | read: `fixtures/` inside the plugin — synthetic catalog, orders, disputes | stands in for Shopify + Stripe (see "Data sources") |
| Secrets | **none stored by the plugin.** All auth lives in the host's connector layer. | — |

---

## Security posture (seed — design must make each mechanical)

| Invariant | Must be enforced by |
|---|---|
| No instrument leaves without a signature (R29) | a **hook**, not prose. This is the reason the target class is `claude-plugin` rather than a skill. |
| Page and mail content never acts as instruction (F6) | untrusted-data handling at every ingestion point |
| Allowlisted partners never surface (R12) | a suppression step that runs before docket assembly, not a prompt reminder |
| The audit log cannot be rewritten (R30) | append-only construction |

---

## Publish channel intention

Plugin marketplace via git repo + `.claude-plugin/marketplace.json`.
**Blocker to clear before ship:** the repository has no git remote
(`jr-doctor`); `gh` is authenticated, so `gh repo create` resolves it.

---

## Leverage verdict

### `hybrid` — evidence: [`docs/leverage/2026-09-17-manifest.md`](docs/leverage/2026-09-17-manifest.md) §§2, 3, 5

**Leveraged, not built:** every data source (8 connectors) and every schedule
(native scheduled-tasks). **Built:** the judgment layer — classification,
scoring, suppression, evidence chain-of-custody, instrument drafting, the
signature gate, the audit log, persistence tracking, and plugin packaging.

Two capabilities the source spec assumed do not exist as probed and must be
built or rerouted: **semantic support-mail search** (Gmail search is
keyword-only) and **page archival via Firecrawl** (this connection is
search-only — archival routes to the browser).

`build` was chosen over `leverage` because `SearchPlugins` and `ListSkills`
both returned nothing in the capability class, and because the "connector set
alone" row in manifest §3 shows the connectors deliver access without any
judgment. `claude-plugin` was chosen over `agent-skill` because R29 requires
a hook.
