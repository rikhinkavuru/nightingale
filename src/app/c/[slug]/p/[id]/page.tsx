import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { clinicSessionSlug } from "@/lib/auth/session";
import { clinicBySlug, patientDetail } from "@/lib/services/queries";
import { callNowAction, toggleActiveAction } from "../../actions";
import { EscalationRail, RiskPill, Transcript, fmtDay } from "@/components/ui";
import { LANGUAGE_NAME } from "@/lib/calls/script";
import { daysBetween, localParts } from "@/lib/services/time";

export const dynamic = "force-dynamic";

const TREND: { key: string; label: string; max: number }[] = [
  { key: "nausea", label: "Nausea", max: 4 },
  { key: "fatigue", label: "Fatigue", max: 4 },
  { key: "pain", label: "Pain", max: 10 },
  { key: "shortness_of_breath", label: "Breathing", max: 4 },
  { key: "mouth_sores", label: "Mouth sores", max: 4 },
  { key: "numbness_tingling", label: "Numbness", max: 4 },
  { key: "low_mood", label: "Mood", max: 4 },
];
const SCENARIOS = [
  ["fine", "Feeling fine"], ["tired", "Tired, mild nausea"], ["nausea_worse", "Nausea worse, vomiting"], ["fever", "Fever 100.9°F (urgent)"], ["breathing", "Short of breath (emergency)"],
  ["meds_question", "Medication question"], ["low_mood", "Low mood, wants a call"], ["caregiver", "Caregiver answers"], ["later", "Asks to be called later"], ["no_answer", "No answer"],
];

export default async function PatientPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  if ((await clinicSessionSlug()) !== slug) redirect(`/c/${slug}/login`);
  const clinic = await clinicBySlug(slug);
  if (!clinic) notFound();
  const data = await patientDetail(clinic.id, id);
  if (!data) notFound();
  const { patient, checkins, alerts } = data;
  const completed = checkins.filter((c) => c.result && c.risk && c.risk !== "unreachable").slice().reverse();
  const callNow = callNowAction.bind(null, slug, patient.id);
  const toggle = toggleActiveAction.bind(null, slug, patient.id);
  const live = process.env.NIGHTINGALE_MODE === "live";
  const today = localParts(patient.timezone).day;
  const dayN = patient.lastInfusionDate ? daysBetween(patient.lastInfusionDate, today) : null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Link href={`/c/${slug}`} className="text-sm text-ink-3 hover:text-ink">← {clinic.name}</Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-4xl font-medium">{patient.firstName}</h1>
          <p className="mt-1 text-sm text-ink-2">
            {patient.regimen ?? "No regimen recorded"}{dayN !== null ? ` · day ${dayN} after last infusion` : ""} · speaks {LANGUAGE_NAME[patient.locale] ?? patient.locale} · called at {((patient.callHour + 11) % 12) + 1}:00 {patient.callHour >= 12 ? "pm" : "am"} {patient.timezone}
            {patient.caregiverName ? ` · caregiver ${patient.caregiverName}` : ""}
            {!patient.active ? " · paused" : ""}
          </p>
        </div>
        <form action={toggle}><button className="btn btn-ghost" type="submit">{patient.active ? "Pause calls" : "Resume calls"}</button></form>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="display text-xl font-medium">Trend</h2>
            {completed.length === 0 ? (
              <p className="mt-2 text-sm text-ink-3">No completed check-ins yet.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="text-xs">
                  <thead>
                    <tr>
                      <th className="pr-3 text-left font-semibold text-ink-3"> </th>
                      {completed.map((c) => (<th key={c.id} className="px-1 text-center font-medium text-ink-3">{c.day.slice(5)}</th>))}
                    </tr>
                  </thead>
                  <tbody>
                    {TREND.map((t) => (
                      <tr key={t.key}>
                        <td className="pr-3 text-ink-2">{t.label}</td>
                        {completed.map((c) => {
                          const v = Number((c.result as Record<string, unknown>)?.[t.key] ?? 0);
                          const pct = Math.min(1, v / t.max);
                          return (
                            <td key={c.id} className="px-1 text-center">
                              <div className="mx-auto flex h-10 w-5 items-end rounded bg-cream-2" title={`${t.label} ${v}/${t.max}`}>
                                <div className={`w-full rounded ${pct >= 0.75 ? "bg-red" : pct >= 0.5 ? "bg-amber" : "bg-night"}`} style={{ height: `${Math.max(4, pct * 100)}%`, opacity: v === 0 ? 0.15 : 1 }} />
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    <tr>
                      <td className="pr-3 pt-2 text-ink-2">Overall</td>
                      {completed.map((c) => (<td key={c.id} className="px-1 pt-2 text-center"><RiskPill risk={c.risk} /></td>))}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section>
            <h2 className="display text-xl font-medium">Calls</h2>
            <div className="mt-3 space-y-3">
              {checkins.map((c) => {
                const alert = alerts.find((a) => a.checkinId === c.id);
                return (
                  <details key={c.id} className="card p-4" open={c === checkins[0]}>
                    <summary className="flex flex-wrap items-center gap-3">
                      <RiskPill risk={c.risk} />
                      <span className="font-semibold">{fmtDay(c.day)}</span>
                      <span className="text-xs text-ink-3">attempt {c.attempt} · {c.callOutcome ?? c.status} · {c.mode === "live" ? "live call" : "simulated"}</span>
                      <span className="w-full text-sm text-ink-2 md:w-auto md:flex-1">{c.summary}</span>
                    </summary>
                    {(c.reasons ?? []).length > 0 && (
                      <ul className="mt-3 space-y-1 text-sm">
                        {(c.reasons ?? []).map((r, i) => (<li key={i} className="flex gap-2"><span className={c.risk === "red" ? "text-red" : "text-amber"}>●</span>{r}</li>))}
                      </ul>
                    )}
                    {alert && (
                      <div className="mt-3 rounded-xl bg-cream-2 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">Escalation · {alert.status}</p>
                        <div className="mt-1.5"><EscalationRail steps={alert.escalation} /></div>
                      </div>
                    )}
                    <div className="mt-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">Transcript</p>
                      <div className="mt-1.5"><Transcript turns={c.transcript ?? []} /></div>
                    </div>
                  </details>
                );
              })}
              {checkins.length === 0 && <p className="card p-5 text-sm text-ink-3">No calls yet. The first one goes out at the chosen hour, or use “Call now”.</p>}
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <form action={callNow} className="card p-5">
            <h2 className="display text-xl font-medium">Call now</h2>
            <p className="mt-1 text-xs text-ink-2">{live ? "Places a real call to the patient's phone through CALL-E, in their language." : "Simulated: pick what the patient says tonight and watch the rest happen."}</p>
            {!live && (
              <select name="scenario" className="field mt-3">
                {SCENARIOS.map(([v, l]) => (<option key={v} value={v}>{l}</option>))}
              </select>
            )}
            {live && <input type="hidden" name="live" value="1" />}
            <button className={`btn mt-3 w-full ${live ? "btn-amber" : "btn-primary"}`} type="submit">{live ? "Place the call" : "Simulate the call"}</button>
          </form>
          <div className="card p-5 text-sm">
            <h2 className="display text-xl font-medium">Details</h2>
            <dl className="mt-2 space-y-1 text-ink-2">
              <div><dt className="inline text-ink-3">Phone </dt><dd className="inline">{patient.phone.replace(/\d(?=\d{4})/g, "•")}</dd></div>
              <div><dt className="inline text-ink-3">Last infusion </dt><dd className="inline">{patient.lastInfusionDate ?? "—"}</dd></div>
              <div><dt className="inline text-ink-3">Caregiver </dt><dd className="inline">{patient.caregiverName ? `${patient.caregiverName} ${patient.caregiverPhone?.replace(/\d(?=\d{4})/g, "•") ?? ""}` : "—"}</dd></div>
              <div><dt className="inline text-ink-3">Consent </dt><dd className="inline">{patient.consentAt ? new Date(patient.consentAt).toLocaleDateString() : "not recorded"}</dd></div>
              {patient.notes && <div><dt className="inline text-ink-3">Notes </dt><dd className="inline">{patient.notes}</dd></div>}
            </dl>
          </div>
        </aside>
      </div>
    </main>
  );
}
