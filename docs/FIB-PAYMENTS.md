# KurdAI — FIB payment gateway

Status: preparation only. The public UI contains a disabled “Pay with FIB · IQD” option. No bank request is sent and no credits are issued.

## Official FIB flow

Official documentation: https://fib.iq/integrations/web-payments/

1. Apply through FIB's Integration Request Form linked from the official documentation and request Sandbox credentials.
2. Use OAuth2 Client Credentials to obtain a short-lived bearer token.
3. Create an IQD payment through the FIB payments endpoint. Present the returned QR code and payment code to the customer.
4. Treat callbacks only as a notification to re-check status. Confirm payment by querying FIB's authenticated payment-status endpoint and verify the payment ID, exact IQD amount, currency, order, and final `PAID` state.
5. Credit the user's account exactly once using a unique payment/order constraint and an atomic ledger write.
6. Complete sandbox end-to-end verification, then request Production credentials from FIB and switch to the production base URL only after approval.

FIB documents the Sandbox base URL as `https://fib.stage.fib.iq` and Production as `https://fib.prod.fib.iq`. Its currently documented online payment currency is IQD.

## Required production safeguards

- Keep `client_secret` and access tokens in server-side secrets only; never expose them to browser JavaScript or logs.
- Do not trust a browser redirect or callback body as proof of payment.
- Do not issue credits on payment creation, QR display, or an unverified callback.
- Enforce idempotency for order creation and credit fulfillment.
- Bind each payment to the signed-in user and a server-side approved credit pack.
- Reject amount/currency/order mismatches and expired, declined, or unpaid payments.
- Keep FIB payment records separate from Stripe EUR orders and test-mode credit balances.
- Do not enable the payment button until Sandbox verification and Production credentials are complete.

## Still required from the merchant / bank

- FIB Sandbox merchant approval and credentials (`client_id`, `client_secret`).
- FIB-approved Production merchant credentials.
- Merchant-approved IQD credit-pack prices and credit quantities.
- Confirmed merchant settlement account and applicable gateway fees.
- Sandbox end-to-end verification and Production launch approval.

Never paste FIB secrets into chat or commit them to Git. Add them only as encrypted Cloudflare Worker secrets after the backend integration is implemented and reviewed.
