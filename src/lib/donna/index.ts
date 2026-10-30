export * from "./types";
export * from "./time";
export * from "./engine";
export * from "./fixtures";
export * from "./store";

/**
 * Donna feature flag (navigation and app-open banner). A compile-time
 * constant on purpose. Flip to `false` to remove Donna without touching SalesOS.
 *
 * Durable sync is a separate, OFF-by-default switch read only inside
 * `./remote/config.ts` (NEXT_PUBLIC_DONNA_SYNC). Nothing here touches the
 * network, the environment, or browser storage.
 */
export const DONNA_ENABLED = true;
