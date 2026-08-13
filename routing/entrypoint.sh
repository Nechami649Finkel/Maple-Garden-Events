#!/bin/sh
set -e

if [ -z "$DOMAIN" ]; then
  echo "ERROR: DOMAIN env var is not set" >&2
  exit 1
fi

CERT="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"

if [ -f "$CERT" ]; then
  echo "SSL certificate found — starting with HTTPS"
  envsubst '${DOMAIN}' < /etc/nginx/templates/ssl.conf.template > /etc/nginx/conf.d/default.conf
else
  echo "No SSL certificate found — starting with HTTP only (run ssl.yml to get a certificate)"
  envsubst '${DOMAIN}' < /etc/nginx/templates/http.conf.template > /etc/nginx/conf.d/default.conf
fi

exec nginx -g "daemon off;"
