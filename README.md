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

Cloudflare Workers Builds can retain `npx wrangler deploy` as the deploy command; `npm run deploy` is equivalent. Dependencies are pinned with package-lock.json. The assets configuration runs `/api/*` through the Worker first. Existing D1 identity is preserved.

Configured bindings: DB and ASSETS. Existing secrets: EMAIL_API_KEY, EMAIL_FROM, GEMINI_API_KEY. Existing non-secret generation controls: VIDEO_GENERATION_ENABLED=true and VIDEO_TEST_EMAIL set to the owner login. Do not put secret values in git, screenshots, chat or wrangler.toml.

`schema.sql` initializes account tables on a new D1 database. `migrations/0001_video_jobs.sql` adds video jobs without changing old tables. The video API also initializes only those new tables/indexes with CREATE IF NOT EXISTS, so an existing deployment does not require a manual schema step to start this workflow. Old pilot rows remain untouched; legacy pilot jobs are not silently resubmitted or billed.

Extension source videos are fetched server-side and sent using the documented inlineData contract; this implementation limits source video size to 12 MiB to stay within Worker memory. Larger files need an object-storage/upload architecture. Generated downloads may use signed Google redirects; the API key is never forwarded to other hosts. The UI downloads the authenticated output as a blob for playback and saving.

An ambiguous `submitting` or `uncertain` job must only be reconciled by an administrator after inspecting Google logs. If an operation is found, attach that verified operation to the same job and mark it running; only mark failed to release the lock when no paid operation exists. Never clear the lock merely because the user waited a long time.

## Pricing proposal

See docs/PRICING_KU.md and pricing.js. Run `node scripts/pricing-report.js` to reproduce the retail calculations. Models/prices there are proposals with liveEnabled=false, not active payment products. Credits checkout/reservation/refunds still need implementation and provider integration. The Worker has the existing Veo adapter; the separate, undeployed 70-second processor adds Wan Flash and FLUX opening-image adapters. No real billable test, purchase, top-up or contract is authorized without the owner's separate approval.

## Owner 70-second workflow

See [docs/LONG_VIDEO_KU.md](docs/LONG_VIDEO_KU.md) for verified API cost estimates, limitations and sources; see [processor/README.md](processor/README.md) for deployment/configuration. The UI provides a free quote and a separate explicit cost approval, then one automatic 14×5-second workflow and a single MP4. Actual 70-second muxing was tested with synthetic local media, not paid AI. Unknown media/FX/tax costs disable the start button. This requires a separately hosted private Node/FFmpeg processor with durable disk; nothing has been deployed or purchased. Face identity, seamless motion and Sorani understanding are not guaranteed; the economy output has no audio. It must not be advertised as a launched 70-second AI feature until a separately approved real provider test and deployment succeed.

## Remaining launch work

The connected GitHub integration can read the repository but branch creation returned 403 Resource not accessible by integration. Resolve integration write access before pushing this branch. Then inspect Cloudflare builds/account state and deploy, and obtain separate spending approval before a real API test. Then review actual videos for image consistency, Sorani pronunciation, duration and audio. Before opening public paid generation, implement atomic paid-credit reservations/debits/refunds, payment verification, account/rate-limit controls, provider cost ceilings and verified account-specific commercial terms. Do not describe this branch as a fully launched monetized service until those gates pass.
