# syntax=docker/dockerfile:1

# --- Client build ---
FROM node:20-bookworm-slim AS client-build
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
ARG VITE_GOOGLE_CLIENT_ID=
ARG VITE_API_URL=
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# --- Server build ---
FROM node:20-bookworm-slim AS server-build
WORKDIR /app
COPY shared ./shared
COPY server/package.json server/package-lock.json ./server/
WORKDIR /app/server
RUN npm ci
COPY server/prisma ./prisma
COPY server/tsconfig.json ./
COPY server/scripts ./scripts
COPY server/src ./src
RUN npx prisma generate
RUN npm run build

# --- Production image ---
FROM node:20-bookworm-slim AS production

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    fonts-noto-color-emoji \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=5000
ENV SERVE_CLIENT=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

WORKDIR /app/server

COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev
COPY server/prisma ./prisma
RUN npx prisma generate

COPY --from=server-build /app/server/dist ./dist
COPY --from=client-build /app/client/dist ../client/dist

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/server.js"]
