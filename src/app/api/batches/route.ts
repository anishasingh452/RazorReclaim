import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/db/service-client";
import { seedBatch } from "@/lib/generator/seed-batch";

export async function GET() {
  const supabase = getServiceClient();
  const { data, error } = await supabase.from("batches").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ batches: data });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const name: string = body.name ?? `Batch ${new Date().toISOString()}`;
  const caseCount: number = Number(body.caseCount ?? 150);
  const seed: string = body.seed ?? `seed-${Date.now()}`;
  const concurrency: number | undefined = body.concurrency ? Number(body.concurrency) : undefined;

  if (caseCount < 1 || caseCount > 500) {
    return NextResponse.json({ error: "caseCount must be between 1 and 500" }, { status: 400 });
  }

  try {
    const result = await seedBatch({ name, seed, caseCount, concurrency });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
