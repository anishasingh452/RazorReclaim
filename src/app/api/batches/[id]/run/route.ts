import { NextRequest } from "next/server";
import { runBatch } from "@/lib/orchestrator/batch-orchestrator";
import type { BatchStreamEvent } from "@/types/domain";

// Batches can take longer than the default serverless timeout on larger
// case counts — raise it where the hosting plan honors this (Vercel Fluid
// Compute / Pro). On the Hobby plan this caps at 60s regardless.
export const maxDuration = 300;

/**
 * Streams the batch run live over SSE within a single held-open request
 * (not the browser's EventSource, which can't POST — the client reads this
 * response body directly). Every event here is a genuinely live execution:
 * this route does nothing but forward the orchestrator's real-time
 * onEvent callbacks as they happen.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: batchId } = await params;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: BatchStreamEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      try {
        await runBatch({ batchId, onEvent: send });
      } catch (err) {
        send({
          type: "batch_complete",
          batchId,
          status: "failed",
          timestamp: new Date().toISOString(),
          detail: { error: String(err) },
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
