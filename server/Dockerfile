# Build context must be the project ROOT (not server/)
# docker build -f server/Dockerfile -t maple-server .

# ─── Stage 1: install dependencies ───────────────────────────────────────────
FROM node:22-alpine AS deps

WORKDIR /app

RUN apk add --no-cache curl ca-certificates && \
    curl -o /usr/local/share/ca-certificates/netfree-ca.crt https://netfree.link/cacert/united/x2/root_ca_x2_bundle.crt && \
    update-ca-certificates

ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV npm_config_strict_ssl=false

COPY server/package.json server/package-lock.json ./

RUN npm ci --frozen-lockfile --ignore-scripts

# ─── Stage 2: build (compile TypeScript + generate Prisma client) ─────────────
FROM node:22-alpine AS builder

WORKDIR /app

RUN apk add --no-cache curl ca-certificates && \
    curl -o /usr/local/share/ca-certificates/netfree-ca.crt https://netfree.link/cacert/united/x2/root_ca_x2_bundle.crt && \
    update-ca-certificates

ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt
ENV npm_config_strict_ssl=false

COPY --from=deps /app/node_modules ./node_modules

# Copy server source
COPY server/ ./

# Map shared/ → src/vendor/shared so imports resolve correctly
COPY shared ./src/vendor/shared

RUN DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy npx prisma generate && npx tsc

# ─── Stage 3: production ──────────────────────────────────────────────────────
# Use Alpine to match the builder so the same Prisma musl binary works at runtime
FROM node:22-alpine AS production

WORKDIR /app

RUN apk add --no-cache curl ca-certificates chromium nss freetype harfbuzz ttf-freefont fontconfig && \
    curl -k -o /usr/local/share/ca-certificates/netfree-ca.crt \
        https://netfree.link/cacert/united/x2/root_ca_x2_bundle.crt && \
    update-ca-certificates

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV NODE_ENV=production
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt
ENV npm_config_strict_ssl=false

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY server/package.json server/prisma.config.ts ./

EXPOSE 5000

CMD ["node", "dist/server.js"]
