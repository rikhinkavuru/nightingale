import { NextResponse } from "next/server";
import { dispatchCheckin, duePatients } from "@/lib/services/checkin";

export const maxDuration = 300;

/** Called by Vercel cron or any external scheduler. Places tonight's calls for patients whose hour has come. */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const url = new URL(req.url);
  if (!process.env.CRON_SECRET || (auth !== `Bearer ${process.env.CRON_SECRET}` && url.searchParams.get("secret") !== process.env.CRON_SECRET)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const due = await duePatients();
  const placed: string[] = [];
  for (const { patient, clinic } of due) {
    try {
      const c = await dispatchCheckin(patient, clinic);
      placed.push(`${patient.id}:${c.status}`);
    } catch (e) {
      placed.push(`${patient.id}:error:${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return NextResponse.json({ due: due.length, placed });
}
