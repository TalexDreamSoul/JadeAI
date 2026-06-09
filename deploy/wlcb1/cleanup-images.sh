#!/usr/bin/env bash
set -Eeuo pipefail

# Keep the newest N local images for a repository, never removing currently running images.
# Usage: ./cleanup-images.sh [repo] [retain_count]

REPO="${1:-ghcr.io/talexdreamsoul/jadeai-resume}"
RETAIN_COUNT="${2:-5}"

if ! [[ "$RETAIN_COUNT" =~ ^[0-9]+$ ]]; then
  echo "retain_count must be numeric: $RETAIN_COUNT" >&2
  exit 2
fi

CURRENT_IMAGES="$(docker ps --format '{{.Image}}' || true)"

mapfile -t candidates < <(
  docker images "$REPO" --format '{{.Repository}}:{{.Tag}} {{.CreatedAt}}' \
    | sort -r -k2,5 \
    | awk '{print $1}' \
    | while read -r image; do
        [ -z "$image" ] && continue
        echo "$CURRENT_IMAGES" | grep -qxF "$image" && continue
        printf '%s\n' "$image"
      done
)

if (( ${#candidates[@]} > RETAIN_COUNT )); then
  printf '%s\n' "${candidates[@]:RETAIN_COUNT}" | xargs -r docker rmi || true
fi

docker image prune -f >/dev/null || true
