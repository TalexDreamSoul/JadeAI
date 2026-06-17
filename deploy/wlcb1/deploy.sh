#!/usr/bin/env bash
set -Eeuo pipefail

# Deploy a JadeAI GHCR image with docker compose, health check, rollback, and local image cleanup.
# Usage: ./deploy.sh <image> <container_name> <health_url> [retain_count]

log() { printf '[%s] %s\n' "$(date '+%Y-%m-%dT%H:%M:%S%z')" "$*"; }
fail() { log "ERROR: $*"; exit 1; }

NEW_IMAGE="${1:-}"
APP_NAME="${2:-}"
HEALTH_URL="${3:-}"
RETAIN_COUNT="${4:-5}"

[[ -n "$NEW_IMAGE" ]] || fail "missing image"
[[ -n "$APP_NAME" ]] || fail "missing container name"
[[ -n "$HEALTH_URL" ]] || fail "missing health url"
[[ "$NEW_IMAGE" == ghcr.io/* ]] || fail "image must be from ghcr.io: $NEW_IMAGE"
[[ "$RETAIN_COUNT" =~ ^[0-9]+$ ]] || fail "retain count must be numeric: $RETAIN_COUNT"

command -v docker >/dev/null 2>&1 || fail "docker is not installed"
command -v curl >/dev/null 2>&1 || fail "curl is not installed"

if ! docker compose version >/dev/null 2>&1; then
  fail "docker compose plugin is not available"
fi

[[ -f docker-compose.yml ]] || fail "docker-compose.yml not found in $(pwd)"
[[ -f .env ]] || fail ".env not found in $(pwd)"

compose=(docker compose --env-file .env -f docker-compose.yml)

CURRENT_IMAGE="$(docker inspect "$APP_NAME" --format='{{.Config.Image}}' 2>/dev/null || true)"
if [[ -n "$CURRENT_IMAGE" ]]; then
  log "current image: $CURRENT_IMAGE"
  printf '%s\n' "$CURRENT_IMAGE" > previous-image.txt
else
  log "no current container found for $APP_NAME"
fi

cp .env ".env.bak.$(date +%Y%m%d%H%M%S)"

# Update only deployment metadata. Keep secrets and runtime config untouched.
if grep -q '^JADEAI_IMAGE=' .env; then
  sed -i "s#^JADEAI_IMAGE=.*#JADEAI_IMAGE=$NEW_IMAGE#" .env
else
  printf '\nJADEAI_IMAGE=%s\n' "$NEW_IMAGE" >> .env
fi

if [[ "$NEW_IMAGE" =~ :([^/:]+)$ ]]; then
  new_tag="${BASH_REMATCH[1]}"
else
  new_tag="$NEW_IMAGE"
fi
if grep -q '^APP_VERSION=' .env; then
  sed -i "s#^APP_VERSION=.*#APP_VERSION=$new_tag#" .env
else
  printf 'APP_VERSION=%s\n' "$new_tag" >> .env
fi

if [[ -n "${COMMIT_SHA:-}" ]]; then
  if grep -q '^GIT_SHA=' .env; then
    sed -i "s#^GIT_SHA=.*#GIT_SHA=$COMMIT_SHA#" .env
  else
    printf 'GIT_SHA=%s\n' "$COMMIT_SHA" >> .env
  fi
fi

printf '%s\n' "$NEW_IMAGE" > current-image.txt

log "pulling image: $NEW_IMAGE"
if [[ "${SKIP_PULL:-0}" == "1" ]]; then
  log "SKIP_PULL=1; skip docker compose pull"
elif docker image inspect "$NEW_IMAGE" >/dev/null 2>&1; then
  log "image already exists locally; skip docker compose pull"
else
  "${compose[@]}" pull jadeai
fi

log "starting service"
"${compose[@]}" up -d --no-deps --force-recreate jadeai
"${compose[@]}" up -d --no-deps --force-recreate jadeai-worker

log "waiting for service health: $HEALTH_URL"
health_timeout="${HEALTH_TIMEOUT:-120}"
if ! [[ "$health_timeout" =~ ^[0-9]+$ ]]; then
  health_timeout=120
fi

deadline=$((SECONDS + health_timeout))
healthy=false
while (( SECONDS < deadline )); do
  if curl -fsS --max-time 10 -H 'Cache-Control: no-cache' -H 'Pragma: no-cache' "$HEALTH_URL" >/tmp/jadeai-health.json 2>/tmp/jadeai-health.err; then
    if [[ -n "${COMMIT_SHA:-}" ]]; then
      live_commit="$(sed -n 's/.*"commit"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' /tmp/jadeai-health.json | head -1)"
      if [[ "$live_commit" == "$COMMIT_SHA" ]]; then
        healthy=true
        break
      fi
      log "health ok but commit mismatch: live=${live_commit:-<empty>} expected=$COMMIT_SHA"
    else
      healthy=true
      break
    fi
  else
    log "waiting for health endpoint..."
  fi
  sleep 5
done

if [[ "$healthy" != "true" ]]; then
  log "health check failed; rolling back"
  docker logs --tail 160 "$APP_NAME" || true

  OLD_IMAGE="$(cat previous-image.txt 2>/dev/null || true)"
  if [[ -z "$OLD_IMAGE" ]]; then
    fail "no previous image found; cannot rollback"
  fi

  if grep -q '^JADEAI_IMAGE=' .env; then
    sed -i "s#^JADEAI_IMAGE=.*#JADEAI_IMAGE=$OLD_IMAGE#" .env
  else
    printf 'JADEAI_IMAGE=%s\n' "$OLD_IMAGE" >> .env
  fi
  if [[ "$OLD_IMAGE" =~ :([^/:]+)$ ]]; then
    old_tag="${BASH_REMATCH[1]}"
    if grep -q '^APP_VERSION=' .env; then
      sed -i "s#^APP_VERSION=.*#APP_VERSION=$old_tag#" .env
    fi
  fi

  if docker image inspect "$OLD_IMAGE" >/dev/null 2>&1; then
    log "rollback image already exists locally; skip pull"
  else
    "${compose[@]}" pull jadeai || true
  fi
  "${compose[@]}" up -d --no-deps --force-recreate jadeai
  "${compose[@]}" up -d --no-deps --force-recreate jadeai-worker
  printf '%s\n' "$OLD_IMAGE" > current-image.txt

  rollback_ok=false
  deadline=$((SECONDS + health_timeout))
  while (( SECONDS < deadline )); do
    if curl -fsS --max-time 10 -H 'Cache-Control: no-cache' -H 'Pragma: no-cache' "$HEALTH_URL" >/dev/null; then
      rollback_ok=true
      break
    fi
    sleep 5
  done

  if [[ "$rollback_ok" == "true" ]]; then
    log "rollback success: $OLD_IMAGE"
  else
    log "rollback attempted but health check still failed"
  fi
  exit 1
fi

log "deploy success: $NEW_IMAGE"

repo="${NEW_IMAGE%:*}"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -x "$script_dir/cleanup-images.sh" ]]; then
  "$script_dir/cleanup-images.sh" "$repo" "$RETAIN_COUNT" || true
else
  docker image prune -f >/dev/null || true
fi
