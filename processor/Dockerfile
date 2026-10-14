FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY long-video.js ./long-video.js
COPY dialogue.js ./dialogue.js
COPY package.json ./package.json
COPY processor ./processor
ENV LONG_DATA_DIR=/data
# Keep the processor private behind authenticated HTTPS ingress. Secrets are host env, never image layers.
CMD ["node", "processor/server.js"]
