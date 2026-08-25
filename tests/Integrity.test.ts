import { describe, expect, it } from "vitest";
import { checkSnapshotIntegrity } from "@/lib/types";
import {
  FIXTURE_1_NO_ACTION,
  FIXTURE_10_INTEGRITY_BLOCK,
} from "@/lib/fixtures";

describe("checkSnapshotIntegrity", () => {
  it("passes for a well-formed snapshot", () => {
    const result = checkSnapshotIntegrity(FIXTURE_1_NO_ACTION);
    expect(result.ok).toBe(true);
  });

  it("fails closed when evidence belongs to a different snapshot", () => {
    const result = checkSnapshotIntegrity(FIXTURE_10_INTEGRITY_BLOCK);
    expect(result.ok).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it("does not mix evidence counts from one snapshot with decision state from another", () => {
    const mismatched = {
      ...FIXTURE_1_NO_ACTION,
      evidence: FIXTURE_1_NO_ACTION.evidence.map((e) => ({ ...e, snapshotId: "some-other-snapshot" })),
    };
    const result = checkSnapshotIntegrity(mismatched);
    expect(result.ok).toBe(false);
  });
});
