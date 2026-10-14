import { and, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getProvider } from "@/lib/calls";
import { maskPhone, type ProviderCall } from "@/lib/calls/provider";
import { buildCaregiverTask, buildCheckinTask, buildClinicEscalationTask, CHECKIN_RESULT_SCHEMA, ESCALATION_RESULT_SCHEMA } from "@/lib/calls/script";
import { triage, type CheckinResult } from "@/lib/domain/triage";
import { newId } from "./ids";
import { daysBetween, localParts } from "./time";
import { sendEmail } from "./email";
import type { EscalationStep } from "@/db/schema";

type Patient = typeof schema.patients.$inferSelect;
type Clinic = typeof schema.clinics.$inferSelect;
type Checkin = typeof schema.checkins.$inferSelect;

const MAX_ATTEMPTS = 2;

export function webhookUrl(): string | undefined {
  const base = process.env.APP_URL;
  const secret = process.env.WEBHOOK_SECRET;
  if (!base || !secret || base.includes("localhost")) return undefined;
  return `${base.replace(/\/$/, "")}/api/webhook/${secret}`;
}

/** Place tonight's check-in call for one patient. Idempotent per patient/day/attempt. */
export async function dispatchCheckin(patient: Patient, clinic: Clinic, opts: { mode?: "dry" | "live"; scenario?: string; day?: string; force?: boolean } = {}): Promise<Checkin> {
  const db = getDb();
  const provider = getProvider(opts.mode);
  const { day } = opts.day ? { day: opts.day } : localParts(patient.timezone);
  const prior = await db.select().from(schema.checkins).where(and(eq(schema.checkins.patientId, patient.id), eq(schema.checkins.day, day))).orderBy(desc(schema.checkins.attempt));
  const attempt = prior.length + 1;
  if (!opts.force && prior.some((c) => c.risk && c.risk !== "unreachable")) return prior[0];
  if (!opts.force && attempt > MAX_ATTEMPTS) return prior[0];

  const previous = await lastCompleted(patient.id, day);
  const task = buildCheckinTask(
    { firstName: patient.firstName, locale: patient.locale, regimen: patient.regimen, lastInfusionDate: patient.lastInfusionDate, clinicName: clinic.name, clinicPhone: clinic.onCallPhone, caregiverName: patient.caregiverName },
    { previousSummary: previous?.summary ?? null, dayNumber: patient.lastInfusionDate ? daysBetween(patient.lastInfusionDate, day) : null },
  );
  const id = newId("chk");
  await db.insert(schema.checkins).values({ id, patientId: patient.id, day, attempt, status: "queued", mode: provider.mode });
  const call = await provider.create(
    {
      task,
      phone: patient.phone,
      locale: patient.locale,
      resultSchema: CHECKIN_RESULT_SCHEMA as unknown as Record<string, unknown>,
      metadata: { kind: "checkin", checkinId: id, patientId: patient.id, firstName: patient.firstName, clinicName: clinic.name, clinicPhone: clinic.onCallPhone, ...(opts.scenario ? { scenario: opts.scenario } : {}) },
      webhookUrl: webhookUrl(),
    },
    `${id}`,
  );
  await db.update(schema.checkins).set({ providerCallId: call.id, status: call.status }).where(eq(schema.checkins.id, id));
  await db.insert(schema.callLog).values({ id: newId("log"), kind: "checkin", providerCallId: call.id, phoneMasked: maskPhone(patient.phone), mode: provider.mode });
  if (call.resultStatus !== "pending") return (await processCall(call)) ?? (await db.select().from(schema.checkins).where(eq(schema.checkins.id, id)))[0];
  return (await db.select().from(schema.checkins).where(eq(schema.checkins.id, id)))[0];
}

async function lastCompleted(patientId: string, beforeDay: string): Promise<Checkin | null> {
  const db = getDb();
  const rows = await db.select().from(schema.checkins).where(eq(schema.checkins.patientId, patientId)).orderBy(desc(schema.checkins.day), desc(schema.checkins.attempt)).limit(10);
  return rows.find((r) => r.day < beforeDay && r.result && r.risk && r.risk !== "unreachable") ?? null;
}

/** Terminal call → stored transcript, triage, alert, escalation. Safe to call twice. */
export async function processCall(call: ProviderCall): Promise<Checkin | null> {
  const db = getDb();
  const kind = String(call.metadata.kind ?? "checkin");
  if (kind !== "checkin") return recordEscalationOutcome(call);
  const checkinId = String(call.metadata.checkinId ?? "");
  const [checkin] = await db.select().from(schema.checkins).where(eq(schema.checkins.id, checkinId));
  if (!checkin) return null;
  if (checkin.risk) return checkin; // already processed

  const [patient] = await db.select().from(schema.patients).where(eq(schema.patients.id, checkin.patientId));
  const previous = await lastCompleted(patient.id, checkin.day);
  const result = (call.result as unknown as CheckinResult | null) ?? null;
  const reachedResult: Partial<CheckinResult> = call.callOutcome === "completed" && result ? result : { reached: false };
  const t = triage(reachedResult, (previous?.result as unknown as CheckinResult | null) ?? null);
  const summary = result?.summary || (call.callOutcome === "no_answer" ? "No answer." : call.callOutcome === "busy" ? "Line busy." : call.callOutcome === "declined" ? "Call declined." : call.error ? `Call failed: ${call.error.message}` : "No result.");

  await db
    .update(schema.checkins)
    .set({ status: call.status, callOutcome: call.callOutcome, resultStatus: call.resultStatus, transcript: call.transcript, result: result as unknown as Record<string, string | number | boolean> | undefined, risk: t.risk, reasons: t.reasons, summary, completedAt: new Date() })
    .where(eq(schema.checkins.id, checkin.id));

  if (t.risk === "green") return (await db.select().from(schema.checkins).where(eq(schema.checkins.id, checkin.id)))[0];
  if (t.risk === "unreachable" && checkin.attempt < MAX_ATTEMPTS) return (await db.select().from(schema.checkins).where(eq(schema.checkins.id, checkin.id)))[0];

  const [clinic] = await db.select().from(schema.clinics).where(eq(schema.clinics.id, patient.clinicId));
  const alertId = newId("alr");
  const level = t.risk === "unreachable" ? "unreachable" : t.risk;
  await db.insert(schema.alerts).values({ id: alertId, patientId: patient.id, checkinId: checkin.id, level, reasons: t.reasons, status: "open", escalation: [] });

  const steps: EscalationStep[] = [];
  const push = async (s: EscalationStep) => {
    steps.push(s);
    await db.update(schema.alerts).set({ escalation: steps }).where(eq(schema.alerts.id, alertId));
  };

  if (level === "red") {
    const provider = getProvider(checkin.mode as "dry" | "live");
    let clinicReached = false;
    try {
      const esc = await provider.create(
        {
          task: buildClinicEscalationTask({ clinicName: clinic.name, patientFirstName: patient.firstName, patientPhone: patient.phone, reasons: t.reasons, summary, checkinTime: localParts(patient.timezone).label, appUrl: process.env.APP_URL ?? "" }),
          phone: clinic.onCallPhone,
          locale: "en-US",
          resultSchema: ESCALATION_RESULT_SCHEMA as unknown as Record<string, unknown>,
          metadata: { kind: "escalation_clinic", alertId, patientFirstName: patient.firstName, reasons: t.reasons.join("; "), clinicScenario: call.metadata.clinicScenario ?? (patient.phone.endsWith("5") ? "voicemail" : "answered") },
          webhookUrl: webhookUrl(),
        },
        `${alertId}-clinic`,
      );
      await db.insert(schema.callLog).values({ id: newId("log"), kind: "escalation_clinic", providerCallId: esc.id, phoneMasked: maskPhone(clinic.onCallPhone), mode: provider.mode });
      const o = escalationOutcome(esc);
      clinicReached = o.outcome === "answered";
      await push({ at: new Date().toISOString(), channel: "clinic_call", target: maskPhone(clinic.onCallPhone), providerCallId: esc.id, outcome: o.outcome, note: o.note });
    } catch (e) {
      await push({ at: new Date().toISOString(), channel: "clinic_call", target: maskPhone(clinic.onCallPhone), outcome: "failed", note: e instanceof Error ? e.message : String(e) });
    }
    if (clinic.escalationEmail) {
      const r = await sendEmail(clinic.escalationEmail, `URGENT: Nightingale check-in for ${patient.firstName}`, `Tonight's automated check-in for ${patient.firstName} (${maskPhone(patient.phone)}) found:\n\n${t.reasons.map((x) => `- ${x}`).join("\n")}\n\nPatient's account: ${summary}\n\nClinic line: ${clinicReached ? "reached, staff will contact the patient" : "not reached; message left"}.\nDashboard: ${process.env.APP_URL ?? ""}/c/${clinic.slug}`);
      await push({ at: new Date().toISOString(), channel: "email", target: clinic.escalationEmail, outcome: r === "sent" ? "sent" : r === "failed" ? "failed" : "pending", note: r === "skipped" ? "dry run: email not sent" : undefined });
    }
    if (patient.caregiverPhone && patient.caregiverName) {
      try {
        const cg = await provider.create(
          {
            task: buildCaregiverTask({ caregiverName: patient.caregiverName, patientFirstName: patient.firstName, clinicName: clinic.name, clinicPhone: clinic.onCallPhone, reasons: t.reasons, locale: patient.locale, clinicReached }),
            phone: patient.caregiverPhone,
            locale: patient.locale,
            resultSchema: ESCALATION_RESULT_SCHEMA as unknown as Record<string, unknown>,
            metadata: { kind: "escalation_caregiver", alertId, patientFirstName: patient.firstName, reasons: t.reasons.join("; ") },
            webhookUrl: webhookUrl(),
          },
          `${alertId}-caregiver`,
        );
        await db.insert(schema.callLog).values({ id: newId("log"), kind: "escalation_caregiver", providerCallId: cg.id, phoneMasked: maskPhone(patient.caregiverPhone), mode: provider.mode });
        const o = escalationOutcome(cg);
        await push({ at: new Date().toISOString(), channel: "caregiver_call", target: `${patient.caregiverName} ${maskPhone(patient.caregiverPhone)}`, providerCallId: cg.id, outcome: o.outcome, note: o.note });
      } catch (e) {
        await push({ at: new Date().toISOString(), channel: "caregiver_call", target: patient.caregiverName, outcome: "failed", note: e instanceof Error ? e.message : String(e) });
      }
    }
  } else if (clinic.escalationEmail) {
    const subject = level === "amber" ? `Nightingale: ${patient.firstName} needs a nurse call within 24 h` : `Nightingale: could not reach ${patient.firstName} tonight`;
    const r = await sendEmail(clinic.escalationEmail, subject, `${t.reasons.map((x) => `- ${x}`).join("\n")}\n\n${summary}\n\nDashboard: ${process.env.APP_URL ?? ""}/c/${clinic.slug}`);
    await push({ at: new Date().toISOString(), channel: "email", target: clinic.escalationEmail, outcome: r === "sent" ? "sent" : r === "failed" ? "failed" : "pending", note: r === "skipped" ? "dry run: email not sent" : undefined });
  }
  return (await db.select().from(schema.checkins).where(eq(schema.checkins.id, checkin.id)))[0];
}

function escalationOutcome(c: ProviderCall): { outcome: EscalationStep["outcome"]; note?: string } {
  if (c.resultStatus === "pending") return { outcome: "pending" };
  if (c.callOutcome && c.callOutcome !== "completed") return { outcome: c.callOutcome };
  const r = c.result ?? {};
  if (r.reached_person === true) return { outcome: "answered", note: [r.staff_name ? `Spoke with ${r.staff_name}.` : "", String(r.staff_response ?? ""), r.will_call_patient === true ? "Will contact the patient." : ""].filter(Boolean).join(" ") };
  if (r.left_voicemail === true) return { outcome: "voicemail", note: "Full report left as a voicemail message." };
  if (c.error) return { outcome: "failed", note: c.error.message };
  return { outcome: "no_answer", note: String(r.summary ?? "") };
}

/** Webhook for an escalation call that completed after we moved on. */
async function recordEscalationOutcome(call: ProviderCall): Promise<null> {
  const db = getDb();
  const alertId = String(call.metadata.alertId ?? "");
  if (!alertId) return null;
  const [alert] = await db.select().from(schema.alerts).where(eq(schema.alerts.id, alertId));
  if (!alert) return null;
  const o = escalationOutcome(call);
  const steps = alert.escalation.map((s) => (s.providerCallId === call.id ? { ...s, outcome: o.outcome, note: o.note } : s));
  await db.update(schema.alerts).set({ escalation: steps }).where(eq(schema.alerts.id, alertId));
  return null;
}

/** Patients whose evening call is due now (their local hour matches) and who have no completed check-in today. */
export async function duePatients(at = new Date()): Promise<{ patient: Patient; clinic: Clinic }[]> {
  const db = getDb();
  const rows = await db.select({ patient: schema.patients, clinic: schema.clinics }).from(schema.patients).innerJoin(schema.clinics, eq(schema.patients.clinicId, schema.clinics.id)).where(eq(schema.patients.active, true));
  const out: { patient: Patient; clinic: Clinic }[] = [];
  for (const row of rows) {
    const { day, hour } = localParts(row.patient.timezone, at);
    if (hour < row.patient.callHour || hour > row.patient.callHour + 2) continue;
    const todays = await db.select().from(schema.checkins).where(and(eq(schema.checkins.patientId, row.patient.id), eq(schema.checkins.day, day)));
    if (todays.some((c) => c.risk && c.risk !== "unreachable")) continue;
    if (todays.length >= MAX_ATTEMPTS) continue;
    // retry an unreachable attempt only after an hour
    const last = todays.sort((a, b) => b.attempt - a.attempt)[0];
    if (last && at.getTime() - new Date(last.createdAt).getTime() < 55 * 60 * 1000) continue;
    out.push(row);
  }
  return out;
}
