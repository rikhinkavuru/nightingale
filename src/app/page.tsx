import Link from "next/link";
import { SUPPORTED_LOCALES } from "@/lib/calls/script";
import { Transcript } from "@/components/ui";

const SAMPLE = [
  { speaker: "bot", text: "Hola Rosa, le habla Nightingale, la llamada de seguimiento de la tarde de Lakeside Oncology. Esta llamada se graba para que su enfermera pueda revisarla. ¿Es buen momento para hablar unos minutos?", offset_seconds: 0 },
  { speaker: "user", text: "Sí, está bien.", offset_seconds: 8 },
  { speaker: "bot", text: "¿Cómo se siente hoy, en general?", offset_seconds: 10 },
  { speaker: "user", text: "Desde la tarde me siento con calor y escalofríos.", offset_seconds: 14 },
  { speaker: "bot", text: "¿Se tomó la temperatura?", offset_seconds: 19 },
  { speaker: "user", text: "Sí, hace como una hora. Marcó 100.9.", offset_seconds: 24 },
  { speaker: "bot", text: "Gracias por decírmelo. Una temperatura de 100.9 es algo que su equipo médico necesita saber esta noche. Estoy avisando a Lakeside Oncology ahora mismo. Por favor llame al +1 555 555 0100 ahora; si nadie contesta, vaya a urgencias. ¿Puede hacerlo?", offset_seconds: 28 },
  { speaker: "user", text: "Sí. Voy a llamar ahora mismo.", offset_seconds: 40 },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl px-4">
      <section className="grid gap-10 pb-14 pt-14 md:grid-cols-[1.1fr_1fr] md:pt-20">
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-amber">For people on chemotherapy, and the nurses who worry about them</p>
          <h1 className="display text-[3rem] font-medium leading-[1.02] md:text-[4.2rem]">It calls you every evening.</h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-2">
            Nightingale phones each patient at the hour they chose, in their own language, and asks the questions a nurse would ask. It grades the answers on the scale oncology nurses already use. When something is dangerous, it does not say “call your doctor.” It calls the clinic itself, leaves the report if nobody picks up, and lets the family know.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/c/lakeside" className="btn btn-primary">Open the demo clinic</Link>
            <a href="#how" className="btn btn-ghost">How it works</a>
          </div>
          <p className="mt-3 text-xs text-ink-3">Demo access code: <span className="font-mono">demo</span>. Every call in the demo is simulated; no phone rings.</p>
        </div>
        <div className="card rise p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">A call, Tuesday 6:04 pm, Spanish</p>
          <div className="mt-3">
            <Transcript turns={SAMPLE} />
          </div>
          <div className="mt-4 rounded-xl bg-red-2 p-3 text-sm text-red">
            <span className="font-semibold">6:06 pm</span> Urgent: fever 100.9°F. Nightingale called Lakeside’s on-call line, reached triage nurse Maria, who is calling Rosa now. Rosa’s son Luis was told.
          </div>
        </div>
      </section>

      <section id="evidence" className="border-t border-line/70 py-14">
        <h2 className="display text-3xl font-medium">Why a phone call, and why every evening</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          <div className="card p-5">
            <div className="display text-4xl font-medium">31 vs 26 months</div>
            <p className="mt-2 text-sm text-ink-2">
              Median survival for patients with advanced cancer who reported symptoms regularly during chemotherapy versus usual care, in a randomized trial of 766 patients. Nurses acted on the alerts. Fewer emergency visits, more time on treatment, better quality of life.
            </p>
            <p className="mt-2 text-xs text-ink-3">Basch et al., JAMA 2017; 318(2):197–198.</p>
          </div>
          <div className="card p-5">
            <div className="display text-4xl font-medium">21 hours</div>
            <p className="mt-2 text-sm text-ink-2">
              Mean delay before chemotherapy patients with a fever sought care in one prospective study (range 1 to 72 hours). Febrile neutropenia kills 2 to 7% of the adults it hospitalizes, and every hour of delayed antibiotics raises mortality.
            </p>
            <p className="mt-2 text-xs text-ink-3">Nirenberg et al., Oncol Nurs Forum 2004; Koenig et al. 2019.</p>
          </div>
          <div className="card p-5">
            <div className="display text-4xl font-medium">Age 66</div>
            <p className="mt-2 text-sm text-ink-2">
              The median age at cancer diagnosis. The patients with the most to gain from symptom reporting are the least likely to open an app, read a portal, or type to a chatbot. Everyone answers the phone.
            </p>
            <p className="mt-2 text-xs text-ink-3">NCI SEER.</p>
          </div>
        </div>
      </section>

      <section id="how" className="border-t border-line/70 py-14">
        <h2 className="display text-3xl font-medium">How it works</h2>
        <ol className="mt-6 grid gap-6 md:grid-cols-4">
          {[
            ["The clinic enrolls the patient", "Name, phone, language, the hour they want to be called, the regimen, a caregiver. Thirty seconds. The patient needs nothing: no app, no login, no smartphone."],
            ["Nightingale calls", "At that hour, in that language. It says it is automated and recorded, asks eleven short questions a nurse would ask, and listens. Four minutes. If it is a bad time, it calls back."],
            ["The answers are graded", "Each answer lands on the PRO-CTCAE scale nurses already use. Rules decide what is urgent tonight (fever, breathing, bleeding, confusion, can’t keep fluids down), what needs a nurse call tomorrow, and what is fine."],
            ["It escalates, itself", "Urgent: the patient is told to call now, and Nightingale phones the clinic’s on-call line with the report. Voicemail? It leaves the full message, emails the clinic, and calls the caregiver. The nurse opens the dashboard to a transcript, not a mystery."],
          ].map(([t, d], i) => (
            <li key={t} className="card p-5">
              <div className="display text-3xl text-gold">{i + 1}</div>
              <h3 className="mt-2 font-semibold">{t}</h3>
              <p className="mt-1 text-sm text-ink-2">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-t border-line/70 py-14">
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <h2 className="display text-3xl font-medium">In the patient’s language</h2>
            <p className="mt-3 text-ink-2">The call is placed through a voice agent that speaks the patient’s language natively; the questions, the safety instruction and the goodbye are the same in every one.</p>
            <ul className="mt-4 flex flex-wrap gap-2 text-sm">
              {SUPPORTED_LOCALES.map((l) => (
                <li key={l.code} className="rounded-full border border-line bg-white px-3 py-1">{l.label}</li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="display text-3xl font-medium">What it never does</h2>
            <ul className="mt-3 space-y-2 text-ink-2">
              <li>It never gives medical advice or suggests a dose. Medication questions go to the nurse, verbatim.</li>
              <li>It never softens a red flag. Fever, chest pain, breathing trouble, confusion and bleeding always get the same words: call the clinic now, or 911.</li>
              <li>It never replaces the nurse. It makes sure the nurse hears tonight, with the transcript, instead of in the ER tomorrow.</li>
              <li>It never calls without consent, and it says it is automated and recorded in its first sentence.</li>
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}
