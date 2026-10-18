#!/bin/bash
# SessionStart hook for Claude Code cloud sessions (including the nightly
# routine). Installs dependencies and points Playwright at the preinstalled
# Chromium. Does nothing on local machines.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"

# npm ci only when the lockfile changed since the last install. Plain
# `npm install` is avoided on purpose: it rewrites package-lock.json
# (e.g. the fsevents "dev" flag churn seen in earlier agent PRs).
stamp="node_modules/.lockfile-sha"
want="$(sha256sum package-lock.json | cut -d' ' -f1)"
if [ ! -f "$stamp" ] || [ "$(cat "$stamp")" != "$want" ]; then
  npm ci --no-audit --no-fund
  echo "$want" > "$stamp"
fi

if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo 'export NEXT_TELEMETRY_DISABLED=1' >> "$CLAUDE_ENV_FILE"
  shell="$(ls -d /opt/pw-browsers/chromium_headless_shell-*/chrome-linux/headless_shell 2>/dev/null | sort -V | tail -1 || true)"
  if [ -n "$shell" ] && [ -x "$shell" ]; then
    echo "export PLAYWRIGHT_CHROMIUM_EXECUTABLE=$shell" >> "$CLAUDE_ENV_FILE"
  fi
fi
