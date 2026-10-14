/**
 * Seeds the shared demo clinic ("Lakeside Oncology", access code "demo")
 * with eight patients and six days of dry-run history, so the dashboard
 * tells a story the moment a judge opens it. Re-runnable: wipes the demo
 * clinic first.
 */
import { eq, inArray } from "drizzle-orm";
import { getDb, schema } from "../src/db";
import { dispatchCheckin } from "../src/lib/services/checkin";
import { newId } from "../src/lib/services/ids";
import { localParts } from "../src/lib/services/time";

const SLUG = "lakeside";

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

async function main() {
  const db = getDb();
  const [existing] = await db.select().from(schema.clinics).where(eq(schema.clinics.slug, SLUG));
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
  const clinic = { id: newId("cl"), slug: SLUG, name: "Lakeside Oncology", onCallPhone: "+15555550100", escalationEmail: "triage@lakeside.example", timezone: "America/New_York", accessCode: "demo" };
  await db.insert(schema.clinics).values(clinic);
  const rows = PATIENTS.map((p) => ({
    id: newId("pt"),
    clinicId: clinic.id,
    firstName: p.firstName,
    phone: p.phone,
    locale: p.locale,
    timezone: "America/New_York",
    callHour: 18,
    regimen: p.regimen,
    lastInfusionDate: dayMinus(4 + Math.floor(Math.random() * 6)),
    caregiverName: p.caregiverName ?? null,
    caregiverPhone: p.caregiverPhone ?? null,
    consentAt: new Date(),
    active: true,
  }));
  await db.insert(schema.patients).values(rows);
  const full = await db.select().from(schema.patients).where(eq(schema.patients.clinicId, clinic.id));
  for (const p of PATIENTS) {
    const patient = full.find((x) => x.firstName === p.firstName)!;
    for (let i = 0; i < p.history.length; i++) {
      const day = dayMinus(p.history.length - 1 - i);
      await dispatchCheckin(patient, { ...clinic, createdAt: new Date() }, { mode: "dry", scenario: p.history[i], day });
    }
    process.stdout.write(".");
  }
  console.log(`\nSeeded ${SLUG}: ${full.length} patients, ${PATIENTS.reduce((a, p) => a + p.history.length, 0)} check-ins.`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
