# Pruna candidate review — 2026-10-19

Not approved for production. Native audio is documented; intelligible Sorani and Badini are unverified individually. No paid requests, provider account creation, credit purchase or plan activation performed.

## Verified provider configuration
P-Video-2-Pro accepts text or first/last frames and returns generated audio with video. Duration 5–15 seconds; 480p/768p, 24fps. Pruna documents Cost as the same output quality as Speed, with different latency. This is a provider claim, not our Kurdish quality measurement. Native 720p is unavailable; downscaling 768p is needed for that deliverable.

| 768p, text-to-video | USD/second | 5s estimate | 15s illustration |
| --- | ---: | ---: | ---: |
| Direct Pruna, Cost | 0.025 | 0.125 | 0.375 |
| Runware, Cost, published temporary promotion | 0.0125 | 0.0625 | 0.1875 |
| Runware, Cost, listed regular rate | 0.025 | 0.125 | 0.375 |

Runware advertises 50% off through October 29. The offline plan requires a new price review after today rather than silently retaining a promotion. Pruna's separate portal lists an older promotion ending October 13; we do not apply it to direct pricing.

These are output estimates, not final invoices or enforced spending caps. Pruna bills whole seconds measured from the returned clip. Tax, bank conversion, storage/delivery, retries and any different request mode are additional or unknown. References are excluded from these text-only test cases; do not reuse this estimate for reference-to-video. No top-up is authorized by this review.

## Prepared work
`scripts/pruna-preflight.js` prepares distinct Sorani/Badini text-only requests for direct Pruna and Runware, one output per task, prompt expansion off, credentials omitted. It has no HTTP transport and cannot submit. Each API generates video/audio together; acknowledgement and status polling are separate HTTP operations, not separate audio generation.

A native speaker must review each real output for exact words, dialect, naturalness and lip synchronization. Media inspection must verify the dimensions, duration and audio stream. Store actual usage and charge evidence before claiming support. Neither a valid payload nor native-audio documentation establishes Kurdish speech.

Runware's terms permit commercial outputs for Partner Models subject to model rules and restrict standalone resale of the underlying service. Confirm the applicable P-Video-2-Pro rules and KurdAI integration contract before public activation; generated-content permission alone is insufficient to infer all resale rights.

## Sources
- https://docs.pruna.ai/en/stable/docs_pruna_endpoints/performance_models/p-video-2-pro.html
- https://docs.api.pruna.ai/guides/models
- https://runware.ai/docs/models/prunaai-p-video-2-pro
- https://runware.ai/terms

HeyGen also documents single-model native audio and a 768p promotion at USD0.015/s through October (USD0.075/5s). Kurdish remains unverified; the earlier web-app TTS response does not constitute a test of this separate native-video API. It is not activated or claimed as a Kurdish solution.
- https://www.heygen.com/ai-video-api

## Account verification later on 2026-10-19
Authenticated Runware Playground displayed USD0.025/second for 768p Cost; account balance USD0.05, spend USD0, automatic top-up disabled. The published promotion was not shown in the account. The preflight now uses the regular USD0.125/5s estimate even on review day. Historical promotion rows above are retained for provenance, not current account quotes. Two samples would be USD0.25 before extras. Do not submit under the EUR0.20 total authorization without a verified inclusive bound. No generation submitted.
