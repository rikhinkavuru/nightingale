import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";

export async function clinicBySlug(slug: string) {
  const [c] = await getDb().select().from(schema.clinics).where(eq(schema.clinics.slug, slug));
  return c ?? null;
}

export async function clinicOverview(clinicId: string) {
  const db = getDb();
  const patients = await db.select().from(schema.patients).where(eq(schema.patients.clinicId, clinicId)).orderBy(schema.patients.firstName);
  const ids = patients.map((p) => p.id);
  const checkins = ids.length ? await db.select().from(schema.checkins).where(inArray(schema.checkins.patientId, ids)).orderBy(desc(schema.checkins.day), desc(schema.checkins.attempt)) : [];
  const alerts = ids.length ? await db.select().from(schema.alerts).where(inArray(schema.alerts.patientId, ids)).orderBy(desc(schema.alerts.createdAt)) : [];
  return { patients, checkins, alerts };
}

export async function patientDetail(clinicId: string, patientId: string) {
  const db = getDb();
  const [patient] = await db.select().from(schema.patients).where(and(eq(schema.patients.id, patientId), eq(schema.patients.clinicId, clinicId)));
  if (!patient) return null;
  const checkins = await db.select().from(schema.checkins).where(eq(schema.checkins.patientId, patientId)).orderBy(desc(schema.checkins.day), desc(schema.checkins.attempt));
  const alerts = await db.select().from(schema.alerts).where(eq(schema.alerts.patientId, patientId)).orderBy(desc(schema.alerts.createdAt));
  return { patient, checkins, alerts };
}
