# Stripe integration checkpoint

This document records implementation and application verification only. Account identifiers, banking details and account-verification results must not be published in this repository.

A real Stripe test Checkout Session was created on 2026-10-15 for EUR 2.00. It remains unpaid, creates no real charge, grants no app credits, and verifies only test Checkout API access. This was a direct connector test, not an end-to-end website payment. Its metadata deliberately uses `app=kurdai-integration-test` so the application's fulfillment handler cannot grant credits for it.

## Implemented

- Gated account billing panel shows purchased credits separately from daily credits, uses server-approved packs and hosted Stripe Checkout, retains the same request ID across retries, rejects off-domain redirects and discards responses from a previous login. It stays hidden when runtime billing is not configured; return-page parameters never grant credits or automatically start payment.

- Hosted one-time Checkout Sessions using Stripe SDK 23.0.0 and its default stable API version. No card data enters KurdAI.
- An immutable D1 order snapshots user, environment, price ID, amount, and credits. Concurrent/lost-response retries reuse a stable Stripe idempotency key, with a one-hour reconciliation window. Client-supplied prices or credit quantities are ignored.
- Required raw-body webhook signature verification before any database access, five-minute timestamp tolerance, and test/live environment checks. Unsigned public requests cannot trigger billing schema writes.
- Re-fetch Checkout Session with line items, require paid status, EUR amount, exact price ID, one item, matching order metadata and mode before fulfillment. Adaptive pricing is disabled to preserve the exact EUR amount invariant.
- Atomic D1 batch grants a single paid-credit entry per order/session. Distinct event IDs, concurrent deliveries and delayed-payment success cannot double-credit. Unpaid events and expired signatures grant nothing. Disabling new Checkout creation does not disable fulfillment of existing orders.
- Paid/test credits are stored separately from existing daily display credits, and scoped by environment. The success URL does not grant credits.
- Signed-in verified users only; test Checkout is restricted to the configured owner. Checkout POST quota is shared via D1. No public sales are enabled.

Routes: GET `/api/billing/capabilities`, GET `/api/billing/balance`, GET `/api/billing/order?id=...`, POST `/api/billing/checkout`, POST `/api/billing/webhook`. All authenticated operations use the existing bearer session. Checkout accepts only `packId` and UUID `requestId`.

## Runtime configuration

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
- Actual HTTPS GET `/api/billing/capabilities` returns 404: this draft branch is not deployed to production. The owner reports adding the runtime restricted key in Cloudflare; this agent has not independently verified that secret binding.
- Local registration/verify/login/logout tests use real Worker and D1 with mocked email transport. Video assembly tests use synthetic media; neither establishes real AI quality or provider access.
- The focused billing rerun passes seven tests, including the actual Worker/D1/SDK harness (mocked Stripe transport) and the unsigned-webhook database isolation check. A real paid Checkout, webhook credit delivery, real AI output, Sorani/Badini quality, image references, extension continuity and a real AI 70-second MP4 remain unverified.

The next focused rerun passes 13 checks across billing backend, Worker/D1 harness, billing UI and existing public UI. Four new DOM tests verify hidden unconfigured checkout, forged return URLs, duplicate-click/lost-response retry identity and logout races. These use mocked HTTP and do not establish actual hosted Checkout payment or webhook delivery.

## Webhook preparation, 2026-10-15 20:05 UTC

Created live endpoint for this application at `https://kurdai.net/api/billing/webhook`, API version `2026-09-30.endive`, with exactly the four Checkout events listed above. Stripe returned success. The endpoint is deliberately disabled until the handler is deployed and the signing secret installed; it is not evidence of successful delivery. No secret value is recorded here.

At this checkpoint, actual public HTTPS checks returned health 200, billing capabilities 404 and video capabilities 200 with generation/spending disabled and provider verification false. PR #4 remains draft and unmerged at the time of verification; Render remains live on main `9cd2116cfca709c5289d49c55d4a72985fd42692`. No paid API request or live charge was made.

The owner reports completing the protected signing-secret handoff; do not repeat it. The connected Stripe admin API cannot verify Cloudflare secret bindings, and this workspace has no authenticated Cloudflare configuration access. Do not publish or paste signing secrets into chat or git. Enable this endpoint only after the application handler is deployed and can validate its signature.

## Owner configuration and concurrency follow-up

The owner reports saving `STRIPE_RESTRICTED_KEY`, `STRIPE_WEBHOOK_SECRET`, and `STRIPE_MODE=live` in Cloudflare on 2026-10-15. Do not repeat those completed UI steps. These remain owner-reported until the billing handler is deployed and its safe capabilities endpoint can be checked. The subsequent public billing capabilities request still returned 404; health returned 200.

## Release verification update, 2026-10-15

All 65 repository tests pass, including Worker/D1 authentication, signed billing fulfillment, concurrent webhook delivery, UI account isolation, request spending limits and synthetic video assembly. Syntax checks, Worker dry-run build and diff checks pass. Provider transports remain mocked or synthetic; these results do not verify a real AI output or payment delivery.

GitHub reports this pull request mergeable with no conflicts. Cloudflare's build bot reports a successful preview deployment of commit `449b749bc355f08b6f9903a43a91c33faf91388c`. This verifies the GitHub deployment path, not authenticated Dashboard access or production payment readiness. Release remains blocked by the commercial and real-provider acceptance requirements above.

A Python HTTP client received 403/1010 while curl received 200 from the same production health route. Treat this as client-dependent edge filtering; do not infer an application-wide outage or disable security globally. Cloudflare configuration access is required to inspect the applicable security event before changing a rule.

## EUR reservation controls

The processor supports optional positive-decimal `PROCESSOR_MAX_MONTH_EUR` and `PROCESSOR_MAX_TOTAL_EUR` limits. Before approving any job, it sums persisted approved EUR estimates, including failed and uncertain jobs. It reserves the complete approved total before submission, under the existing serial execution lock. Months follow Europe/Helsinki. The total allowance never resets automatically. Missing historical amounts are treated as unknown exposure and block spending when the relevant limit is configured.

The owner's approved values have been staged in Render without enabling paid generation. Render triggered a redeploy of existing main; the new enforcement code remains in this draft branch until released. Three new reservation tests and the three existing spending tests pass; 12 affected long-video/provider tests and syntax/build/diff checks also pass. Provider calls remain synthetic or mocked.

These are processor-local estimated reservations, not provider invoice caps, not a shared allowance with the native Worker video backend, and not enforcement against use of the same key elsewhere. Durable job storage is required to preserve them across host deploys. Google documents possible overspend during billing latency even with project spend caps or prepayment. Render bandwidth can incur usage charges beyond compute and disk fees. Do not enable paid requests or upgrade hosting under a strict invoice ceiling until those limitations are resolved or explicitly accepted by the owner.

The Worker/D1/Stripe SDK harness now also passes pending-payment delivery followed by eight concurrent signed events with distinct event IDs for the same paid Checkout session: actual D1 contains exactly one fulfillment and one credit ledger entry. Provider HTTP remains mocked; this does not claim a live payment or hosted webhook test. Committed in `6afd4b73492e8224785f652640a31a9c429edb55`.

## Preview setup checkpoint, 2026-10-16

The owner confirmed a separate preview D1 binding `DB` to `kurdai-test-db`, preview-only `STRIPE_MODE=test`, a restricted test key, and the test webhook signing secret. Secret values are intentionally absent here. The test webhook destination subscribes to the four Checkout events above at `https://codex-stripe-checkout-kurdai.kurdai.workers.dev/api/billing/webhook`.

The existing branch preview still returned `mode:null`, `configured:false` and `enabled:false` after these settings were saved. Rebuild the preview to pick up its base configuration, then inspect the safe capabilities route again. Configuration entered in the Dashboard is not runtime verification. Production remains unchanged, and public payments and paid generation remain disabled.
