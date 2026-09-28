# Payment processor report

Often the fastest kill in the whole ladder, and the most underused: a
counterfeit storefront that cannot take money is dead regardless of whether the
domain survives. Try this early, not last.

---

CEASE-Case: {{CASE_ID}}

To: {{PROCESSOR}} ({{PROCESSOR_ABUSE_CONTACT}})
Subject: Merchant selling counterfeit goods — {{INFRINGING_DOMAIN}}

**Merchant:** {{SELLER_NAME}} operating {{INFRINGING_DOMAIN}}
**Payment methods observed at checkout:** {{PAYMENT_METHODS}}
{{#MERCHANT_ID}}**Merchant identifier from test purchase:** {{MERCHANT_ID}}{{/MERCHANT_ID}}

**The violation:** this merchant sells goods impersonating {{RIGHTS_HOLDER}}
({{TRADEMARK_NUMBER}}), using our product photography and copy, at prices below
any legitimate wholesale level ({{PRICE}} against a floor of {{PRICE_FLOOR}}).
This breaches your prohibited-business terms on counterfeit and IP-infringing
goods.

**Documented consumer harm**
{{HARM_COUNT}} of our customers have reported buying from this merchant in the
belief it was us. {{#DISPUTES}}{{DISPUTE_COUNT}} of these resulted in payment
disputes against our own account under reason code
"{{DISPUTE_REASON_CODE}}".{{/DISPUTES}}
Reference: {{HARM_REF}}.

{{#TEST_BUY}}**Verified purchase:** order {{TEST_BUY_ORDER}} placed
{{TEST_BUY_DATE}}, goods received {{TEST_BUY_RECEIVED}}, confirmed counterfeit.
Payment settled to the merchant above.{{/TEST_BUY}}

We request review of this merchant under your acceptable use policy.

{{SIGNER_NAME}}, {{SIGNER_TITLE}} · {{SIGNER_EMAIL}} · {{DATE}}

---

A completed test buy makes this report dramatically stronger: it proves the
merchant took money for counterfeit goods and names the settlement path.
