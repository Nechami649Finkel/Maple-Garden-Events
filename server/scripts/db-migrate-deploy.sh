#!/usr/bin/env bash
# Apply Prisma migrations safely for local, CI, and App Runner.
#
# Behavior:
# - Fresh empty database → `prisma migrate deploy` creates the full schema.
# - Existing database that already matches schema.prisma but has no Migrate
#   history → baseline the init migration (mark applied, do not re-CREATE).
# - Existing managed database → apply any pending migrations only.
#
# Fail-closed: if the live DB drifts from schema.prisma and has no history,
# this script exits with an error instead of baselining (avoids silent data loss).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BASELINE_MIGRATION="${PRISMA_BASELINE_MIGRATION:-20260725215013_init}"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is required for migrate deploy." >&2
  exit 1
fi

echo "==> Prisma migrate status"
STATUS_OUT="$(npx prisma migrate status 2>&1 || true)"
echo "$STATUS_OUT"

needs_baseline=0
if echo "$STATUS_OUT" | grep -qi "No migration found in prisma/migrations"; then
  echo "ERROR: prisma/migrations is empty in this image/checkout." >&2
  exit 1
fi
if echo "$STATUS_OUT" | grep -qi "not managed by Prisma Migrate"; then
  needs_baseline=1
fi
if echo "$STATUS_OUT" | grep -qi "have not yet been applied"; then
  # Pending migrations are fine — deploy will apply them. Only baseline when
  # the datasource has never been managed.
  :
fi

if [ "$needs_baseline" -eq 1 ]; then
  echo "==> Database is not managed by Prisma Migrate yet."
  echo "==> Checking that live schema matches schema.prisma before baselining…"
  DIFF_OUT="$(npx prisma migrate diff \
    --from-url "$DATABASE_URL" \
    --to-schema-datamodel prisma/schema.prisma \
    --script 2>&1 || true)"
  echo "$DIFF_OUT"

  if ! echo "$DIFF_OUT" | grep -qi "This is an empty migration"; then
    echo "" >&2
    echo "ERROR: Live database does not match schema.prisma." >&2
    echo "Cannot safely baseline ${BASELINE_MIGRATION}." >&2
    echo "Sync the database (or fix schema.prisma), then re-run." >&2
    echo "For one-off ops: npx prisma migrate resolve --applied ${BASELINE_MIGRATION}" >&2
    exit 1
  fi

  echo "==> Schema matches. Baselining ${BASELINE_MIGRATION} as already applied…"
  npx prisma migrate resolve --applied "$BASELINE_MIGRATION"
fi

echo "==> prisma migrate deploy"
npx prisma migrate deploy
echo "==> Migrations complete."
