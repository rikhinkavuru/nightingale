import { pgTable, text, integer, boolean, timestamp, jsonb, real } from "drizzle-orm/pg-core";

export const clinics = pgTable("clinics", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  onCallPhone: text("on_call_phone").notNull(),
  escalationEmail: text("escalation_email"),
  timezone: text("timezone").notNull().default("America/New_York"),
  accessCode: text("access_code").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const patients = pgTable("patients", {
  id: text("id").primaryKey(),
  clinicId: text("clinic_id").notNull().references(() => clinics.id),
  firstName: text("first_name").notNull(),
  phone: text("phone").notNull(),
  /** BCP-47, e.g. en-US, es-MX, hi-IN. */
  locale: text("locale").notNull().default("en-US"),
  timezone: text("timezone").notNull().default("America/New_York"),
  /** Local hour 0-23 for the evening call. */
  callHour: integer("call_hour").notNull().default(18),
  regimen: text("regimen"),
  lastInfusionDate: text("last_infusion_date"),
  caregiverName: text("caregiver_name"),
  caregiverPhone: text("caregiver_phone"),
  notes: text("notes"),
  consentAt: timestamp("consent_at", { withTimezone: true }),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const checkins = pgTable("checkins", {
  id: text("id").primaryKey(),
  patientId: text("patient_id").notNull().references(() => patients.id),
  /** YYYY-MM-DD in the patient's timezone. One check-in per day. */
  day: text("day").notNull(),
  attempt: integer("attempt").notNull().default(1),
  providerCallId: text("provider_call_id"),
  status: text("status").notNull().default("queued"), // queued | in_progress | completed | failed | canceled
  callOutcome: text("call_outcome"), // completed | no_answer | busy | declined
  resultStatus: text("result_status"),
  transcript: jsonb("transcript").$type<{ offset_seconds: number | null; speaker: string; text: string }[]>().default([]),
  result: jsonb("result").$type<Record<string, string | number | boolean>>(),
  risk: text("risk"), // green | amber | red | unreachable
  reasons: jsonb("reasons").$type<string[]>().default([]),
  summary: text("summary"),
  mode: text("mode").notNull().default("dry"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const alerts = pgTable("alerts", {
  id: text("id").primaryKey(),
  patientId: text("patient_id").notNull().references(() => patients.id),
  checkinId: text("checkin_id").notNull().references(() => checkins.id),
  level: text("level").notNull(), // red | amber | unreachable
  reasons: jsonb("reasons").$type<string[]>().notNull().default([]),
  status: text("status").notNull().default("open"), // open | acknowledged | resolved
  /** Escalation steps taken, in order. */
  escalation: jsonb("escalation").$type<EscalationStep[]>().notNull().default([]),
  clinicNote: text("clinic_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
});

export interface EscalationStep {
  at: string;
  channel: "clinic_call" | "caregiver_call" | "email";
  target: string;
  providerCallId?: string | null;
  outcome: "answered" | "voicemail" | "no_answer" | "busy" | "declined" | "sent" | "failed" | "pending";
  note?: string;
}

export const callLog = pgTable("call_log", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(), // checkin | escalation_clinic | escalation_caregiver | demo
  providerCallId: text("provider_call_id"),
  phoneMasked: text("phone_masked").notNull(),
  mode: text("mode").notNull(),
  estimatedCostUsd: real("estimated_cost_usd"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
