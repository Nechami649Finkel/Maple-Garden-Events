#!/usr/bin/env bash
# App Runner / Docker entrypoint: migrate then serve traffic.
set -euo pipefail

cd /app/server

echo "[entrypoint] Applying database migrations…"
bash scripts/db-migrate-deploy.sh

echo "[entrypoint] Starting API (PORT=${PORT:-5000})…"
exec node dist/server.js
