# Nightingale

**It calls you every evening.**

Nightingale phones each chemotherapy patient at the hour they chose, in their own language, and asks the eleven questions a nurse would ask. It grades the answers on the PRO-CTCAE scale oncology nurses already use. When something is dangerous it does not say "call your doctor": it tells the patient exactly what to do, phones the clinic's on-call line itself with the report, leaves the full message if the line goes to voicemail, emails the clinic, and calls the caregiver. The nurse opens the dashboard to a transcript, not a mystery.

Built for the CodeTheCure Hackathon 2026, Patient Experience & Support track. Live demo clinic: https://nightingale-gilt.vercel.app/c/lakeside (access code `demo`; every call in the demo is simulated, no phone rings).

## Why

- **Symptom reporting extends life.** In a randomized trial of 766 patients with advanced cancer on chemotherapy, those who reported symptoms regularly, with nurses acting on alerts, lived a median 31.2 months versus 26.0 (Basch et al., JAMA 2017;318:197), with fewer emergency visits and more time on treatment. That is the strongest result in cancer software, and it came from a web form that most patients, median age 66, would never open.
- **Patients wait.** Chemotherapy patients with a fever waited a mean of 21 hours (range 1 to 72) before seeking care in a prospective study (Nirenberg et al., Oncol Nurs Forum 2004). Febrile neutropenia kills 2 to 7% of the adults it hospitalizes and costs $19,000 to $25,000 per episode; antibiotic delay raises mortality by the hour.
- **The phone is the only interface everyone has.** No app, no portal, no login, no English required.

## What it does

1. **Enroll** (30 seconds, by the clinic): name, phone, language, hour to call, regimen, caregiver, consent.
2. **Call** at that hour through [CALL-E](https://www.heycall-e.com/), a voice-agent telephony API. The script says the call is automated and recorded, asks the eleven questions, accepts short answers, and calls back later if it is a bad time. A caregiver may answer for the patient.
3. **Grade and triage.** The agent returns a flat structured result (temperature, nausea 0–4, vomiting episodes, pain 0–10, breathing 0–4, mouth sores, fluids, fatigue, numbness, mood, bleeding, confusion, self-harm thoughts, other symptoms, medication questions, callback request, summary). Deterministic rules in `src/lib/domain/triage.ts` decide:
   - **Urgent tonight**: fever ≥ 100.4°F or chills, severe or new shortness of breath, chest pain, bleeding, confusion or new weakness, unable to keep fluids down, vomiting ≥ 4 or diarrhea ≥ 7 in 24 h, uncontrolled pain ≥ 8, mouth sores preventing drinking, thoughts of self-harm.
   - **Nurse call within 24 h**: any symptom severe (3/4) or worsened by 2 points since the last call (the Basch alert rule), vomiting 2–3, diarrhea 4–6, pain ≥ 5, low-grade temperature, a medication question, or a request to talk to someone.
   - **Okay**, or **not reached** (retried once an hour later, then flagged).
4. **Escalate, itself.** Urgent: the patient is told during the call to phone the clinic now (or 911 for chest pain, breathing, confusion, bleeding); Nightingale then places a second call to the clinic's on-call line with a scripted report, including a voicemail script if nobody answers; emails the clinic; and calls the caregiver in the patient's language, telling them whether the clinic was reached. Nurse-call level: email to the clinic. Every step and its outcome is recorded on the alert.
5. **Dashboard.** Tonight's open alerts first, each with the reasons, the patient's own words, and the escalation trail; then everyone, with seven evenings of colored dots and the latest summary. Patient pages show per-symptom trends and full transcripts, and a "Call now" button.

## What it never does

- No medical advice, no doses. Medication questions go to the nurse verbatim.
- No softening of red flags. The safety words are fixed in the script.
- No calls without consent; the first sentence says it is automated and recorded.
- No diagnosis. It is the nurse's ears every evening, not the nurse.

## Languages

The call is placed with an explicit BCP-47 locale, and the script instructs the agent to speak that language throughout: English, Spanish, Portuguese, Hindi, Tamil, Vietnamese, Mandarin, Malay, Indonesian, German, Polish, Turkish, Japanese, Thai, Urdu, Bengali, Finnish (CALL-E's supported set). Which languages reach a given phone number depends on the destination region's line configuration; see "Limitations".

## Running it

```bash
npm install
cp .env.example .env.local        # fill in
npm run db:push                   # creates tables in Neon
npm run seed                      # builds the Lakeside demo clinic (dry run)
npm run dev
npm test
```

Environment:

| variable | purpose |
|---|---|
| `DATABASE_URL` | Neon Postgres (provisioned through the Vercel marketplace) |
| `CALLE_API_KEY` | CALL-E API key; only used when `NIGHTINGALE_MODE=live` |
| `NIGHTINGALE_MODE` | `dry` (default; simulated calls, nothing dials) or `live` |
| `WEBHOOK_SECRET` | path secret for `/api/webhook/<secret>` (CALL-E deliveries are unsigned) |
| `CRON_SECRET` | protects `/api/cron/dispatch` and `/api/demo/reset` |
| `SESSION_SECRET` | signs the clinic dashboard cookie |
| `RESEND_API_KEY`, `EMAIL_FROM` | clinic emails (live mode only) |
| `APP_URL` | public base URL, used in webhooks and emails |

Scheduling: `vercel.json` runs the dispatcher daily (Hobby plan limit); point any external scheduler at `GET /api/cron/dispatch?secret=…` every 15 minutes for hour-accurate calls. The dispatcher only calls patients whose local hour has arrived and who have no completed check-in today.

## Architecture

```
src/db/schema.ts            clinics, patients, checkins, alerts (escalation steps as JSON), call_log
src/lib/domain/triage.ts    PRO-CTCAE-style grading and red/amber/green rules, unit-tested
src/lib/calls/script.ts     the call task per language, the flat result schemas, the clinic voicemail script, the caregiver script
src/lib/calls/live.ts       CALL-E v2 adapter (@call-e/calle)
src/lib/calls/fake.ts       scenario-driven fake provider with English and Spanish transcripts, used by the demo
src/lib/services/checkin.ts dispatch → process → triage → alert → escalate (clinic call, voicemail, email, caregiver call), idempotent
src/app/api/webhook         terminal call events from CALL-E
src/app/api/cron/dispatch   tonight's calls
src/app/c/[slug]            clinic dashboard (access code + signed cookie), patient pages, enrollment, server actions
```

Stack: Next.js 16, TypeScript, Tailwind v4, Drizzle + Neon Postgres, `@call-e/calle` 1.0, Resend, Vitest. Deployed on Vercel.

## Limitations, stated plainly

- **Validation.** The triage thresholds come from published patient "when to call" rules and the Basch trial's alert logic, not from a trial of this product. The survival evidence is for nurse-acted symptom reporting in general; Nightingale is a delivery mechanism for it, not a new finding.
- **Cycle of reliance.** A patient must still be able and willing to call 911; the script says so every time. Nightingale never replaces that.
- **Language reach.** CALL-E routes by the destination number's country; some languages are only available on international lines. Spanish to a US number may route through a Mexican line, which costs more and is marked for testing by the provider.
- **Voicemail detection** relies on the agent recognizing a greeting and following the script; it is not a carrier-level answering-machine signal.
- **Scheduling precision** on the free Vercel plan is daily; a 15-minute external ping gives hour-accurate calls.
- **Security** is hackathon-grade: one access code per clinic, a signed cookie, secrets in URLs for webhooks and cron. A real deployment needs real auth, audit logs, a BAA with the telephony provider, and HIPAA review of recordings.
- **Cost**: roughly $0.20–0.30 per four-minute check-in call on CALL-E's domestic rates, plus escalation calls.
