# MoatazOS M0 - SalesOS Clickable Product

An evidence-first, execution-free decision-review application:
**App Studio -> SalesOS -> Command Center -> Opportunity -> Decision Card.**

All data in this milestone is deterministic synthetic fixture data.
There is no live backend, no network call, and no execution surface
of any kind - no Send, Call, Schedule, CRM write, pricing, billing, or
override control exists anywhere in this codebase.

## Important: this was built without network access

This codebase was authored in a sandboxed environment with no access
to the npm registry or to GitHub. **No dependency has actually been
installed, and no build/test/lint command has actually been run**
against it yet. Every file here is hand-written, careful TypeScript -
not verified by a real compiler in this session. Treat the commands
below as the intended, standard way to run this project once it is
on a machine with normal network access; they have not been executed
here.

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
