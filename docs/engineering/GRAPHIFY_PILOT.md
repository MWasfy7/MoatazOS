# ENG-05 — Graphify code-map/token-efficiency pilot (proposed; owner merge)

## Purpose
Evaluate Graphify as a CLI-only, code-only structural map for MoatazOS and its Claude Code/Codex development sessions. Graphify does not raise Claude subscription/session limits. The test is whether graph queries reduce repeat code-reading/context tokens and human time without reducing correctness.

## Guardrails
- Follow `AGENTS.md`, `CLAUDE.md`, `BACKLOG.md`, and `RELEASE_GATES.md`. Do not write to `main` directly. Create a new `claude/auto-eng-05-graphify-token-pilot` branch and a **draft** PR, never auto-merge.
- Add ENG-05 as an owner-reviewed backlog task, with `Merge: owner`. Do not run in the unattended nightly routine until approved/merged.
- Never change `src/`, `package.json`, `.claude/settings.json`, `CLAUDE.md`, or the existing SessionStart hook for this pilot.
- Do not use `graphify install`/`--project` in the baseline pilot. That can write Claude hooks/instructions and should receive a separate review.
- Extract **code only**: this avoids feeding docs, PDFs, or customer data to any model. Do not enable Graphify semantic backends, `--mode deep`, or send real customer data to an external provider.
- Keep `graphify-out/` and `graph.json` out of Git and Claude's default context (`.gitignore`, `.claudeignore`). Do not commit generated graphs, tokens, logs, or secrets.

## Run (Claude Code cloud or a local terminal in the repo)
Install using the exact PyPI package **graphifyy** (two y's). For a pinned trial version:

```bash
uv tool install graphifyy==0.9.55
export PATH="$HOME/.local/bin:$PATH"
graphify --version
# If this script has been added to the repo branch:
bash scripts/graphify-pilot.sh
```

Or run just the graph builder:

```bash
graphify extract . --code-only
graphify query "Where is buildDecisionSequence called?"
graphify explain "buildDecisionSequence"
```

Use `graphify query` to locate relevant symbols/files, then **read original source and tests** for anything Graphify cannot verify. Never substitute a graph inference for code inspection on security, date handling, protected invariants, or a merge review.

## Controlled evaluation
1. Pin the same MoatazOS Git SHA and select 3 specific cross-module codebase questions: the Decision Engine -> UI flow, real input -> evidence provenance, and Operator Runtime -> mobile path (for PR #8, test on its own pinned SHA).
2. Baseline runs: ordinary Claude Code navigation without Graphify. Record total input/output tokens or session cost when the environment exposes them, time, and wrong/missed links.
3. Graph runs: identical questions, independent sessions on the same SHA, query first and verify in code. Include initial install/index time, any cache-write tokens, and mistakes. Keep model/effort constant.
4. Prefer Graphify only if total effective token usage falls meaningfully (pilot target: >=20% on this use case) **and** output quality is at least equal. A graph may hurt simple one-file tasks.
5. Rebuild after code changes. For cloud sessions, check whether the tool/output persisted; never assume caches survive a new session.

## Promotion gate
Only after the trial, propose a second, separate ENG task for integrating `graphify install --project` hooks (soft hooks first). Compare the generated `.claude/settings.json` and `CLAUDE.md` diff carefully against the existing SessionStart hook, autonomous run policy, and agent constraints. Keep hook behavior non-blocking, fail-safe, and reversible. Owner review/merge is required.

## Evidence and limits
- Upstream: https://github.com/Graphify-Labs/graphify
- Docs: https://docs.graphify.com (as linked from the upstream README; the originally supplied `graphiffy.com` link did not match upstream and was replaced)
- PyPI package: https://pypi.org/project/graphifyy/
- All code-only Graphify extraction is intended to be local, but a third-party executable is still a supply-chain dependency. Verify pin and trust before installation.
- Smoke test executed on 2026-10-18 (install, code-only extraction, one query verified against source): see `docs/engineering/runs/2026-10-18-ENG-05.md`. The controlled evaluation above has **not** been run, so token savings remain **unverified**.
