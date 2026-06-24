import { describe, expect, it } from "vitest";

import { isReconcileThrottled } from "@/lib/tool-reconcile";

describe("isReconcileThrottled", () => {
  const now = 1_000_000_000_000;
  const tenMin = 10 * 60_000;

  it("never throttles when there's no prior run", () => {
    expect(isReconcileThrottled(null, now, tenMin)).toBe(false);
  });

  it("throttles a run within the window", () => {
    expect(isReconcileThrottled(new Date(now - 60_000), now, tenMin)).toBe(true);
  });

  it("does not throttle once the window has elapsed (a real deploy/day later)", () => {
    expect(isReconcileThrottled(new Date(now - tenMin - 1), now, tenMin)).toBe(
      false,
    );
  });
});
