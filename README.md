# KurdAI

Cloudflare Worker + D1 + static Sorani/English studio. Existing account registration, verification and daily credit display are retained. This branch replaces the planning-only generation flow with an authenticated asynchronous Veo workflow.

## Implemented in this branch

- One Generate action sends prompt, duration, model, aspect ratio, resolution and images to Veo.
- 16:9 / 9:16, 4/6/8-second native generation, 720p or 1080p; combinations are validated server-side.
- Up to three PNG/JPEG asset reference images, with an 8-second duration.
- Native extension from an owned ready Veo output: +7 seconds, 720p, same ratio/model, within 48 hours and the provider's duration/count limits. Google returns a combined video. No arbitrary uploaded-video extension is advertised.
- A separate frame mode accepts an uploaded final frame or captures it from the loaded video. It produces a standalone next clip; it is not advertised as combined native extension.
- Durable job history, polling/resume, authenticated download and mobile controls. Generation is restricted to the existing configured owner test account; no public paid-credit generation is enabled.
- Idempotent request IDs and a unique active-job lock prevent duplicate paid calls. Unknown network outcomes require provider-log reconciliation, never automatic retry.
- Sorani dialogue instructions and character preservation are passed to the model; correct speech and perfect continuity cannot be guaranteed.

## Validation

`npm ci`, `npm run check`, `npm test`, `npm run build`.
The tests simulate Google responses and use SQLite for D1 semantics. They are not evidence of a real generated video. See TEST_REPORT.txt for current validation limitations.

## Deployment

Worker Previews build fix (2026-10-14): Cloudflare's PR build invokes `npx wrangler preview`, but the previous pinned Wrangler 4.45.0 does not implement that command. The project now pins Wrangler 4.135.0, the documented minimum for Worker Previews, and requires Node >=22. `wrangler preview --help`, the 23 tests, and production deployment dry-run pass with this version. The `previews` configuration explicitly disables billable generation. It intentionally does not point previews at the production D1 database: the preview UI can deploy, but account/video APIs need a separately configured test D1 binding and secrets. A preview URL is not a production deployment to kurdai.net.

Cloudflare Workers Builds can retain `npx wrangler deploy` as the deploy command; `npm run deploy` is equivalent. Dependencies are pinned with package-lock.json. The assets configuration runs `/api/*` through the Worker first. Existing D1 identity is preserved.

Configured bindings: DB and ASSETS. Existing secrets: EMAIL_API_KEY, EMAIL_FROM, GEMINI_API_KEY. Existing non-secret generation controls: VIDEO_GENERATION_ENABLED=true and VIDEO_TEST_EMAIL set to the owner login. Do not put secret values in git, screenshots, chat or wrangler.toml.

`schema.sql` initializes account tables on a new D1 database. `migrations/0001_video_jobs.sql` adds video jobs without changing old tables. The video API also initializes only those new tables/indexes with CREATE IF NOT EXISTS, so an existing deployment does not require a manual schema step to start this workflow. Old pilot rows remain untouched; legacy pilot jobs are not silently resubmitted or billed.

Extension source videos are fetched server-side and sent using the documented inlineData contract; this implementation limits source video size to 12 MiB to stay within Worker memory. Larger files need an object-storage/upload architecture. Generated downloads may use signed Google redirects; the API key is never forwarded to other hosts. The UI downloads the authenticated output as a blob for playback and saving.

An ambiguous `submitting` or `uncertain` job must only be reconciled by an administrator after inspecting Google logs. If an operation is found, attach that verified operation to the same job and mark it running; only mark failed to release the lock when no paid operation exists. Never clear the lock merely because the user waited a long time.

## Pricing proposal

See docs/PRICING_KU.md and pricing.js. Run `node scripts/pricing-report.js` to reproduce the retail calculations. Models/prices there are proposals with liveEnabled=false, not active payment products. Credits checkout/reservation/refunds still need implementation and provider integration. The Worker has the existing Veo adapter; the separate 70-second processor in free staging adds Wan Flash and FLUX opening-image adapters. No real billable test, purchase, top-up or contract is authorized without the owner's separate approval.

## Owner 70-second workflow

Dialogue update: see [docs/DIALOGUE_KU.md](docs/DIALOGUE_KU.md). Sorani/Badini instructions are distinct and each Veo job now stores its selected language; extension rejects a changed or unknown source dialect. Schema initialization adds the `language` column to existing deployments if needed. `migrations/0002_dialogue_language.sql` is the manual migration equivalent; do not apply it a second time after runtime schema initialization already added that column. The long-video quote separately reports disabled TTS estimates and blocks all audio starts until full costs and provider access are verified. No TTS synthesis, voice selection, lip-sync or audio mux integration is active.

See [docs/LONG_VIDEO_KU.md](docs/LONG_VIDEO_KU.md) for verified API cost estimates, limitations and sources; see [processor/README.md](processor/README.md) for deployment/configuration. The UI provides a free quote and a separate explicit cost approval, then one automatic 14×5-second workflow and a single MP4. Actual 70-second muxing was tested with synthetic local media, not paid AI. Unknown media/FX/tax costs disable the start button. This requires a separately hosted private Node/FFmpeg processor with durable disk; free Render staging is deployed, but durable production hosting has not been provisioned and no paid plan has been purchased. Face identity, seamless motion and Sorani understanding are not guaranteed; the economy output has no audio. It must not be advertised as a launched 70-second AI feature until a separately approved real provider test and deployment succeed.

## Remaining launch work

Render is Live on the existing free plan; PR #2 is merged. Startup diagnostics confirm a Gemini key is configured, but generation is disabled, durable storage is unconfirmed, and five processing/token/FX/tax settings are missing. The owner has confirmed Cloudflare-to-Render connectivity and email domain verification. Do not repeat initial setup or ask for another API key. Cloudflare authenticated deployment access is not available in this workspace.

No real paid video test has been performed. The owner explicitly declined new monthly expenses and new payments on 2026-10-15. Keep billable generation disabled. Real AI video, Sorani/Badini pronunciation, continuity, reference fidelity and 70-second provider output remain unverified. Public paid credits/payment settlement also remain unfinished; the website must not claim a complete commercial launch.

## Owner cost approval update (2026-10-14)

`POST /api/video-quote` validates the same input as generation and stores a 15-minute owner/request/input-bound D1 quote without contacting a paid provider. `POST /api/generate` now requires its quote ID, `approved: true` and the exact `approvedAPIEUR`. Changed or expired quotes are rejected before the provider call; a unique quote/job constraint and existing active-owner lock prevent paid replay. Legacy clients must refresh. Runtime schema initialization adds nullable `quote_id`/`cost_json` columns and a quotes table while retaining existing jobs. Prices/FX live in native-cost.js and fail closed after 2026-10-21; never call the list-price estimate an exact bank invoice. Extension uses a clearly labelled conservative full-output API budget because incremental billing is not verified. Tax, FX spread and hosting are excluded from native API quotes.

Veo Lite is available for text/first-frame generation at its documented rates; references and native extension are rejected. `keep_vars = true` preserves dashboard runtime variables across Git deployment. No secrets were added to git. See [current verification, prices and remaining launch blockers](docs/STATUS_2026-10-14_KU.md). A successful build still does not verify paid provider access, Kurdish speech, identity continuity or a hosted 70-second workflow.


## Processor integration continuation (2026-10-14)

The private processor now permits uploaded-reference jobs without unnecessary fal access, rejects blank cost settings, checks local FFmpeg/ffprobe/libx264 at startup, exposes authenticated configuration readiness through `/api/long/capabilities`, and supports an explicit managed-container bind address. A new integration test runs from the Worker proxy through a real Node HTTP service, fourteen synthetic provider results and FFmpeg to an authenticated 70-second MP4 download. All external provider traffic is forbidden in that test. Syntax, 28 tests and dry-run pass; actual AI generation and speech/identity quality are not verified; the Docker image build succeeded on Render. Managed-host configuration is documented in processor/README.md. Render is connected and a free staging service is live at https://kurdai-processor-staging.onrender.com. Public health returned 200, unauthenticated private health returned 401, and authenticated readiness returned 200 with generation/audio correctly disabled. No paid hosting plan or provider request was enabled. Existing native quotes and no-spend gates remain in force.

## Owner model preference — 2026-10-14

The owner reports over two months using Omni 1.1 Flash successfully for Sorani dialogue in Google Flow. Omni is the selected direction for the primary voiced-video workflow; the current Wan adapter remains a silent economy path. The Omni Interactions adapter, immutable owner quote, default Omni UI and multi-turn voiced pipeline are now implemented and pass offline integration tests. Real provider speech and continuity remain unverified. Badini quality has not been established by the owner's Sorani experience.

## Current integration status — 2026-10-15

The long-video form now defaults to Omni 1.1 Flash with Sorani selected. It offers 5–70 seconds in five-second increments, 720p, both aspect ratios and up to three uploaded image references. Badini is a separate language option. Wan remains an explicitly silent alternative for legacy 60/70-second jobs; existing Veo controls are retained. Spoken lines are allocated in order, one line per segment (140-character limit), without dialect translation. Text-only Omni does not create or charge a separate opening-image provider.

Worker validation → private processor → immutable model-specific quote → exact EUR approval → persisted Omni orchestration → voiced MP4 download is implemented. Model/duration mismatches reject stale backends; changed inputs invalidate browser approval. Provider usage counters are sanitized and retained per interaction for reconciliation; they are not presented as a final invoice. Real local HTTP/FFmpeg tests cover 5/60/70-second voiced outputs using synthetic provider responses, including private download and replay protection. Offline integration, syntax and Worker dry-run checks are required before merging changes. No paid provider calls occurred.

Production connection is already established. Render automatically deployed merged PR #2 successfully with protocol version 4. Its secret-free startup diagnostics confirm the existing key and the remaining disabled/missing settings. A live service is not evidence of working paid generation.

Real Omni generation remains gated by provider access on the processor, verified input/context/text token allowances, complete processing/FX/tax costs, durable storage and an explicit per-job EUR approval. No free-host durability assertion, tax exemption, zero cost, paid plan, API credential or paid generation has been invented or activated. Public commercial release, payment/credits reconciliation and real AI quality verification remain outstanding.

## No-spend controls — 2026-10-15

The application defaults to **zero authorized API spend**, including when old generation flags remain enabled. Both the Worker and processor require `BILLABLE_REQUESTS_ENABLED=true`, a positive decimal `API_MAX_JOB_USD` and a positive decimal `API_MAX_DAY_USD`. Missing, malformed, infinite and zero limits fail closed. The committed Cloudflare variables explicitly set false/0/0. Render uses the same safe defaults when variables are absent. Do not enable these settings without the owner's new, specific spending approval.

Limits reserve the complete quoted API estimate before provider submission. Native Veo uses one atomic D1 INSERT conditioned on the daily total; the processor serializes start requests and persists approval/quote before submitting. All statuses, including failed and uncertain requests, continue consuming their reservation. Processor reservations reload from disk on restart. UTC approval dates define daily windows. These are **separate per-backend reservation limits**, not a shared global invoice cap. Provider input/history/thinking, taxes, FX, compute, storage and transfer can differ from estimates; Google budget alerts are not hard spending caps. With current false/zero settings, no new generation submission is allowed.

Video POST routes share ten requests per IP per 15-minute D1 window (all five write routes share one counter). Processor authenticated POST requests have an additional global 20/minute limit, a 17 MB body limit, early Content-Length rejection and request/header timeouts. At most ten unstarted quotes per owner retain uploaded reference images; creating another removes the oldest retained entries. Existing replay/active-job/uncertain-result guards remain in place. Synthetic smoke media is explicitly non-AI, requires no provider and remains available.

Cost categories, checked against official sources on 2026-10-15:

| Category | Existing arrangement / published usage cost |
| --- | --- |
| Gemini Omni 1.1 Flash | No free API tier. 720p video output: $17.50/million tokens, 5,792 tokens/second = $0.10136/second. 70 seconds of output alone: $7.0952; input/history/text and any extra generated duration are additional. This is not an end-to-end quote. |
| Veo 3.1 | No free video API tier. Fast 720p with audio: $0.10/second ($0.80 for 8 seconds). Standard 720p: $0.40/second; Lite 720p: $0.05/second, with different feature constraints. |
| Render compute | Existing free service retained; no plan upgrade, new service or subscription. Free instance-hour/build/transfer allowances apply. No paid AI processing enabled. |
| File storage | Existing local Render files are ephemeral and can disappear at restart/deploy. No durable storage purchased. Render persistent disks require paid compute and are separately priced at $0.25/GB/month; not provisioned. |

Sources: [Google API pricing](https://ai.google.dev/gemini-api/docs/pricing), [Render free limits](https://render.com/docs/free), [Render disk requirements](https://render.com/docs/disks), [Render pricing](https://render.com/pricing).

Full-release acceptance remains blocked until a separately authorized real-provider test produces downloadable 5/60/70-second samples, both Sorani and Badini are reviewed by a speaker, reference identity and continuity are reviewed, and durable storage plus public credit/payment accounting are verified. Offline FFmpeg outputs and mocked providers do not satisfy these checks. Do not send paid test requests, enable billing, purchase storage, or describe these items as verified under the current authorization.
