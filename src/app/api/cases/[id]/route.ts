import { NextResponse } from "next/server";
import { getCaseDetail } from "@/lib/cases/get-case-detail";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getCaseDetail(id);
  if (!detail) return NextResponse.json({ error: "Case not found" }, { status: 404 });
  return NextResponse.json(detail);
}
