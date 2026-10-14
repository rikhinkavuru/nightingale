import { describe, it, expect } from "vitest";
import { buildCheckinTask, buildClinicEscalationTask, CHECKIN_RESULT_SCHEMA, ESCALATION_RESULT_SCHEMA } from "./script";
import { FakeCalleProvider } from "./fake";
import { triage } from "@/lib/domain/triage";

describe("result schemas respect the CALL-E scalar-object profile", () => {
  for (const [name, schema] of [["checkin", CHECKIN_RESULT_SCHEMA], ["escalation", ESCALATION_RESULT_SCHEMA]] as const) {
    it(`${name}: flat, closed, <= 32 scalar properties, all required`, () => {
      const props = Object.entries(schema.properties);
      expect(props.length).toBeLessThanOrEqual(32);
      expect(schema.additionalProperties).toBe(false);
      for (const [, p] of props) expect(["string", "boolean", "integer", "number"]).toContain((p as { type: string }).type);
      expect([...schema.required].sort()).toEqual(props.map(([k]) => k).sort());
    });
  }
});

describe("scripts", () => {
  it("check-in task names the clinic, the language, the fever threshold and the clinic phone", () => {
    const t = buildCheckinTask({ firstName: "Rosa", locale: "es-MX", clinicName: "Lakeside Oncology", clinicPhone: "+15555550100" });
    expect(t).toMatch(/Speak Spanish/);
    expect(t).toMatch(/100\.4/);
    expect(t).toMatch(/\+15555550100/);
    expect(t).toMatch(/988/);
    expect(t).not.toMatch(/undefined/);
  });
  it("escalation task includes reasons and a voicemail script", () => {
    const t = buildClinicEscalationTask({ clinicName: "Lakeside Oncology", patientFirstName: "Rosa", patientPhone: "+15555550123", reasons: ["Fever 100.9"], summary: "Felt hot.", checkinTime: "6:05 pm", appUrl: "https://x" });
    expect(t).toMatch(/voicemail/i);
    expect(t).toMatch(/Fever 100\.9/);
  });
});

describe("fake provider", () => {
  it("is idempotent and produces triage-able results per scenario", async () => {
    const p = new FakeCalleProvider();
    const base = { task: "x", phone: "+15555550105", locale: "en-US", resultSchema: {}, metadata: { kind: "checkin", firstName: "Rosa", clinicName: "C", clinicPhone: "1" } };
    const a = await p.create({ ...base, metadata: { ...base.metadata, scenario: "fever" } }, "k1");
    const b = await p.create({ ...base, metadata: { ...base.metadata, scenario: "fever" } }, "k1");
    expect(a.id).toBe(b.id);
    expect(triage(a.result as never).risk).toBe("red");
    const fine = await p.create({ ...base, metadata: { ...base.metadata, scenario: "fine" } }, "k2");
    expect(triage(fine.result as never).risk).toBe("green");
    const na = await p.create({ ...base, metadata: { ...base.metadata, scenario: "no_answer" } }, "k3");
    expect(na.callOutcome).toBe("no_answer");
    expect(na.result).toBeNull();
    const es = await p.create({ ...base, locale: "es-MX", metadata: { ...base.metadata, scenario: "nausea_worse" } }, "k4");
    expect(es.transcript[0].text).toMatch(/Nightingale/);
    expect(es.transcript[1].text).toMatch(/Sí/);
    expect(triage(es.result as never).risk).toBe("amber");
  });
});
