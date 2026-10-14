import { Resend } from "resend";

export async function sendEmail(to: string, subject: string, text: string): Promise<"sent" | "failed" | "skipped"> {
  const key = process.env.RESEND_API_KEY;
  if (!key || process.env.NIGHTINGALE_MODE !== "live") return "skipped";
  try {
    const resend = new Resend(key);
    await resend.emails.send({ from: process.env.EMAIL_FROM ?? "Nightingale <onboarding@resend.dev>", to, subject, text });
    return "sent";
  } catch {
    return "failed";
  }
}
