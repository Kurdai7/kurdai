# Stripe integration checkpoint

The owner selected the existing King Style account `acct_1Nx98dLYuEhQ3izY` for KurdAI. The connection initially authorizes test mode only. Stripe reports `charges_enabled`, `payouts_enabled`, and `details_submitted` true with no outstanding requirements, but that response was obtained in the test context and does not prove live readiness. Live account authorization has been requested separately; do not switch mode until confirmed.

A real Stripe test Checkout Session was created on 2026-10-15 for EUR 2.00. It remains unpaid, creates no real charge, grants no app credits, and verifies only test Checkout API access. This was a direct connector test, not an end-to-end website payment. Its metadata deliberately uses `app=kurdai-integration-test` so the application's fulfillment handler cannot grant credits for it.

## Implemented

- Hosted one-time Checkout Sessions using Stripe SDK 23.0.0 and its default stable API version. No card data enters KurdAI.
- An immutable D1 order snapshots user, environment, price ID, amount, and credits. Concurrent/lost-response retries reuse a stable Stripe idempotency key, with a one-hour reconciliation window. Client-supplied prices or credit quantities are ignored.
- Required raw-body webhook signature verification, five-minute timestamp tolerance, and test/live environment checks.
- Re-fetch Checkout Session with line items, require paid status, EUR amount, exact price ID, one item, matching order metadata and mode before fulfillment. Adaptive pricing is disabled to preserve the exact EUR amount invariant.
- Atomic D1 batch grants a single paid-credit entry per order/session. Distinct event IDs, concurrent deliveries and delayed-payment success cannot double-credit. Unpaid events and expired signatures grant nothing. Disabling new Checkout creation does not disable fulfillment of existing orders.
- Paid/test credits are stored separately from existing daily display credits, and scoped by environment. The success URL does not grant credits.
- Signed-in verified users only; test Checkout is restricted to the configured owner. Checkout POST quota is shared via D1. No public sales are enabled.

Routes: GET `/api/billing/capabilities`, GET `/api/billing/balance`, GET `/api/billing/order?id=...`, POST `/api/billing/checkout`, POST `/api/billing/webhook`. All authenticated operations use the existing bearer session. Checkout accepts only `packId` and UUID `requestId`.

## Secret configuration still required

The ChatGPT Stripe connection does not place credentials in Cloudflare. Store the restricted key and webhook signing secret only in Cloudflare Worker secrets, never in chat, source control, client JavaScript or logs.

- `STRIPE_RESTRICTED_KEY`: mode-specific RAK. Checkout session write and read permissions, including retrieval with line items. Prefer a dedicated key for KurdAI.
- `STRIPE_WEBHOOK_SECRET`: secret of that environment's endpoint at `https://kurdai.net/api/billing/webhook`. Subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, and `checkout.session.expired`.
- `STRIPE_MODE`: `test` or `live`; no implicit default.
- `STRIPE_CREDIT_PACKS`: server-only JSON array of `{id,priceId,amountCents,credits}`. Existing price proposals are not approved live products. Do not reuse test Price IDs in live mode.
- `STRIPE_CHECKOUT_ENABLED`: defaults to false, committed as false.
- Live creation additionally requires `STRIPE_LIVE_APPROVED`, `STRIPE_CATALOG_APPROVED` and `PUBLIC_RELEASE_VERIFIED` all exactly true. These are release attestations, not substitutes for testing.

Use separate test/live deployments and databases for integration testing. Do not copy test balances into live balances. Do not enable automatic tax, Managed Payments, subscriptions or invoice creation as part of setup. Tax treatment and final EUR prices remain to be confirmed separately before sales.

## Required before public payments

This branch does not claim a finished commercial release. Website-to-Stripe Checkout and real webhook delivery require the runtime secrets above. A completed test Checkout and verified D1 credit entry must be tested against the deployed Worker. Paid credit reservation/debit/refund tied to actual video jobs, charge refund/dispute reconciliation, owner-approved sale prices and tax handling remain required. Real AI generation/dialect/reference/extension acceptance and durable video/job storage remain separate blockers. Keep public Checkout and generation disabled until these are complete; do not sell unusable credits.
