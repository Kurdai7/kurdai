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
