# KurdAI Google/Kling cost review — 2026-10-19

Decision: no tested, commercially deployable Sorani AND Badini solution at EUR0.05–0.10/5s has been established. Owner reports good Kurdish output in Flow/Gemini; that experience is useful but is not a reviewed KurdAI API result. Keep production and Stripe Live disabled, and PR43 draft. No paid calls or purchases made.

## Comparable output costs
USD before tax, conversion, inputs, retries, hosting or payment fees. These are rate calculations, not final invoices or guarantees of exact output duration. All audio rows include native generated audio, not a separate TTS stage.

| Model / route | Output | USD/s | 4s | 5s | 6s | 8s | 10s |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Google Omni 1.1 Flash direct | 720p | .10136 | .40544 | .50680 | .60816 | .81088 | 1.01360 |
| Omni 1.1 via Runware | 720p | token billed | same video-token baseline as direct, extra tokens apply | .50680 baseline | .60816 baseline | .81088 baseline | 1.01360 baseline |
| Omni 1.1 via fal, published endpoint rate | 720p | .10 | .40 | .50 | .60 | .80 | 1.00 |
| Kling 3.0 Standard via Runware | 720p, audio on | .126 | .504 | .630 | .756 | 1.008 | 1.260 |
| Kling 3.0 Omni Standard via Runware | 720p, audio on, no video input | .112 | .448 | .560 | .672 | .896 | 1.120 |
| Pruna P-Video-2-Pro, account Playground verified | 768p Cost | .025 | unsupported | .125 | .150 | .200 | .250 |

Google bills video at 5792 tokens/s times USD17.50/million, plus USD1.50/million input and USD9/million text output. Runware documents the same token rates. fal's indexed 1.1 endpoint publishes flat resolution rates, but confirm the authenticated exact endpoint quote and surcharges before purchase. The landing-page Kling FAQ shows older higher figures than the endpoint rate cards; use Runware's explicit cards above, not the landing-page examples. Direct Kling official indexed pricing confirms Omni native-audio/no-video-input at USD.112/s for 720p; its full dynamic pricing table could not be reliably retrieved, so no invented direct Standard package discount is applied. No proven cheaper direct Kling route found. Turbo's card lists .112/s at 720p but does not clearly establish audio inclusion; exclude from an audio-qualified cheapest claim. 4K/Pro variants are not justified for the 720p budget.

Runware permits integer 3–10s on Omni 1.1 and 3–15s on Kling Standard. Flow UI offers Omni 4/6/8/10s, not a native 5s choice. Request controls do not guarantee actual duration; inspect generated media and billed usage. Pruna's 4s row must not be interpolated from its 5s minimum.

## Flow, plans and legitimate savings
No documented first-party public Flow backend API for a multi-user KurdAI service was found. First-party integration is Gemini API (or applicable Google Cloud API), not sharing the owner's consumer session. Flow commercial-output FAQ defers to full Google terms and says Google does not claim ownership. This does not establish permission to resell account access or automate an undocumented consumer endpoint. Third-party “Flow APIs” are not proof of Google authorization; do not integrate them without a documented grant.

| Plan | Verified relevant benefit | KurdAI backend conclusion |
| --- | --- | --- |
| AI Plus | Consumer AI/Flow access subject to product limits | No included public Flow API entitlement established |
| AI Pro | Higher Flow usage; Developer Program benefit includes USD10 Cloud credit/month, eligibility/linking required | Potential finite test subsidy, not a lower Omni unit rate or unlimited API |
| AI Ultra | More Flow usage; monthly Cloud benefits vary by tier | Check exact claimed credit and eligible project; do not assume USD100 |

Finland plan pages did not return a usable EUR checkout price. Do not copy US subscription prices into a Finnish quote. Existing subscription costs must be included when calculating economic per-video costs; unused monthly credits and retries increase the effective price. No plan activated or upgraded.

Flow documents half-credit 360p drafts and Pro/Ultra 0-credit upscale to 720p. This can help the owner's manual workflow, but is not native 720p or a verified one-model public API path, so it does not satisfy the requested production constraints.

Google's general Batch 50% banner does not establish Omni support: its own price section only lists Standard, with no Omni Batch/Flex rate. Provisioned throughput is explicitly unsupported in the Omni guide. Enterprise/volume quotes may be requested by the owner, but no such discount is verified and no message was sent. Removing unnecessary references, disabling repeated generation, using one output, and choosing 720p avoid extras; they cannot turn USD.50 into EUR.10. A target .10 versus roughly .50 requires approximately 80% reduction before tax, subject to currency conversion.

## Kurdish and commercial status
Google's guide says English is evaluated; other languages may vary. Sorani/Badini must each be judged from their actual API samples. fal's Kling guide lists Chinese, English, Japanese, Korean and Spanish; Kurdish is not listed. Native audio alone is not native Kurdish evidence. No new model, including newer catalogue entries, should become selectable as a working Kurdish service from these claims.

Direct paid Gemini API is documented for professional/business API clients, subject to full terms, regional availability and age restrictions; EEA clients must use paid services. fal explicitly permits Omni commercial projects subject to its terms. Neither establishes reviewed Kurdish quality. Provider/model contract compliance is still required for a reseller integration. Preserve existing recommendation buttons without claiming independent validation.

## Execution plan using existing code
1. Keep current Omni integration and existing model UI; do not duplicate merged work. First check whether an already-owned Pro/Ultra benefit can be claimed on the existing billed project without buying a plan. Account eligibility, credit applicability and overage exposure must be checked before any generation.
2. Retain separate dialect prompts in the existing preflight. Do not submit either the old two-Pruna plan or new Omni tests under an unverified cost ceiling. A single 720p Omni test exceeds the EUR.20 authorization at the published rates absent a verified eligible credit.
3. After explicit authorization for an exact inclusive quote, submit once per dialect, no automatic paid retry. Save task ID, usage, returned seconds, actual charge and MP4. Inspect audio stream, dimensions and duration; owner listens to exact words, dialect, naturalness and lip sync.
4. Only after evidence passes, wire the already-existing job/credits/R2 path to a qualified provider and price from real usage. Keep PR43 draft until review. No public activation now.

Final EUR cost remains unknown: provider USD charge / actual USD-per-EUR conversion, applicable tax and bank fees, plus storage/delivery, hosting allocation and payment processing. Include rejected speech attempts as paid retries when estimating a usable-video price. A prepaid top-up is separate cash expenditure, not the video price, and cannot exceed the user's authorized total. Runware balance last observed USD.05, auto top-up off; billing details are required before the top-up amount can be inspected.

## Primary sources
- https://ai.google.dev/gemini-api/docs/pricing
- https://ai.google.dev/gemini-api/docs/omni
- https://ai.google.dev/gemini-api/terms
- https://support.google.com/flow/answer/16353333?hl=en
- https://support.google.com/flow/answer/16352836?hl=en
- https://support.google.com/googleone/answer/16882689?hl=en
- https://support.google.com/googleone/answer/14534406?hl=en
- https://support.google.com/googleone/answer/16286513?hl=en
- https://developers.google.com/profile/help/benefits
- https://one.google.com/intl/fi_fi/about/google-ai-plans/
- https://runware.ai/docs/models/google-gemini-omni-flash-1-1
- https://runware.ai/docs/models/klingai-video-3-0-standard
- https://runware.ai/docs/models/klingai-video-3-0-omni-standard
- https://runware.ai/docs/models/klingai-video-3-0-turbo
- https://fal.ai/models/google/gemini-omni-flash/v1.1/text-to-video
- https://fal.ai/gemini-omni
- https://fal.ai/kling-3
- https://kling.ai/dev/pricing
