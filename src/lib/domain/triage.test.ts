import { describe, it, expect } from "vitest";
import { triage, type CheckinResult } from "./triage";

const ok: CheckinResult = {
  reached: true, call_back_later: false, temperature_f: -1, fever_or_chills: false, nausea: 0, vomiting_24h: 0, diarrhea_24h: 0, pain: 0, pain_controlled: true,
  shortness_of_breath: 0, chest_pain: false, mouth_sores: 0, keeping_fluids_down: true, fatigue: 1, numbness_tingling: 0, low_mood: 0, bleeding: false,
  confusion_or_weakness: false, self_harm_thoughts: false, other_symptoms: "", medication_question: "", wants_callback: false, summary: "Feeling okay.",
};

describe("triage", () => {
  it("green when nothing notable", () => expect(triage(ok).risk).toBe("green"));
  it("unreachable when not reached or asked for later", () => {
    expect(triage({ ...ok, reached: false }).risk).toBe("unreachable");
    expect(triage({ ...ok, call_back_later: true }).risk).toBe("unreachable");
  });
  it("fever >= 100.4 is red; 99.5-100.3 is amber; chills alone is red", () => {
    expect(triage({ ...ok, temperature_f: 100.4 }).risk).toBe("red");
    expect(triage({ ...ok, temperature_f: 100.3 }).risk).toBe("amber");
    expect(triage({ ...ok, temperature_f: 99.4 }).risk).toBe("green");
    expect(triage({ ...ok, fever_or_chills: true }).risk).toBe("red");
  });
  it("emergency symptoms are red", () => {
    for (const patch of [{ chest_pain: true }, { shortness_of_breath: 3 }, { bleeding: true }, { confusion_or_weakness: true }, { keeping_fluids_down: false }, { self_harm_thoughts: true }, { mouth_sores: 4 }])
      expect(triage({ ...ok, ...patch }).risk).toBe("red");
  });
  it("vomiting and diarrhea thresholds", () => {
    expect(triage({ ...ok, vomiting_24h: 4 }).risk).toBe("red");
    expect(triage({ ...ok, vomiting_24h: 2 }).risk).toBe("amber");
    expect(triage({ ...ok, vomiting_24h: 1 }).risk).toBe("green");
    expect(triage({ ...ok, diarrhea_24h: 7 }).risk).toBe("red");
    expect(triage({ ...ok, diarrhea_24h: 4 }).risk).toBe("amber");
  });
  it("pain: 8+ uncontrolled red; 8+ controlled amber; 5 amber; 3 green", () => {
    expect(triage({ ...ok, pain: 8, pain_controlled: false }).risk).toBe("red");
    expect(triage({ ...ok, pain: 8, pain_controlled: true }).risk).toBe("amber");
    expect(triage({ ...ok, pain: 5 }).risk).toBe("amber");
    expect(triage({ ...ok, pain: 3 }).risk).toBe("green");
  });
  it("severe grade or 2-point worsening is amber", () => {
    expect(triage({ ...ok, nausea: 3 }).risk).toBe("amber");
    expect(triage({ ...ok, nausea: 2 }, { ...ok, nausea: 0 }).reasons.join()).toMatch(/worsened from 0 to 2/);
    expect(triage({ ...ok, nausea: 2 }, { ...ok, nausea: 1 }).risk).toBe("green");
  });
  it("callback request and medication question are amber", () => {
    expect(triage({ ...ok, wants_callback: true }).risk).toBe("amber");
    expect(triage({ ...ok, medication_question: "Can I take ibuprofen?" }).reasons[0]).toMatch(/Medication question/);
  });
  it("red wins over amber and lists all red reasons", () => {
    const t = triage({ ...ok, temperature_f: 101, vomiting_24h: 5, pain: 6 });
    expect(t.risk).toBe("red");
    expect(t.reasons).toHaveLength(2);
  });
  it("tolerates missing fields from a partial result", () => {
    expect(triage({ reached: true }).risk).toBe("green");
  });
});
