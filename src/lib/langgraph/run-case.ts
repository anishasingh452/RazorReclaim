import { buildCaseGraph } from "./graph";
import type { CaseGraphState, CaseGraphUpdate } from "./state";

let compiledGraph: ReturnType<typeof buildCaseGraph> | null = null;

function getCompiledGraph() {
  if (!compiledGraph) compiledGraph = buildCaseGraph();
  return compiledGraph;
}

export type StageCallback = (nodeName: string, update: CaseGraphUpdate) => void;

/**
 * Runs the full per-case LangGraph pipeline to completion. Uses `.stream()`
 * (not `.invoke()`) so callers — namely the Batch Orchestrator — can observe
 * each node completing in real time (for the stage-funnel / live ticker UI)
 * without threading a callback through graph state itself. All state
 * reducers are plain overwrite, so accumulating stream chunks reconstructs
 * the same final state `.invoke()` would return.
 */
export async function runCaseGraph(caseId: string, onStage?: StageCallback): Promise<CaseGraphState> {
  const graph = getCompiledGraph();
  const stream = await graph.stream({ caseId }, { streamMode: "updates" });

  let state = { caseId } as CaseGraphState;
  for await (const chunk of stream) {
    for (const [nodeName, update] of Object.entries(chunk as Record<string, CaseGraphUpdate>)) {
      state = { ...state, ...update };
      onStage?.(nodeName, update);
    }
  }
  return state;
}
