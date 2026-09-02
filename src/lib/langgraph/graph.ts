import { StateGraph, START, END } from "@langchain/langgraph";
import { CaseGraphAnnotation, type CaseGraphState } from "./state";
import { detectNode } from "./nodes/detect";
import { rootCauseNode } from "./nodes/root-cause";
import { recommendNode } from "./nodes/recommend";
import { businessImpactNode } from "./nodes/business-impact";
import { policyNode } from "./nodes/policy";
import { escalateNode } from "./nodes/escalate";
import { stopNode } from "./nodes/stop";
import { deferNode } from "./nodes/defer";
import { executeNode } from "./nodes/execute";
import { verifyNode } from "./nodes/verify";

type PolicyRoute = "escalate" | "stop" | "defer" | "execute";

function routeAfterPolicy(state: CaseGraphState): PolicyRoute {
  switch (state.finalAction) {
    case "escalate":
      return "escalate";
    case "stop":
      return "stop";
    case "wait_and_retry":
      return "defer";
    default:
      return "execute";
  }
}

type ExecuteRoute = "verify" | "end";

/**
 * `retry` is simulated (no real payment vehicle to wait on), so it verifies
 * synchronously within the same run. `payment_link`/`reminder` create a real
 * Razorpay Payment Link — verification is asynchronous (webhook or the demo
 * simulate-payment trigger), so the graph ends here rather than guessing an
 * outcome. A failed execution (Razorpay/Resend error) also ends here.
 */
function routeAfterExecute(state: CaseGraphState): ExecuteRoute {
  if (state.executionResult?.status === "failed") return "end";
  return state.finalAction === "retry" ? "verify" : "end";
}

export function buildCaseGraph() {
  const graph = new StateGraph(CaseGraphAnnotation)
    .addNode("detect", detectNode)
    .addNode("root_cause", rootCauseNode)
    .addNode("recommend", recommendNode)
    .addNode("business_impact", businessImpactNode)
    .addNode("policy", policyNode)
    .addNode("escalate", escalateNode)
    .addNode("stop", stopNode)
    .addNode("defer", deferNode)
    .addNode("execute", executeNode)
    .addNode("verify", verifyNode)
    .addEdge(START, "detect")
    .addEdge("detect", "root_cause")
    .addEdge("root_cause", "recommend")
    .addEdge("recommend", "business_impact")
    .addEdge("business_impact", "policy")
    .addConditionalEdges("policy", routeAfterPolicy, {
      escalate: "escalate",
      stop: "stop",
      defer: "defer",
      execute: "execute",
    })
    .addEdge("escalate", END)
    .addEdge("stop", END)
    .addEdge("defer", END)
    .addConditionalEdges("execute", routeAfterExecute, {
      verify: "verify",
      end: END,
    })
    .addEdge("verify", END);

  return graph.compile();
}
