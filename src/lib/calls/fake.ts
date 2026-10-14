/**
 * Fake provider: deterministic, scenario-driven, instant. The scenario is
 * chosen from `metadata.scenario` (set by the demo UI) or from the phone's
 * last digit so a seeded clinic shows a believable spread.
 */
import type { CallProvider, CreateCallInput, ProviderCall, TranscriptTurn } from "./provider";
import { emptyResult } from "./script";
import type { CheckinResult } from "@/lib/domain/triage";

export type Scenario = "fine" | "tired" | "nausea_worse" | "fever" | "breathing" | "no_answer" | "later" | "caregiver" | "meds_question" | "low_mood";

const SCENARIOS: Record<Scenario, { result: Partial<CheckinResult>; outcome: ProviderCall["callOutcome"]; turns: (name: string, lang: string) => TranscriptTurn[] }> = {
  fine: {
    outcome: "completed",
    result: { reached: true, fatigue: 1, summary: "Feeling okay today. Mild tiredness in the afternoon, eating and drinking normally, no fever." },
    turns: (name, lang) => dialog(lang, name, ["ok", "no_fever", "no_nausea", "no_pain", "fine_rest", "thanks"]),
  },
  tired: {
    outcome: "completed",
    result: { reached: true, fatigue: 2, nausea: 1, summary: "More tired than yesterday and a little queasy in the morning. Ate a small dinner. No fever, no pain." },
    turns: (name, lang) => dialog(lang, name, ["tired", "no_fever", "mild_nausea", "no_pain", "fine_rest", "thanks"]),
  },
  nausea_worse: {
    outcome: "completed",
    result: { reached: true, nausea: 3, vomiting_24h: 2, fatigue: 2, keeping_fluids_down: true, summary: "Nausea has gotten worse, vomited twice since last night but able to keep water down. Took the anti-nausea pill once. Tired." },
    turns: (name, lang) => dialog(lang, name, ["rough", "no_fever", "nausea_worse", "no_pain", "fine_rest", "thanks"]),
  },
  fever: {
    outcome: "completed",
    result: { reached: true, temperature_f: 100.9, fever_or_chills: true, fatigue: 2, summary: "Felt hot and shivery this afternoon; thermometer read 100.9. No other new symptoms. Told to call the clinic now; agreed to call." },
    turns: (name, lang) => dialog(lang, name, ["hot", "fever", "red_flag", "no_nausea", "no_pain", "fine_rest", "thanks_red"]),
  },
  breathing: {
    outcome: "completed",
    result: { reached: true, shortness_of_breath: 3, chest_pain: false, fatigue: 3, summary: "Short of breath walking to the bathroom and a little at rest since this morning. No chest pain. Told to go to the emergency department; daughter is driving." },
    turns: (name, lang) => dialog(lang, name, ["breathless", "no_fever", "red_flag_er", "no_nausea", "no_pain", "thanks_red"]),
  },
  no_answer: { outcome: "no_answer", result: {}, turns: () => [] },
  later: {
    outcome: "completed",
    result: { reached: true, call_back_later: true, summary: "Asked to be called back later; at a family dinner." },
    turns: (name, lang) => dialog(lang, name, ["later"]),
  },
  caregiver: {
    outcome: "completed",
    result: { reached: true, fatigue: 3, keeping_fluids_down: true, low_mood: 2, summary: "Daughter answered for the patient, who is resting. Very tired, slept most of the day, drinking fluids. Seems low in spirits. No fever." },
    turns: (name, lang) => dialog(lang, name, ["caregiver", "no_fever", "no_nausea", "no_pain", "low_mood", "thanks"]),
  },
  meds_question: {
    outcome: "completed",
    result: { reached: true, pain: 3, pain_controlled: true, medication_question: "Can I take ibuprofen for the joint pain, or only acetaminophen?", summary: "Doing fairly well. Some joint aches, 3 out of 10. Asked whether ibuprofen is allowed; told the nurse will answer." },
    turns: (name, lang) => dialog(lang, name, ["ok", "no_fever", "no_nausea", "mild_pain", "meds_q", "thanks"]),
  },
  low_mood: {
    outcome: "completed",
    result: { reached: true, low_mood: 3, fatigue: 2, wants_callback: true, summary: "Physically okay but feeling very down and anxious about the next scan. Asked to talk to someone from the clinic." },
    turns: (name, lang) => dialog(lang, name, ["ok", "no_fever", "no_nausea", "no_pain", "down", "thanks"]),
  },
};

type Line = { bot: string; user: string };
const LINES: Record<string, Record<string, Line>> = {
  en: {
    intro: { bot: "Hello {name}, this is Nightingale, the evening check-in call from {clinic}. This call is recorded so your nurse can review it. Is now an okay time to talk for a few minutes?", user: "Yes, that's fine." },
    ok: { bot: "How are you feeling today, overall?", user: "Pretty okay, honestly. A bit tired this afternoon but not bad." },
    tired: { bot: "How are you feeling today, overall?", user: "More tired than yesterday. I was queasy this morning but it passed." },
    rough: { bot: "How are you feeling today, overall?", user: "Not great. The nausea's been worse since last night." },
    hot: { bot: "How are you feeling today, overall?", user: "I've been feeling hot and kind of shivery since this afternoon." },
    breathless: { bot: "How are you feeling today, overall?", user: "I'm out of breath. Even walking to the bathroom. It started this morning." },
    no_fever: { bot: "Have you felt feverish or had chills today? Did you take your temperature?", user: "No, no fever. I didn't take it but I feel normal." },
    fever: { bot: "Did you take your temperature?", user: "I did, about an hour ago. It said 100.9." },
    red_flag: { bot: "Thank you for telling me. A temperature of 100.9 is something your care team needs to know about tonight. I am notifying {clinic} right now. Please call {phone} now; if nobody answers, go to the emergency department. Can you do that?", user: "Okay. Yes, I'll call them right now." },
    red_flag_er: { bot: "Thank you for telling me. Trouble breathing like that needs emergency care now. Please call 911 or have someone take you to the emergency department. I am notifying {clinic} as well. Is someone with you?", user: "My daughter is here. She can drive me." },
    no_nausea: { bot: "Any nausea, or vomiting in the last 24 hours?", user: "No, none." },
    mild_nausea: { bot: "Any nausea, or vomiting in the last 24 hours?", user: "A little nausea in the morning. No vomiting." },
    nausea_worse: { bot: "Have you vomited in the last 24 hours, and how many times? Are you able to keep fluids down?", user: "Twice since last night. I can keep water down, I just don't want food." },
    no_pain: { bot: "Any pain? From 0 to 10, how bad at its worst today?", user: "No real pain. Maybe a 1." },
    mild_pain: { bot: "Any pain? From 0 to 10, how bad at its worst today?", user: "My joints ache, about a 3. The acetaminophen helps." },
    fine_rest: { bot: "Any trouble breathing, mouth sores, trouble keeping fluids down, numbness, bleeding, or confusion?", user: "No, none of that." },
    low_mood: { bot: "And how are her spirits?", user: "She's been quiet. Kind of down, I think. It's been a long week." },
    down: { bot: "How are your spirits, are you feeling down or anxious?", user: "Honestly, I'm really anxious about the scan next week. I'd like to talk to someone." },
    meds_q: { bot: "Anything else for the nurse, or any question about your medicines?", user: "Can I take ibuprofen for the joints, or only the acetaminophen?" },
    caregiver: { bot: "Hello, this is Nightingale, the evening check-in call from {clinic} for {name}. Is {name} available?", user: "This is her daughter. She's resting, but I can answer for her." },
    later: { bot: "Hello {name}, this is Nightingale, the evening check-in from {clinic}. Is now an okay time?", user: "Not really, we're at dinner. Can you call later?" },
    thanks: { bot: "Thank you, {name}. The nurse will see tonight's note. Call {phone} any time something changes. Good night.", user: "Thank you. Good night." },
    thanks_red: { bot: "Thank you, {name}. I have notified {clinic}. Please make that call now; the nurse will have tonight's note. Take care.", user: "Okay. Thank you." },
  },
  es: {
    intro: { bot: "Hola {name}, le habla Nightingale, la llamada de seguimiento de la tarde de {clinic}. Esta llamada se graba para que su enfermera pueda revisarla. ¿Es buen momento para hablar unos minutos?", user: "Sí, está bien." },
    ok: { bot: "¿Cómo se siente hoy, en general?", user: "Bastante bien, la verdad. Un poco cansada por la tarde, pero nada grave." },
    tired: { bot: "¿Cómo se siente hoy, en general?", user: "Más cansada que ayer. Tuve náuseas por la mañana pero ya pasaron." },
    rough: { bot: "¿Cómo se siente hoy, en general?", user: "No muy bien. Las náuseas han empeorado desde anoche." },
    hot: { bot: "¿Cómo se siente hoy, en general?", user: "Desde la tarde me siento con calor y escalofríos." },
    breathless: { bot: "¿Cómo se siente hoy, en general?", user: "Me falta el aire. Hasta para ir al baño. Empezó esta mañana." },
    no_fever: { bot: "¿Ha tenido fiebre o escalofríos hoy? ¿Se tomó la temperatura?", user: "No, sin fiebre. No me la tomé pero me siento normal." },
    fever: { bot: "¿Se tomó la temperatura?", user: "Sí, hace como una hora. Marcó 100.9." },
    red_flag: { bot: "Gracias por decírmelo. Una temperatura de 100.9 es algo que su equipo médico necesita saber esta noche. Estoy avisando a {clinic} ahora mismo. Por favor llame al {phone} ahora; si nadie contesta, vaya a urgencias. ¿Puede hacerlo?", user: "Sí. Voy a llamar ahora mismo." },
    red_flag_er: { bot: "Gracias por decírmelo. Esa dificultad para respirar necesita atención de urgencia ahora. Por favor llame al 911 o que alguien la lleve a urgencias. También estoy avisando a {clinic}. ¿Hay alguien con usted?", user: "Mi hija está aquí. Ella me puede llevar." },
    no_nausea: { bot: "¿Náuseas o vómitos en las últimas 24 horas?", user: "No, nada." },
    mild_nausea: { bot: "¿Náuseas o vómitos en las últimas 24 horas?", user: "Un poco de náuseas por la mañana. Sin vómitos." },
    nausea_worse: { bot: "¿Ha vomitado en las últimas 24 horas, cuántas veces? ¿Puede retener líquidos?", user: "Dos veces desde anoche. El agua la retengo, pero no quiero comida." },
    no_pain: { bot: "¿Algún dolor? Del 0 al 10, ¿cuánto en su peor momento hoy?", user: "Dolor no. Tal vez un 1." },
    mild_pain: { bot: "¿Algún dolor? Del 0 al 10, ¿cuánto en su peor momento hoy?", user: "Me duelen las articulaciones, como un 3. El acetaminofén ayuda." },
    fine_rest: { bot: "¿Dificultad para respirar, llagas en la boca, problemas para retener líquidos, hormigueo, sangrado o confusión?", user: "No, nada de eso." },
    low_mood: { bot: "¿Y cómo está de ánimo?", user: "Ha estado callada. Un poco decaída, creo. Ha sido una semana larga." },
    down: { bot: "¿Cómo está de ánimo? ¿Se siente triste o ansiosa?", user: "La verdad, estoy muy ansiosa por el estudio de la próxima semana. Me gustaría hablar con alguien." },
    meds_q: { bot: "¿Algo más para la enfermera, o alguna pregunta sobre sus medicinas?", user: "¿Puedo tomar ibuprofeno para las articulaciones, o solo el acetaminofén?" },
    caregiver: { bot: "Hola, le habla Nightingale, la llamada de seguimiento de {clinic} para {name}. ¿Está {name} disponible?", user: "Soy su hija. Está descansando, pero puedo contestar por ella." },
    later: { bot: "Hola {name}, le habla Nightingale, el seguimiento de la tarde de {clinic}. ¿Es buen momento?", user: "La verdad no, estamos cenando. ¿Puede llamar más tarde?" },
    thanks: { bot: "Gracias, {name}. La enfermera verá la nota de esta noche. Llame al {phone} cuando algo cambie. Buenas noches.", user: "Gracias. Buenas noches." },
    thanks_red: { bot: "Gracias, {name}. Ya avisé a {clinic}. Por favor haga esa llamada ahora; la enfermera tendrá la nota de esta noche. Cuídese.", user: "Está bien. Gracias." },
  },
};

function dialog(lang: string, name: string, keys: string[]): TranscriptTurn[] {
  const table = LINES[lang.startsWith("es") ? "es" : "en"];
  const seq = keys[0] === "caregiver" || keys[0] === "later" ? keys : ["intro", ...keys];
  const out: TranscriptTurn[] = [];
  let t = 0;
  for (const k of seq) {
    const line = table[k];
    if (!line) continue;
    out.push({ offset_seconds: t, speaker: "bot", text: line.bot });
    t += 6;
    out.push({ offset_seconds: t, speaker: "user", text: line.user });
    t += 5;
  }
  return out;
}

const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? "");

export class FakeCalleProvider implements CallProvider {
  readonly mode = "dry" as const;
  private calls = new Map<string, ProviderCall>();
  private byKey = new Map<string, string>();

  async create(input: CreateCallInput, idempotencyKey: string): Promise<ProviderCall> {
    const existing = this.byKey.get(idempotencyKey);
    if (existing) return this.calls.get(existing)!;
    const kind = String(input.metadata.kind ?? "checkin");
    const id = `fake_${Math.random().toString(36).slice(2, 10)}`;
    const now = new Date().toISOString();
    let call: ProviderCall;
    if (kind === "checkin") {
      const scenario = (input.metadata.scenario as Scenario) ?? pickScenario(input.phone);
      const s = SCENARIOS[scenario];
      const vars = { name: String(input.metadata.firstName ?? "there"), clinic: String(input.metadata.clinicName ?? "the clinic"), phone: String(input.metadata.clinicPhone ?? "") };
      const turns = s.turns(vars.name, input.locale ?? "en-US").map((t) => ({ ...t, text: fill(t.text, vars) }));
      const result = s.outcome === "completed" ? { ...emptyResult(), ...s.result } : null;
      call = { id, status: "completed", callOutcome: s.outcome, resultStatus: result ? "available" : "unavailable", transcript: turns, result: result as unknown as Record<string, string | number | boolean>, error: null, locale: input.locale ?? "en-US", metadata: { ...input.metadata, scenario }, createdAt: now, completedAt: now };
    } else if (kind === "escalation_clinic") {
      const voicemail = input.metadata.clinicScenario === "voicemail";
      const turns: TranscriptTurn[] = voicemail
        ? [{ offset_seconds: 0, speaker: "user", text: "You have reached the after-hours line. Please leave a message after the tone." }, { offset_seconds: 8, speaker: "bot", text: `This is Nightingale, the automated check-in service, with an urgent report for your patient ${input.metadata.patientFirstName}. ${String(input.metadata.reasons)}. Please call the patient back as soon as possible.` }]
        : [{ offset_seconds: 0, speaker: "user", text: "Oncology triage, this is Maria." }, { offset_seconds: 4, speaker: "bot", text: `This is Nightingale, the automated evening check-in service. I am reporting an urgent finding from tonight's call with your patient ${input.metadata.patientFirstName}. Do you have a moment?` }, { offset_seconds: 12, speaker: "user", text: "Go ahead." }, { offset_seconds: 14, speaker: "bot", text: `Urgent findings: ${String(input.metadata.reasons)}. The patient was told to call you now. Can you confirm someone will contact the patient tonight?` }, { offset_seconds: 30, speaker: "user", text: "Yes. I'll call them right now and get the on-call doctor. Thank you." }];
      const result = voicemail
        ? { reached_person: false, left_voicemail: true, staff_name: "", staff_response: "", will_call_patient: false, summary: "After-hours line went to voicemail; the full report was left as a message." }
        : { reached_person: true, left_voicemail: false, staff_name: "Maria", staff_response: "Will call the patient now and page the on-call doctor.", will_call_patient: true, summary: "Triage nurse Maria took the report and will call the patient now." };
      call = { id, status: "completed", callOutcome: "completed", resultStatus: "available", transcript: turns, result, error: null, locale: "en-US", metadata: input.metadata, createdAt: now, completedAt: now };
    } else {
      const turns: TranscriptTurn[] = [{ offset_seconds: 0, speaker: "bot", text: `Hello, this is Nightingale, the evening check-in service. This is about ${input.metadata.patientFirstName}'s check-in tonight. ${String(input.metadata.reasons)}. The clinic has been notified.` }, { offset_seconds: 14, speaker: "user", text: "Thank you for calling. I'm with her now, we're calling the clinic." }];
      call = { id, status: "completed", callOutcome: "completed", resultStatus: "available", transcript: turns, result: { reached_person: true, left_voicemail: false, staff_name: "", staff_response: "", will_call_patient: false, summary: "Caregiver reached and informed." }, error: null, locale: input.locale ?? "en-US", metadata: input.metadata, createdAt: now, completedAt: now };
    }
    this.calls.set(id, call);
    this.byKey.set(idempotencyKey, id);
    return call;
  }

  async get(id: string): Promise<ProviderCall> {
    const c = this.calls.get(id);
    if (!c) throw new Error(`unknown fake call ${id}`);
    return c;
  }
}

export function pickScenario(phone: string): Scenario {
  const order: Scenario[] = ["fine", "tired", "fine", "nausea_worse", "fine", "fever", "no_answer", "meds_question", "fine", "low_mood"];
  const d = Number(phone.slice(-1));
  return order[Number.isFinite(d) ? d : 0];
}
