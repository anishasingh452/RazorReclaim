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

type Route = "escalate" | "stop" | "defer" | "execute";

function routeAfterPolicy(state: CaseGraphState): Route {
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
    .addEdge("execute", "verify")
    .addEdge("verify", END);

  return graph.compile();
}
