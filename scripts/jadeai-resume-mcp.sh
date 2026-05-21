#!/usr/bin/env zsh
set -euo pipefail

SCRIPT_DIR=${0:A:h}
PROJECT_ROOT=${SCRIPT_DIR:h}

cd "$PROJECT_ROOT"

if command -v mise >/dev/null 2>&1; then
  exec "$(command -v mise)" exec -- pnpm exec tsx scripts/jadeai-resume-mcp.ts
fi

if [[ -x "$HOME/.local/bin/mise" ]]; then
  exec "$HOME/.local/bin/mise" exec -- pnpm exec tsx scripts/jadeai-resume-mcp.ts
fi

exec pnpm exec tsx scripts/jadeai-resume-mcp.ts
