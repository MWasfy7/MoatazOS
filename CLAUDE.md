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
- Balanced Mode (see AGENTS.md and `AUTONOMOUS_DEVELOPMENT.md` §1a–§1d):
  - Don't spawn sub-agents or extra sessions for implementation.
  - Use a fresh worktree per task and per review.
  - Read the task entry, its PR, and the named code paths before anything
    wider. Don't load whole directories or every run record "for context".
  - Don't change a routine's model or rely on in-run model switching:
    it isn't verified on this platform.
  - Note `date -u` at the start and end of a run for the metrics block.
    Report usage only if a tool actually returns it. `get_session` with no
    `session_id` returns cumulative session usage where that tool exists.
- Merging: follow "Agent merge policy" in `docs/engineering/RELEASE_GATES.md`
  exactly. Pass `expectedHeadSha`, use `merge_method: merge`, and report a
  merge only when the GitHub tool returns `merged: true`.
