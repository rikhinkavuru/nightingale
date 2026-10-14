import { loginAction } from "../actions";
import { clinicBySlug } from "@/lib/services/queries";
import { notFound } from "next/navigation";

export default async function Login({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ error?: string }> }) {
  const { slug } = await params;
  const { error } = await searchParams;
  const clinic = await clinicBySlug(slug);
  if (!clinic) notFound();
  const action = loginAction.bind(null, slug);
  return (
    <main className="mx-auto max-w-md px-4 py-20">
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">Clinic dashboard</p>
      <h1 className="display mt-1 text-3xl font-medium">{clinic.name}</h1>
      <form action={action} className="card mt-6 p-5">
        <label className="block text-sm font-medium">Access code</label>
        <input name="code" type="password" className="field mt-1" autoFocus defaultValue={slug === "lakeside" ? "demo" : ""} />
        {error && <p className="mt-2 text-sm text-red">That code didn’t match.</p>}
        <button className="btn btn-primary mt-4 w-full" type="submit">Open dashboard</button>
        {slug === "lakeside" && <p className="mt-3 text-xs text-ink-3">This is the shared demo clinic. Code: demo.</p>}
      </form>
    </main>
  );
}
