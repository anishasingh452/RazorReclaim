import { buildCaseGraph } from "./graph";
import type { CaseGraphState } from "./state";

let compiledGraph: ReturnType<typeof buildCaseGraph> | null = null;

function getCompiledGraph() {
  if (!compiledGraph) compiledGraph = buildCaseGraph();
  return compiledGraph;
}

/** Runs the full per-case LangGraph pipeline to completion and returns the final state. */
export async function runCaseGraph(caseId: string): Promise<CaseGraphState> {
  const graph = getCompiledGraph();
  const result = await graph.invoke({ caseId });
  return result as CaseGraphState;
}
