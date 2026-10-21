# FIB integration preparation — 21 October 2026

Status: prepared boundary only, **not connected**. No bank request, new account,
merchant application or payment is created. Existing Stripe packages remain
EUR1/30 credits and EUR5/280 credits. IQD prices require separate owner approval;
do not invent a conversion or silently change those packages.

Official references:
- https://fib.iq/integrations/web-payments/
- https://request-business.fib.iq/

FIB documents OAuth client credentials, create-payment and check-status endpoints,
IQD-only payments, payment codes/QR/app links, and a callback containing id/status.
Sandbox credentials and merchant production approval must be obtained from FIB.
A personal account alone is not evidence of merchant integration approval.

## Prepared application boundary

GET /api/fib/capabilities returns disabled preparation status. All other /api/fib/
requests return 503 without bank calls or database writes. Environment flags alone
cannot activate it. No visible payment button or design changes were added.

## Implementation after bank approval and secure credential installation

1. Separate sandbox/live client credentials in Worker secrets, never source/chat.
   Pin the bank-approved environment's HTTPS origin; no client-supplied URLs.
2. Snapshot approved IQD amount, credits, user, environment and unique request ID
   in a separate FIB order table; bank payment ID must be unique. Do not reuse a
   Stripe order or put sandbox credits into live/customer balances.
3. Create only one payment for an order. The public documentation does not establish
   provider idempotency: if create outcome is uncertain, hold for reconciliation;
   do not blindly retry and create another payable payment.
4. Treat callback id/status as a notification only. Fetch the saved payment's
   status over authenticated bank API; require PAID, exact expected IQD amount,
   currency and bank payment ID. Reject unknown orders and mismatches. Confirm
   current response fields and any callback authentication with the bank first.
5. Grant credits using an atomic D1 batch and a unique FIB environment/payment
   ledger ID, with a unique order fulfillment. Replayed callbacks and concurrent
   polling must grant once. Cancelled, unpaid and unknown payments grant nothing.
6. Return QR/code and bank-approved app links only; validate their documented
   destinations. Never collect FIB passwords, national IDs or OTPs in KurdAI.
7. Verify real sandbox creation, mobile completion, authenticated status,
   webhook delivery, one correct ledger credit, duplicate delivery, pending/failed
   cases and interrupted responses. Local mocks do not count as this evidence.
8. Reconcile refund/reversal handling and commercial release requirements before
   final owner approval for live payments. Keep video readiness independent.

The account's activation and merchant eligibility are bank-side matters; this
code does not establish remote account reactivation or eligibility.
