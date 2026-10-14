import { NextResponse } from "next/server";
import { resetDemoClinic } from "@/lib/services/seed";

export const maxDuration = 300;

/** Rebuilds the shared demo clinic. Protected by CRON_SECRET; the daily cron calls it so judges always see a clean story. */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const url = new URL(req.url);
  if (!process.env.CRON_SECRET || (auth !== `Bearer ${process.env.CRON_SECRET}` && url.searchParams.get("secret") !== process.env.CRON_SECRET)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json({ ok: true, summary: await resetDemoClinic() });
}
