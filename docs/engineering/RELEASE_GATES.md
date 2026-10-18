# Release gates

Green CI is necessary but not sufficient. A change moves through the gates
in order; each gate states who may pass it. Nothing in MoatazOS is
deployed today, so "release" means "merge to `main`".

| Gate | Name | Who passes it | Required for |
|---|---|---|---|
| G1 | Mechanical | CI (`validate`) and the agent locally | every PR |
| G2 | Invariants | agent self-check plus reviewer | every PR touching `src/` |
| G3 | Evidence of behavior | agent | every behavior change |
| G4 | Independent review | a different agent or session than the author, on the exact head SHA | merge |
| G5 | Owner decision | owner | merge; anything listed under "always owner" |
| G6 | Trial readiness | owner, after G1–G5 and a written trial plan | use with real people or data |

## G1 — Mechanical (all must pass on the exact head SHA)

1. `npm ci` succeeds without modifying `package-lock.json`.
2. `npm run typecheck` exits 0.
3. `npm run lint` exits 0 with no warnings.
4. `npm test` exits 0: 0 failed, 0 skipped, and no `.only`/`.skip`
   added. The count doesn't drop versus the base unless the PR says why.
5. `npm run build` exits 0.
6. `npm run test:e2e` exits 0 in CI on **both** projects, with
   `mobile-arabic` on native WebKit. Cloud runs on Chromium emulation are
   recorded as such and don't satisfy the WebKit half.
7. GitHub Actions `validate` is green on the head SHA.
8. The PR merges into its base without conflicts **and** the merged result
   passes 2–5. A clean textual merge is not evidence. (The operator
   runtime + Codex repair merge was conflict-free yet failed typecheck.)

## G2 — Invariants (AGENTS.md "Protected invariants" 1–10)

For each invariant, the PR either states "untouched" or names the test
that proves it still holds. Automatic failures:

- `tests/SafetyBoundary.test.ts` modified to allow something new.
- Any new runtime dependency, route handler, server action, middleware,
  network or persistence API, or outbound link.
- A decision-engine behavior change without an `EXTRACTOR_VERSION` or
  `POLICY_VERSION` bump.
- A change that lets later evidence rewrite an earlier snapshot, or that
  hides a recorded chasing violation.
- UI copy added in one language only.
- Any real-looking personal data (names with phone numbers, emails,
  WhatsApp exports) in fixtures, tests, screenshots, or PR text.

## G3 — Evidence of behavior

- Each acceptance criterion maps to a named test or a reproducible command.
- Decision changes include at least one restraint or negative case
  (e.g. buyer pause still yields `NO_ACTION`).
- UI changes include an e2e assertion that no execution control exists on
  the new surface.
- The report lists commands run with exit codes and counts, and lists
  separately what could not run and why.

## G4 — Independent review

- Performed on a pinned SHA by someone other than the author (a separate
  agent session counts; the authoring session does not).
- Output: `docs/engineering/reviews/PR-<n>-<sha7>.md` with a verdict
  (`APPROVE` / `REQUEST_CHANGES`), commands and results, and findings tied
  to file:line.
- Any push after the review invalidates it.

## G5 — Owner decision (always owner)

- Merging any PR. Agents never merge or enable auto-merge.
- Leaving draft.
- Approving `PROPOSED` backlog tasks.
- Anything touching: deployment config, CI permissions or secrets, new
  runtime dependencies, major upgrades, repository settings, branch
  deletion, authentication, persistence, real integrations, real
  customer data, pricing, or outbound communication.

## G6 — Trial readiness (not yet reached by any module)

Before any real operator or real buyer data touches the product: a written
trial plan, a data-handling review against
`docs/salesos-diagnostic/data-privacy-requirements.md`, a private
repository (OD-2), a kill switch, and explicit owner sign-off. PR #8's own
text says Build 4 "is not yet trial-ready"; that remains true.
