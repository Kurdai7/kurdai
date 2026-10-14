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

GitHub integration write access works and PR #1 is merged. Cloudflare production deployment of commit f1a01fe83b844b7e37c9a2548be9024eec3ce968 succeeded (build 64ca281d-23d9-49b3-ac53-e12d8701c530, version cb58eb76-fdcd-478b-ac04-397e451f66d3). Render free staging is live and its HTTPS health/authentication checks pass. Secure Worker-to-Render credential wiring remains pending because this assistant session lacks authenticated Cloudflare Dashboard access. Direct requests from this workspace to kurdai.net still return 403; the production UI previously loaded in Cloud Browser, so successful deployment must not be confused with an independently verified authenticated website workflow.

No real paid video test has been performed. Durable processor hosting and applicable costs require separate approval; the ephemeral free staging service remains disabled for AI generation. Obtain separate spending approval before any real API sample, then review videos for image consistency, Sorani/Badini pronunciation, duration and audio. Before public paid generation, implement atomic paid-credit reservations/debits/refunds, payment verification, account/rate-limit controls, provider cost ceilings and verified account-specific commercial terms.

## Owner cost approval update (2026-10-14)

`POST /api/video-quote` validates the same input as generation and stores a 15-minute owner/request/input-bound D1 quote without contacting a paid provider. `POST /api/generate` now requires its quote ID, `approved: true` and the exact `approvedAPIEUR`. Changed or expired quotes are rejected before the provider call; a unique quote/job constraint and existing active-owner lock prevent paid replay. Legacy clients must refresh. Runtime schema initialization adds nullable `quote_id`/`cost_json` columns and a quotes table while retaining existing jobs. Prices/FX live in native-cost.js and fail closed after 2026-10-21; never call the list-price estimate an exact bank invoice. Extension uses a clearly labelled conservative full-output API budget because incremental billing is not verified. Tax, FX spread and hosting are excluded from native API quotes.

Veo Lite is available for text/first-frame generation at its documented rates; references and native extension are rejected. `keep_vars = true` preserves dashboard runtime variables across Git deployment. No secrets were added to git. See [current verification, prices and remaining launch blockers](docs/STATUS_2026-10-14_KU.md). A successful build still does not verify paid provider access, Kurdish speech, identity continuity or a hosted 70-second workflow.


## Processor integration continuation (2026-10-14)

The private processor now permits uploaded-reference jobs without unnecessary fal access, rejects blank cost settings, checks local FFmpeg/ffprobe/libx264 at startup, exposes authenticated configuration readiness through `/api/long/capabilities`, and supports an explicit managed-container bind address. A new integration test runs from the Worker proxy through a real Node HTTP service, fourteen synthetic provider results and FFmpeg to an authenticated 70-second MP4 download. All external provider traffic is forbidden in that test. Syntax, 28 tests and dry-run pass; actual AI generation and speech/identity quality are not verified; the Docker image build succeeded on Render. Managed-host configuration is documented in processor/README.md. Render is connected and a free staging service is live at https://kurdai-processor-staging.onrender.com. Public health returned 200, unauthenticated private health returned 401, and authenticated readiness returned 200 with generation/audio correctly disabled. No paid hosting plan or provider request was enabled. Existing native quotes and no-spend gates remain in force.

## Owner model preference — 2026-10-14

The owner reports over two months using Omni 1.1 Flash successfully for Sorani dialogue in Google Flow. Omni is the selected direction for the primary voiced-video workflow; the current Wan adapter remains a silent economy path. This records the preference, not an implemented Omni adapter or verified direct-API speech result. The Omni Interactions adapter, approved cost quote and multi-turn voiced continuation still need implementation and free tests before any separately approved paid sample. Badini quality has not been established by the owner's Sorani experience.
