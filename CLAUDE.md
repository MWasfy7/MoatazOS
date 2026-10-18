@AGENTS.md

## Claude Code specifics

- Cloud sessions run `.claude/hooks/session-start.sh` on start. If
  `node_modules` is missing or `PLAYWRIGHT_CHROMIUM_EXECUTABLE` is unset,
  run the hook manually: `CLAUDE_CODE_REMOTE=true .claude/hooks/session-start.sh`.
- Never run `npm ci` while another process (a test run, a dev server, a
  parallel worktree that symlinks `node_modules`) is using the dependencies.
  It deletes `node_modules` first and produces misleading failures.
- Playwright's dev server binds port 3100 by default; set
  `SALESOS_E2E_PORT` to run two suites at once.
- For unattended scheduled runs, follow
  `docs/engineering/AUTONOMOUS_DEVELOPMENT.md` exactly. It overrides
  any habit of being "helpful" beyond the selected task.
- GitHub: use the GitHub MCP tools. Name branches with the `claude/`
  prefix (cloud sessions are set up to push to these).
- Merging: follow "Agent merge policy" in `docs/engineering/RELEASE_GATES.md`
  exactly. Pass `expectedHeadSha`, use `merge_method: merge`, and report a
  merge only when the GitHub tool returns `merged: true`.
