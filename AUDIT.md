# SALESOS BUILD 4 AUDIT

## 1. Branch verification
- current branch: feat/salesos-operator-runtime
- HEAD SHA: d8a177ff7de8c2ae9fabef9fbf1f5730af82ea4c
- verification result: Verified matching expected branch and SHA.

## 2. Architecture discovered
- **`src/app/`**: Next.js app router defining the App Studio and SalesOS routes (Command Center, Opportunity detail, Operator Runtime, Real Input, Lead Loss Report).
- **`src/components/salesos/`**: The core component library, containing the `DecisionCard` (and its sub-panels for different states), `InspectionRail`, `OpportunityList`, and `OperatorRuntime`.
- **`src/lib/decisionEngine/`**: The deterministic decision policy engine (`policy.ts`), event extractor (`extractor.ts`), and synthetic fixtures.
- **`src/lib/operatorRuntime/`**: Logic for managing the operator's queue, runtime session, trial signals, and performance ledger.
- **`src/lib/realInput/`**: Layers for CSV and WhatsApp import, normalization, and timeline rendering.
- **`src/lib/types.ts`**: Core domain model enforcing snapshot integrity.

## 3. What is genuinely strong
- **Evidence integrity**: The `checkSnapshotIntegrity` system strictly maps decisions to attributable evidence sources. It enforces a fail-closed architecture where tampered or mismatched snapshots are rejected outright.
- **Deterministic safety bounds**: The `policy.ts` engine accurately enforces `NO_ACTION` when restraint is required (e.g., `BUYER_EXPLICIT_PAUSE`) and flags contradictions, preventing unsafe execution.
- **No-execution boundary**: The application is successfully sandboxed. There is zero execution authority—no capability to send emails, schedule, or write to CRM exists, protecting the product boundaries.
- **Queue prioritization**: The distinction between `ACT_NOW`, `COMMITMENTS_DUE`, and `WAIT_PROTECTED` provides a sound mental model for daily workflow.

## 4. What feels incomplete or fake
- **Passive Learning Ledger**: The Operator Runtime tracks disagreements and trial signals, but it acts strictly as storage. It does not analyze or adapt the doctrine or the decision engine.
- **Stubbed Workflows**: The "Manager Review" and "Pilot Evidence" drawers are intentionally empty stubs, providing no actual workflow.
- **Fixture Dependency**: The real input preview and decision engine heavily rely on static synthetic fixtures rather than a dynamic processing layer.
- **Synthetic Observations**: Operators can log "capture events" or "overrides" locally, but it feels like a fake UI interaction because it doesn't bridge to real-world outcomes.

## 5. Daily-use friction
1. **Insight-to-Action Gap**: An operator sees `NEXT_STEP_READY` but must leave the OS, figure out what to say, and open an external tool to execute.
2. **Dense Read-Only Surfaces**: The `DecisionCard` forces the operator to read extensive text to understand why a state was reached, rather than giving immediate prescriptive guidance.
3. **Manual Import Overhead**: Dropping CSVs or pasting WhatsApp exports is a highly manual, high-friction process for daily use.
4. **Dead-end Restraints**: `NO_ACTION` tells the operator not to act but offers no workflow for manager override or strategic planning for the next allowable window.

## 6. Weak or dead surfaces
- **Manager Intervention Review**: Currently empty and provides no value.
- **Pilot Evidence Drawer**: A dead link/stub.
- **Learning/Performance Ledger**: Only lists trial signals manually selected; does not offer actionable feedback or metric analysis.
- **Snapshot Comparison**: Informative, but lacks a "so what?" factor to guide operator behavior based on the delta.

## 7. Missing operating loops
- **DAILY EXECUTION LOOP**: The system shows a flat queue but lacks morning planning, midday corrections, and end-of-day reviews to structure the operator's shift.
- **DEAL LOOP / ADAPTATION**: It records outcomes but fails to update the decision logic for the next iteration of a similar deal.
- **FOLLOW-UP LOOP**: It identifies missing responses, but doesn't design the cadence, channel, or message for the next touchpoint.
- **NEGOTIATION LOOP**: Completely missing; there is no logic for objection handling, leverage mapping, or give/get tracking.

## 8. Missing intelligence
1. **Next-Best-Action (NBA) guidance**: Advising the specific channel and draft message for a `NEXT_STEP_READY` opportunity.
2. **Call / Meeting Preparation**: Auto-generating leverage and missing evidence before a scheduled meeting.
3. **Stalled Deal Probability**: Predicting ghosting decay rather than waiting indefinitely in `INSUFFICIENT_EVIDENCE`.
4. **Objection Classification**: Categorizing real input text into specific objections to inform playbooks.

## 9. Missing learning/evolution loops
- Currently, there is only **STORAGE**. `runtime.ts` holds `session.overrides` and `session.experiments`.
- There is no **ANALYSIS** to identify patterns in the overrides.
- There is no **ADAPTATION**. The deterministic `policy.ts` remains static, meaning the system never learns to adjust its chasing rules or waiting periods based on empirical success rates.

## 10. Decision-engine weaknesses
- **Rigid Classification**: It relies heavily on exact event types (`BUYER_EXPLICIT_PAUSE`). It struggles with nuanced, implicit objections or soft boundaries.
- **Binary Silence**: "Silence is not intent" is safe but lacks temporal nuance (silence for 1 hour vs. 3 weeks).
- **Static Reevaluation**: Reevaluation conditions are hardcoded rather than contextually generated based on the specific deal leverage.

## 11. Performance/accountability weaknesses
- The system observes "Observable Chasing" but does not proactively warn or enforce consequences. It passively records a violation *after* the fact.
- There is no active coaching or "drill" loop to correct poor concession behavior or weak qualification.

## 12. UX weaknesses
- Desktop layout for the `DecisionCard` can cause information overload due to the volume of explanatory text and badges.
- Missing rapid keyboard shortcuts for navigating the queue.
- No seamless contextual transition between the NO_ACTION state and requesting manager intervention.

## 13. Reliability and test gaps
- All 58 E2E Playwright tests pass (covering Arabic RTL, state transitions, and boundaries).
- **Gaps**: Missing failure-mode tests for malformed data parsing, missing dynamic integration tests with actual non-fixture event streams, and shallow testing of edge-case temporal overlaps.

## 14. Top 10 Build 5 candidates

1. **True Next-Best-Action (NBA) Guidance**
   - problem: Operator knows they can act but doesn't know what to say or how.
   - evidence: NextStepReadyPanel provides reasons but no drafting/channel guidance.
   - capability: Suggest exact next steps and draft outlines around the deterministic state.
   - KPI affected: follow-up quality, next-step rate
   - impact score: 9
   - effort score: 7
   - daily-use value score: 10
   - dependency risk score: 6
   - recommended owner: Codex
   - main risk: LLM drift contradicting the safe deterministic policy.

2. **Automated Pre-Meeting Prep Package**
   - problem: Meetings happen but prep is disorganized and manual.
   - evidence: System knows MEETING_SCHEDULED but provides no prep loop.
   - capability: Generate a 1-page summary of leverage, missing evidence, and required commitments before the meeting.
   - KPI affected: meeting show rate, controlled closes
   - impact score: 8
   - effort score: 5
   - daily-use value score: 9
   - dependency risk score: 4
   - recommended owner: Jules
   - main risk: Prep package being ignored if too long.

3. **Morning Execution Briefing**
   - problem: Queue is flat and lacks daily context.
   - evidence: OperatorRuntime queue is a static list of sections.
   - capability: A daily briefing view highlighting at-risk deals and today's strict commitments before showing the full queue.
   - KPI affected: daily sales discipline, prioritization
   - impact score: 7
   - effort score: 4
   - daily-use value score: 9
   - dependency risk score: 3
   - recommended owner: Jules
   - main risk: UI clutter.

4. **Integrated Manager Intervention Workflow**
   - problem: Manager intervention is an empty stub.
   - evidence: ManagerInterventionReview.tsx is empty.
   - capability: Actual workflow to request manager unblock for NO_ACTION states, complete with approval mock.
   - KPI affected: reduce stalled deals, daily sales discipline
   - impact score: 7
   - effort score: 5
   - daily-use value score: 7
   - dependency risk score: 4
   - recommended owner: Jules
   - main risk: Adds workflow friction.

5. **Stalled Deal & Ghosting Decay Detection**
   - problem: Insufficient Evidence deals sit idle indefinitely.
   - evidence: No decay logic for silence over time.
   - capability: Model that transitions silent deals to "at risk of churn" and suggests re-engagement hooks.
   - KPI affected: reduce stalled deals
   - impact score: 8
   - effort score: 6
   - daily-use value score: 8
   - dependency risk score: 5
   - recommended owner: Claude Code
   - main risk: False positives causing operators to spam prospects.

6. **Micro-commitment Tracker**
   - problem: Commitments are not enforced per interaction.
   - evidence: Queue has COMMITMENTS_DUE but lacks granular give/get tracking on the opportunity view.
   - capability: Bidirectional commitment tracker embedded in the Decision Card.
   - KPI affected: increase next-step rate
   - impact score: 6
   - effort score: 5
   - daily-use value score: 7
   - dependency risk score: 3
   - recommended owner: Jules
   - main risk: Operator fatigue from manual input.

7. **Real-time Follow-up Draft Feedback**
   - problem: Poor follow-up quality even when permitted to act.
   - evidence: Quick capture takes generic notes without quality enforcement.
   - capability: Intercept outbound drafts and score them against the Doctrine (e.g., checking for weak urgency).
   - KPI affected: improve follow-up quality
   - impact score: 8
   - effort score: 7
   - daily-use value score: 8
   - dependency risk score: 5
   - recommended owner: Codex
   - main risk: Frustrating operators if feedback is pedantic.

8. **Automated Doctrine Adaptation**
   - problem: Learning ledger is passive storage.
   - evidence: runtime.ts just tallies metrics.
   - capability: Analyze override success and automatically suggest doctrine policy updates.
   - KPI affected: improve scripts and decisions over time
   - impact score: 7
   - effort score: 9
   - daily-use value score: 6
   - dependency risk score: 7
   - recommended owner: Claude Code
   - main risk: Complex architectural changes to policy.ts.

9. **Objection Extraction & Counter-Leverage**
   - problem: No intelligence on deal blockers.
   - evidence: Engine extracts pauses but not the "why".
   - capability: Extract specific objections (price, timeline) and surface playbooks.
   - KPI affected: increase controlled closes
   - impact score: 7
   - effort score: 7
   - daily-use value score: 7
   - dependency risk score: 6
   - recommended owner: Claude Code
   - main risk: Nuance extraction failure on Arabic inputs.

10. **Real Live Data Sync Hook**
    - problem: Input is a manual file drop.
    - evidence: RealInputWorkspace requires manual CSV/WhatsApp upload.
    - capability: Webhook layer for continuous ingestion.
    - KPI affected: make operator faster
    - impact score: 9
    - effort score: 8
    - daily-use value score: 10
    - dependency risk score: 8
    - recommended owner: Codex
    - main risk: Breaks deterministic safety if malformed data streams in.

## 15. Recommended SalesOS Build 5

- **Build 5 name**: The Active Guidance & Prep Loop
- **product thesis**: Operators do not just need to know *if* they can act; they need prescriptive guidance on *what* to do and *how* to prepare, bridging the gap between passive restraint and active execution without violating safety bounds.
- **operator problem**: SalesOS tells operators they are in NEXT_STEP_READY or NO_ACTION, but leaves them to figure out the exact follow-up or meeting prep themselves, causing high cognitive load and inconsistent execution quality.
- **exact scope**:
  1. Implement Next-Best-Action (NBA) drafting guidance inside the NextStepReadyPanel (advisory only).
  2. Implement an Automated Pre-Meeting Prep Package for upcoming commitments.
  3. Implement a Morning Execution Briefing view to structure the queue.
- **non-goals**:
  - Do not automate sending messages (preserve execution boundary).
  - Do not rewrite the core `policy.ts` deterministic engine.
  - Do not build live CRM sync API endpoints.
- **success criteria**:
  - Operator time-to-action on NEXT_STEP_READY decreases.
  - The Morning Briefing makes daily prioritization obvious without navigating multiple sections.
- **modules affected**:
  - `src/components/salesos/OperatorRuntime.tsx`
  - `src/components/salesos/DecisionCard/panels/NextStepReadyPanel.tsx`
  - New UI components for Prep Package and Morning Briefing.
- **test requirements**:
  - E2E tests for the Morning Briefing state.
  - Unit tests for the NBA advisory layer (ensuring it strictly reads from and aligns with the deterministic snapshot).
- **architecture risks**: The advisory layer might hallucinate guidance that subtly contradicts the rigid `policy.ts` engine.
- **implementation phases**:
  1. Jules builds Morning Briefing and Pre-Meeting Prep UI components using existing fixture data.
  2. Claude Code designs the safe Advisory Intelligence abstraction around `policy.ts`.
  3. Codex wires the state and finalizes cross-module integration into the live session.

## 16. Parallel Jules work
- Build the purely visual Morning Briefing UI component.
- Build the Pre-Meeting Prep UI component.
- Implement the Manager Intervention Review UI workflow using mock approval logic.
- Expand Playwright test coverage for queue sorting edge cases.

## 17. Claude Code work
- Design the safe Advisory Intelligence abstraction (a layer that reads `policy.ts` output and proposes Next-Best-Actions without breaking deterministic bounds).
- Refactor the Learning Ledger to parse objections for the Prep Package.

## 18. Codex handoff for tomorrow
- Integrate the Advisory Intelligence Layer into the main Operator Runtime state.
- Wire the Morning Briefing and Pre-Meeting Prep components to the live runtime session.
- Final architectural review to guarantee the advisory layer respects the execution boundary.

## 19. Files/modules likely affected
- `src/components/salesos/OperatorRuntime.tsx`
- `src/components/salesos/DecisionCard/panels/NextStepReadyPanel.tsx`
- `src/components/salesos/OpportunityList.tsx`
- `src/lib/operatorRuntime/runtime.ts`
- `src/components/salesos/DecisionCard/ManagerInterventionReview.tsx`

## 20. Risks and dependencies
- **Dependency**: The NBA guidance relies on a robust advisory model that strictly obeys `policy.ts`.
- **Risk**: UI clutter in `OperatorRuntime` if the Morning Briefing, full queue, and prep packages are visible simultaneously.
- **Risk**: Missing Arabic translations for new prescriptive content.

## 21. Final recommendation
We should build **The Active Guidance & Prep Loop**. Build 4 successfully proved the safety of the deterministic engine and boundaries. However, as an Operating System, it is currently too passive—it acts as a dashboard telling the operator what they cannot do. Build 5 must solve the "insight-to-action gap" by providing prescriptive, context-aware guidance (Next-Best-Action drafting and Meeting Prep) that makes the operator faster and more effective every day, without compromising the hard-won safety boundaries.
