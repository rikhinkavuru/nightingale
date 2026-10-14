import type { EscalationStep } from "@/db/schema";

export const RISK_LABEL: Record<string, string> = { red: "Urgent", amber: "Nurse call", green: "Okay", unreachable: "Not reached", none: "No call" };

export function RiskPill({ risk }: { risk: string | null | undefined }) {
  const r = risk ?? "none";
  return <span className={`pill pill-${r}`}>{RISK_LABEL[r] ?? r}</span>;
}

export function Dot({ risk, title }: { risk: string | null | undefined; title?: string }) {
  return <span className={`dot dot-${risk ?? "none"}`} title={title} />;
}

export function Transcript({ turns }: { turns: { speaker: string; text: string; offset_seconds: number | null }[] }) {
  if (!turns.length) return <p className="text-sm text-ink-3">No transcript (call did not connect).</p>;
  return (
    <div className="flex flex-col gap-2">
      {turns.map((t, i) => (
        <div key={i} className={`bubble ${t.speaker === "bot" ? "bubble-bot" : "bubble-user"}`}>
          <span className="mr-2 text-[10px] uppercase tracking-wider opacity-60">{t.speaker === "bot" ? "Nightingale" : "Patient"}</span>
          {t.text}
        </div>
      ))}
    </div>
  );
}

const OUTCOME_TEXT: Record<EscalationStep["outcome"], string> = {
  answered: "Answered",
  voicemail: "Voicemail: report left as a message",
  no_answer: "No answer",
  busy: "Busy",
  declined: "Declined",
  sent: "Sent",
  failed: "Failed",
  pending: "Pending",
};
const CHANNEL_TEXT: Record<EscalationStep["channel"], string> = { clinic_call: "Called the clinic on-call line", caregiver_call: "Called the caregiver", email: "Emailed the clinic" };

export function EscalationRail({ steps }: { steps: EscalationStep[] }) {
  if (!steps.length) return <p className="text-xs text-ink-3">No escalation steps.</p>;
  return (
    <ol className="rail space-y-2 pl-6 text-sm">
      {steps.map((s, i) => (
        <li key={i} className="relative">
          <span className={`absolute -left-6 top-1 h-4 w-4 rounded-full border-2 ${s.outcome === "answered" || s.outcome === "sent" ? "border-green bg-green-2" : s.outcome === "voicemail" ? "border-amber bg-amber-2" : s.outcome === "pending" ? "border-ink-3 bg-white" : "border-red bg-red-2"}`} />
          <div className="font-medium">
            {CHANNEL_TEXT[s.channel]} <span className="text-ink-3">· {s.target}</span>
          </div>
          <div className="text-ink-2">
            {OUTCOME_TEXT[s.outcome]}
            {s.note ? ` — ${s.note}` : ""}
          </div>
          <div className="text-[11px] text-ink-3">{new Date(s.at).toLocaleString("en-US", { hour: "numeric", minute: "2-digit", month: "short", day: "numeric" })}</div>
        </li>
      ))}
    </ol>
  );
}

export function fmtDay(day: string) {
  const d = new Date(day + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
