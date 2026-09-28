# Registrar abuse report — lookalike domain

Send to the abuse address from the domain's **own WHOIS record**, not a guessed
one. If Cloudflare or another CDN fronts the origin, use `cloudflare-abuse.md`
in parallel — the registrar and the host are different levers and both are
slower than the payment processor.

---

CEASE-Case: {{CASE_ID}}

To: {{REGISTRAR_ABUSE_EMAIL}} ({{REGISTRAR}})
Subject: Trademark abuse and consumer fraud — {{INFRINGING_DOMAIN}}

{{REGISTRAR}} is the registrar of record for **{{INFRINGING_DOMAIN}}**,
registered {{DOMAIN_CREATED}}.

**The abuse:** the domain imitates {{OWNED_DOMAIN}}, a domain operated by
{{RIGHTS_HOLDER}}, and is being used to sell goods that impersonate our brand.

**Our rights:** {{RIGHTS_HOLDER}} owns trademark {{TRADEMARK_NUMBER}} in class
{{TM_CLASS}} ({{JURISDICTION}}), and operates {{OWNED_DOMAIN}}.

**Evidence**
- Live storefront: {{INFRINGING_URL}}, captured {{CAPTURE_DATE}}
- Our product copy reproduced verbatim: "{{MATCHED_PHRASE}}"
- Goods offered at {{PRICE}} against our price floor of {{PRICE_FLOOR}}
- Evidence reference: {{EVIDENCE_REF}}
{{#CUSTOMER_HARM}}
**Consumer harm already recorded:** {{HARM_COUNT}} of our customers have
contacted us after purchasing from this domain believing it was ours.
Reference: {{HARM_REF}}.
{{/CUSTOMER_HARM}}

We request suspension of the domain under your abuse policy and your acceptable
use terms.

{{SIGNER_NAME}}, {{SIGNER_TITLE}} · {{SIGNER_EMAIL}} · {{DATE}}

---

Documented consumer harm moves registrars far more reliably than a trademark
claim alone. Lead with it whenever the case has any.
