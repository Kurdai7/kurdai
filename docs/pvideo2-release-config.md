# P-Video 2 release wiring (2026-10-20)

The owner accepted the actual four-second API output's Sorani speech. It had native AAC audio, H.264 1280x704 pixels and duration 4.041667 seconds. The provider's 720p label is mapped to an explicit 704p choice; native media is retained without upscaling. User-facing generation accepts 3–70 seconds. Requests above 20 seconds use separate 20-second native clips and a final remainder, assembled into one MP4. Each later clip receives the preceding final frame. One initial PNG/JPEG reference and extensions from an owned completed video are implemented. This encourages visual continuity; it does not guarantee matching voices or seamless scenes. Only the original four-second output has been tested against the real provider; the longer workflow has synthetic integration and real FFmpeg coverage.

## Implemented

- Both Sorani and Badini remain selectable, with separate exact dialogue. Badini is explicitly unverified rather than silently translated or removed.
- Wardrobe defaults apply to men, women and children while reference outfits and explicit instructions take precedence.
- Overlong P-Video dialogue is rejected before quoting/submission to avoid rushed speech. The heuristic is 2.5 whitespace-separated words per requested second, not a speech timing guarantee.
- Runtime Pruna quotes compute explicit USD/EUR conversion, processing/payment allowance, FX and tax components. One extra estimated second per provider clip accounts for returned media duration overhead. These are estimates, not provider hard limits or reconciled invoices.
- Quoting requires explicit generation, credential, billing and durable-storage readiness. No default FX/tax/processing costs are invented.
- Purchased credits are reserved in D1 before start, bound to server quote and owner; replay cannot double debit. Failed/rejected jobs refund once, uncertainty holds. Live public access requires verified email and all public/credit gates.
- Old experimental Veo routes remain owner-only even if the separate paid long-workflow gate is enabled.

## Required runtime configuration

Render: PRUNA_API_KEY, PRUNA_NATIVE_ENABLED=true, NATIVE_GENERATION_ENABLED=true, NATIVE_BILLING_VERIFIED=true, LONG_DURABLE_STORAGE=true, R2 final-media/job storage; LONG_USD_PER_EUR (explicit rate), LONG_MEDIA_EUR (explicit processing/payment allowance), LONG_FX_PERCENT, LONG_VAT_PERCENT, and positive spending/month/lifetime limits. Existing spending controls apply before any generation.

Cloudflare: existing processor URL/shared secret, DB; VIDEO_PURCHASED_CREDITS_ENABLED=true, VIDEO_CREDITS_PER_EUR (approved retail rate), STRIPE_MODE=live, PUBLIC_VIDEO_ENABLED=true, PUBLIC_RELEASE_VERIFIED=true. Checkout additionally needs approved active Stripe pack prices, matching restricted live key/webhook secret and its existing approval flags.

No runtime generation, public-access, spending or checkout flags were enabled by this code update. No new video was submitted.

## Verified external state

Stripe connected account reports charges_enabled=true, payouts_enabled=true, details_submitted=true and no currently_due requirements. The KurdAI live checkout webhook exists but is disabled. Active EUR price search returned no results. No Stripe objects were modified and no payment was created. Final sale prices and runtime fee/tax treatment remain to be configured before checkout activation.
