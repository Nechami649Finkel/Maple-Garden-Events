# Stage 1: build React app
FROM node:20-bookworm-slim AS build

WORKDIR /app/client

ENV npm_config_strict_ssl=false

COPY client/package.json client/package-lock.json ./
RUN npm ci

COPY client/ ./
COPY shared /app/shared

ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_API_URL=/api
ARG VITE_SENTRY_DSN
ARG VITE_SENTRY_TRACES_SAMPLE_RATE
ARG VITE_TENANT_NAME
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN
ENV VITE_SENTRY_TRACES_SAMPLE_RATE=$VITE_SENTRY_TRACES_SAMPLE_RATE
ENV VITE_TENANT_NAME=$VITE_TENANT_NAME

RUN npx vite build

# Stage 2: nginx serves static files + proxies API
FROM nginx:stable-alpine

RUN rm -rf /usr/share/nginx/html/*
COPY --from=build /app/client/dist /usr/share/nginx/html
COPY routing/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
