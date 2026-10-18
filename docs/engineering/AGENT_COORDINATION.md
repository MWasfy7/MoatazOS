# Agent coordination (Claude Code + Codex Cloud)

Two coding agents work in this repository. This file says who may work on
what, and how each agent proves a task is taken. It adds no new tool,
label, workflow, or schedule: the ledger is `BACKLOG.md` §5 plus GitHub
PRs. Everything in `AGENTS.md` and `RELEASE_GATES.md` still applies to both
agents, unchanged.

## 1. Agents and lanes

| Agent | Owns | Branch prefix | Schedule |
|---|---|---|---|
| `claude` (Claude Code) | The nightly builder (the one existing scheduled task) and the `APPROVED` SalesOS, ENG and GOV tasks assigned to it | `claude/` | the existing nightly run only |
| `codex` (Codex Cloud) | ECH-01 (independent review of PR #12) and any other task the owner assigns to it | `codex/` | none; started by the owner |
| `owner` | `OD-*` decisions, assignments, policy changes, `Merge: owner` merges | — | — |

No agent creates, edits, or deletes a scheduled task or routine as part of
this policy.

## 2. Ownership rules

1. **Assignment.** A task's agent is the `Agent` column of
   `BACKLOG.md` §5. Only the owner sets or changes it (in a commit or a
   PR comment from `MWasfy7`). `unassigned` tasks are not picked by
   anyone until the owner assigns them.
2. **Claim.** An agent claims an assigned task by opening a **draft** PR
   titled `<TASK-ID>: <summary>` from its own prefix branch
   (`claude/auto-<task-id>-<slug>` or `codex/<task-id>-<slug>`). Open the
   draft PR with the first push, so the claim is visible early.
3. **Treat as claimed, never duplicate.** Before selecting work, an agent
   lists open PRs and reads §5. A task is claimed, and must be skipped,
   if *any* of these hold:
   - its `Agent` is another agent;
   - an open PR's title starts with its ID (including `[BLOCKED] <ID>:`);
   - an open PR comes from a `codex/` branch or was opened by Codex and
     names the ID in its title, branch, or body.
4. **Hands off.** Never push to, rebase, comment change requests on, or
   close the other agent's branch or PR. Reviewing it is allowed only
   when that review is itself your assigned task (e.g. a G4 review).
5. **Same ID twice.** If two open PRs claim one task, the earlier-created
   PR keeps the claim. The later agent stops, makes no further pushes,
   and reports the clash. The owner decides.
6. **Unique IDs.** A new task ID is `<PREFIX>-<next free number>`. Before
   using one, check `BACKLOG.md` on `main` **and** the titles and
   `BACKLOG.md` diffs of open PRs. If an ID is already taken anywhere,
   take the next number. Agents may only add new tasks as `PROPOSED`.
7. **Status source.** GitHub wins over the table: open PR → `IN_REVIEW`,
   merged → `DONE`, `[BLOCKED]` PR → `BLOCKED`, closed unmerged →
   `REJECTED`. An agent updates only its own §5 rows (status and PR link),
   in the same branch as the task.
8. **Merges.** The agent merge policy (`RELEASE_GATES.md`) applies to both
   agents unchanged. The nightly builder is the only scheduled merge
   pass. A Case 2 merge of the *other* agent's PR also requires that
   agent's run record on the PR head with `Result: IN_REVIEW`, so work in
   progress is never merged. Codex merges only on owner direction (Case 1).

## 3. Balanced Mode (both agents)

- **One active task per agent.** One branch, one PR per session. PRs
  waiting on review or the owner don't count as active.
- **Minimal context.** Read `AGENTS.md`, `BACKLOG.md` §5, your task's
  entry, its PR, and the code paths it names. Don't read the other
  agent's diffs or run records unless your task is to review them.
- **Bounded retries.** At most two fix attempts per failure you caused,
  each based on a new diagnosis; then take the blocked path
  (`AUTONOMOUS_DEVELOPMENT.md`).
- **Validation is never reduced.** The full gate in `AGENTS.md` runs for
  every change.
- **Concise report.** Each session ends with five lines: WHAT CHANGED /
  TASK / VERIFIED (commands, exit codes, counts) / BLOCKERS / NEXT. The
  run record goes in `docs/engineering/runs/<YYYY-MM-DD>-<task-id>.md`
  using the template in `AUTONOMOUS_DEVELOPMENT.md` §4.

## 4. Changing this policy

This file, the `Agent` column, and adding an agent are policy. Changes go
through a `GOV-*` task PR that only the owner merges (Case 1). They are
never Case 2 eligible (`RELEASE_GATES.md`).
