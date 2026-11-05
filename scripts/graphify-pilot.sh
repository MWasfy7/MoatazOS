#!/usr/bin/env bash
# Opt-in, code-only Graphify pilot for MoatazOS.
# No hooks, app dependencies, backend calls, or automatic agent instructions.
set -euo pipefail

ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$ROOT"
if [[ ! -f package.json || ! -f AGENTS.md ]]; then
  echo 'Run from the MoatazOS repository root (package.json + AGENTS.md required).' >&2
  exit 2
fi

# Ignore generated artifacts so they do not pollute commits or invalidate
# Claude prompt caching. Preserve every existing ignore entry unchanged.
for file in .gitignore .claudeignore; do
  touch "$file"
  for pattern in 'graphify-out/' 'graph.json'; do
    if ! grep -Fxq "$pattern" "$file"; then
      printf '\n%s\n' "$pattern" >> "$file"
    fi
  done
done

if ! command -v graphify >/dev/null 2>&1; then
  if ! command -v uv >/dev/null 2>&1; then
    echo 'Install uv first (see https://docs.astral.sh/uv/), then re-run.' >&2
    exit 3
  fi
  # Pin a verified PyPI release. Does not add a project/runtime dependency.
  uv tool install graphifyy==0.9.55
  export PATH="$HOME/.local/bin:$PATH"
fi
if ! command -v graphify >/dev/null 2>&1; then
  echo 'Graphify CLI not found on PATH after installation.' >&2
  exit 4
fi

echo 'Graphify version:'
graphify --version
# Code-only avoids LLM calls for docs and PDFs. This is not a full project semantic pass.
graphify extract . --code-only
if [[ ! -s graphify-out/graph.json ]]; then
  echo 'Graph graphify-out/graph.json was not created; investigate extraction output.' >&2
  exit 5
fi

echo 'Try: graphify query "Where is buildDecisionSequence called?"'
echo 'Pilot only: Claude hooks and nightly automation are NOT enabled.'
