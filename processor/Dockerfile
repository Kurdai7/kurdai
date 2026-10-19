FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY spending.js ./spending.js
COPY billing.js video-credits.js auth-guard.js ./
COPY long-video.js ./long-video.js
COPY omni-cost.js native-candidate-cost.js ./
COPY dialogue.js ./dialogue.js
COPY ltx-evaluation.js ./ltx-evaluation.js
COPY ltx-speech-adapter.js ./ltx-speech-adapter.js
COPY ltx-provider.js ./ltx-provider.js
COPY processor ./processor
COPY scripts/pruna-preflight.js ./scripts/pruna-preflight.js
ENV LONG_DATA_DIR=/data
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8788)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Keep the processor private behind authenticated HTTPS ingress. Secrets are host env, never image layers.
CMD ["node", "processor/server.js"]
