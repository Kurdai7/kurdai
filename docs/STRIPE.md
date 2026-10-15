# Stripe integration checkpoint

The owner selected the existing King Style account `acct_1Nx98dLYuEhQ3izY` for KurdAI. Both test and live access were confirmed through the Stripe connector on 2026-10-15. At 18:37 UTC the live account reported `charges_enabled=true`, `payouts_enabled=true`, no currently due or past due account requirements, and the owner's updated bank account was present. These flags do not verify a bank payout, a successful website payment, or website-to-Stripe integration. No full bank details or credentials are recorded here.

A real Stripe test Checkout Session was created on 2026-10-15 for EUR 2.00. It remains unpaid, creates no real charge, grants no app credits, and verifies only test Checkout API access. This was a direct connector test, not an end-to-end website payment. Its metadata deliberately uses `app=kurdai-integration-test` so the application's fulfillment handler cannot grant credits for it.

## Implemented

- Hosted one-time Checkout Sessions using Stripe SDK 23.0.0 and its default stable API version. No card data enters KurdAI.
- An immutable D1 order snapshots user, environment, price ID, amount, and credits. Concurrent/lost-response retries reuse a stable Stripe idempotency key, with a one-hour reconciliation window. Client-supplied prices or credit quantities are ignored.
- Required raw-body webhook signature verification before any database access, five-minute timestamp tolerance, and test/live environment checks. Unsigned public requests cannot trigger billing schema writes.
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

## Production evidence, 2026-10-15

- Main remains `9cd2116cfca709c5289d49c55d4a72985fd42692`. Cloudflare Workers Builds reports success at 14:27:32 UTC; Render deploy `dep-db8e56uk1f9s73eg3k2g` is live on that commit.
- Actual HTTPS GET `/api/health` returns 200 with database, assets and registration configured. This is configuration evidence, not a new successful signup/login. The owner's earlier screenshots show a successful site login and delivered verification emails.
- Actual HTTPS GET `/api/video-capabilities` returns 200, but public generation and provider verification are false, spending disabled with zero per-job/day allowance. Sorani and Badini native-video verification are false.
- Actual HTTPS GET `/api/billing/capabilities` returns 404: this draft branch is not deployed to production. Live catalog and webhook endpoint lists were empty at the last check. No Worker Stripe credentials have been installed by this work.
- Local registration/verify/login/logout tests use real Worker and D1 with mocked email transport. Video assembly tests use synthetic media; neither establishes real AI quality or provider access.
- The focused billing rerun passes seven tests, including the actual Worker/D1/SDK harness (mocked Stripe transport) and the unsigned-webhook database isolation check. A real paid Checkout, webhook credit delivery, real AI output, Sorani/Badini quality, image references, extension continuity and a real AI 70-second MP4 remain unverified.
