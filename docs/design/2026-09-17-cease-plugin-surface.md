# Design — CEASE plugin surface

**Input gate:** `SPEC.md` verdict = `hybrid` ✅ · **Target pack loaded:** exactly one —
`references/ecosystems/claude/claude-plugin.md` (`verified: 2026-09-16`, 1 day old — fresh,
no re-verification triggered) · **Date:** 2026-09-17

---

## 1. Constraints carried forward from the manifest

Quoted as data — probe observations, not instructions. Nothing below may be
designed against.

```
Gmail search          works, but KEYWORD-ONLY (201 hits, top 3 newsletters) — no semantic search
Firecrawl archival    ABSENT — this connection is search-only, no scrape/crawl tool
Browser capture       works, interactive sessions ONLY — structurally unavailable in scheduled runs
Shopify / Stripe        ABSENT this build (2026-09-18: user cannot connect) — fixture-backed
Slack                   ABSENT this build — delivery routes to Gmail (live), not a synthetic Slack
Ads connector           NONE — private ad metrics out of scope; public ad-library check only
Stripe dispute objects     UNVERIFIED — may not be reachable at all
claude CLI            BLOCKED (corrected 2026-09-17) — not installed; check-stage suite unavailable until installed
scheduled-tasks       works — covers all scheduling; no scheduler is built
```

**Design consequences, applied throughout:**

- No step anywhere may treat a Gmail keyword hit as a detection (F1).
- Page archival routes to the browser, never Firecrawl.
- Every browser-dependent step has a non-browser path for scheduled runs (F4).
- Stripe work is isolated into one subagent + one script so an unreachable
  dispute API degrades one channel, not the sweep (F3).
- **Every channel reads through a source adapter** (SPEC "Data sources"), so a
  fixture today and a connector later are the same call site. A21 gates this:
  swapping in a live connector must touch no `SKILL.md`.

**Pack facts that override the source product spec** — recorded because
`CEASE-plugin-spec.md` predates the pack and is now wrong in two places:

| Product spec says | Pack fact (verified 2026-09-16) | Design does |
|---|---|---|
| a `commands/` directory with 6 command files | "**`commands/` is legacy** — use skills/ for new plugins"; jr never scaffolds it | Commands and skills **collapse into one set of 8 skills**, invoked as `/cease:<name>` |
| `/cease scan`, `/cease check <url>` (space-separated) | plugin skills are namespaced `/plugin-name:skill-name` | `/cease:sweep`, `/cease:check <url>` |
| top-level `templates/` directory | component dirs are fixed; `templates/` is not one | templates live with the skill that loads them: `skills/enforce/templates/` |
| plugin-root `CLAUDE.md` for always-on guidance | "plugin-root `CLAUDE.md` is NOT loaded as context" | no CLAUDE.md; all routing lives in skill descriptions |

**Version-gated keys are deliberately avoided.** `userConfig.options` and
`maxTurns` need CLI ≥ 2.1.271/2.1.246, and an unrecognized key on an older CLI
is *silently ignored* — `--strict` never surfaces it. CEASE uses plain
`string`/`boolean` userConfig and `effort` (no version gate), so the install
floor stays low and no silent-ignore failure mode exists.

---

## 2. Requirement → construct mapping

Every row cites the pack fact that makes the construct legal.

| R-ID | Construct | Pack fact relied on (verified) |
|---|---|---|
| R1, R2, R3 | skill `skills/baseline/SKILL.md` + `scripts/fingerprint.mjs`, reading the `catalog` adapter (fixture this build) | `skills/<name>/SKILL.md` at plugin root (claude-plugin.md, 2026-09-16) |
| R4, R13, R31, R32, R35 | **none built** — native `scheduled-tasks` surface | `_core.md` native-surfaces table + probe `works` (2026-09-16). Leveraged per manifest §5 |
| R5, R6, R7 | skill `sweep`, first-party pass in main context (not fanned out — the three signals must be correlated against one order book; fan-out would fragment it) | skills may run Bash/connector tools (claude-plugin.md) |
| R8 | subagent `agents/marketplace-investigator.md` | `agents/` recursive, `name`+`description` required (2026-09-16) |
| R9 | subagent `agents/social-investigator.md` | same |
| R10 | subagent `agents/domain-investigator.md` | same |
| R11 | subagent `agents/ads-investigator.md` — **public ad-library cross-check only** (narrowed 2026-09-18; no ads connector exists, so private CPM/CTR/branded-CPC metrics are out of scope per SPEC Exclusions) | same |
| R12 | **`scripts/suppress.mjs`** called by `sweep` and `check` before docket assembly | security.md rule 2 — prompt text is not enforcement; a script on the path is |
| R14, R15, R16 | `skills/sweep/references/triage.md`, loaded by `sweep` and `check` | supporting files under a skill dir (claude-plugin.md); smallest construct — triage is never a user's entry point, so it is a shared reference, not a 9th skill |
| R17, R18, R19, R20, R21 | skill `evidence` + subagent `agents/evidence-clerk.md` | same as above |
| R22–R28 | skill `enforce` + `skills/enforce/templates/*.md` (9 templates) | progressive disclosure: templates load only when the skill runs |
| **R29** | **`hooks/hooks.json` → `hooks/signature-gate.mjs`** | hooks.json shape + `PreToolUse` + `permissionDecision: "deny"` — **verified live 2026-09-17** (pack marked this UNVERIFIED; fetched per upstream.md §3, see §4) |
| R30 | `scripts/audit-append.mjs` (hash-chained, append-only) + Notion mirror | security.md rule 2 |
| R33, R34 | skill `pursue` | — |
| R35 | skill `brief` | — |
| R36, R37 | skills are the commands; `check` takes `argument-hint: [url-or-listing]` | `argument-hint` is documented plugin skill frontmatter (verified live 2026-09-17) |
| R38 | skill `testbuy` | — |
| R39 | `.claude-plugin/plugin.json` + `.claude-plugin/marketplace.json` | manifest keys + reserved-names list (2026-09-16) |

**Name check:** `cease` is not on the reserved-marketplace-names list
(claude-plugin.md, 2026-09-16). Marketplace name: `cease-marketplace` — also clear.

---

## 3. Descriptions, drafted verbatim

Triggering contract: **ambient** for all eight skills. These must reach users
who describe a problem in their own words ("someone sent me this link"), not
only users who type the command. Evals are held to that bar.

Every description carries "Not for durable Eve agents (koushik plugin)" —
both koushik and koushik-jr are co-installed in this environment.

### `.claude-plugin/plugin.json` → `description`

> Inside-out brand protection for DTC and e-commerce brands: finds counterfeit and impersonation evidence in your own store, support inbox and payment disputes, traces it to the source across marketplaces, lookalike domains, social handles and the public ad libraries, assembles a chain-of-custody case file, and drafts the right enforcement instrument for a human to sign. Never files anything automatically.

*Corrected 2026-09-18 during build: the draft said "payment disputes and ad account", which survived the R11 narrowing and would have advertised private ad-account metrics the plugin no longer reads. Routed back here rather than diverged from at build time.*

### `skills/baseline/SKILL.md`

```yaml
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
```

### `skills/sweep/SKILL.md`

```yaml
name: sweep
argument-hint: "[channel or blank for all]"
description: >-
  Runs a full counterfeit and impersonation detection pass across every
  connected channel: support-inbox distress mail, payment disputes with no
  matching order, returns of non-SKU items, marketplace listings below your
  price floor, lookalike domains, handle-variant social accounts, and your own
  ad creative found running under another advertiser in the public ad
  libraries. Classifies each
  hit into one of six enforcement types, scores severity, suppresses authorized
  resellers, and returns a ranked docket rather than an alert dump. Use when
  you say "run a scan", "who's copying us", "check for fakes", "is someone
  running our ads?", or "we're getting chargebacks for orders that don't
  exist". Not for one specific URL (cease:check), not for drafting takedowns
  (cease:enforce). Not for stock or inventory reports (redpill). Not for
  durable Eve agents (koushik plugin).
```

### `skills/check/SKILL.md`

```yaml
name: check
argument-hint: "[url, listing, handle or ad]"
description: >-
  Triages one suspect link, listing, storefront, ad or social handle end to
  end: compares it against your brand fingerprint, decides whether it is
  counterfeit goods, an unauthorized reseller, stolen content, a lookalike
  domain, stolen ad creative or an impersonation account, captures evidence,
  and scores what it is costing you. Works cold, with no prior sweep. Use when
  someone forwards you something and you ask "is this a real store or a
  knockoff?", "someone sent me this link", "is this listing ours?", or "are our
  photos on this page?". Not for sweeping all channels (cease:sweep), not for
  filing anything (cease:enforce). Not for durable Eve agents (koushik plugin).
```

### `skills/evidence/SKILL.md`

```yaml
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
```

### `skills/enforce/SKILL.md`

```yaml
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
```

### `skills/testbuy/SKILL.md`

```yaml
name: testbuy
argument-hint: "[case-id]"
description: >-
  Walks an evidence purchase from a suspect listing: records what to order,
  logs the order against the case, and files the physical evidence and
  packaging photos when it arrives. Prepares the purchase for you to complete
  yourself — never buys anything on your behalf. Use when you say "order one to
  prove it's fake", "do a test buy", or "we need a physical sample for the
  marketplace appeal". Not for ordinary shopping, reordering stock, or any
  purchase unrelated to an open case. Not for durable Eve agents (koushik
  plugin).
```

### `skills/pursue/SKILL.md`

```yaml
name: pursue
description: >-
  Follows takedowns through instead of assuming they worked: re-checks each
  filing at 24 hours, 72 hours and 7 days, detects relaunches under new domains
  by matching image hashes, copy phrases, seller fingerprints and registrant
  details against closed cases, builds the repeat-offender history that makes
  registrar and marketplace escalation stick, and escalates when a filing
  fails. Use when you say "did that actually come down?", "they're back under a
  new domain", "this is the third time this seller", or "what's stuck?". Not
  for the first detection (cease:sweep) or the first filing (cease:enforce).
  Not for durable Eve agents (koushik plugin).
```

### `skills/brief/SKILL.md`

```yaml
name: brief
description: >-
  Produces the brand-protection scorecard: what is new, what is resolved, what
  needs your signature this week, what is stuck and why, and the running
  recovery estimate with its assumptions shown. Use when you say "weekly
  update", "where are we on takedowns", "brand protection summary", or when a
  Monday schedule fires. Not for running detection (cease:sweep). Not for
  durable Eve agents (koushik plugin).
```

### Subagents (`agents/*.md`)

`mcpServers` and `hooks` frontmatter are **IGNORED for plugin subagents**
(pack, 2026-09-16) — investigators therefore inherit session connectors and are
scoped by `tools` allowlists instead. No investigator gets a write tool.

| File | `name` | `tools` (read-only) | `effort` | Description gist |
|---|---|---|---|---|
| `marketplace-investigator.md` | marketplace-investigator | Firecrawl search, WebFetch, Read | medium | Searches Amazon/eBay/Etsy/AliExpress/Walmart/TikTok Shop for copy n-grams and SKU strings; flags below-floor listings from non-allowlisted sellers (R8) |
| `social-investigator.md` | social-investigator | Firecrawl search, WebFetch, Read | medium | Generates handle permutations and searches for impersonation accounts and reposted product photography (R9) |
| `domain-investigator.md` | domain-investigator | Bash (dns/whois), Firecrawl search, WebFetch, Read | medium | Typo and homoglyph permutation → resolution → registrar/host/CDN facts → content compare (R10) |
| `ads-investigator.md` | ads-investigator | Firecrawl search, WebFetch, Read | low | **Public ad-library cross-check only** — finds the brand's own creative running under another advertiser (R11). No private ad-account metrics: no ads connector exists (narrowed 2026-09-18) |
| `evidence-clerk.md` | evidence-clerk | browser capture, Read, Write (case dir only) | high | Assembles the chain-of-custody record (R17–R21) |

---

## 4. Security posture

Per `references/security.md`. Every row names the **file:symbol** that enforces
it, so check can verify reachability from the entrypoint.

| Invariant | R-ID | Enforced by (file:symbol) | Mechanism |
|---|---|---|---|
| No enforcement instrument leaves without a human signature | R29 | `hooks/signature-gate.mjs:decide()` | `PreToolUse` hook returning `permissionDecision: "deny"` |
| The thing sent is the thing that was signed | R29 | `hooks/signature-gate.mjs:verifyBodyHash()` | sha256 of outbound body compared to the signed hash |
| Authorized resellers never reach the docket | R12 | `scripts/suppress.mjs:filterAllowlisted()` | runs on the path before docket assembly |
| The audit log cannot be rewritten | R30 | `scripts/audit-append.mjs:appendEntry()` | append-only with a prior-entry hash chain; `verifyChain()` on read |
| Fetched pages and mail never steer actions | F6 | each `agents/*.md` (no write tools) + `skills/*/SKILL.md` quoting rule | capability absence, not instruction |
| No purchase is ever executed by the agent | R38 | `skills/testbuy/SKILL.md` + absence of any payment tool | tool absence |

### The signature gate, in detail

This is the control the whole target class exists for, so it is specified here
rather than left to build.

**Verified live 2026-09-17** (pack listed hooks.json as UNVERIFIED;
`code.claude.com/docs/en/hooks.md` + `plugins-reference.md` fetched per
`upstream.md` §3):

- plugin hooks file is `hooks/hooks.json`, top level `{"hooks": {...}}`
- `PreToolUse` fires before a tool call; exit 0 + stdout JSON
  `{"hookSpecificOutput": {"hookEventName": "PreToolUse",
  "permissionDecision": "deny", "permissionDecisionReason": "..."}}` blocks it;
  omitting the decision falls through to normal permission flow
- matchers accept JavaScript regex; MCP tools are named `mcp__<server>__<tool>`
- hook stdin carries `tool_name`, `tool_input`, `session_id`, `cwd`

**Matcher must wildcard the server segment.** Connector server ids here are
per-user UUIDs (`mcp__5b8979f9-…__send_message`), so a literal matcher would
break on every other install:

```json
{ "matcher": "mcp__.*__(send_message|reply|forward|create_draft|slack_send_message)" }
```

**Three-way decision in `decide()` — the over-blocking problem is the hard part.**
A brand-protection plugin must never block the user's ordinary email:

1. Body carries the CEASE case sentinel → look up
   `${CLAUDE_PLUGIN_DATA}/signatures/<case-id>.json`; **deny** unless a signature
   exists AND `verifyBodyHash()` matches. Fails **closed**: unreadable or absent
   ledger = deny.
2. No sentinel, but the body matches **two or more** legal-instrument phrases
   ("under penalty of perjury", "good faith belief", "17 U.S.C.", "cease and
   desist", "VeRO", "infringing material") → **deny**, with a reason naming
   `/cease:enforce` as the route. Catches the instrument even if the model
   deviates and omits the sentinel — the gate does not depend on the model
   behaving.
3. Otherwise → exit 0 with no decision. Ordinary mail is untouched.

**What lives in `${CLAUDE_PLUGIN_DATA}/signatures/`:** case id, approver name,
ISO timestamp, instrument type, sha256 of the instrument text. **No customer
PII, no message bodies, no credentials** — security.md rule 11 forbids parking
private user content there. Case files and the canonical audit log live in the
user's own Notion.

**Honest ceiling, stated rather than overclaimed.** An in-session typed
confirmation is the strongest signature this surface supports. It is a human
act with an audit trail; it is not a cryptographic signature. DocuSign (spec
§5, not connected) is the named upgrade path. No README may call it more than
it is.

**F8 holds by construction:** there is no timeout path in `decide()` that
converts absence of a signature into permission.

### Permissions — every one traced to an R-ID

Exactly `SPEC.md`'s permission table, unchanged. Nothing was added at design.
One capability was *removed* as unjustified: no investigator gets a write tool,
and `ads-investigator` drops `WebFetch`-to-write entirely.

**Secrets:** none in the artifact. All auth is the host's connector layer.
`userConfig` holds non-secret brand settings only (brand name, owned domains,
Notion case-database URL, authorized signer names). No `sensitive: true` field
is needed, because CEASE stores no credential of its own.

**Identity (security.md rule 8):** the signer name in `userConfig` is a
*display and validation* value, never authentication. The signature event must
be a live in-session human confirmation; a name in config can never satisfy R29
on its own.

---

## 5. Triggering plan

Eval cases for `/koushik-jr:check`, per `description-quality.md`: 2+ positive
(user vocabulary, not the description's own words), 2+ negative, 1 collision
per sibling family. `--ablation with-without` supplies the did-it-fire signal.

| Skill | Positive prompts | Negative prompts (must NOT fire) |
|---|---|---|
| `baseline` | "set up brand protection for our store" · "we just added a new distributor, update the safe list" | "run a scan for fakes" (→ sweep) · "analyze this stock file" (→ redpill) |
| `sweep` | "who's ripping off our products?" · "is someone running our ads on their own page?" | "is this link legit?" (→ check) · "which stores need stock?" (→ redpill) |
| `check` | "a customer sent me this link, is it a real store?" · "are our product photos on this page?" | "find everything copying us" (→ sweep) · "file the takedown" (→ enforce) |
| `evidence` | "my lawyer wants everything we have on this seller" · "screenshot this before it disappears" | "draft the DMCA" (→ enforce) · "did it come down?" (→ pursue) |
| `enforce` | "get this listing off Amazon" · "we got a counter-notice, what now?" | "document this case" (→ evidence) · "should I sue them?" (→ refuse: not legal advice) |
| `testbuy` | "order one so we can prove it's fake" · "we need a physical sample for the appeal" | "reorder our bestseller" (→ nothing) · "buy me a laptop stand" (→ nothing) |
| `pursue` | "they're back under a new domain" · "did that takedown actually work?" | "find new infringements" (→ sweep) |
| `brief` | "weekly brand protection update" · "where are we on takedowns?" | "run a full scan" (→ sweep) |

**Collision cases (both directions — a one-sided boundary is half a boundary):**

| Prompt | Must route to | Must NOT |
|---|---|---|
| "build a durable agent that watches for counterfeits" | koushik | any cease skill |
| "define the spec for a new plugin" | koushik-jr | cease |
| "which SKUs need replenishment across stores" | redpill | cease:sweep |
| "who's copying our products" | cease:sweep | koushik, redpill |
| "draft the DMCA as a Word document" | cease:enforce (docx only for rendering) | docx alone |

**Intra-plugin collision is the live risk.** Eight siblings share one domain
vocabulary. Mitigation per `description-quality.md`: every description
out-specifies rather than only disowning — each leads with its own distinct
artifact (fingerprint · docket · one link · case file · instrument · purchase ·
re-check · scorecard). Check must run sweep-vs-check and evidence-vs-enforce
head to head; those two pairs are the most likely to flip.

---

## 6. File plan and build order

Plugin root = repo root (`artifact_paths.root: .`). Scaffold recipe:
`claude plugin init --with skills,agents,hooks` — **unavailable until the CLI
is installed**; build falls back to writing the tree by hand against the pack's
documented shapes, which are fully specified above.

| # | Unit | Files | Validation step |
|---|---|---|---|
| 1 | Manifest + marketplace | `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `.gitignore` | `claude plugin validate . --strict` (all four target paths) |
| 2 | **Signature gate** | `hooks/hooks.json`, `hooks/signature-gate.mjs` | unit tests for all three `decide()` branches + fail-closed; **probe that `tool_input` is populated for a connector tool** (see risk) |
| 3 | Audit log | `scripts/audit-append.mjs` | chain-verify test; tamper test must fail |
| 4 | Allowlist suppression | `scripts/suppress.mjs` | A2 fixture: allowlisted below-floor listing absent from output |
| 4b | **Source adapters + fixtures** | `scripts/sources.mjs`, `fixtures/{catalog,orders,disputes}.json` | A21 — adapter swap touches no SKILL.md; mail fixture carries the newsletter false-positive case |
| 5 | Fingerprint | `skills/baseline/SKILL.md`, `scripts/fingerprint.mjs` | A1 on fixture catalog |
| 6 | Triage reference | `skills/sweep/references/triage.md` | A5 six-type fixture |
| 7 | Sweep + first-party | `skills/sweep/SKILL.md` | A3 (newsletter fixture from the real probe), A4, A6 |
| 8 | Check | `skills/check/SKILL.md` | A15 cold-session run |
| 9 | Investigators | `agents/{marketplace,social,domain,ads}-investigator.md` | each loads; no write tool present; ads agent claims only the public-library check |
| 10 | Evidence + clerk | `skills/evidence/SKILL.md`, `agents/evidence-clerk.md` | A7 |
| 11 | Instruments | `skills/enforce/SKILL.md`, `skills/enforce/templates/*.md` ×9 | A8 element-by-element, A9, A10 |
| 12 | Counter-notice | template + calendar path | A13 (US business days, not calendar TZ) |
| 13 | Testbuy | `skills/testbuy/SKILL.md` | no payment tool reachable |
| 14 | Pursue | `skills/pursue/SKILL.md` | A14 relaunch fixture |
| 15 | Brief | `skills/brief/SKILL.md` | A16 |
| 16 | Schedules | setup steps in `baseline` calling native scheduled-tasks | A19 — no scheduler code exists |
| 17 | Evals | `evals/**/case.yaml` per §5 | A18 with `--ablation with-without` |
| 18 | Docs | `README.md` | A20 — no precision claim anywhere |

**Deferral flagged now, not discovered later:** unit 5's perceptual hashing
needs image decoding. Node deps install with `--ignore-scripts` under a 60s cap
(pack), so a native dep like `sharp` may fail to build and the plugin would load
without it. Build must prefer a pure-JS decoder+DCT, and if that proves
impractical, ship unit 5 with n-gram and price-floor matching only and record
pHash as deferred — image matching is not load-bearing for any acceptance
expectation except A14's relaunch fixture, which can match on copy n-grams
meanwhile.

---

## 7. Open assumptions

**Riskiest:** that a `PreToolUse` hook receives a populated `tool_input` for
**connector (MCP) tool calls**. The live docs show `tool_input` for `Bash`;
population for connector tools is not documented and was not probed. If it is
empty, `verifyBodyHash()` cannot work and the gate degrades to sentinel-plus-
phrase detection with a blanket deny — safe, but noisier. **Unit 2 probes this
before anything is built on top of it.** This is the first thing `/koushik-jr:build`
should settle.

Second: Stripe dispute reachability is now **deferred, not pending**. With Stripe
unconnected, `fixtures/disputes.json` defines the shape R6 expects — and that
fixture is a *guess* at Stripe's schema, labelled as one. Whenever the connector
is enabled it must be probed against that shape before R6 is trusted.
Third: the in-session confirmation ceiling on what "signature" can mean here.
