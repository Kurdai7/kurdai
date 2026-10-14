# Private 70-second processor (not deployed)

The Worker authenticates the existing verified owner, then forwards only `/api/long/*` to this private Node service over HTTPS. Node owns durable files, billable task IDs, serial execution and FFmpeg. Ordinary Workers cannot run this FFmpeg executable. Keep this separate from the existing Veo workflow.

Runtime: Node 24+, `ffmpeg` and `ffprobe` with libx264, durable disk, a single processor instance per disk, private TLS ingress/proxy. `processor/Dockerfile` is a build recipe; the image has not been built or deployed. The HTTP listener defaults to loopback; deploy behind a TLS proxy in the same network namespace. A managed Docker web service may explicitly set PROCESSOR_BIND_HOST=0.0.0.0 so its HTTPS ingress can reach PORT. All /v1 routes still require the service credential and owner header. There are no new npm runtime dependencies. `npm run processor` starts the service after the operator has configured it. Do not purchase hosting or enable paid providers without owner approval.

Host environment (values must be configured in host secret/config settings, never chat/git):

- `LONG_VIDEO_SERVICE_SECRET`: random shared credential, at least 32 characters; set the same secret in the Worker.
- `DASHSCOPE_API_KEY`: Singapore/international Model Studio account with wan2.2-i2v-flash access. The documented legacy Singapore endpoint is still functional; workspace-specific migration is a future option.
- `FAL_KEY`: opening-image generation only. Not needed by the engine for uploaded images, and uploaded-reference quotes/starts do not require FAL_KEY. Text-only quotes remain disabled without it.
- `LONG_DATA_DIR`: durable private directory, default `./long-video-data`. Store/backup outside the git checkout; contains private prompts, references and outputs. No auto-deletion is enabled; set a retention/disk monitoring policy before launch.
- `LONG_VIDEO_ENABLED=true`: enable only after access, commercial terms and owner spending consent have been reviewed. This is a deployment gate, not consent for a particular job.
- `LONG_MEDIA_EUR`: measured/quoted processing, storage and transfer cost allocated to one complete job. Unknown must stay unset, never invented as zero.
- `LONG_FX_PERCENT` and `LONG_VAT_PERCENT`: actual applicable conversion/tax scenario; explicit zero permitted only if verified applicable. These are estimates, not tax advice or an invoice guarantee.
- `PORT`: loopback listener port, default 8788.

Worker configuration: `LONG_VIDEO_SERVICE_URL` is the HTTPS origin for that private service; `LONG_VIDEO_SERVICE_SECRET` is a secret. Existing `VIDEO_TEST_EMAIL` selects the owner. These bindings are intentionally absent from wrangler.toml until a concrete service is available. Without them, the quote endpoint shows API costs but reports unknown total and blocks generation.

Each job quote expires after 15 minutes and binds the immutable prompt/reference/ratio/resolution and server costs. A billable start requires explicit `approved: true` and exact `approvedTotalEUR`. The engine does not authorize new POSTs after the job approval is 24 hours old. This price snapshot disables new starts after 2026-10-21; review provider rates and FX before extending it. A quote is a list-price estimate, not a hard guarantee of the bank invoice. `reservedAPIUSD` is conservative potential exposure including ambiguous submissions, not audited money spent.

The service persists `submitting` before every paid POST, then records returned task IDs before further work. Restart can resume polling with a known ID. A crash between POST and persisted ID becomes uncertain and blocks further starts globally; reconcile the provider console and the same manifest manually. Do not reset the job or delete a lock to retry a paid request. After an ungraceful process exit the disk singleton lock intentionally survives: verify no other process is using the directory before removing it. Use one instance, never shared-volume horizontal replicas.

Current limitations: no cancellation UI, no automatic face verification or scene planner/translation, no speech, no independent identity-reference input on later segments, no public paid credits, no object storage migration or distributed scaling. Original opening image and immutable character text are retained; later I2V calls condition on the last rendered frame. This can drift. FFmpeg verifies duration, not semantic quality. Inspect a real approved sample before enabling general use.

Routes (service credential + `X-KurdAI-Owner` required): POST `/v1/quote`, POST `/v1/start`, GET `/v1/jobs`, GET `/v1/status?id=...`, GET `/v1/file?id=...`. Status/refresh never submit paid jobs. Background timer continues an already approved job even when the browser closes.


## Free operational verification and managed-host readiness

Startup checks local ffmpeg, ffprobe and libx264 before acquiring the processor lock. GET /healthz is a loopback/container health check with no job, owner or credential data; the Docker health check uses PORT. Authenticated GET /v1/health reports provider/config readiness without making any provider call. Worker GET /api/long/capabilities forwards this for the verified owner; when the processor is absent it names missing Worker settings without secret values. A reachable processor does not prove provider access, Kurdish speech or video quality.

A free end-to-end integration test now drives the Worker proxy, actual private HTTP service, immutable quote/approval, fourteen synthetic provider tasks, real FFmpeg and authenticated MP4 download. It checks 70-second duration, owner isolation and replay without another submission. All external provider traffic is forbidden in that test. This is not a real AI sample.

For Render (not created or deployed): connect the repository as a Docker web service with Docker context repository root and Dockerfile processor/Dockerfile. Use one instance, an attached persistent disk at /data, LONG_DATA_DIR=/data, PROCESSOR_BIND_HOST=0.0.0.0, platform PORT, and health path /healthz. Keep LONG_VIDEO_ENABLED=false until provider access and full per-job processing/FX/tax costs are verified. Put credentials only in the host secret settings. Copy no secrets into files or chat. Do not use a free ephemeral filesystem for paid jobs: losing a task ID could lead to duplicate charges on manual retries. Render's durable-disk service is billable and must not be provisioned before separate owner cost approval. Container image build is unverified here because Docker is unavailable in this workspace.

Official references: https://render.com/docs/web-services , https://render.com/docs/disks , https://render.com/docs/free , https://render.com/pricing . No Render resource, disk, subscription or contract was created.
