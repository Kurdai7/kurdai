# KurdAI owner cost and readiness review — 2026-10-23

No spending is authorized. Paid generation, Render upgrades and R2 activation remain disabled. A successful synthetic test is not evidence that the AI provider, Kurdish speech or character consistency has been validated.

## Free test available now

The verified owner can use the explicit **70-second MP4 test — no API, not AI video** button. It creates fourteen five-second synthetic test-pattern clips with changing test tones, then joins them into one MP4. It uses the existing Free processor, requires no prompt, image, API credits or disk purchase, and supports landscape and portrait. Repeated clicks return the same job for that owner and ratio. Only one running job is allowed. The test cannot enable paid generation.

The Node processor and FFmpeg can also run on an existing computer without Render. That removes a hosting subscription for development, but the computer must remain online for web requests; it is not a dependable public service. Cloudflare Workers alone do not run this native FFmpeg process.

Free Render is suitable for this test, not a promise of durable public generation: it sleeps after 15 minutes without traffic and its filesystem is ephemeral. Download test output before a restart/deploy. A free successful assembly does not make external AI generation free.

## Verified list prices, not an invoice

Conversion uses ECB 2026-10-23: EUR 1 = USD 1.1193. Bank conversion, VAT and account-specific discounts are unknown. Values below exclude them. No paid request was made to measure actual usage.

| Service item | USD | EUR reference estimate |
| --- | ---: | ---: |
| Omni 720p first 5 seconds of video output, from text OR uploaded image | 0.5068 | 0.452783 |
| Omni remaining 65 seconds of continuation video output | 6.5884 | 5.886179 |
| Omni requested 70 seconds of video output, combined | 7.0952 | 6.338962 |
| Omni input/context/history | 1.50 per million input tokens | 1.339884 per million |
| Omni generated text/thinking | 9.00 per million output text tokens | 8.039303 per million |
| Omni native audio | Included in video output | No separate audio surcharge |
| Local FFmpeg software / separate stitching API | No stitching API called | Software fee 0; hosting resources separate |

The first two rows sum to the third; never add continuation output twice. Text-to-video and image-to-video are alternative starting modes, not two charges for the same job. Image inputs and continuation history add input tokens. If a provider returns longer clips which are trimmed, all generated tokens can still be billable. Thus **EUR 6.34 is the requested output component, not the real full cost or a guaranteed minimum invoice for every outcome**. Short/failed requests can also incur costs.

The Admin quote keeps unknown input/history, generated text, processing, FX and VAT costs unknown, blocks paid start, and adds no retail markup. Current conservative allowances reserve up to ten seconds per five-second request plus explicitly configured input/text allowances. They are estimates, not a provider-enforced spending cap. Actual invoices must be reconciled against per-interaction token usage.

## Lower-priced candidates

| Candidate | Verified generation rate | 70-second unit comparison, excluding other costs | Limitation |
| --- | --- | --- | --- |
| Wan 2.2 I2V Flash 480p | USD 0.015/sec | USD 1.05 / EUR 0.937919 | Silent, needs a starting image; lower resolution |
| Wan 2.2 I2V Flash 720p | USD 0.036/sec | USD 2.52 / EUR 2.251005 | Silent, needs a starting image |
| fal Wan 2.2 A14B I2V Turbo 480p | USD 0.05 per generated clip | No verified 70-second total | Lower-priced candidate; the reviewed API schema does not specify an output-duration control, so do not assume fourteen clips yield 70 seconds |
| Veo 3.1 Lite 720p with audio | USD 0.05/sec | USD 3.50 / EUR 3.126396 | Unit comparison only; supported clip lengths/extension and final billed seconds must be checked before a quote |
| Omni 1.1 Flash 720p | USD 0.10136/sec of video output, plus tokens above | USD 7.0952 / EUR 6.337829 output only | No free API tier; context costs additional |

Alibaba Wan 480p has the lowest verified per-second price in this comparison. fal's Turbo is an additional potentially cheaper candidate with per-clip pricing; its generated duration and total billed clip count need verification before quoting a 70-second output. Neither statement establishes best quality or a universal cheapest model. Omni remains the selected primary model; no automatic substitution. No model here has been quality-tested using this project's paid API account. Google Flow experience does not by itself verify this API integration or its billing.

## Storage and stable hosting

A 1 GB disk is **not intrinsically required** for a 70-second MP4. R2 can store clips and final videos. Standard R2 includes 10 GB-month, 1 million Class A operations and 10 million Class B operations monthly, with free egress. Above those allowances: USD 0.015/GB-month, USD 4.50/million Class A and USD 0.36/million Class B, with billing-unit rounding. This is a metered service, not an unconditional zero-cost promise. R2 has not been activated or connected.

However, this implementation currently persists job state, submission markers, interaction IDs and intermediate clips on the processor filesystem. Merely copying final MP4s to R2 would not make interrupted paid jobs safe. Removing the disk requires persistent job checkpoints, atomic submission ownership/locking, intermediate recovery and private object authorization, with crash/redeploy tests. Do not set LONG_DURABLE_STORAGE=true just because a bucket exists.

The smallest verified always-on Render option reviewed is Starter USD 7/month (about EUR 6.25), with 512 MB and 0.5 CPU. Adding 1 GB persistent storage adds USD 0.25/month: USD 7.25, about EUR 6.48 before tax, FX, API, bandwidth/build overages. It reduces cold starts and preserves the current filesystem layout, but still needs resource/load and restart testing. This is the simplest low-cost path for the current code, not a universal cheapest-host guarantee. Neither option is approved or activated. After durable remote state/storage is implemented, the disk could be removed; saving USD 0.25/month alone does not justify claiming that migration is already complete.

## AI workflow and remaining release gates

The existing owner workflow automatically sequences up to fourteen five-second calls, preserves Omni interaction state and character references, normalizes voiced clips and assembles one MP4. One story prompt is carried through the sequence; optional dialogue lines are allocated in order without automatic dialect translation. Sorani and Badini are distinct inputs. Face, clothes, voice, seamless continuation and correct dialect pronunciation are requested, not guaranteed. Synthetic tests verify orchestration/media behavior only.

Public paid launch still requires: owner-approved paid API probe and measured token costs; verified Sorani/Badini samples; durable checkpoint/restart handling; resource/storage limits and cleanup for real outputs; then an approved full-cost quote. No automatic paid retries are permitted after uncertain submissions. The website must not present configuration readiness as an AI generation success.

## Primary sources checked

- https://ai.google.dev/gemini-api/docs/pricing
- https://www.alibabacloud.com/help/en/model-studio/wan2-2-i2v-flash
- https://fal.ai/models/fal-ai/wan/v2.2-a14b/image-to-video/turbo
- https://fal.ai/models/fal-ai/wan/v2.2-a14b/image-to-video/turbo/api
- https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html
- https://developers.cloudflare.com/r2/pricing/
- https://render.com/docs/free
- https://render.com/articles/render-vs-railway
- https://render.com/articles/how-much-does-cloud-application-hosting-cost-for-small-businesses
