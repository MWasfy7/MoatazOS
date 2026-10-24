import { applyEvent, createState } from "./engine";
import { addMinutes } from "./time";
import type { DonnaClient, DonnaState, PlannedCall, ReminderPolicy } from "./types";

/**
 * Deterministic demo clock: Monday 2026-10-26 12:00 at the fixed UTC+2
 * demo offset. Synthetic data only; no real person, number, or email.
 */
export const DEMO_NOW = "2026-10-26T10:00:00.000Z";

export const DEMO_POLICY: ReminderPolicy = {
  utcOffsetMinutes: 120,
  quietStartHour: 22,
  quietEndHour: 7,
};

export const DEMO_CLIENTS: readonly DonnaClient[] = [
  { id: "cl-alpha", label: { en: "Synthetic Client Alpha", ar: "عميل تجريبي ألفا" } },
  { id: "cl-beta", label: { en: "Synthetic Client Beta", ar: "عميل تجريبي بيتا" } },
  { id: "cl-gamma", label: { en: "Synthetic Client Gamma", ar: "عميل تجريبي جاما" } },
  { id: "cl-delta", label: { en: "Synthetic Client Delta", ar: "عميل تجريبي دلتا" } },
  { id: "cl-epsilon", label: { en: "Synthetic Client Epsilon", ar: "عميل تجريبي إبسيلون" } },
];

export const DEMO_CALLS: readonly PlannedCall[] = [
  // Due yesterday; no feedback -> question at app open.
  { id: "call-alpha", clientId: "cl-alpha", dueAt: "2026-10-25T13:00:00.000Z" },
  // Due this morning; operator marked the task done but gave no outcome.
  { id: "call-beta", clientId: "cl-beta", dueAt: "2026-10-26T07:00:00.000Z" },
  // Not due yet: becomes a question only when the demo clock passes 13:00Z.
  { id: "call-gamma", clientId: "cl-gamma", dueAt: "2026-10-26T13:00:00.000Z" },
  // Already resolved earlier (shows a recorded outcome with an internal follow-up).
  { id: "call-delta", clientId: "cl-delta", dueAt: "2026-10-24T09:00:00.000Z" },
  // Due tomorrow.
  { id: "call-epsilon", clientId: "cl-epsilon", dueAt: "2026-10-27T08:00:00.000Z" },
];

export function createDemoState(): DonnaState {
  let state = createState(DEMO_POLICY, DEMO_CLIENTS, DEMO_CALLS);
  const seed = [
    { type: "TASK_MARKED_DONE" as const, callId: "call-beta", at: "2026-10-26T07:30:00.000Z" },
    {
      type: "OUTCOME_RECORDED" as const,
      callId: "call-delta",
      at: addMinutes("2026-10-24T09:00:00.000Z", 20),
      outcome: "SPOKE" as const,
      originalInput: "Synthetic note: asked to compare two unit sizes.",
      nextAction: { kind: "INTERNAL_FOLLOW_UP" as const, date: "2026-10-28" },
    },
  ];
  for (const event of seed) {
    const result = applyEvent(state, event, event.at);
    if (!result.ok) throw new Error(`Invalid Donna demo seed: ${result.error}`);
    state = result.state;
  }
  return state;
}
