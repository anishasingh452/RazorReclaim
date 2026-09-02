import { describe, expect, it } from "vitest";
import { computeScheduledFor } from "./scheduled-actions";

describe("computeScheduledFor", () => {
  it("adds the given number of hours to the from-timestamp", () => {
    const result = computeScheduledFor("2026-01-01T00:00:00.000Z", 24);
    expect(result).toBe("2026-01-02T00:00:00.000Z");
  });

  it("handles fractional hours", () => {
    const result = computeScheduledFor("2026-01-01T00:00:00.000Z", 1.5);
    expect(result).toBe("2026-01-01T01:30:00.000Z");
  });

  it("handles zero delay (returns the same instant)", () => {
    expect(computeScheduledFor("2026-01-01T00:00:00.000Z", 0)).toBe("2026-01-01T00:00:00.000Z");
  });

  it("rolls over month/year boundaries correctly", () => {
    expect(computeScheduledFor("2026-12-31T18:00:00.000Z", 12)).toBe("2027-01-01T06:00:00.000Z");
  });
});
