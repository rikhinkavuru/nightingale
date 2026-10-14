/**
 * Symptom grading and triage.
 *
 * Items follow the NCI PRO-CTCAE structure (0-4 severity / frequency scales,
 * 0-10 pain) so clinics see numbers they already understand. Thresholds follow
 * the standard "when to call" rules on chemotherapy patient sheets and the
 * alert logic used in Basch et al. (JAMA 2017): severe (grade >= 3) or a
 * worsening of 2 points triggers clinic review; a short list of findings is
 * urgent on its own.
 *
 * Nothing here diagnoses. It decides who a nurse should hear about tonight.
 */

export const RED_FLAG_TEXT = {
  fever: "Fever of 100.4°F (38°C) or higher, or shaking chills, during chemotherapy",
  breathing: "New or severe shortness of breath",
  chestPain: "Chest pain",
  bleeding: "Bleeding that will not stop, or black or bloody stools",
  confusion: "New confusion, fainting, or new weakness",
  fluids: "Unable to keep fluids down",
  vomiting: "Vomiting 4 or more times in 24 hours",
  diarrhea: "Diarrhea 7 or more times in 24 hours",
  pain: "Severe pain (8 or more out of 10) not controlled by medication",
  mouth: "Mouth sores preventing eating or drinking",
  selfHarm: "Thoughts of self-harm",
} as const;

/** Flat scalar result the voice agent fills in. Mirrors the CALL-E result_schema. */
export interface CheckinResult {
  reached: boolean;
  call_back_later: boolean;
  temperature_f: number; // -1 if not measured
  fever_or_chills: boolean;
  nausea: number; // 0-4
  vomiting_24h: number; // episodes
  diarrhea_24h: number; // episodes
  pain: number; // 0-10
  pain_controlled: boolean;
  shortness_of_breath: number; // 0-4
  chest_pain: boolean;
  mouth_sores: number; // 0-4
  keeping_fluids_down: boolean;
  fatigue: number; // 0-4
  numbness_tingling: number; // 0-4
  low_mood: number; // 0-4
  bleeding: boolean;
  confusion_or_weakness: boolean;
  self_harm_thoughts: boolean;
  other_symptoms: string;
  medication_question: string;
  wants_callback: boolean;
  summary: string;
}

export type Risk = "green" | "amber" | "red" | "unreachable";

export interface Triage {
  risk: Risk;
  reasons: string[];
  /** Items the nurse should look at, with grade. */
  notable: { item: string; grade: number; delta?: number }[];
}

const SEVERITY_ITEMS: (keyof CheckinResult)[] = ["nausea", "shortness_of_breath", "mouth_sores", "fatigue", "numbness_tingling", "low_mood"];
const LABEL: Record<string, string> = {
  nausea: "Nausea",
  shortness_of_breath: "Shortness of breath",
  mouth_sores: "Mouth sores",
  fatigue: "Fatigue",
  numbness_tingling: "Numbness or tingling",
  low_mood: "Low mood or anxiety",
};

const n = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const b = (v: unknown) => v === true;

export function triage(r: Partial<CheckinResult>, previous?: Partial<CheckinResult> | null): Triage {
  const reasons: string[] = [];
  const notable: Triage["notable"] = [];

  if (!b(r.reached) || b(r.call_back_later)) return { risk: "unreachable", reasons: [b(r.call_back_later) ? "Asked to be called back later" : "Not reached"], notable };

  // ---- red: urgent tonight ----
  const temp = n(r.temperature_f, -1);
  if (temp >= 100.4 || b(r.fever_or_chills)) reasons.push(temp >= 100.4 ? `${RED_FLAG_TEXT.fever}: ${temp}°F` : RED_FLAG_TEXT.fever);
  if (n(r.shortness_of_breath) >= 3) reasons.push(RED_FLAG_TEXT.breathing);
  if (b(r.chest_pain)) reasons.push(RED_FLAG_TEXT.chestPain);
  if (b(r.bleeding)) reasons.push(RED_FLAG_TEXT.bleeding);
  if (b(r.confusion_or_weakness)) reasons.push(RED_FLAG_TEXT.confusion);
  if (r.keeping_fluids_down === false) reasons.push(RED_FLAG_TEXT.fluids);
  if (n(r.vomiting_24h) >= 4) reasons.push(`${RED_FLAG_TEXT.vomiting} (${n(r.vomiting_24h)})`);
  if (n(r.diarrhea_24h) >= 7) reasons.push(`${RED_FLAG_TEXT.diarrhea} (${n(r.diarrhea_24h)})`);
  if (n(r.pain) >= 8 && r.pain_controlled !== true) reasons.push(`${RED_FLAG_TEXT.pain}: ${n(r.pain)}/10`);
  if (n(r.mouth_sores) >= 4) reasons.push(RED_FLAG_TEXT.mouth);
  if (b(r.self_harm_thoughts)) reasons.push(RED_FLAG_TEXT.selfHarm);
  if (reasons.length) return { risk: "red", reasons, notable: notableItems(r, previous) };

  // ---- amber: nurse callback within 24 h ----
  if (temp >= 99.5) reasons.push(`Low-grade temperature ${temp}°F; recheck in 4 hours`);
  if (n(r.vomiting_24h) >= 2) reasons.push(`Vomiting ${n(r.vomiting_24h)} times in 24 hours`);
  if (n(r.diarrhea_24h) >= 4) reasons.push(`Diarrhea ${n(r.diarrhea_24h)} times in 24 hours`);
  if (n(r.pain) >= 5) reasons.push(`Pain ${n(r.pain)}/10`);
  if (n(r.pain) >= 1 && r.pain_controlled === false) reasons.push("Pain not controlled by medication");
  for (const item of SEVERITY_ITEMS) {
    const g = n(r[item]);
    if (g >= 3) reasons.push(`${LABEL[item]} severe (${g}/4)`);
    const prev = previous ? n(previous[item]) : null;
    if (prev !== null && g - prev >= 2 && g >= 2) reasons.push(`${LABEL[item]} worsened from ${prev} to ${g}`);
  }
  if (b(r.wants_callback)) reasons.push("Patient asked for a call from the clinic");
  if ((r.medication_question ?? "").trim()) reasons.push(`Medication question: ${String(r.medication_question).trim()}`);
  if (reasons.length) return { risk: "amber", reasons, notable: notableItems(r, previous) };

  return { risk: "green", reasons: [], notable: notableItems(r, previous) };
}

function notableItems(r: Partial<CheckinResult>, previous?: Partial<CheckinResult> | null): Triage["notable"] {
  const out: Triage["notable"] = [];
  for (const item of SEVERITY_ITEMS) {
    const g = n(r[item]);
    if (g >= 1) out.push({ item: LABEL[item], grade: g, ...(previous ? { delta: g - n(previous[item]) } : {}) });
  }
  if (n(r.pain) >= 1) out.push({ item: "Pain (0-10)", grade: n(r.pain), ...(previous ? { delta: n(r.pain) - n(previous.pain) } : {}) });
  if (n(r.vomiting_24h) >= 1) out.push({ item: "Vomiting (per 24 h)", grade: n(r.vomiting_24h) });
  if (n(r.diarrhea_24h) >= 1) out.push({ item: "Diarrhea (per 24 h)", grade: n(r.diarrhea_24h) });
  return out;
}

/** What the voice agent must tell the patient the moment a red flag comes up, before anything else. */
export function patientAdviceFor(risk: Risk, reasons: string[]): string {
  if (risk !== "red") return "";
  const emergency = reasons.some((x) => x.startsWith("Chest pain") || x.startsWith("New or severe shortness") || x.startsWith("New confusion") || x.startsWith("Bleeding"));
  if (emergency) return "This needs emergency care now. Please call 911 or have someone take you to the nearest emergency department. I am also notifying your clinic.";
  return "This is something your care team needs to know about tonight. Please call your clinic's number now; I am also calling them for you. If you cannot reach anyone, go to the emergency department.";
}
