# MoatazOS M0 - SalesOS Clickable Product

An evidence-first, execution-free decision-review application:
**App Studio -> SalesOS -> Command Center -> Opportunity -> Decision Card.**

All data in this milestone is deterministic synthetic fixture data.
There is no live backend, no network call, and no execution surface
of any kind - no Send, Call, Schedule, CRM write, pricing, billing, or
override control exists anywhere in this codebase.

## Validation status

This codebase was originally authored in a network-restricted sandbox.
It has since been validated on August 25, 2026 with the following
commands:

- `npm install`
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npx playwright install`
- `npm run test:e2e`

## Requirements

- Node.js 18.18+ (Node 20 LTS recommended)
- npm 10+

## Setup

```bash
npm install
npm run dev
```

Then open http://localhost:3000 - it redirects to
`/app-studio/salesos`.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | Next.js/ESLint |
| `npm test` | Vitest unit/component tests (single run) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:e2e` | Playwright end-to-end tests (requires `npx playwright install` first) |

## MCP integrations

`.mcp.json` at the repo root declares five project-scoped MCP servers, so
anyone who opens this repo in Claude Code (or any MCP-aware client that
reads project config) is offered the same tool surface. Claude Code
prompts once per project before it will start servers from a checked-in
`.mcp.json`; approve it, then run `/mcp` to see connection status.

| Server | Transport | Purpose here | Credentials |
|---|---|---|---|
| `perplexity` | stdio, `@perplexity-ai/mcp-server` | Live web search/research while working on the codebase | `PERPLEXITY_API_KEY` |
| `playwright` | stdio, `@playwright/mcp` | Drive the dev server (`npm run dev -- --port 3100`) through a real browser; complements the `tests/e2e` suite | none |
| `firecrawl` | stdio, `firecrawl-mcp` | Scrape/crawl external pages into structured text | `FIRECRAWL_API_KEY` |
| `higgsfield` | HTTP, `https://mcp.higgsfield.ai/mcp` | Image/video/audio generation | OAuth in browser |
| `chrome-devtools` | stdio, `chrome-devtools-mcp` | Performance traces, console/network inspection, DOM debugging | none |

Both browser servers run with `--isolated`, so each session gets a
throwaway profile instead of touching your real Chrome profile.

### Credentials

Copy `.env.mcp.example` to `.env.mcp` (gitignored) and fill in the two
API keys, then launch Claude Code with them exported:

```bash
cp .env.mcp.example .env.mcp
# edit .env.mcp
set -a && source .env.mcp && set +a
claude
```

`.mcp.json` reads those via `${VAR:-}` expansion, so **no key is ever
committed**. A missing key only disables that one server; the other four
still connect. Higgsfield needs no key - run `/mcp`, select
`higgsfield`, and authenticate in the browser.

To add a machine-local server without touching the shared file, use
`.mcp.local.json` (also gitignored) or `claude mcp add --scope local`.

### Scope note

These servers are development tooling only. Nothing in `src/` imports
or calls them, and adding them does not introduce a runtime dependency,
a network call, or an execution surface into the product itself - the
"no execution authority" constraint described below is unchanged.

## What to click through

1. Open the app - you land on the SalesOS Command Center with an
   opportunity list on the left.
2. Click any opportunity to see its Decision Card.
3. Try these opportunities to see each of the four decision states:
   - **F. Al-Sayed** - `NO_ACTION` (protected restraint)
   - **A. Hassan** - `NEXT_STEP_READY`
   - **O. Zaki** - `INSUFFICIENT_EVIDENCE`
   - **L. Fahmy** - `CONTRADICTORY_EVIDENCE`
4. Open the Inspection Rail buttons (Evidence, Why this decision,
   Uncertainty, Buyer signals, Manager review, Pilot evidence,
   History, Provenance) - each opens a read-only drawer.
5. Visit **Y. Adel** to see a historical chasing-violation entry that
   remains visible even though the current decision is now positive.
6. Visit **K. Mansour** to see a "newer snapshot available" banner,
   then click **Compare snapshots** for the explicit before/after
   Evidence Delta view.
7. Visit **H. Rashid** to see the integrity-blocked fail-closed state
   (this fixture is intentionally malformed to exercise that path).
8. Switch the language toggle (top right) to **العربية** to see the
   full Arabic/RTL experience, including the **محمود عبد الله**
   opportunity (a fully Arabic-authored fixture).
9. Resize to a mobile viewport (or use the Playwright mobile project)
   to see the mobile layout.

## Architecture

```
src/
  app/                      Next.js App Router pages
    app-studio/             App Studio shell (sidebar + module nav)
      salesos/              Command Center + Opportunity pages
  components/
    app-studio/             Sidebar, language switch
    salesos/
      Badges.tsx            DecisionStateBadge, FreshnessBadge
      OpportunityList.tsx
      DecisionCard/         The Decision Card and everything in it
        panels/             One panel per decision state
        InspectionRail/     The actionless inspection system
        SnapshotComparison/ Evidence Delta (before/after) view
  lib/
    types.ts                Domain model + checkSnapshotIntegrity
    fixtures/index.ts       All 11 deterministic synthetic fixtures
    i18n/                   English + Arabic dictionaries, LocaleProvider
tests/                      Vitest unit/component tests
tests/e2e/                  Playwright end-to-end tests
```

## Design principles enforced in code (not just prose)

- **No execution authority anywhere.** `types.ts`'s own top-of-file
  comment states this is a deliberate, permanent constraint; every
  test file that touches a rendered panel also asserts no
  Send/Call/Schedule/CRM/Pricing/Override control exists.
- **NO_ACTION is a protected state**, not an empty state - its visual
  weight (a bordered restraint block) is deliberately heavier than the
  optional evidence-navigation content beneath it.
- **Freshness never mutates the pinned decision.** `FreshnessState`
  is read as metadata everywhere; the only thing a "new snapshot
  available" banner can do is open an *explicit* comparison view.
- **Snapshot integrity is fail-closed.** `checkSnapshotIntegrity`
  verifies every evidence/signal item and the provenance block belong
  to the exact same snapshot identity; the Decision Card renders
  *only* the integrity-blocked state on any mismatch, never a partial
  or best-guess decision.
- **History is append-only and never edited.** A recorded chasing
  violation remains visible in the history strip even after a later,
  positive decision.

## Known limitations

- Untested against a real compiler/test runner/browser (see the
  network-access note above) - treat this as a careful first pass,
  not a verified green build.
- Fixture-authored free text (e.g. a `NO_ACTION` snapshot's specific
  restraint reason) is only as bilingual as the individual fixture
  that wrote it; only the surrounding chrome/UI copy is guaranteed
  translated via the `en`/`ar` dictionaries.
- Manager Review and Pilot Evidence drawers are intentionally empty in
  this milestone - there is no data source for either yet, and the
  drawers say so honestly rather than fabricating content.
- No dark/light theme toggle - this milestone ships a single dark
  theme matching the "restrained premium enterprise" direction.
- No real persistence of the language preference across a reload
  (in-memory only) - acceptable for this milestone's synthetic-data
  scope.

## Not claimed

No production readiness, no real buyer validation, no conversion,
revenue, willingness-to-pay, deployment, or market-validation claim is
made anywhere in this codebase or its documentation.
