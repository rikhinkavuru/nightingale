"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb, schema } from "@/db";
import { clinicSessionSlug, setClinicSession, clearClinicSession } from "@/lib/auth/session";
import { dispatchCheckin } from "@/lib/services/checkin";
import { newId } from "@/lib/services/ids";
import { clinicBySlug } from "@/lib/services/queries";
import { SUPPORTED_LOCALES } from "@/lib/calls/script";
import type { Scenario } from "@/lib/calls/fake";

async function requireClinic(slug: string) {
  const s = await clinicSessionSlug();
  if (s !== slug) redirect(`/c/${slug}/login`);
  const clinic = await clinicBySlug(slug);
  if (!clinic) redirect("/");
  return clinic;
}

export async function loginAction(slug: string, formData: FormData) {
  const code = String(formData.get("code") ?? "").trim();
  const clinic = await clinicBySlug(slug);
  if (!clinic || clinic.accessCode !== code) redirect(`/c/${slug}/login?error=1`);
  await setClinicSession(slug);
  redirect(`/c/${slug}`);
}

export async function logoutAction(slug: string) {
  await clearClinicSession();
  redirect(`/c/${slug}/login`);
}

export async function enrollAction(slug: string, formData: FormData) {
  const clinic = await requireClinic(slug);
  const phone = String(formData.get("phone") ?? "").replace(/[^\d+]/g, "");
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) redirect(`/c/${slug}/enroll?error=phone`);
  const locale = String(formData.get("locale") ?? "en-US");
  if (!SUPPORTED_LOCALES.some((l) => l.code === locale)) redirect(`/c/${slug}/enroll?error=locale`);
  const id = newId("pt");
  await getDb().insert(schema.patients).values({
    id,
    clinicId: clinic.id,
    firstName: String(formData.get("firstName") ?? "").trim().slice(0, 60) || "Patient",
    phone,
    locale,
    timezone: String(formData.get("timezone") ?? clinic.timezone),
    callHour: Math.min(23, Math.max(0, Number(formData.get("callHour") ?? 18))),
    regimen: String(formData.get("regimen") ?? "").trim() || null,
    lastInfusionDate: String(formData.get("lastInfusionDate") ?? "") || null,
    caregiverName: String(formData.get("caregiverName") ?? "").trim() || null,
    caregiverPhone: String(formData.get("caregiverPhone") ?? "").replace(/[^\d+]/g, "") || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
    consentAt: formData.get("consent") ? new Date() : null,
    active: true,
  });
  revalidatePath(`/c/${slug}`);
  redirect(`/c/${slug}/p/${id}`);
}

/** Dry run: simulate tonight's calls for every active patient (judge-safe). */
export async function simulateTonightAction(slug: string) {
  const clinic = await requireClinic(slug);
  const patients = await getDb().select().from(schema.patients).where(eq(schema.patients.clinicId, clinic.id));
  for (const p of patients.filter((x) => x.active)) await dispatchCheckin(p, clinic, { mode: "dry", force: true });
  revalidatePath(`/c/${slug}`);
}

/** Call one patient now. Dry mode uses the chosen scenario; live mode places a real call (requires NIGHTINGALE_MODE=live). */
export async function callNowAction(slug: string, patientId: string, formData: FormData) {
  const clinic = await requireClinic(slug);
  const [patient] = await getDb().select().from(schema.patients).where(eq(schema.patients.id, patientId));
  if (!patient || patient.clinicId !== clinic.id) redirect(`/c/${slug}`);
  const live = formData.get("live") === "1" && process.env.NIGHTINGALE_MODE === "live";
  const scenario = String(formData.get("scenario") ?? "") as Scenario | "";
  await dispatchCheckin(patient, clinic, { mode: live ? "live" : "dry", force: true, ...(scenario && !live ? { scenario } : {}) });
  revalidatePath(`/c/${slug}/p/${patientId}`);
  revalidatePath(`/c/${slug}`);
}

export async function alertStatusAction(slug: string, alertId: string, status: "acknowledged" | "resolved", note?: string) {
  const clinic = await requireClinic(slug);
  const db = getDb();
  const [a] = await db.select({ a: schema.alerts, p: schema.patients }).from(schema.alerts).innerJoin(schema.patients, eq(schema.alerts.patientId, schema.patients.id)).where(eq(schema.alerts.id, alertId));
  if (!a || a.p.clinicId !== clinic.id) return;
  await db.update(schema.alerts).set({ status, acknowledgedAt: new Date(), ...(note !== undefined ? { clinicNote: note } : {}) }).where(eq(schema.alerts.id, alertId));
  revalidatePath(`/c/${slug}`);
  revalidatePath(`/c/${slug}/p/${a.p.id}`);
}

export async function toggleActiveAction(slug: string, patientId: string) {
  const clinic = await requireClinic(slug);
  const db = getDb();
  const [p] = await db.select().from(schema.patients).where(eq(schema.patients.id, patientId));
  if (!p || p.clinicId !== clinic.id) return;
  await db.update(schema.patients).set({ active: !p.active }).where(eq(schema.patients.id, patientId));
  revalidatePath(`/c/${slug}/p/${patientId}`);
  revalidatePath(`/c/${slug}`);
}
