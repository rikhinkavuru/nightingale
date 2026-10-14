import { notFound, redirect } from "next/navigation";
import { clinicSessionSlug } from "@/lib/auth/session";
import { clinicBySlug } from "@/lib/services/queries";
import { enrollAction } from "../actions";
import { SUPPORTED_LOCALES } from "@/lib/calls/script";

export default async function Enroll({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ error?: string }> }) {
  const { slug } = await params;
  const { error } = await searchParams;
  if ((await clinicSessionSlug()) !== slug) redirect(`/c/${slug}/login`);
  const clinic = await clinicBySlug(slug);
  if (!clinic) notFound();
  const action = enrollAction.bind(null, slug);
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="display text-3xl font-medium">Enroll a patient</h1>
      <p className="mt-1 text-sm text-ink-2">Thirty seconds. The patient needs nothing but a phone that rings.</p>
      <form action={action} className="card mt-6 grid gap-4 p-5 sm:grid-cols-2">
        <label className="block text-sm"><span className="text-ink-2">First name</span><input name="firstName" required className="field mt-1" /></label>
        <label className="block text-sm"><span className="text-ink-2">Phone (E.164, e.g. +15551234567)</span><input name="phone" required className="field mt-1" placeholder="+1" />{error === "phone" && <span className="text-xs text-red">Use international format, like +15551234567.</span>}</label>
        <label className="block text-sm"><span className="text-ink-2">Language of the call</span>
          <select name="locale" className="field mt-1" defaultValue="en-US">{SUPPORTED_LOCALES.map((l) => (<option key={l.code} value={l.code}>{l.label}</option>))}</select>
        </label>
        <label className="block text-sm"><span className="text-ink-2">Call at (local hour)</span>
          <select name="callHour" className="field mt-1" defaultValue="18">{Array.from({ length: 24 }, (_, h) => (<option key={h} value={h}>{((h + 11) % 12) + 1}:00 {h >= 12 ? "pm" : "am"}</option>))}</select>
        </label>
        <label className="block text-sm"><span className="text-ink-2">Timezone</span><input name="timezone" className="field mt-1" defaultValue={clinic.timezone} /></label>
        <label className="block text-sm"><span className="text-ink-2">Regimen</span><input name="regimen" className="field mt-1" placeholder="e.g. FOLFOX" /></label>
        <label className="block text-sm"><span className="text-ink-2">Last infusion date</span><input name="lastInfusionDate" type="date" className="field mt-1" /></label>
        <div />
        <label className="block text-sm"><span className="text-ink-2">Caregiver name</span><input name="caregiverName" className="field mt-1" /></label>
        <label className="block text-sm"><span className="text-ink-2">Caregiver phone</span><input name="caregiverPhone" className="field mt-1" placeholder="+1" /></label>
        <label className="block text-sm sm:col-span-2"><span className="text-ink-2">Notes for the call (optional)</span><input name="notes" className="field mt-1" placeholder="e.g. hard of hearing, prefers slow speech" /></label>
        <label className="flex items-start gap-2 text-sm sm:col-span-2"><input type="checkbox" name="consent" required className="mt-1" /><span>The patient agreed to automated, recorded evening check-in calls and understands they are not a substitute for calling the clinic or 911.</span></label>
        <div className="sm:col-span-2"><button className="btn btn-primary" type="submit">Enroll</button></div>
      </form>
    </main>
  );
}
