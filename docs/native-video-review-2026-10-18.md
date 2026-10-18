# Native video and Kurdish audio release review — 2026-10-18

## Decision
No reviewed model is verified to meet all requirements: native video and audio in one model, Sorani and Badini individually intelligible with synchronized lips, 720p, commercial KurdAI integration, and less than EUR0.20 per five seconds. No paid generation was performed. Keep all generation spending gates closed. API connectivity and synthetic videos are not dialect evidence.

## Price comparison
USD output estimates, before taxes, retries, inputs, context, hosting and payment fees. Longer durations are linear cost illustrations, not proof that one request supports that duration. Do not advertise them as fixed final customer prices.

| Model | Resolution | USD/second | 5s | 10s | 30s | 70s |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Gemini Omni 1.1 Flash | 720p | 0.10136 | 0.5068 | 1.0136 | 3.0408 | 7.0952 |
| Seedance 2.0 Mini via OpenRouter Seed | 720p | 0.0756 | 0.378 | 0.756 | 2.268 | 5.292 |
| HeyGen Video 1 list price | 768p, not native 720p | 0.03 | 0.15 | 0.30 | 0.90 | 2.10 |

Google calculation: 5,792 video output tokens/second at USD17.50/million. Extra input and text/thinking charges apply. Seedance calculation: 1280*720*24/1024 tokens/second at USD3.50/million. Its advertised starting price refers to a lower resolution. HeyGen's headline promotional starting price is not a verified 768p quote; use its explicit 768p list-price comparison, not an assumed discount.

ECB reference on 16 October 2026: EUR1 = USD1.1253. Indicative five-second costs: Omni EUR0.4504; Seedance EUR0.3359; HeyGen EUR0.1333. These are reference conversions, not charged EUR totals. HeyGen is the only listed candidate below the price target at approximately the requested resolution, but does not yet qualify on dialects or commercial integration terms.

## Capability and rights evidence

- Omni: existing KurdAI integration and API connectivity do not establish native Kurdish speech quality. Neither Sorani nor Badini has a reviewed generated clip. Google's terms do not claim ownership of generated content; lawful use and applicable restrictions still apply. The table does not establish a single 70-second request is supported.
- Seedance Mini: provider documents native audio, 480p/720p, and 4–15 second clips. 30/70 seconds would require multiple clips or a separately validated extension flow. Commercial permission for the exact selected provider/model contract remains unconfirmed; Replicate's general output license is explicitly subject to third-party model terms and cannot settle an OpenRouter/Seed contract.
- HeyGen Video: a single native scene/audio model (`heygen-video-1`), not the avatar or separate TTS pipeline. API documents integer durations 5–15 seconds and 480p, 768p, 1080p, 2k. Downscaling 768p would be needed for a 720p deliverable. No validated 30/70-second continuous dialogue flow. General terms permit commercial output for specified paid plans but forbid commercial free-plan output and contain competitive-service/benchmarking restrictions. Confirm the API agreement permits KurdAI before integration or testing. No paid plan was activated.
- MiniMax H3 Max Turbo appears in HeyGen's own comparison at USD0.04/second (768p with audio); this vendor comparison is insufficient to establish a cheaper direct API offer or Kurdish support.
- Veo 3.1 Lite is excluded as requested.

| Model | Sorani | Badini | Native paid speech test |
| --- | --- | --- | --- |
| Omni 1.1 Flash | Unverified | Unverified | Not performed |
| Seedance 2.0 Mini | Unverified | Unverified | Not performed |
| HeyGen Video 1 | Unverified | Unverified | Not performed |

Before approving any candidate: confirm rights and exact endpoint price; obtain explicit spend authorization; generate one distinct sample per dialect; have a fluent speaker assess verbatim speech, dialect, intelligibility and lip sync; inspect dimensions and audio stream; record actual invoice usage. Do not substitute Arabic, Turkish, generic Kurdish labels or successful HTTP responses for this evidence. Two five-second HeyGen samples at list price total USD0.30 (~EUR0.2666), exceeding the earlier EUR0.20 total test cap; do not execute under that cap.

## Billing work and remaining release gates
Combined PR38/PR39 baseline passed 106 local tests. A further exact-origin sandbox return fix includes the actual settled-checkout preview and rejects lookalike attacker origins. Billing-specific tests pass. No production generation or live payment flag changed.

The Stripe test webhook URL now points to the settled-checkout preview. This is configuration verification, not evidence of successful delivery or balance fulfillment. Hosted test checkout, verified owner access, matching configured credit packs, signed delivery and an exactly-once balance increase still need end-to-end evidence. Production readiness must not be inferred from a successful preview build.

## Primary sources reviewed
- https://ai.google.dev/gemini-api/docs/pricing
- https://ai.google.dev/gemini-api/docs/omni
- https://ai.google.dev/gemini-api/terms
- https://openrouter.ai/bytedance/seedance-2.0-mini
- https://replicate.com/bytedance/seedance-2.0-mini
- https://replicate.com/terms
- https://developers.heygen.com/docs/models/heygen-video
- https://developers.heygen.com/heygen-video-1.0-catalog
- https://www.heygen.com/terms
- https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html
