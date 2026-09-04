import { describe, expect, it } from "vitest";
import { classifyStuckCase, STUCK_CASE_STALE_AFTER_MS, type StuckCaseInput } from "./stuck-case-policy";

const NOW = Date.parse("2026-01-01T12:00:00.000Z");
const FRESH = new Date(NOW - 5_000).toISOString(); // 5s ago — well inside the window
const STALE = new Date(NOW - STUCK_CASE_STALE_AFTER_MS - 1_000).toISOString(); // just past the threshold

const BASE: StuckCaseInput = {
  lastActivityAt: STALE,
  now: NOW,
  latestExecution: null,
  hasVerification: false,
  verificationVerified: null,
  hasPendingApproval: false,
};

describe("classifyStuckCase", () => {
  describe("staleness gate", () => {
    it("leaves a recently-active case alone regardless of what else is true", () => {
      expect(classifyStuckCase({ ...BASE, lastActivityAt: FRESH })).toEqual({ type: "skip_active" });
      expect(
        classifyStuckCase({
          ...BASE,
          lastActivityAt: FRESH,
          latestExecution: { actionType: "retry", status: "success" },
        })
      ).toEqual({ type: "skip_active" });
    });

    it("treats a case exactly at the threshold as stale (inclusive boundary)", () => {
      const exactlyAtThreshold = new Date(NOW - STUCK_CASE_STALE_AFTER_MS).toISOString();
      expect(classifyStuckCase({ ...BASE, lastActivityAt: exactlyAtThreshold })).not.toEqual({ type: "skip_active" });
    });

    it("treats a case one millisecond short of the threshold as still active", () => {
      const justShort = new Date(NOW - STUCK_CASE_STALE_AFTER_MS + 1).toISOString();
      expect(classifyStuckCase({ ...BASE, lastActivityAt: justShort })).toEqual({ type: "skip_active" });
    });
  });

  describe("no execution ever ran", () => {
    it("restarts a case that died before executing anything", () => {
      expect(classifyStuckCase(BASE)).toEqual({ type: "reset_to_open" });
    });

    it("never restarts a case that already created a pending approval — just repairs its status", () => {
      expect(classifyStuckCase({ ...BASE, hasPendingApproval: true })).toEqual({
        type: "correct_status",
        status: "awaiting_approval",
      });
    });
  });

  describe("payment_link / reminder — the real-webhook-pending state", () => {
    it("is never touched no matter how long it has been waiting", () => {
      const forever = new Date(0).toISOString(); // effectively infinitely stale
      for (const actionType of ["payment_link", "reminder"] as const) {
        expect(
          classifyStuckCase({
            ...BASE,
            lastActivityAt: forever,
            latestExecution: { actionType, status: "success" },
          })
        ).toEqual({ type: "skip_awaiting_webhook" });
      }
    });

    it("is corrected, not skipped, if the execution itself recorded as failed", () => {
      expect(
        classifyStuckCase({
          ...BASE,
          latestExecution: { actionType: "payment_link", status: "failed" },
        })
      ).toEqual({ type: "correct_status", status: "failed" });
    });
  });

  describe("stop / no_action — executed but the status column lagged", () => {
    it("corrects stop to stopped", () => {
      expect(classifyStuckCase({ ...BASE, latestExecution: { actionType: "stop", status: "success" } })).toEqual({
        type: "correct_status",
        status: "stopped",
      });
    });

    it("corrects no_action to closed", () => {
      expect(classifyStuckCase({ ...BASE, latestExecution: { actionType: "no_action", status: "success" } })).toEqual(
        { type: "correct_status", status: "closed" }
      );
    });
  });

  describe("retry / voice — deterministic, verify may need to be completed or just recorded", () => {
    it("resumes verification when the execution succeeded but nothing verified it yet", () => {
      for (const actionType of ["retry", "voice"] as const) {
        expect(
          classifyStuckCase({ ...BASE, latestExecution: { actionType, status: "success" }, hasVerification: false })
        ).toEqual({ type: "resume_verify" });
      }
    });

    it("corrects the case to recovered when a verification already exists and says verified", () => {
      expect(
        classifyStuckCase({
          ...BASE,
          latestExecution: { actionType: "retry", status: "success" },
          hasVerification: true,
          verificationVerified: true,
        })
      ).toEqual({ type: "correct_status", status: "recovered" });
    });

    it("corrects the case to closed when a verification already exists and says not verified", () => {
      expect(
        classifyStuckCase({
          ...BASE,
          latestExecution: { actionType: "voice", status: "success" },
          hasVerification: true,
          verificationVerified: false,
        })
      ).toEqual({ type: "correct_status", status: "closed" });
    });
  });

  describe("any execution recorded as failed", () => {
    it("corrects status to failed instead of touching verification or restarting", () => {
      for (const actionType of ["retry", "voice", "stop", "no_action"] as const) {
        expect(classifyStuckCase({ ...BASE, latestExecution: { actionType, status: "failed" } })).toEqual({
          type: "correct_status",
          status: "failed",
        });
      }
    });
  });

  it("never produces an action that would call executeNode again", () => {
    // Every branch this function can reach — none of them is "re-execute".
    // This is the single most important invariant of the whole module.
    const actionTypes = ["retry", "payment_link", "reminder", "voice", "stop", "no_action"] as const;
    const statuses = ["pending", "success", "failed"] as const;
    const verifiedValues = [true, false, null] as const;

    for (const actionType of actionTypes) {
      for (const status of statuses) {
        for (const hasVerification of [true, false]) {
          for (const verificationVerified of verifiedValues) {
            for (const hasPendingApproval of [true, false]) {
              for (const stale of [true, false]) {
                const action = classifyStuckCase({
                  lastActivityAt: stale ? STALE : FRESH,
                  now: NOW,
                  latestExecution: { actionType, status },
                  hasVerification,
                  verificationVerified,
                  hasPendingApproval,
                });
                expect(["skip_active", "skip_awaiting_webhook", "reset_to_open", "resume_verify", "correct_status"]).toContain(
                  action.type
                );
              }
            }
          }
        }
      }
    }
  });
});
