# Fixtures — synthetic test data

**Everything here is invented.** No real customer, order, dispute or email
appears in these files. They exist because Shopify and Stripe could not be
connected for this build (see `docs/leverage/2026-09-17-manifest.md`), and they
are read through `scripts/sources.mjs` so a live connector can replace them
without editing any skill (SPEC A21).

The brand is "Lumen Goods", a fictional DTC lighting company.

| File | Stands in for | Contains the case that matters |
|---|---|---|
| `catalog.json` | Shopify products | a SKU whose price floor a counterfeit undercuts |
| `orders.json` | Shopify orders | the order book a dispute is reconciled against |
| `disputes.json` | Stripe disputes | **a dispute with NO matching order** (A4) |
| `mail.json` | Gmail threads | **newsletters that match "fake"/"counterfeit" but are not complaints** (A3, F1) |
| `listings.json` | marketplace hits | an authorized reseller below floor (A2) and a relaunch (A14) |

`disputes.json` is an explicit **guess** at Stripe's dispute schema. Stripe was
never probed for dispute reachability. When the connector is enabled it must be
checked against this shape before R6 is trusted on live data.
