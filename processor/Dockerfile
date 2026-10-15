FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY spending.js ./spending.js
COPY long-video.js ./long-video.js
COPY omni-cost.js ./omni-cost.js
COPY dialogue.js ./dialogue.js
COPY package.json ./package.json
COPY processor ./processor
ENV LONG_DATA_DIR=/data
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8788)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Keep the processor private behind authenticated HTTPS ingress. Secrets are host env, never image layers.
CMD ["node", "processor/server.js"]
