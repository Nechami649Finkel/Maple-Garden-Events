# syntax=docker/dockerfile:1

# --- Client build ---
FROM node:20-bookworm-slim AS client-build
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY client/package.json ./client/
COPY server/package.json ./server/
RUN npm ci --workspace=client --workspace=@maple/shared --include-workspace-root=false
COPY shared ./shared
COPY client ./client
ARG VITE_GOOGLE_CLIENT_ID=
ARG VITE_API_URL=
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build -w client

# --- Server build ---
FROM node:20-bookworm-slim AS server-build
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY client/package.json ./client/
COPY server/package.json ./server/
RUN npm ci --workspace=server --workspace=@maple/shared --include-workspace-root=false
COPY shared ./shared
COPY server/prisma ./server/prisma
COPY server/tsconfig.json ./server/
COPY server/scripts ./server/scripts
COPY server/src ./server/src
WORKDIR /app/server
ENV DATABASE_URL=postgresql://prisma:prisma@127.0.0.1:5432/prisma
RUN npx prisma generate && npm run build

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

WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY client/package.json ./client/
COPY server/package.json ./server/
# prisma CLI is a production dependency on server for migrate deploy
RUN npm ci --omit=dev --workspace=server --workspace=@maple/shared --include-workspace-root=false

COPY shared ./shared
RUN npm run build -w @maple/shared

COPY server/prisma ./server/prisma
COPY server/scripts/db-migrate-deploy.sh ./server/scripts/db-migrate-deploy.sh
COPY server/scripts/docker-entrypoint.sh ./server/scripts/docker-entrypoint.sh
RUN chmod +x ./server/scripts/db-migrate-deploy.sh ./server/scripts/docker-entrypoint.sh \
  && cd server && npx prisma generate

COPY --from=server-build /app/server/dist ./server/dist
COPY --from=client-build /app/client/dist ./client/dist

WORKDIR /app/server

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["bash", "./scripts/docker-entrypoint.sh"]
