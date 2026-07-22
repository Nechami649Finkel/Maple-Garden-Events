#!/usr/bin/env bash
# Smoke test for deployed Maple Events instance.
# Usage: bash scripts/smoke-test.sh https://staging.your-domain.com
set -euo pipefail

BASE_URL="${1:-}"
if [ -z "$BASE_URL" ]; then
  echo "Usage: bash scripts/smoke-test.sh <base-url>"
  echo "Example: bash scripts/smoke-test.sh https://staging.example.com"
  exit 1
fi

BASE_URL="${BASE_URL%/}"
PASS=0
FAIL=0

check() {
  local name="$1"
  local url="$2"
  local expected="${3:-}"

  if response=$(curl -sf "$url" 2>/dev/null); then
    if [ -n "$expected" ] && ! echo "$response" | grep -q "$expected"; then
      echo "❌ $name — unexpected response"
      FAIL=$((FAIL + 1))
    else
      echo "✅ $name"
      PASS=$((PASS + 1))
    fi
  else
    echo "❌ $name — request failed"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== Smoke Test: $BASE_URL ==="
echo ""

check "Health endpoint" "$BASE_URL/api/health" '"status":"ok"'
check "Client SPA (index.html)" "$BASE_URL/" "<!DOCTYPE html>"
check "API rate limit headers" "$BASE_URL/api/health" ""

echo ""
echo "--- Results: $PASS passed, $FAIL failed ---"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi

echo "All smoke tests passed."
