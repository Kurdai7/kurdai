# Native video choices — readiness, 2026-10-20

Owner decision: offer Omni 1.1 Flash, PixVerse and Kling, one output with native speech, one customer price. Preserve existing models and merged work. No Stripe Live, purchases, paid requests, or PR43 merge.

## Evidence and remaining work

- Owner reports Sorani works well in Flow/Gemini/Kling, and PixVerse Sorani is acceptable after a real web-app test. These are owner listening results, not synthetic API test results.
- Owner selects Omni 1.1 Flash for Badini. Actual Badini quality remains pending. Latest owner test says Veo 3.1 Lite is poor for Badini; do not recommend it.
- Flow and Gemini are applications, not two independent Omni providers. Existing direct Omni transport is retained.
- PixVerse V6 and Kling 3.0 choices are now in the UI as awaiting API connection. Existing Seedance, HeyGen and Wan options are preserved. Neither new candidate can submit via the public UI or existing backend validator.
- `processor/native-candidates.js` prepares text-only 720p native-audio requests and a disabled-by-default fal queue transport. This is a private adapter, not an activated production integration. No credentials or provider calls were used in tests.
- Separate Sorani/Badini prompts preserve exact dialogue; no translation or separate TTS request. Unsupported extension/references/long durations are rejected instead of silently changing workflow.
- The caller must persist an exclusive durable reservation before using `submit`; this adapter deliberately has no retry. Public job-engine wiring, immutable inclusive quotes, billing settlement, archive/media validation and account credentials are still required. Do not connect it directly to a public start route.
- fal's Kling v3 Standard endpoint documentation explicitly says other languages may be translated to English. This particular API route is therefore not qualified for Kurdish, despite the owner's successful Kling web-app experience. Retain its disabled candidate code; verify a suitable provider/version before activation.

## Costs, not final customer prices

- Direct Google Omni 720p output baseline: USD .10136/sec, plus input/text tokens.
- fal Omni 1.1 720p published output rate: USD .10/sec.
- Direct PixVerse V6 720p audio on: 12 credits/sec, 225 credits/USD; five seconds is USD .2666667. This rate must NOT be used as a fal quote.
- fal Kling v3 Standard audio on: USD .126/sec; five seconds USD .63. Voice control has a higher separate rate and is not used by the prepared payload.
- fal PixVerse price is not verified here. No runtime price is invented and no final EUR quote is issued. Tax, payment fees, FX, storage, retries and actual output duration must be reconciled.

## Activation requirements

1. Choose the exact commercial API route, confirm its own account quote and terms, and configure its existing secret server-side only.
2. Obtain explicit approval for any newly priced paid test. Existing EUR .20 approval was for the two named Pruna/Runware evaluations, not these more expensive providers.
3. Submit one approved request per dialect, persist task ID, inspect returned dimensions/duration/audio, and have the owner review exact dialogue and lip sync.
4. Wire qualified routes into existing quote/reservation/job/R2/credit settlement paths. Keep unqualified routes blocked and do not imply Badini is verified.
5. Merge/deploy only after the requested real output review; PR43 remains Draft.

## Sources read on 2026-10-19/20

- https://fal.ai/models/fal-ai/pixverse/v6/text-to-video/api
- https://fal.ai/models/fal-ai/kling-video/v3/standard/text-to-video/api
- https://docs.platform.pixverse.ai/pixverse-api-pricing-2394995m0
- https://ai.google.dev/gemini-api/docs/pricing
- https://fal.ai/learn/tools/how-to-use-gemini-omni-flash-1-1

## Follow-up: blocked quote integration

`longInput` now validates the two candidate models and `quoteLong` returns non-payable, route-specific reference pricing. Both final EUR and actionable API totals remain null; canStart is always false regardless of legacy flags. PixVerse direct reference pricing is explicitly distinguished from the fal adapter price. Unsupported long duration, extension, references and mixed dialects are rejected. Docker includes the shared module. The public UI continues to block these routes until full integration and review. No paid job-engine activation is added.

## Single-request job engine preparation

`processor/native-engine.js` is wired into processor dispatch and persists before its sole billable submission, polls the stored task, checks native dimensions/audio/duration, and saves one final MP4 through the existing archival path. It never invokes silent Wan or separate TTS. Unknown submissions are terminal uncertain. Public progress treats each candidate as one clip, including non-five-second durations. The UI now permits free blocked quotes for these two choices; totals remain null and start remains disabled. Candidate quote generation is intentionally still non-payable: real provider qualifications and final account pricing have not been supplied. No environment flag or credential was changed.

## Exact prepared PixVerse route pricing reviewed

The fal PixVerse V6 text-to-video page now explicitly publishes 720p audio-on at USD .060/second (5s USD .30), as distinct from the direct PixVerse USD .2666667/5s reference. Candidate providerReference now uses the actual prepared fal route and never substitutes direct pricing. These remain published output estimates, not account invoices or inclusive EUR customer prices. Source: https://fal.ai/models/fal-ai/pixverse/v6/text-to-video . Latest complete regression: 129 tests passed; final UI change additionally passed its focused tests. No real API generation, Stripe Live, merge or production deploy.


## Owner P-Video 2 review and release status — 2026-10-20

The owner generated a four-second P-Video 2 video in VdoBloom (9 of 10 free credits) and accepted its Sorani speech. This is a real owner listening review of that web application, not proof that KurdAI can call its API. Both Sorani and Badini must remain available; Badini is not independently qualified. No request to remove either language is current.

Added a P-Video 2 selection and a non-payable Draft reference quote. Direct Pruna publishes USD .015/returned second for 720p Draft (5 seconds: .075), and .025/second standard. This is not the VdoBloom credit price or a final EUR customer price. The maximum native request is 20 seconds; 70-second chaining is not implemented for this route. No silent fallback or separate TTS is substituted.

The newly deployed key was checked after deploying aaee9e0: configured, no surrounding/embedded whitespace or quotes, HTTP 401. No generation submitted. Cloudflare's managed original P-Video is a different model; its zero account balance and USD10 minimum credit top-up were observed on the owner's phone. Do not substitute it for P-Video 2 silently.

Release remains blocked by a working qualified API connection and inclusive billing/credit settlement. Stripe Live remains disabled. Website listening success alone does not authorize changing those flags or presenting the site as fully ready.

Source: https://docs.api.pruna.ai/guides/models/p-video-2


## P-Video 2 native processor wiring

`processor/pruna-native.js` now prepares direct 720p Draft requests with native audio, exact separate-dialect dialogue, safety enabled and no separate TTS. The shared native engine selects the Pruna credential and requires PRUNA_NATIVE_ENABLED as well as its existing generation/billing/durable storage gates and a matching complete Pruna Draft quote. It persists before POST, polls the stored task only, downloads bounded output over validated HTTPS hosts, sends the API key only to exact api.pruna.ai, validates media and archives a single MP4. Public quotes remain non-payable, so no public request can activate this prepared route. No flags were enabled and no provider request was sent. The owner web-app result is still not direct-API qualification.


## Actual API result — 2026-10-20

The owner rotated the active Pruna key, and the agent replaced the stale revoked key in Render. Deployment 00b0c14 became Live; the authenticated missing-task probe changed from HTTP 401 to HTTP 404. Account UI showed USD20 credits and auto-top-up disabled. No card top-up or paid subscription was performed.

The owner explicitly approved one four-second Sorani P-Video 2 Draft test using free credits, estimated USD .06 with maximum published model exposure USD .30. The dated private endpoint in ce9bcb9 was deployed specifically to staging (dep-dbbmma1jfumc7387oh9g). It persisted the reservation and submitted exactly once. Pruna returned succeeded. No second generation POST was sent.

Actual downloaded MP4: 1,930,754 bytes, H.264 1280x704, duration 4.041667 seconds, AAC audio at 48kHz. The strict literal-720p inspection correctly refused readiness. This model's 720p label therefore does not establish 1280x720 for this route. Do not upscale and claim native 720p. The original output was preserved and delivered to the owner for listening; speech quality and lip sync still require that review. Billing is not invoice-reconciled. The durable reservation/task remains retained; do not retry or delete it because the inspection refused the media.

Next release blockers are actual Sorani listening review, an honest resolution choice, inclusive customer pricing/settlement and production activation. Badini remains available as a language choice but unverified. The earlier HTTP401 blocker is resolved. Six focused manual-review/transport tests passed before staging deployment; no claim of a new complete regression result is made here.
