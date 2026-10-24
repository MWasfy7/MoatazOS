import { describe, expect, it } from "vitest";
import { DEMO_POLICY } from "@/lib/donna";
import { createMemoryStore } from "@/lib/donna/memoryStore";
import { CONTRACT_SCENARIOS } from "./helpers/donnaStoreContract";

// MOCK: an in-memory double of the store contract. These tests prove the
// contract scenarios and the browser rules, NOT persistence. The same scenarios
// run against the real database in tests/donna-live (needs hosted credentials).
describe("Donna store contract (MOCK in-memory double, not persistence)", () => {
  const NOW = "2026-10-26T12:00:00.000Z";
  for (const scenario of CONTRACT_SCENARIOS) {
    it(scenario.name, async () => {
      let n = 0;
      await scenario.run({
        store: createMemoryStore(DEMO_POLICY, () => NOW),
        now: () => NOW,
        newId: () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`,
        callId: (tag) => `t-${tag}`,
      });
      expect(true).toBe(true);
    });
  }
});
