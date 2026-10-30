#!/usr/bin/env bash
set -euo pipefail

: "${AUTH_SECRET:?AUTH_SECRET is required. Generate one with openssl rand -base64 32.}"
: "${DATA_ENCRYPTION_KEY:?DATA_ENCRYPTION_KEY is required. Generate one with openssl rand -base64 32.}"

JADEAI_IMAGE="${JADEAI_IMAGE:-ghcr.io/talexdreamsoul/jadeai-resume:production-latest}"

docker rm -f jadeai 2>/dev/null || true

docker run -d \
  --name jadeai \
  --platform linux/amd64 \
  -p 3003:3000 \
  --env AUTH_SECRET \
  --env DATA_ENCRYPTION_KEY \
  --env ADMIN_EMAIL \
  --env ADMIN_PASSWORD \
  -v "${PWD}/touchresume-data:/app/data" \
  "$JADEAI_IMAGE"
