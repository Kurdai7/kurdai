FROM node:24-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Verify without runtime credentials or provider requests before producing the runtime image.
FROM base AS verification
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run check && npm test && npm run build && touch /tmp/kurdai-verified

FROM base AS runtime
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY --from=verification /tmp/kurdai-verified /app/.kurdai-verified
COPY spending.js ./spending.js
COPY billing.js billing-packs.js video-credits.js auth-guard.js ./
COPY long-video.js video-access.js ./
COPY omni-cost.js native-candidate-cost.js ./
COPY dialogue.js ./dialogue.js
COPY ltx-evaluation.js ./ltx-evaluation.js
COPY ltx-speech-adapter.js ./ltx-speech-adapter.js
COPY ltx-provider.js ./ltx-provider.js
COPY processor ./processor
COPY scripts/pruna-preflight.js ./scripts/pruna-preflight.js
ENV LONG_DATA_DIR=/data
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8788)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "processor/server.js"]
