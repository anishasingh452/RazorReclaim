import { NextRequest, NextResponse } from "next/server";
import { rejectApprovedCase } from "@/lib/orchestrator/resume-approved-case";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const reviewer: string = body.reviewer ?? "demo-reviewer";

  try {
    await rejectApprovedCase(id, reviewer);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
