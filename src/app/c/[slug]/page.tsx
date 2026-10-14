import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { clinicSessionSlug } from "@/lib/auth/session";
import { clinicBySlug, clinicOverview } from "@/lib/services/queries";
import { localParts } from "@/lib/services/time";
import { alertStatusAction, logoutAction, simulateTonightAction } from "./actions";
import { Dot, EscalationRail, RiskPill, fmtDay } from "@/components/ui";
import { LANGUAGE_NAME } from "@/lib/calls/script";

export const dynamic = "force-dynamic";

export default async function Dashboard({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if ((await clinicSessionSlug()) !== slug) redirect(`/c/${slug}/login`);
  const clinic = await clinicBySlug(slug);
  if (!clinic) notFound();
  const { patients, checkins, alerts } = await clinicOverview(clinic.id);
  const today = localParts(clinic.timezone).day;
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today + "T12:00:00");
    d.setDate(d.getDate() - (6 - i));
    return localParts(clinic.timezone, d).day;
  });
  const open = alerts.filter((a) => a.status === "open");
  const byPatient = new Map(patients.map((p) => [p.id, p]));
  const latest = (pid: string) => checkins.find((c) => c.patientId === pid && c.risk);
  const simulate = simulateTonightAction.bind(null, slug);
  const logout = logoutAction.bind(null, slug);
  const tonightDone = checkins.filter((c) => c.day === today && c.risk).length;
  const live = process.env.NIGHTINGALE_MODE === "live";

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">{clinic.name} · {fmtDay(today)}</p>
          <h1 className="display mt-1 text-3xl font-medium">Tonight</h1>
          <p className="mt-1 text-sm text-ink-2">
            {patients.filter((p) => p.active).length} patients enrolled · {tonightDone} checked in today · {open.length} open alert{open.length === 1 ? "" : "s"} · mode: <span className={live ? "font-semibold text-amber" : "font-semibold"}>{live ? "live calls" : "simulated calls"}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={simulate}><button className="btn btn-primary" type="submit">Run tonight’s calls (simulated)</button></form>
          <Link href={`/c/${slug}/enroll`} className="btn btn-ghost">Enroll a patient</Link>
          <form action={logout}><button className="btn btn-ghost" type="submit">Sign out</button></form>
        </div>
      </div>

      <section className="mt-8">
        <h2 className="display text-2xl font-medium">Needs attention</h2>
        {open.length === 0 ? (
          <p className="card mt-3 p-5 text-sm text-ink-2">No open alerts. Everyone who answered tonight is okay, or has been seen to.</p>
        ) : (
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            {open
              .sort((a, b) => rank(a.level) - rank(b.level))
              .map((a) => {
                const p = byPatient.get(a.patientId)!;
                const c = checkins.find((x) => x.id === a.checkinId);
                const ack = alertStatusAction.bind(null, slug, a.id, "acknowledged", undefined);
                const resolve = alertStatusAction.bind(null, slug, a.id, "resolved", undefined);
                return (
                  <article key={a.id} className={`card rise p-5 ${a.level === "red" ? "border-red/40" : ""}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <RiskPill risk={a.level} />
                        <h3 className="display mt-1 text-xl font-medium">
                          <Link href={`/c/${slug}/p/${p.id}`} className="hover:underline">{p.firstName}</Link>
                          <span className="ml-2 text-sm font-normal text-ink-3">{p.regimen}</span>
                        </h3>
                      </div>
                      <div className="text-right text-xs text-ink-3">{c ? fmtDay(c.day) : ""}</div>
                    </div>
                    <ul className="mt-3 space-y-1 text-sm">
                      {a.reasons.map((r, i) => (
                        <li key={i} className="flex gap-2"><span className={a.level === "red" ? "text-red" : "text-amber"}>●</span><span>{r}</span></li>
                      ))}
                    </ul>
                    {c?.summary && <p className="mt-3 rounded-xl bg-cream-2 p-3 text-sm italic text-ink-2">“{c.summary}”</p>}
                    <div className="mt-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">What Nightingale did</p>
                      <div className="mt-1.5"><EscalationRail steps={a.escalation} /></div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <form action={ack}><button className="btn btn-ghost" type="submit">I’ve got it</button></form>
                      <form action={resolve}><button className="btn btn-ghost" type="submit">Resolved</button></form>
                      <Link href={`/c/${slug}/p/${p.id}`} className="btn btn-ghost">Transcript</Link>
                    </div>
                  </article>
                );
              })}
          </div>
        )}
      </section>

      <section className="mt-10">
        <div className="flex items-baseline justify-between">
          <h2 className="display text-2xl font-medium">Everyone</h2>
          <p className="text-xs text-ink-3">Last 7 evenings · click a name for transcripts and trends</p>
        </div>
        <div className="card mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-ink-3">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Patient</th>
                <th className="px-2 py-2.5 font-semibold">Language</th>
                <th className="px-2 py-2.5 font-semibold">Regimen</th>
                <th className="px-2 py-2.5 font-semibold">Calls at</th>
                <th className="px-2 py-2.5 font-semibold">{days.map((d) => d.slice(5)).join(" · ")}</th>
                <th className="px-2 py-2.5 font-semibold">Latest</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((p) => {
                const l = latest(p.id);
                return (
                  <tr key={p.id} className={`border-t border-line/70 align-top ${p.active ? "" : "opacity-50"}`}>
                    <td className="px-4 py-3 font-semibold"><Link href={`/c/${slug}/p/${p.id}`} className="hover:underline">{p.firstName}</Link></td>
                    <td className="px-2 py-3 text-ink-2">{LANGUAGE_NAME[p.locale] ?? p.locale}</td>
                    <td className="px-2 py-3 text-ink-2">{p.regimen ?? "—"}</td>
                    <td className="px-2 py-3 text-ink-2">{hourLabel(p.callHour)}</td>
                    <td className="px-2 py-3">
                      <div className="flex gap-1.5">
                        {days.map((d) => {
                          const c = checkins.find((x) => x.patientId === p.id && x.day === d && x.risk);
                          return <Dot key={d} risk={c?.risk} title={`${fmtDay(d)}: ${c?.risk ?? "no call"}`} />;
                        })}
                      </div>
                    </td>
                    <td className="max-w-md px-2 py-3 text-ink-2">
                      {l ? (<><RiskPill risk={l.risk} /> <span className="ml-1">{l.summary}</span></>) : <span className="text-ink-3">No calls yet</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

const rank = (l: string) => (l === "red" ? 0 : l === "amber" ? 1 : 2);
const hourLabel = (h: number) => `${((h + 11) % 12) + 1}:00 ${h >= 12 ? "pm" : "am"}`;
