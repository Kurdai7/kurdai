# Private 70-second processor (free staging deployed)

The Worker authenticates the existing verified owner, then forwards only `/api/long/*` to this private Node service over HTTPS. Node owns durable files, billable task IDs, serial execution and FFmpeg. Ordinary Workers cannot run this FFmpeg executable. Keep this separate from the existing Veo workflow.

Runtime: Node 24+, `ffmpeg` and `ffprobe` with libx264, durable disk, a single processor instance per disk, private TLS ingress/proxy. `processor/Dockerfile` was built and deployed successfully on Render free staging on 2026-10-14. This is not durable production hosting. The HTTP listener defaults to loopback; deploy behind a TLS proxy in the same network namespace. A managed Docker web service may explicitly set PROCESSOR_BIND_HOST=0.0.0.0 so its HTTPS ingress can reach PORT. All /v1 routes still require the service credential and owner header. There are no new npm runtime dependencies. `npm run processor` starts the service after the operator has configured it. Do not purchase hosting or enable paid providers without owner approval.

Host environment (values must be configured in host secret/config settings, never chat/git):

- `LONG_VIDEO_SERVICE_SECRET`: random shared credential, at least 32 characters; set the same secret in the Worker.
- `DASHSCOPE_API_KEY`: Singapore/international Model Studio account with wan2.2-i2v-flash access. The documented legacy Singapore endpoint is still functional; workspace-specific migration is a future option.
- `FAL_KEY`: opening-image generation only. Not needed by the engine for uploaded images, and uploaded-reference quotes/starts do not require FAL_KEY. Text-only quotes remain disabled without it.
- `LONG_DATA_DIR`: durable private directory, default `./long-video-data`. Store/backup outside the git checkout; contains private prompts, references and outputs. No auto-deletion is enabled; set a retention/disk monitoring policy before launch.
- `LONG_VIDEO_ENABLED=true`: enable only after access, commercial terms and owner spending consent have been reviewed. This is a deployment gate, not consent for a particular job.
- `LONG_MEDIA_EUR`: measured/quoted processing, storage and transfer cost allocated to one complete job. Unknown must stay unset, never invented as zero.
- `LONG_FX_PERCENT` and `LONG_VAT_PERCENT`: actual applicable conversion/tax scenario; explicit zero permitted only if verified applicable. These are estimates, not tax advice or an invoice guarantee.
- `PORT`: loopback listener port, default 8788.

Worker configuration: `LONG_VIDEO_SERVICE_URL` is the HTTPS origin for that private service; `LONG_VIDEO_SERVICE_SECRET` is a secret. Existing `VIDEO_TEST_EMAIL` selects the owner. The public staging origin is configured in wrangler.toml. The shared credential must be configured separately in Cloudflare secrets; it is never committed. Without them, the quote endpoint shows API costs but reports unknown total and blocks generation.

Each job quote expires after 15 minutes and binds the immutable prompt/reference/ratio/resolution and server costs. A billable start requires explicit `approved: true` and exact `approvedTotalEUR`. The engine does not authorize new POSTs after the job approval is 24 hours old. This price snapshot disables new starts after 2026-10-21; review provider rates and FX before extending it. A quote is a list-price estimate, not a hard guarantee of the bank invoice. `reservedAPIUSD` is conservative potential exposure including ambiguous submissions, not audited money spent.

The service persists `submitting` before every paid POST, then records returned task IDs before further work. Restart can resume polling with a known ID. A crash between POST and persisted ID becomes uncertain and blocks further starts globally; reconcile the provider console and the same manifest manually. Do not reset the job or delete a lock to retry a paid request. After an ungraceful process exit the disk singleton lock intentionally survives: verify no other process is using the directory before removing it. Use one instance, never shared-volume horizontal replicas.

Current limitations: no cancellation UI, no automatic face verification or scene planner/translation, no speech, no independent identity-reference input on later segments, no public paid credits, no object storage migration or distributed scaling. Original opening image and immutable character text are retained; later I2V calls condition on the last rendered frame. This can drift. FFmpeg verifies duration, not semantic quality. Inspect a real approved sample before enabling general use.

Routes (service credential + `X-KurdAI-Owner` required): POST `/v1/quote`, POST `/v1/start`, GET `/v1/jobs`, GET `/v1/status?id=...`, GET `/v1/file?id=...`. Status/refresh never submit paid jobs. Background timer continues an already approved job even when the browser closes.


## Free operational verification and managed-host readiness

Startup checks local ffmpeg, ffprobe and libx264 before acquiring the processor lock. GET /healthz is a loopback/container health check with no job, owner or credential data; the Docker health check uses PORT. Authenticated GET /v1/health reports provider/config readiness without making any provider call. Worker GET /api/long/capabilities forwards this for the verified owner; when the processor is absent it names missing Worker settings without secret values. A reachable processor does not prove provider access, Kurdish speech or video quality.

A free end-to-end integration test now drives the Worker proxy, actual private HTTP service, immutable quote/approval, fourteen synthetic provider tasks, real FFmpeg and authenticated MP4 download. It checks 70-second duration, owner isolation and replay without another submission. All external provider traffic is forbidden in that test. This is not a real AI sample.

For durable Render production (not provisioned): connect the repository as a Docker web service with Docker context repository root and Dockerfile processor/Dockerfile. Use one instance, an attached persistent disk at /data, LONG_DATA_DIR=/data, PROCESSOR_BIND_HOST=0.0.0.0, platform PORT, and health path /healthz. Keep LONG_VIDEO_ENABLED=false until provider access and full per-job processing/FX/tax costs are verified. Put credentials only in the host secret settings. Copy no secrets into files or chat. Do not use a free ephemeral filesystem for paid jobs: losing a task ID could lead to duplicate charges on manual retries. Render's durable-disk service is billable and must not be provisioned before separate owner cost approval. The Docker image build and deployment succeeded on Render. Local Docker remains unavailable.

Official references: https://render.com/docs/web-services , https://render.com/docs/disks , https://render.com/docs/free , https://render.com/pricing . A free staging web service was created; no paid resource, disk or subscription was purchased.

## Render staging verification — 2026-10-14

- Service: https://kurdai-processor-staging.onrender.com
- Dashboard: https://dashboard.render.com/web/srv-db7si6bl550s73d6l360
- Repository: Kurdai7/kurdai, main; Docker context `.`; Dockerfile `processor/Dockerfile`; Frankfurt; plan `free`; automatic Git deployment enabled.
- Initial deploy `dep-db7si73l550s73d6l7pg` reached `live` on source commit `2982f4c19eefb5b2c5934e443d0f36a057eaa368`.
- Public HTTPS /healthz returned 200 and verified FFmpeg, ffprobe and libx264 in the deployed image.
- LONG_VIDEO_ENABLED=false. No provider credentials or invented zero hosting/tax costs were supplied. /data is ephemeral on this free service: no paid AI jobs may run here.
- Shared authentication credential is stored only in Render environment settings. To connect Worker diagnostics, securely copy LONG_VIDEO_SERVICE_SECRET from this service's Environment panel into Cloudflare Worker kurdai → Settings → Variables and Secrets as a Secret with the identical name, then deploy. Never paste it in chat or git. Worker origin is configured by wrangler.toml; the generation gate stays disabled on Render.
- Cloudflare Dashboard access is not available in this assistant session, so secure credential wiring and authenticated kurdai.net → Render verification remain pending.
- Durable disk hosting, applicable costs, provider access and an explicit per-job approval remain necessary before real AI generation. Sorani/Badini TTS and identity/voice consistency are not verified.

Deployed authorization check: GET /v1/health without credentials returned 401; with the Render-only shared credential and deployment-check owner it returned 200. Both start capabilities and both Kurdish audio capabilities were false, provider credentials absent, and missing costs explicitly named. paidProviderProbe=false. No provider request was issued.

## Free staging cold-start diagnostics — 2026-10-14

A user readiness request reported unreachable. Direct Render HTTPS health subsequently returned 200 with all media tools available (approximately 20 seconds); this does not independently prove the Worker shared credential is correct. Free instances can sleep and take over 50 seconds to wake. Worker readiness previously stopped at 30 seconds: GET /api/long/capabilities now allows 90 seconds and the UI displays a waiting message. Paid POSTs keep their 30-second limit and are never automatically retried. An explicit readiness timeout explains how to repeat only the free check. The deployed Cloudflare-to-Render check still needs to be repeated through the signed-in UI.

## 60-second option and owner diagnostics — 2026-10-14

The browser defaults to 60 seconds; 70 remains selectable. Every new UI quote sends an explicit duration, bound into the immutable approval. Twelve five-second clips produce a verified 60-second MP4, while old persisted 70-second jobs retain fourteen clips. Real local HTTP/FFmpeg integration tests exercise both complete durations using synthetic providers only; both aspect ratios also pass synthetic 60/70-second mux checks.

60s list-price API costs: uploaded opening image $0.900 at 480p or $2.160 at 720p; text-generated opening image adds $0.003. EUR uses the dated exchange-rate snapshot; processing, tax and FX fees remain required and unknown costs block starts. No retail markup. This is not an exact provider invoice or an approved charge.

Authenticated processor readiness reports supported outputDurations and protocolVersion=3. The browser rejects a quote with a different duration, keeping an older Render deployment from silently producing or billing 70 seconds for a 60-second selection.

Cloudflare validates service credential format before fetch, removes incidental leading/trailing copy whitespace, reports authentication rejection separately, and returns a secret-free network diagnostic code/version. No raw transport exception, secret or credential header is exposed. User readiness still reported unreachable after the cold-start patch; the actual Worker-to-Render cause remains unverified. A new signed-in readiness result is needed.

## Workers transport root cause confirmed — 2026-10-14

The previous network error was reproduced inside actual local workerd: `redirect: "error"` throws TypeError before any outbound request. Its error explicitly requires `follow` or `manual`. The Worker proxy now uses `manual` and rejects every 3xx without forwarding the credential, redirect body or Location. A real Miniflare/workerd regression test exercises the bundled production handler against an injected upstream and verifies readiness success and blocked redirects. No real provider call occurs. The local binary supports compatibility through 2026-09-25, used only by this test; the production compatibility date remains unchanged. This corrects a confirmed runtime bug; the signed-in production check must still establish the actual Cloudflare/Render credential match.

## Structured processor diagnostics — 2026-10-14

PROCESSOR_DIAGNOSTICS=true enables only fixed event names, allowlisted method/route and sanitized error class/code. It logs no raw exceptions, headers, owner IDs, query strings, bodies or prompts. This operational setting is being applied to free staging to diagnose the user's new generic processor failure after fixing Worker transport. Generation remains false. Empty quotes are validated at the Worker before fetch and at the processor before persistence; JSON/input failures now have explicit 400 responses, while unexpected failures have PROCESSOR_INTERNAL_ERROR/500. Public health advertises only protocolVersion=3 and supported duration numbers so the deployed revision's duration support can be checked without credentials. No paid-provider probe is involved. The new user error's exact server cause has not yet been identified; an empty quote reproduces the old generic message but that does not establish what the user clicked.

## Omni voiced pipeline checkpoint — 2026-10-14

The owner's primary requested model is Gemini Omni 1.1 Flash. `omni.js` implements the documented Interactions REST request and raw `steps` output schema, text/image references, separate Sorani/Badini instructions, retained interaction state, Google file polling/download and strict origin/redirect checks. `omni-engine.js` implements a persisted 5–70-second orchestration in five-second steps, with submission-before-POST markers, uncertain-request blocking and explicit Omni-specific approval/budget validation. Five new offline tests exercise transport restrictions, language/reference inputs, 60/70-second orchestration and real FFmpeg audio preservation. No real Gemini call was sent.

**This is an experimental internal implementation, not a live website feature.** It is deliberately not routed from `server.js` or selected in the UI yet. The complete Omni token/context pricing and immutable quote integration, dialogue allocation/UI, durable host storage, deployed pipeline verification and separately approved real generation remain outstanding. WAN list prices must never approve an Omni job. The current official 720p output meter is 5,792 tokens/second at $17.50/million tokens; input/context and text output have additional meters. See https://ai.google.dev/gemini-api/docs/pricing and https://ai.google.dev/gemini-api/docs/omni . This is a cost estimate basis, not an invoice or proof of identity/voice consistency.

Native audio is retained in `normalizeVoiced`/`assembleVoiced`; a missing audio track stops processing rather than presenting silent output as voiced. Five-second length is prompt requested, not an invented API parameter. Returned duration is checked, longer continuation outputs are trimmed to their requested tail, and short outputs fail without a paid retry. Real model continuity, dialect quality, voice consistency and continuation-output semantics remain untested; synthetic tests cannot prove them. User-reported Sorani success in Flow is accepted, but the API deployment has not been tested with paid generation.

Render deploy `dep-db7u3mmi0phs73cpt0l0`, source `4191edca`, has a successful build event but remains `build_in_progress`; the API reports no deploy-start event or reason. The older source `52ada29` is still live. Do not claim this checkpoint or the diagnostic revision is deployed until public health and authenticated readiness establish it.
