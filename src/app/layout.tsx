import type { Metadata } from "next";
import { Newsreader, Geist } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const newsreader = Newsreader({ variable: "--font-newsreader", subsets: ["latin"], style: ["normal", "italic"] });
const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "https://nightingale-gilt.vercel.app"),
  title: "Nightingale — it calls you every evening",
  description: "An evening phone call that checks on chemotherapy patients in their own language, grades what they say on the scale nurses use, and phones the clinic itself when something is wrong.",
  openGraph: { title: "Nightingale", description: "It calls you every evening.", type: "website" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${newsreader.variable} ${geist.variable}`}>
      <body>
        <header className="border-b border-line/70 bg-cream">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="display text-2xl font-medium">Nightingale</Link>
            <nav className="flex items-center gap-5 text-sm text-ink-2">
              <Link href="/c/lakeside" className="hover:text-ink">Demo clinic</Link>
              <Link href="/#how" className="hover:text-ink">How it works</Link>
              <Link href="/#evidence" className="hover:text-ink">Evidence</Link>
              <a href="https://github.com/rikhinkavuru/nightingale" target="_blank" rel="noreferrer" className="hover:text-ink">Source</a>
            </nav>
          </div>
        </header>
        {children}
        <footer className="mt-20 border-t border-line/70">
          <div className="mx-auto max-w-6xl px-4 py-8 text-xs leading-relaxed text-ink-3">
            Nightingale is a symptom check-in and escalation service, not a diagnosis or a substitute for a nurse. Every call tells the patient it is automated and recorded. Fever, chest pain, breathing trouble, confusion and bleeding always get the same instruction: call the clinic now, or 911. Built for the CodeTheCure Hackathon 2026.
          </div>
        </footer>
      </body>
    </html>
  );
}
