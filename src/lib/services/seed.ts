import { eq, inArray, lt } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { dispatchCheckin } from "./checkin";
import { newId } from "./ids";
import { localParts } from "./time";

export const DEMO_SLUG = "lakeside";

const PATIENTS = [
  { firstName: "Rosa", phone: "+15555550101", locale: "es-MX", regimen: "AC-T (breast)", caregiverName: "Luis", caregiverPhone: "+15555550191", history: ["fine", "fine", "tired", "tired", "nausea_worse", "fever"] },
  { firstName: "Walter", phone: "+15555550102", locale: "en-US", regimen: "FOLFOX (colon)", caregiverName: "Dorothy", caregiverPhone: "+15555550192", history: ["fine", "fine", "fine", "meds_question", "fine", "fine"] },
  { firstName: "Mei", phone: "+15555550103", locale: "en-US", regimen: "Carboplatin + paclitaxel (ovarian)", history: ["fine", "tired", "fine", "fine", "tired", "tired"] },
  { firstName: "Daniel", phone: "+15555550104", locale: "en-US", regimen: "R-CHOP (lymphoma)", caregiverName: "Priya", caregiverPhone: "+15555550194", history: ["fine", "fine", "no_answer", "fine", "low_mood", "fine"] },
  { firstName: "Agnes", phone: "+15555550105", locale: "en-US", regimen: "Cisplatin + etoposide (lung)", caregiverName: "Tom", caregiverPhone: "+15555550195", history: ["tired", "tired", "fine", "fine", "tired", "breathing"] },
  { firstName: "Javier", phone: "+15555550106", locale: "es-MX", regimen: "Gemcitabine (pancreas)", history: ["fine", "fine", "fine", "fine", "fine", "fine"] },
  { firstName: "Ruth", phone: "+15555550107", locale: "en-US", regimen: "Docetaxel (prostate)", caregiverName: "Sam", caregiverPhone: "+15555550197", history: ["fine", "caregiver", "caregiver", "fine", "fine", "fine"] },
  { firstName: "Hiro", phone: "+15555550108", locale: "en-US", regimen: "Cisplatin + 5-FU (head and neck)", history: ["fine", "fine", "tired", "fine", "no_answer", "later"] },
];

function dayMinus(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localParts("America/New_York", d).day;
}

/** Rebuild the shared demo clinic from scratch. Returns a short summary. */
export async function resetDemoClinic(): Promise<string> {
  const db = getDb();
  const [existing] = await db.select().from(schema.clinics).where(eq(schema.clinics.slug, DEMO_SLUG));
  if (existing) {
    const ps = await db.select({ id: schema.patients.id }).from(schema.patients).where(eq(schema.patients.clinicId, existing.id));
    const ids = ps.map((p) => p.id);
    if (ids.length) {
      await db.delete(schema.alerts).where(inArray(schema.alerts.patientId, ids));
      await db.delete(schema.checkins).where(inArray(schema.checkins.patientId, ids));
      await db.delete(schema.patients).where(inArray(schema.patients.id, ids));
    }
    await db.delete(schema.clinics).where(eq(schema.clinics.id, existing.id));
  }
  const clinic = { id: newId("cl"), slug: DEMO_SLUG, name: "Lakeside Oncology", onCallPhone: "+15555550100", escalationEmail: "triage@lakeside.example", timezone: "America/New_York", accessCode: "demo", createdAt: new Date() };
  await db.insert(schema.clinics).values(clinic);
  await db.insert(schema.patients).values(
    PATIENTS.map((p, i) => ({
      id: newId("pt"),
      clinicId: clinic.id,
      firstName: p.firstName,
      phone: p.phone,
      locale: p.locale,
      timezone: "America/New_York",
      callHour: 18,
      regimen: p.regimen,
      lastInfusionDate: dayMinus(4 + ((i * 3) % 7)),
      caregiverName: p.caregiverName ?? null,
      caregiverPhone: p.caregiverPhone ?? null,
      consentAt: new Date(),
      active: true,
    })),
  );
  const full = await db.select().from(schema.patients).where(eq(schema.patients.clinicId, clinic.id));
  let n = 0;
  for (const p of PATIENTS) {
    const patient = full.find((x) => x.firstName === p.firstName)!;
    for (let i = 0; i < p.history.length; i++) {
      await dispatchCheckin(patient, clinic, { mode: "dry", scenario: p.history[i], day: dayMinus(p.history.length - 1 - i) });
      n++;
    }
  }
  // Earlier evenings were handled by the (fictional) nurses; only tonight is open.
  const today = dayMinus(0);
  const ids = full.map((p) => p.id);
  const old = await db.select({ id: schema.alerts.id, checkinId: schema.alerts.checkinId }).from(schema.alerts).where(inArray(schema.alerts.patientId, ids));
  const oldCheckins = await db.select({ id: schema.checkins.id, day: schema.checkins.day }).from(schema.checkins).where(lt(schema.checkins.day, today));
  const oldIds = new Set(oldCheckins.map((c) => c.id));
  const toResolve = old.filter((a) => oldIds.has(a.checkinId)).map((a) => a.id);
  if (toResolve.length) await db.update(schema.alerts).set({ status: "resolved", acknowledgedAt: new Date(), clinicNote: "Handled by the day team." }).where(inArray(schema.alerts.id, toResolve));
  return `Seeded ${DEMO_SLUG}: ${full.length} patients, ${n} check-ins, ${toResolve.length} earlier alerts resolved.`;
}
