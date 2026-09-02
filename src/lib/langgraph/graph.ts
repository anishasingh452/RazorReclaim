import { StateGraph, START, END } from "@langchain/langgraph";
import { CaseGraphAnnotation, type CaseGraphState } from "./state";
import { detectNode } from "./nodes/detect";
import { rootCauseNode } from "./nodes/root-cause";
import { recommendNode } from "./nodes/recommend";
import { agentProposalsNode } from "./nodes/agent-proposals";
import { sharedContextConflictNode } from "./nodes/shared-context-conflict";
import { businessImpactNode } from "./nodes/business-impact";
import { policyNode } from "./nodes/policy";
import { finalDecisionNode } from "./nodes/final-decision";
import { escalateNode } from "./nodes/escalate";
import { deferNode } from "./nodes/defer";
import { executeNode } from "./nodes/execute";
import { verifyNode } from "./nodes/verify";

type PolicyRoute = "escalate" | "defer" | "execute";

/**
 * `escalate` goes to the human approval queue; `wait_and_retry` defers
 * (nothing executed yet). Every other unified action — retry, payment_link,
 * reminder, voice, stop, no_action — is a real, ledger-worthy decision and
 * flows through executeNode, which is what makes the executions table the
 * single source of truth for every action taken on a case, including
 * deliberate non-engagement.
 */
function routeAfterFinalDecision(state: CaseGraphState): PolicyRoute {
  switch (state.finalAction) {
    case "escalate":
      return "escalate";
    case "wait_and_retry":
      return "defer";
    default:
      return "execute";
  }
}

type ExecuteRoute = "verify" | "end";

/**
 * `retry` and `voice` are simulated (no real payment vehicle / telephony
 * provider to await), so they verify synchronously within the same run.
 * `payment_link`/`reminder` create a real Razorpay Payment Link —
 * verification is asynchronous (webhook or the demo simulate-payment
 * trigger). `stop`/`no_action` have nothing to verify. A failed execution
 * (Razorpay/Resend error) also ends here.
 */
function routeAfterExecute(state: CaseGraphState): ExecuteRoute {
  if (state.executionResult?.status === "failed") return "end";
  return state.finalAction === "retry" || state.finalAction === "voice" ? "verify" : "end";
}

/**
 * Unified Decision Command Center lifecycle:
 *   SIGNAL/CASE (pre-existing, at seed time) -> detect -> root_cause -> recommend
 *   -> agent_proposals -> shared_context_conflict -> business_impact (also
 *      resolves conflicts using ERV) -> policy -> final_decision (logs the
 *      5-way meta-decision + Why Not To Act) -> escalate | defer | execute -> verify
 */
export function buildCaseGraph() {
  const graph = new StateGraph(CaseGraphAnnotation)
    .addNode("detect", detectNode)
    .addNode("root_cause", rootCauseNode)
    .addNode("recommend", recommendNode)
    .addNode("agent_proposals", agentProposalsNode)
    .addNode("shared_context_conflict", sharedContextConflictNode)
    .addNode("business_impact", businessImpactNode)
    .addNode("policy", policyNode)
    .addNode("final_decision", finalDecisionNode)
    .addNode("escalate", escalateNode)
    .addNode("defer", deferNode)
    .addNode("execute", executeNode)
    .addNode("verify", verifyNode)
    .addEdge(START, "detect")
    .addEdge("detect", "root_cause")
    .addEdge("root_cause", "recommend")
    .addEdge("recommend", "agent_proposals")
    .addEdge("agent_proposals", "shared_context_conflict")
    .addEdge("shared_context_conflict", "business_impact")
    .addEdge("business_impact", "policy")
    .addEdge("policy", "final_decision")
    .addConditionalEdges("final_decision", routeAfterFinalDecision, {
      escalate: "escalate",
      defer: "defer",
      execute: "execute",
    })
    .addEdge("escalate", END)
    .addEdge("defer", END)
    .addConditionalEdges("execute", routeAfterExecute, {
      verify: "verify",
      end: END,
    })
    .addEdge("verify", END);

  return graph.compile();
}
