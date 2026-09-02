import { describe, expect, it } from "vitest";
import { toDecisionCategory } from "./decision-category";

describe("toDecisionCategory", () => {
  it.each([
    ["retry", "ACT"],
    ["payment_link", "ACT"],
    ["reminder", "ACT"],
    ["voice", "ACT"],
    ["wait_and_retry", "WAIT"],
    ["escalate", "ESCALATE"],
    ["no_action", "NO_ACTION"],
    ["stop", "STOP"],
  ] as const)("%s -> %s", (action, expected) => {
    expect(toDecisionCategory(action)).toBe(expected);
  });
});
