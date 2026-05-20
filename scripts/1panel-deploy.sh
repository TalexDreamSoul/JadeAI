#!/usr/bin/env bash
set -Eeuo pipefail

# Blue/green Docker Compose deploy script for 1Panel webhook.
# It pulls a new image, starts the inactive color, health-checks it, switches
# Nginx upstream, then removes the old color. If the new container fails, the
# old color keeps serving traffic.
#
# Required env:
#   APP_DIR=/opt/1panel/apps/jadeai
# Optional env:
#   COMPOSE_FILE=docker-compose.yml
#   PROJECT_NAME=jadeai
#   JADEAI_IMAGE=ghcr.io/<owner>/<repo>:latest
#   IMAGE=ghcr.io/<owner>/<repo>:v1.2.3      # overrides JADEAI_IMAGE
#   IMAGE_TAG=v1.2.3                         # overrides tag part of IMAGE / JADEAI_IMAGE
#   APP_PORT=3003
#   HEALTH_TIMEOUT=90
#   DRAIN_SECONDS=10                         # wait before stopping old color
#   WEBHOOK_SECRET=...                       # validated against $1 if passed by webhook

log() { printf '[%s] %s\n' "$(date '+%Y-%m-%dT%H:%M:%S%z')" "$*"; }
fail() { log "ERROR: $*"; exit 1; }

if [[ -n "${WEBHOOK_SECRET:-}" ]]; then
  provided_secret="${1:-}"
  [[ "$provided_secret" == "$WEBHOOK_SECRET" ]] || fail "invalid webhook secret"
fi

command -v docker >/dev/null 2>&1 || fail "docker is not installed"

APP_DIR="${APP_DIR:-/opt/1panel/apps/jadeai}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
PROJECT_NAME="${PROJECT_NAME:-$(basename "$APP_DIR") }"
PROJECT_NAME="${PROJECT_NAME// /}"
APP_PORT="${APP_PORT:-3003}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-90}"
DRAIN_SECONDS="${DRAIN_SECONDS:-10}"
NGINX_CONF_REL="${NGINX_CONF_REL:-nginx/default.conf}"

cd "$APP_DIR"
[[ -f "$COMPOSE_FILE" ]] || fail "compose file not found: $APP_DIR/$COMPOSE_FILE"
[[ -f "$NGINX_CONF_REL" ]] || fail "nginx config not found: $APP_DIR/$NGINX_CONF_REL"

compose=(docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE")

if [[ -n "${IMAGE:-}" ]]; then
  export JADEAI_IMAGE="$IMAGE"
fi
if [[ -n "${IMAGE_TAG:-}" ]]; then
  base_image="${JADEAI_IMAGE:-ghcr.io/talexdreamsoul/jadeai:latest}"
  export JADEAI_IMAGE="${base_image%:*}:$IMAGE_TAG"
fi

active=""
if grep -q 'server jadeai-green:3000' "$NGINX_CONF_REL"; then
  active="green"
elif grep -q 'server jadeai-blue:3000' "$NGINX_CONF_REL"; then
  active="blue"
else
  active="blue"
fi

if [[ "$active" == "blue" ]]; then
  inactive="green"
else
  inactive="blue"
fi

active_service="jadeai-$active"
inactive_service="jadeai-$inactive"
proxy_service="proxy"

log "deploy start: project=$PROJECT_NAME active=$active_service inactive=$inactive_service image=${JADEAI_IMAGE:-from-compose}"

log "ensuring proxy and active app are running"
COMPOSE_PROFILES=green ${compose[@]} up -d "$proxy_service" "$active_service"

old_container="$(COMPOSE_PROFILES=green ${compose[@]} ps -q "$active_service" 2>/dev/null || true)"
old_image=""
if [[ -n "$old_container" ]]; then
  old_image="$(docker inspect -f '{{.Config.Image}}' "$old_container" 2>/dev/null || true)"
  log "active container=$old_container image=$old_image"
fi

log "pulling image for $inactive_service"
if [[ "${SKIP_PULL:-0}" == "1" ]]; then
  log "SKIP_PULL=1; skip docker compose pull"
else
  COMPOSE_PROFILES=green ${compose[@]} pull "$inactive_service"
fi

log "starting inactive service: $inactive_service"
COMPOSE_PROFILES=green ${compose[@]} up -d --no-deps --force-recreate "$inactive_service"

new_container=""
for _ in $(seq 1 30); do
  new_container="$(COMPOSE_PROFILES=green ${compose[@]} ps -q "$inactive_service" 2>/dev/null || true)"
  [[ -n "$new_container" ]] && break
  sleep 1
done
[[ -n "$new_container" ]] || fail "inactive container was not created"
log "inactive container=$new_container"

log "waiting for container health"
deadline=$((SECONDS + HEALTH_TIMEOUT))
healthy=false
while (( SECONDS < deadline )); do
  state="$(docker inspect -f '{{.State.Status}}' "$new_container" 2>/dev/null || true)"
  health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$new_container" 2>/dev/null || true)"
  if [[ "$state" == "running" && ( "$health" == "healthy" || "$health" == "none" ) ]]; then
    if docker exec "$new_container" wget -qO- http://127.0.0.1:3000/api/ready >/dev/null 2>&1 || docker exec "$new_container" wget -qO- http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
      healthy=true
      break
    fi
  fi
  if [[ "$state" == "exited" || "$state" == "dead" ]]; then
    break
  fi
  sleep 3
done

if [[ "$healthy" != "true" ]]; then
  log "new container failed health check; keeping $active_service and removing $inactive_service"
  docker logs --tail 160 "$new_container" || true
  COMPOSE_PROFILES=green ${compose[@]} rm -sf "$inactive_service" || true
  fail "deploy failed and rolled back"
fi

log "switching nginx upstream to $inactive_service"
tmp_conf="$(mktemp)"
sed -E "s/server jadeai-(blue|green):3000;/server $inactive_service:3000;/" "$NGINX_CONF_REL" > "$tmp_conf"
cat "$tmp_conf" > "$NGINX_CONF_REL"
rm -f "$tmp_conf"

log "reloading proxy"
proxy_container="$(COMPOSE_PROFILES=green ${compose[@]} ps -q "$proxy_service")"
[[ -n "$proxy_container" ]] || fail "proxy container not found"
if ! docker exec "$proxy_container" nginx -t || ! docker exec "$proxy_container" nginx -s reload; then
  log "proxy reload failed; switching nginx upstream back to $active_service"
  sed -E "s/server jadeai-(blue|green):3000;/server $active_service:3000;/" "$NGINX_CONF_REL" > "$tmp_conf"
  cat "$tmp_conf" > "$NGINX_CONF_REL"
  rm -f "$tmp_conf"
  docker exec "$proxy_container" nginx -t || true
  docker exec "$proxy_container" nginx -s reload || true
  COMPOSE_PROFILES=green ${compose[@]} rm -sf "$inactive_service" || true
  fail "deploy failed and rolled back"
fi

log "checking public health through proxy"
proxy_healthy=false
for _ in $(seq 1 20); do
  if curl -fsS --max-time 3 "http://127.0.0.1:${APP_PORT}/api/ready" >/dev/null || curl -fsS --max-time 3 "http://127.0.0.1:${APP_PORT}/api/health" >/dev/null; then
    proxy_healthy=true
    break
  fi
  sleep 2
done

if [[ "$proxy_healthy" != "true" ]]; then
  log "proxy health failed; switching nginx upstream back to $active_service"
  sed -E "s/server jadeai-(blue|green):3000;/server $active_service:3000;/" "$NGINX_CONF_REL" > "$tmp_conf"
  cat "$tmp_conf" > "$NGINX_CONF_REL"
  rm -f "$tmp_conf"
  docker exec "$proxy_container" nginx -t || true
  docker exec "$proxy_container" nginx -s reload || true
  COMPOSE_PROFILES=green ${compose[@]} rm -sf "$inactive_service" || true
  fail "deploy failed and rolled back"
fi

if [[ "$DRAIN_SECONDS" =~ ^[0-9]+$ && "$DRAIN_SECONDS" -gt 0 ]]; then
  log "draining old service for ${DRAIN_SECONDS}s"
  sleep "$DRAIN_SECONDS"
fi

log "new version is live; stopping old service $active_service"
COMPOSE_PROFILES=green ${compose[@]} stop -t 30 "$active_service" || true
COMPOSE_PROFILES=green ${compose[@]} rm -f "$active_service" || true

log "cleanup dangling images"
docker image prune -f >/dev/null || true

log "deploy success: active=$inactive_service"
