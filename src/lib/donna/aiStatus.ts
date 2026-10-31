/**
 * Model/provider status and cost controls: a fixed, honest statement of what Donna
 * can use. Nothing in `src/` can call a model or any paid service (the safety-boundary
 * test forbids network code outside the Supabase adapter), so usage and cost are
 * zero by construction, not by counting. Connecting a model is a separate, approved change.
 */
export type ProviderId = "templates" | "airllm" | "chatgpt" | "claude" | "gemini";
export type ProviderState = "ACTIVE" | "NOT_CONNECTED";

export interface ProviderStatus {
  readonly id: ProviderId;
  readonly state: ProviderState;
}

export const AI_STATUS: readonly ProviderStatus[] = Object.freeze([
  { id: "templates", state: "ACTIVE" },
  { id: "airllm", state: "NOT_CONNECTED" },
  { id: "chatgpt", state: "NOT_CONNECTED" },
  { id: "claude", state: "NOT_CONNECTED" },
  { id: "gemini", state: "NOT_CONNECTED" },
] as const);

/** Hard cost cap for this build, in US dollars. No model may be called while it is zero. */
export const AI_MONTHLY_CAP_USD = 0;
export const AI_MODEL_CALLS_THIS_SESSION = 0;
export const AI_COST_THIS_SESSION_USD = 0;
