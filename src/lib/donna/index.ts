export * from "./types";
export * from "./time";
export * from "./engine";
export * from "./fixtures";

/**
 * Donna feature flag. A compile-time constant on purpose: runtime flags
 * need environment or storage access, which `tests/SafetyBoundary.test.ts`
 * forbids in `src/`. Flip to `false` to remove Donna from navigation and
 * the app-open banner without touching SalesOS.
 */
export const DONNA_ENABLED = true;
