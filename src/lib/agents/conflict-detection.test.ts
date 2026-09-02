import { describe, expect, it } from "vitest";
import { detectConflicts, type ProposalForConflictCheck } from "./conflict-detection";

function proposal(overrides: Partial<ProposalForConflictCheck>): ProposalForConflictCheck {
  return { id: "p1", agentName: "agent_a", proposedAction: "retry", proposedChannel: null, ...overrides };
}

describe("detectConflicts", () => {
  it("returns no conflicts for a single proposal", () => {
    expect(detectConflicts([proposal({ id: "p1" })])).toEqual([]);
  });

  it("returns no conflicts for an empty list", () => {
    expect(detectConflicts([])).toEqual([]);
  });

  it("flags a duplicate_action when all agents propose the exact same action", () => {
    const conflicts = detectConflicts([
      proposal({ id: "p1", agentName: "ai_recovery_agent", proposedAction: "payment_link" }),
      proposal({ id: "p2", agentName: "channel_strategy_agent", proposedAction: "payment_link" }),
    ]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].conflictType).toBe("duplicate_action");
    expect(conflicts[0].proposalIds).toEqual(["p1", "p2"]);
  });

  it("flags contradictory_strategy when one agent proposes engagement and another proposes stop/no_action", () => {
    const conflicts = detectConflicts([
      proposal({ id: "p1", agentName: "ai_recovery_agent", proposedAction: "voice" }),
      proposal({ id: "p2", agentName: "channel_strategy_agent", proposedAction: "no_action" }),
    ]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].conflictType).toBe("contradictory_strategy");
  });

  it("flags competing_channel when multiple agents propose different communication channels", () => {
    const conflicts = detectConflicts([
      proposal({ id: "p1", agentName: "ai_recovery_agent", proposedAction: "reminder", proposedChannel: "email" }),
      proposal({ id: "p2", agentName: "channel_strategy_agent", proposedAction: "voice", proposedChannel: "voice" }),
    ]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].conflictType).toBe("competing_channel");
  });

  it("falls back to conflicting_action for a generic disagreement (e.g. retry vs escalate)", () => {
    const conflicts = detectConflicts([
      proposal({ id: "p1", agentName: "ai_recovery_agent", proposedAction: "retry" }),
      proposal({ id: "p2", agentName: "channel_strategy_agent", proposedAction: "escalate" }),
    ]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].conflictType).toBe("conflicting_action");
  });

  it("includes every agent name in the detail string for traceability", () => {
    const conflicts = detectConflicts([
      proposal({ id: "p1", agentName: "ai_recovery_agent", proposedAction: "retry" }),
      proposal({ id: "p2", agentName: "channel_strategy_agent", proposedAction: "escalate" }),
    ]);
    expect(conflicts[0].detail).toContain("ai_recovery_agent");
    expect(conflicts[0].detail).toContain("channel_strategy_agent");
  });
});
