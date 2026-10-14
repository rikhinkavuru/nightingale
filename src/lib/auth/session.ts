import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const NAME = "ng_session";
function sign(v: string) {
  return createHmac("sha256", process.env.SESSION_SECRET ?? "dev").update(v).digest("hex");
}
export async function setClinicSession(slug: string) {
  const c = await cookies();
  c.set(NAME, `${slug}.${sign(slug)}`, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
}
export async function clinicSessionSlug(): Promise<string | null> {
  const c = await cookies();
  const v = c.get(NAME)?.value;
  if (!v) return null;
  const [slug, sig] = v.split(".");
  if (!slug || !sig) return null;
  const expected = sign(slug);
  if (expected.length !== sig.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  return slug;
}
export async function clearClinicSession() {
  const c = await cookies();
  c.delete(NAME);
}
