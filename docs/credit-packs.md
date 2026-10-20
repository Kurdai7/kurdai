# KurdAI prepared one-time credit packs

Version: 2026-10-21-v2. Catalogue created in the existing Stripe test environment only.
No live checkout activation, subscriptions, real charges or video generation are authorized by this change.

| Pack | Customer price (EUR) | Credits | Maximum quoted service cost |
| --- | ---: | ---: | ---: |
| starter_eur1 | 1.00 | 30 | 0.30 EUR |
| value_eur5 | 5.00 | 280 | 2.80 EUR |

Charge ceil(verified total service cost in EUR * 100) credits per video. Credits are usage units, not cash.
The larger pack has better value because Stripe's fixed transaction fee is spread across more usage.
These credit amounts are deliberately below the amount paid, rather than issuing one EUR of video costs per EUR collected.

## Planning economics

Official source reviewed: https://stripe.com/en-fi/pricing
Published standard EEA card processing: 1.5% + EUR0.25; premium EEA 2.8%; UK 2.5%;
international 3.15%; currency conversion may add 2%. These are published rates, not verification
of this account's negotiated fees or enabled payment methods.

The model reserves 6% + EUR0.30 per transaction, 35% tax-inclusive sales-tax allowance,
and 5% of gross revenue for operations/risk. These are conservative planning inputs,
NOT the owner's tax registration, a charged VAT rate or verified actual provider costs.
EUR1 leaves EUR0.030740 and EUR5 leaves EUR0.053703 beyond those reserves and maximum service usage.

Positive modeled contribution is not an unconditional no-loss guarantee. Refunds, disputes,
provider overruns/partial failures, taxes or fees beyond the reserves, and fixed hosting costs can
still create losses. Processor quotes must include media, FX and provider-tax costs before usage starts.
Fixed monthly hosting/storage must be evaluated against aggregate sales; these packs alone do not
guarantee recovery of the existing monthly budget.

## Activation boundary

Production mode and existing controls are preserved. No test price ID is a live price ID.
Test-mode defaults load these two test prices without changing the existing production mode.
Production catalogue defaults to empty and live checkout additionally requires:
STRIPE_LIVE_APPROVED=true, PUBLIC_RELEASE_VERIFIED=true, STRIPE_CATALOG_APPROVED=true,
STRIPE_PACK_ECONOMICS_VERIFIED=true, STRIPE_CHECKOUT_ENABLED=true,
VIDEO_CREDITS_PER_EUR=100 and two reviewed LIVE price IDs with the exact pack amounts/credits.
Do not set these flags or create a real payment before the owner's separate live approval.
A flag is an operator attestation, not an automated tax or negotiated-fee verification.

Before that approval, confirm actual merchant fees/payment methods and VAT obligations.
No tax registration was inferred from personal ownership. automatic_tax remains off until an
active registration and correct collection treatment are confirmed. Inclusive price behavior
only states that any applicable tax comes from the advertised EUR1/EUR5, not an extra surcharge.

## Verification

Existing atomic ledger/reservation semantics are retained: signed paid webhook deposits once,
reserve credits before provider work, capture on completion, hold uncertain outcomes, and never
grant credits from a success URL. Added integration tests exercise both exact new packs through
Checkout mocks, signed webhook verification, SQLite balances, reservation replay and capture replay.
This is not a real Stripe payment/browser webhook-delivery test.

The processor image verifies syntax, the complete Node test suite and a Worker dry-run in an
isolated build stage before the runtime image is produced. Test dependencies are not copied
to the runtime image. No credentials are supplied to tests; provider work is mocked.
