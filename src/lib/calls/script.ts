/**
 * Builds the CALL-E task (what the voice agent is told to do) and the flat
 * result schema it must fill in. One task per locale; the agent speaks the
 * patient's language because CALL-E is told the locale explicitly.
 */
import type { CheckinResult } from "@/lib/domain/triage";

export const SUPPORTED_LOCALES: { code: string; label: string; region: string }[] = [
  { code: "en-US", label: "English", region: "US" },
  { code: "es-MX", label: "Español", region: "MX" },
  { code: "es-ES", label: "Español (España)", region: "ES" },
  { code: "pt-BR", label: "Português", region: "BR" },
  { code: "hi-IN", label: "हिन्दी", region: "IN" },
  { code: "ta-IN", label: "தமிழ்", region: "IN" },
  { code: "vi-VN", label: "Tiếng Việt", region: "VN" },
  { code: "zh-MY", label: "中文", region: "MY" },
  { code: "ms-MY", label: "Bahasa Melayu", region: "MY" },
  { code: "id-ID", label: "Bahasa Indonesia", region: "US" },
  { code: "de-DE", label: "Deutsch", region: "DE" },
  { code: "pl-PL", label: "Polski", region: "PL" },
  { code: "tr-TR", label: "Türkçe", region: "TR" },
  { code: "ja-JP", label: "日本語", region: "JP" },
  { code: "th-TH", label: "ไทย", region: "TH" },
  { code: "ur-PK", label: "اردو", region: "PK" },
  { code: "bn-BD", label: "বাংলা", region: "BD" },
  { code: "fi-FI", label: "Suomi", region: "FI" },
];

export const LANGUAGE_NAME: Record<string, string> = Object.fromEntries(
  SUPPORTED_LOCALES.map((l) => [l.code, { "en-US": "English", "es-MX": "Spanish", "es-ES": "Spanish", "pt-BR": "Portuguese", "hi-IN": "Hindi", "ta-IN": "Tamil", "vi-VN": "Vietnamese", "zh-MY": "Mandarin Chinese", "ms-MY": "Malay", "id-ID": "Indonesian", "de-DE": "German", "pl-PL": "Polish", "tr-TR": "Turkish", "ja-JP": "Japanese", "th-TH": "Thai", "ur-PK": "Urdu", "bn-BD": "Bengali", "fi-FI": "Finnish" }[l.code] ?? "English"]),
);

/** CALL-E profile: flat, closed, <= 32 scalar properties, no nulls. */
export const CHECKIN_RESULT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    reached: { type: "boolean", description: "true if the patient (or their caregiver speaking for them) answered and took part in the check-in." },
    call_back_later: { type: "boolean", description: "true if the patient asked to be called back at another time." },
    temperature_f: { type: "number", description: "Most recent measured temperature in Fahrenheit if the patient measured one today; -1 if not measured or not stated." },
    fever_or_chills: { type: "boolean", description: "true if the patient reports feeling feverish, hot, or having chills or shaking today, even without a thermometer reading." },
    nausea: { type: "integer", description: "Nausea severity today: 0 none, 1 mild, 2 moderate, 3 severe, 4 very severe." },
    vomiting_24h: { type: "integer", description: "Number of times the patient vomited in the last 24 hours; 0 if none." },
    diarrhea_24h: { type: "integer", description: "Number of loose or watery stools in the last 24 hours; 0 if none." },
    pain: { type: "integer", description: "Worst pain today from 0 (none) to 10 (worst imaginable)." },
    pain_controlled: { type: "boolean", description: "true if pain medication is keeping the pain manageable, or if there is no pain." },
    shortness_of_breath: { type: "integer", description: "Shortness of breath today: 0 none, 1 mild with exertion, 2 moderate, 3 severe or at rest, 4 very severe." },
    chest_pain: { type: "boolean", description: "true if the patient reports chest pain or pressure today." },
    mouth_sores: { type: "integer", description: "Mouth or throat sores: 0 none, 1 mild, 2 moderate, 3 severe, 4 cannot eat or drink because of them." },
    keeping_fluids_down: { type: "boolean", description: "true if the patient has been able to drink and keep fluids down today." },
    fatigue: { type: "integer", description: "Tiredness today: 0 none, 1 mild, 2 moderate, 3 severe, 4 unable to get out of bed." },
    numbness_tingling: { type: "integer", description: "Numbness or tingling in hands or feet: 0 none, 1 mild, 2 moderate, 3 severe, 4 interfering with walking or buttons." },
    low_mood: { type: "integer", description: "Feeling down, anxious or hopeless today: 0 not at all, 1 a little, 2 somewhat, 3 quite a bit, 4 very much." },
    bleeding: { type: "boolean", description: "true if bleeding that would not stop, blood in vomit or stool, or black stools." },
    confusion_or_weakness: { type: "boolean", description: "true if new confusion, fainting, or new weakness in an arm, leg, or face." },
    self_harm_thoughts: { type: "boolean", description: "true only if the patient expresses thoughts of harming themselves." },
    other_symptoms: { type: "string", description: "Any other symptom the patient mentioned, in a few words; empty string if none." },
    medication_question: { type: "string", description: "Any question the patient asked about their medicines, verbatim-ish; empty string if none." },
    wants_callback: { type: "boolean", description: "true if the patient asked to speak with a nurse or doctor." },
    summary: { type: "string", description: "Two or three sentences a nurse can read in ten seconds: how the patient is doing and anything that changed." },
  },
  required: [
    "reached", "call_back_later", "temperature_f", "fever_or_chills", "nausea", "vomiting_24h", "diarrhea_24h", "pain", "pain_controlled", "shortness_of_breath",
    "chest_pain", "mouth_sores", "keeping_fluids_down", "fatigue", "numbness_tingling", "low_mood", "bleeding", "confusion_or_weakness", "self_harm_thoughts",
    "other_symptoms", "medication_question", "wants_callback", "summary",
  ],
} as const;

export interface ScriptPatient {
  firstName: string;
  locale: string;
  regimen?: string | null;
  lastInfusionDate?: string | null;
  clinicName: string;
  clinicPhone: string;
  caregiverName?: string | null;
}

export function buildCheckinTask(p: ScriptPatient, opts: { previousSummary?: string | null; dayNumber?: number | null } = {}): string {
  const lang = LANGUAGE_NAME[p.locale] ?? "English";
  const since = p.lastInfusionDate && opts.dayNumber ? ` It has been ${opts.dayNumber} days since their last treatment.` : "";
  const prev = opts.previousSummary ? `\n\nYesterday's note from the last check-in: "${opts.previousSummary}". If something was bothering them yesterday, ask whether it is better, the same, or worse.` : "";
  return `You are Nightingale, the automated evening check-in call from ${p.clinicName}. Speak ${lang} for the entire call. Keep the call under four minutes. You are calling ${p.firstName}, who is receiving chemotherapy${p.regimen ? ` (${p.regimen})` : ""}.${since}

Start by saying who you are: an automated check-in call from ${p.clinicName}'s care team, that the call is recorded so a nurse can review it, and ask whether now is an okay time to talk for a few minutes. If they say it is not a good time, say you will call again later and end the call politely (set call_back_later true). If a family member or caregiver answers and the patient cannot come to the phone, you may do the check-in with the caregiver speaking for the patient.

Then ask, one at a time, in a warm unhurried voice, and accept short answers:
1. How are you feeling today, overall?
2. Have you felt feverish or had chills today? Did you take your temperature, and what was it?
3. Any nausea? Have you vomited in the last 24 hours, and how many times?
4. Any diarrhea in the last 24 hours, and how many times?
5. Any pain? On a scale of 0 to 10, how bad at its worst today, and is your medicine keeping it under control?
6. Any trouble breathing, or any chest pain?
7. Any mouth or throat sores? Are you able to drink and keep fluids down?
8. How is your energy, and any numbness or tingling in your hands or feet?
9. How are your spirits, are you feeling down or anxious?
10. Any bleeding, black stools, confusion, fainting, or new weakness?
11. Anything else you want the nurse to know, or any question about your medicines?

If at any point the patient reports a temperature of 100.4 Fahrenheit (38 Celsius) or higher, shaking chills, chest pain, severe or new shortness of breath, bleeding that will not stop, confusion, fainting, new weakness, vomiting four or more times, or being unable to keep fluids down: stop the questionnaire briefly and say clearly, in ${lang}: "This is something your care team needs to know about tonight. I am notifying ${p.clinicName} right now. If it is chest pain, trouble breathing, confusion, or heavy bleeding, please call 911 or go to the emergency department now. Otherwise please call ${p.clinicPhone} now." Then finish the remaining questions quickly.

If the patient expresses thoughts of harming themselves, respond with warmth, say that help is available right now, give the 988 Suicide and Crisis Lifeline (call or text 988 in the United States), and say a nurse will be told tonight.

Do not give medical advice beyond the safety messages above. Do not suggest medicines or doses. If asked a medical question, say you will pass it to the nurse. End by thanking them, telling them the nurse will see tonight's note, and reminding them to call ${p.clinicPhone} any time something changes.${prev}`;
}

export const ESCALATION_RESULT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    reached_person: { type: "boolean", description: "true if a human answered and heard the report." },
    left_voicemail: { type: "boolean", description: "true if the call went to voicemail and the message was left." },
    staff_name: { type: "string", description: "Name of the staff member who took the report, or empty string." },
    staff_response: { type: "string", description: "What the staff member said they would do, in a few words; empty string if none." },
    will_call_patient: { type: "boolean", description: "true if staff said they will contact the patient." },
    summary: { type: "string", description: "One or two sentences on the outcome of this call." },
  },
  required: ["reached_person", "left_voicemail", "staff_name", "staff_response", "will_call_patient", "summary"],
} as const;

export function buildClinicEscalationTask(input: { clinicName: string; patientFirstName: string; patientPhone: string; reasons: string[]; summary: string; checkinTime: string; appUrl: string }): string {
  const list = input.reasons.map((r, i) => `${i + 1}. ${r}`).join("\n");
  return `You are Nightingale, an automated symptom check-in service used by ${input.clinicName}. Speak English. You are calling the clinic's on-call or triage line to report an urgent patient finding from tonight's automated check-in call. Be brief, calm and factual. If a phone menu answers, choose the option for a nurse, on-call provider, or triage; if none fits, choose the operator.

When a person answers, say: "This is Nightingale, the automated evening check-in service for ${input.clinicName}. I am reporting an urgent finding from tonight's call with your patient ${input.patientFirstName}. Do you have a moment?" Then give the report:
Patient: ${input.patientFirstName}, phone ${input.patientPhone}. Check-in at ${input.checkinTime}.
Urgent findings:
${list}
Patient's own account: "${input.summary}"
The patient was told to call the clinic now and to go to the emergency department for chest pain, breathing trouble, confusion, or heavy bleeding.
Ask: "Can you confirm someone will contact the patient tonight?" Note the staff member's name and what they say they will do. Offer that the full transcript is on the Nightingale dashboard at ${input.appUrl}.

If the call goes to voicemail, leave this message slowly and clearly, then hang up: "This is Nightingale, the automated check-in service for ${input.clinicName}, with an urgent report for your patient ${input.patientFirstName}, phone ${input.patientPhone}. Tonight's check-in found: ${input.reasons.join("; ")}. The patient has been told to call you and to go to the emergency department for emergency symptoms. Please call the patient back as soon as possible. The full transcript is on the Nightingale dashboard. Again, the patient is ${input.patientFirstName}, phone ${input.patientPhone}."

Do not give any clinical recommendation. Do not stay on the line longer than needed.`;
}

export function buildCaregiverTask(input: { caregiverName: string; patientFirstName: string; clinicName: string; clinicPhone: string; reasons: string[]; locale: string; clinicReached: boolean }): string {
  const lang = LANGUAGE_NAME[input.locale] ?? "English";
  return `You are Nightingale, the automated evening check-in service from ${input.clinicName}. Speak ${lang}. You are calling ${input.caregiverName}, who is listed as the caregiver for ${input.patientFirstName}. Say who you are and that this is about ${input.patientFirstName}'s check-in call tonight. Explain, calmly, that the check-in found something the care team needs to know about: ${input.reasons.join("; ")}. ${input.clinicReached ? `The clinic has been notified and said they will contact ${input.patientFirstName}.` : `The clinic has been notified by message. Please help ${input.patientFirstName} call ${input.clinicPhone} now, and go to the emergency department if there is chest pain, trouble breathing, confusion, or heavy bleeding.`} Ask if they have any questions you can pass to the nurse, thank them, and end the call. Do not give medical advice. If voicemail answers, leave the same message briefly.`;
}

export function emptyResult(): CheckinResult {
  return {
    reached: false, call_back_later: false, temperature_f: -1, fever_or_chills: false, nausea: 0, vomiting_24h: 0, diarrhea_24h: 0, pain: 0, pain_controlled: true,
    shortness_of_breath: 0, chest_pain: false, mouth_sores: 0, keeping_fluids_down: true, fatigue: 0, numbness_tingling: 0, low_mood: 0, bleeding: false,
    confusion_or_weakness: false, self_harm_thoughts: false, other_symptoms: "", medication_question: "", wants_callback: false, summary: "",
  };
}
