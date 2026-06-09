#!/usr/bin/env bash
set -Eeuo pipefail

# Roll back JadeAI to previous-image.txt in the current compose directory.
# Usage: ./rollback.sh <container_name> <health_url>

log() { printf '[%s] %s\n' "$(date '+%Y-%m-%dT%H:%M:%S%z')" "$*"; }
fail() { log "ERROR: $*"; exit 1; }

APP_NAME="${1:-}"
HEALTH_URL="${2:-}"
[[ -n "$APP_NAME" ]] || fail "missing container name"
[[ -n "$HEALTH_URL" ]] || fail "missing health url"
[[ -f docker-compose.yml ]] || fail "docker-compose.yml not found in $(pwd)"
[[ -f .env ]] || fail ".env not found in $(pwd)"

OLD_IMAGE="$(cat previous-image.txt 2>/dev/null || true)"
[[ -n "$OLD_IMAGE" ]] || fail "No previous image found."

log "rollback to: $OLD_IMAGE"
cp .env ".env.rollback.bak.$(date +%Y%m%d%H%M%S)"

if grep -q '^JADEAI_IMAGE=' .env; then
  sed -i "s#^JADEAI_IMAGE=.*#JADEAI_IMAGE=$OLD_IMAGE#" .env
else
  printf '\nJADEAI_IMAGE=%s\n' "$OLD_IMAGE" >> .env
fi

if [[ "$OLD_IMAGE" =~ :([^/:]+)$ ]]; then
  old_tag="${BASH_REMATCH[1]}"
  if grep -q '^APP_VERSION=' .env; then
    sed -i "s#^APP_VERSION=.*#APP_VERSION=$old_tag#" .env
  else
    printf 'APP_VERSION=%s\n' "$old_tag" >> .env
  fi
fi

compose=(docker compose --env-file .env -f docker-compose.yml)
if docker image inspect "$OLD_IMAGE" >/dev/null 2>&1; then
  log "rollback image already exists locally; skip pull"
else
  "${compose[@]}" pull jadeai || true
fi
"${compose[@]}" up -d jadeai
printf '%s\n' "$OLD_IMAGE" > current-image.txt

health_timeout="${HEALTH_TIMEOUT:-120}"
if ! [[ "$health_timeout" =~ ^[0-9]+$ ]]; then
  health_timeout=120
fi

deadline=$((SECONDS + health_timeout))
while (( SECONDS < deadline )); do
  if curl -fsS --max-time 10 -H 'Cache-Control: no-cache' -H 'Pragma: no-cache' "$HEALTH_URL" >/dev/null; then
    log "rollback health check passed"
    exit 0
  fi
  sleep 5
done

log "container logs after failed rollback health check"
docker logs --tail 160 "$APP_NAME" || true
fail "rollback health check failed"
