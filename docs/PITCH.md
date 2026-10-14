# Finals pitch (5 min + 4 min Q&A)

1. Hook (30 s): fever sheet, 21-hour delay, median age 66, nobody opens the app.
2. Evidence (30 s): Basch 2017, 31.2 vs 26.0 months, fewer ER visits. It was a web form.
3. Live call (90 s): your phone rings; report a fever; it escalates.
4. Dashboard (60 s): tonight's alerts, escalation trail, transcript; voicemail case; everyone grid.
5. How it's built (45 s): voice-agent telephony with explicit locale; flat structured result; deterministic triage (tests); self-escalation; nothing stored beyond what a nurse needs.
6. Honest limits (30 s): not validated as a product; delivery mechanism for a validated practice; needs real auth and a BAA to deploy; languages depend on carrier routing.

Q&A prep
- "Is it a chatbot?" It initiates, it escalates, it works with no device. A chatbot waits.
- "What if the agent misunderstands?" Thresholds are conservative; "not sure" falls to nurse review; the transcript is one click away; the fever instruction is fixed text.
- "Liability?" It tells patients to call the clinic or 911, every time; it never advises; it records consent and discloses recording.
- "Why not SMS?" Older patients answer calls; voice captures nuance; SMS is a planned fallback for non-answers.
- "Cost?" ~$0.25 per call; a febrile-neutropenia admission is $19k–25k.
