import { NextResponse } from "next/server";
import { processCall } from "@/lib/services/checkin";
import type { ProviderCall } from "@/lib/calls/provider";

export const maxDuration = 60;
const seen = new Set<string>();

export async function POST(req: Request, ctx: { params: Promise<{ secret: string }> }) {
  const { secret } = await ctx.params;
  if (!process.env.WEBHOOK_SECRET || secret !== process.env.WEBHOOK_SECRET) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => null)) as { id?: string; type?: string; data?: Record<string, unknown> } | null;
  const headerId = req.headers.get("CALL-E-Event-Id");
  if (!body?.id || !body.data || (headerId && headerId !== body.id)) return NextResponse.json({ error: "bad event" }, { status: 400 });
  if (seen.has(body.id)) return NextResponse.json({ ok: true, duplicate: true });
  seen.add(body.id);
  const d = body.data;
  if (d.object !== "call") return NextResponse.json({ ok: true, ignored: true });
  const call: ProviderCall = {
    id: String(d.id),
    status: d.status as ProviderCall["status"],
    callOutcome: (d.call_outcome as ProviderCall["callOutcome"]) ?? null,
    resultStatus: d.result_status as ProviderCall["resultStatus"],
    transcript: (d.transcript as ProviderCall["transcript"]) ?? [],
    result: (d.result as ProviderCall["result"]) ?? null,
    error: (d.error as ProviderCall["error"]) ?? null,
    locale: String(d.locale ?? ""),
    metadata: (d.metadata as Record<string, unknown>) ?? {},
    createdAt: String(d.created_at ?? ""),
    completedAt: (d.completed_at as string | null) ?? null,
  };
  await processCall(call);
  return NextResponse.json({ ok: true });
}
